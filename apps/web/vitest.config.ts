import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

/**
 * Route-handler tests run under plain Node. Tests live in `test/` (not colocated
 * in `app/`) so Next never treats them as routes. Two aliases make server modules
 * importable: `@` resolves the app's own imports (mirrors tsconfig's `@/*`), and
 * `server-only` becomes a no-op (its production guard throws outside an RSC build).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
})
