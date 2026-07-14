"use client"

import "./canvas-reveal.css"

import * as React from "react"

import type { DecisionMap } from "@/components/dashboard/decision-map/data"
import { DecisionCanvas } from "@/components/dashboard/decision-map/decision-canvas"

/**
 * Defers the decision-map's one-time entrance stagger until the canvas first
 * scrolls into view. On the landing page the canvas sits below the fold, so
 * playing the stagger on mount wastes it — a visitor scrolls down to a graph that
 * has already assembled. A one-shot IntersectionObserver flips the canvas'
 * `entrance` gate on once the card is ~25% visible; above-the-fold viewports
 * (where the canvas is already visible on load) trigger it immediately. Plays
 * once, never replays.
 *
 * Reduced motion is handled upstream — the entrance keyframe lives in a
 * `prefers-reduced-motion: no-preference` block (decision-flow.css) — so a static
 * canvas never depends on the scroll trigger.
 */
export function CanvasReveal({ map }: { map: DecisionMap }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref}>
      <DecisionCanvas map={map} entrance={revealed} />
    </div>
  )
}
