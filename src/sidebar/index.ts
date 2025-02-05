import { ModuleCache, ModuleDepManager } from "@modules/cache";
import { hasConnectons, onConnect } from "@server/index";
import { IDynamicNode, TNode } from "@type/sidebar";

import { Button, Item, Section, Text } from "./Nodes";

import { nanoid } from "nanoid";
import {
    EventEmitter,
    TreeDataProvider,
    TreeItem,
} from "vscode";

type Promisable<T> = T | Promise<T>;

export class treeDataProvider implements TreeDataProvider<TNode> {
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
                        ? new Button("Purge Cache", () => ModuleCache.clearCache().then(() => setTimeout(() => this._onDidChangeTreeData.fire())))
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
                await ModuleCache.hasCache() && !ModuleDepManager.hasModDeps() ?
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
    private _onDidChangeTreeData: EventEmitter<TNode | void | null> = new EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
}
