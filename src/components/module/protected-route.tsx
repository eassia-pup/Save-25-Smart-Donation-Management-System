import { useEffect } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (user) {
      const isEmailConfirmed = user.email_confirmed_at || 
                              user.app_metadata?.provider === 'google' || 
                              user.app_metadata?.provider === 'github';
      if (!isEmailConfirmed) {
        supabase.auth.signOut().then(() => {
          toast.error("Verification Required", {
            description: "Please confirm your email address before accessing the dashboard.",
          })
        })
      }
    }
  }, [user])

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const isEmailConfirmed = user.email_confirmed_at || 
                          user.app_metadata?.provider === 'google' || 
                          user.app_metadata?.provider === 'github';
  if (!isEmailConfirmed) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

