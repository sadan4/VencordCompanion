// @ts-ignore d.ts file strikes again, shows no default export. usage follows their own docs
import babel from "prettier/plugins/babel";
// @ts-ignore for some fucking reason, the d.ts file shows no exports when the mjs file clearly has them
import estree from "prettier/plugins/estree";
import { format } from "prettier/standalone";
import { commands } from "vscode";
export default async function (text: string) {
    return await format(text, {
        parser: "babel",
        plugins: [babel, estree],
        tabWidth: 4
    });
}
