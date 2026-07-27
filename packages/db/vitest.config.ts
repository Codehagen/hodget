import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    // pglite spins a full Postgres per test file; on contended CI runners the
    // 5s default flakes. Headroom, not an SLA.
    testTimeout: 30_000,
    // `testTimeout` does NOT cover beforeAll/beforeEach — hooks have their own
    // budget, defaulting to 10s. pglite starts up inside `beforeAll`, so every
    // one of these suites was still running on the 10s default and failing with
    // "Hook timed out in 10000ms" whenever turbo ran four packages at once
    // (reproduced locally: 12 failures at default concurrency, 0 at
    // --concurrency=1). Same rationale and same number as testTimeout.
    hookTimeout: 30_000,
  },
})
