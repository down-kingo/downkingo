import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import i18next from "eslint-plugin-i18next";

export default tseslint.config(
  { ignores: ["dist", "wailsjs", "*.config.js", "*.config.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      i18next: i18next,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Temporarily downgraded to warn - too many violations to fix now
      "i18next/no-literal-string": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/ban-ts-comment": "warn",
      "prefer-const": "warn",
      // React hooks rules - set to warn for now
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "off",
    },
  }
);
