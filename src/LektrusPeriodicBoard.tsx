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
 return <div ref={anchor} style={{width:"100%",height:"100%",position:"relative"}} onDoubleClick={e=>e.stopPropagation()}>
  <LektrusPeriodicTableView selected={selected} showNames={showNames} layout={layout} active={opened.at(-1)??null} onPick={pick} onDoublePick={toggle}/>
  <div style={{position:"absolute",bottom:"2.5%",right:"4%",zIndex:2,display:"flex",gap:5,justifyContent:"center",alignItems:"center",padding:"5px 7px",borderRadius:8,background:"rgba(255,255,255,.95)",border:"1px solid #d4e0f0",fontSize:11}} onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
   <button type="button" aria-pressed={layout==="school"} onClick={()=>onLayoutChange?.("school")}>Российская</button>
   <button type="button" aria-pressed={layout==="long"} onClick={()=>onLayoutChange?.("long")}>Современная</button>
   <button type="button" aria-pressed={multi} onClick={()=>setMulti(v=>!v)} title="На сенсорном устройстве позволяет открыть несколько карточек">Несколько окон: {multi?"вкл":"выкл"}</button>
  </div>
  {!suspended&&opened.map((number,i)=><LektrusPeriodicFloatingInfo key={number} number={number} slot={i} layout={layout} anchor={anchor.current}
   selected={selected.includes(number)} onClose={()=>setOpened(v=>v.filter(n=>n!==number))}
   onToggle={onChange?()=>toggle(number):undefined}/>)}
 </div>;
}
