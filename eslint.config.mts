// @ts-check

import stylistic, { RuleOptions, UnprefixedRuleOptions } from "@stylistic/eslint-plugin";

import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";
import { ESLintRules } from "eslint/rules";
type PrefixRules<Rules extends Record<string, any>, Prefix extends string> = {
    [K in keyof Rules as K extends string ? `${Prefix}${K}` : never]: Rules[K]
}
const lintRules: ESLintRules = {
    "array-callback-return": "error",
    // done by tsserver
    "constructor-super": "off",
    "for-direction": "error",
    // done by tsserver
    "getter-return": "off",
    "no-async-promise-executor": "error",
    "no-await-in-loop": "error",
    // done by tsserver
    "no-class-assign": "off",
    "no-compare-neg-zero": "error",
    "no-cond-assign": ["error", "except-parens"],
    // done by tsserver
    "no-const-assign": "off",
    "no-constant-binary-expression": "error",
    "no-constant-condition": ["error", {
        // @ts-expect-error Why is this erroring
        checkLoops: "allExceptWhileTrue"
    }],
    "no-constructor-return": "error",
    "no-control-regex": "error",
    "no-debugger": "warn",
    // done by tsserver
    "no-dupe-args": "off",
    // done by tsserver
    "no-dupe-class-members": "off",
    "no-dupe-else-if": "error",
    // done by tsserver
    "no-dupe-keys": "off",
    "no-duplicate-case": "error",
    "no-duplicate-imports": "error",
    "no-empty-character-class": "error",
    "no-empty-pattern": "error",
    "no-ex-assign": "error",
    "no-fallthrough": ["error", {
        allowEmptyCase: true,
        reportUnusedFallthroughComment: true
    }],
    // done by tsserver
    "no-func-assign": "off",
    // done by tsserver
    "no-import-assign": "off",
    // only for pre-es6
    "no-inner-declarations": "off",
    // FIXME: allow for \i in patches
    "no-invalid-regexp": "error",
    "no-irregular-whitespace": "error",
    "no-loss-of-precision": "error",
    "no-misleading-character-class": "error",
    // done by tsserver
    "no-new-native-nonconstructor": "off",
    // done by tsserver
    "no-obj-calls": "off",
    "no-promise-executor-return": "error",
    "no-prototype-builtins": "error",
    "no-self-assign": "error",
    "no-self-compare": "error",
    // done by tsserver
    "no-setter-return": "off",
    "no-sparse-arrays": "error",
    "no-template-curly-in-string": "error",
    // done by tsserver
    "no-this-before-super": "off",
    // done by tsserver
    "no-undef": "off",
    "no-unexpected-multiline": "error",
    "no-unmodified-loop-condition": "error",
    // done by tsserver
    "no-unreachable": "off",
    "no-unreachable-loop": "error",
    "no-unsafe-finally": "error",
    // done by tsserver
    "no-unsafe-negation": "off",
    "no-unsafe-optional-chaining": "error",
    "no-unused-private-class-members": "error",
    "no-unused-vars": ["warn", {
        args: "after-used",
        vars: "all",
        varsIgnorePattern: "^_",
        argsIgnorePattern: "^_",
        caughtErrors: "all",
        reportUsedIgnorePattern: true
    }],
    "no-use-before-define": "error",
    "no-useless-assignment": "error",
    "no-useless-backreference": "error",
    "require-atomic-updates": "off",
    "use-isnan": ["error", {
        enforceForIndexOf: true,
        enforceForSwitchCase: true
    }],
    "valid-typeof": "error",
    // suggestions
    "accessor-pairs": ["error", {
        enforceForClassMembers: true
    }],
    "block-scoped-var": "error",
    "default-case": "error",
    "default-case-last": "error",
    "dot-notation": "error",
    "default-param-last": "error",
    "eqeqeq": ["error", "always", { null: "ignore" }],
    "grouped-accessor-pairs": ["error", "getBeforeSet"],
    "logical-assignment-operators": ["error", "always", {
        enforceForIfStatements: true
    }],
    "max-params": "error",
    "no-caller": "error",
    "no-case-declarations": "error",
    "no-delete-var": "error",
    "no-else-return": "error",
    "no-empty": "error",
    "no-empty-static-block": "error",
    "no-extend-native": "error",
    "no-extra-bind": "error",
    "no-extra-boolean-cast": "error",
    "no-extra-label": "error",
    "no-global-assign": "error",
    "no-implied-eval": "error",
    "no-label-var": "error",
    "no-lonely-if": "error",
    "no-multi-str": "error",
    "no-nonoctal-decimal-escape": "error",
    "no-octal": "error",
    "no-octal-escape": "error",
    "no-param-reassign": "error",
    "no-redeclare": "error",
    "no-regex-spaces": "error",
    "no-return-assign": ["error", "except-parens"],
    "no-sequences": "error",
    "no-shadow-restricted-names": "error",
    "no-throw-literal": "error",
    "no-unneeded-ternary": "error",
    "no-unused-labels": "error",
    "no-useless-call": "error",
    "no-useless-catch": "error",
    "no-useless-computed-key": "error",
    "no-useless-concat": "error",
    "no-useless-escape": "error",
    "no-useless-rename": "error",
    "no-var": "error",
    "no-with": "error",
    "object-shorthand": "error",
    "operator-assignment": ["error", "always"],
    "prefer-const": ["error", {
        "destructuring": "any",
    }],
    "prefer-exponentiation-operator": "error",
    "prefer-numeric-literals": "error",
    "prefer-object-has-own": "error",
    "prefer-object-spread": "error",
    "prefer-promise-reject-errors": "error",
    "prefer-regex-literals": ["error", {
        disallowRedundantWrapping: true
    }],
    "prefer-rest-params": "error",
    "prefer-spread": "error",
    "prefer-template": "error",
    "require-await": "error",
    "require-yield": "error",
    "symbol-description": "error",
    "yoda": ["error", "never"],
};
// const styleRules: RuleOptions = {
//     "@stylistic/array-bracket-newline": []
// }
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
            ...lintRules,
            // ESLint Rules
            // "yoda": "error",
            // "eqeqeq": ["error", "always", { "null": "ignore" }],
            // "prefer-destructuring": ["error", {
            //     "VariableDeclarator": { "array": false, "object": true },
            //     "AssignmentExpression": { "array": false, "object": false }
            // }],
            // "operator-assignment": ["error", "always"],
            // "no-useless-computed-key": "error",
            // "no-unneeded-ternary": ["error", { "defaultAssignment": false }],
            // "no-invalid-regexp": "error",
            // "no-constant-condition": ["error", { "checkLoops": false }],
            // "no-duplicate-imports": "error",
            // "dot-notation": "error",
            // "no-fallthrough": "error",
            // "for-direction": "error",
            // "no-async-promise-executor": "error",
            // "no-cond-assign": "error",
            // "no-dupe-else-if": "error",
            // "no-duplicate-case": "error",
            // "no-irregular-whitespace": "error",
            // "no-loss-of-precision": "error",
            // "no-misleading-character-class": "error",
            // "no-prototype-builtins": "error",
            // "no-regex-spaces": "error",
            // "no-shadow-restricted-names": "error",
            // "no-unexpected-multiline": "error",
            // "no-unsafe-optional-chaining": "error",
            // "no-useless-backreference": "error",
            // "use-isnan": "error",
            // "prefer-const": "error",
            // "prefer-spread": "error",
            // // unused imports
            // "no-unused-vars": "off",
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
