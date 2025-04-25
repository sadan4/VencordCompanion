//@ts-check
import { commonOpts as webviewCommonOpts } from "../src/webview/scripts/common.mjs"
import { join, relative } from "path";
import { glob } from "glob";
import { readFile } from "fs/promises";
const sourceFiles = await glob("src/**/*.{ts,cts,mts}", {
    ignore: ["src/webview/**"]
});
/**
 * @type {import("esbuild").Plugin}
 */
const fileUrlPlugin = {
    name: "file-uri-plugin",
    setup: build => {
        console.log("BUILDING");
        const filter = /^test:\/\/.+$/;
        build.onResolve({ filter }, args => {
            return {
                namespace: "file-uri",
                path: args.path,
                pluginData: {
                    uri: args.path,
                    path: args.path.slice("test://".length).split("?")[0]
                }
            }
        });
        build.onLoad({ filter, namespace: "file-uri" }, async ({ pluginData: { path, uri } }) => {
            const { searchParams } = new URL(uri);
            return {
                contents: await readFile(join("assets", "test", path), "utf8"),
                loader: searchParams.has("base64") ? "base64" : "text"
            }
        });
    }
};
/**
 * @type {import("esbuild").Plugin}
 */
const bundleESMPlugin = {
    name: "bundle-esm-plugin",
    setup(build) {
        const bundle = ["@intrnl/xxhash64", "nanoid"]
        const bundlePaths = []
        const nodeDir = join(process.cwd(), "node_modules");
        build.onResolve({ filter: /./, namespace: "file" }, async ({ kind, path, importer, resolveDir, namespace, with: With, pluginData }) => {
            if (pluginData?.IGNORE) return;
            if (kind === "entry-point") return;
            if (bundlePaths.some(x => relative(nodeDir, importer).startsWith(x))) {
                return;
            }
            if (bundle.includes(path)) {
                const { path: resPath } = await build.resolve(path, {
                    importer,
                    pluginName: "bundle-esm-plugin",
                    kind,
                    namespace,
                    resolveDir,
                    with: With,
                    pluginData: {
                        IGNORE: true
                    }
                });
                bundlePaths.push(join(...relative(nodeDir, resPath).split("/", 2)))
                return;
            }
            return {
                external: true
            }
        })
    }
};
/**
 * @type {import("esbuild").BuildOptions}
 */
const testOpts = {
    entryPoints: sourceFiles,
    outdir: "dist.test",
    minify: false,
    treeShaking: false,
    bundle: true,
    external: ["vscode", "typescript", "@sadan4/devtools-pretty-printer", "mocha", "chai", "fast-diff", "tsutils", "ws"],
    platform: "node",
    sourcemap: "linked",
    logLevel: "info",
    format: "cjs",
    plugins: [fileUrlPlugin, bundleESMPlugin],
}
export const testOptions = [testOpts];
/**
 * @type {import("esbuild").BuildOptions}
 */
export const commonOpts = {
    entryPoints: ["./src/extension.ts"],
    minify: true,
    treeShaking: true,
    bundle: true,
    external: ["vscode"],
    platform: "node",
    sourcemap: "inline",
    logLevel: "info",
    outfile: "dist/extension.js"
}
const webviewopts = {
    ...webviewCommonOpts
};
if (!webviewopts.define || !Array.isArray(webviewopts.entryPoints))
    throw new Error("how");
webviewopts.entryPoints = webviewopts.entryPoints.map(x => join("src/webview", x))
webviewopts.outdir = "./dist/webview"
webviewopts.define.IS_DEV = "false"


// ugly
export const webviewOpts = webviewopts;