import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

/**
 * Route-handler tests run under plain Node. Tests live in `test/` (not colocated
 * in `app/`) so Next never treats them as routes. Two aliases make server modules
 * importable: `@` resolves the app's own imports (mirrors tsconfig's `@/*`), and
 * `server-only` becomes a no-op (its production guard throws outside an RSC build).
 *
 * Component tests (plan 012) opt into a DOM per file with a
 * `// @vitest-environment jsdom` docblock — the default stays node so the
 * route/DAL suite keeps its speed. `test/setup.ts` adds the small polyfills
 * jsdom is missing (ResizeObserver, matchMedia) that the UI primitives expect.
 */
export default defineConfig({
  // Next's tsconfig sets jsx: "preserve" (its compiler owns the transform);
  // vitest's esbuild needs the automatic runtime spelled out for .tsx tests.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["./test/setup.ts"],
    // Route-handler tests run without a workflow runtime: force the in-process
    // (inline) execution path so any unmocked startRun stays process-local.
    env: { RUN_EXECUTION: "inline" },
  },
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
})
