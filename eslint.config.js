// @ts-check
const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");
const prettier = require("eslint-config-prettier");
const pluginPrettier = require("eslint-plugin-prettier");

module.exports = tseslint.config(
  {
    files: ["**/*.ts"],
    plugins: {
      prettier: pluginPrettier,
    },
    rules: {
      ...prettier.rules, // disables formatting-related rules
      "prettier/prettier": "error", // enables prettier as a lint rule
      semi: ["error", "always"],
      // "keyword-spacing": "error",
      "@typescript-eslint/explicit-function-return-type": ["error", { allowTypedFunctionExpressions: true }],
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-type-assertions": "off",
      "@angular-eslint/directive-selector": [
        "error",
        { type: "attribute", prefix: "app", style: "camelCase" },
      ],
      "@angular-eslint/component-selector": [
        "error",
        { type: "element", prefix: "app", style: "kebab-case" },
      ],
    },
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
  },
  {
    files: ["**/*.html"],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      "@angular-eslint/template/no-autofocus": "off",
      "@angular-eslint/template/click-events-have-key-events": "off",
      "@angular-eslint/template/interactive-supports-focus": "off",
    },
  }
);
