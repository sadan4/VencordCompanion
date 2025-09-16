import { ExtensionContext } from "vscode";

export type PromiseProviderResult<T> = Promise<T | null | undefined>;

export interface Registerable {
    register(context: ExtensionContext): void;
}
