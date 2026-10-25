import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import LektrusOpticsView,{opticsSvgPoint,type OpticsSelection,type OpticsTool} from "./LektrusOpticsView";
import LektrusSubjectToolIcon from "./LektrusSubjectToolIcons";
import LektrusOpticsToolIcon from "./LektrusOpticsToolIcon";
import {emptyOptics,makeOpticalElement,opticsId,validOptics,traceOptics,type OpticalElement,type OpticalKind,type OpticsDocument} from "./lektrusOpticsModel";
type Props={item:Item;onSave:(item:Item)=>void;onCancel:()=>void;onClose?:(item:Item)=>void};
type History={past:OpticsDocument[];present:OpticsDocument;future:OpticsDocument[]};
const tools:{id:OpticsTool;name:string;hint:string}[]=[
 {id:"select",name:"Выбор",hint:"Перемещайте и настраивайте оптические объекты"},
 {id:"source",name:"Источник",hint:"Светящийся источник с настраиваемыми лучами"},
 {id:"mirror",name:"Зеркало",hint:"Плоское зеркало, отражает лучи"},
 {id:"converging-lens",name:"Собирающая линза",hint:"Собирающая тонкая линза"},
 {id:"diverging-lens",name:"Рассеивающая линза",hint:"Рассеивающая тонкая линза"},
 {id:"interface",name:"Граница сред",hint:"Преломление по закону Снеллиуса"},
 {id:"screen",name:"Экран",hint:"Завершение луча на экране"},
 {id:"prism",name:"Призма",hint:"Геометрическая схема призмы"}
];
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
function fromLegacy(item:Item):OpticsDocument{
 if(item.scienceOptics&&validOptics(item.scienceOptics))return item.scienceOptics;
 const d=emptyOptics();
 if(!(item.graphPoints?.length||item.graphSegments?.length))return d;
 // Keep legacy physics diagrams visible during conversion. Original segments
 // are preserved as a reference layer instead of replaced by guessed rays.
 const points=item.graphPoints??[];
 const legacy=(item.graphSegments??[]).flatMap((segment,index)=>{
   const a=points[segment.a],b=points[segment.b];if(!a||!b)return [];
   return [{id:"legacy-"+index,x1:480+a.x*55,y1:280-a.y*48,
     x2:480+b.x*55,y2:280-b.y*48,label:segment.label??"",arrow:segment.scienceArrow===true}];
 });
 for(const [index,poly]of(item.graphPolygons??[]).entries()){
   for(let side=0;side<poly.points.length;side++){
     const a=points[poly.points[side]],b=points[poly.points[(side+1)%poly.points.length]];
     if(a&&b)legacy.push({id:"legacy-poly-"+index+"-"+side,x1:480+a.x*55,y1:280-a.y*48,
       x2:480+b.x*55,y2:280-b.y*48,label:"",arrow:false});
   }
 }
 d.legacy=legacy.slice(0,200);
 return d;
}
export default function LektrusOpticsEditor({item,onSave,onCancel,onClose}:Props){
 const [history,setHistory]=useState<History>(()=>({past:[],present:fromLegacy(item),future:[]}));
 const doc=history.present;
 const [name,setName]=useState(item.text?.trim()||"Оптика");
 const [tool,setTool]=useState<OpticsTool>("select");
 const [selected,setSelected]=useState<OpticsSelection>(null);
 const [drawer,setDrawer]=useState(()=>typeof window==="undefined"||!window.matchMedia("(max-width:760px)").matches);
 const [inspector,setInspector]=useState(true);
 const [rayAngle,setRayAngle]=useState(0);
 const [notice,setNotice]=useState("");
 const [cursor,setCursor]=useState<{x:number;y:number}|null>(null);
 const drag=useRef<{pointerId:number;id:string;startX:number;startY:number;originX:number;originY:number;x:number;y:number}|null>(null);
 const preview=useRef<OpticsDocument|null>(null);
 const [display,setDisplay]=useState<OpticsDocument|null>(null);
 const part=selected?.kind==="element"?doc.elements.find(e=>e.id===selected.id):undefined;
 const chosenRay=selected?.kind==="ray"?doc.rays.find(r=>r.id===selected.id):undefined;
 const pathForSelected=chosenRay?traceOptics(doc).find(path=>path.id===chosenRay.id):undefined;
 const source=part?.kind==="source"?part:doc.elements.find(e=>e.kind==="source");
 const rays=source?doc.rays.filter(r=>r.sourceId===source.id):[];
 const commit=(next:OpticsDocument)=>{
   if(next===doc)return;
   setHistory(h=>({past:[...h.past.slice(-59),h.present],present:next,future:[]}));
 };
 const undo=()=>{setHistory(h=>h.past.length?{past:h.past.slice(0,-1),present:h.past[h.past.length-1],future:[h.present,...h.future].slice(0,60)}:h);setSelected(null)};
 const redo=()=>{setHistory(h=>h.future.length?{past:[...h.past.slice(-59),h.present],present:h.future[0],future:h.future.slice(1)}:h);setSelected(null)};
 const patch=(change:Partial<OpticsDocument>)=>commit({...doc,...change});
 const updateElement=(patchValue:Partial<OpticalElement>)=>{
   if(!part)return;
   commit({...doc,elements:doc.elements.map(e=>e.id===part.id?{...e,...patchValue}:e)});
 };
 const add=(kind:OpticalKind,x:number,y:number)=>{
   if(doc.elements.length>=80)return;
   const element=makeOpticalElement(kind,x,y);
   commit({...doc,elements:[...doc.elements,element]});setSelected({kind:"element",id:element.id});
   setTool("select");setInspector(true);
   setNotice("Добавлен оптический элемент. Перетащите его на нужное место.");
 };
 const place=(x:number,y:number)=>{if(tool!=="select")add(tool,x,y);else setSelected(null)};
 const newRay=()=>{
   if(!source||doc.rays.length>=160)return;
   const ray={id:opticsId(),sourceId:source.id,angle:rayAngle,color:"#ef9d3e"};
   commit({...doc,rays:[...doc.rays,ray]});setSelected({kind:"ray",id:ray.id});
   setNotice("Луч построен. Выберите его в списке для изменения угла.");
 };
 const deleteSelected=()=>{
   if(!selected)return;
   if(selected.kind==="element")commit({...doc,
     elements:doc.elements.filter(e=>e.id!==selected.id),rays:doc.rays.filter(r=>r.sourceId!==selected.id)});
   else commit({...doc,rays:doc.rays.filter(r=>r.id!==selected.id)});
   setSelected(null);
 };
 const down=(event:ReactPointerEvent<SVGGElement>,e:OpticalElement)=>{
   if(tool!=="select")return;
   event.preventDefault();setSelected({kind:"element",id:e.id});setInspector(true);
   drag.current={pointerId:event.pointerId,id:e.id,startX:event.clientX,startY:event.clientY,
     originX:e.x,originY:e.y,x:e.x,y:e.y};
   event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
 };
 const move=(event:ReactPointerEvent<HTMLDivElement>)=>{
   const svg=event.currentTarget.querySelector("svg");if(!svg)return;
   if(event.pointerType!=="touch"&&tool!=="select")setCursor(opticsSvgPoint(event.clientX,event.clientY,svg));
   const current=drag.current;if(!current||current.pointerId!==event.pointerId)return;
   event.preventDefault();
   const origin=opticsSvgPoint(current.startX,current.startY,svg);
   const next=opticsSvgPoint(event.clientX,event.clientY,svg);
   current.x=clamp(Math.round(current.originX+next.x-origin.x),30,930);
   current.y=clamp(Math.round(current.originY+next.y-origin.y),30,530);
   const nextDoc={...doc,elements:doc.elements.map(e=>e.id===current.id?{...e,x:current.x,y:current.y}:e)};
   preview.current=nextDoc;setDisplay(nextDoc);
 };
 const up=(event:ReactPointerEvent<HTMLDivElement>)=>{
   const current=drag.current;if(!current||current.pointerId!==event.pointerId)return;
   drag.current=null;setDisplay(null);preview.current=null;
   const svg=event.currentTarget.querySelector("svg");
   if(svg?.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);
   if(current.x!==current.originX||current.y!==current.originY)
     commit({...doc,elements:doc.elements.map(e=>e.id===current.id?{...e,x:current.x,y:current.y}:e)});
 };
 const saveValue=():Item=>({...item,text:name.trim().slice(0,100)||"Оптика",
   graphFigureId:"physics-optics",graphPurpose:"geometry",graphAxisMode:"none",
   graphPoints:[],graphSegments:[],graphPolygons:[],graphCircles:[],graphGrid:false,
   scienceOptics:doc,width:item.scienceOptics?item.width:850,height:item.scienceOptics?item.height:525});
 const close=()=>onClose?onClose(saveValue()):onCancel();
 useEffect(()=>{
   const handle=(event:KeyboardEvent)=>{
     if(event.target instanceof HTMLElement&&event.target.closest("input,textarea,select,[contenteditable]"))return;
     const modifier=event.ctrlKey||event.metaKey;
     if(modifier&&event.key.toLowerCase()==="z"){event.preventDefault();event.stopPropagation();if(event.shiftKey)redo();else undo()}
     else if(modifier&&event.key.toLowerCase()==="y"){event.preventDefault();event.stopPropagation();redo()}
     else if(["Backspace","Delete"].includes(event.key)){event.preventDefault();deleteSelected()}
     else if(event.key==="Escape"){event.stopPropagation();if(tool!=="select")setTool("select");else close()}
   };
   window.addEventListener("keydown",handle,true);return()=>window.removeEventListener("keydown",handle,true);
 });
 return createPortal(<div className="lektrus-optics-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)close()}}>
  <section className={"lektrus-optics-editor"+(drawer?"":" catalog-hidden")+(inspector&&selected?" show-properties":"")} role="dialog" aria-modal="true" aria-label="Редактор оптики" onPointerDown={e=>e.stopPropagation()}>
   <header className="lektrus-optics-header">
    <div className="lektrus-optics-heading"><span className="lektrus-optics-logo" aria-hidden="true"><LektrusSubjectToolIcon id="physics-optics" size={30}/></span>
     <div><small>ФИЗИКА · СВЕТ</small><strong>Оптическая лаборатория</strong></div>
    </div>
    <div className="lektrus-optics-header-actions">
     <button type="button" disabled={!history.past.length} onClick={undo} aria-label="Отменить">↶</button>
     <button type="button" disabled={!history.future.length} onClick={redo} aria-label="Повторить">↷</button>
     <button type="button" aria-pressed={drawer} onClick={()=>setDrawer(v=>!v)}>Элементы</button>
     <button type="button" onClick={close} aria-label="Закрыть редактор">×</button>
    </div>
   </header>
   <div className="lektrus-optics-layout">
    <aside className="lektrus-optics-catalog" aria-label="Каталог оптических элементов">
     <label>Название чертежа<input value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></label>
     <strong>Построения</strong>
     <div className="lektrus-optics-tools">
      {tools.map(t=><button key={t.id} type="button" title={t.hint} className={tool===t.id?"active":""}
       onClick={()=>{setTool(t.id);setNotice(t.id==="select"?"Выберите или переместите элемент.":"Коснитесь листа, чтобы поставить: "+t.name.toLowerCase())}}><LektrusOpticsToolIcon type={t.id}/><span>{t.name}</span></button>)}
     </div>
     <div className="lektrus-optics-catalog-options">
       <label><input type="checkbox" checked={doc.grid} onChange={e=>patch({grid:e.target.checked})}/> Точки сетки</label>
       <label><input type="checkbox" checked={doc.labels} onChange={e=>patch({labels:e.target.checked})}/> Подписи</label>
       <label><input type="checkbox" checked={doc.normals} onChange={e=>patch({normals:e.target.checked})}/> Главная ось и нормали</label>
     </div>
     <p>Начните с пустого листа. Добавьте источник света, затем оптический элемент и лучи. Изменения сразу видны на схеме.</p>
     {!!doc.legacy?.length&&<button type="button" onClick={()=>patch({legacy:[]})}>Убрать старое построение</button>}
    </aside>
    <div className="lektrus-optics-work">
     <div className="lektrus-optics-work-top">
      <b>Схема лучей</b><span>{doc.elements.length} элементов · {doc.rays.length} лучей</span>
      <button type="button" className="lektrus-optics-quick-ray" disabled={!source}
        title={source?"Добавить луч от источника света":"Сначала добавьте источник света"}
        onClick={newRay}>+ Луч</button>
      {selected&&<button type="button" className={inspector?"active":""} onClick={()=>setInspector(v=>!v)}>Параметры</button>}
     </div>
     <div className="lektrus-optics-stage" onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={()=>setCursor(null)}>
       <LektrusOpticsView doc={display??doc} selection={selected} tool={tool} cursor={cursor}
         onPlace={place} onSelect={setSelected} onElementDown={down}
         onRaySelect={id=>{setSelected({kind:"ray",id});setInspector(true)}}/>
     </div>
     <div className="lektrus-optics-note" role="status">{notice||(
       !doc.elements.length?"1. Выберите «Источник» и поставьте его на лист. 2. Добавьте линзу или зеркало. 3. Нажмите «+ Луч».":
       !source?"Добавьте источник света для построения лучей. Объекты можно перемещать прямо на листе.":
       !doc.rays.length?"Нажмите «+ Луч» над чертежом. Направление можно изменить, выделив луч.":"Выделите луч на чертеже, чтобы изменить его угол и цвет в правой панели.")}</div>
    </div>
    {inspector&&selected&&<aside className="lektrus-optics-inspector" aria-label="Параметры оптического элемента">
     <div className="lektrus-optics-panel-head"><strong>Параметры</strong><button type="button" onClick={()=>setInspector(false)} aria-label="Скрыть параметры">×</button></div>
     {part&&<>
      <strong>{tools.find(t=>t.id===part.kind)?.name??"Оптический элемент"}</strong>
      <label>Подпись<input maxLength={75} value={part.label} placeholder="Необязательно" onChange={e=>updateElement({label:e.target.value})}/></label>
      <div className="lektrus-optics-two">
       <label>X<input type="number" value={part.x} min={20} max={940} onChange={e=>updateElement({x:clamp(Number(e.target.value)||20,20,940)})}/></label>
       <label>Y<input type="number" value={part.y} min={20} max={540} onChange={e=>updateElement({y:clamp(Number(e.target.value)||20,20,540)})}/></label>
      </div>
      {part.kind!=="source"&&part.kind!=="prism"&&<label>Высота элемента
        <input type="range" min={80} max={440} step={10} value={part.length} onChange={e=>updateElement({length:Number(e.target.value)})}/>
        <small>{part.length} ед.</small></label>}
      {(part.kind==="converging-lens"||part.kind==="diverging-lens")&&<label>Фокусное расстояние, ед.
       <input type="number" min={20} max={500} value={part.focalLength} onChange={e=>updateElement({focalLength:clamp(Number(e.target.value)||20,20,500)})}/></label>}
      {(part.kind==="interface"||part.kind==="prism")&&<div className="lektrus-optics-two">
       <label>n₁<input type="number" min={1} max={3} step=".01" value={part.n1} onChange={e=>updateElement({n1:clamp(Number(e.target.value)||1,1,3)})}/></label>
       <label>n₂<input type="number" min={1} max={3} step=".01" value={part.n2} onChange={e=>updateElement({n2:clamp(Number(e.target.value)||1,1,3)})}/></label>
      </div>}
      {part.kind==="source"&&<>
        <div className="lektrus-optics-section">Лучи источника</div>
        <label>Направление нового луча, °<input type="range" min={-85} max={85} value={rayAngle} onChange={e=>setRayAngle(Number(e.target.value))}/>
         <small>{rayAngle}°</small></label>
        <button type="button" className="lektrus-optics-primary" onClick={newRay}>+ Построить луч</button>
        {rays.map((ray,i)=><div className="lektrus-optics-ray-row" key={ray.id}>
         <button type="button" className={selected?.id===ray.id?"active":""} onClick={()=>setSelected({kind:"ray",id:ray.id})}>Луч {i+1}, {ray.angle}°</button>
         <button type="button" aria-label="Удалить луч" onClick={()=>commit({...doc,rays:doc.rays.filter(r=>r.id!==ray.id)})}>×</button>
        </div>)}
      </>}
     </>}
     {chosenRay&&<div className="lektrus-optics-ray-editor">
       <strong>Луч</strong>
       <label>Угол к оси, °<input type="range" min={-85} max={85} value={chosenRay.angle} onChange={e=>commit({...doc,rays:doc.rays.map(r=>r.id===chosenRay.id?{...r,angle:Number(e.target.value)}:r)})}/><small>{chosenRay.angle}°</small></label>
       <label>Цвет луча<input type="color" value={chosenRay.color} onChange={e=>commit({...doc,rays:doc.rays.map(r=>r.id===chosenRay.id?{...r,color:e.target.value}:r)})}/></label>
       <div className="lektrus-optics-ray-steps">
         <strong>Ход луча</strong>
         {pathForSelected?.events?.length?pathForSelected.events.map((event,i)=>
           <div key={i} className="lektrus-optics-ray-step">
             <span>{i+1}</span><text>{event.text}</text>
           </div>):<p>Луч движется по прямой, пока не встретит элемент.</p>}
         <small>{pathForSelected?.note}</small>
       </div>
     </div>}
     <button type="button" className="lektrus-optics-danger" onClick={deleteSelected}>Удалить выбранное</button>
     </aside>}
   </div>
   <footer className="lektrus-optics-footer"><span>Лучи проходят через последовательные линзы и зеркала. Используются учебные приближения тонких линз и преломления.</span>
    <button type="button" onClick={onCancel}>Отмена</button><button type="button" className="lektrus-optics-primary" onClick={()=>onSave(saveValue())}>Сохранить на доску</button>
   </footer>
  </section>
 </div>,document.body);
}
