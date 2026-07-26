"use client"

import Link from "next/link"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

/**
 * Brand row in the sidebar header. Single workspace, so this is a plain
 * wordmark linking home — the shadcn logo-tile switcher pattern is reserved
 * for when real workspace switching exists, and this component is the seam
 * where that switcher would land. Icon-collapsed mode shows the "H" glyph,
 * since the wordmark has no room.
 */
export function WorkspaceSwitcher({ href = "/dashboard" }: { href?: string }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          tooltip="Hodget"
          render={<Link href={href} />}
        >
          <span className="truncate px-1 font-heading text-lg font-black tracking-tight group-data-[collapsible=icon]:hidden">
            Hodget
          </span>
          <span className="hidden w-full text-center font-heading text-lg font-black group-data-[collapsible=icon]:block">
            H
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
