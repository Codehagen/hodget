<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Hodget agent guide

## Data-access boundary (security-critical)

All engine and user data access goes through `apps/web/lib/dal/`. Never import
`@workspace/db` or `@/lib/supabase/server` anywhere else in `apps/web` — the
`no-restricted-imports` ESLint rule enforces this as an ERROR and CI runs it.
Deliberately public DAL modules (`lib/dal/waitlist.ts`, demo surfaces) document
their own boundary and are never re-exported from `lib/dal/index.ts`, whose
contract is "every export validates the session first".

## Engine invariants

- Point-in-time data only: an analyst may never see data with
  `knownAt > asOf`. `PitMarketData` enforces this centrally — do not bypass it.
- LLMs form views; deterministic code executes trades. No model output ever
  sizes a position past the risk gate.
- Fixtures are deterministic: no `Date.now()`, `new Date()` without an
  argument, or `Math.random()` in anything rendered or asserted. Seed from
  fixture strings.

## Package map

- `apps/web` — Next.js app: routes, auth (Better Auth), DAL, workflows.
- `packages/engine` — framework-free fund engine: analysts, committee,
  portfolio, risk, backtesting, paper broker, promotion gate.
- `packages/db` — engine persistence: Postgres schema, queries, run executor.
- `packages/ui` — shared shadcn-style components (reuse these before building
  new ones).
- `plans/` — numbered implementation plans + status index (`plans/README.md`).

## Commands

`pnpm dev` · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`
(all Turbo tasks, runnable per package with `--filter`). Web unit tests live
in `apps/web/test/` — never colocated under `app/` (Next would treat them as
routes). E2E: `cd apps/web && pnpm build && pnpm test:e2e`.

## Conventions

- English only, including commit messages; conventional commits
  (`feat(web): …`, `fix(db): …`).
- House coding style: `.claude/skills/house-style` (composable primitives,
  small explicit APIs, open/inspectable code).
- Component tests opt into a DOM per file with `// @vitest-environment jsdom`.
- Tables: new filterable/sortable tables use the `@workspace/ui` `DataTable`
  (its TanStack react-table wrapper); the hand-rolled `<Table>` primitive
  stays for static fixture tables. Don't introduce a third approach.
