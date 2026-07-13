import { type ComponentProps } from "react"
import { type HugeiconsIcon } from "@hugeicons/react"
import {
  AiBrain01Icon,
  DashboardSquare01Icon,
  Database01Icon,
  RocketIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"

export type NavItem = {
  title: string
  href: string
  icon: ComponentProps<typeof HugeiconsIcon>["icon"]
  /** Exact path match for active state (use for the index route). */
  exact?: boolean
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

// Single source of truth for the sidebar nav — edited as data, not JSX.
// Grouped around the engine lifecycle: overview, then the cycle and its inputs.
// Only /dashboard exists today; the rest are placeholders wired to real routes
// as they land.
export const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: DashboardSquare01Icon,
        exact: true,
      },
    ],
  },
  {
    label: "Engine",
    items: [
      { title: "Runs", href: "#", icon: RocketIcon },
      { title: "Strategies", href: "#", icon: AiBrain01Icon },
      { title: "Data", href: "#", icon: Database01Icon },
    ],
  },
] satisfies NavGroup[]

export const NAV_SECONDARY = [
  { title: "Settings", href: "#", icon: Settings01Icon },
] satisfies NavItem[]
