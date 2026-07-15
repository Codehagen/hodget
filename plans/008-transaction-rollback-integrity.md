# Plan 008: Preserve the original error and evict poisoned connections in `transaction()`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 67eb565..HEAD -- packages/db/src/client.ts packages/db/src/client.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `67eb565`, 2026-07-15

## Why this matters

`transaction()` in `packages/db/src/client.ts` is the write path for every
run commit (`executeRun` persists decisions, fills, results, and the status
transition inside it). Today, if the transaction body throws AND the
subsequent `ROLLBACK` also fails (dead connection, aborted transaction), the
ROLLBACK rejection replaces the original error — so `engine_runs.error`
records the wrong cause. Worse, `client.release()` is called with no
argument, so a connection that just failed mid-transaction is returned to the
pool as healthy and can fail the next unrelated query.

## Current state

`packages/db/src/client.ts` (inside `createPgSql`, ~lines 65-82):

```ts
async transaction(fn) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const value = await fn(clientSql(client))
    await client.query("COMMIT")
    return value
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
},
```

node-pg semantics: `client.release(err)` with a truthy argument destroys the
connection instead of returning it to the pool. That is the standard guidance
for a client that errored mid-transaction.

Conventions: `packages/db` uses vitest; most tests run against pglite via
`packages/db/src/testing/pglite.ts`, but this fix is about `pg.Pool`
mechanics, so the test uses a hand-rolled fake pool (plain object with
`connect()` returning a scripted fake client). Test files are colocated:
`<module>.test.ts` next to `<module>.ts`.

## Commands you will need

| Purpose   | Command                                        | Expected on success |
|-----------|------------------------------------------------|---------------------|
| Tests     | `pnpm turbo run test --filter=@workspace/db`   | all pass            |
| Typecheck | `pnpm turbo run typecheck --filter=@workspace/db` | exit 0           |

## Scope

**In scope**:
- `packages/db/src/client.ts` (the `transaction` method only)
- `packages/db/src/client.test.ts` (create)

**Out of scope**:
- `clientSql`, `createPgSql`'s query method, the pglite test helper, and every
  caller of `transaction()` — no signature changes.
- Retry logic. This plan is about error fidelity and pool hygiene, not
  retries.

## Git workflow

- Branch: `advisor/008-transaction-rollback-integrity`
- Conventional commit, e.g. `fix(db): preserve original error and evict failed connections in transaction()`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the catch/finally

Replace the `catch`/`finally` of `transaction` with:

```ts
} catch (error) {
  // ROLLBACK on a broken connection can itself reject; the caller must see
  // the ORIGINAL failure, so the rollback error is swallowed deliberately.
  try {
    await client.query("ROLLBACK")
  } catch {
    // Connection is unusable; eviction below handles it.
  }
  failed = error
  throw error
} finally {
  // release(err) destroys the connection instead of pooling it — a client
  // that failed mid-transaction must not serve the next query.
  client.release(failed instanceof Error ? failed : undefined)
}
```

with `let failed: unknown` declared before the `try`. On the success path
`failed` stays undefined and `release()` behaves exactly as today.

**Verify**: `pnpm turbo run typecheck --filter=@workspace/db` → exit 0

### Step 2: Unit-test with a scripted fake pool

Create `packages/db/src/client.test.ts`. Import `createPgSql`? No — it
constructs a real `Pool` from a connection string. Instead, test through the
same code path by extracting nothing: `createPgSql` reads
`process.env.DATABASE_URL` or an argument; constructing it is fine as long as
no query runs. The clean approach: use vitest's `vi.mock("pg", ...)` to
replace `Pool` with a fake whose `connect()` resolves a scripted client:

```ts
const client = {
  calls: [] as string[],
  query(text: string) {
    this.calls.push(text)
    if (text === "ROLLBACK" && rollbackFails) return Promise.reject(new Error("rollback failed"))
    return Promise.resolve({ rows: [] })
  },
  released: [] as unknown[],
  release(err?: unknown) { this.released.push(err) },
}
```

Cases:
1. body throws `new Error("boom")`, ROLLBACK succeeds → `transaction` rejects
   with message `"boom"`; `release` called with the boom error (truthy).
2. body throws `"boom"`, ROLLBACK rejects → still rejects with `"boom"` (NOT
   "rollback failed"); `release` called with the boom error.
3. happy path → calls are `BEGIN`, `COMMIT`; `release` called with
   `undefined`.

**Verify**: `pnpm turbo run test --filter=@workspace/db` → all pass,
including the 3 new tests.

## Test plan

Covered by Step 2 (three cases above). Model the file layout after any
colocated test in `packages/db/src/queries/queries.test.ts` for imports/style,
but use the mocked `pg` module, not pglite.

## Done criteria

- [ ] `pnpm turbo run typecheck --filter=@workspace/db` exits 0
- [ ] `pnpm turbo run test --filter=@workspace/db` exits 0 with 3 new tests
- [ ] In `client.ts`, ROLLBACK is wrapped in its own try/catch and `release`
      receives the original error on failure paths
- [ ] No files outside the in-scope list modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- The `transaction` excerpt doesn't match the live code.
- Mocking `pg` proves impossible in this vitest setup after two attempts
  (report the blocker; do not restructure `client.ts` to make it mockable —
  that's a design change beyond this plan).

## Maintenance notes

- If a retry layer is ever added around `executeRun`, it must treat a
  rejected `transaction()` as "rolled back or connection destroyed" — this
  plan guarantees no half-open transaction survives on a pooled client.
- Reviewer focus: the success path must still call `release()` with no
  argument (passing an error there would destroy healthy connections and
  silently degrade the pool).
