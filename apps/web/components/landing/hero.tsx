import Link from "next/link"

import { Button } from "@workspace/ui/components/button"

import {
  DEFAULT_TODAY_ID,
  getTodayDecisionMap,
} from "@/components/dashboard/decision-map/data"
import { CanvasReveal } from "@/components/landing/canvas-reveal"
import { IntroGate } from "@/components/landing/intro-gate"

const map = getTodayDecisionMap(DEFAULT_TODAY_ID)!

/**
 * Hero — asymmetric split with left-aligned copy and the live decision map as
 * the flagship on the right. The map is the real interactive product component
 * (CanvasReveal + DecisionCanvas), framed with a hairline ring; its canvas
 * region has a fixed height so the block reserves its space on first paint and
 * never shifts. The text keeps the one-shot IntroGate entrance.
 */
export function Hero() {
  return (
    <section className="mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col justify-center px-4 pt-24 pb-16 sm:px-6">
      <div className="grid items-center gap-12 xl:grid-cols-[42fr_58fr] xl:gap-16">
        <IntroGate className="flex flex-col items-start gap-6">
          <h1 className="max-w-xl text-balance font-heading text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            The fund that can explain every trade.
          </h1>
          <p className="max-w-md text-lg text-muted-foreground">
            hodget forms views with AI advisors, then deterministic code sizes,
            limits, and records every decision.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" render={<Link href="/waitlist" />}>
              Join the waitlist
            </Button>
            <Button variant="outline" size="lg" render={<Link href="/demo" />}>
              Explore the demo
            </Button>
          </div>
        </IntroGate>

        <div className="min-w-0 rounded-none bg-card p-3 ring-1 ring-foreground/10 sm:p-4">
          <CanvasReveal map={map} />
        </div>
      </div>
    </section>
  )
}
