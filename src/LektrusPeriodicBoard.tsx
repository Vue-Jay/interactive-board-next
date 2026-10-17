import {useEffect,useRef,useState} from "react";
import LektrusPeriodicFloatingInfo from "./LektrusPeriodicFloatingInfo";
import LektrusPeriodicTableView from "./LektrusPeriodicTableView";

type Layout="school"|"long";
type Props={
 selected:number[];showNames:boolean;layout?:Layout;
 onChange?:(numbers:number[])=>void;
 onLayoutChange?:(layout:Layout)=>void;suspended?:boolean;
};
export default function LektrusPeriodicBoard({
 selected,showNames,layout="school",onChange,onLayoutChange,suspended=false
}:Props){
 const [opened,setOpened]=useState<number[]>([]);
 const [multi,setMulti]=useState(false);
 const stageRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(suspended)setOpened([])},[suspended]);
 useEffect(()=>{setOpened([])},[layout]);
 const pick=(number:number,event?:{ctrlKey:boolean;shiftKey:boolean})=>{
   if(suspended)return;
   setOpened(previous=>previous.includes(number)?previous.filter(n=>n!==number)
     :multi||event?.ctrlKey||event?.shiftKey?[...previous,number]:[number]);
 };
 const toggle=(number:number)=>{
   if(!onChange)return;
   onChange(selected.includes(number)?selected.filter(n=>n!==number)
     :selected.length<24?[...selected,number].sort((a,b)=>a-b):selected);
 };
 return <div className="lektrus-periodic-board" onDoubleClick={e=>e.stopPropagation()}>
   <div ref={stageRef} className={"lektrus-periodic-window-stage "+(layout==="school"?"is-school":"is-modern")}>
     <LektrusPeriodicTableView selected={selected} showNames={showNames}
       layout={layout} active={opened.at(-1)??null} onPick={pick} onDoublePick={toggle}/>
     {!suspended&&opened.map((number,index)=>
       <LektrusPeriodicFloatingInfo key={number} number={number} slot={index}
         layout={layout} stageRef={stageRef} selected={selected.includes(number)}
         onClose={()=>setOpened(v=>v.filter(n=>n!==number))}
         onToggle={onChange?()=>toggle(number):undefined}/>)}
   </div>
   <div className="lektrus-periodic-board-footer"
      onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
      onDoubleClick={e=>e.stopPropagation()}>
     <div className="lektrus-periodic-board-tabs" role="group" aria-label="Вариант таблицы">
       <button type="button" aria-pressed={layout==="school"} disabled={!onLayoutChange}
         onClick={()=>onLayoutChange?.("school")}>Российская</button>
       <button type="button" aria-pressed={layout==="long"} disabled={!onLayoutChange}
         onClick={()=>onLayoutChange?.("long")}>Современная</button>
     </div>
     <button className="lektrus-periodic-multi-toggle" type="button" aria-pressed={multi}
       onClick={()=>setMulti(v=>!v)} title="Для планшета: последовательно открывать несколько карточек элементов">
       Сравнить <span>{multi?"Вкл":"Выкл"}</span>
     </button>
   </div>
 </div>;
}
