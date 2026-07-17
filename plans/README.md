# Plans

Implementation plans. Each plan is self-contained: an executor with no
context from the session that produced it should be able to run it end to
end. Executors: read the plan fully before starting, honor its STOP
conditions, and update your row here when done.

Plans 001–003 were written against commit `6925655`; plans 007–015 against
commit `67eb565` (2026-07-15 advisor audit); plans 016–021 against commit
`bb1ee76` (2026-07-17 advisor audit).

## Execution order & status

| # | Plan | Category | Effort | Risk | Status |
| --- | --- | --- | --- | --- | --- |
| 001 | [Enforce the session invariant structurally, not with a checkbox](./001-enforce-session-invariant.md) | Security / DX | M | Low | DONE — the DAL `no-restricted-imports` boundary is live in `apps/web/eslint.config.js` |
| 002 | [The engine: first-principles architecture and build plan](./002-engine-architecture.md) | Architecture | XL | Medium | DONE — `packages/engine` + `packages/db` built and tested; scheduled cycles remain future scope |
| 003 | [Market data acquisition: providers, Norwegian coverage, and the fixture strategy](./003-market-data-acquisition.md) | Architecture / Data | L | Medium | TODO |
| 004 | [Durable run execution on Vercel Workflow](./004-durable-runs-vercel-workflow.md) | Architecture | L | Medium | DONE — `apps/web/workflows/execute-run.ts` + SSE routes shipped |
| 005 | [A simulated live run on the public demo](./005-live-demo-runs.md) | Product / Demo | M | Low | DONE — shipped in `5839f65`..`67eb565` |
| 006 | ["Ask the fund": a scripted conversational surface](./006-ask-the-fund-chat.md) | Product / Demo | M | Low | DONE — shipped as "Ask Hodget" in `56c03cf`..`5da337f` |
| 007 | [Make `pnpm lint` pass on main + fix stale front-door docs](./007-green-the-lint-gate.md) | DX / Security | S | LOW | DONE |
| 008 | [Preserve the original error and evict poisoned connections in `transaction()`](./008-transaction-rollback-integrity.md) | Bug | S | LOW | DONE |
| 009 | [Harden the public surfaces: waitlist RLS + rate limit, schema caps, security headers](./009-harden-public-surfaces.md) | Security | M | LOW/MED | DONE |
| 010 | [Code-split the heavy viz libraries; server-ify DashboardView](./010-code-split-heavy-viz.md) | Perf | M | LOW/MED | DONE |
| 011 | [Run-stream correctness: SSE terminal fallback + workflow-id persist](./011-run-stream-correctness.md) | Bug | M | LOW/MED | DONE |
| 012 | [Component-test foundation: jsdom harness, simulated-run tests, ui test script](./012-web-test-foundation.md) | Tests | M | LOW | DONE |
| 013 | [Playwright E2E smoke: public surfaces + auth redirect](./013-e2e-smoke.md) | Tests | M | LOW | DONE |
| 014 | [CI Turbo cache, pre-commit hooks, env docs, real AGENTS.md](./014-ci-and-dx-loops.md) | DX | S | LOW | DONE |
| 015 | [Resolve the three unowned frontend dependency decisions](./015-frontend-dependency-decisions.md) | Tech debt | S | LOW | DONE |
| 016 | [SSE reconnects resume instead of replaying the run + durable-route tests](./016-sse-resume-on-reconnect.md) | Bug / Tests | M | LOW | DONE — reviewed & approved; branch `advisor/016-sse-resume-on-reconnect` (worktree), awaiting merge |
| 017 | [Spike behind the typecheck gate; verdicts fail honest; env scaffold](./017-spike-hardening.md) | Bug / DX | S | LOW | DONE — reviewed & approved; branch `advisor/017-spike-hardening` (worktree), awaiting merge |
| 018 | [Bound panel-seat weight (plan 009's missed field)](./018-bound-panel-seat-weight.md) | Bug / Security | S | LOW | DONE — reviewed & approved; branch `advisor/018-bound-panel-seat-weight` (worktree), awaiting merge |
| 019 | [Workflow-endpoint gating: verify or enforce](./019-workflow-endpoint-gating.md) | Security | M | MED | DONE — outcome A (platform gate verified: WDK routes are Vercel Queue consumers, not public HTTP; e2e probe added); branch `advisor/019-workflow-endpoint-gating` (worktree), awaiting merge |
| 020 | [Stream the runs page; truthful overview badge](./020-runs-page-streaming-and-badge.md) | Perf / Docs | S | LOW | DONE — reviewed & approved; branch `advisor/020-runs-page-streaming-and-badge` (worktree); visual check pending post-merge |
| 021 | [Enforce nonce-based CSP on auth + dashboard surfaces](./021-enforce-csp.md) | Security | M | MED | DONE — reviewed & approved on 2nd run (1st correctly STOPPED on the next-themes inline script; plan refreshed to hash-cover it); branch `advisor/021-enforce-csp`, awaiting merge. Residual: authenticated /dashboard not e2e-exercised (needs seeded user); style-src unsafe-inline retained by design |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (with one-line reason) |
REJECTED (with one-line rationale).

## Dependency notes

- **007 first.** CI's lint gate has been red for 26 of the last 27 pushes;
  every other plan's verification story assumes a green gate. 009 also edits
  the `lib/dal/waitlist.ts` module that 007 creates, and 014's pre-commit
  hooks would block all commits while lint is red.
- 008, 010, 011, 012, 013, 015 are mutually independent and can run in any
  order after 007.
- 012 (harness) before any future plan that wants component tests; 013 is
  independent of 012.
- 014's E2E-in-CI follow-up lands only after 013.
- **016–021 (2026-07-17 batch)**: 016, 017, 018, 020 are mutually independent
  and can run in any order. 017 should land before any plan-003 phase-1
  provider decision (its verdict-integrity fix invalidates findings.md files
  generated under partial failure). **019 and 021 both modify
  `apps/web/proxy.ts` — run them sequentially, not in parallel worktrees**
  (either order). 021 prefers landing after 016/020 so the pages exercised in
  its violation inventory are final.

## Direction options (2026-07-17 audit — maintainer's call, not planned)

- **A. Wire the `/dashboard` overview to real run data.** The first signed-in
  screen is 100% `DEMO_DASHBOARD` while `listRuns`/`getRunDetail` and the
  metrics parsers (`run-source.ts`) already exist. Effort M; needs an honest
  zero-runs empty state. Plan 020's badge copy is the stopgap until this.
- **B. Panel selection in the New-run dialog.** The `panel-configs` API
  (create/list/validate) is fully built but the dialog hardcodes one quant
  config — users can save panels they can never run, and no web path
  exercises the LLM analysts. Effort M–L; LLM path needs cost/rate guardrails
  first — scope as a design/spike plan.
- **C. Execute plan 003 (market data).** The only TODO on the books and the
  recommended next execution target; the spike is its phase 0 (run it after
  017 lands). Everything today is fixture-backed.
- **D. Scheduled cycles.** Durable workflows + executor + ledger already
  exist; roughly a cron trigger + idempotency design over the existing run
  path. Only meaningful after C. Scope as a design plan.

## Findings considered and rejected (2026-07-17 audit)

- **`decision-log.tsx` (461 lines) untested**: the audit's initial report
  mis-attributed it — `real-run-detail.tsx` defines its own small
  `DecisionLog` for real data, already covered by
  `real-run-detail.test.tsx`; the 461-line component renders the static
  `DECISION_LOG` demo fixture only (same class as the accepted fake-pagination
  fixture UI). Not worth a plan.
- **Spike internal duplication** (`classifySplit` vs inline split detection,
  duplicated rate-limit probes): real but throwaway phase-0 code; consolidate
  only if the spike outlives plan 003.
- **vitest specifier drift** (`^3.2.7` in ui vs `^3` elsewhere): cosmetic;
  normalize opportunistically in a future deps pass.
- **Live-run feed O(n) re-render per SSE frame** (`live-run-dialog.tsx:298`):
  bounded at `MAX_FEED = 400`, LOW-confidence smell — investigate only if the
  dialog stutters on long runs.
- **Fixture run-detail pays a guaranteed-miss DB query**
  (`runs/[id]/page.tsx` tries `getRunDetail` before the fixture fallback):
  one cheap query vs. MED risk of eroding the deliberate
  ownership-privacy design (non-owned UUIDs indistinguishable from fixture
  ids). Not worth it.
- **README "paper or live" execution wording**: defensible as an architecture
  diagram; only backtest is wired to any surface. Revisit the wording when
  paper runs ship — not planned.
- **`pnpm audit --prod`** (now works again): 2 moderate transitive advisories
  (`postcss` via next, `js-yaml` via shadcn CLI), build/dev paths only — a
  routine `pnpm update` clears both; below the planning bar.

## Findings considered and rejected (2026-07-15 audit)

- **AI SDK "version mismatch" (`@ai-sdk/react@4` with `ai@7`)**: verified
  correct — `@ai-sdk/react@4.0.30` is current and depends on exactly
  `ai@7.0.28`; the majors are versioned independently. Not a finding.
- **Open email/password sign-up with Better Auth defaults**: normal for the
  product stage; secure cookie defaults confirmed. Revisit before brokerage
  connections ship.
- **Fake pagination in `runs-view.tsx`**: documented, self-contained fixture
  UI; not debt worth acting on.
- **Engine math boundary conditions**: audited clean — denominators guarded,
  empty collections handled, integer shares asserted.
- **Dependency currency**: core deps current (Next 16.2.6, React 19.2.4,
  Tailwind 4.3, better-auth 1.6.23, zod 4.4.3); available majors are
  dev-tooling only. `pnpm audit` fails against the retired npm quick-audit
  endpoint — wiring an advisory scanner into CI is noted inside plan 014's
  maintenance orbit, not planned.
- **Workflow-retry event duplication (WDK `getWritable` semantics)**:
  LOW-confidence investigate item, recorded in plan 011's maintenance notes
  rather than planned as a fix.
- **`demo-data.ts` god-module split (fan-in 33)**: real but deliberately
  deferred; plan 010 captures most of the bundle win without the churn.
  Revisit when fixture edits start colliding.
- **`/.well-known/workflow/**` in-repo gating**: MED-confidence finding
  (documented deployment assumption, unenforced in code); not selected for
  planning this round — picked up by the 2026-07-17 audit as plan 019.

## Considered and rejected (original 2025 audit)

- **A custom ESLint rule that checks every `page.tsx` under a protected route
  calls `requireSession()`.** This enforces the wrong invariant. It can be
  satisfied by calling `requireSession()` and then querying data with an
  unrelated client, and it cannot see data access inside imported helpers. The
  import boundary in plan 001 is both simpler and stronger.
- **Validating the session inside `proxy.ts`.** Would run a database query on
  every request including prefetches. Next.js explicitly advises against it, and
  Better Auth does too.
- **Relying on a layout to protect its child routes.** Layouts do not re-render
  on every navigation within their segment, so this leaks.
