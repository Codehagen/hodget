import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Route-handler tests for the durable branch of GET /api/runs/[id]/events
 * (plan 016) — previously zero coverage. Standalone from api-auth.test.ts so
 * `isTerminal` can keep its real (simple) semantics instead of the blanket
 * `vi.fn()` stub that file uses for its own, unrelated assertions.
 */

const getSession = vi.fn()
const getOwnedRun = vi.fn()
const getReadable = vi.fn()
const getRun = vi.fn()

vi.mock("@/lib/session", () => ({ getSession: (...a: unknown[]) => getSession(...a) }))

vi.mock("@/lib/dal", () => ({
  getOwnedRun: (...a: unknown[]) => getOwnedRun(...a),
  runRegistry: { get: vi.fn() },
  isTerminal: (e: { type: string }) => e.type === "completed" || e.type === "failed",
}))

vi.mock("workflow/api", () => ({ getRun: (...a: unknown[]) => getRun(...a) }))

import * as eventsRoute from "@/app/api/runs/[id]/events/route"
import type { RunEvent } from "@/lib/dal"

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const req = (url: string, headers?: Record<string, string>) => new Request(url, { headers })

/** A ReadableStream that emits the given events then closes. */
function sourceOf(events: RunEvent[]): ReadableStream<RunEvent> {
  return new ReadableStream<RunEvent>({
    start(controller) {
      for (const e of events) controller.enqueue(e)
      controller.close()
    },
  })
}

async function readBody(res: Response): Promise<string> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let out = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value)
  }
  return out
}

const session = { user: { id: "user-1" } }

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue(session)
})

describe("GET /api/runs/[id]/events — durable branch (plan 016)", () => {
  it("happy path: getReadable is called with the clamped index and frames match the stubbed events", async () => {
    getOwnedRun.mockResolvedValue({ id: "r1", workflowRunId: "wf-1", status: "running" })
    const events: RunEvent[] = [
      { type: "started", runId: "r1", at: "t0" },
      { type: "completed", runId: "r1", at: "t9" },
    ]
    getReadable.mockReturnValue(sourceOf(events))
    getRun.mockReturnValue({ getReadable })

    const res = await eventsRoute.GET(req("http://localhost/api"), params("r1"))
    expect(res.status).toBe(200)
    expect(getRun).toHaveBeenCalledWith("wf-1")
    expect(getReadable).toHaveBeenCalledWith({ startIndex: 0 })

    const body = await readBody(res)
    expect(body).toContain('id: 0\ndata: {"type":"started","runId":"r1","at":"t0"}\n\n')
    expect(body).toContain('id: 1\ndata: {"type":"completed","runId":"r1","at":"t9"}\n\n')
  })

  it("Last-Event-ID: 7 header resumes from getReadable({ startIndex: 8 })", async () => {
    getOwnedRun.mockResolvedValue({ id: "r1", workflowRunId: "wf-1", status: "running" })
    getReadable.mockReturnValue(sourceOf([]))
    getRun.mockReturnValue({ getReadable })

    const res = await eventsRoute.GET(
      req("http://localhost/api", { "Last-Event-ID": "7" }),
      params("r1"),
    )
    expect(res.status).toBe(200)
    expect(getReadable).toHaveBeenCalledWith({ startIndex: 8 })
  })

  it.each([
    ["-5", 0],
    ["not-a-number", 0],
    ["3", 3],
    [undefined, 0],
  ])("?startIndex=%s clamps to %i when no Last-Event-ID header is present", async (param, expected) => {
    getOwnedRun.mockResolvedValue({ id: "r1", workflowRunId: "wf-1", status: "running" })
    getReadable.mockReturnValue(sourceOf([]))
    getRun.mockReturnValue({ getReadable })

    const url =
      param === undefined
        ? "http://localhost/api"
        : `http://localhost/api?startIndex=${encodeURIComponent(param)}`
    const res = await eventsRoute.GET(req(url), params("r1"))
    expect(res.status).toBe(200)
    expect(getReadable).toHaveBeenCalledWith({ startIndex: expected })
  })

  it("Last-Event-ID header takes precedence over the startIndex query param", async () => {
    getOwnedRun.mockResolvedValue({ id: "r1", workflowRunId: "wf-1", status: "running" })
    getReadable.mockReturnValue(sourceOf([]))
    getRun.mockReturnValue({ getReadable })

    const res = await eventsRoute.GET(
      req("http://localhost/api?startIndex=100", { "Last-Event-ID": "7" }),
      params("r1"),
    )
    expect(res.status).toBe(200)
    expect(getReadable).toHaveBeenCalledWith({ startIndex: 8 })
  })

  it("falls through to the legacy stream when getRun throws, still returning 200 with the persisted-terminal replay", async () => {
    getOwnedRun.mockResolvedValue({
      id: "r1",
      workflowRunId: "wf-1",
      status: "completed",
      completedAt: "2026-07-13T00:00:00.000Z",
      error: null,
    })
    getRun.mockImplementation(() => {
      throw new Error("world does not know this run")
    })

    const res = await eventsRoute.GET(req("http://localhost/api"), params("r1"))
    expect(res.status).toBe(200)
    const body = await readBody(res)
    expect(body).toContain('"type":"completed"')
    // The legacy path never stamps frame ids.
    expect(body).not.toMatch(/^id: /m)
  })

  it("onEndWithoutTerminal: source ends with no terminal event emits the persisted-status fallback frame", async () => {
    getOwnedRun
      .mockResolvedValueOnce({ id: "r1", workflowRunId: "wf-1", status: "running" })
      // Re-read inside onEndWithoutTerminal, after the durable stream has ended.
      .mockResolvedValueOnce({
        id: "r1",
        status: "completed",
        completedAt: "2026-07-13T00:00:00.000Z",
        error: null,
      })
    getReadable.mockReturnValue(sourceOf([{ type: "started", runId: "r1", at: "t0" }]))
    getRun.mockReturnValue({ getReadable })

    const res = await eventsRoute.GET(req("http://localhost/api"), params("r1"))
    expect(res.status).toBe(200)
    const body = await readBody(res)
    expect(body).toContain('id: 0\ndata: {"type":"started","runId":"r1","at":"t0"}\n\n')
    expect(body).toContain('id: 1\ndata: {"type":"completed","runId":"r1","at":"2026-07-13T00:00:00.000Z"}\n\n')
  })
})
