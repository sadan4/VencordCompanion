import './App.css';
import { ReporterSections } from './Reporter';  

// export const vscode = acquireVsCodeApi();

function App() {
  return (
    //@ts-ignore
    <ReporterSections data={window.reporterData}/>
  );
}

export default App;
