// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { LiveRunDialog } from "@/components/dashboard/live-run/live-run-dialog"

// This suite has no global auto-cleanup (vitest globals are off), so unmount
// between tests — Base UI renders the dialog into a body portal that would
// otherwise leak across cases.
afterEach(cleanup)

/**
 * Component smoke for the New run dialog (plan 012): trigger opens the
 * dialog, the honest "scripted replay" framing is present, and Start run
 * flips into the replay UI. Pacing itself is covered by the hook tests.
 *
 * The real-source case (plan 005 seam) drives the dialog end-to-end over a
 * mocked fetch + EventSource — the same dialog, the live data source.
 */

describe("LiveRunDialog — simulated source", () => {
  it("opens from its trigger and discloses the simulation honestly", async () => {
    const user = userEvent.setup()
    render(
      <LiveRunDialog basePath="/demo" trigger={<button>New run</button>} />
    )

    await user.click(screen.getByRole("button", { name: "New run" }))

    expect(await screen.findByText(/scripted replay/i)).toBeTruthy()
    expect(screen.getByText(/Simulated — mock data/i)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Start run" })).toBeTruthy()
  })

  it("starts the replay when Start run is pressed", async () => {
    const user = userEvent.setup()
    render(
      <LiveRunDialog basePath="/demo" trigger={<button>New run</button>} />
    )
    await user.click(screen.getByRole("button", { name: "New run" }))
    await user.click(screen.getByRole("button", { name: "Start run" }))

    // The status strip appears immediately (queued) with the fixture run id.
    expect(await screen.findByText("run_8c41ca")).toBeTruthy()
  })
})

/** Controllable EventSource for the real-source dialog test. */
class FakeEventSource {
  static instances: FakeEventSource[] = []
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: ((ev: unknown) => void) | null = null
  readyState = 0
  closed = false
  constructor(readonly url: string) {
    FakeEventSource.instances.push(this)
  }
  close() {
    this.closed = true
    this.readyState = 2
  }
  emit(event: unknown) {
    this.onmessage?.({ data: JSON.stringify(event) })
  }
}

const REAL_RUN_ID = "run_live01"

describe("LiveRunDialog — real source", () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal("EventSource", FakeEventSource)
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url === "/api/runs" && init?.method === "POST") {
          return {
            ok: true,
            status: 201,
            json: async () => ({ id: REAL_RUN_ID }),
          } as unknown as Response
        }
        if (url === `/api/runs/${REAL_RUN_ID}`) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              run: { id: REAL_RUN_ID, status: "completed" },
              result: {
                metrics: {
                  sharpe: 1.9,
                  annualizedReturn: 0.15,
                  maxDrawdown: 0.07,
                  winRate: 0.58,
                  turnover: 1.1,
                },
              },
            }),
          } as unknown as Response
        }
        throw new Error(`unexpected fetch ${url}`)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("discloses the live source and runs a real run end-to-end over mocked SSE", async () => {
    const user = userEvent.setup()
    render(
      <LiveRunDialog
        basePath="/dashboard"
        source="real"
        trigger={<button>New run</button>}
      />
    )

    await user.click(screen.getByRole("button", { name: "New run" }))
    expect(screen.getByText(/Live — real engine/i)).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Start run" }))

    // POST resolves, the run id lands in the status strip, and the stream opens.
    expect(await screen.findByText(REAL_RUN_ID)).toBeTruthy()
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1))
    const es = FakeEventSource.instances[0]!
    expect(es.url).toBe(`/api/runs/${REAL_RUN_ID}/events`)

    await act(async () => {
      es.emit({ type: "started", runId: REAL_RUN_ID, at: "2025-01-01T00:00:00Z" })
      es.emit({ type: "progress", runId: REAL_RUN_ID, asOf: "2025-01-02T00:00:00Z", day: 1 })
      es.emit({ type: "completed", runId: REAL_RUN_ID, at: "2025-01-03T00:00:00Z" })
    })

    // Terminal state renders, with the persisted metrics and a link to the run.
    // (The Button+Link composition renders an anchor without an implicit link
    // role, so assert on its text + href rather than role.)
    expect(await screen.findByText("Completed")).toBeTruthy()
    const link = (await screen.findByText(/View full run/i)).closest("a")
    expect(link?.getAttribute("href")).toBe(`/dashboard/runs/${REAL_RUN_ID}`)
    expect(await screen.findByText("+15.0%")).toBeTruthy() // CAGR from mapped metrics (0.15 → +15.0%)
    expect(es.closed).toBe(true)
  })
})
