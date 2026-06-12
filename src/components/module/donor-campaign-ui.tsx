import * as React from "react"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { CampaignCard } from "@/components/module/campaign-card"
import { CampaignDetailDialog } from "@/components/module/campaign-detail-dialog"
import { DonationPaymentForm } from "@/components/module/donation-payment-form"
import { Button } from "@/components/ui/button"
import type { Campaign } from "@/lib/database.types"
import { Search, Loader2, ArrowLeft } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export function DonorCampaignUI() {
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedCampaign, setSelectedCampaign] =
    React.useState<Campaign | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Fetch campaigns from Supabase
  React.useEffect(() => {
    async function fetchCampaigns() {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching campaigns:", error)
        toast.error("Failed to load campaigns")
      } else {
        setCampaigns((data as Campaign[]) || [])
      }
      setLoading(false)
    }

    fetchCampaigns()
  }, [])

  // Auto-open donation dialog if redirected back from PayMongo with payment parameter
  React.useEffect(() => {
    if (loading) return

    const params = new URLSearchParams(window.location.search)
    const paymentStatus = params.get("payment")
    const campaignId = params.get("campaign_id")

    if ((paymentStatus === "success" || paymentStatus === "cancelled") && campaignId) {
      const matchedCampaign = campaigns.find((c) => c.id === campaignId)
      if (matchedCampaign) {
        setSelectedCampaign(matchedCampaign)
        setPaymentOpen(true)
      }
    }
  }, [campaigns, loading])

  const filteredCampaigns = React.useMemo(() => {
    if (!searchQuery.trim()) return campaigns
    const q = searchQuery.toLowerCase()
    return campaigns.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.short_description.toLowerCase().includes(q)
    )
  }, [searchQuery, campaigns])

  function handleViewDetails(campaign: Campaign) {
    setSelectedCampaign(campaign)
    setDetailOpen(true)
  }

  function handleDonateNow(campaign: Campaign) {
    setSelectedCampaign(campaign)
    setDetailOpen(false)
    setPaymentOpen(true)
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">

      {/* Hero Section */}
      <section className="border-b bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Browse Campaigns
              </h2>
              <p className="mt-2 max-w-xl text-muted-foreground">
                Discover causes that matter. Every donation makes a difference
                in someone&apos;s life. Choose a campaign and help create a
                better future.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-72">
              <div className="relative w-full">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="campaign-search"
                  placeholder="Search campaigns..."
                  className="pl-8 h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button asChild variant="outline" size="sm" className="h-9 w-full justify-start border-primary/20 hover:bg-primary/5 hover:text-primary">
                <Link to="/dashboard">
                  <ArrowLeft className="mr-2 size-4" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Campaign Cards Grid */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">
              Loading campaigns...
            </p>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 text-4xl">🔍</div>
            <h3 className="text-xl font-semibold">No campaigns found</h3>
            <p className="mt-2 max-w-md text-muted-foreground">
              Try adjusting your search query to find campaigns.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
          © 2026 Save 25 Smart Donation Management System. All rights reserved.
        </div>
      </footer>

      {/* Campaign Detail Dialog */}
      <CampaignDetailDialog
        campaign={selectedCampaign}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onDonateNow={handleDonateNow}
      />

      {/* Payment Form Dialog */}
      <DonationPaymentForm
        campaign={selectedCampaign}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      />
    </div>
  )
}
