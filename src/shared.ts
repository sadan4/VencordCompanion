import { window } from "vscode";

export const outputChannel = window.createOutputChannel("Vencord Companion");

export interface StringNode {
    type: "string";
    value: string;
}

export interface RegexNode {
    type: "regex";
    value: {
        pattern: string;
        flags: string;
    };
}

export interface FunctionNode {
    type: "function";
    value: string;
}

export interface ExtractSendData {
    extractType: string
    idOrSearch: string | number,
}
export interface ExtraceRecieveData {
    moduleNumber: number,
    type: string,
    data: string,
    find?: boolean
}
export interface PatchData {
    findType: FindType;
    find: string | null;
    replacement: {
        match: StringNode | RegexNode | null;
        replace: StringNode | FunctionNode;
    }[];
}

export interface FindData {
    type: string;
    args: Array<StringNode | FunctionNode>;
}
export enum FindType {
    STRING,
    REGEX
}

