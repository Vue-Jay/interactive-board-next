import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent,type ReactNode} from "react";
import {createPortal} from "react-dom";
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
type Geometry={left:number;top:number;width:number;height:number;scaleX:number;scaleY:number;localW:number;localH:number};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const close=(a:number,b:number)=>Math.abs(a-b)<0.15;
const sameGeometry=(a:Geometry|null,b:Geometry)=>!!a&&
 close(a.left,b.left)&&close(a.top,b.top)&&close(a.width,b.width)&&close(a.height,b.height)&&
 close(a.scaleX,b.scaleX)&&close(a.scaleY,b.scaleY)&&close(a.localW,b.localW)&&close(a.localH,b.localH);

export default function LektrusPeriodicFloatingInfo({number,layout,stageRef,selected,onClose,onToggle,slot=0,fixed=false}:Props){
 const element=periodicElements[number-1],facts=elementFacts[number-1];
 const [atomOpen,setAtomOpen]=useState(false);
 const [mode,setMode]=useState<AtomViewMode>("shell");
 const [detailsOffset,setDetailsOffset]=useState<Point|null>(null);
 const [atomOffset,setAtomOffset]=useState<Point|null>(null);
 const [geometry,setGeometry]=useState<Geometry|null>(null);
 const detailsRef=useRef<HTMLElement>(null);
 const atomRef=useRef<HTMLElement>(null);
 const detailDrag=useRef<{id:number;x:number;y:number;origin:Point}|null>(null);
 const atomDrag=useRef<{id:number;x:number;y:number;origin:Point}|null>(null);

 useEffect(()=>{setAtomOpen(false);setMode("shell");setDetailsOffset(null);setAtomOffset(null)},[number,layout]);
 useLayoutEffect(()=>{
  if(fixed)return;
  let frame=0,alive=true;
  const update=()=>{
   const stage=stageRef.current;
   if(stage){
    const r=stage.getBoundingClientRect();
    const localW=stage.clientWidth||r.width,localH=stage.clientHeight||r.height;
    if(r.width>0&&r.height>0&&localW>0&&localH>0){
     const next={left:r.left,top:r.top,width:r.width,height:r.height,
       scaleX:r.width/localW,scaleY:r.height/localH,localW,localH};
     setGeometry(old=>sameGeometry(old,next)?old:next);
    }
   }
   if(alive)frame=requestAnimationFrame(update);
  };
  update();
  return ()=>{alive=false;cancelAnimationFrame(frame)};
 },[fixed,stageRef]);

 if(!element||!facts)return null;
 const stage=stageRef.current;
 const localW=geometry?.localW??stage?.clientWidth??840;
 const localH=geometry?.localH??stage?.clientHeight??520;
 const detailWidth=220,atomWidth=320;
 const detailPosition:Point=detailsOffset??(layout==="school"
  ?{x:localW*.73,y:localH*.055+slot*28}
  :{x:localW*.225+slot*22,y:localH*.095+slot*20});
 const atomDefault=():Point=>{
  if(!geometry)return{x:localW+16,y:localH*.12};
  const leftSpace=geometry.left,rightSpace=window.innerWidth-(geometry.left+geometry.width);
  const atomScreenWidth=atomWidth*geometry.scaleX;
  if(rightSpace>=atomScreenWidth+18)return{x:localW+16,y:localH*.12};
  if(leftSpace>=atomScreenWidth+18)return{x:-atomWidth-16,y:localH*.12};
  return{x:clamp(detailPosition.x+detailWidth+12,0,Math.max(0,localW-atomWidth)),y:localH*.29};
 };
 const atomPosition=atomOffset??atomDefault();

 const dragHandlers=(kind:"details"|"atom")=>{
  const state=kind==="details"?detailDrag:atomDrag;
  const getPosition=()=>kind==="details"?detailPosition:atomPosition;
  const setPosition=kind==="details"?setDetailsOffset:setAtomOffset;
  const ref=kind==="details"?detailsRef:atomRef;
  return{
   onPointerDown:(e:PointerEvent<HTMLElement>)=>{
    if(fixed||(e.target as HTMLElement).closest("button"))return;
    e.preventDefault();e.stopPropagation();
    const origin=getPosition();
    state.current={id:e.pointerId,x:e.clientX,y:e.clientY,origin};
    e.currentTarget.setPointerCapture(e.pointerId);
   },
   onPointerMove:(e:PointerEvent<HTMLElement>)=>{
    const d=state.current,g=geometry;
    if(!d||d.id!==e.pointerId||!g||fixed)return;
    const elementWidth=ref.current?.offsetWidth??(kind==="details"?detailWidth:atomWidth);
    const elementHeight=ref.current?.offsetHeight??145;
    const minX=(8-g.left)/g.scaleX,maxX=(window.innerWidth-8-g.left)/g.scaleX-elementWidth;
    const minY=(8-g.top)/g.scaleY,maxY=(window.innerHeight-8-g.top)/g.scaleY-elementHeight;
    setPosition({
     x:clamp(d.origin.x+(e.clientX-d.x)/g.scaleX,minX,Math.max(minX,maxX)),
     y:clamp(d.origin.y+(e.clientY-d.y)/g.scaleY,minY,Math.max(minY,maxY))
    });
   },
   onPointerUp:(e:PointerEvent<HTMLElement>)=>{
    if(state.current?.id===e.pointerId){
     state.current=null;
     if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    }
   },
   onPointerCancel:(e:PointerEvent<HTMLElement>)=>{
    if(state.current?.id===e.pointerId)state.current=null;
   }
  };
 };

 const renderWindow=(kind:"details"|"atom",content:ReactNode)=>{
  const position=kind==="details"?detailPosition:atomPosition;
  const boardStyle:React.CSSProperties=geometry?{
   position:"fixed",left:geometry.left+position.x*geometry.scaleX,
   top:geometry.top+position.y*geometry.scaleY,
   transform:"scale("+geometry.scaleX+","+geometry.scaleY+")",transformOrigin:"top left",
   visibility:"visible"
  }:{visibility:"hidden"};
  const editorStyle:React.CSSProperties={
   position:"absolute",left:layout==="school"?(kind==="details"?"73%":"54%"):(kind==="details"?"22.5%":"53%"),
   top:kind==="details"?"7%":"12%"
  };
  return <section ref={kind==="details"?detailsRef:atomRef}
    className={"lektrus-chem-window lektrus-chem-window--"+kind+(fixed?" is-editor":" is-board")}
    style={fixed?editorStyle:boardStyle} aria-label={kind==="details"?"Элемент "+element.name:"Строение атома "+element.name}
    onPointerDown={e=>e.stopPropagation()} onPointerMove={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}
    onDoubleClick={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
    {content}
   </section>;
 };
 const handleDetails=dragHandlers("details"),handleAtom=dragHandlers("atom");
 const details=renderWindow("details",<>
  <div className="lektrus-chem-window-head" {...handleDetails}>
   <b className="lektrus-chem-element-symbol">{element.symbol}</b>
   <strong>{element.name}</strong>
   {!fixed&&<span aria-hidden="true" className="lektrus-chem-drag-handle">⠿</span>}
   <button type="button" aria-label="Закрыть карточку" onClick={onClose}>×</button>
  </div>
  <div className="lektrus-chem-facts">
   <span>№ <b>{number}</b></span><span>A<sub>r</sub> <b>{facts.atomicMass}</b></span>
   <span>Период <b>{element.period}</b></span><span>Группа <b>{element.group}</b></span>
  </div>
  <div className="lektrus-chem-detail"><span>Конфигурация: </span>{facts.electronConfiguration}</div>
  <div className="lektrus-chem-detail"><span>Степени окисления: </span>{facts.oxidationStates}</div>
  <div className="lektrus-chem-actions">
   <button type="button" aria-expanded={atomOpen} onClick={()=>setAtomOpen(v=>!v)}>Строение атома</button>
   {onToggle&&<button type="button" onClick={onToggle}>{selected?"Снять выделение":"Выделить"}</button>}
  </div>
 </>);
 const atom=atomOpen?renderWindow("atom",<>
  <div className="lektrus-chem-window-head" {...handleAtom}>
   <strong>Строение атома {element.symbol}</strong>
   {!fixed&&<span aria-hidden="true" className="lektrus-chem-drag-handle">⠿</span>}
   <button type="button" aria-label="Закрыть строение атома" onClick={()=>setAtomOpen(false)}>×</button>
  </div>
  <div className="lektrus-chem-atom-modes" role="group" aria-label="Модель атома">
   {atomViews.map(view=><button type="button" key={view.id} aria-pressed={mode===view.id}
     onClick={()=>setMode(view.id)}>{view.name}</button>)}
  </div>
  <div className="lektrus-chem-atom-drawing">
   <LektrusAtomView model={{atomicNumber:number,mode,labelX:0,labelY:0,showElectronConfiguration:true}}/>
  </div>
 </>):null;
 if(fixed)return <>{details}{atom}</>;
 return typeof document!=="undefined"?createPortal(<>{details}{atom}</>,document.body):null;
}
