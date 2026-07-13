import { config as baseConfig } from "@workspace/eslint-config/base"

/** @type {import("eslint").Linter.Config} */
export default [
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        Buffer: "readonly",
        Intl: "readonly",
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: ["dist/**", "fixtures/dataset.json"],
  },
]
