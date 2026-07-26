"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

import { useThemeToggle } from "@/components/theme-provider"

/**
 * Light/dark switch in the sidebar. Follows the playbook pattern: BOTH icon and
 * label are rendered and CSS `dark:` variants decide what shows — driven by the
 * `dark` class next-themes sets on <html> before paint. No JS state means no
 * hydration flash and no set-state-in-effect. The click flips the theme via
 * useThemeToggle (which crossfades the swap). Works in collapsed icon mode too
 * (tooltip); the app also toggles on the "D" key (see ThemeProvider).
 */
export function NavThemeToggle() {
  const toggleTheme = useThemeToggle()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Toggle theme"
          aria-label="Toggle light and dark theme"
          onClick={toggleTheme}
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
