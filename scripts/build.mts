import { genSettings } from "./generateSettings/index.mts";
import { commonOpts } from "./common.mts";

import esbuild from "esbuild";
import { writeFile } from "node:fs/promises";

const IS_DEV = process.argv.includes("--dev");

await genSettings();

const res = await esbuild.build({
    ...commonOpts,
    sourcemap: "linked",
    metafile: true,
    minify: !IS_DEV,
});

await writeFile("dist/meta.json", JSON.stringify(res.metafile));
