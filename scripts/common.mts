// @ts-check
import packageJson from "../package.json" with {type: "json"};

import { readFile } from "fs/promises";
import { join, relative } from "path";

import type { BuildOptions, Plugin } from "esbuild";
import { glob } from "glob";

const { version } = packageJson;

const sourceFiles
    = await glob("src/**/*.{ts,cts,mts}", { ignore: ["src/webview/**"] });

const fileUrlPlugin: Plugin = {
    name: "file-uri-plugin",
    setup: (build) => {
        const filter = /^test:\/\/.+$/;

        build.onResolve({ filter }, (args) => {
            return {
                namespace: "file-uri",
                path: args.path,
                pluginData: {
                    uri: args.path,
                    path: args.path.slice("test://".length)
                        .split("?")[0],
                },
            };
        });
        build.onLoad({
            filter,
            namespace: "file-uri",
        }, async ({ pluginData: { path, uri } }) => {
            const { searchParams } = new URL(uri);

            return {
                contents: await readFile(join("assets", "test", path), "utf8"),
                loader: searchParams.has("base64") ? "base64" : "text",
            };
        });
    },
};

const bundleESMPlugin: Plugin = {
    name: "bundle-esm-plugin",
    setup(build) {
        const bundle = ["@intrnl/xxhash64", "nanoid"];
        const bundlePaths: string[] = [];
        const nodeDir = join(process.cwd(), "node_modules");

        build.onResolve(
            {
                filter: /./,
                namespace: "file",
            },
            async ({
                kind,
                path,
                importer,
                resolveDir,
                namespace,
                with: With,
                pluginData,
            }) => {
                if (pluginData?.IGNORE)
                    return;
                if (kind === "entry-point")
                    return;
                if (bundlePaths.some((x) => relative(nodeDir, importer)
                    .startsWith(x))) {
                    return;
                }
                if (bundle.includes(path)) {
                    const { path: resPath } = await build.resolve(path, {
                        importer,
                        pluginName: "bundle-esm-plugin",
                        kind,
                        namespace,
                        resolveDir,
                        with: With,
                        pluginData: { IGNORE: true },
                    });

                    bundlePaths.push(join(...relative(nodeDir, resPath)
                        .split("/", 2)));
                    return;
                }
                return {
                    external: true,
                };
            },
        );
    },
};

const commonDefines = {
    SERVER_VERSION_FROM_BUILD: JSON.stringify(version.split(".")
        .map(Number)),
    IS_TEST: "false",
};

const testOpts = {
    entryPoints: sourceFiles,
    outdir: "dist.test",
    minify: false,
    treeShaking: false,
    bundle: true,
    external: [
        "vscode",
        "typescript",
        "@sadan4/devtools-pretty-printer",
        "mocha",
        "chai",
        "fast-diff",
        "tsutils",
        "ws",
    ],
    platform: "node",
    sourcemap: "linked",
    logLevel: "info",
    format: "cjs",
    define: {
        ...commonDefines,
        IS_TEST: "true",
    },
    plugins: [fileUrlPlugin, bundleESMPlugin],
} satisfies BuildOptions;

export const testOptions = [testOpts] as const;
export const commonOpts = {
    entryPoints: ["./src/extension.ts"],
    minify: true,
    treeShaking: true,
    bundle: true,
    external: ["vscode"],
    platform: "node",
    sourcemap: "inline",
    logLevel: "info",
    define: { ...commonDefines },
    outfile: "dist/extension.js",
} satisfies BuildOptions;
