---
name: house-style
description: "Hodget's house coding style — composable primitives, small explicit APIs, open/inspectable code, TypeScript + workspace discipline. Use when writing or reviewing any hodget code, especially UI components, package structure, and templates."
---

# Hodget house style

Hodget's coding style is heavily inspired by @shadcn's work (github.com/shadcn-ui/ui and the surrounding ecosystem: taxonomy, next-contentlayer, app-tailwind-v4) — credit where due. The distilled principles:

## Coding patterns to mirror

- **Composable primitives over monoliths.** Components and modules are designed to be copied, extended, and customized — not configured through prop soup.
- **Small, explicit APIs.** Defaults work well out of the box; customization is straightforward. No black-box abstractions.
- **Accessibility and headless primitives first** — Radix-based patterns for UI.
- **TypeScript everywhere**, workspace boundaries respected, repeatable scripts instead of ad hoc glue.
- **Open, inspectable code.** Favor code you can read, redistribute, and adapt over clever indirection. Transparent implementation is a feature.
- **Maintainability and handoff:** self-contained packages, clear build/test/format commands, markdown plans/docs when coordinating work.

## UI taste

- Modern, restrained, system-like: Tailwind, Radix, dark mode, reusable component patterns.
- Visual polish matters, but never at the expense of flexibility.
- Clean, content-forward, easy to extend — not heavily branded.
- Documentation and examples are part of the product, not an afterthought.

## Stack alignment (matches hodget)

TypeScript, Next.js App Router + server components, React + Radix + Tailwind, pnpm workspaces + Turborepo, Zod. In hodget: reuse `packages/ui` components before building new ones; new shared components go there, shaped like shadcn/ui components (one file, exported parts, cva variants where applicable, cn() for class merging).

## When to inspect the real repos first

Clone into the session scratchpad (never the repo) and study before:
- Copying App Router/server-component patterns (taxonomy is archived — patterns may be deprecated; prefer current Next.js docs in `node_modules/next/dist/docs/`).
- Designing a new component API for `packages/ui` — match shadcn-ui/ui's naming, file structure, and level of abstraction.
- Making style decisions for docs/marketing surfaces.

Apply patterns you observed; adapt, don't copy blindly.
