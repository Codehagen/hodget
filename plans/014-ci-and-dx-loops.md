# Plan 014: Faster, earlier feedback — Turbo cache in CI, pre-commit hooks, complete env docs, real AGENTS.md

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 67eb565..HEAD -- .github/workflows/ci.yml apps/web/.env.example README.md AGENTS.md package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/007-green-the-lint-gate.md (hooks that run lint are
  useless while lint is red)
- **Category**: dx
- **Planned at**: commit `67eb565`, 2026-07-15

## Why this matters

Four small feedback-loop gaps compound: CI rebuilds everything cold on every
push (no Turbo cache persisted); nothing runs before a commit, so red lint
reaches CI at all; `.env.example` omits the four variables the flagship
engine/LLM path actually reads, so a fresh clone dead-ends; and `AGENTS.md`
contains only a Next.js version caveat — none of the load-bearing rules
(the DAL boundary above all) that an agent needs to not break the repo.

## Current state

- `.github/workflows/ci.yml` — single `verify` job: checkout, pnpm setup,
  node 20 with `cache: pnpm`, `pnpm install --frozen-lockfile`, then
  `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. No `.turbo`
  cache step.
- `turbo.json` — tasks `build`/`lint`/`typecheck` are cacheable (default);
  `test` is `"cache": false` (deliberate — keep it that way). Local cache
  dir is the default `.turbo`.
- `apps/web/.env.example` — documents `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`, `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL`. Missing: `ANTHROPIC_API_KEY`, `HODGET_LLM_MODEL`,
  `RUN_EXECUTION` (all three declared in `turbo.json` `globalEnv` and read
  by `packages/engine` / `apps/web/lib/dal/run-registry.ts`), and
  `NEXT_PUBLIC_APP_URL` (read in `apps/web/lib/metadata.ts:6`).
- `AGENTS.md` — 5 lines: only the vendored "This is NOT the Next.js you
  know" block between `BEGIN/END:nextjs-agent-rules` markers. Preserve that
  block verbatim; add sections after it.
- No hook manager: no `.husky/`, no lefthook config, no `prepare` script.
- README env table (~lines 63-69) mirrors `.env.example`'s current list.

Conventions: English-only repo text; conventional commits.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Lint | `pnpm lint` | exit 0 (after plan 007) |
| Typecheck | `pnpm typecheck` | exit 0 |
| Hook smoke | `git commit` on a whitespace change | hook runs, commit succeeds |

## Scope

**In scope**:
- `.github/workflows/ci.yml`
- `apps/web/.env.example`, `README.md` (env table only)
- `AGENTS.md`
- `package.json` (root — `prepare` script + lefthook devDep), `lefthook.yml` (create)

**Out of scope**:
- `turbo.json` task graph (leave `test: cache false` alone).
- Remote Turbo cache (`TURBO_TOKEN`) — needs org secrets; GitHub-actions
  cache is sufficient here.
- E2E in CI (noted as follow-up in plan 013).
- Any source-code change.

## Git workflow

- Branch: `advisor/014-ci-and-dx-loops`
- Conventional commits (`ci: …`, `docs: …`, `chore: …`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Persist the Turbo cache in CI

In `ci.yml`, after the pnpm/node setup and before `pnpm install`, add:

```yaml
      - uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-${{ runner.os }}-${{ github.sha }}
          restore-keys: |
            turbo-${{ runner.os }}-
```

(Write-once-per-sha with prefix restore is the standard Turbo+Actions
pattern: each run restores the most recent cache and saves its own.)

**Verify**: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"`
→ exit 0 (valid YAML). Full proof arrives on the first two CI runs after
merge: the second run's turbo summary shows cache hits (note this in the
report as a post-merge check).

### Step 2: Pre-commit hooks via lefthook

Root: `pnpm add -D -w lefthook`, add `"prepare": "lefthook install"` to root
`package.json` scripts, and create `lefthook.yml`:

```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      run: pnpm lint
    typecheck:
      run: pnpm typecheck
```

(Whole-repo lint+typecheck are seconds-fast with the Turbo cache warm;
staged-file filtering is complexity this repo doesn't need yet.)

**Verify**: `pnpm install` (triggers prepare) → `.git/hooks/pre-commit`
exists and mentions lefthook; make a whitespace-only commit on the branch →
hook runs and passes.

### Step 3: Complete the env docs

Append to `apps/web/.env.example` (names + guidance comments only, NO
values):

```bash
# Anthropic — required only for runs whose panel includes an LLM analyst
# (llm.value). Quant-only panels never read it.
ANTHROPIC_API_KEY=
# Optional model override for LLM analysts (defaults in packages/engine).
HODGET_LLM_MODEL=
# Set to "inline" to execute runs in-process (local dev / tests) instead of
# the durable Vercel Workflow path.
RUN_EXECUTION=
# Absolute origin used for canonical URLs/OG metadata (defaults to the
# production domain when unset).
NEXT_PUBLIC_APP_URL=
```

Mirror the same four rows into README's environment table with one-line
descriptions.

**Verify**: `for v in ANTHROPIC_API_KEY HODGET_LLM_MODEL RUN_EXECUTION NEXT_PUBLIC_APP_URL; do grep -q $v apps/web/.env.example && grep -q $v README.md || echo MISSING $v; done`
→ no output.

### Step 4: Make AGENTS.md load-bearing

Keep the vendored Next.js block untouched at the top; append sections:

1. **Data-access boundary (security-critical)** — all engine/user data goes
   through `apps/web/lib/dal/`; never import `@workspace/db` or
   `@/lib/supabase/server` elsewhere (ESLint enforces it as an ERROR; CI
   runs it). Deliberately public DAL modules (waitlist, demo) document their
   own boundary and are never re-exported from `lib/dal/index.ts`.
2. **Engine invariants** — point-in-time data only (`knownAt <= asOf`);
   LLMs form views, deterministic code executes trades; fixtures are
   deterministic (no `Date.now()`/`Math.random()` in anything rendered or
   asserted).
3. **Package map** — one line each for `apps/web`, `packages/engine`,
   `packages/db`, `packages/ui`, `plans/`.
4. **Commands** — `pnpm dev` / `pnpm typecheck` / `pnpm lint` / `pnpm test`
   / `pnpm build`; tests for `apps/web` live in `apps/web/test/` (never
   colocated under `app/`).
5. **Conventions** — English-only including commits; conventional commits;
   house style skill at `.claude/skills/house-style`; UI reuses
   `packages/ui` primitives before building new ones.

**Verify**: `grep -c "lib/dal" AGENTS.md` ≥ 1;
the `BEGIN:nextjs-agent-rules` block is byte-identical
(`git diff AGENTS.md` shows only additions after the END marker).

## Test plan

No unit tests (config/docs). Verification commands above are the gates.

## Done criteria

- [ ] `ci.yml` contains an `actions/cache` step for `.turbo` and parses as YAML
- [ ] Committing with the hooks installed runs lint+typecheck
- [ ] The four env vars appear in both `.env.example` and README
- [ ] AGENTS.md contains the DAL-boundary section; vendored block unchanged
- [ ] `pnpm lint && pnpm typecheck` exit 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- `pnpm lint` is still red at the start (plan 007 not landed) — stop; hooks
  would block every commit.
- `lefthook install` conflicts with an existing hook manager you discover
  (none is expected).

## Maintenance notes

- If CI time grows past ~5 min despite the cache, the next lever is remote
  Turbo cache (org secrets) — deliberately deferred.
- When plan 013's E2E lands, add its CI job here (build + `playwright
  install --with-deps chromium` + `pnpm test:e2e`).
- The AGENTS.md nextjs block is vendor-managed (BEGIN/END markers) — future
  editors must append outside it.
