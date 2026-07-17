# Plan 019: Turn the workflow-endpoint trust assumption into something enforced or verified

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat bb1ee76..HEAD -- apps/web/proxy.ts apps/web/lib/dal/run-workflow.ts apps/web/e2e "apps/web/app/.well-known"`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M (mostly investigation; the code change is S)
- **Risk**: MED — over-blocking would break the platform's own workflow invocation; every enforcement step here must be verified against a real deployment before it ships
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `bb1ee76`, 2026-07-17

## Why this matters

Durable run execution (plan 004) generates Workflow DevKit (WDK) routes under
`apps/web/app/.well-known/workflow/v1/` — `step`, `flow`, and
`webhook/[token]`. These entrypoints dispatch the run-execution step bodies
**without any app-level session check**; the code openly documents that trust
rests on platform gating and says "Deployment must verify that
`/.well-known/workflow/**` is not externally invocable" — but nothing in the
repo enforces or verifies that. This was flagged in the 2026-07-15 audit and
carried; it is still open at `bb1ee76`. If the platform gate is absent or
misconfigured, an unauthenticated caller could drive workflow orchestration
directly (compute/resource abuse — cross-user data reads stay blocked because
every read goes through `getOwnedRun`). The job of this plan is to close the
gap between "documented assumption" and "checked fact": establish what WDK
itself verifies, then either add an in-app boundary or a deploy-time
verification that fails loudly if the assumption regresses.

## Current state

- `apps/web/proxy.ts` (entire file is 21 lines) — optimistic auth redirect,
  `matcher: ["/dashboard/:path*"]`; explicitly "not a security boundary".
- `apps/web/app/.well-known/workflow/v1/` — generated WDK route files:
  `step/route.js` (POST/HEAD bound to WDK `stepEntrypoint`), `flow/route.js`,
  `webhook/[token]/route.js`, plus `config.json` and `manifest.json`.
- `apps/web/lib/dal/run-workflow.ts:23-30` — the documented trust model:

```ts
 * Auth model: the generated `/.well-known/workflow/v1/**` routes invoke these step
 * bodies WITHOUT an app-level session check — trust rests on platform gating of the
 * workflow endpoints. Ownership still holds regardless, because a runId only ever
 * enters a workflow via `createRun` (behind `requireSession`), and every read of a
 * run's data stays behind `getOwnedRun`; these steps only ever act on a runId that a
 * session-authorized caller already created. Deployment must verify that
 * `/.well-known/workflow/**` is not externally invocable.
```

- `apps/web/next.config.ts` — a `headers()` block only (security headers);
  no rewrites/redirects/gating for workflow paths. No `vercel.json` /
  `vercel.ts` in the repo.
- E2E harness: `apps/web/e2e/smoke.spec.ts` (Playwright; run with
  `cd apps/web && pnpm build && pnpm test:e2e`) — covers public surfaces and
  auth redirects; a natural home for a "workflow endpoints refuse external
  calls" probe.
- Deploy target: Vercel, project `hodget`. The WDK is the Vercel Workflow
  DevKit; runs are started server-side via `start()` in
  `apps/web/app/api/runs/route.ts` (behind `requireSession`).

Relevant prior decision (2025 audit, recorded in `plans/README.md`): session
validation inside `proxy.ts` was rejected because it would run a DB query per
request. Any gating added here must therefore be **header/secret-shaped, not
session-shaped** — do not re-litigate that decision.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck/lint | `pnpm --filter web typecheck && pnpm --filter web lint` | exit 0 |
| Unit tests | `pnpm --filter web test` | all pass |
| E2E | `cd apps/web && pnpm build && pnpm test:e2e` | all pass |
| WDK docs | `ls node_modules/workflow* node_modules/@vercel 2>/dev/null` then read the WDK package README/docs | — |

## Suggested executor toolkit

- If a `vercel:workflow` or `vercel:vercel-firewall` skill is available in
  your environment, invoke it for current WDK auth semantics and firewall
  rule syntax before step 1 — WDK is young and its docs move faster than
  training data.

## Scope

**In scope** (the only files you should modify — which subset depends on the
step-1 verdict):
- `apps/web/proxy.ts` (only in outcome B below)
- `apps/web/e2e/smoke.spec.ts` or a new `apps/web/e2e/workflow-gating.spec.ts`
- `apps/web/lib/dal/run-workflow.ts` (comment update to reflect the verified
  reality)
- `SECURITY.md` (document the verified gate)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- `apps/web/app/.well-known/workflow/**` — generated WDK files; regenerated
  on build, hand edits are lost and may break the runtime contract.
- `apps/web/workflows/execute-run.ts` and the step bodies — the auth question
  is about who can reach the routes, not what the steps do.
- Session validation in the proxy — rejected in a prior audit (DB query per
  request); see "Current state".

## Git workflow

- Branch: `advisor/019-workflow-endpoint-gating`
- Conventional commit, e.g. `feat(security): verify + gate the workflow entrypoints`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Establish what WDK itself enforces (investigation, ~half the plan)

Read the installed WDK package (`node_modules/workflow`/`@vercel/workflow` —
find the actual package name via `apps/web/package.json`) — its README,
type declarations, and the generated `step/route.js` — and answer with
evidence:

1. Does `stepEntrypoint`/`flowEntrypoint` verify a signature, shared secret,
   or platform-injected header on incoming requests?
2. Is there documented Vercel-platform gating of `/.well-known/workflow/**`
   (e.g. deployment-internal-only invocation) and is it default-on?
3. What does the `webhook/[token]` route accept, and is the token the only
   protection?

Record the answers with file/doc citations in your final report.

**Verify**: you can cite a specific file or doc section for each of the three
questions. If you cannot answer question 1 or 2 with evidence either way,
STOP and report — do not guess and do not add speculative gating.

### Step 2A (outcome A — WDK/platform DOES verify): convert assumption to assertion

If step 1 shows requests are cryptographically verified or platform-gated by
default:

1. Update the `run-workflow.ts` auth-model comment to state the verified
   mechanism with a citation (replace "trust rests on platform gating" with
   the concrete fact and WDK version).
2. Add an e2e probe (`apps/web/e2e/workflow-gating.spec.ts`): an external
   `POST` to `/.well-known/workflow/v1/step` and `/flow` with no
   platform headers must be refused (assert status is one of 401/403/400 —
   pin the exact code you observe against the local build, and add a comment
   that the assertion's purpose is regression-detection of the gate).
3. Document the mechanism in `SECURITY.md` under a short "Workflow
   endpoints" heading.

**Verify**: `cd apps/web && pnpm build && pnpm test:e2e` → all pass including
the new probe.

### Step 2B (outcome B — nothing verifiable protects the routes): add an in-app boundary

If step 1 shows the routes are open by default:

1. Extend `apps/web/proxy.ts` with a second matcher entry
   `"/.well-known/workflow/:path*"` and a branch that rejects requests
   lacking the WDK/platform invocation marker identified in step 1 (header
   or secret — WDK's own docs name what its trigger sends; if it sends
   nothing identifiable, STOP and report, because a homemade shared-secret
   scheme must be designed with the advisor, not improvised).
   Keep the existing `/dashboard` branch behavior byte-identical.
2. Add the same e2e probe as 2A.
3. Update the `run-workflow.ts` comment and `SECURITY.md` accordingly.

**Verify**: `pnpm --filter web test` and the e2e suite pass, AND a real run
still executes end-to-end locally: start the dev server, sign in, trigger a
New run, and confirm it completes (the gate must not block WDK's own
invocation — this is the step most likely to break, hence the MED risk).

### Step 3: Full gate + index

**Verify**: `pnpm typecheck && pnpm lint && pnpm test` → all green. Update
this plan's row in `plans/README.md` — including WHICH outcome (A or B) was
taken and the step-1 evidence, so the next audit doesn't re-open this.

## Test plan

- The e2e probe in step 2 is the durable artifact: it fails if the gate ever
  regresses. Model on `apps/web/e2e/smoke.spec.ts`.
- Outcome B additionally needs a unit test on the proxy branch if the proxy
  logic is non-trivial (mock `NextRequest` with/without the marker header).

## Done criteria

- [ ] Step-1 questions answered with citations in the report
- [ ] Either 2A or 2B fully executed — comment, probe, SECURITY.md all updated consistently
- [ ] E2E suite passes including the new workflow-gating probe
- [ ] Outcome B only: a real run verified end-to-end with the gate active
- [ ] `pnpm typecheck && pnpm lint && pnpm test` all exit 0
- [ ] `plans/README.md` status row updated with the outcome

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1's questions 1–2 cannot be answered with evidence either way.
- Outcome B applies but WDK's trigger sends no identifiable marker — a
  custom secret scheme needs design review, not improvisation.
- The e2e probe passes locally but you have reason to believe production
  behaves differently (e.g. docs say gating exists only on Vercel infra) —
  report the discrepancy; production verification is the operator's call.
- Gating breaks the end-to-end run in outcome B and one focused fix attempt
  doesn't restore it.

## Maintenance notes

- WDK upgrades can change both the generated routes and the auth mechanism —
  re-run the e2e probe's assumptions on every `workflow` package bump (note
  this in the PR description).
- If Vercel Firewall/WAF rules are later adopted for this (a valid
  alternative to outcome B's proxy branch), the e2e probe stays valid — it
  tests the effect, not the mechanism.
- The `webhook/[token]` route's token strength was explicitly step-1 scope;
  if it turned out weak, that's a follow-up finding for the next audit, not
  silently absorbed here.
