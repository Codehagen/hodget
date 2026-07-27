import { HugeiconsIcon } from "@hugeicons/react"
import { CancelCircleIcon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@workspace/ui/lib/utils"

import type { SeatAnalystView, SeatEvidenceView } from "@/lib/dal"

import { CaveatBanner, StatusPill, type StatusName } from "../primitives"

/**
 * The seat gate on the analysts surface (plan 024, step 4).
 *
 * What this panel shows is the **reason trail**, not the number. A computed
 * figure on a screen reads as a measurement even behind a badge, because it
 * changes when you rerun; an IC computed over synthetic fixtures is a fact about
 * the fixture generator, and presenting it as edge is exactly the credibility
 * liability the promotion gate was written to avoid. The reason trail is true
 * regardless of data quality — "this seat has not earned its place, and here are
 * the checks that say so" — so that is what leads.
 *
 * Two rendering rules here are correctness, not style:
 *
 * - **`ic: null` is *unmeasurable*, and renders as text.** Printing `0.00` would
 *   state "measured, no edge", which is a different and false claim.
 * - **A proxy benchmark suppresses the IC entirely** (design decision 6). The
 *   fixture dataset has no benchmark index, so alpha is excess return over
 *   another portfolio name rather than over a market. Observation counts,
 *   abstention rates and the reason trail are all still true and still render;
 *   only the IC is withheld, because a number that cannot be honest should not
 *   be printed. That includes the `information-coefficient` check's own detail
 *   string, which embeds the value — see {@link displayedReasons}.
 *
 * Purely presentational and directive-free, like `primitives.tsx` — it inherits
 * the client boundary from `AnalystsView` and would render on the server just as
 * happily.
 */

/**
 * Seat state on the shared status vocabulary rather than a one-off badge.
 * `shadow` maps to the neutral chip on purpose: a seat that has not earned
 * weight is a normal, expected condition, not a warning.
 */
const SEAT_STATUS: Record<SeatAnalystView["state"], StatusName> = {
  active: "live",
  shadow: "draft",
}

/** The one check whose detail embeds the IC value the panel must not print. */
const IC_CHECK_CODE = "information-coefficient"

/** What stands in for the IC — and for its reason detail — over a proxy benchmark. */
const PROXY_IC_TEXT = "not meaningful — no benchmark in fixture data"

/**
 * The reason trail as it may be shown.
 *
 * Details are the engine's own strings and render verbatim — with exactly one
 * exception. `evaluateSeat` formats the `information-coefficient` detail as
 * `information coefficient 0.1732 vs. floor 0.0200`, so rendering it verbatim
 * under a proxy benchmark prints the number the panel says two rows below was
 * withheld: a card that contradicts itself, and it does so precisely in the case
 * suppression exists for (`ic !== null`).
 *
 * Substituting here rather than at the point of render is deliberate. The
 * suppressed string is what every surface receives — text, `title`,
 * `aria-label`, any tooltip or expanded view a later change adds — so there is
 * no second place to remember. "Not rendered as a `<dd>`" was never the same as
 * "not present in the DOM".
 */
function displayedReasons(
  analyst: SeatAnalystView,
  isProxyBenchmark: boolean,
): readonly SeatAnalystView["reasons"][number][] {
  if (!isProxyBenchmark) return analyst.reasons
  return analyst.reasons.map((reason) =>
    reason.code === IC_CHECK_CODE ? { ...reason, detail: PROXY_IC_TEXT } : reason
  )
}

export function SeatGatePanel({ evidence }: { evidence: SeatEvidenceView }) {
  return (
    <section
      data-slot="seat-gate-panel"
      aria-labelledby="seat-gate-heading"
      className="flex flex-col rounded-none bg-card ring-1 ring-foreground/10"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-3.5">
        <div className="flex flex-col gap-1">
          <h2
            id="seat-gate-heading"
            className="text-sm font-semibold text-foreground"
          >
            Seat gate
          </h2>
          {/* Only what the data supports: the roster comes from the signals the
              run recorded, not from the configured panel, so an analyst that
              emitted none is absent rather than shown as unproven. And the
              checks are whatever the engine returned — the count is not copy. */}
          <p className="text-xs text-muted-foreground">
            Scored from the signals your last completed run recorded, so an
            analyst that emitted none — or none this layer can score — does not
            appear here. A seat earns weight on evidence or stays in shadow.
          </p>
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>Run</span>
          <span className="font-mono text-foreground">{evidence.runLabel}</span>
          <span className="font-mono tabular-nums">
            {evidence.asOfRange.from} → {evidence.asOfRange.to}
          </span>
        </p>
      </div>

      <div className="flex flex-col">
        {evidence.analysts.length === 0 ? (
          <p className="p-3.5 text-xs text-muted-foreground">
            This run recorded no scorable analyst signals, so there is nothing to
            score.
          </p>
        ) : (
          evidence.analysts.map((analyst) => (
            <SeatRow
              key={analyst.analystId}
              analyst={analyst}
              isProxyBenchmark={evidence.benchmark.isProxy}
            />
          ))
        )}
      </div>

      <div className="p-3.5 pt-0">
        <CaveatBanner>
          Computed on read from the committed synthetic fixture dataset, over
          this run only and with no walk-forward split — so the evidence is
          in-sample and no seat can be promoted on it. These figures describe the
          fixture generator, not market edge.
          {evidence.benchmark.isProxy ? (
            <>
              {" "}
              The dataset carries no benchmark index, so{" "}
              <span className="font-mono">{evidence.benchmark.securityId}</span>{" "}
              stands in as a proxy and the information coefficient is withheld
              rather than printed.
            </>
          ) : null}
        </CaveatBanner>
      </div>
    </section>
  )
}

function SeatRow({
  analyst,
  isProxyBenchmark,
}: {
  analyst: SeatAnalystView
  isProxyBenchmark: boolean
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border p-3.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-sm font-semibold text-foreground">
          {analyst.analystId}
        </span>
        <StatusPill
          status={SEAT_STATUS[analyst.state]}
          label={analyst.state === "active" ? "ACTIVE" : "SHADOW"}
        />
      </div>

      {/* The reason trail — the product. Details are the engine's own strings,
          which already name the observed value against the threshold, so they
          render verbatim rather than reformatted — with the one documented
          exception `displayedReasons` owns. */}
      <ul className="flex flex-col gap-1.5">
        {displayedReasons(analyst, isProxyBenchmark).map((reason) => (
          <li key={reason.code} className="flex items-start gap-2 text-xs">
            <HugeiconsIcon
              icon={reason.ok ? CheckmarkCircle02Icon : CancelCircleIcon}
              size={14}
              strokeWidth={2}
              aria-hidden
              className={cn(
                "mt-px shrink-0",
                reason.ok ? "text-success" : "text-muted-foreground"
              )}
            />
            <span className="sr-only">{reason.ok ? "Passed" : "Failed"}</span>
            <span className="w-44 shrink-0 font-mono text-foreground">
              {reason.code}
            </span>
            <span className="min-w-0 flex-1 text-muted-foreground">
              {reason.detail}
            </span>
          </li>
        ))}
      </ul>

      {/* Secondary, and deliberately so. */}
      <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-border pt-2.5">
        <SeatStat label="Observations">
          <span className="font-mono tabular-nums">{analyst.observations}</span>
        </SeatStat>
        <SeatStat label="Information coefficient">
          {isProxyBenchmark ? (
            <span className="text-muted-foreground">{PROXY_IC_TEXT}</span>
          ) : analyst.ic === null ? (
            // Never a number: `null` means unmeasurable, and `0.00` would claim
            // the opposite — measured, no edge.
            <span className="text-muted-foreground">unmeasurable</span>
          ) : (
            <span className="font-mono tabular-nums">
              {analyst.ic.toFixed(4)}
            </span>
          )}
        </SeatStat>
        <SeatStat label="Abstention rate">
          <span className="font-mono tabular-nums">
            {(analyst.abstentionRate * 100).toFixed(1)}%
          </span>
        </SeatStat>
      </dl>
    </div>
  )
}

function SeatStat({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  )
}
