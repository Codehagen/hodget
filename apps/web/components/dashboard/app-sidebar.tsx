"use client"

import * as React from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@workspace/ui/components/sidebar"

import { NavMain, NavSecondary } from "./nav-main"
import { NavThemeToggle } from "./nav-theme-toggle"
import { NavDemoUser, NavUser, type NavUserData } from "./nav-user"
import { WorkspaceSwitcher } from "./workspace-switcher"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  /** Route base for nav links + active state — "/dashboard" or "/demo". */
  basePath?: string
} & (
    | { demo: true; user?: never }
    | { demo?: false; user: NavUserData }
  )

/**
 * The dashboard shell sidebar. Serves both the authenticated /dashboard (real
 * user, sign-out) and the public /demo (static demo identity, no session) — the
 * caller picks via `basePath` and the `demo` / `user` discriminated props.
 */
export function AppSidebar({
  basePath = "/dashboard",
  demo = false,
  user,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <WorkspaceSwitcher href={basePath} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain basePath={basePath} />
        <NavSecondary basePath={basePath} />
      </SidebarContent>
      <SidebarFooter>
        <NavThemeToggle />
        {demo || !user ? <NavDemoUser /> : <NavUser user={user} />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
