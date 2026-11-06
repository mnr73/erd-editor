import pluginJs from "@eslint/js";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
    { ignores: ["dist/**", "node_modules/**", "design/**", "src-tauri/**"] },
    {
        files: ["**/*.{js,mjs,cjs,vue}"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: globals.browser,
        },
    },
    {
        files: ["*.config.js"],
        languageOptions: { globals: globals.node },
    },
    pluginJs.configs.recommended,
    ...pluginVue.configs["flat/recommended"],
    {
        rules: {
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "vue/multi-word-component-names": "off",
            "vue/require-default-prop": "off",
        },
    },
    // must be last
    prettierRecommended,
];
