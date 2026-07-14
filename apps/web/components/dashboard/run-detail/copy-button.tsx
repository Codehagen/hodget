"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon, Copy01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Inline copy affordance for a mono identifier (dataset snapshot, decision id,
 * version snapshots). Flashes a green check for ~1.2s on success, then reverts.
 *
 * Copying is a rare, pointer-initiated action, so a short color/icon swap is the
 * right amount of feedback — the icon change is instant (no transform), keeping
 * it within the reduced-motion allowlist by default.
 */
export function CopyButton({
  value,
  label,
  size = 12,
  className,
}: {
  value: string
  /** Accessible action label; defaults to `Copy <value>`. */
  label?: string
  size?: number
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  function onCopy() {
    void navigator.clipboard?.writeText(value)
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1200)
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={label ?? `Copy ${value}`}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-none text-muted-foreground outline-none transition-colors duration-[var(--duration-instant)] hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring",
        className
      )}
    >
      <HugeiconsIcon
        icon={copied ? CheckmarkCircle02Icon : Copy01Icon}
        size={size}
        className={copied ? "text-success" : undefined}
      />
    </button>
  )
}
