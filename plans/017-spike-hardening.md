# Plan 017: Put the provider spike behind the typecheck gate and make its verdicts fail honest

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat bb1ee76..HEAD -- packages/engine/spike packages/engine/package.json packages/engine/tsconfig.json package.json turbo.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug + dx
- **Planned at**: commit `bb1ee76`, 2026-07-17

## Why this matters

`packages/engine/spike/` (~1,260 lines) is the plan-003 phase-0 provider
spike: it probes two market-data providers and renders a `findings.md` verdict
that will drive the provider decision for the whole market-data layer. Three
problems undermine it:

1. **It's outside every gate.** The engine's tsconfig excludes `spike/`, and
   the `spike:typecheck` script exists but nothing (turbo, lefthook, CI) runs
   it — so the spike can silently rot into type errors while CI stays green.
2. **Its verdicts can lie under partial failure.** The self-described
   "LINCHPIN" check can return PASS when one ticker's request failed outright,
   and the delisted-coverage check reports a network error identically to
   genuine zero-coverage. A partial provider outage can produce a falsely
   confident verdict on exactly the questions plan 003 depends on.
3. **Onboarding friction**: the two provider keys live only in README prose
   (no `packages/engine/.env.example`), and the `spike` script's
   `--env-file-if-exists` flag needs Node ≥ 20.12 while the repo pins
   `>=20` — a Node 20.0–20.11 contributor gets an unknown-option crash.

## Current state

Files:

- `packages/engine/tsconfig.json` — `"include": ["src", "fixtures", "vitest.config.ts"]`;
  spike is not covered.
- `packages/engine/spike/tsconfig.json` — a working standalone config
  (`noEmit`, `allowImportingTsExtensions`, includes `.`, excludes `output`).
- `packages/engine/package.json:19-20` —
  `"spike": "node --env-file-if-exists=.env --experimental-strip-types spike/run-spike.ts"` and
  `"spike:typecheck": "tsc -p spike/tsconfig.json"` (orphan — nothing calls it).
- `turbo.json` — tasks: build/lint/format/typecheck/test/dev; the `typecheck`
  task is `tsc --noEmit` per package via each package's `typecheck` script.
- `packages/engine/spike/checks/eodhd.ts` — the `eodhd-oslo-filing-date`
  check ("THE LINCHPIN", lines 271–320).
- `packages/engine/spike/checks/financial-datasets.ts` — the `fdDelisted`
  check (~lines 260–300).
- `packages/engine/spike/README.md` — documents `FINANCIAL_DATASETS_API_KEY`
  and `EODHD_API_TOKEN` in prose only.
- Root `package.json:26-28` — `"engines": { "node": ">=20" }`.

The linchpin's failure-handling bug, `packages/engine/spike/checks/eodhd.ts`
(as of `bb1ee76` — the loop starting ~line 281, verdict at ~line 307):

```ts
let worstFraction = 1
let anyFailure = false

for (const ticker of tickers) {
  const probe = await probeFundamentals(ctx, ticker, "Financials::Income_Statement::quarterly")
  if (!probe.res.ok || probe.res.json === undefined) {
    anyFailure = true
    perTicker[ticker] = { error: httpFailDetail(probe.res), path: probe.path }
    continue                      // ← a failed ticker contributes NOTHING to worstFraction
  }
  ...
  worstFraction = Math.min(worstFraction, fraction)
  ...
}

if (anyFailure && worstFraction === 1) {   // ← only fires if every succeeding ticker was perfect
  return { status: "fail", detail: "fundamentals request failed for at least one Oslo ticker", evidence: perTicker }
}
const pass = worstFraction >= 0.9
return { status: pass ? "pass" : "fail", ... }
```

Failure scenario: EQNR.OL's request fails (network), DNB.OL is at 92% →
`anyFailure=true`, `worstFraction=0.92` → the guard is skipped and the check
returns **PASS** ("PIT knownAt is derivable directly") with a ticker never
evaluated.

The delisted check's blind spot, `packages/engine/spike/checks/financial-datasets.ts`
(verdict at ~line 294):

```ts
const prices = await fetchDailyCloses(ctx, "BBBY", "2022-01-01", "2022-12-31")
...
const covered = prices.points.length > 0
return {
  status: "pass",
  detail: `... Delisted handling: ${covered ? "history retained after delisting" : "prices drop out — treat as not-covered, not covered-empty"}.`,
  evidence,  // includes price_error, but the status/detail ignore it
}
```

Failure scenario: the price fetch errors (`prices.error` set, 0 points) → the
check still reports the definitive-sounding "prices drop out — treat as
not-covered", indistinguishable from a genuine zero-coverage result.

Check result statuses available (from `spike/harness.ts`): `"pass" | "warn" |
"fail" | "skipped"`.

Conventions: the spike is deliberately dependency-free, never imported by
`src/` or the public barrel — keep it that way. Cross-file imports use
explicit `.ts` extensions (required by Node's strip-types runner and permitted
by the spike tsconfig's `allowImportingTsExtensions`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Spike typecheck | `pnpm --filter @workspace/engine spike:typecheck` | exit 0 |
| Engine typecheck | `pnpm --filter @workspace/engine typecheck` | exit 0 |
| Full gate | `pnpm typecheck && pnpm lint && pnpm test` | all green |
| Spike (keyless) | `pnpm --filter @workspace/engine spike` | runs demo-tier checks, writes `spike/output/` — only needed for step-4 manual sanity, requires network |

## Scope

**In scope** (the only files you should modify):
- `packages/engine/package.json` (fold spike typecheck into the gate)
- `packages/engine/spike/checks/eodhd.ts` (linchpin verdict logic)
- `packages/engine/spike/checks/financial-datasets.ts` (`fdDelisted` verdict logic)
- `packages/engine/.env.example` (create)
- `packages/engine/spike/README.md` (point at the example file)
- Root `package.json` (engines pin)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `packages/engine/tsconfig.json` — do NOT add `spike/` to its include: the
  spike needs `allowImportingTsExtensions` and `.ts` specifiers that the main
  build must not inherit. Chain the scripts instead (step 1).
- `turbo.json` — no new task needed once the engine's own `typecheck` script
  chains the spike check.
- Other spike checks' logic, the harness, `findings.ts` — only the two checks
  named above have the verdict bug; don't refactor shared scaffolding
  (deliberately deferred — spike code is throwaway once plan 003 lands).
- `.gitignore` — `packages/engine/.env` is already ignored (verify, don't
  edit unless the verify fails).

## Git workflow

- Branch: `advisor/017-spike-hardening`
- Conventional commits, e.g. `fix(engine): spike verdicts fail honest under partial provider failure`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Chain the spike typecheck into the engine's typecheck script

In `packages/engine/package.json`, change:

```json
"typecheck": "tsc --noEmit",
```

to:

```json
"typecheck": "tsc --noEmit && tsc -p spike/tsconfig.json",
```

(keep `spike:typecheck` as the standalone alias). Turbo's `typecheck` task
runs each package's script, so this puts the spike behind `pnpm typecheck`,
lefthook's pre-commit, and CI in one move.

**Verify**: `pnpm --filter @workspace/engine typecheck` → exit 0. If the spike
currently has type errors, fix them (they're the drift this gate exists to
catch) — but if fixing needs > ~10 focused edits, STOP and report.

### Step 2: Make the linchpin fail honest

In `eodhd.ts`'s `eodhdOsloFilingDate.run`, make any per-ticker request
failure force a non-pass verdict regardless of `worstFraction`. Replace the
`anyFailure && worstFraction === 1` guard with an unconditional
`if (anyFailure)` returning `status: "fail"` whose detail names the failed
tickers (they're already recorded in `perTicker` with an `error` key), e.g.
"fundamentals request failed for <tickers> — verdict withheld; rerun before
trusting this check". Keep the existing ≥90% pass logic for the
all-requests-succeeded path unchanged.

**Verify**: `pnpm --filter @workspace/engine spike:typecheck` → exit 0.

### Step 3: Make `fdDelisted` distinguish error from absence

In `financial-datasets.ts`'s delisted check, branch on `prices.error` before
concluding coverage: if `prices.error` is set, return `status: "warn"` with a
detail saying the price probe errored and the delisted-coverage question is
unanswered (keep the evidence object as-is — it already carries
`price_error`). Only when the fetch succeeded may the existing
covered/not-covered verdict be issued.

**Verify**: `pnpm --filter @workspace/engine spike:typecheck` → exit 0.

### Step 4: Scaffold the env file and fix the Node floor

1. Create `packages/engine/.env.example`:

```bash
# Provider keys for the plan-003 spike (pnpm --filter @workspace/engine spike).
# Copy to packages/engine/.env — never commit the copy. See spike/README.md.
FINANCIAL_DATASETS_API_KEY=
EODHD_API_TOKEN=
```

2. In `packages/engine/spike/README.md`, add one line pointing at it
   (`cp .env.example .env` from `packages/engine/`).
3. In the root `package.json`, change `"node": ">=20"` to `"node": ">=20.12"`
   (`--env-file-if-exists` landed in Node 20.12; the repo already requires it
   to run the spike).
4. Confirm `git check-ignore packages/engine/.env` reports the path as
   ignored.

**Verify**: `git check-ignore packages/engine/.env` → prints the path;
`git status` shows `.env.example` (not `.env`) as the only new file here.

### Step 5: Full gate + index

**Verify**: `pnpm typecheck && pnpm lint && pnpm test` → all green. Update
this plan's row in `plans/README.md`.

Optional manual sanity (network required): `pnpm --filter @workspace/engine spike`
with no keys still completes the demo-tier checks and writes
`spike/output/findings.md`.

## Test plan

The spike has no test harness and is throwaway phase-0 tooling — adding one is
out of scope. The verification gates are the typecheck chain (step 1) and the
optional keyless spike run. If you can trivially extract the two verdict
functions into pure helpers to unit-test, don't: that's refactoring throwaway
code this plan explicitly avoids.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm --filter @workspace/engine typecheck` runs BOTH tsc invocations (visible in output) and exits 0
- [ ] `grep -n 'worstFraction === 1' packages/engine/spike/checks/eodhd.ts` returns no matches
- [ ] `grep -n 'prices.error' packages/engine/spike/checks/financial-datasets.ts` shows the new branch feeding the returned status
- [ ] `packages/engine/.env.example` exists; `git check-ignore packages/engine/.env` passes
- [ ] Root `package.json` engines says `">=20.12"`
- [ ] `pnpm typecheck && pnpm lint && pnpm test` all exit 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts above don't match the live code (drift since `bb1ee76`).
- Step 1 surfaces more than ~10 pre-existing spike type errors — that's a
  bigger drift story the advisor should see before you burn time on it.
- Chaining the spike typecheck breaks the turbo `typecheck` task in a way a
  script-level fix can't resolve (e.g. cache-key issues) — report rather than
  adding a new turbo task, which this plan deliberately avoids.
- A previously-generated `spike/output/findings.md` was already pasted into
  plan 003 as a decision input — flag it for regeneration; don't edit plan 003.

## Maintenance notes

- When plan 003 phase 1 lands and the spike retires, delete `spike/` AND
  remove the chained `tsc -p spike/tsconfig.json` from the engine's
  `typecheck` script — a dangling reference would break the gate.
- Any findings.md generated before this fix is suspect if its run log shows
  request failures; regenerate before using it to pick a provider.
- Reviewer focus: step 2 must not weaken the all-success path — the ≥90%
  threshold semantics are unchanged; only failure handling got stricter.
