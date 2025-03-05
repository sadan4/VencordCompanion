import { commonOpts as webviewCommonOpts } from "../src/webview/scripts/common.mjs"
import { join } from "path";
import { } from "glob";
import { glob } from "fs/promises";
//@ts-check
const sourceFiles = await Array.fromAsync(glob("src/**/*.ts", {
    exclude: ["src/webview"]
}));
/**
 * @type {import("esbuild").BuildOptions}
 */
export const testOpts = {
    entryPoints: sourceFiles,
    outdir: "dist.test",
    minify: false,
    treeShaking: false,
    bundle: false,
    platform: "node",
    sourcemap: "inline",
    logLevel: "info",
    format: "cjs"
}
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
webviewopts.entryPoints = webviewopts.entryPoints.map(x => join("src/webview", x))
webviewopts.outdir = "./dist/webview"
webviewopts.define.IS_DEV = "false"


// ugly
export const webviewOpts = webviewopts;