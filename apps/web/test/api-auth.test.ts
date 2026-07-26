import { beforeEach, describe, expect, it, vi } from "vitest"

// The DAL and session helpers are mocked so route handlers can be invoked directly
// in Node without a database or a real better-auth session.
vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
  requireSession: vi.fn(),
}))

vi.mock("@/lib/dal", () => ({
  createRun: vi.fn(),
  listRuns: vi.fn(),
  getRunDetail: vi.fn(),
  getOwnedRun: vi.fn(),
  listPanelConfigs: vi.fn(),
  createPanelConfig: vi.fn(),
  runRegistry: { get: vi.fn() },
  isTerminal: vi.fn(),
  runConfigSchema: { safeParse: vi.fn() },
  panelConfigInputSchema: { safeParse: vi.fn() },
}))

import { getSession } from "@/lib/session"
import { createRun, getOwnedRun, listRuns, runConfigSchema, runRegistry } from "@/lib/dal"

import * as runsRoute from "@/app/api/runs/route"
import * as runRoute from "@/app/api/runs/[id]/route"
import * as eventsRoute from "@/app/api/runs/[id]/events/route"
import * as panelRoute from "@/app/api/panel-configs/route"

const params = (id: string) => ({ params: Promise.resolve({ id }) })
const post = (body: unknown) =>
  new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) })

beforeEach(() => {
  vi.clearAllMocks()
})

describe("route handlers reject unauthenticated requests with 401", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(null)
  })

  it("POST /api/runs", async () => {
    expect((await runsRoute.POST(post({}))).status).toBe(401)
  })

  it("GET /api/runs", async () => {
    expect((await runsRoute.GET()).status).toBe(401)
  })

  it("GET /api/runs/[id]", async () => {
    const res = await runRoute.GET(new Request("http://localhost/api"), params("r1"))
    expect(res.status).toBe(401)
  })

  it("GET /api/runs/[id]/events", async () => {
    const res = await eventsRoute.GET(new Request("http://localhost/api"), params("r1"))
    expect(res.status).toBe(401)
  })

  it("GET /api/panel-configs", async () => {
    expect((await panelRoute.GET()).status).toBe(401)
  })

  it("POST /api/panel-configs", async () => {
    expect((await panelRoute.POST(post({}))).status).toBe(401)
  })

  it("never touches the DAL when unauthenticated", async () => {
    await runsRoute.GET()
    await runsRoute.POST(post({}))
    expect(listRuns).not.toHaveBeenCalled()
    expect(createRun).not.toHaveBeenCalled()
  })
})

describe("authenticated requests pass the session guard", () => {
  // A minimal session shape — only user.id is read downstream.
  const session = { user: { id: "user-1" } }

  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(session as never)
  })

  it("GET /api/runs returns the user's runs", async () => {
    vi.mocked(listRuns).mockResolvedValue([])
    const res = await runsRoute.GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
    expect(listRuns).toHaveBeenCalledOnce()
  })

  it("POST /api/runs rejects an invalid config with 422 before launching", async () => {
    vi.mocked(runConfigSchema.safeParse).mockReturnValue({
      success: false,
      error: { issues: [{ message: "bad" }] },
    } as never)

    const res = await runsRoute.POST(post({ nope: true }))
    expect(res.status).toBe(422)
    expect(createRun).not.toHaveBeenCalled()
  })

  it("POST /api/runs creates and returns a queued run (201)", async () => {
    vi.mocked(runConfigSchema.safeParse).mockReturnValue({
      success: true,
      data: { panel: { analysts: [{ id: "quant.earnings-drift", weight: 1 }] }, initialCash: { USD: 1 } },
    } as never)
    vi.mocked(createRun).mockResolvedValue({ id: "run-1", status: "queued" } as never)

    const res = await runsRoute.POST(post({ panel: {}, initialCash: { USD: 1 } }))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ id: "run-1", status: "queued" })
    expect(createRun).toHaveBeenCalledOnce()
  })

  it("GET /api/runs/[id]/events replays the terminal status when the live emitter never emits", async () => {
    // The terminal-event race: an emitter is still registered, but the run fired
    // its terminal event before we subscribed, so subscribe() never calls back.
    // Without the persisted-status re-read the stream would hang open; the handler
    // must replay the persisted "completed" and close.
    vi.mocked(getOwnedRun).mockResolvedValue({
      id: "r1",
      status: "completed",
      completedAt: "2026-07-13T00:00:00.000Z",
    } as never)
    vi.mocked(runRegistry.get).mockReturnValue({ subscribe: () => () => {} } as never)

    const res = await eventsRoute.GET(new Request("http://localhost/api"), params("r1"))
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('"type":"completed"')
  })
})
