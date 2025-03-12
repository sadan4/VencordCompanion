// @ts-check

import stylistic, { RuleOptions, UnprefixedRuleOptions } from "@stylistic/eslint-plugin";

import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import TSEslint from "typescript-eslint";
// cursed
import type ruleTypes from "./node_modules/@typescript-eslint/eslint-plugin/dist/rules";
import { ESLintRules as IESLintRules } from "eslint/rules";
import { Linter } from "eslint";
type PrefixRules<Rules extends Record<string, any>, Prefix extends string> = {
    [K in keyof Rules as K extends string ? `${Prefix}${K}` : never]: Rules[K]
}
const ESLintRules: IESLintRules = {
    "array-callback-return": ["error", {
        allowImplicit: true
    }],
    // done by tsserver
    "constructor-super": "off",
    "for-direction": "error",
    // done by tsserver
    "getter-return": "off",
    "no-async-promise-executor": "error",
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
    // done by no-unused-imports
    "no-unused-vars": "off",
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
    "require-yield": "error",
    "yoda": ["error", "never"],
};
type ExtractRules<Rules = typeof ruleTypes> = {
    [K in keyof Rules as K extends string ? `@typescript-eslint/${K}` : never]: Rules[K] extends { defaultOptions: infer Options extends any[]; } ? Linter.RuleEntry<Options> : never;
};
const TSLintRules: Partial<ExtractRules> = {
    "@typescript-eslint/no-use-before-define": ["error", {
        ignoreTypeReferences: true,
        functions: false
    }],
    "@typescript-eslint/require-await": "error",
    "@typescript-eslint/default-param-last": "error",
};
// const styleRules: RuleOptions = {
//     "@stylistic/array-bracket-newline": []
// }
export default TSEslint.config(
    { ignores: ["dist", "src/webview"] },
    {
        files: ["src/**/*.{tsx,ts,mts,mjs,js,jsx}", "eslint.config.mjs"],
        plugins: {
            "@stylistic": stylistic,
            "@typescript-eslint": TSEslint.plugin,
            "simple-import-sort": simpleImportSort,
            "unused-imports": unusedImports
        },
        languageOptions: {
            parser: TSEslint.parser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        },
        rules: {

            ...ESLintRules,
            ...TSLintRules,
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
