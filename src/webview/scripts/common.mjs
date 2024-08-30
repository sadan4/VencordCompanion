//@ts-check
import esbuild from "esbuild";

const define = {
    IS_DEV: String(process.argv.includes("--dev"))
}
const entryPoints = ["./src/index.tsx"];
if(define.IS_DEV === "true") entryPoints.push("./src/index.html")
/**
 * @type {esbuild.BuildOptions}
 */
export const commonOpts = {
    entryPoints,
    loader: {
        ".html": "copy"
    },
    outdir: "./dist",
    bundle: true,
    minify: true,
    treeShaking: true,
    define
}

