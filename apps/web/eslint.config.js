import { nextJsConfig } from "@workspace/eslint-config/next-js"
import { disableOnlyWarn } from "@workspace/eslint-config/only-warn"

// The shared base config registers eslint-plugin-only-warn, which patches
// Linter.prototype.verify AT IMPORT TIME to downgrade every severity-2 error to a
// warning. That makes the DAL import boundary below rely entirely on the
// `--max-warnings 0` flag in the web lint script. For this app the boundary is a
// security control and must be a real ERROR, so undo the global patch here. This
// only affects the web package's own ESLint process — other packages import the
// base config in their own processes and keep only-warn.
disableOnlyWarn()

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/supabase/server", "@/lib/supabase/server"],
              message:
                "Do not query the database directly. Go through lib/dal — it validates the session. proxy.ts is not a security boundary.",
            },
            {
              group: ["**/lib/auth", "@/lib/auth"],
              message:
                "Import requireSession from @/lib/session, not the auth instance directly.",
            },
          ],
        },
      ],
    },
  },
  {
    // The DAL, the session helper and the auth route handler are the only
    // places allowed to reach past the boundary.
    files: [
      "lib/dal/**",
      "lib/session.ts",
      // The [...all] catch-all segment is a minimatch bracket expression, so the
      // literal path never matches — match the auth route dir instead.
      "app/api/auth/**",
      "lib/supabase/server.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]
