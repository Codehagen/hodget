import Link from "next/link"

/**
 * Static explainer for the "How it works" tab on the landing page — the five
 * questions the decision map answers, in order. Copy mirrors the decision-map
 * stage headers (components/dashboard/decision-map/layout.ts) and the tone of
 * the "Reading the decision map" blog post. Server-renderable; no motion.
 */
const STEPS = [
  {
    question: "What did we know?",
    body: "Every decision starts from a point-in-time snapshot — the prices, fundamentals, and policy in force at that moment, with nothing from the future leaking in.",
  },
  {
    question: "What did advisors think?",
    body: "A committee of AI analysts reads that snapshot independently. Each forms its own view — a direction, a conviction, and a thesis — without seeing the others.",
  },
  {
    question: "How were views combined?",
    body: "The committee weighs those views into one net position, and records exactly which analysts it included and which it set aside.",
  },
  {
    question: "What did safety change?",
    body: "A deterministic risk gate sizes the position and applies hard limits. It can clip a target down or veto it outright — and the map shows the change directly, like a target cut from 8.50% to 6.00%.",
  },
  {
    question: "What was executed?",
    body: "If the position survives the gate, it trades and the fill is recorded. If it never traded, there's no execution to show — and the map simply doesn't draw one.",
  },
]

export function HowItWorks() {
  return (
    <div className="flex flex-col gap-8">
      <ol className="flex flex-col gap-6">
        {STEPS.map((step, i) => (
          <li key={step.question} className="flex gap-4">
            <span className="flex size-7 shrink-0 items-center justify-center bg-foreground font-heading text-sm font-black tabular-nums text-background">
              {i + 1}
            </span>
            <div className="flex flex-col gap-1 pt-0.5">
              <h3 className="font-heading text-base font-bold tracking-tight text-foreground">
                {step.question}
              </h3>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-4 border-t border-border pt-6">
        <p className="max-w-2xl text-sm text-foreground">
          Views are opinions. Deterministic code sizes positions, applies safety
          limits, and records fills.
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Link
            href="/blog/reading-the-decision-map"
            className="font-medium text-foreground hover:underline"
          >
            Reading the decision map →
          </Link>
          <Link
            href="/demo/decisions"
            className="font-medium text-foreground hover:underline"
          >
            See it in the product →
          </Link>
        </div>
      </div>
    </div>
  )
}
