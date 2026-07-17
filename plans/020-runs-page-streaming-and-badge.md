# Plan 020: Stream the runs page around the engine-DB query, and stop the overview calling itself unfinished

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat bb1ee76..HEAD -- apps/web/app/dashboard/runs/page.tsx apps/web/components/dashboard/runs/real-runs-section.tsx apps/web/app/dashboard/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf + docs
- **Planned at**: commit `bb1ee76`, 2026-07-17

## Why this matters

Two small polish items on the signed-in dashboard, both from the 2026-07-17
audit:

1. `/dashboard/runs` renders `<RealRunsSection />` — an async server component
   that awaits an engine-DB query — **outside** any Suspense boundary, while
   the static sample history right below it is wrapped in one. The DB
   round-trip therefore gates the streamed HTML for the whole route; on a
   cold or slow engine DB the page shows nothing when the sample content
   could have painted immediately.
2. The `/dashboard` overview badge still says "Sample data · live wiring
   coming" — written before real runs shipped. The adjacent Runs tab is now
   fully live, so the badge reads as unfinished at launch and is factually
   stale (the *overview aggregates* are still sample data; "live wiring
   coming" for the dashboard as a whole is not true anymore).

## Current state

`apps/web/app/dashboard/runs/page.tsx:13-31` (as of `bb1ee76`):

```tsx
export default function DashboardRunsPage() {
  return (
    <>
      <div className="px-4 pt-4 md:px-6 md:pt-6">
        <RealRunsSection />
      </div>
      <Suspense
        fallback={
          <div className="flex flex-col gap-4 p-4 md:p-6">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-72" />
          </div>
        }
      >
        <RunsView basePath="/dashboard" source="real" />
      </Suspense>
    </>
  )
}
```

`apps/web/components/dashboard/runs/real-runs-section.tsx` — the async server
component; `await listRuns()` in a try/catch, degrading to a quiet notice on
DB failure. It renders a `Card` with header "Your runs" and a "Live data"
badge. (No change needed in this file — only how the page mounts it.)

`apps/web/app/dashboard/page.tsx:6-19`:

```tsx
// Sample data for now — live run data is wired in from the runs API next. The
// requireSession guard stays in the layout, so this route is still auth-only.
export default function DashboardPage() {
  return (
    <DashboardView
      data={DEMO_DASHBOARD}
      basePath="/dashboard"
      source="real"
      notice={
        <Badge variant="neutral" className="font-normal">
          Sample data · live wiring coming
        </Badge>
      }
    />
  )
}
```

Conventions: skeleton fallbacks use `@workspace/ui`'s `Skeleton` (see the
`RunsView` fallback above — reuse that exact idiom). Badge copy elsewhere in
the app is short and factual (`Live data`, `Sample data`).

Context for the copy change: the audit's direction findings propose wiring
the overview to real run data later (recorded in `plans/README.md` under
direction options). This plan does NOT do that — it only makes today's copy
truthful.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck/lint | `pnpm --filter web typecheck && pnpm --filter web lint` | exit 0 |
| Unit tests | `pnpm --filter web test` | all pass |
| Visual check | `pnpm dev` → open `/dashboard/runs` and `/dashboard` signed in | skeleton paints, then runs; badge reads correctly |

## Scope

**In scope** (the only files you should modify):
- `apps/web/app/dashboard/runs/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `apps/web/components/dashboard/runs/real-runs-section.tsx` — its internal
  degrade-on-failure behavior is correct and stays.
- `apps/web/components/dashboard/dashboard-view.tsx` and `demo-data.ts` —
  wiring real overview data is a separate direction decision, not this plan.
- `apps/web/app/demo/**` — the demo surface intentionally shows sample data
  with its own labeling.

## Git workflow

- Branch: `advisor/020-runs-page-streaming-and-badge`
- Conventional commit, e.g. `fix(web): stream the real-runs section; truthful overview badge`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Suspense boundary around `RealRunsSection`

In `apps/web/app/dashboard/runs/page.tsx`, wrap the section in its own
boundary with a card-shaped skeleton, keeping the existing padding wrapper:

```tsx
<div className="px-4 pt-4 md:px-6 md:pt-6">
  <Suspense fallback={<Skeleton className="h-40" />}>
    <RealRunsSection />
  </Suspense>
</div>
```

(Adjust the skeleton height to visually approximate the rendered card — check
against the dev server; a single block is fine, matching the `RunsView`
fallback's simplicity.)

**Verify**: `pnpm --filter web typecheck && pnpm --filter web lint` → exit 0.
Then `pnpm dev`, sign in, load `/dashboard/runs`: the sample history and the
skeleton appear without waiting on the engine DB, then the real runs card
fills in.

### Step 2: Truthful overview badge

In `apps/web/app/dashboard/page.tsx`:

- Badge text: `Sample data · live wiring coming` → `Sample overview · your
  real runs are under Runs` (or equally short/factual copy scoping the
  "sample" claim to the overview aggregates and pointing at the live surface).
- Update the stale leading comment to match reality, e.g. "The overview
  aggregates are still sample data; real runs live under /dashboard/runs
  (see plans/README.md direction options for wiring the overview)."

**Verify**: `pnpm --filter web lint` → exit 0; visual check on `/dashboard`.

### Step 3: Full gate + index

**Verify**: `pnpm typecheck && pnpm lint && pnpm test` → all green (this
change should break no test — if one asserts the old badge text, update that
assertion). Update this plan's row in `plans/README.md`.

## Test plan

No new tests: step 1 is framework composition (Suspense) with no logic to
unit-test, and step 2 is copy. If an existing test or e2e assertion pins the
old badge string (`grep -rn "live wiring coming" apps/web/test apps/web/e2e`),
update it to the new copy.

## Done criteria

- [ ] `grep -n 'Suspense' apps/web/app/dashboard/runs/page.tsx` shows TWO boundaries
- [ ] `grep -rn "live wiring coming" apps/web` returns no matches
- [ ] `pnpm typecheck && pnpm lint && pnpm test` all exit 0
- [ ] Visual check performed on both routes (note it in your report)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The page excerpts don't match (drift since `bb1ee76`).
- Wrapping in Suspense changes observable behavior beyond streaming (e.g. the
  section's error-degrade notice stops rendering) — that would mean
  `RealRunsSection` grew behavior this plan didn't anticipate.
- You're tempted to wire real data into the overview while you're there —
  that's a separate, deliberately-unscoped direction decision.

## Maintenance notes

- When the overview eventually gets real data (direction option A in the
  index), the step-2 badge/comment go away entirely — this copy is a
  stopgap, and the comment says where the real fix is tracked.
- Reviewer focus: the skeleton fallback should not cause layout shift against
  the resolved card on typical viewport widths.
