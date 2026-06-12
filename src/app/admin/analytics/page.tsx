import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { SidebarLayout } from "@/components/module/sidebar-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, TrendingUp, Package, Truck, Target, Download } from "lucide-react"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from "recharts"
import { format, subDays, startOfDay } from "date-fns"
import { generateAnalyticsSummary, generateDemandPredictions } from "@/lib/ai-service"
import { Sparkles, AlertTriangle, Info } from "lucide-react"

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  
  // Data states
  const [donationTrends, setDonationTrends] = useState<any[]>([])
  const [campaignStats, setCampaignStats] = useState<any[]>([])
  const [inventoryStats, setInventoryStats] = useState<any[]>([])
  const [logisticsStats, setLogisticsStats] = useState<any[]>([])
  
  // Overview metrics
  const [totalDonations, setTotalDonations] = useState(0)
  const [totalCampaigns, setTotalCampaigns] = useState(0)
  const [totalInventory, setTotalInventory] = useState(0)
  const [activeDeliveries, setActiveDeliveries] = useState(0)

  // AI states
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiPredictions, setAiPredictions] = useState<string[]>([])
  const [insightLoading, setInsightLoading] = useState(false)
  const [predictionLoading, setPredictionLoading] = useState(false)

  // Colors
  const COLORS = {
    primary: "#3b82f6",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    purple: "#8b5cf6",
    cyan: "#06b6d4"
  }

  const PIE_COLORS = [COLORS.primary, COLORS.success, COLORS.warning, COLORS.purple, COLORS.danger]

  useEffect(() => {
    fetchAnalyticsData()
  }, [])

  const fetchAnalyticsData = async () => {
    setLoading(true)
    let totalDonationsSum = 0
    let totalActiveDeliveries = 0
    try {
      // 1. Fetch Donations for Trends (Last 30 days)
      const thirtyDaysAgo = startOfDay(subDays(new Date(), 30)).toISOString()
      const { data: donations } = await supabase
        .from("donations")
        .select("amount, created_at")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: true })

      if (donations) {
        // Group by date
        const trendsMap = new Map()
        donations.forEach(d => {
          totalDonationsSum += d.amount
          const dateStr = format(new Date(d.created_at), "MMM dd")
          const current = trendsMap.get(dateStr) || 0
          trendsMap.set(dateStr, current + d.amount)
        })
        setTotalDonations(totalDonationsSum)

        const formattedTrends = Array.from(trendsMap.entries()).map(([date, amount]) => ({
          date,
          amount
        }))
        setDonationTrends(formattedTrends)
      }

      // 2. Fetch Campaigns Status
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("status")
      
      if (campaigns) {
        setTotalCampaigns(campaigns.length)
        const statusCounts = campaigns.reduce((acc, curr) => {
          acc[curr.status] = (acc[curr.status] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        
        const formattedCampaignStats = Object.entries(statusCounts).map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value
        }))
        setCampaignStats(formattedCampaignStats)
      }

      // 3. Fetch Inventory Categories and Quantities
      const { data: inventory } = await supabase
        .from("inventory")
        .select("category, quantity")
      
      if (inventory) {
        setTotalInventory(inventory.length)
        
        const CATEGORY_LABELS: Record<string, string> = {
          food: "Relief Goods",
          clothing: "New Clothes",
          medical: "Medicine",
          others: "Essential Goods",
        }

        const categoryCounts = inventory.reduce((acc, curr) => {
          const qty = parseInt(curr.quantity) || 0
          const label = CATEGORY_LABELS[curr.category] || curr.category || 'Unknown'
          acc[label] = (acc[label] || 0) + qty
          return acc
        }, {} as Record<string, number>)
        
        const formattedInvStats = Object.entries(categoryCounts).map(([name, value]) => ({
          name,
          value
        }))
        setInventoryStats(formattedInvStats)
      }

      // 4. Fetch Deliveries
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("status")
      
      if (deliveries) {
        totalActiveDeliveries = deliveries.filter(d => ['scheduled', 'ready_for_dispatch', 'in_transit'].includes(d.status)).length
        setActiveDeliveries(totalActiveDeliveries)

        const deliveryCounts = deliveries.reduce((acc, curr) => {
          acc[curr.status] = (acc[curr.status] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        
        const formattedDeliveryStats = Object.entries(deliveryCounts).map(([status, value]) => {
          let name = status
          if (status === 'in_transit') name = 'In Transit'
          else if (status === 'ready_for_dispatch') name = 'Ready for Dispatch'
          else name = status.charAt(0).toUpperCase() + status.slice(1)
          
          return { name, value }
        })
        setLogisticsStats(formattedDeliveryStats)
      }

      // 5. Removed Automatic AI Generation

    } catch (error) {
      console.error("Error fetching analytics data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateInsight = async () => {
    setInsightLoading(true)
    try {
      const summary = await generateAnalyticsSummary({
        totalDonations: totalDonations,
        totalCampaigns: totalCampaigns,
        inventoryItems: totalInventory,
        activeDeliveries: activeDeliveries
      })
      setAiSummary(summary)
    } catch (aiError) {
      console.error("AI Insights Error:", aiError)
    } finally {
      setInsightLoading(false)
    }
  }

  const handleGeneratePrediction = async () => {
    setPredictionLoading(true)
    try {
      // Fetch latest inventory and campaigns status for prediction
      const { data: campaigns } = await supabase.from("campaigns").select("status")
      const { data: inventory } = await supabase.from("inventory").select("status")
      const predictions = await generateDemandPredictions(inventory, campaigns)
      setAiPredictions(predictions)
    } catch (aiError) {
      console.error("AI Predictions Error:", aiError)
    } finally {
      setPredictionLoading(false)
    }
  }

  const handleGenerateReport = () => {
    try {
      const doc = new jsPDF()

      // Set Title
      doc.setFont("helvetica", "bold")
      doc.setFontSize(20)
      doc.setTextColor(59, 130, 246) // Blue
      doc.text("Save 25 Smart Donation Management System", 14, 20)

      doc.setFontSize(14)
      doc.setTextColor(100, 116, 139) // Slate grey
      doc.text("Analytics Dashboard Report", 14, 28)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.text(`Generated on: ${format(new Date(), 'MMMM dd, yyyy hh:mm a')}`, 14, 34)

      // Divider
      doc.setDrawColor(226, 232, 240)
      doc.line(14, 38, 196, 38)

      // Section: Key Overview Metrics
      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.setTextColor(15, 23, 42)
      doc.text("Executive Summary Overview Metrics", 14, 46)

      autoTable(doc, {
        startY: 50,
        head: [["Metric Title", "Current Value"]],
        body: [
          ["Total Donations (Last 30 Days)", `PHP ${totalDonations.toLocaleString()}`],
          ["Total Campaigns", totalCampaigns.toString()],
          ["Inventory Items", totalInventory.toString()],
          ["Active Deliveries", activeDeliveries.toString()],
        ],
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
      })

      let currentY = (doc as any).lastAutoTable.finalY + 12

      // AI Summary and Predictions if available
      if (aiSummary || aiPredictions.length > 0) {
        if (currentY > 240) {
          doc.addPage()
          currentY = 20
        }

        doc.setFont("helvetica", "bold")
        doc.setFontSize(12)
        doc.setTextColor(15, 23, 42)
        doc.text("AI Insights & Predictions", 14, currentY)
        currentY += 6

        if (aiSummary) {
          doc.setFont("helvetica", "normal")
          doc.setFontSize(10)
          doc.setTextColor(51, 65, 85)
          const splitSummary = doc.splitTextToSize(aiSummary, 182)
          doc.text(splitSummary, 14, currentY)
          currentY += splitSummary.length * 5 + 6
        }

        if (aiPredictions.length > 0) {
          if (currentY > 240) {
            doc.addPage()
            currentY = 20
          }

          doc.setFont("helvetica", "bold")
          doc.setFontSize(10)
          doc.setTextColor(15, 23, 42)
          doc.text("Demand Predictions:", 14, currentY)
          currentY += 5

          doc.setFont("helvetica", "normal")
          doc.setTextColor(51, 65, 85)
          aiPredictions.forEach((pred) => {
            const splitPred = doc.splitTextToSize(`• ${pred}`, 182)
            doc.text(splitPred, 14, currentY)
            currentY += splitPred.length * 5 + 2
          })
          currentY += 6
        }
      }

      // Detailed breakdown sections
      if (currentY > 200) {
        doc.addPage()
        currentY = 20
      }

      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.setTextColor(15, 23, 42)
      doc.text("Inventory Status Details", 14, currentY)
      currentY += 4

      autoTable(doc, {
        startY: currentY,
        head: [["Category / Label", "Quantity"]],
        body: inventoryStats.map(item => [item.name, item.value.toString()]),
        theme: "grid",
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: 14, right: 14 },
      })

      currentY = (doc as any).lastAutoTable.finalY + 12

      if (currentY > 200) {
        doc.addPage()
        currentY = 20
      }

      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.setTextColor(15, 23, 42)
      doc.text("Logistics & Deliveries", 14, currentY)
      currentY += 4

      autoTable(doc, {
        startY: currentY,
        head: [["Delivery Status", "Total Records"]],
        body: logisticsStats.map(item => [item.name, item.value.toString()]),
        theme: "grid",
        headStyles: { fillColor: [139, 92, 246] },
        margin: { left: 14, right: 14 },
      })

      currentY = (doc as any).lastAutoTable.finalY + 12

      if (currentY > 200) {
        doc.addPage()
        currentY = 20
      }

      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.setTextColor(15, 23, 42)
      doc.text("Recent Donation Trends (Last 30 Days)", 14, currentY)
      currentY += 4

      autoTable(doc, {
        startY: currentY,
        head: [["Date", "Amount Recieved"]],
        body: donationTrends.map(item => [item.date, `PHP ${item.amount.toLocaleString()}`]),
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14, right: 14 },
      })

      // Add footers with page numbers
      const totalPages = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        doc.setTextColor(148, 163, 184)
        doc.text(`Page ${i} of ${totalPages}`, 196 - 15, 287, { align: "right" })
        doc.text("Save 25 Smart Donation Management System - Confidential Report", 14, 287)
      }

      doc.save(`analytics-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
    } catch (error: any) {
      console.error("Error generating PDF:", error)
      alert("Error generating PDF: " + error.message)
    }
  }

  // Custom Tooltip for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-xl">
          <p className="font-bold text-slate-900 dark:text-white mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {entry.name === 'amount' ? 'Donations' : entry.name}: 
                <span className="ml-2 font-bold text-slate-900 dark:text-white">
                  {entry.name === 'amount' ? `₱${entry.value.toLocaleString()}` : entry.value}
                </span>
              </p>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <SidebarLayout>
      <div className="flex min-h-svh flex-col bg-background/50">
        <main id="analytics-dashboard" className="flex-1 space-y-6 p-6 lg:p-10 max-w-[1600px] mx-auto w-full">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Report Analytics Dashboard</h2>
              <p className="text-slate-500">Overview of platform metrics and performance.</p>
            </div>
            <Button onClick={() => handleGenerateReport()} className="gap-2 shrink-0 transition-all">
              <Download className="size-4" />
              Generate Report
            </Button>
          </div>

          {/* AI Insights Section */}
          <Card className="relative border-primary/20 bg-primary/5 shadow-sm dark:bg-primary/10 overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-primary">
                <Sparkles className="size-5" />
                AI Insights & Predictions
              </CardTitle>
              <CardDescription>Powered by Google Gemini</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Executive Summary */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <Info className="size-4 text-blue-500" />
                      Executive Summary
                    </h4>
                    <Button 
                      onClick={handleGenerateInsight} 
                      disabled={insightLoading}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-2 border-primary/20 text-primary hover:bg-primary/10"
                    >
                      {insightLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                      Generate Insight
                    </Button>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-background/50 p-4 rounded-lg border border-primary/10 min-h-[100px]">
                    {insightLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground h-full">
                        <Loader2 className="size-4 animate-spin" />
                        Generating summary...
                      </div>
                    ) : aiSummary ? (
                      <p>{aiSummary}</p>
                    ) : (
                      <p className="text-slate-500 italic">Click generate to analyze current metrics.</p>
                    )}
                  </div>
                </div>
                
                {/* Demand Predictions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <AlertTriangle className="size-4 text-amber-500" />
                      Demand Predictions
                    </h4>
                    <Button 
                      onClick={handleGeneratePrediction} 
                      disabled={predictionLoading}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-2 border-primary/20 text-primary hover:bg-primary/10"
                    >
                      {predictionLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                      Generate Prediction
                    </Button>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 bg-background/50 p-4 rounded-lg border border-primary/10 min-h-[100px]">
                    {predictionLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground h-full">
                        <Loader2 className="size-4 animate-spin" />
                        Generating predictions...
                      </div>
                    ) : aiPredictions.length > 0 ? (
                      <ul className="space-y-2">
                        {aiPredictions.map((pred, idx) => (
                          <li key={idx} className="flex gap-2">
                            <span className="text-amber-500 font-bold">•</span> 
                            <span>{pred}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-slate-500 italic">Click generate to get demand predictions.</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="size-8 text-primary animate-spin" />
            </div>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-none shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Donations (30d)</p>
                        <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                          ₱{totalDonations.toLocaleString()}
                        </h3>
                      </div>
                      <div className="size-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <TrendingUp className="size-6 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Total Campaigns</p>
                        <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                          {totalCampaigns}
                        </h3>
                      </div>
                      <div className="size-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <Target className="size-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Inventory Items</p>
                        <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                          {totalInventory}
                        </h3>
                      </div>
                      <div className="size-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                        <Package className="size-6 text-purple-600 dark:text-purple-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Active Deliveries</p>
                        <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                          {activeDeliveries}
                        </h3>
                      </div>
                      <div className="size-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <Truck className="size-6 text-amber-600 dark:text-amber-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Grid */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                
                {/* Main Trend Chart */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Donation Trends (Last 30 Days)</CardTitle>
                    <CardDescription>Daily total donation amounts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] w-full">
                      {donationTrends.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={donationTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis 
                              dataKey="date" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 12, fill: '#64748b' }} 
                              dy={10}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 12, fill: '#64748b' }}
                              tickFormatter={(value) => `₱${value}`}
                            />
                            <RechartsTooltip content={<CustomTooltip />} />
                            <Area 
                              type="monotone" 
                              dataKey="amount" 
                              stroke={COLORS.primary} 
                              strokeWidth={3}
                              fillOpacity={1} 
                              fill="url(#colorAmount)" 
                              activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          No donation data in the last 30 days
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Campaign Status Pie Chart */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Campaign Statuses</CardTitle>
                    <CardDescription>Distribution of all campaigns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] w-full">
                      {campaignStats.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={campaignStats}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={5}
                              dataKey="value"
                              stroke="none"
                            >
                              {campaignStats.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip content={<CustomTooltip />} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          No campaigns found
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Logistics Bar Chart */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Logistics & Deliveries</CardTitle>
                    <CardDescription>Current status of tracking records</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] w-full">
                      {logisticsStats.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={logisticsStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 12, fill: '#64748b' }} 
                              dy={10}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 12, fill: '#64748b' }}
                              allowDecimals={false}
                            />
                            <RechartsTooltip 
                              content={<CustomTooltip />} 
                              cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} 
                            />
                            <Bar 
                              dataKey="value" 
                              fill={COLORS.purple} 
                              radius={[4, 4, 0, 0]}
                              barSize={40}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          No delivery records found
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Inventory Overview Bar Chart */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">Inventory Overview</CardTitle>
                    <CardDescription>Type of in-kind donation and quantity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] w-full">
                      {inventoryStats.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={inventoryStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 12, fill: '#64748b' }} 
                              dy={10}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 12, fill: '#64748b' }}
                              allowDecimals={false}
                            />
                            <RechartsTooltip 
                              content={<CustomTooltip />} 
                              cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} 
                            />
                            <Bar 
                              dataKey="value" 
                              fill={COLORS.success} 
                              radius={[4, 4, 0, 0]}
                              barSize={50}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          No inventory items found
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

        </main>
      </div>
    </SidebarLayout>
  )
}
