import * as React from "react"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Heart,
  ArrowLeft,
  FileText,
  FileSpreadsheet,
  Loader2,
  Search,
  HandHeart,
  CreditCard,
  Calendar,
  Package,
  Filter,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { SidebarLayout } from "@/components/module/sidebar-layout"

// ── Types ──

type TransactionRow = {
  id: string
  type: "credit_card" | "debit_card" | "in_kind"
  campaign_title: string
  amount: string
  method_label: string
  detail: string
  date: string
  raw_date: string // for sorting
}

// ── Helpers ──

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const INKIND_LABELS: Record<string, string> = {
  relief_goods: "Relief Goods",
  new_clothes: "New Clothes",
  medicine: "Medicine",
  essential_goods: "Essential Goods",
}

// ── Page ──

export default function TransactionsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [transactions, setTransactions] = React.useState<TransactionRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState<string>("all")

  // Fetch donations + in-kind donations
  React.useEffect(() => {
    async function fetchTransactions() {
      if (!user) return

      const rows: TransactionRow[] = []

      // 1. Monetary donations
      const { data: donations, error: dErr } = await supabase
        .from("donations")
        .select("id, campaign_id, amount, method, cardholder_name, billing_address, created_at")
        .eq("donor_id", user.id)
        .order("created_at", { ascending: false })

      if (dErr) {
        console.error("Error fetching donations:", dErr)
      }

      // Get campaign titles for donations
      if (donations && donations.length > 0) {
        const campaignIds = [...new Set(donations.map((d: { campaign_id: string }) => d.campaign_id))]
        const { data: campaigns } = await supabase
          .from("campaigns")
          .select("id, title")
          .in("id", campaignIds)

        const titleMap = new Map(
          (campaigns || []).map((c: { id: string; title: string }) => [c.id, c.title])
        )

        for (const d of donations) {
          const don = d as {
            id: string
            campaign_id: string
            amount: number
            method: string
            cardholder_name: string
            billing_address: string | null
            created_at: string
          }
          const methodLabel =
            don.method === "credit_card" ? "Credit Card" : "Debit Card"
          rows.push({
            id: don.id,
            type: don.method as "credit_card" | "debit_card",
            campaign_title: titleMap.get(don.campaign_id) || "Unknown Campaign",
            amount: formatCurrency(don.amount),
            method_label: methodLabel,
            detail: don.cardholder_name,
            date: formatDate(don.created_at),
            raw_date: don.created_at,
          })
        }
      }

      // 2. In-kind donations
      const { data: inkind, error: iErr } = await supabase
        .from("inkind_donations")
        .select("id, campaign_id, donor_name, inkind_type, amount_description, contact_number, address, created_at")
        .eq("donor_id", user.id)
        .order("created_at", { ascending: false })

      if (iErr) {
        console.error("Error fetching in-kind donations:", iErr)
      }

      if (inkind && inkind.length > 0) {
        const campaignIds = [...new Set(inkind.map((d: { campaign_id: string }) => d.campaign_id))]
        const { data: campaigns } = await supabase
          .from("campaigns")
          .select("id, title")
          .in("id", campaignIds)

        const titleMap = new Map(
          (campaigns || []).map((c: { id: string; title: string }) => [c.id, c.title])
        )

        for (const d of inkind) {
          const ink = d as {
            id: string
            campaign_id: string
            donor_name: string
            inkind_type: string
            amount_description: string
            contact_number: string
            address: string
            created_at: string
          }
          rows.push({
            id: ink.id,
            type: "in_kind",
            campaign_title: titleMap.get(ink.campaign_id) || "Unknown Campaign",
            amount: ink.amount_description,
            method_label: "In-kind Donation",
            detail: `${INKIND_LABELS[ink.inkind_type] || ink.inkind_type} — ${ink.donor_name}`,
            date: formatDate(ink.created_at),
            raw_date: ink.created_at,
          })
        }
      }

      // Sort all by date descending
      rows.sort(
        (a, b) =>
          new Date(b.raw_date).getTime() - new Date(a.raw_date).getTime()
      )

      setTransactions(rows)
      setLoading(false)
    }

    fetchTransactions()
  }, [user])

  // Filtered transactions
  const filteredTransactions = React.useMemo(() => {
    let filtered = transactions

    if (typeFilter !== "all") {
      if (typeFilter === "card") {
        filtered = filtered.filter(
          (t) => t.type === "credit_card" || t.type === "debit_card"
        )
      } else if (typeFilter === "in_kind") {
        filtered = filtered.filter((t) => t.type === "in_kind")
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (t) =>
          t.campaign_title.toLowerCase().includes(q) ||
          t.method_label.toLowerCase().includes(q) ||
          t.detail.toLowerCase().includes(q) ||
          t.amount.toLowerCase().includes(q)
      )
    }

    return filtered
  }, [transactions, typeFilter, searchQuery])

  // ── CSV Download ──

  function downloadCSV() {
    if (filteredTransactions.length === 0) {
      toast.error("No transactions to export")
      return
    }

    const headers = ["Date", "Campaign", "Type", "Amount / Description"]
    const csvRows = [
      headers.join(","),
      ...filteredTransactions.map((t) =>
        [
          `"${t.date}"`,
          `"${t.campaign_title}"`,
          `"${t.method_label}"`,
          `"${t.amount}"`,
        ].join(",")
      ),
    ]

    const csvContent = csvRows.join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `donation-history-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)

    toast.success("CSV downloaded!", {
      description: `${filteredTransactions.length} transactions exported.`,
    })
  }

  // ── PDF Download ──

  function downloadPDF() {
    if (filteredTransactions.length === 0) {
      toast.error("No transactions to export")
      return
    }

    const doc = new jsPDF()

    // Header
    doc.setFontSize(18)
    doc.setTextColor(37, 99, 235) // Primary blue
    doc.text("Save 25 Smart Donation Management System", 14, 20)

    doc.setFontSize(11)
    doc.setTextColor(100, 100, 100)
    doc.text("Transaction History Report", 14, 28)

    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleString("en-PH")}`, 14, 34)
    doc.text(`Donor: ${user?.email || "Unknown"}`, 14, 39)
    doc.text(`Total Records: ${filteredTransactions.length}`, 14, 44)

    // Line separator
    doc.setDrawColor(37, 99, 235)
    doc.setLineWidth(0.5)
    doc.line(14, 47, 196, 47)

    // Table
    const tableData = filteredTransactions.map((t) => [
      t.date,
      t.campaign_title,
      t.method_label,
      t.amount,
    ])

    autoTable(doc, {
      startY: 52,
      head: [["Date", "Campaign", "Type", "Amount"]],
      body: tableData,
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [245, 247, 255],
      },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 60 },
        2: { cellWidth: 40 },
        3: { cellWidth: 35 },
      },
    })

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(
        `Page ${i} of ${pageCount} — Save 25 Smart Donation Management System`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      )
    }

    doc.save(`donation-history-${new Date().toISOString().slice(0, 10)}.pdf`)

    toast.success("PDF downloaded!", {
      description: `${filteredTransactions.length} transactions exported.`,
    })
  }

  // ── Type icon helper ──

  function TypeIcon({ type }: { type: TransactionRow["type"] }) {
    if (type === "in_kind") return <Package className="size-4 text-emerald-500" />
    return <CreditCard className="size-4 text-blue-500" />
  }

  // ── Render ──

  const content = (
    <div className="flex min-h-svh flex-col bg-background">

      {/* Main */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 gap-1.5"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {/* Page heading */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Transaction History
            </h2>
            <p className="mt-1 text-muted-foreground">
              View and export your complete donation records.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              id="download-csv-btn"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={downloadCSV}
            >
              <FileSpreadsheet className="size-4" />
              Export CSV
            </Button>
            <Button
              id="download-pdf-btn"
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white border-none transition-colors"
              onClick={downloadPDF}
            >
              <FileText className="size-4" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="search-transactions"
              placeholder="Search transactions..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger id="filter-type" className="w-full sm:w-48">
              <Filter className="mr-2 size-4 text-muted-foreground" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="card">Credit / Debit Card</SelectItem>
              <SelectItem value="in_kind">In-kind Donations</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
                <CreditCard className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {transactions.filter((t) => t.type !== "in_kind").length}
                </p>
                <p className="text-xs text-muted-foreground">
                  Card Donations
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <Package className="size-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {transactions.filter((t) => t.type === "in_kind").length}
                </p>
                <p className="text-xs text-muted-foreground">
                  In-kind Donations
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <HandHeart className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{transactions.length}</p>
                <p className="text-xs text-muted-foreground">
                  Total Donations
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">
              Loading transactions...
            </p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
                <HandHeart className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No transactions yet</h3>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                {searchQuery || typeFilter !== "all"
                  ? "No transactions match your filters. Try adjusting your search."
                  : "Your donation history will appear here once you make your first donation."}
              </p>
              {!searchQuery && typeFilter === "all" && (
                <Button
                  className="mt-4 gap-2"
                  onClick={() => navigate("/donor")}
                >
                  <Heart className="size-4" />
                  Browse Campaigns
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {filteredTransactions.length} transaction
                {filteredTransactions.length !== 1 ? "s" : ""}
                {(searchQuery || typeFilter !== "all") && " found"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop table */}
              <div className="hidden sm:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Campaign</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((t, i) => (
                      <tr
                        key={t.id}
                        className={`border-b text-sm transition-colors last:border-0 hover:bg-muted/30 ${
                          i % 2 === 0 ? "" : "bg-muted/10"
                        }`}
                      >
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="size-3.5" />
                            {t.date}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {t.campaign_title}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <TypeIcon type={t.type} />
                            {t.method_label}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {t.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y sm:hidden">
                {filteredTransactions.map((t) => (
                  <div key={t.id} className="space-y-1.5 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{t.campaign_title}</span>
                      <span className="font-semibold tabular-nums">
                        {t.amount}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <TypeIcon type={t.type} />
                        {t.method_label}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {t.date}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}


      </main>
    </div>
  )

  return <SidebarLayout defaultOpen={false}>{content}</SidebarLayout>
}
