import { defineConfig } from "@vscode/test-cli";
// build the tests before running them

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
    mocha: {
        ui: "bdd",
        color: true
    },
    launchArgs: [
        "--disable-extensions"
    ]
})