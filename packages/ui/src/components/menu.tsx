"use client"

import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@workspace/ui/lib/utils"

const Menu = MenuPrimitive.Root
const MenuTrigger = MenuPrimitive.Trigger
const MenuGroup = MenuPrimitive.Group
const MenuSub = MenuPrimitive.SubmenuRoot

/**
 * Sharp-styled Base UI Menu. Base UI's CheckboxItem keeps the menu open on
 * toggle by default (no Radix `onSelect preventDefault` hack), which is exactly
 * what the multi-select Filter menu needs. Enter/exit uses our motion tokens.
 */
const popupClass = cn(
  "z-50 min-w-[220px] origin-(--transform-origin) rounded-none border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
  "transition-[opacity,transform] duration-[var(--duration-fast)] ease-out-quart",
  "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
  "data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:duration-[var(--duration-instant)]"
)

function MenuContent({
  className,
  sideOffset = 6,
  align = "start",
  side,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Popup> & {
  sideOffset?: number
  align?: "start" | "center" | "end"
  side?: "top" | "bottom" | "left" | "right"
}) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        sideOffset={sideOffset}
        align={align}
        side={side}
        className="z-50"
      >
        <MenuPrimitive.Popup className={cn(popupClass, className)} {...props} />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

const itemBase =
  "flex cursor-default items-center gap-2 rounded-none px-2.5 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-muted data-[highlighted]:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"

function MenuItem({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item>) {
  return (
    <MenuPrimitive.Item className={cn(itemBase, className)} {...props} />
  )
}

function MenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.CheckboxItem>) {
  return (
    <MenuPrimitive.CheckboxItem
      closeOnClick={false}
      className={cn(itemBase, "relative py-1.5 pr-2.5 pl-7", className)}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <MenuPrimitive.CheckboxItemIndicator>
          <svg viewBox="0 0 14 14" fill="none" className="size-3.5" aria-hidden>
            <path
              d="M11.5 4L5.75 10L2.5 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

function MenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubmenuTrigger>) {
  return (
    <MenuPrimitive.SubmenuTrigger
      className={cn(
        itemBase,
        "justify-between data-[popup-open]:bg-muted",
        className
      )}
      {...props}
    >
      {children}
      <svg viewBox="0 0 16 16" fill="none" className="size-3.5 text-muted-foreground" aria-hidden>
        <path
          d="M6 4l4 4-4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </MenuPrimitive.SubmenuTrigger>
  )
}

function MenuGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.GroupLabel>) {
  return (
    <MenuPrimitive.GroupLabel
      className={cn(
        "px-2.5 py-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase",
        className
      )}
      {...props}
    />
  )
}

function MenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuSub,
  MenuSubTrigger,
  MenuSeparator,
}
