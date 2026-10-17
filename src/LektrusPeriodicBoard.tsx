import {useEffect,useRef,useState} from "react";
import LektrusPeriodicFloatingInfo from "./LektrusPeriodicFloatingInfo";
import LektrusPeriodicTableView from "./LektrusPeriodicTableView";
type Props={selected:number[];showNames:boolean;layout?:"school"|"long";onChange?:(numbers:number[])=>void;onLayoutChange?:(layout:"school"|"long")=>void;suspended?:boolean};
export default function LektrusPeriodicBoard({selected,showNames,layout="school",onChange,onLayoutChange,suspended=false}:Props){
 const [opened,setOpened]=useState<number[]>([]);
 useEffect(()=>{if(suspended)setOpened([])},[suspended]);
 const [multi,setMulti]=useState(false);
 const anchor=useRef<HTMLDivElement>(null);
 const pick=(number:number,event?:{ctrlKey:boolean;shiftKey:boolean})=>{
  setOpened(current=>{
   if(current.includes(number))return current.filter(n=>n!==number);
   return multi||event?.ctrlKey||event?.shiftKey?[...current,number]:[number];
  });
 };
 const toggle=(number:number)=>{
  if(!onChange)return;
  onChange(selected.includes(number)?selected.filter(x=>x!==number):
   selected.length<24?[...selected,number].sort((a,b)=>a-b):selected);
 };
 return <div ref={anchor} className="lektrus-periodic-board" onDoubleClick={e=>e.stopPropagation()}>
  <LektrusPeriodicTableView selected={selected} showNames={showNames} layout={layout} active={opened.at(-1)??null} onPick={pick} onDoublePick={toggle}/>
  <div className="lektrus-periodic-board-footer" onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}>
   <div className="lektrus-periodic-board-tabs" role="group" aria-label="Вариант таблицы">
    <button type="button" aria-pressed={layout==="school"} disabled={!onLayoutChange}
      onClick={()=>onLayoutChange?.("school")}>Российская</button>
    <button type="button" aria-pressed={layout==="long"} disabled={!onLayoutChange}
      onClick={()=>onLayoutChange?.("long")}>Современная</button>
   </div>
   <button className="lektrus-periodic-multi-toggle" type="button" aria-pressed={multi}
     onClick={()=>setMulti(v=>!v)} title="Для сенсорных устройств: открывать несколько карточек последовательно">
     Сравнить <span>{multi?"Вкл":"Выкл"}</span>
   </button>
  </div>
  {!suspended&&opened.map((number,i)=><LektrusPeriodicFloatingInfo key={number} number={number} slot={i} layout={layout} anchor={anchor.current}
   selected={selected.includes(number)} onClose={()=>setOpened(v=>v.filter(n=>n!==number))}
   onToggle={onChange?()=>toggle(number):undefined}/>)}
 </div>;
}
