// @ts-expect-error for some fucking reason, the d.ts file shows no exports when the mjs file clearly has them
import babel from "prettier/plugins/babel";
// @ts-expect-error d.ts file strikes again, shows no default export. usage follows their own docs
import estree from "prettier/plugins/estree";
import { format as fmt } from "prettier/standalone";

export async function format(text: string) {
    return await fmt(text, {
        parser: "babel",
        plugins: [babel, estree],
        tabWidth: 4
    });
}
