# Plan 013: Playwright E2E smoke — public surfaces and the auth redirect

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 67eb565..HEAD -- apps/web/app/demo apps/web/app/page.tsx apps/web/proxy.ts apps/web/package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (additive; runs against a local prod build)
- **Depends on**: none (plan 012 is the unit/component layer; this is independent)
- **Category**: tests
- **Planned at**: commit `67eb565`, 2026-07-15

## Why this matters

There is no E2E layer at all (no playwright/cypress config anywhere). The
public demo — the thing prospective users actually touch — is verified only
by hand. This plan adds a small Playwright smoke suite that boots the real
production build and walks the critical public journeys: landing → demo, the
simulated run replay, the Ask conversation, and the unauthenticated
`/dashboard` redirect. Deliberately NOT in scope: the signed-in journey (it
needs a real Postgres for Better Auth; see Maintenance notes).

## Current state

- Public routes (all statically prerendered, no DB needed): `/`, `/demo`,
  `/demo/runs`, `/demo/ask`, `/demo/decisions`, etc.
- The demo "New run" dialog: button labeled "New run" on `/demo`; inside the
  dialog a "Start run" button starts a ~8s scripted replay ending with a
  "Run again" button and a "View full run →" link to
  `/demo/runs/run_8c41ca`.
- `/demo/ask`: a "Send" button submits the next scripted question; after the
  reply streams, four exchanges end with a "Restart" button and the text
  "End of the scripted conversation".
- Unauthenticated `/dashboard`: `apps/web/proxy.ts` (matcher
  `/dashboard/:path*`) does an optimistic cookie check and redirects to
  `/sign-in`; the layout's `requireSession()` is the real guard. With no
  session cookie the proxy redirect fires WITHOUT any DB access — but
  verify this during Step 3; if a DB connection error surfaces instead of a
  redirect, see STOP conditions.
- Build/serve: `cd apps/web && pnpm build && pnpm start` serves on :3000.
  The build requires no secrets for the public pages (waitlist fails soft
  when Supabase env is absent; `DATABASE_URL` is only touched by auth paths).

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build | `cd apps/web && pnpm build` | exit 0 |
| E2E | `cd apps/web && pnpm test:e2e` | all specs pass |
| Typecheck | `pnpm turbo run typecheck --filter=web` | exit 0 |

## Scope

**In scope**:
- `apps/web/playwright.config.ts` (create)
- `apps/web/e2e/smoke.spec.ts` (create)
- `apps/web/package.json` (devDep `@playwright/test`, script
  `"test:e2e": "playwright test"`)
- `apps/web/.gitignore` or root `.gitignore` (playwright-report/, test-results/)

**Out of scope**:
- CI wiring for E2E (plan 014 owns CI; note the follow-up there — browsers
  need installing in CI, which is its own step).
- The signed-in journey (needs disposable Postgres; deferred).
- Any change to app code. If a selector is unstable, prefer accessible-role
  selectors over adding test ids in this plan.

## Git workflow

- Branch: `advisor/013-e2e-smoke`
- Conventional commit (`test(web): playwright smoke for public surfaces`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Install and configure

`pnpm add -D @playwright/test --filter web`, then
`pnpm exec playwright install chromium` (record in the plan report if other
browsers were skipped — chromium-only is intended).

`apps/web/playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
```

Note: `webServer` runs `pnpm start`, so a build must exist — document in the
script or config comment that `pnpm build` precedes `pnpm test:e2e`.

**Verify**: `cd apps/web && pnpm build && pnpm test:e2e` with an empty spec
directory → exits 0 ("no tests found" is acceptable at this step with
`--pass-with-no-tests`, or create the spec first and skip this interim check).

### Step 2: The smoke spec

`apps/web/e2e/smoke.spec.ts`, four tests:

1. **Landing → demo**: `page.goto("/")`; expect the hero heading visible;
   click the link/button whose accessible name matches /demo|live demo/i;
   expect URL `/demo` and the "Demo — mock data" badge visible.
2. **Simulated run replay**: `goto("/demo")`; click button "New run"; click
   button "Start run"; expect text "Run completed" within 20s; expect link
   "View full run →" with href `/demo/runs/run_8c41ca`; click it; expect the
   run detail page to render (heading or the run id visible).
3. **Ask conversation first exchange**: `goto("/demo/ask")`; click button
   "Send"; expect text matching /earnings-drift analyst/ within 20s (the
   first streamed answer); expect the next question ("What did the value
   analyst think?") now shown in the composer input.
4. **Auth redirect**: `goto("/dashboard")`; expect final URL to contain
   `/sign-in`.

Use role-based selectors (`getByRole("button", { name: "Start run" })`).
Generous timeouts on the streaming assertions — the replay takes ~8s by
design.

**Verify**: `cd apps/web && pnpm build && pnpm test:e2e` → 4 passed.

### Step 3: Determinism pass

Run the suite three times in a row; all green each time. Streaming pacing is
deterministic (scripted), so flakes indicate selector/timeout issues — fix
selectors, don't add retries.

**Verify**: `for i in 1 2 3; do pnpm test:e2e || exit 1; done` → exit 0.

## Test plan

The spec above is the test plan (4 specs). No unit tests.

## Done criteria

- [ ] `cd apps/web && pnpm build && pnpm test:e2e` → 4/4 pass, three
      consecutive runs
- [ ] `git status` shows only in-scope files (+ lockfile)
- [ ] Report artifacts are gitignored
- [ ] `plans/README.md` status row updated

## STOP conditions

- `pnpm start` on a fresh build errors without env vars (public pages should
  not need any; if they do, report which var and stop — do not invent values).
- Test 4 produces a DB connection error instead of a redirect (means the
  optimistic proxy assumption is wrong — that's a finding worth reporting,
  not patching here).
- Any spec is flaky across the three runs after selector fixes.

## Maintenance notes

- The signed-in E2E journey (sign-up → dashboard → sign-out) is the natural
  next spec; it needs a disposable Postgres (docker `postgres:16` +
  `DATABASE_URL`) and a Better Auth secret — spec it as its own plan when
  the dashboard shows real data.
- When plan 014 lands, add a CI job: `pnpm build`, `playwright install
  --with-deps chromium`, `pnpm test:e2e`.
- If the demo copy changes ("Run completed", "Start run"), these specs are
  the reminder — update them in the same PR.
