import Patch from "./Patch";
import { Patch as IPatch } from "./types";

interface props {
    data: IPatch[]
    name: string
}
function PatchSection(props: props){
    const data = props.data.sort((a, b) => a.plugin.localeCompare(b.plugin))
    if(props.data.length === 0) return <></>
    return <>
    <h2>
        {props.name}
    </h2>
    {props.data.length === 0 ? "No Patches Errored" : data.map(x => <Patch patch={x}/>)}

    </>
}

export default PatchSection