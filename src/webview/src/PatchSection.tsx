import { Patch } from "./types";

interface props {
    data: Patch[]
    name: string
}
export default function(props: props){
    return <>
    <h2>
        {props.name}
    </h2>
    {
        JSON.stringify(props)
    }
    </>
}