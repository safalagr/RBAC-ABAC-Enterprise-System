import js from "@eslint/js";
import globals from "globals";
import pluginSecurity from "eslint-plugin-security";

export default [
  js.configs.recommended,
  pluginSecurity.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    },
    rules: {
      "no-unused-vars": "off",
      "no-console": "off",
      "no-undef": "warn"
    }
  }
];
