// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { AnalystsView } from "@/components/dashboard/analysts-view"
import { SeatGatePanel } from "@/components/dashboard/analysts/seat-gate-panel"
import type { SeatEvidenceView } from "@/lib/dal"

/**
 * Plan 024, step 6. Two of these cases are load-bearing beyond line coverage:
 *
 * - **The public /demo/analysts route must be untouched.** Both routes render
 *   the same `AnalystsView`; the only thing separating them is one optional
 *   prop. "Absent ⇒ no panel" is the regression guard for a public surface.
 * - **`ic: null` never renders as a number.** `null` means *unmeasurable*;
 *   printing `0.00` would state "measured, no edge", a different and false
 *   claim.
 */

afterEach(cleanup)

const SHADOW_SEAT: SeatEvidenceView = {
  runId: "5f2f0d1e-0000-4000-8000-000000000001",
  runLabel: "5f2f0d1e-0000-4000-8000-000000000001",
  asOfRange: { from: "2020-01-01", to: "2020-12-31" },
  // A real benchmark, so the IC row is allowed to speak.
  benchmark: { securityId: "US-XNAS-BNCH", isProxy: false },
  analysts: [
    {
      analystId: "llm.value",
      state: "shadow",
      observations: 12,
      ic: null,
      abstentionRate: 0.084,
      reasons: [
        {
          code: "out-of-sample",
          ok: false,
          detail:
            "evidence is in-sample — a seat is never promoted on the data it was designed against",
        },
        {
          code: "min-observations",
          ok: false,
          detail: "12 resolved observation(s) vs. min 30 (4 unresolved)",
        },
        {
          code: "information-coefficient",
          ok: false,
          detail:
            "information coefficient unmeasurable (constant conviction or too few observations) vs. floor 0.0200",
        },
        {
          code: "ic-consistency",
          ok: true,
          detail:
            "no evaluation windows supplied — consistency check skipped (treated as passing)",
        },
        {
          code: "abstention-rate",
          ok: true,
          detail: "abstention rate 0.0840 vs. ceiling 0.8000",
        },
      ],
    },
  ],
}

describe("SeatGatePanel", () => {
  it("renders every failing reason of a shadow seat with its detail verbatim", () => {
    render(<SeatGatePanel evidence={SHADOW_SEAT} />)

    expect(screen.getByText("SHADOW")).toBeTruthy()
    expect(screen.getByText("llm.value")).toBeTruthy()

    for (const reason of SHADOW_SEAT.analysts[0]!.reasons) {
      expect(screen.getByText(reason.code)).toBeTruthy()
      expect(screen.getByText(reason.detail)).toBeTruthy()
    }
  })

  it("names the source run and its range", () => {
    render(<SeatGatePanel evidence={SHADOW_SEAT} />)

    expect(screen.getByText(SHADOW_SEAT.runLabel)).toBeTruthy()
    expect(screen.getByText(/2020-01-01\s*→\s*2020-12-31/)).toBeTruthy()
  })

  it("renders an unmeasurable IC as text, never as 0 or NaN", () => {
    const { container } = render(<SeatGatePanel evidence={SHADOW_SEAT} />)

    expect(screen.getByText("unmeasurable")).toBeTruthy()
    // The whole point: no number stands in for "we could not measure this".
    expect(container.textContent).not.toMatch(/\bNaN\b/)
    expect(container.textContent).not.toMatch(/coefficient\s*0[.,]0+/i)
  })

  /**
   * A *measured* seat over a proxy benchmark — the case suppression exists for.
   * The reasons match `ic: 0.42` exactly as `evaluateSeat` would have formatted
   * them, including the `information-coefficient` detail that embeds the value.
   * An internally impossible fixture (an "unmeasurable" detail next to a numeric
   * IC) cannot detect a leak through the reason trail, which is how one shipped.
   */
  const MEASURED_PROXY_SEAT: SeatEvidenceView = {
    ...SHADOW_SEAT,
    benchmark: { securityId: "US-XNAS-SYNA", isProxy: true },
    analysts: [
      {
        ...SHADOW_SEAT.analysts[0]!,
        observations: 48,
        ic: 0.42,
        reasons: [
          {
            code: "out-of-sample",
            ok: false,
            detail:
              "evidence is in-sample — a seat is never promoted on the data it was designed against",
          },
          {
            code: "min-observations",
            ok: true,
            detail: "48 resolved observation(s) vs. min 30 (2 unresolved)",
          },
          {
            code: "information-coefficient",
            ok: true,
            detail: "information coefficient 0.4200 vs. floor 0.0200",
          },
          {
            code: "ic-consistency",
            ok: true,
            detail:
              "no evaluation windows supplied — consistency check skipped (treated as passing)",
          },
          {
            code: "abstention-rate",
            ok: true,
            detail: "abstention rate 0.0840 vs. ceiling 0.8000",
          },
        ],
      },
    ],
  }

  it("suppresses the IC on every surface when the benchmark is a proxy", () => {
    const { container } = render(<SeatGatePanel evidence={MEASURED_PROXY_SEAT} />)

    // Substring assertions, not element-text ones, and first: `queryByText`
    // matches whole element text, so a leak embedded in a longer detail string
    // sails past it — which is how one shipped.
    expect(container.textContent).not.toContain(
      "information coefficient 0.4200 vs. floor 0.0200"
    )
    expect(container.textContent).not.toContain("0.4200")
    expect(container.textContent).not.toContain("0.42")
    // `innerHTML`, so a value hidden in a title/aria-label/tooltip attribute
    // counts as present. "Not rendered as a <dd>" is not "not in the DOM".
    expect(container.innerHTML).not.toContain("0.42")

    // Both surfaces that could carry it: the stat and the reason row.
    expect(
      screen.getAllByText("not meaningful — no benchmark in fixture data")
    ).toHaveLength(2)
  })

  it("still renders every other reason detail verbatim under a proxy", () => {
    render(<SeatGatePanel evidence={MEASURED_PROXY_SEAT} />)

    for (const reason of MEASURED_PROXY_SEAT.analysts[0]!.reasons) {
      expect(screen.getByText(reason.code)).toBeTruthy()
      if (reason.code === "information-coefficient") continue
      expect(screen.getByText(reason.detail)).toBeTruthy()
    }
  })

  it("renders an active seat with its passing checks", () => {
    render(
      <SeatGatePanel
        evidence={{
          ...SHADOW_SEAT,
          analysts: [
            {
              ...SHADOW_SEAT.analysts[0]!,
              analystId: "quant.momentum",
              state: "active",
              ic: 0.0731,
              reasons: [
                { code: "out-of-sample", ok: true, detail: "evidence is out-of-sample" },
              ],
            },
          ],
        }}
      />
    )

    expect(screen.getByText("ACTIVE")).toBeTruthy()
    expect(screen.getByText("0.0731")).toBeTruthy()
  })
})

describe("AnalystsView seat-gate prop", () => {
  it("renders no seat-gate panel without the prop — the public /demo route", () => {
    const { container } = render(<AnalystsView />)

    expect(container.querySelector('[data-slot="seat-gate-panel"]')).toBeNull()
    // The demo's mock roster is untouched and still the only thing on screen.
    expect(screen.getByRole("heading", { name: "Analysts" })).toBeTruthy()
  })

  it("renders the panel when the prop is supplied — the dashboard route", () => {
    const { container } = render(<AnalystsView seatEvidence={SHADOW_SEAT} />)

    expect(
      container.querySelector('[data-slot="seat-gate-panel"]')
    ).not.toBeNull()
    expect(screen.getByText("llm.value")).toBeTruthy()
  })
})
