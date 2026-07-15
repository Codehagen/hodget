import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * startRun's durable path (plan 011): a failed workflow-id persist is retried
 * once, and a persistent failure marks the run failed instead of leaving it
 * silently unobservable. Every seam is mocked — the unit under test is the
 * ordering/fallback logic, not the workflow runtime or the database.
 */

const start = vi.fn()
const setRunWorkflowId = vi.fn()
const setRunStatus = vi.fn()

vi.mock("workflow/api", () => ({ start: (...a: unknown[]) => start(...a) }))
vi.mock("@/workflows/execute-run", () => ({ executeRunWorkflow: {} }))
vi.mock("./../lib/dal/db", () => ({ getDb: () => ({}) }))
vi.mock("@workspace/db", () => ({
  RunRegistry: class {
    register() {}
    get() {}
    unregister() {}
  },
  createRunEmitter: vi.fn(),
  createRunAnalystSource: vi.fn(),
  executeRun: vi.fn(),
  setRunWorkflowId: (...a: unknown[]) => setRunWorkflowId(...a),
  setRunStatus: (...a: unknown[]) => setRunStatus(...a),
}))

import { startRun } from "@/lib/dal/run-registry"
// Type-only, erased at compile time — the runtime module stays mocked above,
// and the DAL boundary lint only permits @workspace/db behind lib/dal.
import type { EngineRun } from "@/lib/dal"

const RUN = { id: "run-1", status: "queued" } as unknown as EngineRun

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.RUN_EXECUTION
  start.mockResolvedValue({ runId: "wf-1" })
})

describe("startRun — durable workflow-id persist (plan 011)", () => {
  it("persists the workflow id on the happy path", async () => {
    setRunWorkflowId.mockResolvedValue(undefined)
    await startRun(RUN)
    expect(setRunWorkflowId).toHaveBeenCalledTimes(1)
    expect(setRunWorkflowId).toHaveBeenCalledWith({}, "run-1", "wf-1")
    expect(setRunStatus).not.toHaveBeenCalled()
  })

  it("retries once and succeeds without touching the run status", async () => {
    setRunWorkflowId
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce(undefined)
    await startRun(RUN)
    expect(setRunWorkflowId).toHaveBeenCalledTimes(2)
    expect(setRunStatus).not.toHaveBeenCalled()
  })

  it("marks the run failed and rethrows when both persists fail", async () => {
    const boom = new Error("db down")
    setRunWorkflowId.mockRejectedValue(boom)
    setRunStatus.mockResolvedValue(undefined)
    await expect(startRun(RUN)).rejects.toBe(boom)
    expect(setRunWorkflowId).toHaveBeenCalledTimes(2)
    expect(setRunStatus).toHaveBeenCalledWith(
      {},
      "run-1",
      expect.objectContaining({ status: "failed" })
    )
  })
})
