import esbuild from "esbuild";
import { commonOpts } from "./common.mjs";
import { writeFileSync } from "fs";
import { join } from "path";
//@ts-check

const opts = {
    ...commonOpts
}
opts.metafile = true

export const finalOpts = opts

const result = await esbuild.build({
    ...opts
})