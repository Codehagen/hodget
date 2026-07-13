"use client"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

/**
 * Brand / workspace tile in the sidebar header. Single static workspace for now;
 * structured so it can later wrap a Base UI Menu switcher. Degrades to the logo
 * tile only when the sidebar collapses to icon mode.
 */
export function WorkspaceSwitcher() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg">
          <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md bg-primary font-heading text-sm font-black text-primary-foreground">
            H
          </div>
          <div className="grid flex-1 text-left leading-tight">
            <span className="truncate font-heading text-sm font-bold">
              Hodget
            </span>
            <span className="truncate text-xs text-muted-foreground">
              Internal
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
