import esbuild from "esbuild";
import { commonOpts } from "./common.mjs";
import { writeFile } from "fs/promises";

//@ts-check
const IS_DEV = process.argv.includes("--dev");
const res = await esbuild.build({
    ...commonOpts,
    sourcemap: "linked",
    metafile: true,
    minify: !IS_DEV
});
await writeFile("dist/meta.json", JSON.stringify(res.metafile));
