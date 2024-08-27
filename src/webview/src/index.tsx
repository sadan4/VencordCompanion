import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
let doCss = false;
//@ts-ignore
if (!window.reporterData){
  doCss = true;
  //@ts-ignore
  window.reporterData = require("./data.json")
}
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
}`
root.render(
  <React.StrictMode>
    { doCss && <style>
      {css}
      </style>}
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
