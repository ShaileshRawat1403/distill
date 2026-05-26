import js from "@eslint/js"
import tseslint from "typescript-eslint"
import reactHooks from "eslint-plugin-react-hooks"
import globals from "globals"

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "*.config.js", "*.config.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.worker },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Real correctness issue → error
      "react-hooks/rules-of-hooks": "error",
      "no-case-declarations": "off",
      // react-hooks v7's React-Compiler-readiness rules are advisory for this
      // existing codebase → keep them visible as warnings, not blocking errors.
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "preserve-caught-error": "warn",
      "no-useless-assignment": "warn",
      // Style/strictness nits → warnings (don't block)
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  // Tests may use a looser style.
  {
    files: ["**/*.test.ts", "**/__tests__/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
)
