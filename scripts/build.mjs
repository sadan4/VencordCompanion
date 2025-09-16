import { commonOpts } from "./common.mjs";

import { writeFile } from "fs/promises";

import esbuild from "esbuild";

// @ts-check
const IS_DEV = process.argv.includes("--dev");

const res = await esbuild.build({
    ...commonOpts,
    sourcemap: "linked",
    metafile: true,
    minify: !IS_DEV,
});

await writeFile("dist/meta.json", JSON.stringify(res.metafile));
