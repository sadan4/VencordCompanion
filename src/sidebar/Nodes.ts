import { TreeItem, TreeItemCollapsibleState } from "vscode";

import RuntimeCommand from "./RuntimeCommand";

export class Item extends TreeItem {
    parrent: TNode | null = null;
}


export class Button extends Item {
    constructor(
        label: string,
        private readonly action: (...args: any[]) => any
    ) {
        super(label, TreeItemCollapsibleState.None);
    }
    makeCommand(id: string) {
        this.command = new RuntimeCommand(
            `${id}${this.label}`,
            this.action
        ).asCommand();
    }
}
export class Text extends Item {
    constructor(text: string) {
        super(text, TreeItemCollapsibleState.None);
    }
}

export class Section extends Item {
    public readonly children: TNode[];
    constructor(
        label: string,
        children: TNode[],
        collapseableState = TreeItemCollapsibleState.Expanded
    ) {
        super(label, collapseableState);
        this.children = children.map(e => {
            if (e instanceof Item) e.parrent = this;
            return e;
        });
    }
}

export interface IDynamicNode {
    getNode(): Promise<Item>;
}
export type TNode = Item | IDynamicNode;

