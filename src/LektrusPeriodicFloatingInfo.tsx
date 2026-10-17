import {useEffect,useRef,useState,type PointerEvent} from "react";
import {periodicElements} from "./lektrusPeriodicElements";
import {elementFacts} from "./lektrusElementFacts";
import {atomViews,type AtomViewMode} from "./lektrusAtomModel";
import LektrusAtomView from "./LektrusAtomView";

type Point={x:number;y:number};
type Layout="school"|"long";
type Props={
 number:number;layout:Layout;stageRef:{current:HTMLDivElement|null};
 selected:boolean;onClose:()=>void;onToggle?:()=>void;slot?:number;fixed?:boolean;
};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

/** Both windows live in the periodic-table stage.
 * Coordinates are percentages of that stage and follow the board's zoom/translation.
 * The user's hand-positioned locations are the initial locations for each form. */
export default function LektrusPeriodicFloatingInfo({
 number,layout,stageRef,selected,onClose,onToggle,slot=0,fixed=false
}:Props){
 const [view,setView]=useState<"details"|"atom">("details");
 const [mode,setMode]=useState<AtomViewMode>("shell");
 const [offset,setOffset]=useState<Point|null>(null);
 const cardRef=useRef<HTMLDivElement>(null);
 const drag=useRef<{id:number;startX:number;startY:number;origin:Point}|null>(null);
 useEffect(()=>{setView("details");setMode("shell");setOffset(null)},[number,layout]);
 const element=periodicElements[number-1],facts=elementFacts[number-1];
 if(!element||!facts)return null;
 const initial=layout==="school"
  ?{x:71,y:3+slot*24}
  :{x:22+slot*24,y:9};
 const position=offset??initial;
 const move=(e:PointerEvent<HTMLDivElement>)=>{
   const d=drag.current,stage=stageRef.current;
   if(!d||d.id!==e.pointerId||!stage)return;
   const box=stage.getBoundingClientRect();
   const panel=cardRef.current?.getBoundingClientRect();
   if(box.width<=0||box.height<=0)return;
   const maxX=Math.max(0,100-((panel?.width??0)/box.width)*100-0.5);
   const maxY=Math.max(0,100-((panel?.height??0)/box.height)*100-0.5);
   setOffset({x:clamp(d.origin.x+(e.clientX-d.startX)/box.width*100,0,maxX),
     y:clamp(d.origin.y+(e.clientY-d.startY)/box.height*100,0,maxY)});
 };
 const begin=(e:PointerEvent<HTMLDivElement>)=>{
   if(fixed||(e.target as HTMLElement).closest("button"))return;
   e.preventDefault();e.stopPropagation();
   drag.current={id:e.pointerId,startX:e.clientX,startY:e.clientY,origin:position};
   e.currentTarget.setPointerCapture(e.pointerId);
 };
 const end=(e:PointerEvent<HTMLDivElement>)=>{
   if(drag.current?.id!==e.pointerId)return;
   drag.current=null;
   if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };
 return <section ref={cardRef} className={"lektrus-floating-element-card lektrus-periodic-window "+(view==="atom"?"is-atom":"is-details")}
   style={{left:position.x+"%",top:position.y+"%"}}
   onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
   onDoubleClick={e=>e.stopPropagation()} aria-label={view==="atom"?"Строение атома "+element.name:"Информация об элементе "+element.name}>
   <div className="lektrus-floating-element-head"
      onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
      style={{cursor:fixed?"default":"grab",touchAction:"none",userSelect:"none"}}>
     {view==="atom"?<>
       <strong className="lektrus-floating-element-name">Строение атома {element.symbol}</strong>
       <button type="button" onClick={()=>setView("details")} title="Назад к элементу" aria-label="Вернуться к сведениям">↩</button>
     </>:<>
       <b className="lektrus-floating-element-symbol">{element.symbol}</b>
       <strong className="lektrus-floating-element-name">{element.name}</strong>
     </>}
     {!fixed&&<span className="lektrus-floating-element-drag" aria-hidden="true">⠿</span>}
     <button type="button" onClick={onClose} aria-label={"Закрыть "+element.name}>×</button>
   </div>
   {view==="details"?<>
     <div className="lektrus-floating-element-facts">
       <span>№ <b>{number}</b></span><span>A<sub>r</sub> <b>{facts.atomicMass}</b></span>
       <span>Период <b>{element.period}</b></span><span>Группа <b>{element.group}</b></span>
     </div>
     <div className="lektrus-floating-element-configuration">
       <span>Конфигурация</span><b>{facts.electronConfiguration}</b>
     </div>
     <div className="lektrus-floating-element-oxidation">
       <span>Степени окисления</span><b>{facts.oxidationStates}</b>
     </div>
     <div className="lektrus-floating-element-actions">
       <button type="button" onClick={()=>setView("atom")}>Строение атома</button>
       {onToggle&&<button type="button" onClick={onToggle}>{selected?"Снять выделение":"Выделить"}</button>}
     </div>
   </>:<>
     <div className="lektrus-periodic-atom-modes" role="group" aria-label="Модель атома">
       {atomViews.map(model=><button type="button" key={model.id} aria-pressed={mode===model.id}
         onClick={()=>setMode(model.id)}>{model.name}</button>)}
     </div>
     <div className="lektrus-periodic-atom-visual">
       <LektrusAtomView model={{atomicNumber:number,mode,labelX:0,labelY:0,showElectronConfiguration:true}}/>
     </div>
   </>}
 </section>;
}
