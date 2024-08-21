import './App.css';
import { ReporterSections } from './Reporter';
import data from "./data.json"
//@ts-ignore
if(window.reporterData === undefined)
  //@ts-ignore
  window.reporterData = data
debugger;
function App() {
  return (
    <ReporterSections/>
  );
}

export default App;
