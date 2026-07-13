"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CreditCardAcceptIcon,
  Logout01Icon,
  UnfoldMoreDownIcon,
  UserAdd01Icon,
  UserCircle02Icon,
} from "@hugeicons/core-free-icons"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@workspace/ui/components/menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"

import { signOut } from "@/lib/auth-client"

export type NavUserData = {
  name: string
  email: string
  image?: string | null
}

function initialsOf(name: string) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase()
  return initials || "U"
}

export function NavUser({ user }: { user: NavUserData }) {
  const router = useRouter()
  const { isMobile } = useSidebar()

  async function handleSignOut() {
    await signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Menu>
          <MenuTrigger
            render={
              <SidebarMenuButton size="lg">
                <Avatar className="size-8 rounded-md">
                  <AvatarFallback className="rounded-md">
                    {initialsOf(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-medium">
                    {user.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
                <HugeiconsIcon
                  icon={UnfoldMoreDownIcon}
                  size={16}
                  className="ml-auto text-muted-foreground"
                />
              </SidebarMenuButton>
            }
          />
          <MenuContent
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
            className="min-w-56"
          >
            <MenuItem>
              <HugeiconsIcon icon={UserCircle02Icon} size={16} />
              Account
            </MenuItem>
            <MenuItem>
              <HugeiconsIcon icon={CreditCardAcceptIcon} size={16} />
              Billing
            </MenuItem>
            <MenuSeparator />
            <MenuItem onClick={handleSignOut}>
              <HugeiconsIcon icon={Logout01Icon} size={16} />
              Sign out
            </MenuItem>
          </MenuContent>
        </Menu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

/**
 * Footer slot for the public /demo shell. No real session, so there is nothing
 * to sign out of — a compact call-to-action card (the shadcn sidebar-footer
 * pattern) states plainly that this is sample data and points at sign-up.
 * Collapsed to icon mode, the card hides and a plain sign-up button remains.
 */
export function NavDemoUser() {
  return (
    <SidebarMenu>
      <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
        <div className="flex flex-col gap-2.5 border border-border bg-card p-3">
          <div className="grid gap-1 leading-tight">
            <span className="text-sm font-medium">Exploring the demo</span>
            <span className="text-xs text-muted-foreground">
              Everything here is sample data. Create a free account to run
              your own strategies.
            </span>
          </div>
          <Button size="sm" className="w-full" render={<Link href="/sign-up" />}>
            <HugeiconsIcon icon={UserAdd01Icon} size={16} />
            Sign up
          </Button>
        </div>
      </SidebarMenuItem>
      <SidebarMenuItem className="hidden group-data-[collapsible=icon]:block">
        <SidebarMenuButton
          tooltip="Sign up"
          render={<Link href="/sign-up" />}
        >
          <HugeiconsIcon icon={UserAdd01Icon} size={16} />
          <span>Sign up</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
