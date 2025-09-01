import { VencordAstParser } from "./VencordAstParser";

import { ChildProcess, exec } from "child_process";
import { Dirent, PathLike, readFileSync } from "fs";
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";

import { assert, describe, expect, it } from "vitest";

const __dirname = import.meta.dirname;
const VENCORD_DIR = join(__dirname, "__test__", ".vencord-source");
const VENCORD_REV = "8807564053c7b4cc05c763e2dc7171f5d61e39c7";

function parserFor(path: string): VencordAstParser {
    path = join(__dirname, "__test__", path);
    return new VencordAstParser(readFileSync(path, "utf-8"), path);
}

const IS_WINDOWS = process.platform === "win32";

describe("VencordAstParser", async function () {
    await ensureVencordDownloaded();

    // collect all plugin paths
    const pluginParsers = await Promise.all((await collectPluginPaths()).map(async (path) => new VencordAstParser(await readFile(path, "utf-8"), path)));

    describe("getPluginName", function () {
        it("parses all plugin names to non-null values", function () {
            for (const parser of pluginParsers) {
                const name = parser.getPluginName();

                expect(name, `Parsing plugin name failed for plugin at path ${parser.path}`).to.be.a("string");
            }
        });
        it("parses all plugin names correctly", function () {
            const names = pluginParsers.map((parser) => parser.getPluginName());

            // sort to keep snapshot sane && stable
            expect(names.toSorted())
                .toMatchSnapshot();
        });
        it.skip("gets the correct plugin name for a weird plugin", function () {
            const parser = parserFor("pluginImports.ts");

            expect(parser.getPluginName()).to.equal("2");
        });
    });
    describe("getPatches()", function () {
        it.skipIf(IS_WINDOWS)("gets the patches for all plugins", async function () {
            const patches = Object.fromEntries(pluginParsers.map((parser) => [parser.getPluginName() ?? assert.fail("Plugin name is missing"), parser.getPatches()] as const));

            await expect(JSON.stringify(patches, null, 4))
                .toMatchFileSnapshot(join(__dirname, "__snapshots__", "allPatches.json"));
        });
    });
});

function waitForProcess(process: ChildProcess): Promise<void> {
    return new Promise<void>((res, rej) => {
        process.on("exit", (code) => {
            if (code === 0) {
                res();
            } else {
                rej(new Error(`Child process exited with code: ${code}`));
            }
        });
    });
}

async function ensureVencordDownloaded() {
    if (await exists(VENCORD_DIR) && await isDirectory(VENCORD_DIR)) {
        return;
    }


    await waitForProcess(exec(`git clone https://github.com/vendicated/vencord.git ${VENCORD_DIR}`));
    await waitForProcess(exec(`git checkout --detach ${VENCORD_REV}`, {
        cwd: VENCORD_DIR,
    }));
}

async function resolvePluginEntrypoint(pluginEntry: Dirent): Promise<string> {
    const pluginEntryPath = join(pluginEntry.parentPath, pluginEntry.name);

    if (pluginEntry.isFile()) {
        return pluginEntryPath;
    }

    let path = join(pluginEntryPath, "index.ts");

    if (await exists(path)) {
        return path;
    } else if (await exists(path = join(pluginEntryPath, "index.tsx"))) {
        return path;
    }
    throw new Error("No valid entry point found");
}

async function collectPluginPaths(): Promise<string[]> {
    const basePluginDir = join(VENCORD_DIR, "src", "plugins");
    const pluginDirs = [basePluginDir, join(basePluginDir, "_api"), join(basePluginDir, "_core")];

    for (const dir of pluginDirs) {
        assert(await isDirectory(dir));
    }

    const pluginFiles = await Promise.all(pluginDirs.map((dir) => readdir(dir, { withFileTypes: true })));

    return await Promise.all(pluginFiles
        .flat()
        .filter((dir) => {
            // don't match index.ts at root of plugin tree, it's not a plugin
            return dir.name[0] !== "_" && dir.name !== "index.ts";
        })
        .map(resolvePluginEntrypoint));
}

async function exists(path: PathLike) {
    try {
        return !!await stat(path);
    } catch {
        return false;
    }
}
/**
 * **PATH MUST EXIST**
 *
 * \@throws if the path doesnt exist
 *
 * use {@link exists} to check if it exists
 */
async function isDirectory(path: PathLike) {
    return (await stat(path)).isDirectory();
}
