import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

/**
 * Component tests for the shared UI package (plan 012). Tests are colocated
 * next to their components (.test.tsx under src) and run under jsdom; the
 * "@workspace/ui" alias mirrors the package's own export map so components
 * import each other the same way consumers do.
 */
export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@workspace/ui": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
})
