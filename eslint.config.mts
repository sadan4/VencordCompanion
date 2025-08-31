import stylistic, { RuleOptions } from "@stylistic/eslint-plugin";

import { Linter } from "eslint";
import { ESLintRules as IESLintRules } from "eslint/rules";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import TSEslint from "typescript-eslint";

// cursed
type ExtractRules<Rules = typeof import("./node_modules/@typescript-eslint/eslint-plugin/dist/rules")> = {
    [K in keyof Rules as K extends string ? `@typescript-eslint/${K}` : never]: Rules[K] extends { defaultOptions: infer Options extends any[]; } ? Linter.RuleEntry<Options> : never;
};

type _RuleOptions = {
    [K in keyof RuleOptions]: Linter.RuleEntry<RuleOptions[K]>;
};

type _statmentType = RuleOptions["@stylistic/padding-line-between-statements"][number]["next" | "prev"];

type PaddingSchema = {
    blankLine: "any" | "always" | "never";
    prev: _statmentType | _statmentType[] | readonly _statmentType[];
    next: _statmentType | _statmentType[] | readonly _statmentType[];
}[];

type ElementType<T> = T extends (infer U)[] ? U : never;

type PaddingElement = ElementType<PaddingSchema>;

const ESLintRules: IESLintRules = {
    "array-callback-return": [
        "error",
        {
            allowImplicit: true,
        },
    ],
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
    "no-constant-condition": [
        "error",
        {
            // @ts-expect-error Why is this erroring
            checkLoops: "allExceptWhileTrue",
        },
    ],
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
    "no-fallthrough": [
        "error",
        {
            allowEmptyCase: true,
            reportUnusedFallthroughComment: true,
        },
    ],
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
    "use-isnan": [
        "error",
        {
            enforceForIndexOf: true,
            enforceForSwitchCase: true,
        },
    ],
    "valid-typeof": "error",
    // suggestions
    "accessor-pairs": [
        "error",
        {
            enforceForClassMembers: true,
        },
    ],
    "block-scoped-var": "error",
    "default-case": "error",
    "default-case-last": "error",
    "dot-notation": "error",
    eqeqeq: ["error", "always", { null: "ignore" }],
    "grouped-accessor-pairs": ["error", "getBeforeSet"],
    "logical-assignment-operators": [
        "error",
        "always",
        {
            enforceForIfStatements: true,
        },
    ],
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
    "prefer-const": [
        "error",
        {
            destructuring: "all",
        },
    ],
    "prefer-exponentiation-operator": "error",
    "prefer-numeric-literals": "error",
    "prefer-object-has-own": "error",
    "prefer-object-spread": "error",
    "prefer-promise-reject-errors": "error",
    "prefer-regex-literals": [
        "error",
        {
            disallowRedundantWrapping: true,
        },
    ],
    "prefer-rest-params": "error",
    "prefer-spread": "error",
    "prefer-template": "error",
    "require-yield": "error",
    yoda: ["error", "never"],
};

const TSLintRules: Partial<ExtractRules> = {
    "@typescript-eslint/no-use-before-define": [
        "error",
        {
            ignoreTypeReferences: true,
            functions: false,
        },
    ],
    "@typescript-eslint/require-await": "error",
    "@typescript-eslint/default-param-last": "error",
    "@typescript-eslint/prefer-destructuring": [
        "error",
        {
            VariableDeclarator: {
                object: true,
                array: true,
            },
            AssignmentExpression: {
                object: false,
                array: false,
            },
        },
        {
            enforceForRenamedProperties: false,
        },
    ],
    "@typescript-eslint/return-await": ["error", "error-handling-correctness-only"],
};

const styleRules: Partial<_RuleOptions> = {
    "@stylistic/array-bracket-newline": [
        "error",
        {
            multiline: true,
        },
    ],
    "@stylistic/array-bracket-spacing": ["error", "never"],
    "@stylistic/array-element-newline": [
        "error",
        {
            consistent: true,
            multiline: true,
        },
    ],
    "@stylistic/arrow-parens": ["error", "always"],
    "@stylistic/arrow-spacing": [
        "error",
        {
            before: true,
            after: true,
        },
    ],
    "@stylistic/block-spacing": ["error", "always"],
    "@stylistic/brace-style": ["error", "1tbs"],
    "@stylistic/comma-dangle": ["error", "always-multiline"],
    "@stylistic/comma-spacing": ["error"],
    "@stylistic/comma-style": ["error", "last"],
    "@stylistic/computed-property-spacing": ["error", "never"],
    "@stylistic/curly-newline": [
        "error",
        {
            consistent: true,
        },
    ],
    "@stylistic/dot-location": ["error", "property"],
    "@stylistic/eol-last": ["error", "always"],
    "@stylistic/function-call-spacing": ["error", "never"],
    "@stylistic/function-call-argument-newline": ["error", "consistent"],
    "@stylistic/function-paren-newline": ["error", "multiline"],
    "@stylistic/generator-star-spacing": [
        "error",
        {
            before: true,
            after: false,
        },
    ],
    "@stylistic/implicit-arrow-linebreak": ["error", "beside"],
    "@stylistic/indent": [
        "error",
        4,
        {
            // ton of overrides available
            SwitchCase: 1,
        },
    ],
    "@stylistic/indent-binary-ops": ["error", 2],
    "@stylistic/key-spacing": [
        "error",
        {
            beforeColon: false,
            afterColon: true,
            mode: "strict",
        },
    ],
    "@stylistic/keyword-spacing": [
        "error",
        {
            before: true,
            after: true,
        },
    ],
    "@stylistic/line-comment-position": ["off"],
    // done by git autocrlf
    "@stylistic/linebreak-style": ["off"],
    "@stylistic/lines-around-comment": ["off"],
    "@stylistic/lines-between-class-members": [
        "error",
        {
            enforce: [
                {
                    blankLine: "always",
                    prev: "*",
                    next: "*",
                },
                {
                    blankLine: "always",
                    prev: "*",
                    next: "method",
                },
                {
                    blankLine: "always",
                    prev: "method",
                    next: "*",
                },
                {
                    blankLine: "always",
                    prev: "field",
                    next: "*",
                },
                {
                    blankLine: "always",
                    prev: "*",
                    next: "field",
                },
                {
                    blankLine: "never",
                    prev: "field",
                    next: "field",
                },
            ],
        },
        {
            exceptAfterOverload: true,
        },
    ],
    "@stylistic/max-len": [
        "error",
        {
            code: 120,
            ignoreComments: true,
            ignoreUrls: true,
            ignoreStrings: true,
            ignoreTemplateLiterals: true,
            ignoreRegExpLiterals: true,
        },
    ],
    "@stylistic/max-statements-per-line": ["off"],
    "@stylistic/member-delimiter-style": [
        "error",
        {
            multiline: {
                delimiter: "semi",
                requireLast: true,
            },
            singleline: {
                delimiter: "semi",
                requireLast: true,
            },
            multilineDetection: "brackets",
        },
    ],
    // messes with editor comment hotkeys
    "@stylistic/multiline-comment-style": ["off"],
    "@stylistic/multiline-ternary": ["error", "always-multiline"],
    "@stylistic/new-parens": ["error", "always"],
    "@stylistic/newline-per-chained-call": [
        "error",
        {
            ignoreChainWithDepth: 1,
        },
    ],
    "@stylistic/no-confusing-arrow": [
        "error",
        {
            allowParens: true,
        },
    ],
    "@stylistic/no-extra-parens": [
        "error",
        "all",
        {
            // things like (foo && bar) || baz || qux
            nestedBinaryExpressions: false,
            enforceForArrowConditionals: false,
            returnAssign: false,
            conditionalAssign: false,
        },
    ],
    "@stylistic/no-extra-semi": ["error"],
    "@stylistic/no-floating-decimal": ["error"],
    "@stylistic/no-mixed-operators": ["error"],
    "@stylistic/no-mixed-spaces-and-tabs": ["error"],
    "@stylistic/no-multi-spaces": ["error"],
    "@stylistic/no-multiple-empty-lines": [
        "error",
        {
            max: 2,
            maxBOF: 0,
            maxEOF: 1,
        },
    ],
    "@stylistic/no-tabs": ["error"],
    "@stylistic/no-trailing-spaces": [
        "error",
        {
            // jsdoc 2 spaces for a linebreak
            ignoreComments: true,
        },
    ],
    "@stylistic/no-whitespace-before-property": ["error"],
    "@stylistic/nonblock-statement-body-position": ["error", "below"],
    "@stylistic/object-curly-newline": [
        "error",
        {
            // destructring assingment
            ObjectPattern: {
                multiline: true,
                consistent: true,
            },
            ObjectExpression: {
                consistent: true,
                multiline: true,
                minProperties: 4,
            },
            ImportDeclaration: {
                multiline: true,
            },
            ExportDeclaration: "always",
        },
    ],
    "@stylistic/object-curly-spacing": ["error", "always"],
    "@stylistic/object-property-newline": [
        "error",
        {
            // FIXME: no way to limit total number of props before a linebreak is needed other than one
            allowAllPropertiesOnSameLine: false,
        },
    ],
    "@stylistic/one-var-declaration-per-line": ["error", "initializations"],
    "@stylistic/operator-linebreak": ["error", "before"],
    "@stylistic/padded-blocks": ["error", "never"],
    "@stylistic/padding-line-between-statements": [
        "error",
        ...((function (): PaddingSchema {
            const tsTypes = ["enum", "interface", "type"] as const;
            const varTypes = ["var", "let", "const"] as const;
            const singlelineVar = varTypes.map((x) => `singleline-${x}` as const);
            const multilineVar = varTypes.map((x) => `multiline-${x}` as const);

            function makeVariableDecPadding(): PaddingSchema {
                return [
                    // add a line before and after variable blocks of variables
                    withInverse({
                        blankLine: "always",
                        prev: "*",
                        next: varTypes,
                    }),
                    // no lines within groups of single line variable declarations
                    {
                        blankLine: "never",
                        prev: singlelineVar,
                        next: singlelineVar,
                    } as const,
                    // multiline variable declarations will always be padded with newlines
                    withInverse({
                        blankLine: "always",
                        prev: multilineVar,
                        next: "*",
                    }),
                ].flat(99);
            }

            function makeFunctionPadding(): PaddingSchema {
                return [
                    // overloads
                    {
                        blankLine: "always",
                        prev: "*",
                        next: "function-overload",
                    },
                    {
                        blankLine: "never",
                        prev: "function-overload",
                        next: ["function-overload", "function"],
                    },
                ];
            }

            function makeTypescriptPadding(): PaddingSchema {
                return withInverse({
                    blankLine: "always",
                    prev: "*",
                    next: tsTypes,
                });
            }
            // util
            function withInverse(rule: PaddingElement): [PaddingElement, PaddingElement] {
                const { prev, next } = rule;

                return [
                    rule,
                    {
                        blankLine: rule.blankLine,
                        prev: next,
                        next: prev,
                    },
                ];
            }

            return [
                makeVariableDecPadding(),
                makeFunctionPadding(),
                makeTypescriptPadding(),
            ].flat(99);
        })()
            .flat() as any /* doesnt include readonly arrays for some reason */),
    ],
    "@stylistic/quote-props": ["error", "as-needed"],
    "@stylistic/quotes": [
        "error",
        "double",
        {
            avoidEscape: true,
            allowTemplateLiterals: "avoidEscape",
        },
    ],
    "@stylistic/rest-spread-spacing": ["error", "never"],
    "@stylistic/semi": ["error", "always"],
    "@stylistic/semi-spacing": ["error"],
    "@stylistic/semi-style": ["error", "last"],
    "@stylistic/space-before-blocks": ["error", "always"],
    "@stylistic/space-before-function-paren": [
        "error",
        {
            anonymous: "always",
            named: "never",
            asyncArrow: "always",
        },
    ],
    "@stylistic/space-in-parens": ["error", "never"],
    "@stylistic/space-infix-ops": ["error"],
    "@stylistic/space-unary-ops": ["error"],
    "@stylistic/spaced-comment": ["error", "always"],
    "@stylistic/switch-colon-spacing": ["error"],
    "@stylistic/template-curly-spacing": ["error", "never"],
    "@stylistic/template-tag-spacing": ["error"],
    "@stylistic/type-annotation-spacing": [
        "error",
        {
            after: true,
            before: false,
            overrides: {
                arrow: {
                    after: true,
                    before: true,
                },
            },
        },
    ],
    "@stylistic/type-generic-spacing": ["error"],
    "@stylistic/type-named-tuple-spacing": ["error"],
    "@stylistic/wrap-regex": ["off"],
    "@stylistic/yield-star-spacing": ["error"],
};

const extensions = "{js,mjs,cjs,jsx,mjsx,cjsx,ts,mts,cts,tsx,mtsx,ctsx}";

export default TSEslint.config({ ignores: ["dist", "src/webview", "node_modules", "**/__test__/**", "packages/vencord-ast-parser/src/.vencord-source/**"] }, {
    files: [`src/**/*.${extensions}`, `eslint.config.${extensions}`, `packages/**/*.${extensions}`],
    plugins: {
        "@stylistic": stylistic,
        "@typescript-eslint": TSEslint.plugin,
        "simple-import-sort": simpleImportSort,
        "unused-imports": unusedImports,
    },
    languageOptions: {
        parser: TSEslint.parser,
        parserOptions: {
            projectService: true,
            tsconfigRootDir: import.meta.dirname,
        },
    },
    rules: {
        ...ESLintRules,
        ...TSLintRules,
        // Style Rules
        ...styleRules,
        "unused-imports/no-unused-imports": "error",
        "unused-imports/no-unused-vars": [
            "warn",
            {
                vars: "all",
                varsIgnorePattern: "^_",
                args: "after-used",
                argsIgnorePattern: "^_",
            },
        ],
        // Plugin Rules
        "simple-import-sort/imports": [
            "error",
            {
                groups: [
                    ["^@.+$"],
                    ["^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$", "^\\.\\.(?!/?$)", "^\\.\\./?$"],
                    ["^(assert|buffer|child_process|cluster|console|constants|crypto|dgram|dns|domain|events|fs|http|https|module|net|os|path|punycode|querystring|readline|repl|stream|string_decoder|sys|timers|tls|tty|url|util|vm|zlib|freelist|v8|process|async_hooks|http2|perf_hooks)(/.*|$)"],
                ],
            },
        ],
        "simple-import-sort/exports": "error",
    },
});
