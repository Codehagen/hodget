"use client"

import "./reveal.css"

import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * One-shot scroll reveal for marketing sections. The wrapper mounts hidden
 * (`data-reveal="hidden"`) and a single IntersectionObserver flips it to
 * `"shown"` the first time it enters the viewport, then disconnects — so the
 * reveal plays exactly once and never replays on scroll-back. All motion is
 * CSS (reveal.css) and gated on `prefers-reduced-motion`, so reduced-motion
 * visitors see the content immediately with nothing moving.
 *
 * Two modes:
 * - default: the block fades and rises as a unit.
 * - `stagger`: children marked `reveal-stagger-item` rise in a ~60ms wave;
 *   set `--reveal-index` on each child for its place in the wave.
 *
 * Above-the-fold sections trigger immediately (the observer fires on mount when
 * the element is already visible), so nothing depends on a scroll happening.
 */
export function RevealOnScroll({
  children,
  className,
  stagger = false,
}: {
  children: React.ReactNode
  className?: string
  stagger?: boolean
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [shown, setShown] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn("reveal-on-scroll", stagger && "reveal-stagger", className)}
      data-reveal={shown ? "shown" : "hidden"}
    >
      {children}
    </div>
  )
}
