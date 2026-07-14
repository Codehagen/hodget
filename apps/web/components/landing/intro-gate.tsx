"use client"

import "./intro-gate.css"

import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * Plays the hero intro (`slide-up-fade`) once per full page load, then suppresses
 * it on any later client navigation back to the page — Design.md's rule that
 * marketing intros run once and never replay on back-nav.
 *
 * The "has played" flag is module-scoped, so it survives client navigations but
 * resets on a full reload (the intro plays again on hard reload, as intended). It
 * is read in a `useState` initializer so a re-mounted (back-nav) instance renders
 * already-suppressed before first paint — no post-paint flash. On the initial
 * server render + hydration the flag is `false` on both sides (a fresh module),
 * so the markup matches and there is no hydration mismatch.
 *
 * The flag is flipped in an effect rather than on `animationend`: in dev the CSS
 * animation can finish before hydration attaches a React handler, so an
 * `onAnimationEnd` would be missed and the intro would replay. The effect always
 * runs post-mount. It is deferred a tick and cleaned up so React Strict-Mode's
 * throwaway first mount (immediately unmounted) never marks it played early —
 * otherwise the real mount would suppress the very first play.
 *
 * `data-intro="seen"` nulls the keyframe via intro-gate.css, mirroring the
 * decisions-view entrance-gate precedent (`data-entrance`).
 */
let played = false

export function IntroGate({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const [suppressed] = React.useState(() => played)

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      played = true
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div
      className={cn("hero-intro motion-safe:animate-slide-up-fade", className)}
      data-intro={suppressed ? "seen" : "play"}
    >
      {children}
    </div>
  )
}
