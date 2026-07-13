"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@workspace/ui/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-input px-0.5 outline-none transition-colors duration-[var(--duration-fast)] ease-out-quart focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 data-[checked]:bg-primary disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 translate-x-0 rounded-full bg-background shadow-sm transition-transform duration-[var(--duration-fast)] ease-out-quart data-[checked]:translate-x-4" />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
