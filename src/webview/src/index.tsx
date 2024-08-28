import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
let IS_DEV = false;
//@ts-ignore
if (!window.reporterData){
  IS_DEV = true;
  //@ts-ignore
  window.reporterData = require("./data.json")
}

let vscAPI;

if(!IS_DEV)
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
    { IS_DEV && <style>
      {css}
      </style>}
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
