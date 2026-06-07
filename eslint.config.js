import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "reports/**"]
  },

  // ── All TypeScript files ──────────────────────────────────────────────────
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      // Prevent hardcoded timeouts
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='waitForTimeout']",
          message: "waitForTimeout is banned. Use state-based waits instead (expect, waitForLoadState, etc.)"
        },
        {
          selector: "CallExpression[callee.name='setTimeout']",
          message: "setTimeout is banned in tests. Use Playwright auto-waiting."
        },
        {
          selector: "CallExpression[callee.name='sleep']",
          message: "sleep is banned. Use expect().toBeVisible() or similar state-based waits."
        }
      ],

      // Async/await
      "require-await": "error",
      "@typescript-eslint/no-floating-promises": "error",

      // Code quality
      "max-len": ["error", { code: 100, ignoreStrings: true, ignoreTemplateLiterals: true }],
      "id-length": ["error", {
        min: 3,
        exceptions: ["i", "id", "x", "y", "a", "b", "f", "r", "s", "t", "fs", "el", "ms", "ok", "v", "p", "to", "CI"]
      }],
      complexity: ["error", 15],
      "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }],

      // Explicit types
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ]
    }
  },

  // ── Spec files — relax function length (test blocks are naturally long) ───
  {
    files: ["tests/**/*.spec.ts"],
    rules: {
      "max-lines-per-function": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
      complexity: ["error", 20]
    }
  },

  // ── Utility scripts — relax length/complexity for analysis tools ──────────
  {
    files: ["utils/reporters/**/*.ts", "utils/patterns/**/*.ts", "utils/agents/**/*.ts"],
    rules: {
      "max-lines-per-function": ["error", { max: 120, skipBlankLines: true, skipComments: true }],
      complexity: ["error", 20]
    }
  },

  // ── Page objects — async methods returning locator promises don't need await
  {
    files: ["pages/**/*.ts"],
    rules: {
      "require-await": "off"
    }
  },

  // ── AI utilities — agent stubs use any for extensibility ─────────────────
  {
    files: ["utils/ai/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "require-await": "off",
      "no-restricted-syntax": "off"
    }
  }
];
