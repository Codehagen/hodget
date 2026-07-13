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
 * to sign out of — a static, non-interactive identity makes clear you are
 * viewing sample data, paired with a "Sign up" call to action.
 */
export function NavDemoUser() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center gap-2 rounded-md p-2 text-left group-data-[collapsible=icon]:justify-center">
          <Avatar className="size-8 rounded-md">
            <AvatarFallback className="rounded-md">DU</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-medium">Demo user</span>
            <span className="truncate text-xs text-muted-foreground">
              Viewing sample data
            </span>
          </div>
        </div>
      </SidebarMenuItem>
      <SidebarMenuItem>
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
