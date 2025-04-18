
// FIXME: rewrite to use module cache

export class WebpackAstParser {


    public async generateReferences(position: Position): References {
        // if (!this.moduleId)
        //     throw new Error("Could not find module id of module to search for references of");

        // if (!ModuleDepManager.hasModDeps()) {
        //     await ModuleDepManager.initModDeps({ fromDisk: true });
        // }

        // const moduleExports = this.getExportMap();
        // const where = await this.getModulesThatRequireThisModule();
        // const locs: Location[] = [];

        // const exportedNames = Object.entries(moduleExports)
        //     .filter(([, v]) => Array.isArray(v) && v.some((x) => {
        //         if (!x)
        //             return;
        //         return x.contains(position);
        //     }));


        // TODO: support jumping from object literals
        for (const [exportedName] of []) {
            // const seen: Record<string, Set<String>> = {};

            // the module id that is being searched for uses
            // the ID of the module that exportName will be imported from
            // the exported name to search
            // type ElementType = [
            //     moduleId: string,
            //     importedId: string,
            //     exportName: string | symbol,
            // ];

            const left: ElementType[] = where?.sync.map((x) => [x, this.moduleId!, exportedName] as const) ?? [];
            // let cur: ElementType | undefined;

            // while ((cur = left.pop())) {
            //     const [modId, importedId, exportedName] = cur;
            //     const modText = await ModuleCache.getModuleFromNum(modId);

            //     if (seen[importedId]?.has(modId)) {
            //         continue;
            //     }
            //     (seen[importedId] ||= new Set()).add(modId);
            //     if (!modText)
            //         continue;

            //     const parser = new WebpackAstParser(modText);
            //     const uses = parser.getUsesOfImport(importedId, exportedName);
            //     const exportedAs = parser.doesReExport(importedId, exportedName);

            //     if (exportedAs) {
            //         const where = await parser.getModulesThatRequireThisModule();

            //         left.push(...where?.sync.map((x) => [x, parser.moduleId!, exportedAs] as ElementType) ?? []);
            //     }

            //     locs.push(...uses.map((x) => new Location(ModuleCache.getModuleURI(modId), x)));
            // }
        }
        // return locs;
    }

}
