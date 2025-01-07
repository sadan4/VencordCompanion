import { hasConnectons, onConnect } from "@server/webSocketServer";
import { ModuleCache, ModuleDepManager } from "modules/cache";
import { nanoid } from "nanoid";
import {
    EventEmitter,
    ProviderResult,
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
} from "vscode";

import RuntimeCommand from "./RuntimeCommand";
type Promisable<T> = T | Promise<T>;
export class Item extends TreeItem {
    parrent: TNode | null = null;
}

class Button extends Item {
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
interface IDynamicNode {
    getNode(): Promise<Item>;
}
class Text extends Item {
    constructor(text: string) {
        super(text, TreeItemCollapsibleState.None);
    }
}
class Section extends Item {
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
type TNode = Item | IDynamicNode;
export default class treeDataProvider implements TreeDataProvider<TNode> {
    // fucking cursed
    private DynamicNode = (() => {
        const provider = this;
        return class DynamicNode implements IDynamicNode {
            lastNode: Item | null = null;
            constructor(
                private readonly _getNode: (
                    reRender: () => void,
                    lastNode: Item | null
                ) => Promisable<Item>
            ) { }
            async getNode(): Promise<Item> {
                return (this.lastNode = await this._getNode(
                    () => provider._onDidChangeTreeData.fire(this),
                    this.lastNode
                ));
            }
        };
    })();
    private id = nanoid();

    private async makeModuleSettings(): Promise<TNode> {
        return new this.DynamicNode(
            async r => {
                onConnect(r);
                return new Section("Module Settings", [
                    (await ModuleCache.hasCache())
                        ? new Button("Purge Cache", () => ModuleCache.clearCache().then(r))
                        : new this.DynamicNode(r =>
                            hasConnectons()
                                ? new Button("Download Modules", () =>
                                    ModuleCache.downloadModules().then(() => this._onDidChangeTreeData.fire())
                                )
                                : new Button("No Connections", r)
                        ),
                ]);
            }
        );
    }
    private makeDepSettings(): Section {
        return new Section("Dependency Cache Settings", [
            new this.DynamicNode(async reRender =>
                await ModuleCache.hasCache() ?
                    ModuleDepManager.hasModDeps()
                        ? new Text("Module Dependencies Loaded")
                        : new Button("Load Module Dependencies", async () => {
                            ModuleDepManager.initModDeps({ fromDisk: true }).then(() =>
                                reRender()
                            );
                        }) : new Text("No Cache Found, make sure to download modules first")
            ),
        ]);
    }
    private async defaultChildren(): Promise<TNode[]> {
        return Promise.all([
            this.makeModuleSettings(),
            this.makeDepSettings(),
        ]);
    }
    async getTreeItem(element: TNode): Promise<TreeItem> {
        if (element instanceof Button) {
            element.makeCommand(this.id);
        } else if (element instanceof this.DynamicNode) {
            return this.getTreeItem(await Promise.resolve(element.getNode()));
        }
        return element as Item;
    }
    async getChildren(element?: TNode): Promise<TNode[] | undefined> {
        if (!element) {
            return await this.defaultChildren();
        } else if (element instanceof Section) {
            return element.children;
        } else if (element instanceof this.DynamicNode) {
            return this.getChildren(await Promise.resolve(element.getNode()));
        }
    }
    private _onDidChangeTreeData: EventEmitter<TNode | void | null | undefined> =
        new EventEmitter<TNode | null | void | undefined>();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
}
