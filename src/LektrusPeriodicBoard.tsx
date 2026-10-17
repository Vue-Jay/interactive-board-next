import {useState} from "react";
import LektrusPeriodicTableView from "./LektrusPeriodicTableView";
type Props={selected:number[];showNames:boolean;layout?:"school"|"long";onChange?:(numbers:number[])=>void};
export default function LektrusPeriodicBoard({selected,showNames,layout="school",onChange}:Props){
 const [opened,setOpened]=useState<number|null>(null);
 const change=()=>{if(!opened||!onChange)return;
  onChange(selected.includes(opened)?selected.filter(x=>x!==opened):
    selected.length<24?[...selected,opened].sort((a,b)=>a-b):selected)};
 return <>
  <LektrusPeriodicTableView selected={selected} showNames={showNames} layout={layout} active={opened} onPick={setOpened} showInfo={opened!==null} onCloseInfo={()=>setOpened(null)} onToggleInfo={change}/>

 </>;
}
