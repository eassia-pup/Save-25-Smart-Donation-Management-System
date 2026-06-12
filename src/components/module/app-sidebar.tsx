import * as React from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"
import { NavMain } from "@/components/module/nav-main"
import { NavSecondary } from "@/components/module/nav-secondary"
import { NavUser } from "@/components/module/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { 
  LayoutDashboardIcon, 
  HistoryIcon,
  SearchIcon, 
  ChartBarIcon,
  ListIcon,
  PackageOpen,
  Truck,
  ArrowLeft
} from "lucide-react"
import type { Profile } from "@/lib/database.types"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const navigate = useNavigate()

  React.useEffect(() => {
    async function fetchProfile() {
      if (!user) return
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      
      if (data) setProfile(data as Profile)
    }
    fetchProfile()
  }, [user])
  // Security: Default to donor role if profile is loading or unknown.
  // Only grant admin access if the role is explicitly 'admin' or 'trustee'.
  const isAdmin = profile?.role === "admin" || profile?.role === "trustee"
  const isDonor = !isAdmin

  const navMain = isDonor ? [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Browse Campaigns",
      url: "/donor",
      icon: <SearchIcon />,
    },
    {
      title: "My Transactions",
      url: "/transactions",
      icon: <HistoryIcon />,
    },
  ] : [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Campaign Management",
      url: "/admin/campaigns",
      icon: <ListIcon />,
    },
    {
      title: "Inventory",
      url: "/admin/inventory",
      icon: <PackageOpen className="size-4" />,
    },
    {
      title: "Logistics Tracking",
      url: "/admin/logistics",
      icon: <Truck className="size-4" />,
    },
    {
      title: "Analytics",
      url: "/admin/analytics",
      icon: <ChartBarIcon />,
    },
  ]

  const navSecondary: { title: string; url: string; icon: React.ReactNode }[] = []

  const userData = {
    name: profile?.full_name || user?.email?.split("@")[0] || "User",
    email: user?.email || "Unknown",
    avatar: profile?.avatar_url || "/avatars/shadcn.jpg",
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="h-16 border-b p-0 px-4 flex flex-row items-center gap-4">
        <SidebarTrigger className="-ml-1" icon={ArrowLeft} />
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate("/dashboard")}
        >
          <img src="/logo.svg" alt="Save 25 Logo" className="size-8 object-contain" />
          <span className="text-base font-bold truncate">Save 25 SDMS</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        {navSecondary.length > 0 && <NavSecondary items={navSecondary} className="mt-auto" />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
