import { DECISION_FUNNEL } from "@/components/dashboard/demo-data"
import { RevealOnScroll } from "@/components/landing/reveal"

// The four figures the brief calls out, drawn straight from the demo funnel so
// the strip can never drift from the dataset: views formed, views with enough
// evidence, decisions changed by safety, and executed trades. (The funnel's
// "combined decisions" step is left out to keep the band to four.)
const FIGURES = [
  DECISION_FUNNEL[0]!,
  DECISION_FUNNEL[1]!,
  DECISION_FUNNEL[3]!,
  DECISION_FUNNEL[4]!,
]

/**
 * Evidence strip — a slim, full-width band of four real figures from the public
 * demo dataset. Distinct from every other section: no cards, just numerals on
 * hairline-divided cells. Figures are mono + tabular so they read as exact.
 */
export function EvidenceStrip() {
  return (
    <RevealOnScroll className="border-y border-foreground/10 bg-card/40">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <dl className="grid grid-cols-2 divide-foreground/10 sm:grid-cols-4 sm:divide-x">
          {FIGURES.map((figure) => (
            <div
              key={figure.label}
              className="flex flex-col gap-1 px-0 py-3 sm:items-center sm:px-4 sm:py-0 sm:text-center"
            >
              <dt className="font-mono text-2xl font-semibold text-foreground tabular-nums sm:text-3xl">
                {figure.value}
              </dt>
              <dd className="text-sm text-muted-foreground">{figure.label}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-xs text-muted-foreground">
          From the public demo dataset.
        </p>
      </div>
    </RevealOnScroll>
  )
}
