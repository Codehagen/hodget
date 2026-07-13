# 001 — Enforce the session invariant structurally, not with a checkbox

**Written against commit:** `6925655`
**Effort:** M · **Risk of the change:** Low · **Confidence:** High

## Why this matters

Hodget shows portfolio data and will eventually be able to place trades. The
invariant that protects all of it is: *no user data is ever read or written
without validating the session against the database.*

Today that invariant is enforced by a checkbox in
`.github/pull_request_template.md` asking the contributor to confirm they called
`requireSession()`. That is the weakest possible enforcement. A checkbox is
self-attested, it is checked by the person least likely to notice they forgot,
and it is checked at the moment they most want the PR merged. The invariant is
worth more than that.

`apps/web/proxy.ts` does not help here — it reads the session cookie without
validating it, so a forged cookie passes. It is a UX redirect, not a boundary.

Next.js's own authentication guide (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`,
line 1119) states the principle directly: *"the majority of security checks
should be performed as close as possible to your data source."* Not in the page.
Not in the proxy. At the data layer.

That reframes the invariant into something a machine can check. Instead of
"every protected page remembers to call `requireSession()`" — unverifiable
without understanding intent — we get **"only the data access layer may talk to
the database, and it always verifies the session."** Import boundaries are
mechanically checkable by a stock ESLint rule. No custom rule authoring, and it
runs in CI, where it cannot be rubber-stamped.

## Current state

`apps/web/lib/session.ts` (as written today):

```ts
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "./auth"

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function requireSession() {
  const session = await getSession()

  if (!session) {
    redirect("/sign-in")
  }

  return session
}
```

Two problems. It is not memoized, so a page that calls it and then calls two data
functions that each call it makes three database round-trips per render. And
nothing stops a page from importing `lib/supabase/server` directly and querying
data without ever touching it.

`apps/web/eslint.config.js` is currently a bare re-export, which is where the
enforcement will go:

```js
import { nextJsConfig } from "@workspace/eslint-config/next-js"

/** @type {import("eslint").Linter.Config} */
export default nextJsConfig
```

## What to build

### Step 1 — Memoize the session check

Wrap `requireSession` in React's `cache()` so that N calls within one render pass
produce one database query. This removes the performance argument that would
otherwise tempt someone to skip the check.

Edit `apps/web/lib/session.ts`:

```ts
import "server-only"

import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "./auth"

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})

export const requireSession = cache(async () => {
  const session = await getSession()

  if (!session) {
    redirect("/sign-in")
  }

  return session
})
```

Install the guard package first: `pnpm --filter web add server-only`. The
`import "server-only"` line makes the build fail loudly if this module is ever
pulled into a client component — a second, independent safety net.

**Verify:** `pnpm typecheck` passes.

### Step 2 — Create the data access layer

Create `apps/web/lib/dal/index.ts`. Every function that reads or writes user data
lives here, and every one of them starts by awaiting `requireSession()`. This is
the only place in the app allowed to import the Supabase server client.

```ts
import "server-only"

import { createClient } from "@/lib/supabase/server"
import { requireSession } from "@/lib/session"

/** Every export in this module must call requireSession() before touching data.
 * This is the app's only authorization boundary — proxy.ts is not one. */
export async function getPositions() {
  const session = await requireSession()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("positions")
    .select("*")
    .eq("user_id", session.user.id)

  if (error) throw error

  return data
}
```

`getPositions` is an example shaped against a `positions` table that does not
exist yet. If the schema is still empty when you execute this plan, create the
DAL module with `requireSession` re-exported and a single placeholder function,
and leave a comment saying real queries go here. **Do not invent a schema.**

**Verify:** `pnpm typecheck` passes.

### Step 3 — Enforce the boundary in ESLint

This is the step that replaces the checkbox. Rewrite `apps/web/eslint.config.js`
so that importing the Supabase server client, or the auth instance, from anywhere
outside the DAL is a lint **error**:

```js
import { nextJsConfig } from "@workspace/eslint-config/next-js"

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/supabase/server", "@/lib/supabase/server"],
              message:
                "Do not query the database directly. Go through lib/dal — it validates the session. proxy.ts is not a security boundary.",
            },
            {
              group: ["**/lib/auth", "@/lib/auth"],
              message:
                "Import requireSession from @/lib/session, not the auth instance directly.",
            },
          ],
        },
      ],
    },
  },
  {
    // The DAL, the session helper and the auth route handler are the only
    // places allowed to reach past the boundary.
    files: [
      "lib/dal/**",
      "lib/session.ts",
      "app/api/auth/[...all]/route.ts",
      "lib/supabase/server.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]
```

Note `nextJsConfig` is spread — confirm it is an array before spreading it (read
`packages/eslint-config/next.js`). If it exports a single object rather than an
array, wrap it: `[nextJsConfig, { rules: {...} }, { files: [...] }]`.

**Verify — this is the important one.** The rule must actually fire. Create a
throwaway file `apps/web/app/leak-test/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server"
export default function Page() {
  return <div>{String(createClient)}</div>
}
```

Run `pnpm lint`. It **must** fail with the "Do not query the database directly"
message. Then delete the throwaway file and confirm `pnpm lint` passes again. If
the rule does not fire, the config is wrong — fix it before moving on. A guard
that does not fire is worse than no guard, because it manufactures confidence.

### Step 4 — Trim the PR template

Now that the invariant is machine-enforced, the checkbox is redundant, and the
"did you run typecheck/lint/build" boxes are redundant too — CI runs all three on
every PR (`.github/workflows/ci.yml`). Asking a human to attest to what a machine
already proves trains contributors to check boxes without reading them, which is
exactly what makes the *one* box that matters worthless.

Keep only what a machine cannot judge. Replace
`.github/pull_request_template.md` with:

```markdown
## What does this change?

<!-- One or two sentences. What did you change and why? -->

## How did you verify it?

<!-- Not "CI passes" — what did you actually run or click to see it work?
     For an alpha model, include the backtest. -->

## Anything reviewers should push back on?

<!-- Tradeoffs you're unsure about, shortcuts taken, things you'd do differently
     with more time. -->
```

### Step 5 — Document the boundary

Update the "Security" section of `README.md` and the corresponding bullet in
`CONTRIBUTING.md` to describe the real rule, replacing the "call requireSession()
in every page" instruction:

> All database access goes through `lib/dal`, which validates the session against
> the database on every call. ESLint blocks any import of the Supabase server
> client from outside the DAL, so this is enforced in CI rather than by review.
> `proxy.ts` only redirects signed-out users to the sign-in page — it reads the
> session cookie without validating it and is **not** a security boundary.

## Files in scope

- `apps/web/lib/session.ts` (modify)
- `apps/web/lib/dal/index.ts` (create)
- `apps/web/eslint.config.js` (modify)
- `.github/pull_request_template.md` (rewrite)
- `README.md`, `CONTRIBUTING.md` (update the security wording only)
- `apps/web/package.json` (adds `server-only`)

## Out of scope — do not touch

- `apps/web/proxy.ts`. It is correct as written. Do not add database validation to
  it; that would run a query on every prefetch.
- `apps/web/lib/auth.ts`, the auth route handler, the Supabase client files.
- Building `/sign-in` or `/dashboard`. This plan is about the boundary, not the UI.
- Row-level security policies in Supabase. Worth doing, but a separate plan.

## Done criteria

1. `pnpm typecheck` — exit 0.
2. `pnpm lint` — exit 0.
3. `pnpm build` — exit 0.
4. The leak test from step 3 fails lint with the custom message, and passes once
   deleted. **Demonstrate this explicitly in your report; do not merely assert it.**
5. `.github/pull_request_template.md` contains no checkbox that duplicates a CI check.

## If you get stuck

If `nextJsConfig`'s shape makes the flat-config composition fail, or
`no-restricted-imports` cannot express the boundary for some reason, **stop and
report back** rather than falling back to the checkbox or inventing a custom
ESLint plugin. The mechanism matters; getting it half-right is worse than leaving
the current state in place.

## Maintenance note

Every new module that talks to the database must live under `lib/dal/`. When
someone adds a second data source (a market-data client, a broker API), the same
boundary applies: give it a DAL module, add it to the restricted-imports list,
and confirm the rule fires with a throwaway leak test. The allowlist in
`eslint.config.js` is the list of files trusted to reach past the boundary — it
should stay short, and every addition to it deserves scrutiny in review.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | CLEAR (absorbed) | 15 findings, 9 folded in full, 5 folded reduced, 1 rejected |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | see per-plan notes below |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

Eng review notes (2026-07-13, autonomous): no blocking findings. Plan is self-contained with a mandatory demonstrated leak test; the ESLint allowlist and the "if you get stuck" stop clause reviewed and accepted as-is.

- **VERDICT:** ENG CLEARED — ready to implement.

NO UNRESOLVED DECISIONS
