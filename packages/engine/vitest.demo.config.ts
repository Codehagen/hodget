import { defineConfig } from "vitest/config"

// Config for the demo runner only: `pnpm --filter @workspace/engine demo`.
// The default vitest.config.ts (src/**) never picks up scripts/.
export default defineConfig({
  test: {
    include: ["scripts/**/*.test.ts"],
  },
})
