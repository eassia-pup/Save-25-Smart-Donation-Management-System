import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Heart, 
  History, 
  Loader2, 
  PhilippinePeso, 
  Package, 
  HandHeart, 
  Activity, 
  Users,
  ShieldCheck,
  Sparkles,
  Info
} from "lucide-react"
import { toast } from "sonner"
import { generateDonorInsights } from "@/lib/ai-service"
import type { Profile } from "@/lib/database.types"
import { SidebarLayout } from "@/components/module/sidebar-layout"

export default function DashboardPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalDonated: 0,
    activeCampaigns: 0,
    donationsCount: 0,
    totalInKind: 0,
  })
  
  // States for Donor AI Insights
  const [donorDonations, setDonorDonations] = useState<any[]>([])
  const [donorInKind, setDonorInKind] = useState<any[]>([])
  const [activeCampaignsList, setActiveCampaignsList] = useState<any[]>([])
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)

  useEffect(() => {
    async function fetchData() {
      if (!user) return

      try {
        // Fetch Profile
        let profileData: Profile | null = null
        const { data: fetchedProfile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle()

        if (profileError) {
          console.warn("Profile fetch error, using fallback profile:", profileError)
        }

        if (fetchedProfile) {
          profileData = fetchedProfile as Profile
        } else {
          profileData = {
            id: user.id,
            email: user.email || "",
            full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Donor",
            avatar_url: user.user_metadata?.avatar_url || null,
            role: "donor",
            phone: null,
            address_unit: null,
            address_line1: null,
            address_line2: null,
            address_city: null,
            address_state: null,
            address_zip: null,
            address_country: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        }

        setProfile(profileData)

        // Fetch Stats
        if (profileData.role === "donor") {
          // Fetch donor stats and detailed lists for AI Insights
          const [
            { data: donations, error: donationsError },
            { data: inkind, error: inkindError },
            { data: activeCampaignsData, error: campaignsError }
          ] = await Promise.all([
            supabase
              .from("donations")
              .select("amount, created_at, campaigns(title)")
              .eq("donor_id", user.id),
            supabase
              .from("inkind_donations")
              .select("inkind_type, amount_description, created_at, campaigns(title)")
              .eq("donor_id", user.id),
            supabase
              .from("campaigns")
              .select("id, title, category, goal, raised")
              .eq("status", "active")
          ])

          if (donationsError) console.error("Donations fetch error:", donationsError)
          if (inkindError) console.error("In-kind donations fetch error:", inkindError)
          if (campaignsError) console.error("Campaigns fetch error:", campaignsError)

          if (donationsError || inkindError || campaignsError) {
            toast.warning("Some dashboard data could not be loaded.")
          }

          const totalCash = donations?.reduce((sum: number, d: any) => sum + Number(d.amount), 0) || 0
          setStats({
            totalDonated: totalCash,
            activeCampaigns: activeCampaignsData?.length || 0,
            donationsCount: (donations?.length || 0) + (inkind?.length || 0),
            totalInKind: inkind?.length || 0,
          })

          // Save formatted lists to states for AI insights
          const formattedDonations = (donations || []).map((d: any) => ({
            amount: d.amount,
            campaignTitle: d.campaigns?.title || "Unknown Campaign",
            date: new Date(d.created_at).toLocaleDateString(),
          }))

          const formattedInKind = (inkind || []).map((ik: any) => ({
            type: ik.inkind_type,
            description: ik.amount_description,
            campaignTitle: ik.campaigns?.title || "Unknown Campaign",
            date: new Date(ik.created_at).toLocaleDateString(),
          }))

          const formattedCampaigns = (activeCampaignsData || []).map((c: any) => ({
            id: c.id,
            title: c.title,
            category: c.category,
            goal: c.goal,
            raised: c.raised,
          }))

          setDonorDonations(formattedDonations)
          setDonorInKind(formattedInKind)
          setActiveCampaignsList(formattedCampaigns)
        } else {
          // Admin stats: Fetch global totals
          const [
            { data: allDonations, error: allDonationsErr },
            { count: totalCampaigns, error: totalCampaignsErr },
            { count: totalDonors, error: totalDonorsErr },
            { count: totalInKindGlobal, error: totalInKindErr }
          ] = await Promise.all([
            supabase.from("donations").select("amount"),
            supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("status", "active"),
            supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "donor"),
            supabase.from("inkind_donations").select("*", { count: "exact", head: true })
          ])

          if (!allDonationsErr && !totalCampaignsErr && !totalDonorsErr && !totalInKindErr) {
            const totalCash = allDonations?.reduce((sum, d) => sum + d.amount, 0) || 0
            setStats({
              totalDonated: totalCash,
              activeCampaigns: totalCampaigns || 0,
              donationsCount: totalDonors || 0,
              totalInKind: totalInKindGlobal || 0,
            })
          }
        }
      } catch (error: any) {
        console.error("Dashboard full error:", error)
        toast.error(error.message || "Failed to load dashboard data")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  const handleGenerateDonorInsights = async () => {
    if (!user) return
    setInsightLoading(true)
    try {
      const insight = await generateDonorInsights({
        donorName: profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Donor",
        totalCash: stats.totalDonated,
        totalInKind: stats.totalInKind,
        donations: donorDonations,
        inkindDonations: donorInKind,
        activeCampaigns: activeCampaignsList,
      })
      setAiInsight(insight)
      toast.success("Insights generated successfully!")
    } catch (error) {
      console.error("Failed to generate donor insights:", error)
      toast.error("Failed to generate insights. Please try again.")
    } finally {
      setInsightLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  // Security: Only show Admin Dashboard if the role is explicitly 'admin' or 'trustee'
  const isAdmin = profile?.role === "admin" || profile?.role === "trustee"
  const isDonor = !isAdmin

  const content = (
    <div className="flex min-h-svh flex-col bg-background">

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {isDonor ? "Donor Dashboard" : "Admin Dashboard"}
            </h2>
            <p className="mt-1 text-muted-foreground">
              Welcome back, {profile?.full_name || user?.email?.split("@")[0] || "User"}!
            </p>
          </div>
        </div>

        {isDonor ? (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <Card className="border-none bg-primary/5 shadow-none transition-colors hover:bg-primary/10">
              <CardContent className="p-5 h-full flex items-center">
                <div className="flex items-center gap-3.5 w-full">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 shrink-0">
                    <PhilippinePeso className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">My Total Donations</p>
                    <p className="text-lg font-bold">₱{stats.totalDonated.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none bg-primary/5 shadow-none transition-colors hover:bg-primary/10">
              <CardContent className="p-5 h-full flex items-center">
                <div className="flex items-center gap-3.5 w-full">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 shrink-0">
                    <Package className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">My Total In-kind Donations</p>
                    <p className="text-lg font-bold">{stats.totalInKind}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none bg-primary/5 shadow-none transition-colors hover:bg-primary/10">
              <CardContent className="p-5 h-full flex items-center">
                <div className="flex items-center gap-3.5 w-full">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 shrink-0">
                    <HandHeart className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Contributions Made</p>
                    <p className="text-lg font-bold">{stats.donationsCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary/20 bg-background shadow-lg shadow-primary/5 transition-all hover:bg-primary/5">
              <CardContent className="p-5 h-full flex flex-col justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary shadow-sm shrink-0">
                    <Heart className="size-5" />
                  </div>
                  <p className="text-xs font-semibold text-primary truncate">Make a Difference</p>
                </div>
                <Button asChild size="sm" className="w-full h-7 px-3 text-xs font-bold shadow-sm">
                  <Link to="/donor">Browse Campaigns</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary/20 bg-background shadow-lg shadow-primary/5 transition-all hover:bg-primary/5">
              <CardContent className="p-5 h-full flex flex-col justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary shadow-sm shrink-0">
                    <History className="size-5" />
                  </div>
                  <p className="text-xs font-semibold text-primary truncate">View History</p>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full h-7 px-3 text-xs font-bold border-2 hover:bg-primary/5">
                  <Link to="/transactions">Donation History</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="border-none bg-primary/5 shadow-none transition-colors hover:bg-primary/10">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 shrink-0">
                    <PhilippinePeso className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Donations</p>
                    <p className="text-2xl font-bold">₱{stats.totalDonated.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none bg-primary/5 shadow-none transition-colors hover:bg-primary/10">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 shrink-0">
                    <Activity className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Campaigns</p>
                    <p className="text-2xl font-bold">{stats.activeCampaigns}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none bg-primary/5 shadow-none transition-colors hover:bg-primary/10">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 shrink-0">
                    <Users className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Donors</p>
                    <p className="text-2xl font-bold">{stats.donationsCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isDonor ? (
          <div className="mt-8 space-y-6">

            {/* AI Insights Card */}
            <Card className="relative overflow-hidden border-2 border-primary/20 shadow-xl shadow-primary/5 bg-gradient-to-br from-background to-primary/5">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Sparkles className="size-32 text-primary" />
              </div>
              <CardContent className="p-8 space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <Sparkles className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-primary">My AI Insights & Impact</h3>
                      <p className="text-sm text-muted-foreground">
                        Personalized analysis of your donations and smart suggestions for active campaigns.
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center">
                    <Button 
                      onClick={handleGenerateDonorInsights} 
                      disabled={insightLoading}
                      className="font-bold shadow-lg shadow-primary/25 bg-primary hover:bg-primary/95 text-primary-foreground gap-2 w-full sm:w-auto"
                    >
                      {insightLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="size-4 animate-pulse text-yellow-300" />
                          {aiInsight ? "Regenerate Insights" : "Generate Insights"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="min-h-[120px] rounded-lg border border-primary/10 bg-background/50 p-6 backdrop-blur-sm relative">
                  {insightLoading ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Loader2 className="size-8 animate-spin text-primary" />
                      <p className="mt-2 text-sm text-muted-foreground animate-pulse">
                        Gemini is analyzing your donation patterns and impact...
                      </p>
                    </div>
                  ) : aiInsight ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                        {aiInsight}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Info className="size-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground max-w-md">
                        No insights generated yet. Click the button to analyze your contributions and find matching active campaigns!
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex justify-end items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="size-3 text-primary animate-pulse" />
                  <span>Powered by Google Gemini Flash 2.5</span>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="mt-8 overflow-hidden border-2 border-primary/20 shadow-xl shadow-primary/5">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="size-10" />
              </div>
              <h3 className="text-xl font-bold text-primary">
                Administrator Access
              </h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Welcome to the command center. Use the sidebar to manage 
                campaigns, review donations, and track community growth.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )

  return <SidebarLayout defaultOpen={isAdmin}>{content}</SidebarLayout>
}
