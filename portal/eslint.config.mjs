import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "next-env.d.ts"]
  },
  js.configs.recommended,
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
        React: "readonly",
        Request: "readonly",
        Response: "readonly",
        File: "readonly",
        FormData: "readonly",
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        window: "readonly",
        document: "readonly",
        URL: "readonly",
        Intl: "readonly",
        setTimeout: "readonly",
        describe: "readonly",
        expect: "readonly",
        it: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
    }
  }
];
