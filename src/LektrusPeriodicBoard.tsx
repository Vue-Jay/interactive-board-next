import {useState} from "react";
import {createPortal} from "react-dom";
import LektrusPeriodicTableView from "./LektrusPeriodicTableView";
import LektrusElementInfo from "./LektrusElementInfo";
type Props={selected:number[];showNames:boolean;onChange?:(numbers:number[])=>void};
export default function LektrusPeriodicBoard({selected,showNames,onChange}:Props){
 const [opened,setOpened]=useState<number|null>(null);
 const change=()=>{if(!opened||!onChange)return;
  onChange(selected.includes(opened)?selected.filter(x=>x!==opened):
    selected.length<24?[...selected,opened].sort((a,b)=>a-b):selected)};
 return <>
  <LektrusPeriodicTableView selected={selected} showNames={showNames} active={opened} onPick={setOpened}/>
  {opened&&createPortal(<div className="lektrus-element-popover-backdrop"
    onPointerDown={e=>{e.stopPropagation();if(e.target===e.currentTarget)setOpened(null)}}
    onClick={e=>e.stopPropagation()}>
    <section className="lektrus-element-popover" role="dialog" aria-modal="true" aria-label="Сведения об элементе"
      onPointerDown={e=>e.stopPropagation()}>
      <LektrusElementInfo number={opened} isSelected={selected.includes(opened)}
        onToggle={onChange?change:undefined} onClose={()=>setOpened(null)}/>
    </section>
   </div>,document.body)}
 </>;
}
