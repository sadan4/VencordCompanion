import { Item } from "@sidebar/Nodes";

void 0;

export interface IDynamicNode {
    getNode(): Promise<Item>;
}

export type TNode = Item | IDynamicNode;
