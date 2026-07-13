import { Separator } from "@workspace/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { requireSession } from "@/lib/session"

/**
 * Shared shell for every /dashboard/* route: the sidebar + a slim top bar with
 * the collapse/mobile toggle, then the page. Hoists the auth guard out of each
 * page — requireSession redirects unauthenticated users to /sign-in. Global
 * providers (theme/query/nuqs) already live in the root layout; this adds only
 * SidebarProvider.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireSession()

  const user = {
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
