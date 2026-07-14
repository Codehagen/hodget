import type * as React from "react"
import Link from "next/link"

import { RevealOnScroll } from "@/components/landing/reveal"

/**
 * "How it works" — a vertical numbered walkthrough of the five questions a
 * decision answers, in order, joined by a connecting line. Copy mirrors the
 * decision-map stage headers and the "Reading the decision map" post. The steps
 * rise in a staggered wave on first view (RevealOnScroll stagger); the decision
 * tree itself now lives in the hero, so this section is pure narrative.
 */
const STEPS = [
  {
    question: "What did we know?",
    body: "Every decision starts from a point-in-time snapshot: the prices, fundamentals, and policy in force at that moment, with nothing from the future leaking in.",
  },
  {
    question: "What did advisors think?",
    body: "A committee of AI advisors reads that snapshot independently, and each forms its own view with a direction, a conviction, and a thesis.",
  },
  {
    question: "How were views combined?",
    body: "The committee weighs those views into one net position and records which advisors it included and which it set aside.",
  },
  {
    question: "What did safety change?",
    body: "A deterministic risk gate sizes the position and applies hard limits, clipping a target down or vetoing it outright.",
  },
  {
    question: "What was executed?",
    body: "If the position survives the gate it trades and the fill is recorded; if it never traded, there is nothing to show.",
  },
]

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6"
    >
      <div className="max-w-2xl">
        <h2 className="text-balance font-heading text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          How it works
        </h2>
        <p className="mt-3 text-lg text-muted-foreground">
          One position, five questions, answered in order.
        </p>
      </div>

      <RevealOnScroll stagger className="mt-12 max-w-2xl">
        <ol className="flex flex-col">
          {STEPS.map((step, i) => (
            <li
              key={step.question}
              className="reveal-stagger-item relative flex gap-5 pb-10 last:pb-0"
              style={{ "--reveal-index": i } as React.CSSProperties}
            >
              {i < STEPS.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute top-8 bottom-0 left-3.5 w-px -translate-x-1/2 bg-border"
                />
              ) : null}
              <span className="relative z-10 flex size-7 shrink-0 items-center justify-center bg-foreground font-heading text-sm font-black text-background tabular-nums">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1.5 pt-0.5">
                <h3 className="font-heading text-lg font-bold tracking-tight text-foreground">
                  {step.question}
                </h3>
                <p className="text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div
          className="reveal-stagger-item mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 pl-12 text-sm"
          style={{ "--reveal-index": STEPS.length } as React.CSSProperties}
        >
          <Link
            href="/blog/reading-the-decision-map"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Read how the decision map works
          </Link>
          <Link
            href="/demo/decisions"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            See it live
          </Link>
        </div>
      </RevealOnScroll>
    </section>
  )
}
