import { Badge } from "@workspace/ui/components/badge"
import { Separator } from "@workspace/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import { AppSidebar } from "@/components/dashboard/app-sidebar"

/**
 * Public mirror of the /dashboard shell — the same sidebar + top bar, but with
 * NO session guard so anyone browsing the open-source repo can see the product.
 * Nav links point at /demo and the sticky header carries a "Demo — mock data"
 * badge. No auth and no data access means this route prerenders statically.
 */
export default function DemoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar basePath="/demo" demo />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Badge variant="amber" className="gap-1.5">
            Demo — mock data
          </Badge>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
