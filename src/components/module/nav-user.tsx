"use client"

import { useNavigate } from "react-router-dom"
import { useTheme } from "@/components/module/theme-provider"
import { supabase } from "@/lib/supabase"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { 
  User, 
  History, 
  Sun, 
  Moon, 
  Monitor, 
  LogOut, 
  EllipsisVerticalIcon,
  Check
} from "lucide-react"
import { toast } from "sonner"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error("Sign out failed", { description: error.message })
      return
    }
    toast.success("Signed out", {
      description: "You have been signed out successfully.",
    })
    navigate("/login")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground h-12"
            >
              <Avatar className="h-9 w-9 rounded-full">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-full bg-emerald-950 text-white text-xs font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight ml-2">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
              <EllipsisVerticalIcon className="ml-auto size-4 text-gray-400" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 rounded-xl shadow-xl border-gray-100"
            side="top"
            align="start"
            sideOffset={12}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2.5 px-3 py-2.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-full">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-full bg-emerald-950 text-white text-xs font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-[11px] text-muted-foreground font-normal">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem 
                onClick={() => navigate("/profile")}
                className="py-2 px-3 cursor-pointer text-sm"
              >
                <User className="mr-2 size-4 text-muted-foreground" />
                <span className="font-medium">Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => navigate("/transactions")}
                className="py-2 px-3 cursor-pointer text-sm"
              >
                <History className="mr-2 size-4 text-muted-foreground" />
                <span className="font-medium">Transaction History</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Appearance
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem 
                onClick={() => setTheme("light")}
                className="py-2 px-3 cursor-pointer"
              >
                <Sun className="mr-2 size-4 text-muted-foreground" />
                <span className="font-medium">Light</span>
                {theme === "light" && (
                  <Check className="ml-auto size-3.5 text-blue-600" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setTheme("dark")}
                className="py-2 px-3 cursor-pointer"
              >
                <Moon className="mr-2 size-4 text-muted-foreground" />
                <span className="font-medium">Dark</span>
                {theme === "dark" && (
                  <Check className="ml-auto size-3.5 text-blue-600" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setTheme("system")}
                className="py-2 px-3 cursor-pointer"
              >
                <Monitor className="mr-2 size-4 text-muted-foreground" />
                <span className="font-medium">System</span>
                {theme === "system" && (
                  <Check className="ml-auto size-3.5 text-blue-600" />
                )}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              variant="destructive" 
              onClick={handleSignOut}
              className="py-2 px-3 cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-50"
            >
              <LogOut className="mr-2 size-4" />
              <span className="font-medium">Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
