# Plan 021: Move CSP from report-only to enforcing on the surfaces that handle credentials

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat bb1ee76..HEAD -- apps/web/next.config.ts apps/web/proxy.ts apps/web/e2e`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED — an enforcing CSP that misses a legitimate inline script breaks the page for real users; every flip must be preceded by a clean violation pass
- **Depends on**: none (but land after 016/020 so the pages you exercise are final)
- **Category**: security
- **Planned at**: commit `bb1ee76`, 2026-07-17; **refreshed 2026-07-17 after a first
  executor run STOPPED** (correctly) on its step-2 inventory — see "Known inventory
  result" below. The refresh folds that finding into the approach; the plan is
  otherwise unchanged.

## Why this matters

Plan 009 shipped CSP as `Content-Security-Policy-Report-Only` — the right
first move, but the "prove clean, then enforce" second step never happened. A
report-only policy enforces nothing: today there is no CSP-based mitigation of
injected script on the pages that handle auth credentials (sign-in/sign-up)
and the authenticated dashboard, and the current policy's
`script-src 'unsafe-inline'` would neuter most of its XSS value even if
flipped as-is. `SECURITY.md` names credential exposure as top-priority scope.
This plan converges the control: an enforcing, nonce-based CSP on the
dynamic authenticated/auth surfaces, with report-only retained everywhere
else as a canary.

The scoping matters: a per-request nonce forces dynamic rendering, and the
public landing/blog/demo pages are static — blanket-enforcing a nonce CSP
would destroy their static rendering. The dashboard and auth pages are
already dynamic (session reads). So: **enforce with nonces where dynamic,
keep report-only where static.**

## Current state

`apps/web/next.config.ts:29-48` (as of `bb1ee76`) — the only CSP in the app:

```ts
return [
  {
    source: "/(.*)",
    headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      },
      {
        key: "Content-Security-Policy-Report-Only",
        value:
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
      },
    ],
  },
]
```

- `apps/web/proxy.ts` — the middleware-equivalent file (this Next version
  uses `proxy.ts`); currently only does the optimistic auth redirect with
  `matcher: ["/dashboard/:path*"]`. Per-request nonces are generated here.
- Surfaces: dynamic (session-reading) routes = `/dashboard/**`, `/sign-in`,
  `/sign-up`. Static/public = `/`, `/blog/**`, `/demo/**`, `/playbook`,
  `/waitlist`.
- E2E harness: `apps/web/e2e/` (Playwright; `cd apps/web && pnpm build && pnpm test:e2e`).
- **This is NOT the Next.js you know** (repo rule, `AGENTS.md` line 1): read
  the CSP guide in `node_modules/next/dist/docs/` before writing any code —
  the nonce plumbing (how a nonce set in `proxy.ts` reaches script tags) must
  come from the installed version's docs, not from memory. If no CSP guide
  exists there, search the docs directory for "nonce".
- `connect-src 'self'` already covers the SSE `EventSource` (same-origin) —
  don't loosen it.

**Known inventory result (from the 2026-07-17 first executor run — verify,
don't rediscover):** the app's source contains zero inline `<script>` tags,
zero `dangerouslySetInnerHTML`, zero `next/script` usage. The ONE
non-framework inline script in rendered HTML is the `next-themes`
FOUC-prevention theme-detection script, injected by `ThemeProvider`
(`apps/web/components/theme-provider.tsx`, mounted in the root
`app/layout.tsx`). Next's automatic nonce stamping does NOT cover it. Do NOT
solve this by threading `next-themes`' `nonce` prop through the root layout:
reading `headers()` in the root layout would force every route — including the
static landing/blog/demo pages — dynamic, violating this plan's scoping
promise. Instead, cover it with a **`'sha256-<hash>'` source in the enforcing
`script-src`**: the script's content is deterministic for a fixed
`ThemeProvider` config and `next-themes` version, so its hash is stable across
requests and pages. The hash is brittle across `next-themes` upgrades — the
e2e spec in step 5 exists precisely to catch that.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck/lint | `pnpm --filter web typecheck && pnpm --filter web lint` | exit 0 |
| Prod build + e2e | `cd apps/web && pnpm build && pnpm test:e2e` | all pass |
| Dev server | `pnpm dev` | app on :3000 |
| Header check | `curl -sI http://localhost:3000/sign-in \| grep -i content-security` | shows the enforcing header on dynamic routes |

## Scope

**In scope** (the only files you should modify):
- `apps/web/next.config.ts`
- `apps/web/proxy.ts`
- `apps/web/e2e/` (new spec or extension: header assertions + page-loads-clean)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch):
- Any component/page file — if a page needs code changes to satisfy CSP
  (e.g. an inline event handler), STOP and report; inventory first.
- The other security headers in `next.config.ts` — unchanged.
- `style-src` hardening — Tailwind v4 and the component library lean on
  inline styles; keep `style-src 'self' 'unsafe-inline'` this round and note
  it as a documented residual (script-src is where the XSS value is).

## Git workflow

- Branch: `advisor/021-enforce-csp`
- Conventional commit, e.g. `feat(security): enforce nonce-based CSP on auth + dashboard surfaces`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Read the installed docs, confirm the nonce mechanism

Read the CSP/nonce guidance in `node_modules/next/dist/docs/` for the
installed Next version. Confirm: (a) how a nonce generated per-request in
`proxy.ts` is attached (request header, e.g. `x-nonce`) so the framework
stamps it on its own inline scripts; (b) whether `'strict-dynamic'` is the
recommended companion. Record the doc path you used in your report.

**Verify**: you can name the mechanism with a doc citation. If the installed
docs describe no nonce mechanism, STOP and report.

### Step 2: Violation inventory under the current policy

Run the production build locally (`cd apps/web && pnpm build && pnpm start`),
open each dynamic surface (`/sign-in`, `/sign-up`, `/dashboard`,
`/dashboard/runs`, one run detail, `/dashboard/decisions`) and list every CSP
violation the report-only policy logs. Classify each: framework inline script
(nonce will cover), the known `next-themes` script (hash will cover — extract
its exact bytes from the rendered HTML and compute
`sha256 -> base64` for the CSP source; confirm the hash is identical across at
least `/sign-in` and `/dashboard`), or anything else (STOP-worthy). Also
exercise a New-run dialog start so the SSE path is covered.

**Verify**: a written inventory in your report; zero violations in the
"anything else" class — otherwise STOP. The `next-themes` hash recorded and
identical across pages — otherwise STOP (hash instability breaks the whole
approach).

### Step 3: Nonce generation + enforcing header on dynamic routes

In `apps/web/proxy.ts`:

- Extend the matcher with `/sign-in` and `/sign-up` alongside
  `/dashboard/:path*`. The auth-redirect branch must keep firing ONLY for
  `/dashboard` paths (sign-in/up are public — guard the existing redirect
  logic on the path).
- Generate a per-request nonce (per the step-1 mechanism), attach it the way
  the installed docs prescribe, and set an enforcing
  `Content-Security-Policy` response header for these routes:
  `default-src 'self'; script-src 'self' 'nonce-<nonce>' 'sha256-<theme-script-hash>'`
  (+ `'strict-dynamic'` if step 1 recommends it — note that with
  `'strict-dynamic'` the hash must still be listed, and verify the theme
  script still executes since it is parser-inserted); carry over the existing
  `style-src/img-src/font-src/connect-src/frame-ancestors` values unchanged.
  Put the hash in a named constant with a comment stating it is the
  `next-themes` FOUC script hash and must be recomputed when `next-themes` is
  upgraded (the step-5 e2e spec fails loudly if stale).

In `apps/web/next.config.ts`: keep the global report-only header as the
canary, but exclude nothing — duplicated report-only on dynamic routes is
harmless and keeps one source of truth for the static surfaces. Add a comment
tying the two layers together and pointing at this plan.

**Verify**: `pnpm --filter web typecheck && pnpm --filter web lint` → exit 0.
`curl -sI http://localhost:3000/sign-in | grep -i content-security` (against
`pnpm start` of a prod build) → shows BOTH the enforcing header (with a
nonce) and the report-only header; `curl -sI http://localhost:3000/` → shows
ONLY report-only.

### Step 4: Prove the dynamic surfaces work enforced

With the prod build running, repeat the step-2 walk of every dynamic surface,
console open: zero CSP violation errors, pages fully functional (theme
toggle, charts, run dialog, SSE stream).

**Verify**: manual pass documented in your report, no violations.

### Step 5: E2E lock-in

Add `apps/web/e2e/csp.spec.ts` (model on `smoke.spec.ts`):

- `/sign-in` response carries an enforcing `content-security-policy` header
  containing `nonce-`;
- `/` (static landing) carries `content-security-policy-report-only` and NOT
  the enforcing header;
- `/sign-in` renders its form with zero `console` errors mentioning
  "Content Security Policy" (Playwright console listener).

**Verify**: `cd apps/web && pnpm build && pnpm test:e2e` → all pass.

### Step 6: Full gate + index

**Verify**: `pnpm typecheck && pnpm lint && pnpm test` → all green. Update
this plan's row in `plans/README.md`, noting the residual (`style-src
'unsafe-inline'` retained; static surfaces still report-only).

## Test plan

The e2e spec in step 5 is the regression lock. No unit tests — the logic
lives in header emission, which e2e observes directly.

## Done criteria

- [ ] Enforcing nonce CSP on `/sign-in`, `/sign-up`, `/dashboard/**` (curl-verified)
- [ ] Static surfaces unchanged: report-only, still statically rendered (`pnpm build` output does not newly mark `/`, `/blog/**`, `/demo/**` as dynamic)
- [ ] Step-2 and step-4 violation inventories in the report, final pass clean
- [ ] `csp.spec.ts` passing in the e2e suite
- [ ] `pnpm typecheck && pnpm lint && pnpm test` all exit 0
- [ ] `plans/README.md` status row updated with residuals

## STOP conditions

Stop and report back (do not improvise) if:

- The installed Next docs describe no workable nonce mechanism (step 1).
- The violation inventory contains anything other than framework inline
  scripts or the known `next-themes` script — each such item needs a code
  change that is out of scope here.
- The `next-themes` script's hash differs between pages or requests (the
  hash-based coverage assumption is broken — nonce threading would be needed,
  which requires a scope extension the advisor must approve).
- Enforcing CSP breaks the SSE stream, the run dialog, or charts in step 4
  and one focused header adjustment doesn't fix it.
- `pnpm build` shows a previously-static route becoming dynamic because of
  this change — the scoping promise is broken; report.
- Adding `/sign-in`+`/sign-up` to the proxy matcher interacts badly with the
  auth-redirect logic in a way the path guard doesn't cleanly solve.

## Maintenance notes

- Any new third-party script/style origin must be added to BOTH the
  enforcing policy (proxy) and the report-only canary (next.config) — the
  comment added in step 3 says so at the site.
- The deferred hardening: `style-src 'unsafe-inline'` removal, and promoting
  the static surfaces to enforcing (hash-based, no nonce needed) — both are
  follow-ups for a future audit, deliberately not this plan.
- Reviewer focus: the proxy's auth-redirect must not have gained coverage of
  `/sign-in`/`/sign-up` (would loop) — check the path guard.
