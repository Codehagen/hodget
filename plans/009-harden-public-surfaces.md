# Plan 009: Harden the public surfaces — waitlist RLS + rate limit, schema size caps, security headers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 67eb565..HEAD -- apps/web/app/waitlist apps/web/lib/dal/waitlist.ts apps/web/next.config.ts packages/db/src/schema.ts packages/db/src/executor/config.ts supabase/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Note: plan 007 deliberately moves
> the waitlist insert into `lib/dal/waitlist.ts` — that change is expected,
> not drift.)

## Status

- **Priority**: P1
- **Effort**: M (three independent S-sized workstreams)
- **Risk**: LOW (A, B) / MED (C — CSP can break rendering; it ships report-only)
- **Depends on**: plans/007-green-the-lint-gate.md (workstream A edits the waitlist module 007 creates)
- **Category**: security
- **Planned at**: commit `67eb565`, 2026-07-15

## Why this matters

Three defensive gaps around an otherwise solid auth boundary:

- **A.** The waitlist table holds emails (PII) writable via the public
  Supabase anon key. The intended RLS policy ("INSERT-only for anon, no
  SELECT") exists only as a code comment — no committed migration, nothing to
  catch drift. The action also has no rate limiting at all.
- **B.** `runConfigSchema` and `panelConfigInputSchema` validate shape but not
  size: an authenticated user can persist arbitrarily large
  `name`/`securityIds`/`analysts` payloads verbatim into jsonb.
- **C.** The app serves no security headers — no HSTS, no
  `X-Content-Type-Options`, no frame-ancestors protection, no CSP — on a
  finance product with an authenticated dashboard.

## Current state

- `apps/web/lib/supabase/types.ts:20-23` — comment describing the intended
  waitlist RLS ("INSERT-only for anon/authenticated, no SELECT"). No
  `supabase/` directory exists in the repo; `packages/db/migrations/` is a
  DIFFERENT database (the engine Postgres) — do not put Supabase policies
  there.
- `apps/web/app/waitlist/actions.ts` — public server action; after plan 007
  it calls `insertWaitlistEmail` from `apps/web/lib/dal/waitlist.ts`. It
  validates email format/length and normalizes `source` against an allowlist,
  fails soft when env is missing. No throttle of any kind.
- `packages/db/src/schema.ts:19-27`:
  ```ts
  export const panelSeatSchema = z.object({
    id: z.string().min(1),
    weight: z.number().min(0),
  })
  export const panelSchema = z.object({
    analysts: z.array(panelSeatSchema).min(1),
  })
  ```
  and `panelConfigInputSchema` with `name: z.string().min(1)`.
- `packages/db/src/executor/config.ts:15-34` — `runConfigSchema` with
  `securityIds: z.array(z.string().min(1)).optional()` and an uncapped
  `initialCash` partial record. Persisted verbatim: `apps/web/lib/dal/runs.ts`
  (`insertRun(... config)`) and `lib/dal/panel-configs.ts`.
- `apps/web/next.config.ts` — no `headers()` function (verified at the
  planned-at commit; the config only sets `pageExtensions`,
  `transpilePackages`, `outputFileTracingRoot`, `experimental.extensionAlias`,
  then wraps with `withMDX` and `withWorkflow`).

Conventions: zod v4 (`z.partialRecord` exists); packages/db tests colocated,
run on pglite; web route tests in `apps/web/test/`.

## Commands you will need

| Purpose   | Command                                          | Expected |
|-----------|--------------------------------------------------|----------|
| Typecheck | `pnpm typecheck` (root)                          | exit 0   |
| db tests  | `pnpm turbo run test --filter=@workspace/db`     | all pass |
| web tests | `pnpm turbo run test --filter=web`               | all pass |
| Build     | `cd apps/web && pnpm build`                      | exit 0   |
| Headers   | `cd apps/web && (pnpm start &) && sleep 4 && curl -sI http://localhost:3000/ \| grep -i x-content-type` | header present |

## Scope

**In scope**:
- `supabase/migrations/0001_waitlist_rls.sql` (create — repo root `supabase/` dir)
- `apps/web/lib/dal/waitlist.ts` (rate limiting; created by plan 007)
- `apps/web/app/waitlist/actions.ts` (only if wiring the limiter needs the request IP)
- `packages/db/src/schema.ts`, `packages/db/src/executor/config.ts` (+ their tests)
- `apps/web/next.config.ts` (headers only)

**Out of scope**:
- Applying the Supabase migration to the live project (ops step — the plan
  only commits it and documents the apply command).
- The `/.well-known/workflow/**` gating question (separate finding, not
  planned here).
- Any change to Better Auth configuration.
- CSP in enforcing mode — report-only in this plan.

## Git workflow

- Branch: `advisor/009-harden-public-surfaces`
- One commit per workstream; conventional commits (`feat(security): …` /
  `fix(security): …`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step A1: Commit the waitlist RLS policy as a migration

Create `supabase/migrations/0001_waitlist_rls.sql`:

```sql
-- Waitlist confidentiality: the table is written with the PUBLIC anon key
-- from a server action, so RLS is the only thing standing between the anon
-- key and a dump of every signup email. Insert-only for anon; no select,
-- update, or delete for anon/authenticated.
alter table public.waitlist enable row level security;

drop policy if exists waitlist_insert_anon on public.waitlist;
create policy waitlist_insert_anon
  on public.waitlist for insert
  to anon, authenticated
  with check (true);
-- Deliberately NO select/update/delete policies: with RLS enabled and no
-- policy, those operations are denied for anon/authenticated.
```

Add `supabase/README.md` (3 lines): what this directory is, and that
migrations are applied with `supabase db push` (or pasted into the SQL editor)
against the project that backs `NEXT_PUBLIC_SUPABASE_URL`.

**Verify**: file exists; `git status` shows only the new `supabase/` files.

### Step A2: Best-effort rate limiting on the waitlist action

Add a small fixed-window in-memory limiter to `apps/web/lib/dal/waitlist.ts`
(exported for tests):

```ts
/**
 * Best-effort, per-instance rate limit: serverless instances don't share
 * memory, so this bounds abuse per warm instance rather than globally. The
 * global backstop is the DB unique index + RLS; platform-level limiting
 * (e.g. a WAF rule) can be layered on in ops without code changes.
 */
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 5
const hits = new Map<string, { windowStart: number; count: number }>()

export function allowWaitlistAttempt(key: string, now = Date.now()): boolean { ... }
```

Standard fixed-window logic; prune the entry when a new window starts. In
`actions.ts`, derive the key from the caller IP via
`(await headers()).get("x-forwarded-for")?.split(",")[0] ?? "unknown"`
(import `headers` from `next/headers`) and return the existing
`GENERIC_ERROR` shape with status "error" when disallowed — do not reveal
that rate limiting triggered.

**Verify**: `pnpm turbo run test --filter=web` → all pass, including new
limiter tests (see Test plan).

### Step B1: Add size caps to the persisted schemas

- `packages/db/src/schema.ts`: `id: z.string().min(1).max(100)`,
  `name: z.string().min(1).max(120)`, `analysts: z.array(...).min(1).max(16)`.
- `packages/db/src/executor/config.ts`:
  `securityIds: z.array(z.string().min(1).max(40)).max(200).optional()`.
- Keep messages default; add one comment line: caps are abuse bounds far
  above real usage, not business rules.

**Verify**: `pnpm turbo run test --filter=@workspace/db` → pass (fix any
fixture that exceeds a cap — none should).

### Step C1: Security headers in next.config.ts

Add to `nextConfig`:

```ts
async headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        // Report-only starter CSP — tighten to enforcing once clean in prod.
        { key: "Content-Security-Policy-Report-Only",
          value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'" },
      ],
    },
  ]
},
```

**Verify**: `cd apps/web && pnpm build` → exit 0. Then start the prod server,
`curl -sI http://localhost:3000/demo | grep -iE "x-content-type|x-frame|strict-transport"`
→ all three present. Load `/demo` and `/demo/ask` in a browser (or the repo's
headless browse tool) and confirm no functional breakage (CSP is
report-only, so none is expected).

## Test plan

- `apps/web/test/waitlist.test.ts` (create or extend): `allowWaitlistAttempt`
  allows N≤5 in a window, blocks the 6th, resets on window rollover
  (inject `now`). Plus the three `insertWaitlistEmail` outcomes if plan 007
  didn't already add them. Model mocking style after
  `apps/web/test/dal-runs.test.ts`.
- `packages/db/src/executor/config.test.ts` (extend): a `securityIds` array
  of 201 entries fails validation; 200 passes. `packages/db/src/schema` cap
  tests analogous (17 analysts fails, 16 passes).

## Done criteria

- [ ] `supabase/migrations/0001_waitlist_rls.sql` exists and enables RLS with
      an insert-only policy
- [ ] `grep -n "max(" packages/db/src/schema.ts packages/db/src/executor/config.ts`
      shows caps on `id`, `name`, `analysts`, `securityIds`
- [ ] `curl -sI` against a local prod build shows nosniff, X-Frame-Options,
      HSTS, and a CSP-Report-Only header
- [ ] All package test suites pass (`pnpm test` at root)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `lib/dal/waitlist.ts` does not exist (plan 007 not landed) — report; do not
  re-inline Supabase into the action.
- Any existing fixture/test legitimately exceeds a proposed cap (means the
  cap is mis-sized — report with the offending value).
- The report-only CSP breaks rendering locally (it should not; if it does,
  something is intercepting headers — report).

## Maintenance notes

- When real market data lands (plan 003) the CSP `connect-src` will need the
  provider origins — that's the moment to move CSP from report-only to
  enforcing, informed by collected violations.
- The in-memory limiter is per-instance by design; if waitlist abuse is ever
  observed in practice, add a Vercel WAF rate rule (ops) rather than building
  distributed state for a marketing form.
- Future Supabase tables must ship their RLS policy in `supabase/migrations/`
  in the same PR that introduces the table.
