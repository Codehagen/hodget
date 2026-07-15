# Plan 007: Make `pnpm lint` pass on main and fix the stale front-door docs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 67eb565..HEAD -- apps/web/app/waitlist apps/web/components/dashboard/decision-map/decisions-view.tsx apps/web/components/dashboard/strategies-view.tsx apps/web/lib/dal README.md SECURITY.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx / security
- **Planned at**: commit `67eb565`, 2026-07-15

## Why this matters

CI (`.github/workflows/ci.yml`) runs `pnpm lint` on every push and PR, and it
has failed on 26 of the last 27 pushes to main. One of the 8 errors is not
style noise: `app/waitlist/actions.ts` imports the Supabase server client
directly, violating the `no-restricted-imports` rule that README calls the
app's data-access security boundary ("all data access goes through `lib/dal`").
A permanently red gate trains contributors to ignore the exact rule that
exists to prevent authorization bugs. This plan makes lint pass, restores the
boundary, and fixes the stale placeholder docs a first-time visitor hits.

## Current state

Run `cd apps/web && pnpm lint` — it exits 1 with exactly these 8 errors:

1. `apps/web/app/waitlist/actions.ts:3` — restricted import:
   ```ts
   import { createClient } from "@/lib/supabase/server"
   ```
   The file is a public (unauthenticated, deliberately so) server action that
   inserts `{ email, source }` into the Supabase `waitlist` table. The ESLint
   config (`apps/web/eslint.config.js`) only exempts `lib/dal/**`,
   `lib/session.ts`, `app/api/auth/**`, and `lib/supabase/server.ts` from the
   restriction.
2. `apps/web/components/dashboard/decision-map/decisions-view.tsx:307` —
   `'_props' is defined but never used`:
   ```ts
   export function DecisionsView(_props: { basePath: string }) {
   ```
3. `decisions-view.tsx:342-343` — React Compiler: "Cannot access refs during
   render" (×2). The offending pattern:
   ```ts
   const renderedIdRef = React.useRef(map.id)
   if (renderedIdRef.current !== map.id) {
     renderedIdRef.current = map.id
     if (!suppressEntrance) setSuppressEntrance(true)
     setSelectedId(analystNodeId(map.primaryAnalystId))
     setRailAdvisorId(map.primaryAnalystId)
   }
   ```
4. `decisions-view.tsx:350` — React Compiler: "Existing memoization could not
   be preserved" (×2). Likely a knock-on of the ref pattern above; re-check
   after fixing it.
5. `apps/web/components/dashboard/strategies-view.tsx:13` — unused import
   `LinkSquare02Icon`; `:25` — unused import `CardAction`.

Repo conventions that apply:

- The DAL contract (`apps/web/lib/dal/index.ts` header): every export of the
  *index* validates the session first. There is an established precedent for a
  deliberately public DAL module that is **not** re-exported from the index
  and documents its own authorization story (session comments describe this
  for demo surfaces). The waitlist module follows that precedent.
- Comment style: file-top JSDoc explaining the *why*; English only, including
  commit messages.
- Commit style (from `git log`): conventional commits, e.g.
  `fix(web): route waitlist writes through the DAL`.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Install   | `pnpm install`                       | exit 0              |
| Lint      | `cd apps/web && pnpm lint`           | exit 0, 0 problems  |
| Typecheck | `pnpm turbo run typecheck --filter=web` | exit 0           |
| Tests     | `pnpm turbo run test --filter=web`   | 59+ tests pass      |

## Scope

**In scope** (the only files you should modify):
- `apps/web/lib/dal/waitlist.ts` (create)
- `apps/web/app/waitlist/actions.ts`
- `apps/web/components/dashboard/decision-map/decisions-view.tsx`
- `apps/web/components/dashboard/strategies-view.tsx`
- `apps/web/app/demo/decisions/page.tsx`, `apps/web/app/dashboard/decisions/page.tsx` (only if removing the unused `basePath` prop — see Step 3)
- `README.md`, `SECURITY.md`

**Out of scope** (do NOT touch):
- `apps/web/eslint.config.js` — do not widen the exemption list beyond what
  already exists; `lib/dal/**` is already exempt, which is why the new module
  lives there. Never disable the `no-restricted-imports` rule.
- `apps/web/lib/dal/index.ts` — do NOT re-export the waitlist module from the
  index; the index's "every export validates the session" contract must hold.
- Rate limiting / RLS for the waitlist — that is plan 009.

## Git workflow

- Branch: `advisor/007-green-the-lint-gate`
- One commit per step or logical unit; conventional-commit messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Move the waitlist insert into `lib/dal/waitlist.ts`

Create `apps/web/lib/dal/waitlist.ts` containing the Supabase insert currently
inlined in the action. Shape:

```ts
import "server-only"

import { createClient } from "@/lib/supabase/server"

/**
 * Waitlist writes — a DELIBERATELY PUBLIC surface, unlike the rest of the
 * DAL: joining the waitlist happens before any account exists, so there is
 * no session to validate. This module is NOT re-exported from lib/dal/index
 * (whose contract is "every export validates the session"); it documents its
 * own boundary instead: insert-only, validated input, generic errors.
 * Confidentiality of the table rests on the RLS policy (see plan 009).
 */
export type WaitlistInsertResult =
  | { ok: true; duplicate: boolean }
  | { ok: false }

export async function insertWaitlistEmail(
  email: string,
  source: string
): Promise<WaitlistInsertResult> {
  const supabase = await createClient()
  const { error } = await supabase.from("waitlist").insert({ email, source })
  if (!error) return { ok: true, duplicate: false }
  // 23505 = unique_violation → already signed up; same outcome for the user.
  if (error.code === "23505") return { ok: true, duplicate: true }
  return { ok: false }
}
```

Then edit `apps/web/app/waitlist/actions.ts`: remove the
`@/lib/supabase/server` import, import `insertWaitlistEmail` from
`@/lib/dal/waitlist`, and replace the try-block's Supabase code with a call to
it, mapping `{ok:true,duplicate:true}` → "You're already on the list.",
`{ok:true,duplicate:false}` → "You're on the list.", `{ok:false}` → the
existing `GENERIC_ERROR`. Keep the email regex, the source allowlist, the
env-presence fail-soft check, and the outer try/catch exactly as they are.

**Verify**: `cd apps/web && pnpm lint 2>&1 | grep waitlist` → no output.

### Step 2: Fix the ref-during-render pattern in decisions-view

In `decisions-view.tsx`, replace the `renderedIdRef` block (excerpt in Current
state) with the React-canonical "adjust state during render" pattern, which
the React Compiler accepts:

```ts
const [renderedId, setRenderedId] = React.useState(map.id)
if (renderedId !== map.id) {
  setRenderedId(map.id)
  if (!suppressEntrance) setSuppressEntrance(true)
  setSelectedId(analystNodeId(map.primaryAnalystId))
  setRailAdvisorId(map.primaryAnalystId)
}
```

Delete the `renderedIdRef` declaration. Behavior is identical: the branch runs
during render when the selected map changes, before commit.

**Verify**: `cd apps/web && pnpm lint 2>&1 | grep decisions-view` → the
refs-during-render errors are gone. If the two "memoization could not be
preserved" errors at ~line 350 remain, inspect what they point at (the
`handleSelectedIdChange` `useCallback` or the `items` `useMemo`); the usual
fix is letting the compiler own it (remove the manual `useCallback`/`useMemo`
wrapper for that value). Apply the minimal change that clears the error
without changing behavior.

### Step 3: Remove the unused `_props` parameter and unused imports

- `decisions-view.tsx:307`: `basePath` is never used inside `DecisionsView`.
  Check the two call sites (`apps/web/app/demo/decisions/page.tsx`,
  `apps/web/app/dashboard/decisions/page.tsx`). If they pass `basePath`,
  remove the prop from the component signature AND from both call sites.
- `strategies-view.tsx`: delete `LinkSquare02Icon` from the hugeicons import
  and `CardAction` from the card import.

**Verify**: `cd apps/web && pnpm lint` → exit 0, no errors at all.

### Step 4: Fix the stale front-door docs

- `README.md` "Repository layout" (~lines 96-101): add two rows —
  `packages/engine` ("the fund engine: analysts, committee, portfolio, risk,
  backtesting, paper broker") and `packages/db` ("engine persistence: Postgres
  schema, queries, the run executor").
- `README.md` clone URL (~line 50): replace `github.com/<your-org>/hodget`
  with `github.com/Codehagen/hodget`.
- `SECURITY.md`: replace the `<your-org>` placeholder in the advisories URL
  with `Codehagen`. Leave the security email as-is but add no new claims.

**Verify**: `grep -rn "<your-org>" README.md SECURITY.md` → no matches.

### Step 5: Full gate check

**Verify**:
- `pnpm turbo run typecheck --filter=web` → exit 0
- `pnpm turbo run test --filter=web` → all tests pass
- `pnpm lint` (repo root) → exit 0

## Test plan

No new tests required (behavior-preserving refactors). The existing web suite
(`apps/web/test/`, run via `pnpm turbo run test --filter=web`) must stay green
— it covers the waitlist action indirectly only if a test exists; if
`apps/web/test/` has no waitlist test, add one small unit test for
`insertWaitlistEmail`'s three outcomes by mocking `@/lib/supabase/server`
(model after the mocking style in `apps/web/test/dal-runs.test.ts`).

## Done criteria

- [ ] `pnpm lint` at repo root exits 0
- [ ] `grep -n "supabase/server" apps/web/app/waitlist/actions.ts` → no matches
- [ ] `grep -rn "<your-org>" README.md SECURITY.md` → no matches
- [ ] `pnpm turbo run typecheck test --filter=web` exits 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The lint errors you see differ from the 8 listed (the codebase drifted).
- Removing `basePath` from `DecisionsView` breaks a call site you cannot see
  (search first: `grep -rn "DecisionsView" apps/web`).
- The "memoization could not be preserved" errors persist after removing the
  manual memo wrapper the message points at.
- Fixing anything seems to require touching `eslint.config.js`.

## Maintenance notes

- The waitlist DAL module is the second deliberately-public DAL surface; if a
  third appears, consider a documented `lib/dal/public/` convention.
- Reviewers should confirm no behavioral change on `/waitlist` (submit a
  valid email, a duplicate, and an invalid one).
- Plan 009 hardens this same surface (RLS migration + rate limiting) — land
  this plan first.
