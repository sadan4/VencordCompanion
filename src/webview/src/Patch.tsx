import { useState } from "react";
import { EvaledPatch, Patch as IPatch } from "./types";

interface props {
    patch: IPatch 
}
function Patch(props: props) {
    const [show, setShow] = useState(false)
    return (
        <>
        <div className="pluginName"
         onClick={() => setShow(!show)}
         style={{
            userSelect: "none"
         }}
         >{props.patch.plugin}</div>
         {show && "a"}
        </>
    )
}
export default Patch