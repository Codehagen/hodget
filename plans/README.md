# Plans

Implementation plans written by the advisor pass. Each plan is self-contained:
an executor with no context from the session that produced it should be able to
run it end to end.

Written against commit `6925655`.

| # | Plan | Category | Effort | Risk | Status |
| --- | --- | --- | --- | --- | --- |
| 001 | [Enforce the session invariant structurally, not with a checkbox](./001-enforce-session-invariant.md) | Security / DX | M | Low | TODO |
| 002 | [The engine: first-principles architecture and build plan](./002-engine-architecture.md) | Architecture | XL | Medium | TODO |
| 003 | [Market data acquisition: providers, Norwegian coverage, and the fixture strategy](./003-market-data-acquisition.md) | Architecture / Data | L | Medium | TODO |

## Considered and rejected

- **A custom ESLint rule that checks every `page.tsx` under a protected route
  calls `requireSession()`.** This enforces the wrong invariant. It can be
  satisfied by calling `requireSession()` and then querying data with an
  unrelated client, and it cannot see data access inside imported helpers. The
  import boundary in plan 001 is both simpler and stronger.
- **Validating the session inside `proxy.ts`.** Would run a database query on
  every request including prefetches. Next.js explicitly advises against it, and
  Better Auth does too.
- **Relying on a layout to protect its child routes.** Layouts do not re-render
  on every navigation within their segment, so this leaks.
