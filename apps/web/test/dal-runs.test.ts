import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Exercises the ownership boundary in the real DAL — the `run.ownerUserId ===
 * session.user.id` comparison in `lib/dal/runs.ts` (not a fully-mocked `@/lib/dal`
 * as in api-auth.test.ts). The session, the `@workspace/db` query surface, and the
 * DAL's Postgres/registry wiring are mocked so `getOwnedRun` can run under plain
 * Node with no database, isolating the equality check itself.
 *
 * `@workspace/db` is mocked through a hoisted handle rather than imported directly:
 * the route/DAL lint rule forbids importing the engine DB package outside lib/dal.
 */
const { getRunByIdMock } = vi.hoisted(() => ({ getRunByIdMock: vi.fn() }))

vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(),
}))

vi.mock("@workspace/db", () => ({
  getRunById: getRunByIdMock,
  insertRun: vi.fn(),
  listRunsByOwner: vi.fn(),
  getResultByRun: vi.fn(),
  getPersistedDecisions: vi.fn(),
}))

// Mocked so importing runs.ts opens no pool and constructs no registry, and never
// reaches the workflow runtime (startRun replaces launchRun in plan 004).
vi.mock("@/lib/dal/db", () => ({ getDb: vi.fn(() => ({})) }))
vi.mock("@/lib/dal/run-registry", () => ({ startRun: vi.fn(), runRegistry: {} }))

import { getOwnedRun } from "@/lib/dal/runs"
import { requireSession } from "@/lib/session"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getOwnedRun enforces per-user ownership", () => {
  it("returns null when the run belongs to another user", async () => {
    // Session is user A; the fetched run is owned by user B.
    vi.mocked(requireSession).mockResolvedValue({ user: { id: "user-A" } } as never)
    getRunByIdMock.mockResolvedValue({ id: "r1", ownerUserId: "user-B" })

    expect(await getOwnedRun("r1")).toBeNull()
  })

  it("returns the run when it belongs to the caller", async () => {
    const run = { id: "r1", ownerUserId: "user-A" }
    vi.mocked(requireSession).mockResolvedValue({ user: { id: "user-A" } } as never)
    getRunByIdMock.mockResolvedValue(run)

    expect(await getOwnedRun("r1")).toBe(run)
  })

  it("returns null when the run does not exist", async () => {
    vi.mocked(requireSession).mockResolvedValue({ user: { id: "user-A" } } as never)
    getRunByIdMock.mockResolvedValue(null)

    expect(await getOwnedRun("missing")).toBeNull()
  })
})
