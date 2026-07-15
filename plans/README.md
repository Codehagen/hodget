# Plans

Implementation plans. Each plan is self-contained: an executor with no
context from the session that produced it should be able to run it end to
end. Executors: read the plan fully before starting, honor its STOP
conditions, and update your row here when done.

Plans 001–003 were written against commit `6925655`; plans 007–015 against
commit `67eb565` (2026-07-15 advisor audit).

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
  planning this round — carry to the next audit if still open.

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
