import './App.css';
import { ReporterSections } from './Reporter';
export const vscode = acquireVsCodeApi();
function App() {
  return (
    <ReporterSections/>
  );
}

export default App;
