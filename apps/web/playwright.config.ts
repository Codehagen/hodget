import { defineConfig } from "@playwright/test"

/**
 * E2E smoke over the public surfaces (plan 013). Runs against a local
 * PRODUCTION build: `pnpm build` must precede `pnpm test:e2e` (the webServer
 * below only starts the server). Public pages need no env vars — the demo is
 * fixture-backed and the waitlist fails soft without Supabase config.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
