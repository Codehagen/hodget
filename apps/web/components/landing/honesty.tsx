import { RevealOnScroll } from "@/components/landing/reveal"

const PRINCIPLES = [
  {
    title: "Point-in-time data",
    body: "Every view is formed only from what was known at that moment, with nothing from the future.",
  },
  {
    title: "Immutable ledger",
    body: "Every fill and every veto is written once to a record that is never edited.",
  },
  {
    title: "Deterministic replay",
    body: "The same inputs always produce the same decisions, so any run can be reproduced exactly.",
  },
]

/**
 * Honesty statement — a quiet, full-width typographic block that draws the line
 * between opinion and code, then names the three properties that keep the engine
 * honest. Columns are separated by hairlines, not boxed as cards.
 */
export function Honesty() {
  return (
    <RevealOnScroll className="border-y border-foreground/10 bg-muted/30">
      <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6">
        <p className="max-w-3xl text-balance font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Views are opinions. Deterministic code sizes positions, applies safety
          limits, and records fills.
        </p>

        <div className="mt-14 grid gap-8 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-foreground/10">
          {PRINCIPLES.map((principle) => (
            <div
              key={principle.title}
              className="flex flex-col gap-2 sm:px-6 sm:first:pl-0"
            >
              <h3 className="font-heading text-base font-bold tracking-tight text-foreground">
                {principle.title}
              </h3>
              <p className="text-muted-foreground">{principle.body}</p>
            </div>
          ))}
        </div>
      </div>
    </RevealOnScroll>
  )
}
