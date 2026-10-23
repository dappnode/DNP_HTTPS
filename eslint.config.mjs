import tsPlugin from "@typescript-eslint/eslint-plugin";
import globals from "globals";

export default [
  ...tsPlugin.configs["flat/recommended"],
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.node,
    },
    rules: {
      "max-len": ["error", 1000],
    },
  },
];
