import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Server components legitimately compute per-request values (dates,
      // query windows) during render — the React Compiler purity rule is a
      // false positive there. Prop-sync uses the sanctioned render-phase
      // adjustment pattern instead of effects.
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      // Underscore-prefixed args are intentional API placeholders kept for
      // future use or interface conformance (e.g. softSkillsFor's family slot).
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cursor agent tooling: CommonJS hook scripts, not app code.
    ".cursor/**",
  ]),
]);

export default eslintConfig;
