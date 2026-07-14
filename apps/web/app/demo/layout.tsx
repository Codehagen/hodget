import { Badge } from "@workspace/ui/components/badge"
import { Separator } from "@workspace/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { constructMetadata } from "@/lib/metadata"

// No canonicalUrl here: layout metadata is inherited by every /demo/* page
// that doesn't define its own, and a layout-level canonical would collapse
// them all onto /demo for crawlers. The canonical lives on demo/page.tsx.
export const metadata = constructMetadata({
  title: "Demo",
  description:
    "Explore the Hodget engine with deterministic mock data: runs, decision timelines, strategies, analysts, and market data coverage.",
})

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
