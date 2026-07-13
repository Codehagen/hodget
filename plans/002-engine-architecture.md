# 002 — The engine: first-principles architecture and build plan

**Written against commit:** `6925655`
**Effort:** XL (phased) · **Risk of the change:** Medium · **Confidence:** High on architecture, Medium on phase ordering

## What we are building

Hodget's core is an **engine**: a panel of AI analysts and quantitative models
that research securities, form views with conviction, and turn those views into
positions — deterministically sized, risk-gated, and fully auditable. The web
app is a window into the engine; the engine must stand alone.

One engine, three modes, one **decision kernel**: **backtest** (historical
clock, simulated broker), **paper** (live clock, paper broker), **live** (live
clock, real broker). The pure core — `(portfolio snapshot, data snapshot) →
target views → weights → order intents` — is byte-identical across modes; if
the backtest runs a different kernel than production, the backtest proves
nothing. What legitimately differs per mode is the **orchestration shell**
around the kernel: the clock, and the broker's execution machinery (a sim
broker fills synchronously; a real broker needs async order state,
idempotency, partial fills, rejections, and reconciliation — that complexity
lives in the live shell when we get there, never in the kernel).

## First-principles pass

Applying the algorithm — question the requirement, delete the part, then
simplify what survives:

**Requirements questioned and kept:**

- *Point-in-time honesty.* Every piece of data has a `knownAt` **timestamp**
  (filing/announcement time, not the report period — and not just a date: a
  filing published after the close must not trade at that day's close). No
  analyst may see data past the decision cutoff, and decisions formed after a
  session's close fill at the **next** session. This is the difference
  between a research tool and a toy, and it is enforced structurally in the
  data layer, not by per-call discipline. Where a provider gives only a date
  (no time), the row is conservatively treated as known at end-of-day —
  visible the *next* trading day.
- *The LLM never touches the trade.* LLM analysts produce views and theses.
  Deterministic code computes target weights, sizes positions, and enforces
  risk limits. An LLM output can never directly move money.
- *Fail loud vs. no data.* A data-provider outage must raise; only a genuine
  "this company has no insider trades" returns empty. Silently treating an
  outage as "no data" corrupts every backtest that ran during it.
- *Every position keeps its thesis.* The ledger stores, for every decision,
  which analysts said what, with what conviction, and the exact rendered
  context they saw. Auditability is the product in an open-source fund.

**Requirements deleted (build later only if proven needed):**

- *A visual node-graph builder for wiring analysts.* Enormous frontend surface
  for a feature whose real use is "pick which analysts sit on the panel." A
  panel config (list of analyst IDs + weights) is a JSON column and a
  checkbox UI. Delete the graph; keep the config.
- *A large persona roster at launch.* Ship 2 quant models + 3 LLM personas
  that are each genuinely distinct. Twenty shallow personas are marketing,
  not alpha; each additional persona is prompt-maintenance surface.
- *A separate deployed engine service.* Well-run TypeScript monorepos have
  learned this lesson publicly: the valuable seam is the **interface**, not
  the network boundary. The engine is a **library** (`packages/engine`)
  consumed in-process by the API layer and by background jobs. If scaling
  ever demands a service, the interface makes extraction cheap. Starting
  with a service makes every iteration expensive.
- *Multiple LLM-orchestration frameworks.* No agent-graph framework. The
  panel is a `Promise.all` over typed `predict()` calls followed by
  deterministic aggregation. Call the model SDK directly with native
  structured output (tool/JSON-schema), not string-parsing of prose.

**Simplifications of what survives:**

- Analyst output is a single scalar **conviction ∈ [−1, +1]** plus a thesis —
  not a discrete bullish/neutral/bearish label plus a separate 0–100
  confidence that downstream code must re-fuse. Sign is direction, magnitude
  is conviction, and sizing consumes the magnitude (see committee below).
- Personas are **thin**: a system prompt, a data-selection spec, and
  thresholds. All financial math (owner earnings, CAGR, margin trends, DCF,
  RSI…) lives once in a shared `fundamentals`/`technicals` primitives module,
  never copy-pasted per persona.
- One backtester, one trade-execution core, shared by all three modes.

## Core abstractions (the contracts everything hangs on)

```ts
// packages/engine/src/types.ts — sketch, not final code

interface Signal {
  analystId: string;
  symbol: string;
  asOf: string;            // ISO timestamp: the decision cutoff the view was formed at
  conviction: number;      // [-1, +1]; 0 = no view / abstained
  horizonDays: number;     // how long the view is expected to pay off; committee
                           // may only blend signals with comparable horizons
  thesis: string | null;
  components?: Record<string, number>; // sub-scores for explainability
  abstained: boolean;      // broken analyst ≠ neutral view
}

interface Analyst {
  id: string;
  kind: "quant" | "llm";
  predict(ctx: AnalystContext): Promise<Signal>; // ctx wraps a PIT-scoped MarketData
}

interface MarketData {
  // Every method takes an asOf and may only return facts with knownAt <= asOf.
  prices(symbol: string, range: DateRange): Promise<Price[]>;
  fundamentals(symbol: string, asOf: string): Promise<FundamentalsSnapshot>;
  earnings(symbol: string, asOf: string): Promise<EarningsEvent[]>;
  news(symbol: string, asOf: string): Promise<NewsItem[]>;
  insiderTrades(symbol: string, asOf: string): Promise<InsiderTrade[]>;
  // Contract: empty = genuinely no data; infrastructure failure THROWS.
}

interface Committee {
  // The spine: many views in, one target view per symbol out.
  combine(signals: Signal[]): TargetView[]; // deterministic, configurable weighting
}

// Portfolio construction is three explicit, independently testable stages:
// TargetView[] -> targetWeights (construction) -> Order[] (sizing vs current book)
// -> risk gates veto/clip Orders (hard limits: position %, gross/net exposure,
//    correlation buckets) -> Broker executes.

interface Broker {
  execute(orders: Order[]): Promise<Fill[]>;   // sim | paper | live
}

interface Clock { today(): string; tradingDays(range: DateRange): string[] }
```

The **committee is first-class**, not an afterthought: conviction-weighted
averaging as the v1 policy, with the interface designed so
correlation-adjusted or meta-model weighting can replace it without touching
analysts or portfolio code. This is the layer that makes a panel a fund.

`runCycle(clock, marketData, panel, committee, portfolio, risk, broker, ledger)`
is the single pipeline all three modes share.

## Data layer

- Providers behind a `MarketData` interface; first provider is one
  fundamentals/prices API, but nothing outside `packages/engine/src/data/`
  may know which. PIT scoping (`knownAt <= asOf`) is applied **inside** the
  layer so callers cannot forget it.
- Persistent response store (append-only, revision-aware — see plan 003)
  keyed by `hash(provider + method + params)` — successful responses only, so
  fail-loud survives caching. File-based implementation through phase 3;
  Postgres implementation behind the same interface when `packages/db` lands
  in phase 5. In-memory per-run memoization on top. No process-global
  singletons anywhere: every run gets a context object (multi-tenant SaaS
  from day one).
- LLM calls are cached with full fidelity (exact system prompt, rendered
  context, raw response, content hash, model, timestamp), and prompts live in
  versioned files, not string literals. But the cache is a cost optimization,
  **not the ledger**: decision provenance lives in the ledger, where each
  decision immutably references the run, code version, panel config, data
  snapshot hashes, prompt version, model, and the inference record. Evicting
  or rebuilding the cache must never destroy auditability — the ledger copies
  what it needs rather than pointing into the cache.

## Market realities the engine must model (eng review additions)

- **FX / base currency.** The book holds NOK and USD positions in one shared
  capital pool, so the engine has a **base currency** (per fund config, default
  USD) and `MarketData.fxRate(pair, asOf)`. All portfolio valuation, sizing,
  and metrics are computed in base currency; `Signal`/analyst layers stay
  currency-agnostic. FX rates are PIT like everything else.
- **Corporate actions.** The simulator **trades and accounts on raw prices**
  and applies explicit corporate-action events to the book: a split mutates
  share count (whole-share rounding recorded), a dividend credits cash on
  ex-date. Trading whole shares against split-adjusted prices fabricates
  quantities and cash flows — adjusted series are used **only** in return
  analytics (metrics, event studies), never in accounting. The `Price` type
  carries `close`, `adjClose`, and the adjustment factor; `MarketData`
  exposes corporate-action events; the backtest report states which return
  convention (price vs. total-return) its metrics used.
- **Trading calendars.** Exchanges have different holidays (XOSL ≠ XNYS). The
  backtest calendar is the **union** of per-exchange calendars; each symbol is
  only tradable/markable on its own exchange's days, and mark-to-market
  carries the last available close for non-trading days. `Clock.tradingDays`
  is therefore exchange-aware.
- **Numeric policy.** Research math (returns, ratios, metrics) uses float64 —
  standard for quant work. Accounting state (cash, position quantities, fills)
  uses explicit rounding rules: whole shares (no fractional), cash rounded to
  the minor unit at every mutation, and the invariant
  `cash + Σ(position × price × fx)` is asserted in tests after every
  simulated fill.
- **Survivorship bias.** Backtests run on explicit symbol lists, which biases
  toward survivors. Until historical universe membership and delisting data
  exist (post-phase-6 work), every `BacktestResult` is labeled a
  **fixed-universe case study** — the `caveats` field carries this label and
  the price-adjustment convention, and any published numbers must carry it
  too. Case-study numbers never feed the promotion gate as if they were
  universe-honest.
- **Execution costs.** The sim broker models per-trade commission and a
  configurable slippage term (bps of notional) from phase 3 — zero-cost
  backtests systematically flatter high-turnover strategies. Liquidity/
  volume caps, borrow costs, and market impact are deferred (named in the
  promotion gate as prerequisites for live), but the cost interface exists
  from the first simulated fill. Cash is held **per currency**: buying an
  Oslo name requires NOK cash (converted at the PIT FX rate with a spread),
  not an abstract base-currency balance.

## Backtesting and validation (where naive implementations lie)

- Simulate the **whole book**: one shared capital pool, one shared calendar,
  cross-symbol exposure — never per-symbol trades with implicit unlimited
  capital.
- Equity curve is **daily**, positions marked to market; Sharpe/Sortino/max
  drawdown computed from periodic returns, never from per-trade returns
  (per-trade Sharpe scales with trade count and overstates quality; a
  trade-indexed curve hides intra-holding drawdowns).
- Conviction scales position size. A committee view of 0.9 and one of 0.1
  must not produce identical positions.
- Validation is a **gate, not a report** — sized to the experiment, not to
  the literature: phase 4 ships a **frozen holdout period + walk-forward**
  evaluation (simple, hard to game, adequate for the first strategies).
  Heavier machinery (purged/combinatorial CV, PBO) is deliberately deferred
  to the phase 6 promotion gate, and only if the strategy-selection process
  and sample size by then actually warrant it. Backtest numbers without any
  out-of-sample guard are a credibility liability for an open-source fund.
- An **event-study module** (abnormal returns vs. a market model around
  events) is part of the engine's research toolkit: prove an effect exists
  before trading it.

## Monorepo layout (midday-style)

```
apps/
  web            # existing Next.js app: dashboard, auth (better-auth), UI
  api            # LATER, only when needed: Hono API if route handlers outgrow web
packages/
  engine         # @workspace/engine — the core (this plan)
    src/
      types.ts         # Signal, Analyst, Committee, Order, ... (zod schemas)
      data/            # MarketData providers, PIT enforcement, cache
      analysts/        # quant/ and personas/ (thin), prompts/ as versioned files
      primitives/      # shared financial math (fundamentals, technicals, valuation)
      committee/
      portfolio/       # construction, sizing
      risk/            # hard gates
      brokers/         # sim, paper, (live later)
      backtest/        # engine, metrics, event-study, validation
      ledger/          # decision records, run persistence contracts
  db             # LATER (phase 5): schema + centralized queries (one file per domain)
  jobs           # LATER (phase 5): Trigger.dev tasks (scheduled cycles, cache warming)
  ui             # existing shared UI
```

Conventions carried over from the existing repo: `@workspace/*` naming,
`workspace:*` deps, packages ship raw TS (`main: ./src/index.ts`, consumers
compile), turbo tasks `build/dev/lint/typecheck`, strict shared tsconfig.
Engine rule: `packages/engine` has **no dependency on Next.js, React, or the
web app** — it must run in a script, a job, and a route handler identically.
Data access from the browser follows the existing invariant: TanStack Query →
Route Handler (validated session) → engine/db on the server.

## Test infrastructure (prerequisite — the repo has none today)

`turbo.json` has no `test` task and no package has a test runner. Phase 1
therefore includes: **Vitest** in `packages/engine` (`vitest.config.ts`,
`src/**/*.test.ts` colocated), a `test` script per package, a `test` task in
`turbo.json` (`dependsOn: ["^topo"]`, no cache for now), and CI running
`pnpm test` alongside typecheck/lint. Every phase's done-criteria include
`pnpm test` green. Tests never hit the network: everything runs on
`FixtureMarketData` and a fake LLM client; live-provider tests are gated
behind `LIVE_DATA_TESTS=1` (plan 003) and excluded from the default run.

## Phases

Each phase lists its test plan; the tests are written with the feature, not
after.

1. **Skeleton + contracts.** `packages/engine` with zod-typed core models
   (`Signal`, `Analyst`, `MarketData`, `Order`, `TargetView`), the PIT data
   layer (fixture provider first), fail-loud error taxonomy, vitest wiring.
   The response store is an interface with a **file-based implementation**
   in phases 1–3 (no Postgres dependency before `packages/db` exists in
   phase 5); the Postgres implementation lands with phase 5 behind the same
   interface. Fixtures are synthetic from day one (plan 003) and include
   Oslo symbols, NOK, and FX so exchange/currency paths are testable in
   phases 1–3 without any live provider.
   **Tests:** PIT property tests (for random `asOf`, no returned fact has
   `knownAt > asOf`; a fact filed after `asOf` is invisible; same query at a
   later `asOf` reveals it); empty-vs-throw contract (provider outage ⇒
   `DataUnavailableError`, genuine absence ⇒ empty); zod schema rejection of
   malformed rows; conviction bounds (`[-1,+1]` enforced, NaN rejected);
   abstained signals are distinguishable from neutral views.
2. **First analysts.** One quant model (earnings-drift on post-earnings
   surprise, with filing-date discipline and freshness window) and one LLM
   persona (value-investing checklist over a rendered PIT fundamentals
   snapshot, native structured output, abstain-on-failure). Shared
   `primitives/` started here.
   **Tests:** earnings-drift table-driven cases (beat ⇒ positive, miss ⇒
   negative, stale filing outside freshness window ⇒ no view, retrospective
   filings dropped, duplicate filings deduped by source priority); primitives
   unit-tested against hand-computed values (CAGR, margins, owner earnings);
   persona tested with a **fake LLM client** (valid JSON ⇒ signal with
   conviction = sign × confidence; malformed JSON ⇒ abstain + raw response
   persisted; LLM transport error ⇒ abstain, never a crash and never a
   traded neutral); snapshot `render()` golden-file test; prompt-cache
   hit/miss + audit-record round-trip.
3. **Whole-book backtester.** Shared union calendar + per-currency cash,
   sim broker with commission + slippage, corporate-action events applied to
   the book, daily equity curve, periodic-return metrics. Scope note: phase
   3 backtests a **single analyst** with a deliberately simple
   conviction-proportional sizing rule + hard caps — the committee and the
   full construction pipeline (phase 4) later replace that rule behind the
   same kernel interface, so nothing in the engine loop is rewritten.
   **Tests:** golden-file backtest on committed fixtures — byte-identical
   metrics across runs (determinism); accounting invariant after every fill
   (`cash + Σ position value` in base currency, no money created or
   destroyed); cash constraint (orders beyond available cash are clipped —
   never negative cash); calendar edge cases (Oslo holiday + NYSE open:
   XOSL symbol not traded, book still marks); FX applied in valuation
   (a NOK position with a moving EQNR price and moving NOKUSD both affect
   base-currency equity); metrics unit tests vs hand-computed Sharpe/
   drawdown on a tiny synthetic curve; conviction scaling (0.9 view sized
   9× a 0.1 view under equal risk caps).
4. **Committee + portfolio + risk.** Conviction-weighted committee, the
   three-stage construction pipeline, hard risk gates (max position %, gross
   exposure, vol-scaled limits). Walk-forward validation harness.
   `runCycle()` lands here — backtest mode is just `runCycle` on a
   historical clock.
   **Tests:** committee unit tests (unanimity, disagreement averaging,
   abstentions excluded from weights, all-abstain ⇒ no view); risk gates as
   hard vetoes (an order violating max position % is clipped and the clip is
   recorded on the decision; gates fire even at conviction 1.0); construction
   stage boundaries (views ⇒ weights ⇒ orders each independently testable
   with synthetic inputs); walk-forward harness on synthetic data with a
   known regime change; one **backtest == live parity test**: `runCycle` on
   the historical clock and the sim-live clock over the same day produces
   identical decisions.
5. **SaaS surface.** `packages/db` (runs, cycles, decisions, theses, panel
   configs — per-team), route handlers to launch runs, SSE/stream progress
   (per-run emitter, no global state), `packages/jobs` for scheduled cycles.
   Dashboard: panel picker, run view with live analyst status, decision log
   with theses.
   **Tests:** DAL-boundary lint stays green (plan 001); two concurrent runs
   do not cross-talk progress events (per-run emitter, asserted with two
   interleaved fake runs); run persistence round-trip (a completed cycle's
   decisions + theses are fully reconstructable from the database).
6. **Paper mode + promotion gate.** Paper broker on a live clock, CPCV/PBO
   validation gate, promotion workflow backtest → paper. (Live brokerage is
   deliberately out of scope until paper has run for months.)
   **Tests:** promotion gate rejects a strategy that fails validation
   thresholds; paper broker fills at next-available close, never same-bar
   (no lookahead in execution either).

Each phase ends green on `pnpm typecheck` + tests and is independently
shippable. Phases 1–3 have no UI and are pure library work — ideal for
delegation to dev-manager with review-manager passes.

## Considered and rejected

- **Python for the engine, TS for the app.** The quant ecosystem argues for
  Python, but a split runtime doubles deployment surface, kills type sharing
  with the app, and violates "backtest == live == what the SaaS runs." The
  math we need (returns, OLS market model, bootstrap CIs) is implementable
  and testable in TS; heavy numerics can be revisited per-module if ever
  actually needed.
- **An agent-graph framework for the panel.** The panel is embarrassingly
  parallel and the aggregation is deterministic. A framework adds string-
  typed state passing and version churn for negative value here.
- **Discrete signal labels (bullish/bearish + confidence).** Loses magnitude
  where it matters (sizing) and forces re-fusion downstream. One signed
  conviction scalar carries both.
- **Starting with a separate engine service.** See first-principles pass —
  the interface is the seam; extraction later is cheap, contraction later is
  expensive.
- **LLM-driven position sizing.** Violates a non-negotiable. The LLM's
  output space ends at (conviction, thesis).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | CLEAR (absorbed) | 15 findings, 9 folded in full, 5 folded reduced, 1 rejected |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | see per-plan notes below |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

Eng review notes (2026-07-13, autonomous): added test infrastructure prerequisite (repo had no test runner), per-phase test plans, FX/base-currency handling, corporate-action accounting on raw prices, exchange-aware calendars, numeric/accounting policy, execution costs, survivorship labeling.

- **CODEX:** outside voice (Codex CLI, gpt-5.5 high, read-only) returned 15 findings. Folded in full: timestamp-grade PIT with next-session fill semantics; raw-price accounting with explicit corporate-action events; ledger/cache separation; kernel-vs-shell framing of backtest==live; phase-sequencing fixes (file-based store before packages/db, synthetic Oslo fixtures from phase 1, single-analyst scope note on phase 3); Signal.horizonDays; per-currency cash + commission/slippage from phase 3; estimate-vintage requirement with honest earnings-momentum reframing of the fallback.
- **CROSS-MODEL:** two Codex findings were absorbed in reduced form as deliberate scope calls: a full bitemporal observation store (chair's call: append-only revisioned response store now, bitemporal deferred — revisions are kept so nothing is lost) and a full security master (chair's call: opaque securityId seam now, master later). One finding rejected: dropping CPCV/PBO entirely — instead deferred to the phase 6 promotion gate. Survivorship handled by labeling results fixed-universe case studies rather than blocking on universe-membership data.
- **VERDICT:** ENG + CODEX CLEARED — ready to implement (phases 1–3 in scope now).

NO UNRESOLVED DECISIONS
