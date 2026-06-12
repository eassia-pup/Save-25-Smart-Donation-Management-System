import * as React from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { DonorCampaignUI } from "@/components/module/donor-campaign-ui"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { SidebarLayout } from "@/components/module/sidebar-layout"

export default function DonorPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isAuthorized, setIsAuthorized] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    async function checkRole() {
      if (!user) return

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()

        if (error || !data) {
          throw new Error("Could not verify user role")
        }

        if (data.role === "donor") {
          setIsAuthorized(true)
        } else {
          toast.error("Access Denied", {
            description: "This page is only accessible to donors.",
          })
          navigate("/dashboard")
        }
      } catch (error) {
        console.error("Role verification error:", error)
        navigate("/dashboard")
      }
    }

    checkRole()
  }, [user, navigate])

  if (isAuthorized === null) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    )
  }

  return (
    <SidebarLayout defaultOpen={false}>
      <DonorCampaignUI />
    </SidebarLayout>
  )
}
