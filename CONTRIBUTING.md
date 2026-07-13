# Contributing to Hodget

Thanks for wanting to help. Hodget is early, so the highest-value contributions
right now are alpha models, data adapters, and anything that makes backtests more
honest.

## Setup

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # fill in the values, see README
pnpm dev
```

## Before you open a pull request

```bash
pnpm typecheck
pnpm lint
pnpm build
```

All three must pass. CI runs the same commands.

## Conventions

- **TypeScript everywhere**, strict. No `any` without a comment explaining why.
- **Explicit over clever.** Readable module names and straightforward helpers beat
  deep indirection. If a reviewer has to trace three files to understand a change,
  simplify it.
- **Generated types stay generated.** Never hand-edit `lib/supabase/types.ts` —
  change the schema and run `pnpm --filter web db:types`.
- **Auth is validated server-side.** All database access goes through `lib/dal`,
  which validates the session against the database on every call. ESLint blocks
  any import of the Supabase server client from outside the DAL, so this is
  enforced in CI rather than by review. `proxy.ts` only redirects signed-out users
  to the sign-in page — it reads the session cookie without validating it and is
  **not** a security boundary.
- **Next.js 16 conventions.** This version has breaking changes from older
  releases (for example `middleware.ts` is now `proxy.ts`). Check
  `node_modules/next/dist/docs/` rather than assuming.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`.

## Contributing an alpha model

An alpha model takes a ticker and a point-in-time date, and returns a signal
between -1 and +1 plus written reasoning. It must never see data filed after the
simulation date — that is the one rule we don't bend, because breaking it makes
every backtest a lie.

Include a backtest in your PR showing how the model behaves. A model that loses
money honestly is more useful than one that wins by peeking.

## Reporting bugs

Open an issue with what you expected, what happened, and the steps to reproduce.
For security vulnerabilities, see [SECURITY.md](./SECURITY.md) instead.

## License

By contributing, you agree that your contributions are licensed under
[AGPL-3.0](./LICENSE).
