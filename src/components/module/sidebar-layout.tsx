import * as React from "react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/module/app-sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

export function SidebarLayout({ 
  children,
  defaultOpen = true 
}: { 
  children: React.ReactNode
  defaultOpen?: boolean 
}) {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset>
          <div className="flex h-16 items-center px-4">
            <SidebarTrigger />
          </div>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
