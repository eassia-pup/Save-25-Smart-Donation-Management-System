import * as React from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  Search,
  LayoutGrid,
  AlertCircle,
  Upload,
  Camera,
  Activity,
  Clock,
  CheckCircle2,
  Eye
} from "lucide-react"
import { toast } from "sonner"
import type { Campaign, CampaignStatus, CampaignInsert } from "@/lib/database.types"

import { SidebarLayout } from "@/components/module/sidebar-layout"


export default function AdminCampaignsPage() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null)
  const navigate = useNavigate()
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [editingCampaign, setEditingCampaign] = React.useState<Campaign | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [campaignToDelete, setCampaignToDelete] = React.useState<Campaign | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false)
  const [updatingStatusCampaign, setUpdatingStatusCampaign] = React.useState<Campaign | null>(null)
  const [selectedStatus, setSelectedStatus] = React.useState<CampaignStatus | null>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false)

  // Form states
  const [title, setTitle] = React.useState("")
  const [category, setCategory] = React.useState("")
  const [shortDesc, setShortDesc] = React.useState("")
  const [fullDesc, setFullDesc] = React.useState("")
  const [goal, setGoal] = React.useState("")
  const [imageUrl, setImageUrl] = React.useState("")
  const [startDate, setStartDate] = React.useState("")
  const [endDate, setEndDate] = React.useState("")
  const [status, setStatus] = React.useState<CampaignStatus>("active")
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({})
  const [uploading, setUploading] = React.useState(false)
  const [fileMetadata, setFileMetadata] = React.useState<{ name: string; size: number } | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const fetchCampaigns = React.useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("campaigns")
      .select("*, deliveries(status)")
      .order("created_at", { ascending: false })

    if (error) {
      toast.error("Failed to fetch campaigns")
    } else {
      setCampaigns((data as any) || [])
    }
    setLoading(false)
  }, [])

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
      fetchCampaigns()
    }
    
    checkAdmin()
  }, [user, navigate, fetchCampaigns])

  function resetForm() {
    setEditingCampaign(null)
    setTitle("")
    setCategory("")
    setShortDesc("")
    setFullDesc("")
    setGoal("")
    setImageUrl("")
    setFileMetadata(null)
    setStartDate("")
    setEndDate("")
    setStatus("active")
    setFormErrors({})
  }

  function handleEdit(campaign: Campaign) {
    setEditingCampaign(campaign)
    setTitle(campaign.title)
    setCategory(campaign.category)
    setShortDesc(campaign.short_description)
    setFullDesc(campaign.full_description)
    setGoal(campaign.goal.toString())
    setImageUrl(campaign.image_url || "")
    setStartDate(campaign.start_date.split('T')[0])
    setEndDate(campaign.end_date.split('T')[0])
    setStatus(campaign.status)
    setIsDialogOpen(true)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return

    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file", { description: "Please select an image file." })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", { description: "Image must be under 5MB." })
      return
    }

    setUploading(true)
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
      const filePath = `campaigns/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("campaign-images")
        .upload(filePath, file)

      if (uploadError) {
        console.error("Supabase upload error:", uploadError)
        if (uploadError.message?.toLowerCase().includes("not found") || uploadError.message?.toLowerCase().includes("bucket")) {
          toast.error("Storage not configured", {
            description: "Please create a 'campaign-images' bucket in Supabase Storage.",
          })
        } else {
          toast.error("Upload failed", { 
            description: `${uploadError.message} (Status: ${uploadError.status || "unknown"})` 
          })
        }
        return
      }

      const { data: urlData } = supabase.storage
        .from("campaign-images")
        .getPublicUrl(filePath)

      setImageUrl(urlData.publicUrl)
      setFileMetadata({ name: file.name, size: file.size })
      toast.success("Image uploaded successfully")
    } catch (error: any) {
      console.error("Image upload catch block:", error)
      toast.error("Upload failed", { description: error.message })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function handleRemoveImage() {
    setImageUrl("")
    setFileMetadata(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    const startObj = new Date(startDate)
    const endObj = new Date(endDate)
    const todayObj = new Date()
    todayObj.setHours(0, 0, 0, 0)
    
    const startObjDate = new Date(startObj)
    startObjDate.setHours(0, 0, 0, 0)
    
    const errors: Record<string, string> = {}

    if (!editingCampaign && startObjDate < todayObj) {
      errors.startDate = "Start Date cannot be in the past."
    }

    const endObjDate = new Date(endObj)
    endObjDate.setHours(0, 0, 0, 0)
    
    if (endObjDate < startObjDate) {
      errors.endDate = "End Date cannot be earlier than Start Date."
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors({})
    setIsSubmitting(true)

    const campaignData: CampaignInsert = {
      title,
      category,
      short_description: shortDesc,
      full_description: fullDesc,
      goal: parseFloat(goal),
      image_url: imageUrl || null,
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      status,
      created_by: user.id,
    }

    try {
      let campaignId = editingCampaign?.id

      if (editingCampaign) {
        const { error } = await supabase
          .from("campaigns")
          .update(campaignData)
          .eq("id", editingCampaign.id)
        if (error) throw error
        toast.success("Campaign updated successfully")
      } else {
        const { data, error } = await supabase
          .from("campaigns")
          .insert(campaignData)
          .select("id")
          .single()
        if (error) throw error
        campaignId = data.id
        toast.success("Campaign created successfully")
      }
      setIsDialogOpen(false)
      resetForm()
      fetchCampaigns()

      // If the campaign is no longer completed, soft delete any existing deliveries
      if (status !== "completed" && campaignId) {
        await supabase
          .from("deliveries")
          .update({ status: "deleted", updated_at: new Date().toISOString() })
          .eq("campaign_id", campaignId)
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteClick = (campaign: Campaign) => {
    setCampaignToDelete(campaign);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!campaignToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", campaignToDelete.id)
      if (error) throw error
      toast.success("Campaign deleted")
      fetchCampaigns()
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete campaign")
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleQuickStatusUpdate(campaign: Campaign, newStatus: CampaignStatus) {
    setIsUpdatingStatus(true)
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({ status: newStatus })
        .eq("id", campaign.id)
      
      if (error) throw error
      
      toast.success(`Status updated to ${newStatus}`)
      
      if (newStatus !== "completed") {
        // Soft delete any existing deliveries if campaign is no longer completed
        await supabase
          .from("deliveries")
          .update({ status: "deleted", updated_at: new Date().toISOString() })
          .eq("campaign_id", campaign.id)
      }
      
      fetchCampaigns()
      setStatusDialogOpen(false)
    } catch (error: any) {
      toast.error(error.message || "Failed to update status")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const filteredCampaigns = campaigns.filter(c => 
    (c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.category.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (statusFilter === "all" || c.status === statusFilter)
  )

  const getStatusColor = (status: CampaignStatus) => {
    switch (status) {
      case "active": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      case "paused": return "bg-amber-500/10 text-amber-600 border-amber-500/20"
      case "postponed": return "bg-orange-500/10 text-orange-600 border-orange-500/20"
      case "completed": return "bg-blue-500/10 text-blue-600 border-blue-500/20"
      case "cancelled": return "bg-destructive/10 text-destructive border-destructive/20"
      default: return "bg-muted text-muted-foreground"
    }
  }

  if (isAdmin === null) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <SidebarLayout>
      <div className="flex min-h-svh flex-col bg-background">

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Campaign Management</h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              Create, update, and manage your fundraising campaigns.
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 font-bold shadow-lg shadow-primary/20">
                <Plus className="size-4" />
                Create Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] w-full max-w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden">
              <DialogHeader className="px-6 pt-6 pb-2">
                <DialogTitle>
                  {editingCampaign 
                    ? (editingCampaign.status === 'completed' ? "Review Campaign" : "Edit Campaign") 
                    : "Create New Campaign"}
                </DialogTitle>
                <DialogDescription>
                  {editingCampaign?.status === 'completed' 
                    ? "This campaign is completed and cannot be modified."
                    : (editingCampaign ? "Fill in the details below to update the campaign." : "Fill in the details below to launch a new campaign.")}
                </DialogDescription>
              </DialogHeader>
              {editingCampaign?.status === 'completed' ? (
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Title</p>
                        <p className="font-semibold">{editingCampaign.title}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</p>
                        <p className="font-semibold">{editingCampaign.category}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Short Description</p>
                      <p className="font-semibold">{editingCampaign.short_description}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Full Description</p>
                      <p className="font-semibold text-sm whitespace-pre-wrap">{editingCampaign.full_description}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Goal Amount (₱)</p>
                        <p className="font-semibold text-primary tabular-nums">₱{editingCampaign.goal.toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Duration</p>
                        <p className="font-semibold">{new Date(editingCampaign.start_date).toLocaleDateString()} - {new Date(editingCampaign.end_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Campaign Image</p>
                      {editingCampaign.image_url ? (
                        <div className="relative h-40 w-40 flex-shrink-0">
                          <img src={editingCampaign.image_url} alt="Campaign Image" className="h-full w-full rounded-lg object-cover shadow-sm border" />
                        </div>
                      ) : (
                        <div className="flex min-h-[120px] items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/20">
                          <p className="text-sm font-semibold text-muted-foreground">No image uploaded</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter className="px-6 pt-4 pb-8 border-t bg-muted/10 flex flex-row items-center justify-center gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Close</Button>
                  </DialogFooter>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Title</label>
                      <Input 
                        placeholder="e.g. Flood Relief Fund 2026" 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Category</label>
                      <Select value={category} onValueChange={setCategory} required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Disaster Relief">Disaster Relief</SelectItem>
                          <SelectItem value="Education">Education</SelectItem>
                          <SelectItem value="Healthcare">Healthcare</SelectItem>
                          <SelectItem value="Environment">Environment</SelectItem>
                          <SelectItem value="Community">Community</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Short Description</label>
                    <Input 
                      placeholder="A brief summary for the card..." 
                      value={shortDesc}
                      onChange={(e) => setShortDesc(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Description</label>
                    <Textarea 
                      placeholder="Detailed information about the campaign's goals and impact..." 
                      className="min-h-[100px]"
                      value={fullDesc}
                      onChange={(e) => setFullDesc(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Goal Amount (₱)</label>
                      <Input 
                        placeholder="100000" 
                        value={goal}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val === "" || /^\d*$/.test(val)) {
                            setGoal(val)
                          }
                        }}
                        inputMode="numeric"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={`text-sm font-medium ${formErrors.startDate ? "text-red-500" : ""}`}>Start Date</label>
                      <Input 
                        type="date"
                        value={startDate}
                        min={!editingCampaign ? new Date().toISOString().split('T')[0] : undefined}
                        onChange={(e) => {
                          setStartDate(e.target.value)
                          if (formErrors.startDate) setFormErrors(prev => ({...prev, startDate: ""}))
                        }}
                        className={formErrors.startDate ? "border-red-500 focus-visible:ring-red-500" : ""}
                        required
                      />
                      {formErrors.startDate && <p className="text-xs text-red-500">{formErrors.startDate}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className={`text-sm font-medium ${formErrors.endDate ? "text-red-500" : ""}`}>End Date</label>
                      <Input 
                        type="date"
                        value={endDate}
                        min={startDate || new Date().toISOString().split('T')[0]}
                        onChange={(e) => {
                          setEndDate(e.target.value)
                          if (formErrors.endDate) setFormErrors(prev => ({...prev, endDate: ""}))
                        }}
                        className={formErrors.endDate ? "border-red-500 focus-visible:ring-red-500" : ""}
                        required
                      />
                      {formErrors.endDate && <p className="text-xs text-red-500">{formErrors.endDate}</p>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Campaign Image</label>
                    <div 
                      className={`relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                        imageUrl ? "border-primary/50 bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50"
                      }`}
                      onClick={() => !uploading && fileInputRef.current?.click()}
                    >
                      {uploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="size-8 animate-spin text-primary" />
                          <p className="text-xs text-muted-foreground">Uploading image...</p>
                        </div>
                      ) : imageUrl ? (
                        <div className="flex w-full items-center gap-4 p-3">
                          <div className="relative h-20 w-20 flex-shrink-0">
                            <img 
                              src={imageUrl} 
                              alt="Campaign Preview" 
                              className="h-full w-full rounded-lg object-cover shadow-sm border"
                            />
                            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                              <Camera className="size-5 text-white" />
                            </div>
                          </div>
                          <div className="flex flex-1 flex-col min-w-0">
                            <p className="text-sm font-semibold truncate text-foreground">
                              {fileMetadata?.name || "campaign-image.jpg"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {fileMetadata ? formatBytes(fileMetadata.size) : "---"}
                            </p>
                            <div className="mt-2 flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  fileInputRef.current?.click()
                                }}
                              >
                                Change
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveImage()
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-4">
                          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Upload className="size-5" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold">Click to upload image</p>
                            <p className="text-xs text-muted-foreground">JPG, PNG or WEBP (Max 5MB)</p>
                          </div>
                        </div>
                      )}
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleImageUpload}
                        disabled={uploading}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="px-6 pt-4 pb-8 border-t bg-muted/10 flex flex-row items-center justify-center gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                      {editingCampaign ? "Update Campaign" : "Launch Campaign"}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs and Search */}
        <div className="mb-6 flex flex-col gap-6">
          <div className="flex w-full overflow-x-auto border-b border-border no-scrollbar gap-6 xl:gap-8">
            {["all", "active", "postponed", "completed", "cancelled"].map((status) => {
              const count = campaigns.filter(c => status === "all" ? true : c.status === status).length
              const label = status === "all" ? "All" : status === "completed" ? "Complete" : status.charAt(0).toUpperCase() + status.slice(1);
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  className={`whitespace-nowrap pb-3 text-sm font-semibold border-b-2 transition-all -mb-[1px] ${
                    isActive 
                      ? "border-primary text-primary" 
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  onClick={() => setStatusFilter(status)}
                >
                  {label} ({count})
                </button>
              )
            })}
          </div>

          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search by title or category..." 
              className="pl-9 h-10 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Campaigns Table */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Loading campaigns...</p>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle className="size-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No campaigns found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your filters or create a new campaign.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[300px]">Campaign</TableHead>
                  <TableHead>Campaign Status</TableHead>
                  <TableHead>Logistic Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Goal</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.map((campaign) => {
                  const progress = Math.min(Math.round((campaign.raised / campaign.goal) * 100), 100)
                  const daysLeft = Math.max(0, Math.ceil((new Date(campaign.end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)))
                  return (
                    <TableRow key={campaign.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="size-12 rounded-lg bg-muted overflow-hidden flex-shrink-0 border">
                            {campaign.image_url ? (
                              <img src={campaign.image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-primary/5">
                                <LayoutGrid className="size-5 text-primary/40" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-sm leading-tight">{campaign.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">{campaign.category}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-semibold ${getStatusColor(campaign.status)}`}>
                          {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const deliveries = (campaign as any).deliveries || []
                          const activeDeliveries = deliveries.filter((d: any) => d.status !== 'deleted')
                          const deliveryStatus = activeDeliveries.length > 0 ? activeDeliveries[0].status : null
                          
                          if (!deliveryStatus) return <Badge variant="outline" className="font-semibold text-muted-foreground">Pending</Badge>
                          if (deliveryStatus === 'cancelled') return <Badge variant="outline" className="font-semibold text-destructive border-destructive/20 bg-destructive/10">Cancelled</Badge>
                          if (deliveryStatus === 'completed') return <Badge className="font-semibold bg-emerald-500 hover:bg-emerald-600 border-none">Completed</Badge>
                          if (deliveryStatus === 'in_transit') return <Badge className="font-semibold bg-blue-500 hover:bg-blue-600 border-none">In Transit</Badge>
                          if (deliveryStatus === 'ready_for_dispatch') return <Badge className="font-semibold bg-purple-500 hover:bg-purple-600 border-none">Ready for Dispatch</Badge>
                          if (deliveryStatus === 'scheduled') return <Badge className="font-semibold bg-amber-500 hover:bg-amber-600 border-none">Scheduled</Badge>
                          
                          return <Badge variant="outline" className="font-semibold">{deliveryStatus.charAt(0).toUpperCase() + deliveryStatus.slice(1).replace('_', ' ')}</Badge>
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="w-full max-w-[120px] space-y-1.5">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span>{progress}%</span>
                            <span className="text-muted-foreground">{daysLeft}d left</span>
                          </div>
                          <Progress value={progress} className="h-1.5" />
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold tabular-nums">
                        ₱{campaign.goal.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {campaign.status !== 'completed' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="size-8 text-amber-500 hover:bg-amber-50"
                              onClick={() => {
                                setUpdatingStatusCampaign(campaign)
                                setSelectedStatus(campaign.status)
                                setStatusDialogOpen(true)
                              }}
                              title="Update Status"
                            >
                              <Activity className="size-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-8 text-primary hover:bg-primary/10"
                            onClick={() => handleEdit(campaign)}
                            title={campaign.status === 'completed' ? "Review Campaign" : "Edit Campaign"}
                          >
                            {campaign.status === 'completed' ? <Eye className="size-4" /> : <Pencil className="size-4" />}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteClick(campaign)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Quick Status Update Dialog */}
        <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Update Campaign Status</DialogTitle>
              <DialogDescription>
                Quickly change the current progress stage for "{updatingStatusCampaign?.title}"
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              {[
                { id: 'active', label: 'Active', icon: <Activity className="size-4 text-emerald-500" />, desc: 'Campaign is currently accepting donations' },
                { id: 'postponed', label: 'Postponed', icon: <Clock className="size-4 text-orange-500" />, desc: 'Campaign is on hold for a future date' },
                { id: 'cancelled', label: 'Cancelled', icon: <AlertCircle className="size-4 text-destructive" />, desc: 'Campaign has been terminated' },
                { id: 'completed', label: 'Completed', icon: <CheckCircle2 className="size-4 text-blue-500" />, desc: 'Campaign finished, initiating logistics' }
              ].map((item) => (
                <button
                  key={item.id}
                  disabled={isUpdatingStatus}
                  onClick={() => setSelectedStatus(item.id as CampaignStatus)}
                  className={`flex items-start gap-4 p-3 rounded-xl border-2 transition-all text-left hover:border-primary/50 hover:bg-primary/5 ${
                    selectedStatus === item.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-100 dark:border-slate-800'
                  }`}
                >
                  <div className="mt-0.5">{item.icon}</div>
                  <div>
                    <p className="text-sm font-bold">{item.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <DialogFooter className="gap-1">
              <Button variant="outline" onClick={() => setStatusDialogOpen(false)} disabled={isUpdatingStatus}>Cancel</Button>
              <Button 
                onClick={() => selectedStatus && handleQuickStatusUpdate(updatingStatusCampaign!, selectedStatus)}
                disabled={isUpdatingStatus || !selectedStatus || selectedStatus === updatingStatusCampaign?.status}
              >
                {isUpdatingStatus && <Loader2 className="mr-2 size-4 animate-spin" />}
                Confirm Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="sm:max-w-[425px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold">Delete Campaign?</AlertDialogTitle>
              <AlertDialogDescription className="text-base text-slate-500 mt-2">
                Are you sure you want to permanently delete the campaign <span className="font-semibold text-slate-700 dark:text-slate-300">"{campaignToDelete?.title}"</span>? This will permanently delete the record and all associated data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-4 gap-2 sm:gap-0">
              <AlertDialogCancel disabled={isDeleting} className="border-slate-200">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  confirmDelete()
                }}
                className="bg-blue-600 text-white hover:bg-blue-700 font-medium"
                disabled={isDeleting}
              >
                {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
                Yes, Delete Campaign
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </main>
      </div>
    </SidebarLayout>
  )
}
