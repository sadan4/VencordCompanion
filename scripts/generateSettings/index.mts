import { Generator } from "./Generator.mts";

import { readFile, writeFile } from "fs/promises";
import { join } from "path";


const __dirname = import.meta.dirname;
const SUPPORTED_TYPES = Object.freeze(["boolean"] as const);


type SupportedType = (typeof SUPPORTED_TYPES)[number];


export interface ConfEntry {
    /**
     * Without the extension ID
     */
    key: string;
    default?: any;
    settingType: SupportedType;
}

export async function genSettings() {
    const packageJson = JSON.parse(await readFile("package.json", "utf-8"));
    const EXT_ID = packageJson.name as string;
    const EXT_PREFIX = `${EXT_ID}.`;
    const entries: ConfEntry[] = [];

    if (!EXT_ID) {
        throw new Error("Could not find extension ID in package.json");
    }

    const configuration = packageJson?.contributes?.configuration.properties as Record<string, any>;

    for (const [_key, val] of Object.entries(configuration)) {
        if (!_key.startsWith(EXT_PREFIX)) {
            console.warn(`Configuration key "${_key}" does not start with extension ID "${EXT_PREFIX}". Skipping.`);
            continue;
        }

        const key = _key.slice(EXT_PREFIX.length);

        if (key.indexOf(".") !== -1) {
            console.warn(`nested configurations are not supported at the moment, skipping "${_key}"`);
            continue;
        }

        const settingType = val.type as SupportedType | undefined;

        if (!settingType) {
            console.warn(`Configuration key "${_key}" does not have a type. Skipping.`);
            continue;
        }

        if (!SUPPORTED_TYPES.includes(settingType)) {
            console.warn(`Configuration key "${_key}" has unsupported type "${settingType}". Skipping.`);
            console.info("Supported types are:", SUPPORTED_TYPES.join(", "));
            console.info("You can add support for more types by editing scripts/generateSettings.mts");
            continue;
        }
        entries.push({
            key,
            settingType,
            default: val.default,
        });
    }

    const gen = new Generator(EXT_ID);

    for (const entry of entries) {
        gen.generateForConfigEntry(entry);
    }

    const generatedFile = gen.toString();

    await writeFile(join(__dirname, "..", "src", "settings.ts"), generatedFile, "utf-8");
}

if (import.meta.main) {
    await genSettings();
}
