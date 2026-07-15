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

## Supported versions

Hodget is pre-1.0. Only the latest `main` receives security fixes.
