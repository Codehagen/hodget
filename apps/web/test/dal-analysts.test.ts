import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * The seat-evidence DAL module (plan 024, step 3) under plain Node: no database,
 * no 259 KB fixture read, no engine.
 *
 * Following `dal-runs.test.ts`: `@workspace/db` is mocked through a hoisted
 * handle rather than imported, because the DAL lint rule forbids importing the
 * engine DB package outside `lib/dal`. That mock exposes **only**
 * `runConfigSchema` on purpose — if `analysts.ts` ever reaches for a query of its
 * own instead of going through the owned-run helpers, this file fails at import
 * with an undefined export rather than quietly opening a second path to the
 * database.
 *
 * The session boundary itself is exercised in `dal-runs.test.ts`; here `listRuns`
 * and `getRunDetail` are the mocked seam, which is exactly the boundary this
 * module is supposed to sit behind.
 */
const {
  listRunsMock,
  getRunDetailMock,
  attributeRunMock,
  loadFixtureDatasetMock,
  safeParseMock,
  PROXY_SECURITY_ID,
} = vi.hoisted(() => ({
  listRunsMock: vi.fn(),
  getRunDetailMock: vi.fn(),
  attributeRunMock: vi.fn(),
  loadFixtureDatasetMock: vi.fn(),
  safeParseMock: vi.fn(),
  /** The dataset's US equity — see `FIXTURE_IDS` in the engine. */
  PROXY_SECURITY_ID: "US-XNAS-SYNA",
}))

vi.mock("@/lib/dal/runs", () => ({
  listRuns: listRunsMock,
  getRunDetail: getRunDetailMock,
}))

vi.mock("@workspace/db", () => ({
  runConfigSchema: { safeParse: safeParseMock },
}))

vi.mock("@workspace/engine", () => ({
  attributeRun: attributeRunMock,
  loadFixtureDataset: loadFixtureDatasetMock,
  FIXTURE_IDS: { usEquity: PROXY_SECURITY_ID },
  FixtureOutcomeData: class FixtureOutcomeData {
    constructor(readonly dataset: unknown) {}
  },
}))

const DATASET = { meta: { from: "2024-01-02", to: "2024-12-30" } }

const COMPLETED_RUN = { id: "run-completed", status: "completed", config: {} }
const RUNNING_RUN = { id: "run-running", status: "running", config: {} }

/** Two seats, one measured and one that only ever abstained. */
const ATTRIBUTION = {
  droppedBenchmarkSignals: 3,
  resolved: 12,
  unresolved: 4,
  analysts: [
    {
      scorecard: {
        analystId: "llm.value",
        observations: 12,
        unresolved: 4,
        abstentionRate: 0.084,
        ic: 0.1732,
        hitRate: 0.5,
        meanForwardAlpha: 0.001,
        windowIc: [],
      },
      seat: {
        analystId: "llm.value",
        state: "shadow",
        reasons: [
          { code: "out-of-sample", ok: false, detail: "evidence is in-sample" },
          {
            code: "information-coefficient",
            ok: true,
            detail: "information coefficient 0.1732 vs. floor 0.0200",
          },
        ],
      },
    },
    {
      scorecard: {
        analystId: "quant.drift",
        observations: 0,
        unresolved: 0,
        abstentionRate: 1,
        ic: null,
        hitRate: null,
        meanForwardAlpha: null,
        windowIc: [],
      },
      seat: {
        analystId: "quant.drift",
        state: "shadow",
        reasons: [{ code: "min-observations", ok: false, detail: "0 vs. min 30" }],
      },
    },
  ],
}

/**
 * A fresh module per test: `analysts.ts` memoizes the fixture load at module
 * scope, and the memo is precisely what two of these tests are about.
 */
async function importAnalysts() {
  vi.resetModules()
  return import("@/lib/dal/analysts")
}

beforeEach(() => {
  vi.clearAllMocks()
  listRunsMock.mockResolvedValue([RUNNING_RUN, COMPLETED_RUN])
  getRunDetailMock.mockResolvedValue({
    run: COMPLETED_RUN,
    result: null,
    decisions: [{ asOf: "2024-06-03", signals: [] }],
  })
  loadFixtureDatasetMock.mockResolvedValue(DATASET)
  attributeRunMock.mockResolvedValue(ATTRIBUTION)
  // The stored config carries no parseable range unless a test says otherwise.
  safeParseMock.mockReturnValue({ success: false })
})

describe("getSeatEvidence — the empty cases are null, never an empty panel", () => {
  it("returns null when the user has no completed run", async () => {
    listRunsMock.mockResolvedValue([RUNNING_RUN, { id: "r-failed", status: "failed" }])
    const { getSeatEvidence } = await importAnalysts()

    expect(await getSeatEvidence()).toBeNull()
    // And it costs nothing: no run detail fetched, no fixture dataset read.
    expect(getRunDetailMock).not.toHaveBeenCalled()
    expect(loadFixtureDatasetMock).not.toHaveBeenCalled()
  })

  it("returns null when the run detail comes back null", async () => {
    // getRunDetail re-checks ownership, so null here is "not yours (any more)".
    getRunDetailMock.mockResolvedValue(null)
    const { getSeatEvidence } = await importAnalysts()

    expect(await getSeatEvidence()).toBeNull()
    expect(attributeRunMock).not.toHaveBeenCalled()
  })

  it("takes the first completed run from the newest-first list", async () => {
    listRunsMock.mockResolvedValue([
      RUNNING_RUN,
      COMPLETED_RUN,
      { id: "run-older", status: "completed", config: {} },
    ])
    const { getSeatEvidence } = await importAnalysts()

    await getSeatEvidence()
    expect(getRunDetailMock).toHaveBeenCalledWith(COMPLETED_RUN.id)
  })
})

describe("getSeatEvidence — what it claims about the data", () => {
  it("always reports the benchmark as a proxy", async () => {
    const { getSeatEvidence } = await importAnalysts()
    const evidence = await getSeatEvidence()

    // Unconditional by construction: the committed fixture dataset carries no
    // benchmark index, so there is no state of the world in which this surface
    // has a real one. The panel keys its IC suppression off this flag.
    expect(evidence?.benchmark).toEqual({
      securityId: PROXY_SECURITY_ID,
      isProxy: true,
    })
  })

  it("attributes against the proxy with no windows, so the evidence stays in-sample", async () => {
    const { getSeatEvidence } = await importAnalysts()
    await getSeatEvidence()

    const input = attributeRunMock.mock.calls[0]?.[0] as {
      benchmarkSecurityId: string
      windows: unknown
      decisions: unknown
    }
    expect(input.benchmarkSecurityId).toBe(PROXY_SECURITY_ID)
    // No windows: this run was not walk-forward split. Supplying them from here
    // would label in-sample evidence out-of-sample and promote a seat on the data
    // it was designed against.
    expect(input.windows).toBeUndefined()
    expect(input.decisions).toEqual([{ asOf: "2024-06-03", signals: [] }])
  })

  it("maps every seat, keeping an unmeasurable IC as null rather than zero", async () => {
    const { getSeatEvidence } = await importAnalysts()
    const evidence = await getSeatEvidence()

    expect(evidence?.runId).toBe(COMPLETED_RUN.id)
    expect(evidence?.analysts).toEqual([
      {
        analystId: "llm.value",
        state: "shadow",
        observations: 12,
        ic: 0.1732,
        abstentionRate: 0.084,
        reasons: ATTRIBUTION.analysts[0]!.seat.reasons,
      },
      {
        analystId: "quant.drift",
        state: "shadow",
        observations: 0,
        ic: null,
        abstentionRate: 1,
        reasons: ATTRIBUTION.analysts[1]!.seat.reasons,
      },
    ])
  })

  it("names the run's own range, falling back to the dataset span", async () => {
    const { getSeatEvidence } = await importAnalysts()
    expect((await getSeatEvidence())?.asOfRange).toEqual({
      from: DATASET.meta.from,
      to: DATASET.meta.to,
    })

    safeParseMock.mockReturnValue({
      success: true,
      data: { range: { from: "2024-03-01", to: "2024-06-30" } },
    })
    expect((await getSeatEvidence())?.asOfRange).toEqual({
      from: "2024-03-01",
      to: "2024-06-30",
    })
  })
})

describe("getSeatEvidence — the memoized fixture load", () => {
  it("reads the dataset once across calls", async () => {
    const { getSeatEvidence } = await importAnalysts()

    await getSeatEvidence()
    await getSeatEvidence()

    expect(loadFixtureDatasetMock).toHaveBeenCalledTimes(1)
  })

  it("clears the memo on rejection so the next caller retries", async () => {
    // A memoized rejected promise would turn one transient failure into a dead
    // panel for the life of the process.
    loadFixtureDatasetMock.mockRejectedValueOnce(new Error("dataset unreadable"))
    const { getSeatEvidence } = await importAnalysts()

    await expect(getSeatEvidence()).rejects.toThrow("dataset unreadable")
    await expect(getSeatEvidence()).resolves.not.toBeNull()
    expect(loadFixtureDatasetMock).toHaveBeenCalledTimes(2)
  })
})
