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

import { NAV_GROUPS, type NavItem } from "./nav-items"

// The index item (`exact`) is the section home — its href is the current
// route's base (e.g. "/dashboard" or "/demo"). Every other item stores a
// segment ("/runs") that we compose onto the base so the same nav tree serves
// both /dashboard and /demo.
function resolveHref(item: NavItem, basePath: string) {
  if (item.exact) return basePath
  return `${basePath}${item.href}`
}

function itemIsActive(pathname: string, href: string, exact?: boolean) {
  return exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`)
}

function NavList({
  items,
  basePath,
  label,
  className,
}: {
  items: NavItem[]
  basePath: string
  label?: string
  className?: string
}) {
  const pathname = usePathname()
  return (
    <SidebarGroup className={cn(className)}>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarMenu>
        {items.map((item) => {
          const href = resolveHref(item, basePath)
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                isActive={itemIsActive(pathname, href, item.exact)}
                tooltip={item.title}
                render={<Link href={href} />}
              >
                <HugeiconsIcon icon={item.icon} size={16} />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

export function NavMain({ basePath }: { basePath: string }) {
  return (
    <>
      {NAV_GROUPS.map((group) => (
        <NavList
          key={group.label}
          items={group.items}
          basePath={basePath}
          label={group.label}
        />
      ))}
    </>
  )
}
