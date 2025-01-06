import { window } from "vscode";

export const outputChannel = window.createOutputChannel("Vencord Companion");
// FIXME: properly type this, use keyed types
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
