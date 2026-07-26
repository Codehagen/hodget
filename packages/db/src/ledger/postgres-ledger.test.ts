import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  InMemoryLedger,
  type DecisionRecord,
  type Fill,
  type Ledger,
  type Signal,
} from "@workspace/engine"

import { getPersistedDecisions } from "../queries/reconstruct.js"
import { insertRun } from "../queries/runs.js"
import { createTestDb, type TestDb } from "../testing/pglite.js"
import { PostgresLedger, summarizeThesis } from "./postgres-ledger.js"

function signal(overrides: Partial<Signal> = {}): Signal {
  return {
    analystId: "quant.earnings-drift",
    securityId: "US-XNAS-SYNA",
    asOf: "2026-01-02T23:00:00Z",
    conviction: 0.5,
    horizonDays: 30,
    thesis: "post-earnings drift up",
    abstained: false,
    ...overrides,
  }
}

function fill(overrides: Partial<Fill> = {}): Fill {
  return {
    securityId: "US-XNAS-SYNA",
    side: "buy",
    quantity: 10,
    price: 100,
    currency: "USD",
    filledAt: "2026-01-03T21:00:00Z",
    commission: 1,
    ...overrides,
  }
}

function decision(asOf: string, overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    asOf,
    signals: [signal({ asOf })],
    views: [],
    targetWeights: [],
    orders: [],
    gateActions: [],
    fills: [],
    ...overrides,
  }
}

// The behavioural contract every Ledger must satisfy — run against both the
// engine's InMemoryLedger and the PostgresLedger's in-memory buffer, so the
// persistence ledger cannot silently diverge from the reference implementation.
describe.each<[string, () => Ledger]>([
  ["InMemoryLedger", () => new InMemoryLedger()],
  ["PostgresLedger", () => new PostgresLedger()],
])("Ledger contract: %s", (_name, make) => {
  it("appends decisions in insertion order", () => {
    const ledger = make()
    ledger.record(decision("2026-01-02T23:00:00Z"))
    ledger.record(decision("2026-01-03T23:00:00Z"))
    expect(ledger.decisions().map((d) => d.asOf)).toEqual([
      "2026-01-02T23:00:00Z",
      "2026-01-03T23:00:00Z",
    ])
  })

  it("attaches fills to the decision recorded at asOf", () => {
    const ledger = make()
    ledger.record(decision("2026-01-02T23:00:00Z"))
    ledger.attachFills("2026-01-02T23:00:00Z", [fill()])
    expect(ledger.decisions()[0]?.fills).toHaveLength(1)
    expect(ledger.decisions()[0]?.fills[0]?.securityId).toBe("US-XNAS-SYNA")
  })

  it("throws when attaching fills to an unrecorded asOf", () => {
    const ledger = make()
    ledger.record(decision("2026-01-02T23:00:00Z"))
    expect(() => ledger.attachFills("2099-01-01T00:00:00Z", [fill()])).toThrow()
  })

  it("isolates recorded decisions from later mutation of the input", () => {
    const ledger = make()
    const input = decision("2026-01-02T23:00:00Z")
    ledger.record(input)
    // Mutating the caller's object must not reach into the log.
    ;(input.signals as Signal[]).push(signal({ analystId: "sneaky" }))
    expect(ledger.decisions()[0]?.signals).toHaveLength(1)
  })
})

describe("PostgresLedger.persist + reconstruct", () => {
  let db: TestDb

  beforeEach(async () => {
    db = await createTestDb()
  })

  afterEach(async () => {
    await db.close()
  })

  it("round-trips decisions, theses and fills for a completed run", async () => {
    const run = await insertRun(db, { ownerUserId: "u", mode: "backtest", config: {} })

    const ledger = new PostgresLedger()
    ledger.record(
      decision("2026-01-02T23:00:00Z", {
        signals: [signal({ thesis: "cheap on owner earnings" })],
        views: [
          {
            securityId: "US-XNAS-SYNA",
            asOf: "2026-01-02T23:00:00Z",
            conviction: 0.5,
            horizonDays: 30,
            contributingAnalystIds: ["quant.earnings-drift"],
          },
        ],
      }),
    )
    ledger.record(decision("2026-01-03T23:00:00Z"))
    // Fills settle a session later, keyed to the decision that intended them.
    ledger.attachFills("2026-01-02T23:00:00Z", [fill(), fill({ side: "sell", quantity: 5 })])

    await db.transaction((tx) => ledger.persist(tx, run.id))

    const persisted = await getPersistedDecisions(db, run.id)

    // Same decisions, same order, with fills re-attached to the right decision.
    expect(persisted.map((d) => d.asOf)).toEqual([
      "2026-01-02T23:00:00Z",
      "2026-01-03T23:00:00Z",
    ])
    expect(persisted[0]?.fills).toHaveLength(2)
    expect(persisted[1]?.fills).toHaveLength(0)
    expect(persisted[0]?.thesis).toBe("cheap on owner earnings")
    expect(persisted[0]?.decisionId).toBeTruthy()
    expect(persisted[1]?.decisionId).not.toBe(persisted[0]?.decisionId)

    // The reconstructed DecisionRecord equals what the ledger buffered.
    const buffered = ledger.decisions()
    persisted.forEach((d, i) => {
      const { decisionId: _id, thesis: _t, ...record } = d
      expect(record).toEqual(buffered[i])
    })
  })

  it("summarizeThesis joins distinct actionable theses and ignores abstentions", () => {
    const record = decision("2026-01-02T23:00:00Z", {
      signals: [
        signal({ thesis: "A" }),
        signal({ analystId: "x", thesis: "B" }),
        signal({ analystId: "dupe", thesis: "A" }),
        signal({ analystId: "abstained", thesis: null, conviction: 0, abstained: true }),
      ],
    })
    expect(summarizeThesis(record)).toBe("A · B")
  })
})
