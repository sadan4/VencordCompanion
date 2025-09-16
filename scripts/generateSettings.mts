import { readFile, writeFile } from "fs/promises";
import { join } from "path";

import {
    type Block,
    type ClassDeclaration,
    type ClassElement,
    createPrinter,
    type ExportKeyword,
    type Expression,
    factory,
    type ImportDeclaration,
    type JSDoc,
    type MethodDeclaration,
    NodeFlags,
    type PublicKeyword,
    type Statement,
    SyntaxKind,
    type TypeNode,
    type VariableStatement,
} from "typescript";

const packageJson = JSON.parse(await readFile("package.json", "utf-8"));
const EXT_ID = packageJson.name as string;
const __dirname = import.meta.dirname;

if (!EXT_ID) {
    throw new Error("Could not find extension ID in package.json");
}

const configuration = packageJson?.contributes?.configuration.properties as Record<string, any>;
const SUPPORTED_TYPES = Object.freeze(["boolean"] as const);

type SupportedType = (typeof SUPPORTED_TYPES)[number];

interface ConfEntry {
    /**
     * Without the extension ID
     */
    key: string;
    default?: any;
    settingType: SupportedType;
}

const EXT_PREFIX = `${EXT_ID}.`;
const entries: ConfEntry[] = [];

for (const [_key, val] of Object.entries(configuration)) {
    if (!_key.startsWith(EXT_PREFIX)) {
        console.warn(`Configuration key "${_key}" does not start with extension ID "${EXT_PREFIX}". Skipping.`);
        continue;
    }

    const key = _key.slice(EXT_PREFIX.length);

    if (key.indexOf(".") !== -1) {
        console.warn(`nested configurations are not supported at the moment, skipping "${_key}"`);
        continue;
    }

    const settingType = val.type as SupportedType | undefined;

    if (!settingType) {
        console.warn(`Configuration key "${_key}" does not have a type. Skipping.`);
        continue;
    }

    if (!SUPPORTED_TYPES.includes(settingType)) {
        console.warn(`Configuration key "${_key}" has unsupported type "${settingType}". Skipping.`);
        console.info("Supported types are:", SUPPORTED_TYPES.join(", "));
        console.info("You can add support for more types by editing scripts/generateSettings.mts");
        continue;
    }
    entries.push({
        key,
        settingType,
        default: val.default,
    });
}

type ConfType = [withUndefined: TypeNode, withoutUndefined: TypeNode];

class Generator {
    private classElements: ClassElement[] = [];

    constructor() {
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

    private static IMPORTS = {
        vscode: ["workspace", "ConfigurationTarget"],
    };

    private createImports(): ImportDeclaration[] {
        /* eslint-disable @stylistic/max-len */
        return Object.entries(Generator.IMPORTS)
            .map(([module, imports]) => {
                return factory.createImportDeclaration(
                    undefined,
                    factory.createImportClause(
                        false,
                        undefined,
                        factory.createNamedImports(imports.map((exportName) => {
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

    private makeHeader(): string {
        return `/* eslint-disable @stylistic/lines-between-class-members */
/* eslint-disable @stylistic/max-len */
/* eslint-disable @stylistic/newline-per-chained-call */
/* eslint-disable simple-import-sort/imports */
// ******************************************************
// This file is generated by scripts/generateSettings.mts
// Do not edit this file directly
// ******************************************************`;
    }

    private createBooleanType(): TypeNode {
        return factory.createKeywordTypeNode(SyntaxKind.BooleanKeyword);
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
            default:
                throw new Error(`Unsupported setting type: ${settingType}`);
        }
    }

    private generateSettingGetter(entry: ConfEntry, settingType: TypeNode): Block {
        return factory.createBlock(
            [
                factory.createReturnStatement(factory.createCallExpression(
                    factory.createPropertyAccessExpression(
                        factory.createCallExpression(
                            factory.createPropertyAccessExpression(
                                factory.createIdentifier("workspace"),
                                "getConfiguration",
                            ),
                            undefined,
                            [factory.createStringLiteral(EXT_ID)],
                        ),
                        "get",
                    ),
                    [settingType],
                    [factory.createStringLiteral(entry.key), ...this.getDefaultValue(entry)],
                )),
            ],
            true,
        );
    }

    private generateSettingSetter(entry: ConfEntry, settingType: TypeNode): MethodDeclaration {
        return factory.createMethodDeclaration(
            [this.createPublicToken()],
            undefined,
            `set${entry.key[0].toUpperCase()}${entry.key.slice(1)}`,
            undefined,
            undefined,
            [
                factory.createParameterDeclaration(
                    undefined,
                    undefined,
                    "value",
                    undefined,
                    settingType,
                    undefined,
                ),
                factory.createParameterDeclaration(
                    undefined,
                    undefined,
                    "configurationTarget",
                    this.createQuestionToken(),
                    factory.createUnionTypeNode([
                        this.createBooleanType(),
                        factory.createTypeReferenceNode("ConfigurationTarget", undefined),
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
            factory.createBlock(
                [
                    factory.createReturnStatement(factory.createCallExpression(
                        factory.createPropertyAccessExpression(
                            factory.createCallExpression(
                                factory.createPropertyAccessExpression(
                                    factory.createIdentifier("workspace"),
                                    "getConfiguration",
                                ),
                                undefined,
                                [factory.createStringLiteral(EXT_ID)],
                            ),
                            "update",
                        ),
                        undefined,
                        [
                            factory.createStringLiteral(entry.key),
                            factory.createIdentifier("value"),
                            factory.createIdentifier("configurationTarget"),
                            factory.createIdentifier("overrideInLanguage"),
                        ],
                    )),
                ],
                true,
            ),
        );
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
            default:
                throw new Error(`Unsupported setting type: ${entry.settingType}`);
        }
    }

    private generateBoolean(entry: ConfEntry) {
        const confType = this.typeForEntry(entry);
        const hasDefault = entry.default != null;

        const getAccessor = factory.createGetAccessorDeclaration(
            [this.createPublicToken()],
            entry.key,
            [],
            confType[+hasDefault],
            this.generateSettingGetter(entry, confType[+hasDefault]),
        );

        const setFunction = this.generateSettingSetter(entry, confType[1]);

        this.classElements.push(getAccessor, setFunction);
    }

    public generateForConfigEntry(entry: ConfEntry) {
        switch (entry.settingType) {
            case "boolean":
                this.generateBoolean(entry);
                break;
            default:
                throw new Error(`Unsupported setting type: ${entry.settingType}`);
        }
    }

    public toString(): string {
        const stmts: Statement[] = [];
        const rootClass = this.createRootClass();

        stmts.push(...this.createImports());
        stmts.push(rootClass);
        stmts.push(this.makeExport());

        const sourceFile = factory.createSourceFile(stmts, this.eofToken(), 0);
        const printer = createPrinter();

        return `${this.makeHeader()}\n${printer.printFile(sourceFile)}`;
    }
}

const gen = new Generator();

for (const entry of entries) {
    gen.generateForConfigEntry(entry);
}

const generatedFile = gen.toString();

await writeFile(join(__dirname, "..", "src", "settings.ts"), generatedFile, "utf-8");

