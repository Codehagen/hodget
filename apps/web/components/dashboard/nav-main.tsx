"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"

import { cn } from "@workspace/ui/lib/utils"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

import { NAV_GROUPS, NAV_SECONDARY, type NavItem } from "./nav-items"

function itemIsActive(pathname: string, item: NavItem) {
  if (item.href === "#") {
    return false
  }
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function NavList({
  items,
  label,
  className,
}: {
  items: NavItem[]
  label?: string
  className?: string
}) {
  const pathname = usePathname()
  return (
    <SidebarGroup className={cn(className)}>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              isActive={itemIsActive(pathname, item)}
              tooltip={item.title}
              render={<Link href={item.href} />}
            >
              <HugeiconsIcon icon={item.icon} size={16} />
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

export function NavMain() {
  return (
    <>
      {NAV_GROUPS.map((group) => (
        <NavList key={group.label} items={group.items} label={group.label} />
      ))}
    </>
  )
}

export function NavSecondary() {
  return <NavList items={NAV_SECONDARY} className="mt-auto" />
}
