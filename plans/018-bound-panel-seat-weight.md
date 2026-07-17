# Plan 018: Bound panel-seat weight — the one field plan 009's abuse caps missed

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat bb1ee76..HEAD -- packages/db/src/schema.ts packages/db/src/executor/config.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug / security
- **Planned at**: commit `bb1ee76`, 2026-07-17

## Why this matters

Plan 009 added abuse caps to every field of the panel schema — except
`weight`. `z.number().min(0)` accepts `Infinity` (e.g. a JSON body of
`1e999` parses to `Infinity`, which Zod's plain `number()` admits), and the
value flows unchecked from the authenticated `POST /api/runs` body into
`createConvictionCommittee({ analystWeights })` and the committee's
normalization math, then into persisted run results. A non-finite or absurdly
large weight is exactly the class of unbounded-input problem the sibling caps
exist to stop; this closes the gap with a one-line schema change plus tests.

## Current state

- `packages/db/src/schema.ts:18-26` (as of `bb1ee76`):

```ts
/** One analyst seat on the panel: which analyst, and its committee weight.
 * The .max() bounds here and below are abuse caps far above real usage
 * (plan 009): these shapes persist verbatim into jsonb, so without them an
 * authenticated user could store arbitrarily large payloads. */
export const panelSeatSchema = z.object({
  id: z.string().min(1).max(100),
  weight: z.number().min(0),
})
```

- Where the value lands, `packages/db/src/executor/run-executor.ts:90-92`:

```ts
const committee = createConvictionCommittee({
  analystWeights: Object.fromEntries(config.panel.analysts.map((a) => [a.id, a.weight])),
})
```

- Test pattern to follow: `packages/db/src/executor/config.test.ts` — small
  `safeParse` tables against a `BASE` config (`describe("runConfigSchema — initialCash")`
  etc.). The run route validates bodies with `runConfigSchema`, which embeds
  `panelSchema` → `panelSeatSchema`, so a config-level test exercises the
  real request path.
- Zod is v4 (`zod ^4.4.3`); `.finite()` and `.max()` compose as usual.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| db tests | `pnpm --filter @workspace/db test` | all pass |
| db typecheck | `pnpm --filter @workspace/db typecheck` | exit 0 |
| Full gate | `pnpm typecheck && pnpm lint && pnpm test` | all green |

## Scope

**In scope** (the only files you should modify):
- `packages/db/src/schema.ts`
- `packages/db/src/executor/config.test.ts` (extend)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `packages/engine/src/committee/**` — do not add defensive weight handling
  inside the engine; the boundary fix is the input schema, and the engine's
  internal math was separately audited clean for validated inputs.
- `apps/web` — the route already delegates validation to `runConfigSchema`;
  nothing to change there.
- Other fields of `panelSeatSchema` / `panelSchema` — already capped.

## Git workflow

- Branch: `advisor/018-bound-panel-seat-weight`
- Conventional commit, e.g. `fix(db): cap panel-seat weight — finite, bounded (plan 009 follow-up)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Tighten the schema

In `packages/db/src/schema.ts`, change the weight line to:

```ts
weight: z.number().min(0).finite().max(1000),
```

1000 is an abuse cap far above real usage (weights are relative; the tested
default config uses `weight: 1`), matching the rationale documented in the
comment directly above — no comment change needed.

**Verify**: `pnpm --filter @workspace/db typecheck` → exit 0.

### Step 2: Tests

In `packages/db/src/executor/config.test.ts`, add a
`describe("runConfigSchema — panel weight")` block using the existing `BASE`
fixture pattern:

- accepts `weight: 1` (already implied by BASE — assert explicitly),
- accepts `weight: 0` (a benched seat is valid today; keep it valid),
- rejects `Infinity` (construct via `Number.POSITIVE_INFINITY` — JSON can't
  express it literally, but `JSON.parse("1e999")` produces it, which is the
  attack shape; a code comment should say so),
- rejects `NaN`,
- rejects `1001` (over the cap),
- rejects `-1` (regression guard for the existing floor).

**Verify**: `pnpm --filter @workspace/db test` → all pass, including the 6 new
cases.

### Step 3: Full gate + index

**Verify**: `pnpm typecheck && pnpm lint && pnpm test` → all green. Update
this plan's row in `plans/README.md`.

## Test plan

Covered in step 2; pattern file `packages/db/src/executor/config.test.ts`.

## Done criteria

- [ ] `grep -n 'finite' packages/db/src/schema.ts` matches the weight line
- [ ] `pnpm --filter @workspace/db test` exits 0 with the new weight cases
- [ ] `pnpm typecheck && pnpm lint && pnpm test` all exit 0
- [ ] `git status` clean outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The schema excerpt doesn't match (drift since `bb1ee76`).
- Any existing test fails after step 1 — that would mean something real
  depends on unbounded/non-finite weights, which the advisor should see.
- You find other uncapped numeric fields while in the file — note them in
  your report; do not widen the change.

## Maintenance notes

- If per-seat weight semantics ever change (e.g. normalized 0–1 weights), the
  cap should tighten with them; the test names make the intent searchable.
- Reviewer focus: confirm `weight: 0` stayed accepted — tightening that would
  be a silent behavior change for existing saved panel configs.
