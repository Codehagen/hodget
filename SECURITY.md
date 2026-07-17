# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security vulnerabilities.

Report them privately through
[GitHub Security Advisories](https://github.com/Codehagen/hodget/security/advisories/new),
or by email to <security@hodget.com>.

Include what you found, how to reproduce it, and what an attacker could do with
it. You can expect an initial response within 72 hours.

## Scope

Hodget handles authentication credentials and can be connected to brokerage
accounts, so we take the following especially seriously:

- Authentication and session handling (Better Auth, `proxy.ts`, `lib/session.ts`)
- Row-level security and any path that leaks another user's portfolio data
- Anything that could cause an unintended trade or move funds
- Exposure of API keys or database credentials

## Workflow endpoints

Durable run execution (plan 004) generates `/.well-known/workflow/v1/step` and
`/flow` routes (Workflow DevKit / `workflow` npm package). These invoke run-execution
step bodies without an app-level session check.

This is a verified platform gate, not an assumption. On Vercel, the Workflow SDK's
Next.js build step writes `.well-known/workflow/v1/config.json` with
`experimentalTriggers` that register `step` and `flow` as [Vercel Queue
consumers](https://vercel.com/docs/queues/concepts#consumer-function-security) —
this makes the underlying functions unreachable through public HTTP entirely, both
on Vercel and locally: a production `next build` does not emit these routes into
Next's app route table at all, so an unauthenticated request gets the same 404 as
any nonexistent path (see `apps/web/e2e/workflow-gating.spec.ts`). Ownership of
run data is enforced independently of this gate: a `runId` only ever enters a
workflow via `createRun` (behind `requireSession`), and every read stays behind
`getOwnedRun` — see `apps/web/lib/dal/run-workflow.ts`.

The generated `/.well-known/workflow/v1/webhook/[token]` route is different:
`createWebhook()` is documented as an intentionally public endpoint, gated only by
its token. This codebase does not call `createWebhook()`, so that route is unused
surface.

## Supported versions

Hodget is pre-1.0. Only the latest `main` receives security fixes.
