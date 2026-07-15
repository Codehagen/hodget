# Hodget

An open-source AI hedge fund. A panel of AI analysts and quant models research
tickers, each forms a view, and the portfolio layer turns those views into
positions — with backtesting, risk controls and a full audit trail of every
decision.

> [!WARNING]
> **This is not financial advice.** Hodget is a research and educational
> project. Nothing it produces is a recommendation to buy or sell any security.
> Trading involves substantial risk of loss. If you connect it to real money you
> do so entirely at your own risk, and you alone are responsible for the outcome.
> The authors accept no liability. Start with paper trading.

## How it works

Signals flow in one direction, and every stage is inspectable:

```
Market data (point-in-time)
  → Alpha models   LLM analyst agents + quant models; each returns a signal (-1..+1) with written reasoning
  → Portfolio      blends the views into target weights
  → Risk           position sizing, drawdown limits
  → Execution      paper or live
  → Ledger         every decision, stored and replayable
```

Two rules keep it honest. **Point-in-time data**: a model only ever sees what was
actually filed by the simulation date, so backtests can't cheat. **Separation of
concerns**: LLMs form opinions, deterministic code executes trades. No model ever
moves money directly.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router), React 19 |
| UI | Tailwind v4, shadcn/ui |
| Data | Supabase (Postgres), generated TypeScript types |
| Auth | Better Auth |
| Server state | TanStack Query |
| URL state | nuqs |
| Monorepo | pnpm workspaces + Turborepo |

## Getting started

Requires Node ≥20 and pnpm 10.

```bash
git clone https://github.com/Codehagen/hodget.git
cd hodget
pnpm install
cp apps/web/.env.example apps/web/.env.local   # then fill it in, see below
pnpm dev
```

The app runs at http://localhost:3000.

## Environment variables

Set these in `apps/web/.env.local`.

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `DATABASE_URL` | Supabase → Project Settings → Database (session pooler URI) |
| `BETTER_AUTH_SECRET` | Generate one: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `http://localhost:3000` in development |
| `ANTHROPIC_API_KEY` | console.anthropic.com — only needed for runs whose panel includes an LLM analyst |
| `HODGET_LLM_MODEL` | Optional model override for LLM analysts (defaults in `packages/engine`) |
| `RUN_EXECUTION` | Set to `inline` to execute runs in-process instead of the durable workflow (local dev/tests) |
| `NEXT_PUBLIC_APP_URL` | Absolute origin for canonical/OG metadata; defaults to the production domain |

## Database

Better Auth talks to Postgres directly and owns the auth tables. Application
tables are managed in Supabase, and their TypeScript types are generated — never
hand-written.

```bash
pnpm --filter web auth:generate   # create or refresh the auth schema
pnpm --filter web db:types        # regenerate lib/supabase/types.ts
```

Run `db:types` after every schema change.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the app in development |
| `pnpm build` | Production build |
| `pnpm lint` | Lint every workspace |
| `pnpm typecheck` | Type-check every workspace |
| `pnpm format` | Format with Prettier |

## Repository layout

```
apps/web                     Next.js app: routes, auth, Supabase clients
packages/engine              The fund engine: analysts, committee, portfolio, risk, backtesting, paper broker
packages/db                  Engine persistence: Postgres schema, queries, the run executor
packages/ui                  Shared shadcn/ui components
packages/eslint-config
packages/typescript-config
```

## Security

All database access goes through `lib/dal`, which validates the session against
the database on every call. ESLint blocks any import of the Supabase server
client from outside the DAL, so this is enforced in CI rather than by review.
`proxy.ts` only redirects signed-out users to the sign-in page — it reads the
session cookie without validating it and is **not** a security boundary.

Found a vulnerability? See [SECURITY.md](./SECURITY.md) — please don't open a
public issue.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[AGPL-3.0](./LICENSE). You are free to use, modify and self-host Hodget. If you
run a modified version as a network service, you must publish your changes under
the same license. For a commercial license, get in touch.
