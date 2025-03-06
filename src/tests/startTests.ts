import { resolve } from "path";

import { ExTester, logging, ReleaseQuality } from "vscode-extension-tester";
import { CodeUtil } from "vscode-extension-tester/out/util/CodeUtil";

// @ts-expect-error
class ArmCodeUtil extends CodeUtil {
    private override getPlatform() {
        let { platform } = process;
        const { arch } = process;
        // @ts-expect-error
        this.cliEnv = "ELECTRON_RUN_AS_NODE=1";
        if (platform === "linux") {
            platform += arch === "ia32" ? "-ia32" : `-${arch}`;
        } else if (platform === "win32") {
            platform += arch === "x64" ? `-${arch}` : "";
            switch (arch) {
                case "arm64": {
                    platform += "-arm64";
                    break;
                }
                case "x64": {
                    platform += "-x64";
                    break;
                }
                default: {
                    throw new Error(`Unknown Platform: ${arch}`);
                }
            }
            platform += "-archive";
            // @ts-expect-error
            this.cliEnv = `set ${this.cliEnv} &&`;
        } else if (platform === "darwin") {
            platform += "-universal";
        }
        return platform;
    }
}

(async function () {
    try {
        const extensionDevelopmentPath = resolve(__dirname, "../..");

        const args = [resolve(extensionDevelopmentPath, ".vscode-test"), ReleaseQuality.Stable, undefined, true] as const;
        const ex = new ExTester(...args);
        // @ts-expect-error
        ex.code = new ArmCodeUtil(...args);
        await ex.downloadChromeDriver();
        await ex.downloadCode();
        console.log(resolve(extensionDevelopmentPath, "dist", "**", "*.test.js"));
        await ex.runTests("dist/**/*.test.js", {
            logLevel: logging.Level.ALL,
            resources: []
        });
    } catch (e) {
        console.error("Failed to run tests");
        console.error(e);
        process.exit(1);
    }
})();
