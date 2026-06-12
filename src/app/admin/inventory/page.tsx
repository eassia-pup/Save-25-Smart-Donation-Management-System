import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/hooks/use-auth"
import { SidebarLayout } from "@/components/module/sidebar-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { 
  Package, 
  Search, 
  Filter, 
  Download, 
  Loader2, 
  CheckCircle2, 
  ChevronRight,
  Eye,
  Trash2,
} from "lucide-react"
import { initiateLogistics } from "@/lib/logistics"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Inventory } from "@/lib/database.types"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

const CATEGORY_LABELS: Record<string, string> = {
  food: "Relief Goods",
  clothing: "New Clothes",
  medical: "Medicine",
  others: "Essential Goods",
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<Inventory[]>([])
  const [campaigns, setCampaigns] = useState<Record<string, string>>({})
  const [deliveriesMap, setDeliveriesMap] = useState<Record<string, string>>({})
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [selectedItem, setSelectedItem] = useState<Inventory | null>(null)
  const [isReviewOpen, setIsReviewOpen] = useState(false)
  const [isDistributing, setIsDistributing] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<Inventory | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "food": return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/50"
      case "medical": return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50"
      case "clothing": return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/50"
      default: return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
    }
  }

  useEffect(() => {
    async function checkAdmin() {
      if (!user) return
      
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
      
      if (error || !["admin", "trustee"].includes(data?.role)) {
        navigate("/dashboard")
        return
      }
      
      setIsAdmin(true)
      fetchData()
    }

    async function fetchData() {
      try {
        setLoading(true)
        
        // Fetch inventory
        const { data: invData, error: invError } = await supabase
          .from("inventory")
          .select("*")
          .order("created_at", { ascending: false })
        
        if (invError) throw invError
        setInventory(invData || [])

        // Fetch campaigns for mapping names
        const { data: campData, error: campError } = await supabase
          .from("campaigns")
          .select("id, title")
        
        if (campError) throw campError
        const campMap = (campData || []).reduce((acc, c) => {
          acc[c.id] = c.title
          return acc
        }, {} as Record<string, string>)
        setCampaigns(campMap)

        // Fetch deliveries for mapping status
        const { data: delData } = await supabase
          .from("deliveries")
          .select("campaign_id, status")
        
        if (delData) {
          const delMap = delData.reduce((acc, d) => {
            if (d.status !== 'deleted') acc[d.campaign_id] = d.status
            return acc
          }, {} as Record<string, string>)
          setDeliveriesMap(delMap)
        }

      } catch (error) {
        console.error("Error fetching inventory data:", error)
      } finally {
        setLoading(false)
      }
    }

    checkAdmin()
  }, [user, navigate])

  const handleDeleteClick = (item: Inventory) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("inventory")
        .delete()
        .eq("id", itemToDelete.id);

      if (error) throw error;

      toast.success("Item deleted successfully");
      setInventory((prev) => prev.filter((item) => item.id !== itemToDelete.id));
      
      // If the deleted item is currently selected in the review modal, close it
      if (selectedItem?.id === itemToDelete.id) {
        setIsReviewOpen(false);
      }
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (error: any) {
      toast.error("Failed to delete item", { description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReadyForDistribution = async () => {
    if (!selectedItem) return
    
    setIsDistributing(true)
    try {
      const { error } = await supabase
        .from("inventory")
        .update({ status: "distributed" })
        .eq("id", selectedItem.id)

      if (error) throw error

      toast.success("Item marked as distributed")
      
      // If campaign_id exists, try to initiate logistics
      if (selectedItem.campaign_id) {
        const { success } = await initiateLogistics(selectedItem.campaign_id)
        if (success) {
          toast.info("Logistics Initialized", {
            description: "The delivery tracking for this campaign has been started."
          })
        }
      }

      // Update local state
      setInventory(prev => prev.map(item => 
        item.id === selectedItem.id ? { ...item, status: "distributed" } : item
      ))
      setIsReviewOpen(false)
    } catch (error: any) {
      toast.error("Failed to update status", { description: error.message })
    } finally {
      setIsDistributing(false)
    }
  }

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.item_name.toLowerCase().includes(search.toLowerCase()) || 
                         (item.donor_name?.toLowerCase().includes(search.toLowerCase()) || false)
    const matchesStatus = statusFilter === "all" || item.status === statusFilter
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter
    
    return matchesSearch && matchesStatus && matchesCategory
  })

  const stats = {
    total: inventory.length,
    inStock: inventory.filter(i => i.status === "in_stock").length,
    distributed: inventory.filter(i => i.status === "distributed").length
  }

  if (isAdmin === null || loading) {
    return (
      <SidebarLayout>
        <div className="flex min-h-svh items-center justify-center bg-background">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    )
  }

  const handleExportCSV = () => {
    try {
      if (filteredInventory.length === 0) {
        toast.error("No data to export")
        return
      }

      const headers = ["Item Name", "Campaign", "Category", "Quantity", "Status", "Date Created"]
      const rows = filteredInventory.map(item => [
        item.item_name,
        campaigns[item.campaign_id || ""] || "General Donation",
        CATEGORY_LABELS[item.category] || item.category,
        item.quantity,
        item.status === "in_stock" ? "In Stock" : "Distributed",
        format(new Date(item.created_at), "yyyy-MM-dd HH:mm:ss")
      ])

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      ].join("\n")

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `inventory_export_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success("CSV Exported successfully", {
        description: `${filteredInventory.length} items exported.`
      })
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export CSV")
    }
  }

  const handleExportPDF = () => {
    try {
      if (filteredInventory.length === 0) {
        toast.error("No data to export")
        return
      }

      const doc = new jsPDF()
      
      // Add Title and Header
      doc.setFontSize(22)
      doc.setTextColor(40)
      doc.text("Save 25 Smart Donation System", 14, 22)
      
      doc.setFontSize(14)
      doc.setTextColor(100)
      doc.text("Inventory Resources Report", 14, 32)
      
      doc.setFontSize(10)
      doc.setTextColor(150)
      doc.text(`Generated on: ${format(new Date(), "PPP HH:mm")}`, 14, 40)

      const tableColumn = ["Item Name", "Campaign", "Category", "Quantity", "Status"]
      const tableRows = filteredInventory.map(item => [
        item.item_name,
        campaigns[item.campaign_id || ""] || "General Donation",
        CATEGORY_LABELS[item.category] || item.category,
        item.quantity,
        item.status === "in_stock" ? "In Stock" : "Distributed"
      ])

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 48,
        theme: 'grid',
        headStyles: { 
          fillColor: [37, 99, 235], // Primary blue
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        alternateRowStyles: { 
          fillColor: [249, 250, 251] 
        },
        styles: { 
          fontSize: 9,
          cellPadding: 5
        },
        margin: { top: 48 }
      })

      doc.save(`inventory_report_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`)
      
      toast.success("PDF Report generated successfully", {
        description: `Exported ${filteredInventory.length} items.`
      })
    } catch (error) {
      console.error("PDF Export error:", error)
      toast.error("Failed to export PDF")
    }
  }

  return (
    <SidebarLayout>
      <div className="flex min-h-svh flex-col bg-background">

        <main className="flex-1 space-y-6 p-6 lg:p-10 max-w-[1600px] mx-auto w-full">
          {/* Page Title */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Inventory Management</h2>
              <p className="text-muted-foreground">Monitor and manage all donated physical resources.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 gap-2"
                onClick={handleExportCSV}
              >
                <Download className="size-4" />
                Export CSV
              </Button>
              <Button 
                size="sm" 
                className="h-9 gap-2 font-semibold"
                onClick={handleExportPDF}
              >
                <Download className="size-4" />
                Export PDF
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-primary/5 dark:bg-primary/10 border-none shadow-none">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Package className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Resources</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-none shadow-none">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">In Stock</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stats.inStock}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-none shadow-none">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <ChevronRight className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Distributed</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.distributed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters & Table */}
          <Card className="border-none shadow-xl shadow-gray-200/50 dark:shadow-none bg-card">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Package className="size-5 text-primary" />
                  Inventory List
                </CardTitle>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search items or donors..."
                      className="pl-9 h-9"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-[150px]">
                      <Filter className="mr-2 size-3.5 text-muted-foreground" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="in_stock">In Stock</SelectItem>
                      <SelectItem value="distributed">Distributed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-9 w-[180px]">
                      <Filter className="mr-2 size-3.5 text-muted-foreground" />
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="food">Relief Goods</SelectItem>
                      <SelectItem value="clothing">New Clothes</SelectItem>
                      <SelectItem value="medical">Medicine</SelectItem>
                      <SelectItem value="others">Essential Goods</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30 h-14">
                      <TableHead className="font-bold px-4">Item Name</TableHead>
                      <TableHead className="font-bold px-4">Event Campaign</TableHead>
                      <TableHead className="font-bold px-4">Category</TableHead>
                      <TableHead className="font-bold px-4">Quantity</TableHead>
                      <TableHead className="font-bold px-4">Inventory Status</TableHead>
                      <TableHead className="font-bold px-4">Logistic Status</TableHead>
                      <TableHead className="font-bold px-4">Donor</TableHead>
                      <TableHead className="font-bold px-4">Date</TableHead>
                      <TableHead className="font-bold px-4 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-32 text-center text-muted-foreground font-medium">
                          No resources found matching your criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredInventory.map((item) => (
                        <TableRow key={item.id} className="group transition-colors hover:bg-muted/50">
                          <TableCell className="font-semibold px-4 max-w-[150px] truncate" title={item.item_name}>
                            {item.item_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground px-4 max-w-[150px] truncate" title={campaigns[item.campaign_id || ""] || "General Donation"}>
                            {campaigns[item.campaign_id || ""] || "General Donation"}
                          </TableCell>
                          <TableCell className="px-4">
                            <Badge variant="outline" className={cn("font-medium whitespace-nowrap", getCategoryColor(item.category))}>
                              {CATEGORY_LABELS[item.category] || item.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-primary px-4 whitespace-nowrap">{item.quantity}</TableCell>
                          <TableCell className="px-4">
                            <Badge 
                              variant={item.status === "in_stock" ? "secondary" : "outline"}
                              className={`rounded-full px-2.5 py-0.5 font-semibold text-[11px] uppercase tracking-wider whitespace-nowrap ${
                                item.status === "in_stock" 
                                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50" 
                                  : "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50"
                              } shadow-sm`}
                            >
                              {item.status === "in_stock" ? "In Stock" : "Distributed"}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4">
                            {(() => {
                              const deliveryStatus = item.campaign_id ? deliveriesMap[item.campaign_id] : null
                              
                              if (!deliveryStatus) return <Badge variant="outline" className="font-semibold text-muted-foreground whitespace-nowrap">Pending</Badge>
                              if (deliveryStatus === 'cancelled') return <Badge variant="outline" className="font-semibold text-destructive border-destructive/20 bg-destructive/10 whitespace-nowrap">Cancelled</Badge>
                              if (deliveryStatus === 'completed') return <Badge className="font-semibold bg-emerald-500 hover:bg-emerald-600 border-none whitespace-nowrap">Completed</Badge>
                              if (deliveryStatus === 'in_transit') return <Badge className="font-semibold bg-blue-500 hover:bg-blue-600 border-none whitespace-nowrap">In Transit</Badge>
                              if (deliveryStatus === 'ready_for_dispatch') return <Badge className="font-semibold bg-purple-500 hover:bg-purple-600 border-none whitespace-nowrap">Ready</Badge>
                              if (deliveryStatus === 'scheduled') return <Badge className="font-semibold bg-amber-500 hover:bg-amber-600 border-none whitespace-nowrap">Scheduled</Badge>
                              
                              return <Badge variant="outline" className="font-semibold whitespace-nowrap">{deliveryStatus.charAt(0).toUpperCase() + deliveryStatus.slice(1).replace('_', ' ')}</Badge>
                            })()}
                          </TableCell>
                          <TableCell className="px-4">
                            <div className="flex flex-col max-w-[150px]">
                              <span className="font-medium truncate" title={item.donor_name || "Anonymous"}>
                                {item.donor_name || "Anonymous"}
                              </span>
                              <span className="text-[10px] text-muted-foreground uppercase tracking-tight truncate">Verified Donor</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-medium px-4 whitespace-nowrap">
                            {format(new Date(item.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 gap-1.5 font-semibold text-primary hover:text-primary hover:bg-primary/10 whitespace-nowrap"
                                onClick={() => {
                                  setSelectedItem(item)
                                  setIsReviewOpen(true)
                                }}
                              >
                                <Eye className="size-3.5" />
                                Review
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 gap-1.5 font-semibold text-destructive hover:text-destructive hover:bg-destructive/10 whitespace-nowrap"
                                onClick={() => handleDeleteClick(item)}
                              >
                                <Trash2 className="size-3.5" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </main>

        <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Review Inventory Item</DialogTitle>
              <DialogDescription>
                Detailed information for this specific donation entry.
              </DialogDescription>
            </DialogHeader>
            
            {selectedItem && (
              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Item Name</p>
                    <p className="font-semibold">{selectedItem.item_name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</p>
                    <Badge variant="outline" className={cn("font-medium", getCategoryColor(selectedItem.category))}>
                      {CATEGORY_LABELS[selectedItem.category] || selectedItem.category}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Campaign</p>
                  <p className="font-semibold">{campaigns[selectedItem.campaign_id || ""] || "General Donation"}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quantity</p>
                    <p className="font-bold text-primary">{selectedItem.quantity}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inventory Status</p>
                    <Badge 
                      variant={selectedItem.status === "in_stock" ? "secondary" : "outline"}
                      className={`rounded-full px-2 py-0 font-bold text-[10px] uppercase ${
                        selectedItem.status === "in_stock" 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50" 
                          : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50"
                      }`}
                    >
                      {selectedItem.status === "in_stock" ? "In Stock" : "Distributed"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Logistic Status</p>
                  {(() => {
                    const deliveryStatus = selectedItem.campaign_id ? deliveriesMap[selectedItem.campaign_id] : null
                    if (!deliveryStatus) return <Badge variant="outline" className="font-semibold text-muted-foreground">Pending</Badge>
                    if (deliveryStatus === 'cancelled') return <Badge variant="outline" className="font-semibold text-destructive border-destructive/20 bg-destructive/10">Cancelled</Badge>
                    if (deliveryStatus === 'completed') return <Badge className="font-semibold bg-emerald-500 hover:bg-emerald-600 border-none">Completed</Badge>
                    if (deliveryStatus === 'in_transit') return <Badge className="font-semibold bg-blue-500 hover:bg-blue-600 border-none">In Transit</Badge>
                    if (deliveryStatus === 'ready_for_dispatch') return <Badge className="font-semibold bg-purple-500 hover:bg-purple-600 border-none">Ready</Badge>
                    if (deliveryStatus === 'scheduled') return <Badge className="font-semibold bg-amber-500 hover:bg-amber-600 border-none">Scheduled</Badge>
                    return <Badge variant="outline" className="font-semibold">{deliveryStatus.charAt(0).toUpperCase() + deliveryStatus.slice(1).replace('_', ' ')}</Badge>
                  })()}
                </div>

                <div className="p-4 rounded-lg bg-muted/30 border border-muted/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Donor Information</p>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">{selectedItem.donor_name || "Anonymous"}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-tight font-medium">Verified System Donor</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Entry Date</p>
                  <p className="text-sm font-medium">{format(new Date(selectedItem.created_at), "PPPP 'at' p")}</p>
                </div>
              </div>
            )}

            <DialogFooter className="gap-1">
              <Button variant="outline" onClick={() => setIsReviewOpen(false)} disabled={isDistributing}>
                Close
              </Button>
              {selectedItem?.status === "in_stock" && (
                <Button 
                  onClick={handleReadyForDistribution} 
                  disabled={isDistributing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {isDistributing && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Ready for Distribution
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="sm:max-w-[425px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold">Delete Inventory Item?</AlertDialogTitle>
              <AlertDialogDescription className="text-base text-slate-500 mt-2">
                Are you sure you want to permanently delete the item <span className="font-semibold text-slate-700 dark:text-slate-300">"{itemToDelete?.item_name}"</span>? This will permanently delete the record and all associated data. This action cannot be undone.
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
                Yes, Delete Item
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SidebarLayout>
  )
}
