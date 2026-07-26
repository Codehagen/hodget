// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { RunDetail } from "@/lib/dal"
import { RealRunDetailView } from "@/components/dashboard/run-detail/real-run-detail"

/**
 * The DB-backed real-run detail surface (plan: real runs on /dashboard). Covers
 * the jsonb narrowing (`parseEquityCurve`), the engine→display metric mapping
 * (scale + sign), and the pending/failed empty state. The equity chart is stubbed
 * so the test exercises the detail logic, not recharts.
 */

// Stub the lazily-imported chart: assert only that it receives the parsed curve.
vi.mock("@/components/dashboard/run-equity-chart", () => ({
  RunEquityChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="equity-chart" data-points={data.length} />
  ),
}))

afterEach(cleanup)

const METRICS = {
  sharpe: 1.5,
  annualizedReturn: 0.2, // → CAGR (unused here) but drives the completed guard
  maxDrawdown: 0.08, // positive fraction → displayed as -8.00%
  winRate: 0.6,
  turnover: 1.25,
}

function detail(overrides: {
  status?: string
  error?: string | null
  equityCurve?: unknown
  metrics?: unknown
  decisions?: RunDetail["decisions"]
}): RunDetail {
  return {
    run: {
      id: "run_detail01",
      mode: "backtest",
      status: overrides.status ?? "completed",
      error: overrides.error ?? null,
    },
    result:
      overrides.status && overrides.status !== "completed"
        ? null
        : {
            equityCurve: overrides.equityCurve ?? [
              { date: "2025-01-01", equity: 100_000 },
              { date: "2025-06-01", equity: 110_000 },
            ],
            metrics: overrides.metrics ?? METRICS,
          },
    decisions: overrides.decisions ?? [],
  } as unknown as RunDetail
}

describe("RealRunDetailView", () => {
  it("renders KPIs from a valid curve + mapped metrics, and passes the parsed curve to the chart", async () => {
    render(
      <RealRunDetailView
        basePath="/dashboard"
        detail={detail({
          decisions: [
            {
              decisionId: "d1",
              asOf: "2025-01-02T00:00:00Z",
              signals: [{}, {}],
              orders: [{}],
              gateActions: [{}, {}, {}],
              fills: [{}],
            },
          ] as unknown as RunDetail["decisions"],
        })}
      />,
    )

    // Total return derived from the curve: 100k → 110k = +10.00%.
    expect(screen.getByText("+10.00%")).toBeTruthy()
    expect(screen.getByText("1.50")).toBeTruthy() // Sharpe
    expect(screen.getByText("-8.00%")).toBeTruthy() // maxDrawdown: +fraction → -percent
    expect(screen.getByText("1.25×")).toBeTruthy() // Turnover

    // Decision log row.
    expect(screen.getByText("2025-01-02")).toBeTruthy()

    // Chart received the two narrowed points.
    const chart = await screen.findByTestId("equity-chart")
    expect(chart.getAttribute("data-points")).toBe("2")
  })

  it("degrades without throwing on a malformed equity curve", () => {
    expect(() =>
      render(
        <RealRunDetailView
          basePath="/dashboard"
          detail={detail({ equityCurve: "not-an-array" })}
        />,
      ),
    ).not.toThrow()

    // Empty curve → 0.00% total return, and the chart card is not rendered.
    expect(screen.getByText("0.00%")).toBeTruthy()
    expect(screen.queryByTestId("equity-chart")).toBeNull()
    // Metrics still map from the (valid) metrics payload.
    expect(screen.getByText("1.50")).toBeTruthy()
  })

  it("shows the empty state for a queued run", () => {
    render(
      <RealRunDetailView basePath="/dashboard" detail={detail({ status: "queued" })} />,
    )
    expect(screen.getByText(/No results yet/i)).toBeTruthy()
    expect(screen.getByText(/still queued or executing/i)).toBeTruthy()
  })

  it("shows the failure reason for a failed run", () => {
    render(
      <RealRunDetailView
        basePath="/dashboard"
        detail={detail({ status: "failed", error: "risk gate rejected the run" })}
      />,
    )
    expect(screen.getByText(/No results yet/i)).toBeTruthy()
    expect(
      screen.getByText(/This run failed: risk gate rejected the run/i),
    ).toBeTruthy()
  })
})
