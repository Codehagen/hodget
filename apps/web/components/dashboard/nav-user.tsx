"use client"

import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CreditCardAcceptIcon,
  Logout01Icon,
  UnfoldMoreDownIcon,
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
