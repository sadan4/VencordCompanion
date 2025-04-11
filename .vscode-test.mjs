// @ts-check
import { defineConfig } from "@vscode/test-cli";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
// build the tests before running them

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
    files: ["./dist.test/**/*.test.js"],
    ...(process.env.VSCODE_TEST_BIN_PATH ?
        {
            useInstallation: {
                fromPath: process.env.VSCODE_TEST_BIN_PATH
            }
        } : {
            version: "1.89.1"
        }
    ),
    extensionDevelopmentPath: __dirname,
    coverage: {
        // FIXME: this is broken 
        // exclude: [`dist.test`]
    },
    mocha: {
        ui: "bdd",
        color: true,
        require: [
            "source-map-support/register",
            join(__dirname, "scripts", "fixture.cjs"),
        ]
    },
    launchArgs: [
        "--disable-extensions"
    ]
})
