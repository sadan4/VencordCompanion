import esbuild from "esbuild";
import { commonOpts, webviewOpts } from "./common.mjs";
import { writeFile } from "fs/promises";

//@ts-check

await Promise.all([
    esbuild.build(webviewOpts)
])
const res = await esbuild.build({...commonOpts, 
        sourcemap: "linked",
        metafile: true
    });
await writeFile("dist/meta.json", JSON.stringify(res.metafile));