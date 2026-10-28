import {subjectEditorStyle} from "./lektrusSubjectAccent";
import {mergeEditedValue} from "./lektrusLiveEditorMerge";
import {useEffect,useRef,useState,type PointerEvent as PE} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import LektrusMechanicsView,{mechanicsSvgPoint} from "./LektrusMechanicsView";
import LektrusMechanicsToolIcon from "./LektrusMechanicsToolIcon";
import {emptyMechanics,mechClamp,mechanicsId,mechanicsForceOrigin,mechanicsValid,
 type MechanicsDocument,type MechanicsSelection,type MechanicsTool,type MechanicsBody,type MechanicsSupport,type MechanicsForce} from "./lektrusMechanicsModel";
type Props={item:Item;onSave:(item:Item)=>void;onCancel:()=>void;onClose?:(item:Item)=>void;onLiveChange?:(before:MechanicsDocument,next:MechanicsDocument)=>void;shared?:boolean};
type History={past:MechanicsDocument[];present:MechanicsDocument;future:MechanicsDocument[]};
const tools:{id:MechanicsTool;name:string;hint:string}[]=[
 {id:"select",name:"Выбор",hint:"Выберите и перемещайте детали"},
 {id:"block",name:"Брусок",hint:"Тело прямоугольной формы"},
 {id:"circle",name:"Шар",hint:"Круглое тело"},
 {id:"floor",name:"Плоскость",hint:"Горизонтальная опора"},
 {id:"incline",name:"Наклонная плоскость",hint:"Наклонная опорная поверхность"},
 {id:"pivot",name:"Опора",hint:"Точечная опора"},
 {id:"force",name:"Сила",hint:"Вектор силы: выбирайте тело или точку"}
];
const num=(v:string,fallback:number,low:number,high:number)=>{
 const n=Number(v);return Number.isFinite(n)?mechClamp(n,low,high):fallback;
};
export default function LektrusMechanicsEditor({item,onSave,onCancel,onClose,onLiveChange,shared=false}:Props){
 const [history,setHistory]=useState<History>(()=>({past:[],present:item.scienceMechanics&&mechanicsValid(item.scienceMechanics)?item.scienceMechanics:emptyMechanics(),future:[]}));
 const doc=history.present;
  // The shared object is updated incrementally, while incoming peer edits
  // are rebased by stable component IDs instead of overwriting this draft.
  const livePrevious=useRef<MechanicsDocument>(history.present);
  const remotePrevious=useRef(item.scienceMechanics);
  useEffect(()=>{
    if(doc===livePrevious.current)return;
    const before=livePrevious.current;
    livePrevious.current=doc;
    onLiveChange?.(before,doc);
  },[doc,onLiveChange]);
  useEffect(()=>{
    const remote=item.scienceMechanics;
    if(!remote||remote===remotePrevious.current)return;
    const base=remotePrevious.current;
    remotePrevious.current=remote;
    setHistory(h=>{
      const merged=mergeEditedValue(base??h.present,h.present,remote);
      livePrevious.current=merged;
      return {...h,present:merged};
    });
  },[item.scienceMechanics]);

 const [name,setName]=useState(item.text?.trim()||"Механика");
 const [tool,setTool]=useState<MechanicsTool>("select");
 const [selected,setSelected]=useState<MechanicsSelection>(null);
 const [palette,setPalette]=useState(()=>typeof window==="undefined"||!window.matchMedia("(max-width:760px)").matches);
 const [inspector,setInspector]=useState(true);
 const [cursor,setCursor]=useState<{x:number;y:number}|null>(null);
 const [notice,setNotice]=useState("Добавьте тело, опору или силу на пустое рабочее поле.");
 const [preview,setPreview]=useState<MechanicsDocument|null>(null);
 const drag=useRef<{id:number;selection:NonNullable<MechanicsSelection>;from:{x:number;y:number};start:{x:number;y:number};end:{x:number;y:number};original:MechanicsDocument}|null>(null);
 const selectedBody=selected?.type==="body"?doc.bodies.find(b=>b.id===selected.id):undefined;
 const selectedSupport=selected?.type==="support"?doc.supports.find(s=>s.id===selected.id):undefined;
 const selectedForce=selected?.type==="force"?doc.forces.find(f=>f.id===selected.id):undefined;
 const saveItem=():Item=>({...item,scienceMechanics:doc,graphFigureId:"physics-forces",
   text:name.trim().slice(0,100)||"Механика",graphPurpose:"geometry",graphAxisMode:"none",
   graphPoints:[],graphSegments:[],graphPolygons:[],graphCircles:[],
   graphGrid:false,width:item.scienceMechanics?item.width:850,height:item.scienceMechanics?item.height:525});
 const close=()=>onClose?onClose(saveItem()):onCancel();
 const commit=(next:MechanicsDocument)=>setHistory(h=>({past:[...h.past.slice(-59),h.present],present:next,future:[]}));
 const undo=()=>{setHistory(h=>h.past.length?{past:h.past.slice(0,-1),present:h.past.at(-1)!,future:[h.present,...h.future]}:h);setSelected(null);setPreview(null)};
 const redo=()=>{setHistory(h=>h.future.length?{past:[...h.past,h.present].slice(-60),present:h.future[0],future:h.future.slice(1)}:h);setSelected(null);setPreview(null)};
 const add=(kind:MechanicsTool,x:number,y:number,bodyId?:string)=>{
   const id=mechanicsId();
   if(kind==="select"){setSelected(null);return}
   if(kind==="force"){
     if(doc.forces.length>=180)return;
     const body=bodyId?doc.bodies.find(b=>b.id===bodyId):undefined;
     const f:MechanicsForce={id,bodyId:body?.id??null,x:body?x-body.x:x,y:body?y-body.y:y,
       angle:0,length:105,magnitude:10,label:"F",showValue:false};
     commit({...doc,forces:[...doc.forces,f]});setSelected({type:"force",id});
   }else if(kind==="block"||kind==="circle"){
     if(doc.bodies.length>=60)return;
     const b:MechanicsBody={id,kind,x,y,width:kind==="block"?115:94,
       height:kind==="block"?80:94,mass:1,label:kind==="block"?"Тело":"Шар"};
     commit({...doc,bodies:[...doc.bodies,b]});setSelected({type:"body",id});
   }else {
     if(doc.supports.length>=60)return;
     const s:MechanicsSupport={id,kind,x,y,width:kind==="pivot"?60:240,
       angle:kind==="incline"?25:0,label:""};
     commit({...doc,supports:[...doc.supports,s]});setSelected({type:"support",id});
   }
   setTool("select");setInspector(true);
   setNotice("Перетащите объект для перемещения. Его свойства доступны справа.");
 };
 const place=(x:number,y:number,bodyId?:string)=>add(tool,x,y,bodyId);
 const changeBody=(patch:Partial<MechanicsBody>)=>{
   if(!selectedBody)return;
   commit({...doc,bodies:doc.bodies.map(b=>b.id===selectedBody.id?{...b,...patch}:b)});
 };
 const changeSupport=(patch:Partial<MechanicsSupport>)=>{
   if(!selectedSupport)return;
   commit({...doc,supports:doc.supports.map(s=>s.id===selectedSupport.id?{...s,...patch}:s)});
 };
 const changeForce=(patch:Partial<MechanicsForce>)=>{
   if(!selectedForce)return;
   commit({...doc,forces:doc.forces.map(f=>f.id===selectedForce.id?{...f,...patch}:f)});
 };
 const addBodyForce=(label:string,magnitude:number,angle:number)=>{
   if(!selectedBody||doc.forces.length>=180)return;
   const id=mechanicsId();
   const f:MechanicsForce={id,bodyId:selectedBody.id,x:0,y:0,angle,length:115,
     magnitude,label,showValue:true};
   commit({...doc,forces:[...doc.forces,f]});
   setSelected({type:"force",id});setInspector(true);
 };
 const bodyForces=selectedBody?doc.forces.filter(force=>force.bodyId===selectedBody.id):[];
 const resultX=bodyForces.reduce((sum,force)=>sum+force.magnitude*Math.cos(force.angle*Math.PI/180),0);
 const resultY=bodyForces.reduce((sum,force)=>sum+force.magnitude*Math.sin(force.angle*Math.PI/180),0);
 const resultMagnitude=Math.hypot(resultX,resultY);
 const fixed=(n:number)=>Number(n.toFixed(2)).toLocaleString("ru-RU");
 const remove=()=>{
   if(!selected)return;
   commit({...doc,
     bodies:selected.type==="body"?doc.bodies.filter(b=>b.id!==selected.id):doc.bodies,
     supports:selected.type==="support"?doc.supports.filter(s=>s.id!==selected.id):doc.supports,
     forces:doc.forces.filter(f=>f.id!==selected.id&&!(selected.type==="body"&&f.bodyId===selected.id))});
   setSelected(null);
 };
 const onPartDown=(e:PE<SVGGElement>,which:NonNullable<MechanicsSelection>)=>{
   if(tool==="force"&&which.type==="body"){
     const p=mechanicsSvgPoint(e.clientX,e.clientY,e.currentTarget.ownerSVGElement!);
     place(p.x,p.y,which.id);return;
   }
   if(tool!=="select")return;
   const part=which.type==="body"?doc.bodies.find(b=>b.id===which.id):
     which.type==="support"?doc.supports.find(s=>s.id===which.id):doc.forces.find(f=>f.id===which.id);
   if(!part)return;
   const svg=e.currentTarget.ownerSVGElement;if(!svg)return;
   const from=mechanicsSvgPoint(e.clientX,e.clientY,svg);
   const origin=which.type==="force"?mechanicsForceOrigin(part as MechanicsForce,doc):{x:part.x,y:part.y};
   setSelected(which);setInspector(true);
   drag.current={id:e.pointerId,selection:which,from,start:origin,end:origin,original:doc};
   svg.setPointerCapture(e.pointerId);e.preventDefault();
 };
 const onMove=(e:PE<HTMLDivElement>)=>{
   const svg=e.currentTarget.querySelector("svg");if(!svg)return;
   if(e.pointerType!=="touch"){
     const p=mechanicsSvgPoint(e.clientX,e.clientY,svg);setCursor(p);
   }
   const g=drag.current;if(!g||g.id!==e.pointerId)return;
   const p=mechanicsSvgPoint(e.clientX,e.clientY,svg);
   const dx=p.x-g.from.x,dy=p.y-g.from.y,sel=g.selection;
   const currentDoc=g.original;
   let next:MechanicsDocument=currentDoc;
   if(sel.type==="body")next={...currentDoc,bodies:currentDoc.bodies.map(b=>b.id===sel.id?
     {...b,x:mechClamp(Math.round(g.start.x+dx),20,940),y:mechClamp(Math.round(g.start.y+dy),20,540)}:b)};
   if(sel.type==="support")next={...currentDoc,supports:currentDoc.supports.map(s=>s.id===sel.id?
     {...s,x:mechClamp(Math.round(g.start.x+dx),20,940),y:mechClamp(Math.round(g.start.y+dy),20,540)}:s)};
   if(sel.type==="force"){
     const force=currentDoc.forces.find(f=>f.id===sel.id);
     if(force){
       const origin=mechanicsForceOrigin(force,currentDoc);
       // Dragging a force moves its tip: direction and drawn length update together.
       const tipX=origin.x+force.length*Math.cos(force.angle*Math.PI/180)+dx;
       const tipY=origin.y-force.length*Math.sin(force.angle*Math.PI/180)+dy;
       const vx=tipX-origin.x,vy=tipY-origin.y;
       next={...currentDoc,forces:currentDoc.forces.map(f=>f.id===sel.id?{...f,
         angle:Math.round(Math.atan2(-vy,vx)*180/Math.PI),
         length:mechClamp(Math.round(Math.hypot(vx,vy)),15,400)}:f)};
     }
   }
   g.end={x:p.x,y:p.y};setPreview(next);e.preventDefault();
 };
 const onUp=(e:PE<HTMLDivElement>)=>{
   const g=drag.current;if(!g||g.id!==e.pointerId)return;
   drag.current=null;
   const svg=e.currentTarget.querySelector("svg");
   if(svg?.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);
   if(preview&&Math.hypot(g.end.x-g.from.x,g.end.y-g.from.y)>.5)commit(preview);
   setPreview(null);
 };
 useEffect(()=>{
   const listener=(e:KeyboardEvent)=>{
     if(e.target instanceof HTMLElement&&e.target.closest("input,textarea,select,[contenteditable]"))return;
     const mod=e.ctrlKey||e.metaKey;
     if(mod&&e.key.toLowerCase()==="z"){e.preventDefault();e.stopPropagation();if(e.shiftKey)redo();else undo()}
     else if(mod&&e.key.toLowerCase()==="y"){e.preventDefault();e.stopPropagation();redo()}
     else if(e.key==="Delete"||e.key==="Backspace"){if(selected){e.preventDefault();remove()}}
     else if(e.key==="Escape"){e.stopPropagation();if(tool!=="select")setTool("select");else close()}
   };
   window.addEventListener("keydown",listener,true);return()=>window.removeEventListener("keydown",listener,true);
 });
 return createPortal(<div className="lektrus-mechanics-backdrop" style={subjectEditorStyle("physics")}>
  <section className={"lektrus-mechanics-editor"+(palette?"":" palette-closed")+(selected&&inspector?" inspector-open":"")}
    role="dialog" aria-modal="true" aria-label="Конструктор механики">
   <header className="lektrus-mechanics-header">
     <div className="lektrus-mechanics-heading"><span className="mechanics-logo">F</span><div><small>ФИЗИКА · МЕХАНИКА</small><strong>Конструктор механики</strong></div></div>
     <div className="lektrus-mechanics-header-actions">
       <button type="button" onClick={undo} disabled={!history.past.length} title="Отменить (Ctrl+Z)">↶</button>
       <button type="button" onClick={redo} disabled={!history.future.length} title="Повторить (Ctrl+Y)">↷</button>
       <button type="button" aria-pressed={palette} onClick={()=>setPalette(v=>!v)}>Объекты</button>
       <button type="button" onClick={close} title="Закрыть редактор" aria-label="Закрыть редактор">×</button>
     </div>
   </header>
   <div className="lektrus-mechanics-layout">
     <aside className="lektrus-mechanics-palette">
       <label>Название схемы<input maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
       <strong>Что добавить?</strong>
       <div className="lektrus-mechanics-tools">
         {tools.map(t=><button type="button" title={t.hint} key={t.id}
           className={tool===t.id?"active":""} onClick={()=>{setTool(t.id);setNotice(t.id==="select"?"Выберите объект для редактирования.":"Нажмите на листе, чтобы добавить: "+t.name.toLowerCase())}}>
           <LektrusMechanicsToolIcon type={t.id}/><span>{t.name}</span></button>)}
       </div>
       <strong>Отображение</strong>
       <label className="lektrus-mechanics-check"><input type="checkbox" checked={doc.grid} onChange={e=>commit({...doc,grid:e.target.checked})}/> Точки сетки</label>
       <label className="lektrus-mechanics-check"><input type="checkbox" checked={doc.labels} onChange={e=>commit({...doc,labels:e.target.checked})}/> Названия и величины</label>
       <p>Добавьте тело, плоскость или опору. Выберите инструмент «Сила» и коснитесь тела, чтобы прикрепить вектор. Перетаскивайте детали и регулируйте значения справа.</p>
     </aside>
     <main className="lektrus-mechanics-work">
       <div className="lektrus-mechanics-work-head"><strong>Чертёж</strong>
         <span>{doc.bodies.length} тел · {doc.supports.length} опор · {doc.forces.length} сил</span>
         {selected&&<button type="button" aria-pressed={inspector} onClick={()=>setInspector(x=>!x)}>Свойства</button>}
       </div>
       <div className="lektrus-mechanics-stage" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={()=>setCursor(null)}>
         <LektrusMechanicsView doc={preview??doc} tool={tool} selection={selected} cursor={cursor}
            onPlace={place} onPartDown={onPartDown} onSelect={setSelected}/>
       </div>
       <div className="lektrus-mechanics-hint" role="status">{notice}</div>
     </main>
     {selected&&inspector&&<aside className="lektrus-mechanics-inspector">
       <div className="lektrus-mechanics-inspector-head"><strong>Свойства объекта</strong><button type="button" aria-label="Закрыть свойства" onClick={()=>setInspector(false)}>×</button></div>
       {selectedBody&&<>
         <h3>{selectedBody.kind==="block"?"Брусок":"Шар"}</h3>
         <label>Название<input maxLength={75} value={selectedBody.label} onChange={e=>changeBody({label:e.target.value})}/></label>
         <div className="lektrus-mechanics-field-pair">
           <label>Ширина<input type="number" min="20" max="420" value={selectedBody.width} onChange={e=>changeBody({width:num(e.target.value,100,20,420)})}/></label>
           <label>Высота<input type="number" min="20" max="420" value={selectedBody.height} onChange={e=>changeBody({height:num(e.target.value,80,20,420)})}/></label>
         </div>
         <label>Масса, кг<input type="number" step=".1" min="0" max="10000000" value={selectedBody.mass} onChange={e=>changeBody({mass:num(e.target.value,1,0,1e7)})}/></label>
         <p>Силы, прикреплённые к телу, перемещаются вместе с ним.</p>
         <div className="lektrus-mechanics-inspector-section"><strong>Силы этого тела</strong>
           <div className="lektrus-mechanics-force-presets" role="group" aria-label="Добавить силу к выбранному телу">
             <button type="button" onClick={()=>addBodyForce("F",10,0)}>+ F</button>
             <button type="button" onClick={()=>addBodyForce("mg",selectedBody.mass*9.81,-90)}
               title="Сила тяжести вблизи поверхности Земли: mg, g ≈ 9,81 м/с²">+ mg</button>
             <button type="button" onClick={()=>addBodyForce("N",10,90)}>+ N</button>
           </div>
           {bodyForces.map(force=><button type="button" className="lektrus-mechanics-force-list-item"
             key={force.id} onClick={()=>setSelected({type:"force",id:force.id})}>
             <span>{force.label||"F"}</span><b>{fixed(force.magnitude)} Н</b>
           </button>)}
           {!bodyForces.length&&<small>У этого тела пока нет приложенных сил.</small>}
         </div>
         {!!bodyForces.length&&<div className="lektrus-mechanics-resultant">
           <strong>Равнодействующая ΣF</strong>
           <span>ΣFₓ: <b>{fixed(resultX)} Н</b></span>
           <span>ΣFᵧ: <b>{fixed(resultY)} Н</b></span>
           <span>Модуль: <b>{fixed(resultMagnitude)} Н</b></span>
           <small>По введённым значениям сил, без автоматического учёта реакций и трения.</small>
         </div>}
       </>}
       {selectedSupport&&<>
         <h3>{tools.find(t=>t.id===selectedSupport.kind)?.name}</h3>
         <label>Название<input value={selectedSupport.label} maxLength={75} onChange={e=>changeSupport({label:e.target.value})}/></label>
         {selectedSupport.kind!=="pivot"&&<label>Длина плоскости
           <input type="range" min={60} max={490} step={10} value={selectedSupport.width}
           onChange={e=>changeSupport({width:Number(e.target.value)})}/><small>{selectedSupport.width} ед.</small></label>}
         {selectedSupport.kind==="incline"&&<label>Угол наклона
           <input type="range" min={-75} max={75} value={selectedSupport.angle}
           onChange={e=>changeSupport({angle:Number(e.target.value)})}/><small>{selectedSupport.angle}°</small></label>}
       </>}
       {selectedForce&&<>
         <h3>Вектор силы</h3>
         <label>Обозначение<input maxLength={75} value={selectedForce.label} onChange={e=>changeForce({label:e.target.value})}/></label>
         <label>К чему привязать?
           <select value={selectedForce.bodyId??""} onChange={e=>{
             const origin=mechanicsForceOrigin(selectedForce,doc);
             const body=doc.bodies.find(b=>b.id===e.target.value);
             changeForce({bodyId:body?.id??null,x:body?origin.x-body.x:origin.x,y:body?origin.y-body.y:origin.y});
           }}><option value="">К листу (свободный вектор)</option>{doc.bodies.map((b,i)=><option key={b.id} value={b.id}>{b.label||"Тело "+(i+1)}</option>)}</select>
         </label>
         <label>Угол направления
           <input type="range" min={-180} max={180} value={selectedForce.angle}
             onChange={e=>changeForce({angle:Number(e.target.value)})}/>
           <small>{selectedForce.angle}°</small>
         </label>
         <label>Длина стрелки
           <input type="range" min={15} max={400} value={selectedForce.length}
             onChange={e=>changeForce({length:Number(e.target.value)})}/>
           <small>{selectedForce.length} ед.</small>
         </label>
         <label>Модуль силы, Н<input type="number" min={0} max={1e9} step=".5"
            value={selectedForce.magnitude} onChange={e=>changeForce({magnitude:num(e.target.value,10,0,1e9)})}/></label>
         <label className="lektrus-mechanics-check"><input type="checkbox" checked={selectedForce.showValue}
            onChange={e=>changeForce({showValue:e.target.checked})}/> Показывать значение на схеме</label>
         <p>Длина стрелки и модуль силы задаются независимо. Это удобно для учебных схем, в которых масштаб сил выбран отдельно.</p>
       </>}
       <div className="lektrus-mechanics-field-pair">
         {selected.type!=="force"&&<><label>X<input type="number" min={0} max={960}
           value={selectedBody?.x??selectedSupport?.x??0}
           onChange={e=>selectedBody?changeBody({x:num(e.target.value,480,0,960)}):changeSupport({x:num(e.target.value,480,0,960)})}/></label>
           <label>Y<input type="number" min={0} max={560}
            value={selectedBody?.y??selectedSupport?.y??0}
            onChange={e=>selectedBody?changeBody({y:num(e.target.value,280,0,560)}):changeSupport({y:num(e.target.value,280,0,560)})}/></label></>}
       </div>
       <button type="button" className="lektrus-mechanics-danger" onClick={remove}>Удалить объект</button>
     </aside>}
   </div>
   <footer className="lektrus-mechanics-footer"><span>Редактируемые тела, опоры и силы · новые схемы создаются с чистого листа</span>
    <button type="button" onClick={shared?close:onCancel}>{shared?"Закрыть":"Отмена"}</button>
    <button type="button" className="primary" onClick={()=>onSave(saveItem())}>{shared?"Готово":"Сохранить на доску"}</button>
   </footer>
  </section>
 </div>,document.body);
}
