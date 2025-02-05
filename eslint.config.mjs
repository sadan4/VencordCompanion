// @ts-check

import stylistic from "@stylistic/eslint-plugin";

import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";
export default tseslint.config(
    { ignores: ["dist", "src/webview"] },
    {
        files: ["src/**/*.{tsx,ts,mts,mjs,js,jsx}", "eslint.config.mjs"],
        plugins: {
            "@stylistic": stylistic,
            "@typescript-eslint": tseslint.plugin,
            "simple-import-sort": simpleImportSort,
            "unused-imports": unusedImports
        },
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                tsconfigRootDir: import.meta.dirname
            }
        },
        rules: {

            // Style Rules
            "@stylistic/jsx-quotes": ["error", "prefer-double"],
            "@stylistic/quotes": ["error", "double", { "avoidEscape": true }],
            "@stylistic/no-mixed-spaces-and-tabs": "error",
            "@stylistic/arrow-parens": ["error", "as-needed"],
            "@stylistic/eol-last": ["error", "always"],
            "@stylistic/no-multi-spaces": "error",
            "@stylistic/no-trailing-spaces": "error",
            "@stylistic/no-whitespace-before-property": "error",
            "@stylistic/semi": ["error", "always"],
            "@stylistic/semi-style": ["error", "last"],
            "@stylistic/space-in-parens": ["error", "never"],
            "@stylistic/block-spacing": ["error", "always"],
            "@stylistic/object-curly-spacing": ["error", "always"],
            "@stylistic/spaced-comment": ["error", "always", { "markers": ["!"] }],
            "@stylistic/no-extra-semi": "error",

            // TS Rules
            "@stylistic/func-call-spacing": ["error", "never"],

            // ESLint Rules
            "yoda": "error",
            "eqeqeq": ["error", "always", { "null": "ignore" }],
            "prefer-destructuring": ["error", {
                "VariableDeclarator": { "array": false, "object": true },
                "AssignmentExpression": { "array": false, "object": false }
            }],
            "operator-assignment": ["error", "always"],
            "no-useless-computed-key": "error",
            "no-unneeded-ternary": ["error", { "defaultAssignment": false }],
            "no-invalid-regexp": "error",
            "no-constant-condition": ["error", { "checkLoops": false }],
            "no-duplicate-imports": "error",
            "dot-notation": "error",
            "no-fallthrough": "error",
            "for-direction": "error",
            "no-async-promise-executor": "error",
            "no-cond-assign": "error",
            "no-dupe-else-if": "error",
            "no-duplicate-case": "error",
            "no-irregular-whitespace": "error",
            "no-loss-of-precision": "error",
            "no-misleading-character-class": "error",
            "no-prototype-builtins": "error",
            "no-regex-spaces": "error",
            "no-shadow-restricted-names": "error",
            "no-unexpected-multiline": "error",
            "no-unsafe-optional-chaining": "error",
            "no-useless-backreference": "error",
            "use-isnan": "error",
            "prefer-const": "error",
            "prefer-spread": "error",
            // unused imports
            "no-unused-vars": "off",
            "unused-imports/no-unused-imports": "error",
            "unused-imports/no-unused-vars": ["warn", {
                vars: "all",
                varsIgnorePattern: "^_",
                args: "after-used",
                argsIgnorePattern: "^_",
            }],
            // Plugin Rules
            "simple-import-sort/imports": ["error", {
                groups: [
                    ["^@.+$"],
                    ["^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$", "^\\.\\.(?!/?$)", "^\\.\\./?$"],
                    [
                        "^(assert|buffer|child_process|cluster|console|constants|crypto|dgram|dns|domain|events|fs|http|https|module|net|os|path|punycode|querystring|readline|repl|stream|string_decoder|sys|timers|tls|tty|url|util|vm|zlib|freelist|v8|process|async_hooks|http2|perf_hooks)(/.*|$)"
                    ],
                ]
            }],
            "simple-import-sort/exports": "error",
        }
    }
);
