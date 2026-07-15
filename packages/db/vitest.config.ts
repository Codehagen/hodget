import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    // pglite spins a full Postgres per test file; on contended CI runners the
    // 5s default flakes. Headroom, not an SLA.
    testTimeout: 30_000,
  },
})
