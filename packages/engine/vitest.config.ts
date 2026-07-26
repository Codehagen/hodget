import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Live-provider tests are gated behind LIVE_DATA_TESTS and excluded by default.
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.live.test.ts"],
    // Several suites run full fixture backtests (seconds of CPU each). On
    // contended machines — CI's 2-core runners with every package's suite in
    // parallel — the 5s default flakes; this is headroom, not an SLA.
    testTimeout: 30_000,
  },
})
