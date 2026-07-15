import { type ComponentProps } from "react"
import { type HugeiconsIcon } from "@hugeicons/react"
import {
  AiBrain01Icon,
  BubbleChatIcon,
  DashboardSquare01Icon,
  Database01Icon,
  Flowchart01Icon,
  RocketIcon,
  Settings01Icon,
  UserMultiple02Icon,
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
// `href` is a segment relative to the section base — NavMain composes it with
// the current basePath ("/dashboard" or "/demo"). The index item (`exact`)
// resolves to the base itself. Settings has no destination yet, so it stays "#".
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
      { title: "Ask", href: "/ask", icon: BubbleChatIcon },
    ],
  },
  {
    label: "Engine",
    items: [
      { title: "Decisions", href: "/decisions", icon: Flowchart01Icon },
      { title: "Runs", href: "/runs", icon: RocketIcon },
      { title: "Strategies", href: "/strategies", icon: AiBrain01Icon },
      { title: "Analysts", href: "/analysts", icon: UserMultiple02Icon },
      { title: "Data", href: "/data", icon: Database01Icon },
    ],
  },
] satisfies NavGroup[]

export const NAV_SECONDARY = [
  { title: "Settings", href: "#", icon: Settings01Icon },
] satisfies NavItem[]
