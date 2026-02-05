import {
    addSyntheticLeadingComment,
    addSyntheticTrailingComment,
    type BlockLike,
    type ClassDeclaration,
    type ClassElement,
    createPrinter,
    type ExportKeyword,
    type Expression,
    factory,
    type GetAccessorDeclaration,
    type Identifier,
    type ImportDeclaration,
    isSourceFile,
    type JSDoc,
    type JSDocContainer,
    type MethodDeclaration,
    type Node,
    NodeFlags,
    type PublicKeyword,
    type SetAccessorDeclaration,
    type SourceFile,
    type Statement,
    SyntaxKind,
    type TypeNode,
    type VariableStatement,
} from "typescript";

import type { ConfEntry } from "./index.mjs";

type ConfType = [withUndefined: TypeNode, withoutUndefined: TypeNode];

const enum SetterType {
    METHOD,
    ACCESSOR,
}

const enum CommentPosition {
    LEADING,
    TRAILING,
}

const commentPositionFunc = Object.freeze({
    [CommentPosition.LEADING]: addSyntheticLeadingComment,
    [CommentPosition.TRAILING]: addSyntheticTrailingComment,
} as const);

type EslintRuleToggle = [ruleName: string, reason?: string];

export class Generator {
    private classElements: ClassElement[] = [];
    private extensionId: string;
    private usedImports: Map<string, Set<string>> = new Map();

    constructor(extensionId: string) {
        this.extensionId = extensionId;
    }

    private createExportToken(): ExportKeyword {
        return factory.createToken(SyntaxKind.ExportKeyword);
    }

    private createPublicToken(): PublicKeyword {
        return factory.createToken(SyntaxKind.PublicKeyword);
    }

    private eofToken() {
        return factory.createToken(SyntaxKind.EndOfFileToken);
    }

    private createQuestionToken() {
        return factory.createToken(SyntaxKind.QuestionToken);
    }

    /**
     * import {@link exportName} from {@link fromModule}
     */
    private i(exportName: string, fromModule: string): Identifier {
        if (!this.usedImports.has(fromModule)) {
            this.usedImports.set(fromModule, new Set([exportName]));
        } else {
            this.usedImports.get(fromModule)!.add(exportName);
        }

        return factory.createIdentifier(exportName);
    }

    private createImports(): ImportDeclaration[] {
        /* eslint-disable @stylistic/max-len */
        return [...this.usedImports.entries()]
            .map(([module, imports]) => {
                return factory.createImportDeclaration(
                    undefined,
                    factory.createImportClause(
                        false,
                        undefined,
                        factory.createNamedImports([...imports].map((exportName) => {
                            return factory.createImportSpecifier(false, undefined, factory.createIdentifier(exportName));
                        })),
                    ),
                    factory.createStringLiteral(module),
                    undefined,
                );
            });
        /* eslint-enable @stylistic/max-len */
    }

    private createRootClass(): ClassDeclaration {
        const c = factory.createClassDeclaration(
            [this.createExportToken()],
            "_Settings",
            undefined,
            undefined,
            this.classElements,
        );

        return c;
    }

    private makeExport(): VariableStatement {
        return factory.createVariableStatement(
            [this.createExportToken()],
            factory.createVariableDeclarationList(
                [
                    factory.createVariableDeclaration(
                        "Settings",
                        undefined,
                        undefined,
                        factory.createNewExpression(
                            factory.createIdentifier("_Settings"),
                            undefined,
                            [],
                        ),
                    ),
                ],
                NodeFlags.Const,
            ),
        );
    }

    private createBooleanType(): TypeNode {
        return factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword);
    }

    private createNumberType(): TypeNode {
        return factory.createKeywordTypeNode(SyntaxKind.NumberKeyword);
    }

    private createVoidType(): TypeNode {
        return factory.createKeywordTypeNode(SyntaxKind.VoidKeyword);
    }

    private createNullType(): TypeNode {
        return factory.createLiteralTypeNode(factory.createNull());
    }

    private createUndefinedType(): TypeNode {
        return factory.createKeywordTypeNode(SyntaxKind.UndefinedKeyword);
    }

    private createComment(_lines: string[] | string): JSDoc {
        const lines = (Array.isArray(_lines) ? _lines : [_lines]).join("\n * ");

        return factory.createJSDocComment(lines);
    }

    private getDefaultValue({ settingType, default: defaultValue }: ConfEntry): [Expression] | [] {
        if (defaultValue == null) {
            return [];
        }
        switch (settingType) {
            case "boolean":
                return [defaultValue ? factory.createTrue() : factory.createFalse()];
            case "integer":
                return [factory.createNumericLiteral(defaultValue)];
            default:
                throw new Error(`Unsupported setting type: ${settingType}`);
        }
    }

    private generateSettingGetter(entry: ConfEntry, settingType: TypeNode): GetAccessorDeclaration {
        const ret = factory.createGetAccessorDeclaration(
            [this.createPublicToken()],
            entry.key,
            [],
            settingType,
            factory.createBlock(
                [
                    factory.createReturnStatement(factory.createCallExpression(
                        factory.createPropertyAccessExpression(
                            factory.createCallExpression(
                                factory.createPropertyAccessExpression(
                                    this.i("workspace", "vscode"),
                                    "getConfiguration",
                                ),
                                undefined,
                                [factory.createStringLiteral(this.extensionId)],
                            ),
                            "get",
                        ),
                        [settingType],
                        [factory.createStringLiteral(entry.key), ...this.getDefaultValue(entry)],
                    )),
                ],
                true,
            ),
        );

        this.i("WorkspaceConfiguration", "vscode");

        Generator.addJSDocComment(ret, [
            entry.description ?? "NO DESCRIPTION PROVIDED",
            `@default ${entry.default ?? "undefined"}`,
            "@see {@link workspace.getConfiguration}",
            "@see {@link WorkspaceConfiguration.get}",
        ]);

        return ret;
    }

    private generateSettingSetter(
        entry: ConfEntry,
        settingType: TypeNode,
        setterType: SetterType,
    ): SetAccessorDeclaration | MethodDeclaration {
        const isAccessor = setterType === SetterType.ACCESSOR;
        const name = isAccessor ? entry.key : `set${entry.key[0].toUpperCase()}${entry.key.slice(1)}`;

        const valueParameter = factory.createParameterDeclaration(
            undefined,
            undefined,
            "value",
            undefined,
            settingType,
            undefined,
        );

        const setExprImpl = factory.createCallExpression(
            factory.createPropertyAccessExpression(
                factory.createCallExpression(
                    factory.createPropertyAccessExpression(
                        this.i("workspace", "vscode"),
                        "getConfiguration",
                    ),
                    undefined,
                    [factory.createStringLiteral(this.extensionId)],
                ),
                "update",
            ),
            undefined,
            [
                factory.createStringLiteral(entry.key),
                factory.createIdentifier("value"),
                isAccessor || factory.createIdentifier("configurationTarget"),
                isAccessor || factory.createIdentifier("overrideInLanguage"),
            ].filter((e) => typeof e !== "boolean"),
        );

        const body = factory.createBlock(
            [isAccessor ? factory.createExpressionStatement(setExprImpl) : factory.createReturnStatement(setExprImpl)],
            true,
        );

        let ret: SetAccessorDeclaration | MethodDeclaration;

        if (isAccessor) {
            ret = factory.createSetAccessorDeclaration(
                [this.createPublicToken()],
                name,
                [valueParameter],
                body,
            );
        } else {
            ret = factory.createMethodDeclaration(
                [this.createPublicToken()],
                undefined,
                name,
                undefined,
                undefined,
                [
                    valueParameter,
                    factory.createParameterDeclaration(
                        undefined,
                        undefined,
                        "configurationTarget",
                        this.createQuestionToken(),
                        factory.createUnionTypeNode([
                            this.createBooleanType(),
                            factory.createTypeReferenceNode(this.i("ConfigurationTarget", "vscode"), undefined),
                            this.createNullType(),
                        ]),
                        undefined,
                    ),
                    factory.createParameterDeclaration(
                        undefined,
                        undefined,
                        "overrideInLanguage",
                        this.createQuestionToken(),
                        this.createBooleanType(),
                        undefined,
                    ),
                ],
                factory.createTypeReferenceNode("Thenable", [this.createVoidType()]),
                body,
            );
        }

        this.i("WorkspaceConfiguration", "vscode");

        Generator.addJSDocComment(ret, [
            entry.description ?? "NO DESCRIPTION PROVIDED",
            "",
            `Sets the value of "${entry.key}"`,
            "",
            "@param value The new value to set",
            "@see {@link workspace.getConfiguration}",
            "@see {@link WorkspaceConfiguration.update}",
        ]);

        return ret;
    }

    private typeForEntry(entry: ConfEntry): ConfType {
        switch (entry.settingType) {
            case "boolean":
                return [
                    factory.createUnionTypeNode([
                        this.createBooleanType(),
                        this.createUndefinedType(),
                    ]),
                    this.createBooleanType(),
                ];
            case "integer":
                return [
                    factory.createUnionTypeNode([
                        this.createNumberType(),
                        this.createUndefinedType(),
                    ]),
                    this.createNumberType(),
                ];
            default:
                throw new Error(`Unsupported setting type: ${entry.settingType}`);
        }
    }

    public generateForConfigEntry(entry: ConfEntry) {
        const confType = this.typeForEntry(entry);
        const hasDefault = entry.default != null;
        const getAccessor = this.generateSettingGetter(entry, confType[+hasDefault]);
        const setAccessor = this.generateSettingSetter(entry, confType[1], SetterType.ACCESSOR);
        const setFunction = this.generateSettingSetter(entry, confType[1], SetterType.METHOD);

        this.classElements.push(getAccessor, setAccessor, setFunction);
    }

    /**
     * some nodes (like {@link SourceFile}) do not support adding comments
     *
     * for those nodes, we add the leading/trailing comments
     * to their first/last child respectively
     */
    private static resolveCommentNode(node: Node, position: CommentPosition): Node {
        if (isSourceFile(node)) {
            if (!node.statements.length) {
                throw new Error("unimplemented: add comments to syntax files with no statements");
            }
            if (position === CommentPosition.LEADING) {
                return node.statements[0];
            }
            return node.statements[node.statements.length - 1];
        }
        return node;
    }

    private static addSingleLineComment(
        node: Node,
        comment: string,
        position = CommentPosition.LEADING,
    ) {
        commentPositionFunc[position](
            Generator.resolveCommentNode(node, position),
            SyntaxKind.SingleLineCommentTrivia,
            ` ${comment}`,
        );
    }

    private static addSingleLineBlockComment(
        node: Node,
        comment: string,
        spaced = true,
        position = CommentPosition.LEADING,
    ) {
        commentPositionFunc[position](
            Generator.resolveCommentNode(node, position),
            SyntaxKind.MultiLineCommentTrivia,
            spaced ? ` ${comment} ` : comment,
            true,
        );
    }

    private static addJSDocComment(
        node: JSDocContainer,
        lines: string[] | string,
    ) {
        lines = Array.isArray(lines) ? lines : [lines];
        lines = lines.map((line) => ` * ${line}`);
        lines = lines.join("\n");
        lines = `*\n${lines}\n `;
        addSyntheticLeadingComment(node, SyntaxKind.MultiLineCommentTrivia, lines, true);
    }

    private static getEslintCommentString(mode: "enable" | "disable", rule?: string, reason?: string): string {
        let str = `eslint-${mode}`;

        if (rule) {
            str += ` ${rule}`;
        }

        if (reason) {
            str += ` -- ${reason}`;
        }
        return str;
    }

    private static disableEslintForBlock(node: BlockLike, rulesOrReason?: EslintRuleToggle[] | string) {
        if (rulesOrReason == null || typeof rulesOrReason === "string") {
            Generator.addSingleLineBlockComment(
                node,
                Generator.getEslintCommentString(
                    "disable",
                    undefined,
                    rulesOrReason,
                ),
                true,
            );
            Generator.addSingleLineBlockComment(
                node,
                Generator.getEslintCommentString(
                    "enable",
                    undefined,
                    rulesOrReason,
                ),
                true,
                CommentPosition.TRAILING,
            );
        } else {
            for (const [rule, reason] of rulesOrReason) {
                Generator.addSingleLineBlockComment(
                    node,
                    Generator.getEslintCommentString(
                        "disable",
                        rule,
                        reason,
                    ),
                    true,
                    CommentPosition.LEADING,
                );
                Generator.addSingleLineBlockComment(
                    node,
                    Generator.getEslintCommentString(
                        "enable",
                        rule,
                        reason,
                    ),
                    true,
                    CommentPosition.TRAILING,
                );
            }
        }
    }


    private static addHeaderComments(node: SourceFile) {
        Generator.disableEslintForBlock(
            node,
            [
                ["@stylistic/lines-between-class-members"],
                ["@stylistic/max-len"],
                ["@stylistic/newline-per-chained-call"],
                ["simple-import-sort/imports"],
                ["unused-imports/no-unused-imports", "we import some types for reference from jsdoc"],
            ],
        );

        const banner = [
            "This file is generated by scripts/generateSettings.mts",
            "Do not edit this file directly",
        ];

        const longestLen = Math.max(...banner.map(({ length }) => length));
        const border = "*".repeat(longestLen);

        banner.push(border);
        banner.unshift(border);

        for (const line of banner) {
            Generator.addSingleLineComment(
                node,
                line,
            );
        }
    }

    public toString(): string {
        const stmts: Statement[] = [];
        const rootClass = this.createRootClass();

        stmts.push(...this.createImports());
        stmts.push(rootClass);
        stmts.push(this.makeExport());

        const sourceFile = factory.createSourceFile(stmts, this.eofToken(), 0);

        Generator.addHeaderComments(sourceFile);

        return createPrinter()
            .printFile(sourceFile);
    }
}
