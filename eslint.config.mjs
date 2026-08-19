import { FlatCompat } from "@eslint/eslintrc";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname
});

const browserGlobals = {
  window: "readonly",
  document: "readonly",
  navigator: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  File: "readonly",
  FormData: "readonly",
  URLSearchParams: "readonly",
  fetch: "readonly"
};

const nodeGlobals = {
  process: "readonly",
  Buffer: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  AbortSignal: "readonly"
};

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.tsbuildinfo",
      "apps/web/next-env.d.ts"
    ]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript").map((config) => ({
    ...config,
    files: ["apps/web/**/*.{ts,tsx}"],
    settings: {
      ...config.settings,
      next: {
        ...config.settings?.next,
        rootDir: "apps/web"
      }
    }
  })),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true }
      },
      globals: {
        ...browserGlobals,
        ...nodeGlobals
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin
    },
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
];
