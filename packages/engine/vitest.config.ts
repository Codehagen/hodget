import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Live-provider tests are gated behind LIVE_DATA_TESTS and excluded by default.
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.live.test.ts"],
  },
})
