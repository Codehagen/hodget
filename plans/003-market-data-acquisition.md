# 003 — Market data acquisition: providers, Norwegian coverage, and the fixture strategy

**Written against commit:** `6925655`
**Effort:** L · **Risk of the change:** Medium (external dependency + licensing) · **Confidence:** High

Companion to [002 — engine architecture](./002-engine-architecture.md). This plan
decides how the engine's `MarketData` interface gets real data — for US **and
Norwegian (Oslo Børs)** equities — and how we develop and test without burning
API calls, while still validating that the live integration works.

## Requirements (questioned first)

- **Daily bars only.** No realtime/websocket. A daily-cycle fund needs EOD
  data; realtime is deleted from the requirements until a strategy proves it
  needs it.
- **Point-in-time fundamentals.** Every fundamentals row must carry the
  filing/publication date, because the engine's PIT contract (`knownAt <=
  asOf`) is only as good as the source field. This single requirement
  eliminates most providers.
- **Norwegian coverage is first-class, not an afterthought.** Prices,
  fundamentals, and earnings dates for Oslo Børs tickers (EQNR, DNB, NHY,
  KOG, …), alongside full US coverage.
- **Zero API calls in tests and normal development.** Deterministic fixtures
  everywhere; live calls only behind explicit flags.

## Provider decision

**Two providers from the start, routed by exchange:**

- **Financial Datasets** (financialdatasets.ai) for **US equities**. It is
  purpose-built for point-in-time backtesting: 30+ years of US fundamentals
  with filing-date discipline (`filing_date` filters on the API itself, so
  PIT queries are server-side, not client-side cleanup), plus prices,
  earnings history per SEC filing (8-K/10-Q/10-K source-tagged), insider
  trades, news, and company facts. Usage-based pricing. This is the highest-
  fidelity US source in its price class and the reference implementation of
  our fail-loud contract (404 = no data; everything else raises).
- **EODHD** (eodhd.com) for **Oslo Børs and other international exchanges**.
  Surveyed against FMP, Polygon, Twelve Data, Finnhub, Alpha Vantage,
  Börsdata, Yahoo, and Euronext's official feeds (2026 state), it is the only
  affordable REST/JSON API that covers Oslo Børs with prices **and**
  fundamentals **and** earnings, and it exposes both the period date and the
  **`filing_date`** on fundamentals. One key covers EOD prices, fundamentals,
  earnings + estimates, news, and insider transactions (All-in-One tier,
  ~$100/mo; commercial/Business tier ~$299/mo, see licensing below).

The registry (below) routes `XNAS`/`XNYS` → Financial Datasets and `XOSL` (+
other international MICs) → EODHD. Both map into the same normalized types;
nothing outside `data/providers/` knows which vendor served a row. Running
US on EODHD too remains a config change (useful as fallback or if usage-based
US costs spike).

**Rejected:**

- *Polygon* — good US PIT discipline but US-only and weaker fundamentals
  fit than Financial Datasets for this use case.
- *FMP* — global coverage only on top tiers and Norway coverage unverified;
  strong `acceptedDate`/`fillingDate` though — kept in mind as an optional
  swap-in via the registry.
- *Börsdata* — Nordic specialist, but API keys are gated to Nordic-resident
  Pro+ members and the license won't survive a public SaaS.
- *Yahoo/yfinance* — ToS prohibits commercial use; scraping reliability.
  Never build a SaaS on it.
- *Euronext official / Twelve Data / Finnhub / Alpha Vantage* — enterprise
  SFTP, unclear PIT, or thin Norwegian coverage respectively.

**Earnings surprises — the honest version:** a true *surprise* requires the
consensus estimate **as it stood before the announcement** (an estimate
vintage). An estimate fetched today for a 2019 quarter may have been revised
— treating it as PIT consensus is lookahead. Therefore: (1) the provider
spike (phase 0) must verify whether either provider serves pre-announcement
estimate vintages; (2) where vintages exist, the model is genuine
surprise-drift; (3) where they don't (most of Oslo, possibly US too), the
fallback — reported-actual vs. same-quarter-last-year — is **explicitly a
different signal (earnings momentum, not surprise)** and is named, tagged,
and backtested as such, never sold as PEAD. The announcement *date/time*
(the PIT anchor) is available either way via the earnings calendar.

## Licensing (shapes the architecture)

Every cheap data tier on the market is personal/non-commercial and forbids
redistributing raw data to end users. Two supported modes, both first-class:

1. **BYO-key (default for the open-source deployment):** each team supplies
   its own provider API key, stored encrypted per team. We ship code, users
   own their data license. This also means the data layer must treat API keys
   as per-run context, never process-global env only.
2. **Hosted (our SaaS):** runs on a commercial-tier key. Raw provider data is
   an internal input; what we expose to users is our derived output (signals,
   theses, positions, metrics). Do not expose raw-data passthrough endpoints.

## Architecture

```
packages/engine/src/data/
  types.ts            # Price, FundamentalsSnapshot, EarningsEvent, ... (zod)
  market-data.ts      # MarketData interface + PIT enforcement wrapper
  errors.ts           # DataUnavailableError (throw) vs empty (no data)
  cache.ts            # Postgres response cache (hash(provider+method+params))
  symbols.ts          # canonical symbol model
  providers/
    registry.ts       # provider registry; config picks per-exchange routing
    financial-datasets/  # US: client, mappers (filing_date → knownAt)
    eodhd/            # Oslo Børs + international: client, mappers, rate limiting
    fixture/          # FixtureMarketData — reads recorded fixtures from disk
```

- **Canonical symbol model:** `{ symbol, mic }` using ISO 10383 MIC codes
  (`XNAS`, `XNYS`, `XOSL`), with provider adapters mapping to vendor formats
  (EODHD `EQNR.OL`). Known limitation, by choice: ticker+MIC breaks on
  renames, dual listings, and delistings. Everything internal references an
  opaque `securityId` issued by a resolver module (today a 1:1 wrapper over
  ticker+MIC) so that a real security master with validity intervals can
  slot in later without touching engine code. Currency lives on every price/fundamentals row (NOK vs
  USD) — the portfolio layer needs it; never assume USD.
- **FX rates are part of `MarketData`:** `fxRate(pair, asOf)` — the engine's
  multi-currency book (plan 002) values everything in a base currency. EODHD
  serves daily FX; fixtures include NOKUSD. Same PIT/caching/fail-loud rules
  as every other method.
- **Adjusted prices:** the `Price` type carries `close`, `adjClose`, and the
  split factor. Mappers document exactly which vendor fields feed each
  (EODHD `adjusted_close`; Financial Datasets' adjusted series) so the
  backtest's price-adjustment convention is auditable per provider.
- **PIT enforcement is structural:** provider mappers must populate `knownAt`
  as a **timestamp** (from `filing_date`/announcement date; date-only values
  are conservatively coerced to end-of-day in the exchange's timezone, so
  they become visible the next trading day); the `MarketData` wrapper filters
  `knownAt <= asOf` centrally so no provider or caller can forget. A row
  without a usable `knownAt` is a **data-quality error** (fail loud), not a
  silent drop — silently thinning history skews backtests invisibly.
- **Result envelopes carry coverage status:** "no rows" is ambiguous, so
  list results distinguish `covered-empty` (provider covers this
  symbol/range and there is genuinely nothing) from `not-covered` (symbol
  unknown, exchange unsupported, or history not covered). Analysts may treat
  `covered-empty` as information; `not-covered` must never masquerade as it.
- **Fail-loud taxonomy:** HTTP 404/known-empty ⇒ empty result. Network
  errors, 5xx, 429-exhausted, auth failures ⇒ `DataUnavailableError`. The
  cache stores successful responses only, so an outage can never be laundered
  into "no data" by a cache hit.
- **The response store is append-only and revision-aware, not a naive
  cache:** providers restate fundamentals, backfill earnings, and correct
  adjustment factors, so "historical = immutable" is false at the provider
  layer. Each stored response carries `observedAt` and a revision counter;
  a re-fetch that differs **appends a new revision** (never overwrites),
  and reads default to the latest revision. Ranges touching the current day
  get a short TTL (24h) so "latest" queries don't fossilize. This is the
  pragmatic middle ground — a full bitemporal observation store is deferred
  until reproducing historical runs against old revisions is actually
  needed, but because revisions are kept from day one, nothing is lost in
  the meantime. The drift check (below) is what turns a surprise restatement
  into an alert instead of silent history rewriting.
- **Provider registry** routes by exchange (`XNAS`/`XNYS` → Financial
  Datasets, `XOSL` and other international MICs → EODHD) without callers
  knowing; routing is config, so swapping or consolidating providers never
  touches engine code.

## Fixtures: develop on mocks, validate against live

Two fixture tiers, because "real recorded data" and "redistributable to
every contributor and CI" are in direct license tension:

1. **Public tier — synthetic, committed to the repo.** `FixtureMarketData`
   implements the same `MarketData` interface and reads deterministic
   **generated** fixtures from `packages/engine/fixtures/` — synthetic
   companies on synthetic-but-realistic calendars (a US and an Oslo
   exchange, NOK/USD, splits, dividends, missing estimates, late filings,
   sparse insider trades — every edge case scripted in). License-safe by
   construction, so fresh clones and CI always work with zero keys. The
   generator is code (`fixtures/generate.ts`), reviewed like code, so the
   "hand-written numbers encode our assumptions" risk is managed by making
   the assumptions explicit and versioned rather than scattered.
2. **Private tier — recorded real data, gitignored.** The recorder script
   (`pnpm --filter @workspace/engine record-fixtures`) calls the live
   providers for a pinned symbol set (AAPL, NVDA, EQNR, DNB, KOG, a
   micro-cap without estimates) over a pinned range, stores raw payloads as
   cassettes plus normalized fixtures + `manifest.json` locally. Used for
   mapper unit tests and the live-parity checks on machines with keys; never
   committed, so provider redistribution terms are never at risk.
3. **Contract tests run against both implementations.** One shared vitest
   suite (`describeMarketDataContract(makeClient)`) asserts the interface
   semantics, concretely:
   - *PIT:* a fundamentals row filed after `asOf` is invisible; the same
     query at a later `asOf` reveals it; rows lacking a usable `knownAt` are
     dropped, never passed through.
   - *Empty vs. throw:* unknown symbol ⇒ empty result; simulated transport
     failure ⇒ `DataUnavailableError` (fixture provider simulates via a
     poisoned fixture entry; live run skips this case).
   - *Schema:* every row validates against the zod schemas; prices are
     ordered, no duplicate dates; `close`, `adjClose`, and currency present
     on every price row.
   - *Currency & FX:* Oslo rows carry `NOK`; `fxRate("NOKUSD", asOf)`
     returns a rate for every trading day in the fixture range.
   - *Symbols:* `{symbol, mic}` round-trips through the provider's vendor
     format and back.
   - *Earnings:* every earnings event has an announcement date ≤ any
     `asOf` it is visible at; the surprise field is tagged with its quality
     (consensus vs. proxy).
   It always runs against `FixtureMarketData` in CI. The same suite runs
   against each **live** provider only when `LIVE_DATA_TESTS=1` (manual or
   scheduled weekly job) — this is the validation that the real integration
   works and keeps working. If a provider renames a field, the live contract
   test breaks, not a backtest three weeks later. Provider mappers
   additionally get unit tests from raw captured vendor payloads (one
   cassette per endpoint) so mapping bugs are caught without network.
4. **Drift check:** the scheduled live run re-records fixtures to a temp dir
   and diffs against committed fixtures for the pinned historical range —
   historical data should be immutable; a diff means the provider restated
   data or changed semantics, and that is worth an alert.

## Phases

0. **Provider spike (paid, timeboxed).** Before any provider client is
   built: buy one month of each provider's entry tier and verify against raw
   payloads — pre-announcement **estimate vintages** (kill or reframe the
   surprise strategy per the section above), filing **timestamps** vs dates,
   adjustment-factor semantics, delisted-symbol coverage, pagination/rate
   limits, and the license terms for retaining recorded cassettes and
   exposing derived output. Output: a short findings note appended to this
   plan. The engine's phase 1 does not wait for this — only provider work
   does.
1. **Interface + synthetic fixture provider** (engine phase 1):
   `MarketData`, zod schemas, error taxonomy + coverage envelopes,
   `FixtureMarketData` + the fixture generator, contract-test suite. The
   engine's phases 2–3 build entirely on this — no provider account needed.
2. **Financial Datasets provider (US) + recorder**: client, mappers with
   `filing_date` → `knownAt`, the file-based append-only response store,
   recorder script producing private cassettes; run the contract suite live
   once. This unblocks live US data for plan 002's analysts.
3. **EODHD provider (Norway/international)**: client with rate limiting,
   mappers, `XOSL` registry routing, NOK + FX live coverage, the
   earnings-momentum fallback tagging; record the Oslo cassette set and run
   the live contract tests over it.
4. **Ops**: `LIVE_DATA_TESTS` weekly job + drift check, per-team encrypted
   BYO keys (SaaS phase), usage metering per team.

## Considered and rejected

- **Committing recorded real data as the public fixture set.** The original
  draft of this plan did exactly that; it dies on provider redistribution
  terms — fresh contributors and CI would need keys, defeating the zero-key
  goal. Hence the two-tier split: synthetic-generated fixtures public,
  recorded cassettes private. Ad-hoc hand-written mock *values* (numbers
  typed inline in tests) remain forbidden — synthetic data comes only from
  the reviewed, versioned generator.
- **HTTP-level replay (VCR-style cassettes) as the primary mock.** Couples
  tests to vendor wire formats; recording *normalized* fixtures tests our
  mappers once at record time and keeps fixtures provider-agnostic. (A thin
  cassette layer may still be used inside provider-mapper tests.)
- **A single provider for everything.** EODHD alone could technically cover
  both markets, but US fundamentals PIT fidelity is the backbone of backtest
  credibility, and Financial Datasets is strictly better there (server-side
  filing-date filtering, per-filing earnings history). Two providers behind
  one registry costs one extra mapper; a subtly leaky US dataset costs trust
  in every published backtest. Consolidating onto EODHD stays a config
  change if the second key ever isn't worth it.
- **Scraping Oslo Børs / Yahoo for the long tail.** Legal and reliability
  risk incompatible with an open-source SaaS.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | CLEAR (absorbed) | 15 findings, 9 folded in full, 5 folded reduced, 1 rejected |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | see per-plan notes below |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

Eng review notes (2026-07-13, autonomous): added FX rates to MarketData, adjusted-price field mapping, append-only revision-aware response store, coverage-status envelopes, timestamp-grade knownAt with fail-loud on missing values, two-tier fixture strategy (synthetic public / recorded private), securityId seam, and a paid provider spike as phase 0 (estimate vintages are its kill-or-reframe question).

- **CODEX:** outside voice (Codex CLI, gpt-5.5 high, read-only) — data-plan findings 11–14 all folded: coverage envelopes, securityId seam, fixture-license contradiction resolved via the two-tier split, provider spike promoted to phase 0.
- **CROSS-MODEL:** no unresolved tension on this plan.
- **VERDICT:** ENG + CODEX CLEARED — phases 0–1 ready; phases 2–3 gated on the spike's findings.

NO UNRESOLVED DECISIONS
