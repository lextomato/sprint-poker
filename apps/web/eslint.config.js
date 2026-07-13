import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import vue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

export default [
  {
    ignores: [".nuxt/**", ".output/**", "dist/**", "node_modules/**"]
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: "module" }
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      "@typescript-eslint/no-explicit-any": "error"
    }
  },
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        sourceType: "module"
      }
    },
    plugins: { vue, "@typescript-eslint": tseslint },
    rules: {
      ...vue.configs["vue3-recommended"].rules,
      "@typescript-eslint/no-explicit-any": "error"
    }
  }
];
