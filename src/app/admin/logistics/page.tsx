import * as React from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { SidebarLayout } from "@/components/module/sidebar-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { initiateLogistics } from "@/lib/logistics"
import type { Delivery, DeliveryCheckpoint, Campaign, Inventory } from "@/lib/database.types"
import { 
  Truck, 
  CheckCircle2, 
  Package, 
  MapPin, 
  User as UserIcon,
  MoreVertical,
  Search,
  Filter,
  CheckCircle,
  Circle,
  AlertCircle,
  Loader2,
  RefreshCw
} from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type FullDelivery = Delivery & {
  campaign: Campaign
  checkpoints: DeliveryCheckpoint[]
}

export default function AdminLogisticsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null)
  const [deliveries, setDeliveries] = React.useState<FullDelivery[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedDeliveryId, setSelectedDeliveryId] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [updating, setUpdating] = React.useState(false)
  const [inventoryItems, setInventoryItems] = React.useState<Inventory[]>([])
  const [loadingItems, setLoadingItems] = React.useState(false)
  const [pendingCampaigns, setPendingCampaigns] = React.useState<Campaign[]>([])
  const [checkingPending, setCheckingPending] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<"active" | "pending" | "cancelled">("active")
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [isCancelDialogOpen, setIsCancelDialogOpen] = React.useState(false)
  const [deliveryToEdit, setDeliveryToEdit] = React.useState<FullDelivery | null>(null)
  const [deliveryToCancel, setDeliveryToCancel] = React.useState<FullDelivery | null>(null)
  const [checkpointToConfirm, setCheckpointToConfirm] = React.useState<{id: string, currentStatus: string, name: string} | null>(null)

  const [editDestination, setEditDestination] = React.useState("")
  const [editAssignedPersonnel, setEditAssignedPersonnel] = React.useState("")
  const [editEstimatedDelivery, setEditEstimatedDelivery] = React.useState("")
  const [editStatus, setEditStatus] = React.useState("")

  React.useEffect(() => {
    if (deliveryToEdit) {
      setEditDestination(deliveryToEdit.destination || "")
      setEditAssignedPersonnel(deliveryToEdit.assigned_personnel || "")
      setEditEstimatedDelivery(
        deliveryToEdit.estimated_delivery
          ? new Date(deliveryToEdit.estimated_delivery).toISOString().split("T")[0]
          : ""
      )
      setEditStatus(deliveryToEdit.status)
    }
  }, [deliveryToEdit])

  const fetchDeliveries = React.useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("deliveries")
        .select(`
          *,
          campaign:campaigns(*),
          checkpoints:delivery_checkpoints(*)
        `)
        .order("created_at", { ascending: false })

      if (error) throw error

      const formattedData = (data || []).map((d: any) => ({
        ...d,
        campaign: Array.isArray(d.campaign) ? d.campaign[0] : d.campaign,
        checkpoints: (d.checkpoints || []).sort((a: any, b: any) => a.order_index - b.order_index)
      }))

      setDeliveries(formattedData as FullDelivery[])
      if (formattedData.length > 0 && !selectedDeliveryId) {
        setSelectedDeliveryId(formattedData[0].id)
      }
    } catch (error: any) {
      toast.error("Failed to fetch deliveries", { description: error.message })
    } finally {
      setLoading(false)
    }
  }, [selectedDeliveryId])

  const fetchInventoryItems = React.useCallback(async (campaignId: string) => {
    setLoadingItems(true)
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("campaign_id", campaignId)
      
      if (error) throw error
      setInventoryItems(data || [])
    } catch (error: any) {
      console.error("Error fetching inventory items:", error)
    } finally {
      setLoadingItems(false)
    }
  }, [])

  React.useEffect(() => {
    if (selectedDeliveryId) {
      const delivery = deliveries.find(d => d.id === selectedDeliveryId)
      if (delivery?.campaign_id) {
        fetchInventoryItems(delivery.campaign_id)
      }
    } else {
      setInventoryItems([])
    }
  }, [selectedDeliveryId, deliveries, fetchInventoryItems])

  React.useEffect(() => {
    async function checkAdmin() {
      if (!user) return
      
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
      
      if (error || !["admin", "trustee"].includes(data?.role)) {
        toast.error("Access Denied", {
          description: "This page is only accessible to administrators and trustees."
        })
        navigate("/dashboard")
        return
      }
      
      setIsAdmin(true)
      fetchDeliveries()
    }
    
    checkAdmin()
  }, [user, navigate, fetchDeliveries])

  const fetchPendingLogistics = React.useCallback(async () => {
    if (!isAdmin) return
    setCheckingPending(true)
    try {
      // 1. Get completed campaigns
      const { data: completed, error: compError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("status", "completed")
      
      if (compError) throw compError

      // 2. Get existing deliveries
      const { data: existing, error: existError } = await supabase
        .from("deliveries")
        .select("campaign_id")
      
      if (existError) throw existError

      const existingIds = new Set(existing.map(e => e.campaign_id))
      const pending = (completed || []).filter(c => !existingIds.has(c.id))
      setPendingCampaigns(pending)
    } catch (error) {
      console.error("Error checking pending logistics:", error)
    } finally {
      setCheckingPending(false)
    }
  }, [isAdmin])

  React.useEffect(() => {
    if (isAdmin) {
      fetchPendingLogistics()
    }
  }, [isAdmin, deliveries, fetchPendingLogistics])

  const handleInitiateManual = async (campaignId: string) => {
    setUpdating(true)
    try {
      const result = await initiateLogistics(campaignId)
      if (result.success) {
        toast.success("Logistics initialized successfully")
        if (result.deliveryId) {
          setSelectedDeliveryId(result.deliveryId)
        }
        setActiveTab("active")
        fetchDeliveries()
      } else {
        throw result.error
      }
    } catch (error: any) {
      toast.error("Failed to initiate logistics", { 
        description: error.message || "Please check Supabase RLS policies for the 'deliveries' table."
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleCancelPending = async (campaignId: string) => {
    setUpdating(true)
    try {
      const result = await initiateLogistics(campaignId)
      if (result.success && result.deliveryId) {
        const { error } = await supabase
          .from("deliveries")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", result.deliveryId)
        if (error) throw error
        toast.success("Delivery tracking cancelled")
        fetchDeliveries()
        fetchPendingLogistics()
      } else {
        throw result.error
      }
    } catch (error: any) {
      toast.error("Failed to cancel tracking", { 
        description: error.message 
      })
    } finally {
      setUpdating(false)
    }
  }

  const selectedDelivery = deliveries.find(d => d.id === selectedDeliveryId)

  const handleCheckpointClick = (checkpoint: DeliveryCheckpoint) => {
    if (updating || !selectedDelivery) return

    const checkpointIndex = selectedDelivery.checkpoints.findIndex(c => c.id === checkpoint.id)
    if (checkpointIndex === -1) return

    const isCompleting = checkpoint.status !== "completed"

    if (isCompleting && checkpointIndex > 0) {
      const previousCheckpoint = selectedDelivery.checkpoints[checkpointIndex - 1]
      if (previousCheckpoint.status !== "completed") {
        toast.error("Cannot skip steps", {
          description: `Please complete "${previousCheckpoint.name}" first.`,
        })
        return
      }
    } else if (!isCompleting && checkpointIndex < selectedDelivery.checkpoints.length - 1) {
      const nextCheckpoint = selectedDelivery.checkpoints[checkpointIndex + 1]
      if (nextCheckpoint.status === "completed") {
        toast.error("Cannot un-complete step", {
          description: `Please un-complete "${nextCheckpoint.name}" first.`,
        })
        return
      }
    }

    setCheckpointToConfirm({
      id: checkpoint.id,
      currentStatus: checkpoint.status,
      name: checkpoint.name
    })
  }

  const handleConfirmToggleCheckpoint = async () => {
    if (!checkpointToConfirm || updating) return
    setUpdating(true)
    const newStatus = checkpointToConfirm.currentStatus === "completed" ? "pending" : "completed"
    try {
      const { error } = await supabase
        .from("delivery_checkpoints")
        .update({ 
          status: newStatus,
          checkpoint_time: newStatus === "completed" ? new Date().toISOString() : null
        })
        .eq("id", checkpointToConfirm.id)

      if (error) throw error
      
      if (selectedDelivery) {
        const totalCheckpoints = selectedDelivery.checkpoints.length
        const completedCheckpoints = selectedDelivery.checkpoints.filter(c => 
          c.id === checkpointToConfirm.id ? newStatus === "completed" : c.status === "completed"
        ).length
        const newProgress = Math.round((completedCheckpoints / totalCheckpoints) * 100)
        
        let newDeliveryStatus = selectedDelivery.status
        if (newStatus === "completed") {
          if (checkpointToConfirm.name === "Ready for Dispatch") newDeliveryStatus = "ready_for_dispatch"
          if (checkpointToConfirm.name === "In Transit") newDeliveryStatus = "in_transit"
          if (checkpointToConfirm.name === "Delivered to Destination") newDeliveryStatus = "completed"
        } else {
          if (checkpointToConfirm.name === "Ready for Dispatch") newDeliveryStatus = "scheduled"
          if (checkpointToConfirm.name === "In Transit") newDeliveryStatus = "ready_for_dispatch"
          if (checkpointToConfirm.name === "Delivered to Destination") newDeliveryStatus = "in_transit"
        }

        await supabase
          .from("deliveries")
          .update({ progress: newProgress, status: newDeliveryStatus })
          .eq("id", selectedDelivery.id)
      }

      toast.success(`"${checkpointToConfirm.name}" updated successfully`)
      fetchDeliveries()
    } catch (error: any) {
      toast.error("Update failed", { description: error.message })
    } finally {
      setUpdating(false)
      setCheckpointToConfirm(null)
    }
  }



  const handleRestoreDelivery = async (deliveryId: string) => {
    setUpdating(true)
    try {
      const deliveryToRestore = deliveries.find(d => d.id === deliveryId);
      if (!deliveryToRestore) throw new Error("Delivery not found");

      const completedCheckpoints = deliveryToRestore.checkpoints.filter(c => c.status === "completed");
      let restoredStatus = "scheduled";
      
      if (completedCheckpoints.length > 0) {
        const lastCompleted = completedCheckpoints[completedCheckpoints.length - 1];
        if (lastCompleted.name === "Ready for Dispatch") restoredStatus = "ready_for_dispatch";
        else if (lastCompleted.name === "In Transit") restoredStatus = "in_transit";
        else if (lastCompleted.name === "Delivered to Destination") restoredStatus = "completed";
      }

      const { error } = await supabase
        .from("deliveries")
        .update({ status: restoredStatus, updated_at: new Date().toISOString() })
        .eq("id", deliveryId)

      if (error) throw error
      toast.success("Delivery tracking restored")
      fetchDeliveries()
    } catch (error: any) {
      toast.error("Failed to restore delivery", { description: error.message })
    } finally {
      setUpdating(false)
    }
  }

  const handleCancelDelivery = async (deliveryId: string) => {
    setUpdating(true)
    try {
      const isAlreadyCancelled = deliveryToCancel?.status === 'cancelled'
      let error = null
      
      if (isAlreadyCancelled) {
        // Soft delete the delivery so it doesn't appear in "Pending Initiation"
        // If we permanently delete it, the database forgets it existed, and it thinks the campaign needs a new delivery.
        const result = await supabase
          .from("deliveries")
          .update({ status: "deleted", updated_at: new Date().toISOString() })
          .eq("id", deliveryId)
          
        error = result.error
      } else {
        const result = await supabase
          .from("deliveries")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", deliveryId)
        error = result.error
      }

      if (error) throw error
      toast.success(isAlreadyCancelled ? "Delivery tracking deleted" : "Delivery tracking cancelled")
      setSelectedDeliveryId(null)
      fetchDeliveries()
    } catch (error: any) {
      toast.error(deliveryToCancel?.status === 'cancelled' ? "Failed to delete delivery" : "Failed to cancel delivery", { description: error.message })
    } finally {
      setUpdating(false)
    }
  }

  if (isAdmin === null) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }



  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_transit": return <Badge className="bg-blue-500 hover:bg-blue-600 border-none">In Transit</Badge>
      case "ready_for_dispatch": return <Badge className="bg-purple-500 hover:bg-purple-600 border-none">Ready for Dispatch</Badge>
      case "scheduled": return <Badge className="bg-amber-500 hover:bg-amber-600 border-none">Scheduled</Badge>
      case "completed": return <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none">Completed</Badge>
      case "cancelled": return <Badge className="bg-red-500 hover:bg-red-600 border-none">Cancelled</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const activeDeliveries = deliveries.filter(d => d.status !== 'cancelled' && d.status !== 'deleted')
  const cancelledDeliveries = deliveries.filter(d => d.status === 'cancelled')
  const currentDeliveries = activeTab === "active" ? activeDeliveries : cancelledDeliveries

  return (
    <SidebarLayout>
      <div className="flex min-h-svh flex-col bg-slate-50/30 dark:bg-background">
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Logistics & Distribution Tracking</h1>
            <div className="flex items-center justify-between mt-1">
              <p className="text-slate-500 dark:text-slate-400">Monitor and manage in-kind donation delivery status</p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 gap-2 text-slate-500"
                onClick={() => {
                  fetchDeliveries()
                  fetchPendingLogistics()
                }}
                disabled={loading}
              >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Refresh Data
              </Button>
            </div>
          </div>



          {/* Tabs */}
          <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 mb-6">
            <button
              onClick={() => setActiveTab("active")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === "active"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Active Tracking ({activeDeliveries.length})
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all relative ${
                activeTab === "pending"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Pending Initiation ({pendingCampaigns.length})
              {pendingCampaigns.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-primary text-primary-foreground rounded-full">
                  {pendingCampaigns.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("cancelled")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === "cancelled"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Cancelled History ({cancelledDeliveries.length})
            </button>
          </div>

          {activeTab === "active" || activeTab === "cancelled" ? (
            loading && deliveries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="size-10 animate-spin text-primary" />
                <p className="mt-4 text-slate-500 font-medium">Loading logistics data...</p>
              </div>
            ) : currentDeliveries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 shadow-sm">
                <Package className="size-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {activeTab === "active" ? "No active deliveries" : "No cancelled deliveries"}
                </h3>
                <p className="text-slate-500 text-sm max-w-xs text-center mx-auto mb-4">
                  {activeTab === "active" 
                    ? "Deliveries will appear here once campaigns are completed or manually initiated." 
                    : "Cancelled tracking records will appear here."}
                </p>
                {activeTab === "active" && (
                  <Button onClick={() => setActiveTab("pending")} size="sm" className="font-bold">
                    View Pending Initiation
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Delivery List */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <Input 
                        placeholder="Search campaigns..." 
                        className="pl-9 bg-card border-slate-200 dark:border-slate-800"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Button variant="outline" className="gap-2 bg-card border-slate-200 dark:border-slate-800">
                      <Filter className="size-4" />
                      Filter
                    </Button>
                  </div>

                  {currentDeliveries.filter(d => d.campaign?.title.toLowerCase().includes(searchQuery.toLowerCase())).map((delivery) => (
                    <Card 
                      key={delivery.id} 
                      className={`cursor-pointer border-2 transition-all hover:border-primary/50 ${selectedDeliveryId === delivery.id ? 'border-primary shadow-md' : 'border-transparent shadow-sm'}`}
                      onClick={() => setSelectedDeliveryId(delivery.id)}
                    >
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{delivery.campaign?.title}</h3>
                                {getStatusBadge(delivery.status)}
                              </div>
                              <p className="text-sm text-slate-500 dark:text-slate-400">{delivery.campaign?.category}</p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-slate-400"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="size-5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 bg-card border border-slate-200 dark:border-slate-800">
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  setDeliveryToEdit(delivery);
                                  setIsEditDialogOpen(true);
                                }}>
                                  Review Details
                                </DropdownMenuItem>
                                {delivery.status === 'cancelled' && (
                                  <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    handleRestoreDelivery(delivery.id);
                                  }}>
                                    Restore Tracking
                                  </DropdownMenuItem>
                                )}
                                  <DropdownMenuItem 
                                    variant="destructive"
                                    className="text-destructive focus:bg-destructive/10 dark:focus:bg-destructive/20 focus:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeliveryToCancel(delivery);
                                      setIsCancelDialogOpen(true);
                                    }}
                                  >
                                    {delivery.status === 'cancelled' ? 'Delete Tracking' : 'Cancel Tracking'}
                                  </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                              <MapPin className="size-4 text-primary" />
                              <span className="font-medium">Destination:</span> {delivery.destination || "Not set"}
                            </div>
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                              <UserIcon className="size-4 text-primary" />
                              <span className="font-medium">Assigned To:</span> {delivery.assigned_personnel || "Unassigned"}
                            </div>
                          </div>

                          {activeTab !== "cancelled" && (
                            <div className="space-y-3">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                                <span>Logistic Status</span>
                              </div>
                              <div className="flex items-center w-full px-1">
                                {delivery.checkpoints.map((checkpoint, i) => (
                                  <React.Fragment key={i}>
                                    <div className="relative flex flex-col items-center group">
                                      <div className={`size-3.5 rounded-full border-2 transition-all ${
                                        checkpoint.status === 'completed' ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                                        checkpoint.status === 'in_progress' ? 'bg-background border-primary shadow-[0_0_8px_rgba(59,130,246,0.3)]' :
                                        'bg-background border-slate-200 dark:border-slate-800'
                                      }`}>
                                        {checkpoint.status === 'in_progress' && (
                                          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                                        )}
                                      </div>
                                      <div className="absolute -bottom-5 scale-0 group-hover:scale-100 transition-transform origin-top bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20">
                                        {checkpoint.name}
                                      </div>
                                    </div>
                                    {i !== delivery.checkpoints.length - 1 && (
                                      <div className={`h-1 flex-1 mx-0.5 rounded-full ${
                                        delivery.checkpoints[i+1].status !== 'pending' ? 'bg-emerald-500' : 'bg-slate-100 dark:bg-slate-800'
                                      }`} />
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>
                              <div className="h-4" />
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-sm">
                            <div className="text-slate-500 dark:text-slate-400">
                              {activeTab === "cancelled" ? (
                                <>
                                  <span className="font-medium">Created Date:</span> <span className="text-slate-900 dark:text-white font-semibold">{new Date(delivery.created_at).toLocaleDateString()}</span>
                                </>
                              ) : (
                                <>
                                  <span className="font-medium">Est. Delivery:</span> <span className="text-slate-900 dark:text-white font-semibold">{delivery.estimated_delivery ? new Date(delivery.estimated_delivery).toLocaleDateString() : "TBD"}</span>
                                </>
                              )}
                            </div>
                            <div className="text-slate-400 italic">
                              Updated {new Date(delivery.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Side Panel: Delivery Details */}
                {activeTab === 'active' && (
                  <div className="space-y-6">
                    {selectedDelivery ? (
                    <Card className="border-none shadow-lg sticky top-8">
                      <CardContent className="p-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Delivery Details</h2>
                        
                        <div className="space-y-6">
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Event Campaign</p>
                            <p className="text-base font-bold text-primary">{selectedDelivery.campaign?.title}</p>
                          </div>

                          <div className="space-y-4">
                            <div className="flex flex-col gap-1">
                              <p className="text-xs font-bold text-slate-400 uppercase">Category</p>
                              <p className="text-sm font-semibold">{selectedDelivery.campaign?.category}</p>
                            </div>
                            <div className="flex flex-col gap-1">
                              <p className="text-xs font-bold text-slate-400 uppercase">Financial Progress</p>
                              <div className="flex items-center justify-between text-sm font-semibold mb-1">
                                <span>₱{selectedDelivery.campaign?.raised.toLocaleString()}</span>
                                <span className="text-slate-400 text-[10px]">Goal: ₱{selectedDelivery.campaign?.goal.toLocaleString()}</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary" 
                                  style={{ width: `${Math.min(100, (selectedDelivery.campaign?.raised / selectedDelivery.campaign?.goal) * 100)}%` }}
                                />
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <p className="text-xs font-bold text-slate-400 uppercase">Destination</p>
                              <p className="text-sm font-semibold">{selectedDelivery.destination || "Not assigned"}</p>
                            </div>
                            <div className="flex flex-col gap-1">
                              <p className="text-xs font-bold text-slate-400 uppercase">Assigned Personnel</p>
                              <p className="text-sm font-semibold">{selectedDelivery.assigned_personnel || "Unassigned"}</p>
                            </div>
                            <div className="flex flex-col gap-1">
                              <p className="text-xs font-bold text-slate-400 uppercase">Estimated Delivery</p>
                              <p className="text-sm font-semibold">{selectedDelivery.estimated_delivery ? new Date(selectedDelivery.estimated_delivery).toLocaleDateString() : "TBD"}</p>
                            </div>
                          </div>

                          {/* Inventory Items Section */}
                          <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center justify-between">
                              Items for Distribution
                              <Badge variant="outline" className="text-[10px]">{inventoryItems.length}</Badge>
                            </h3>
                            {loadingItems ? (
                              <div className="flex justify-center py-4">
                                <Loader2 className="size-5 animate-spin text-primary" />
                              </div>
                            ) : inventoryItems.length > 0 ? (
                              <div className="space-y-3">
                                {inventoryItems.map((item) => (
                                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-slate-900 dark:text-white">{item.item_name}</span>
                                      <span className="text-[10px] text-slate-500 uppercase">{item.category}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-sm font-bold text-primary">{item.quantity}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic">No specific inventory items linked to this campaign.</p>
                            )}
                          </div>

                          <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center justify-between">
                              Tracking Checkpoints
                              {updating && <Loader2 className="size-3 animate-spin text-primary" />}
                            </h3>
                            <div className="space-y-6">
                              {selectedDelivery.checkpoints.map((checkpoint, i) => (
                                <div 
                                  key={checkpoint.id} 
                                  className="relative flex gap-4 cursor-pointer group"
                                  onClick={() => handleCheckpointClick(checkpoint)}
                                >
                                  {i !== selectedDelivery.checkpoints.length - 1 && (
                                    <div className="absolute left-[11px] top-6 h-full w-[2px] bg-slate-100 dark:bg-slate-800" />
                                  )}
                                  <div className="relative z-10 flex size-6 items-center justify-center shrink-0">
                                    {checkpoint.status === 'completed' ? (
                                      <CheckCircle className="size-6 text-emerald-500 fill-emerald-50 dark:fill-emerald-950/20" />
                                    ) : checkpoint.status === 'in_progress' ? (
                                      <div className="size-5 rounded-full border-2 border-primary bg-background flex items-center justify-center">
                                        <div className="size-2 rounded-full bg-primary animate-pulse" />
                                      </div>
                                    ) : (
                                      <Circle className="size-5 text-slate-200 dark:text-slate-800 group-hover:text-primary transition-colors" />
                                    )}
                                  </div>
                                  <div className="flex-1 pb-2">
                                    <div className="flex items-center justify-between mb-1">
                                      <p className={`text-sm font-bold ${checkpoint.status === 'pending' ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                        {checkpoint.name}
                                      </p>
                                      <Badge variant="secondary" className={`text-[10px] font-bold px-1.5 py-0 ${
                                        checkpoint.status === 'completed' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30' : 
                                        checkpoint.status === 'in_progress' ? 'text-primary bg-primary/5 border-primary/10' : 
                                        'text-slate-400 bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                                      }`}>
                                        {checkpoint.status === 'completed' ? 'Completed' : checkpoint.status === 'in_progress' ? 'In Progress' : 'Pending'}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-slate-400 font-medium">
                                      {checkpoint.checkpoint_time ? new Date(checkpoint.checkpoint_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "-"}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="p-6 bg-card rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                      <p className="text-slate-500 text-sm">Select a delivery to view details</p>
                    </div>
                  )}

                  </div>
                )}
              </div>
            )
          ) : (
            <div className="space-y-6">
              {(pendingCampaigns.length > 0 || checkingPending) ? (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-full">
                          {checkingPending ? <Loader2 className="size-5 text-primary animate-spin" /> : <AlertCircle className="size-5 text-primary" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white">
                            {checkingPending ? "Scanning for pending logistics..." : "Pending Logistics Detection"}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {checkingPending ? "Checking Supabase for completed campaigns..." : `We found ${pendingCampaigns.length} completed campaigns that haven't been initiated for tracking.`}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setActiveTab("active")}>
                        Back to Active Tracking
                      </Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {pendingCampaigns.map(campaign => (
                        <div key={campaign.id} className="p-4 bg-card rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3">
                          <p className="font-bold text-sm truncate" title={campaign.title}>{campaign.title}</p>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              className="flex-1 font-bold h-8"
                              onClick={() => handleInitiateManual(campaign.id)}
                              disabled={updating}
                            >
                              {updating ? <Loader2 className="size-3.5 animate-spin" /> : <Truck className="size-3.5 mr-2" />}
                              Initiate Tracking
                            </Button>
                            <Button
                              size="sm"
                              className="font-bold h-8 bg-red-600 hover:bg-red-700 text-white border-transparent px-3"
                              onClick={() => handleCancelPending(campaign.id)}
                              disabled={updating}
                            >
                              Cancel Tracking
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <CheckCircle2 className="size-12 text-emerald-500 mb-4" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">All caught up!</h3>
                  <p className="text-slate-500 text-sm max-w-xs text-center mx-auto mb-4">
                    There are no completed campaigns that need manual tracking initiation.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("active")}>
                    Back to Active Tracking
                  </Button>
                </div>
              )}
            </div>
          )}
        {/* Review Delivery Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md bg-card border-slate-200 dark:border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                Review Delivery Tracking
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                View the destination, assigned personnel, estimated delivery date, and current status for this delivery.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4 px-2">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Campaign</p>
                <p className="font-semibold">{deliveryToEdit?.campaign?.title}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Destination</p>
                <p className="font-semibold">{editDestination || "Not assigned"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Assigned Personnel</p>
                <p className="font-semibold">{editAssignedPersonnel || "Unassigned"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estimated Delivery</p>
                  <p className="font-semibold">{editEstimatedDelivery ? new Date(editEstimatedDelivery).toLocaleDateString() : "Not set"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</p>
                  <p className="font-semibold capitalize">{editStatus.replace(/_/g, ' ')}</p>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel/Delete Delivery Alert Dialog */}
        <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
          <AlertDialogContent className="bg-card border-slate-200 dark:border-slate-800">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                {deliveryToCancel?.status === 'cancelled' ? 'Delete Delivery Tracking?' : 'Cancel Delivery Tracking?'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500">
                Are you sure you want to {deliveryToCancel?.status === 'cancelled' ? 'permanently delete' : 'cancel'} tracking for "<strong>{deliveryToCancel?.campaign?.title}</strong>"? 
                {deliveryToCancel?.status === 'cancelled' 
                  ? ' This will permanently delete the tracking record and all associated checkpoints. This action cannot be undone.'
                  : ' This will mark the tracking record as cancelled. You can view cancelled records in the Cancelled History tab.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel disabled={updating}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={async (e) => {
                  e.preventDefault();
                  if (deliveryToCancel) {
                    await handleCancelDelivery(deliveryToCancel.id);
                    setIsCancelDialogOpen(false);
                  }
                }}
                disabled={updating}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
              >
                {updating && <Loader2 className="size-4 mr-2 animate-spin" />}
                {deliveryToCancel?.status === 'cancelled' ? 'Yes, Delete Tracking' : 'Yes, Cancel Tracking'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Confirm Checkpoint Toggle Dialog */}
        <AlertDialog open={!!checkpointToConfirm} onOpenChange={(open) => !open && setCheckpointToConfirm(null)}>
          <AlertDialogContent className="bg-card border-slate-200 dark:border-slate-800">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                {checkpointToConfirm?.currentStatus === 'completed' ? 'Revert Checkpoint?' : 'Complete Checkpoint?'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500">
                Are you sure you want to mark "<strong>{checkpointToConfirm?.name}</strong>" as {checkpointToConfirm?.currentStatus === 'completed' ? 'pending' : 'completed'}?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel disabled={updating}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={async (e) => {
                  e.preventDefault();
                  await handleConfirmToggleCheckpoint();
                }}
                disabled={updating}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
              >
                {updating && <Loader2 className="size-4 mr-2 animate-spin" />}
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </main>
      </div>
    </SidebarLayout>
  )
}
