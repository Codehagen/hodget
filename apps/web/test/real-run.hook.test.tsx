// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  useRealRun,
  type EventSourceLike,
} from "@/components/dashboard/live-run/real-run"

/**
 * The real engine data source (plan 005 seam). Drives the POST → SSE lifecycle
 * with a mocked fetch and an injected fake EventSource, asserting it folds the
 * live events into the shared dialog state and handles every failure path: a
 * failed event, an auth (401) rejection, a dropped stream (recovering the run's
 * persisted completed/failed/running status, and an auth 401 during recovery),
 * the readyState-gated onerror (transient reconnects ignored), and the epoch
 * guard (a reset during an in-flight POST lands no state).
 */

/** A controllable stand-in for the browser EventSource. */
class FakeEventSource implements EventSourceLike {
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: ((ev: unknown) => void) | null = null
  // 0 CONNECTING · 1 OPEN · 2 CLOSED — tests set this before calling fail().
  readyState = 0
  closed = false
  readonly url: string

  constructor(url: string) {
    this.url = url
  }

  close() {
    this.closed = true
    this.readyState = 2
  }

  emit(event: unknown) {
    this.onmessage?.({ data: JSON.stringify(event) })
  }

  /** Simulate an error event at the current readyState. */
  fail() {
    this.onerror?.({})
  }
}

/** A Response-like object for the mocked fetch. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

const RUN_ID = "run_abc123"

const COMPLETED_METRICS = {
  sharpe: 1.5,
  annualizedReturn: 0.2, // → cagr 20
  maxDrawdown: 0.08, // → -8
  winRate: 0.6, // → hitRate 60
  turnover: 1.25,
}

const MAPPED_METRICS = {
  sharpe: 1.5,
  cagr: 20,
  maxDrawdown: -8,
  hitRate: 60,
  turnover: 1.25,
}

function setup(fetchImpl: typeof fetch): {
  result: { current: ReturnType<typeof useRealRun> }
  getEventSource: () => FakeEventSource | null
} {
  let created: FakeEventSource | null = null
  const eventSourceFactory = (url: string): EventSourceLike => {
    created = new FakeEventSource(url)
    return created
  }
  const { result } = renderHook(() =>
    useRealRun({ fetchImpl, eventSourceFactory }),
  )
  return { result, getEventSource: () => created }
}

/** A fetch that answers POST /api/runs with 201 and GET /api/runs/:id with the
 * given detail (or throws if no GET body is supplied). */
function fetchFor(getDetail?: (status: number) => unknown, getStatus = 200) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === "/api/runs" && init?.method === "POST") {
      return jsonResponse(201, { id: RUN_ID })
    }
    if (url === `/api/runs/${RUN_ID}` && getDetail) {
      return jsonResponse(getStatus, getDetail(getStatus))
    }
    throw new Error(`unexpected fetch ${url}`)
  }) as unknown as typeof fetch
}

describe("useRealRun", () => {
  it("POSTs a run, streams progress, and finalizes with mapped metrics", async () => {
    const fetchImpl = fetchFor(() => ({
      run: { id: RUN_ID, status: "completed" },
      result: { metrics: COMPLETED_METRICS },
    }))
    const { result, getEventSource } = setup(fetchImpl)

    await act(async () => {
      result.current.start()
    })

    expect(result.current.state.detailRunId).toBe(RUN_ID)
    const es = getEventSource()
    expect(es).not.toBeNull()
    expect(es!.url).toBe(`/api/runs/${RUN_ID}/events`)

    await act(async () => {
      es!.emit({ type: "started", runId: RUN_ID, at: "2025-01-01T00:00:00Z" })
    })
    expect(result.current.state.status).toBe("running")

    await act(async () => {
      es!.emit({ type: "progress", runId: RUN_ID, asOf: "2025-01-02T00:00:00Z", day: 1 })
      es!.emit({ type: "analyst", runId: RUN_ID, analystId: "quant.earnings-drift", securityId: "AAPL", asOf: "2025-01-02T00:00:00Z" })
    })
    expect(result.current.state.day).toBe(1)

    await act(async () => {
      es!.emit({ type: "completed", runId: RUN_ID, at: "2025-01-03T00:00:00Z" })
    })

    await waitFor(() => expect(result.current.state.status).toBe("completed"))
    expect(es!.closed).toBe(true)
    expect(result.current.state.metrics).toEqual(MAPPED_METRICS)
    expect(result.current.state.detailRunId).toBe(RUN_ID)
  })

  it("surfaces a failed event as a run error", async () => {
    const { result, getEventSource } = setup(fetchFor())

    await act(async () => {
      result.current.start()
    })
    const es = getEventSource()!
    await act(async () => {
      es.emit({ type: "failed", runId: RUN_ID, error: "boom", at: "2025-01-01T00:00:00Z" })
    })

    expect(result.current.state.status).toBe("failed")
    expect(result.current.state.error).toEqual({ kind: "run", message: "boom" })
    expect(es.closed).toBe(true)
  })

  it("turns a 401 into an auth error and never opens a stream", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(401, { error: "unauthorized" }),
    ) as unknown as typeof fetch
    const { result, getEventSource } = setup(fetchImpl)

    await act(async () => {
      result.current.start()
    })

    expect(result.current.state.status).toBe("failed")
    expect(result.current.state.error?.kind).toBe("auth")
    expect(getEventSource()).toBeNull()
  })

  it("ignores a transient onerror while the browser is still reconnecting", async () => {
    const fetchImpl = fetchFor(() => ({ run: { id: RUN_ID, status: "running" } }))
    const { result, getEventSource } = setup(fetchImpl)

    await act(async () => {
      result.current.start()
    })
    const es = getEventSource()!
    await act(async () => {
      es.emit({ type: "started", runId: RUN_ID, at: "2025-01-01T00:00:00Z" })
    })
    expect(result.current.state.status).toBe("running")

    // OPEN (1) / CONNECTING (0): the browser will auto-reconnect — do nothing.
    es.readyState = 1
    await act(async () => {
      es.fail()
    })

    expect(result.current.state.status).toBe("running")
    expect(result.current.state.error).toBeNull()
    // No fallback GET fired, and the stream is left attached for reconnect.
    expect(fetchImpl).toHaveBeenCalledTimes(1) // POST only
    expect(es.closed).toBe(false)
  })

  it("recovers a dropped stream (CLOSED) as disconnected when the run is still running", async () => {
    const fetchImpl = fetchFor(() => ({ run: { id: RUN_ID, status: "running" } }))
    const { result, getEventSource } = setup(fetchImpl)

    await act(async () => {
      result.current.start()
    })
    const es = getEventSource()!
    es.readyState = 2 // CLOSED: browser gave up
    await act(async () => {
      es.fail()
    })

    await waitFor(() => expect(result.current.state.status).toBe("disconnected"))
    expect(result.current.state.error?.kind).toBe("connection")
    // Still linkable to the run despite the dropped stream.
    expect(result.current.state.detailRunId).toBe(RUN_ID)
  })

  it("recovers a dropped stream into completed with mapped metrics", async () => {
    const fetchImpl = fetchFor(() => ({
      run: { id: RUN_ID, status: "completed" },
      result: { metrics: COMPLETED_METRICS },
    }))
    const { result, getEventSource } = setup(fetchImpl)

    await act(async () => {
      result.current.start()
    })
    const es = getEventSource()!
    es.readyState = 2
    await act(async () => {
      es.fail()
    })

    await waitFor(() => expect(result.current.state.status).toBe("completed"))
    expect(result.current.state.metrics).toEqual(MAPPED_METRICS)
    expect(result.current.state.error).toBeNull()
  })

  it("recovers a dropped stream into failed from the persisted status", async () => {
    const fetchImpl = fetchFor(() => ({
      run: { id: RUN_ID, status: "failed", error: "risk gate rejected the run" },
    }))
    const { result, getEventSource } = setup(fetchImpl)

    await act(async () => {
      result.current.start()
    })
    const es = getEventSource()!
    es.readyState = 2
    await act(async () => {
      es.fail()
    })

    await waitFor(() => expect(result.current.state.status).toBe("failed"))
    expect(result.current.state.error).toEqual({
      kind: "run",
      message: "risk gate rejected the run",
    })
  })

  it("surfaces an auth error when the dropped-stream fallback returns 401", async () => {
    const fetchImpl = fetchFor(() => ({ error: "unauthorized" }), 401)
    const { result, getEventSource } = setup(fetchImpl)

    await act(async () => {
      result.current.start()
    })
    const es = getEventSource()!
    es.readyState = 2
    await act(async () => {
      es.fail()
    })

    await waitFor(() => expect(result.current.state.error?.kind).toBe("auth"))
    expect(result.current.state.status).toBe("failed")
  })

  it("lands no state when reset() interrupts an in-flight POST (epoch guard)", async () => {
    let resolvePost: ((r: Response) => void) | null = null
    const postPromise = new Promise<Response>((r) => {
      resolvePost = r
    })
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === "/api/runs" && init?.method === "POST") return postPromise
      throw new Error(`unexpected fetch ${url}`)
    }) as unknown as typeof fetch

    const { result, getEventSource } = setup(fetchImpl)

    // POST is pending; the dialog shows queued.
    await act(async () => {
      result.current.start()
    })
    expect(result.current.state.status).toBe("queued")

    // Close/reset the dialog before the POST resolves.
    await act(async () => {
      result.current.reset()
    })
    expect(result.current.state.status).toBe("idle")

    // The POST now resolves under a stale generation: no revival, no stream.
    await act(async () => {
      resolvePost!(jsonResponse(201, { id: RUN_ID }))
      await Promise.resolve()
    })
    expect(result.current.state.status).toBe("idle")
    expect(result.current.state.detailRunId).toBeNull()
    expect(getEventSource()).toBeNull()
  })
})
