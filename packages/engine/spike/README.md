# Provider spike (plan 003, phase 0)

A runnable, timeboxed harness that probes the two market-data providers against
**raw payloads** to answer the open questions in
[`plans/003-market-data-acquisition.md`](../../../plans/003-market-data-acquisition.md)
(see _Phases → 0_) before any provider client is built: estimate vintages,
filing timestamps vs. dates, split-adjustment semantics, delisted coverage,
history depth, rate limits, and — the linchpin — whether Oslo Børs quarterly
fundamentals carry a usable `filing_date`.

This is a spike tool, **not engine code**: zero new dependencies (native
`fetch` + `node:fs`), never imported by `src/` or the public barrel.

## Run

```bash
pnpm --filter @workspace/engine spike
```

With no keys set it still runs the EODHD **demo tier** live (checks 8–11) and
skips every keyed check. To run the full suite:

```bash
FINANCIAL_DATASETS_API_KEY=… EODHD_API_TOKEN=… pnpm --filter @workspace/engine spike
```

| Env var                      | Unlocks                         | Unset behavior                                   |
| ---------------------------- | ------------------------------- | ------------------------------------------------ |
| `FINANCIAL_DATASETS_API_KEY` | `fd-*` checks (US equities)     | all `fd-*` checks report `skipped`               |
| `EODHD_API_TOKEN`            | `eodhd-*` Oslo/paid checks      | falls back to the public `demo` token; paid checks `skipped` |

The `demo` token only covers AAPL.US, TSLA.US, VTI.US, AMZN.US, BTC-USD.CC,
EURUSD.FOREX.

## Output (gitignored)

Written to `spike/output/` — **never commit it**; recorded real provider data
is private-tier under plan 003's licensing rule.

- `cassettes/<provider>.<check-id>.<n>.json` — every raw payload fetched (API
  keys redacted).
- `findings.md` — a generated note formatted to append to plan 003 nearly
  verbatim, ending in an _Interpretation_ section with TODO markers for the
  human verdicts (estimate vintage, adjustment semantics, Oslo `filing_date`).

## Files

- `harness.ts` — check model + polite (serialized, ~300ms-spaced) HTTP client,
  cassette recorder, run loop. HTTP errors become `fail` results; a thrown
  check never aborts the run.
- `checks/financial-datasets.ts`, `checks/eodhd.ts` — the check suites.
- `findings.ts` — the `findings.md` renderer.
- `run-spike.ts` — entry point.

## Typecheck

The suite uses explicit `.ts` import specifiers (required by Node's
`--experimental-strip-types`), so it typechecks under its own config rather than
the package root:

```bash
pnpm --filter @workspace/engine spike:typecheck
```
