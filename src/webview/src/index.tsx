import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
if (IS_DEV) {
  //@ts-ignore
  window.reporterData = require("./data.json")
  // esbuild hot reloading see https://esbuild.github.io/api/#live-reload
  new EventSource('/esbuild').addEventListener('change', e => {
    const { added, removed, updated } = JSON.parse(e.data)

    if (!added.length && !removed.length && updated.length === 1) {
      for (const link of document.getElementsByTagName("link")) {
        const url = new URL(link.href)

        if (url.host === location.host && url.pathname === updated[0]) {
          const next = link.cloneNode()
          //@ts-ignore
          next.href = updated[0] + '?' + Math.random().toString(36).slice(2)
          //@ts-ignore
          next.onload = () => link.remove()
          //@ts-ignore
          link.parentNode.insertBefore(next, link.nextSibling)
          return
        }
      }
    }

    location.reload()
  })
}

let vscAPI;

if (!IS_DEV)
  vscAPI = acquireVsCodeApi();
export const vscodeAPI = vscAPI;

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
const css = `:root {
  --text: #cdd6f4;
  --subtext1: #bac2de;
  --subtext0: #a6adc8;
  --overlay2: #9399b2;
  --overlay1: #7f849c;
  --overlay0: #6c7086;
  --surface2: #585b70;
  --surface1: #45475a;
  --surface0: #313244;
  --base: #1e1e2e;
  --mantle: #181825;
  --crust: var(--base);
  --button-background: #3d59a1;
  --button-foreground: var(--text);
}`
root.render(
  <React.StrictMode>
    {IS_DEV && <style>
      {css}
    </style>}
    <App />
  </React.StrictMode>
);
