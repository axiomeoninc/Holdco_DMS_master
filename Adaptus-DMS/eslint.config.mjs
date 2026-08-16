import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated build artifacts (gitignored) — linting them OOMs eslint.
    "storybook-static/**",
    ".open-next/**",
    ".wrangler/**",
    ".wrangler-dry/**",
    // Local scratch audit dir (gitignored), not part of the app.
    "_sync_audit/**",
  ]),
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      // The codebase predates the React Compiler-era rules and has an
      // established fetch-on-mount / form-init-in-effect pattern across
      // 50+ screens. Keep these visible as warnings rather than blocking CI.
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
