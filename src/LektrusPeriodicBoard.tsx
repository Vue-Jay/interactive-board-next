import {useRef,useState} from "react";
import LektrusPeriodicFloatingInfo from "./LektrusPeriodicFloatingInfo";
import LektrusPeriodicTableView from "./LektrusPeriodicTableView";
type Props={selected:number[];showNames:boolean;layout?:"school"|"long";onChange?:(numbers:number[])=>void};
export default function LektrusPeriodicBoard({selected,showNames,layout="school",onChange}:Props){
 const [opened,setOpened]=useState<number|null>(null);
 const anchor=useRef<HTMLDivElement>(null);
 const change=()=>{if(!opened||!onChange)return;
  onChange(selected.includes(opened)?selected.filter(x=>x!==opened):
    selected.length<24?[...selected,opened].sort((a,b)=>a-b):selected)};
 return <div ref={anchor} style={{width:"100%",height:"100%"}}>
  <LektrusPeriodicTableView selected={selected} showNames={showNames} layout={layout} active={opened} onPick={setOpened} showInfo={opened!==null} onCloseInfo={()=>setOpened(null)} onToggleInfo={change}/>
  <LektrusPeriodicFloatingInfo number={opened} layout={layout} anchor={anchor.current} selected={opened!==null&&selected.includes(opened)} onClose={()=>setOpened(null)} onToggle={onChange?change:undefined}/>

 </div>;
}
