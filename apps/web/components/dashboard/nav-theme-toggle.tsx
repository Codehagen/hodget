"use client"

import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

/**
 * Light/dark switch in the sidebar. Follows the playbook pattern: BOTH icon and
 * label are rendered and CSS `dark:` variants decide what shows — driven by the
 * `dark` class next-themes sets on <html> before paint. No JS state means no
 * hydration flash and no set-state-in-effect. The click reads resolvedTheme and
 * flips it. Works in collapsed icon mode too (tooltip); the app also toggles on
 * the "D" key (see ThemeProvider).
 */
export function NavThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Toggle theme"
          aria-label="Toggle light and dark theme"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <HugeiconsIcon icon={Sun03Icon} size={16} className="hidden dark:block" />
          <HugeiconsIcon icon={Moon02Icon} size={16} className="block dark:hidden" />
          <span className="dark:hidden">Dark mode</span>
          <span className="hidden dark:inline">Light mode</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
