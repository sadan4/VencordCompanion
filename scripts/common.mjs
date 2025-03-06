//@ts-check
import { commonOpts as webviewCommonOpts } from "../src/webview/scripts/common.mjs"
import { join } from "path";
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
            const base64 = searchParams.has("base64");
            const noTrim = searchParams.get("trim") === "false";

            const encoding = base64 ? "base64" : "utf-8";

            let content;
            content = await readFile(join("assets", "test", path), encoding);
            if (!noTrim) content = content.trimEnd();
            return {
                contents: `export default ${JSON.stringify(content)}`
            };
        });
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
    external: ["*"],
    platform: "node",
    sourcemap: "inline",
    logLevel: "info",
    format: "cjs",
    plugins: [fileUrlPlugin],
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