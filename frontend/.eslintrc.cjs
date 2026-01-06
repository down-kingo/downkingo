module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "plugin:i18next/recommended",
  ],
  ignorePatterns: ["dist", ".eslintrc.cjs", "i18next-parser.config.js"],
  parser: "@typescript-eslint/parser",
  plugins: ["react-refresh", "i18next"],
  rules: {
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
    "i18next/no-literal-string": [
      "error",
      {
        markupOnly: true,
        ignoreAttribute: [
          "data-testid",
          "to",
          "target",
          "href",
          "className",
          "style",
          "type",
          "src",
          "alt",
          "width",
          "height",
          "id",
          "key",
          "ref",
          "rel",
          "as",
          "size",
          "color",
          "variant",
          "layout",
          "icon", // Tabler icons & framer motion
          "initial",
          "animate",
          "exit",
          "whileHover",
          "whileTap",
          "transition", // Framer motion
          "code",
          "lang", // markdown
        ],
      },
    ],
  },
};
