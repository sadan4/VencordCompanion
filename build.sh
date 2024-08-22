#!/usr/bin/env bash
set -xeuo pipefail

pnpm i
# dont error if it doenst exist
rm -r dist/webview || :
# build webview
pushd src/webview

pnpm i
pnpm build

popd

#build ext
pnpm compile
#copy webview to dist
mkdir dist/webview
cp -R src/webview/build/* dist/webview/
