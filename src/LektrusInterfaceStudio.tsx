import {useEffect,useRef,useState,type PointerEvent} from "react";
import {
 currentDeviceProfile,defaultInterfaceLayout,deviceProfiles,layoutRegions,layoutRegionNames,
 layoutControls,layoutControlNames,normalizeInterfaceLayout,readInterfaceLayout,
 readInterfaceTemplates,saveInterfaceLayout,saveInterfaceTemplates,
 type DeviceProfile,type InterfaceLayout,type LayoutRegion,type LayoutControl,type NamedInterfaceLayout
} from "./lektrusInterfaceLayout";

type Target={kind:"panel";id:LayoutRegion}|{kind:"button";id:LayoutControl};
type Pos={x:number;y:number;scale:number};
const starts:Record<LayoutRegion,{x:number;y:number}>={
 headerLeft:{x:1,y:1},headerRight:{x:72,y:1},toolbar:{x:1.1,y:11},
 zoom:{x:2.4,y:89},mobileTools:{x:28,y:89},selection:{x:37,y:73},subjectTools:{x:10,y:25}
};
const deviceNames:Record<DeviceProfile,string>={
 desktop:"ПК",laptop:"Ноутбук",tablet:"Планшет",phone:"Телефон"
};
const copy=(value:InterfaceLayout):InterfaceLayout=>structuredClone(value);
const clamp=(value:number,low:number,high:number)=>Math.max(low,Math.min(high,value));
const formValue=(value:number)=>Math.round(value*10)/10;

function StudioIcon({name}:{name:LayoutControl|"more"|"grid"|"settings"|"hand"|"text"|"image"|"geometry"|"table"|"shapes"|"line"|"atom"|"plus"|"undo"|"search"|"share"}){
 const paths:Record<string,string>={
 select:"m5 3 14 9-7 1-2 7-5-17Z",lasso:"M19 8c-3-5-14-5-15 1s14 8 15 0M10 19q4 3 8 0",
 pen:"M4 20l4-1 11-12-4-4L4 15v5Zm9-14 4 4",
 marker:"m4 16 8-11 6 5-8 11H4v-5Zm9 4h8",
 eraser:"m4 15 9-11 8 8-7 8H9l-5-5Zm5 5h12",
 subject:"M3 5c4-2 7-1 9 1 3-2 6-3 9-1v14c-3-2-6-1-9 1-3-2-6-3-9-1V5Zm9 1v14",
 zoomOut:"M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM17 17l5 5M7 11h8",
 zoomIn:"M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM17 17l5 5M7 11h8m-4-4v8",
 boardSettings:"M12 3l2 2 3-1 2 3-2 3v4l2 2-2 4-3-1-2 2-2-2-3 1-2-4 2-2v-4l-2-3 2-3 3 1 2-2ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
 participants:"M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-2c0-3 3-5 7-5s7 2 7 5v2M19 8v7m-3-4h6",
 chat:"M4 4h16v12H9l-5 4V4Zm3 4h10M7 12h7",
 more:"M5 12h.1M12 12h.1M19 12h.1",
 grid:"M4 4h16v16H4V4Zm8 0v16M4 12h16",
 hand:"M5 11v-1a2 2 0 0 1 4 0V5a2 2 0 0 1 4 0v3a2 2 0 0 1 4 0v3a2 2 0 0 1 4 0v4c0 5-3 7-8 7h-3l-6-6a2 2 0 0 1 1-5",
 text:"M4 5h16M12 5v15M8 20h8",
 image:"M3 4h18v16H3V4Zm2 13 5-5 3 3 3-5 4 7M8 9h1",
 geometry:"M4 20h16L12 5 4 20Zm8-7h5",
 table:"M4 4h16v16H4V4Zm0 5h16M4 14h16M11 4v16",
 shapes:"M5 5h8v8H5V5Zm9 7a6 6 0 1 0 0 12",
 line:"M4 19 20 5",
 atom:"M12 12a1 1 0 1 0 0 .1M3 12c0-6 18-6 18 0S3 18 3 12Zm5-8c-5 3 4 18 8 16S13 1 8 4Z",
 plus:"M12 4v16M4 12h16",
 undo:"M10 5 4 11l6 6M4 11h10a6 6 0 0 1 6 6",
 search:"M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM17 17l5 5",
 share:"M12 5v14M5 12h14"
 };
 if(name==="zoomValue")return <span className="li-board-zoom-number">100%</span>;
 return <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"
  fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
  <path d={paths[name]??paths.more}/>
 </svg>;
}

export default function LektrusInterfaceStudio({onClose}:{onClose?:()=>void}){
 const [device,setDevice]=useState<DeviceProfile>(currentDeviceProfile);
 const [layout,setLayout]=useState<InterfaceLayout>(readInterfaceLayout);
 const [selected,setSelected]=useState<Target>({kind:"panel",id:"toolbar"});
 const [past,setPast]=useState<InterfaceLayout[]>([]);
 const [future,setFuture]=useState<InterfaceLayout[]>([]);
 const [templates,setTemplates]=useState<NamedInterfaceLayout[]>(readInterfaceTemplates);
 const [name,setName]=useState("");
 const [notice,setNotice]=useState("");
 const [dirty,setDirty]=useState(false);
 const [showTemplates,setShowTemplates]=useState(false);
 const [demoSelection,setDemoSelection]=useState(true);
 const input=useRef<HTMLInputElement>(null);
 const stage=useRef<HTMLDivElement>(null);
 const [stageSize,setStageSize]=useState({width:900,height:540});
 const drag=useRef<{pointer:number;target:Target;x:number;y:number;before:InterfaceLayout;width:number;height:number}|null>(null);
 const moving=useRef<InterfaceLayout|null>(null);
 useEffect(()=>{
  const element=stage.current;if(!element)return;
  const update=()=>{const r=element.getBoundingClientRect();setStageSize({width:r.width||900,height:r.height||540})};
  update();
  if(typeof ResizeObserver==="undefined"){window.addEventListener("resize",update);return()=>window.removeEventListener("resize",update)}
  const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect();
 },[device]);
 const position=(source:InterfaceLayout,target:Target):Pos=>target.kind==="panel"?
  source.profiles[device][target.id]:source.controls[device][target.id];
 const selectedPosition=position(layout,selected);
 const update=(next:InterfaceLayout,before=layout)=>{
  setPast(prev=>[...prev.slice(-39),copy(before)]);setFuture([]);
  setLayout(normalizeInterfaceLayout(next));setDirty(true);
 };
 const patch=(changes:Partial<Pos>)=>{
  const next=copy(layout);
  const current=position(next,selected);
  Object.assign(current,changes);
  update(next);
 };
 const undo=()=>{const previous=past.at(-1);if(!previous)return;
  setPast(p=>p.slice(0,-1));setFuture(f=>[...f.slice(-39),copy(layout)]);setLayout(copy(previous));setDirty(true)};
 const redo=()=>{const next=future.at(-1);if(!next)return;
  setFuture(f=>f.slice(0,-1));setPast(p=>[...p.slice(-39),copy(layout)]);setLayout(copy(next));setDirty(true)};
 const startDrag=(event:PointerEvent<HTMLElement>,target:Target)=>{
  if(event.button!==0)return;
  const rect=stage.current?.getBoundingClientRect();if(!rect)return;
  setSelected(target);
  drag.current={pointer:event.pointerId,target,x:event.clientX,y:event.clientY,before:copy(layout),
   width:Math.max(1,rect.width),height:Math.max(1,rect.height)};
  moving.current=null;event.currentTarget.setPointerCapture(event.pointerId);
  event.stopPropagation();event.preventDefault();
 };
 const moveDrag=(event:PointerEvent<HTMLElement>)=>{
  const data=drag.current;if(!data||data.pointer!==event.pointerId)return;
  const next=copy(data.before);const old=position(next,data.target);
  old.x=clamp(formValue(old.x+(event.clientX-data.x)/data.width*100),-45,45);
  old.y=clamp(formValue(old.y+(event.clientY-data.y)/data.height*100),-45,45);
  moving.current=next;setLayout(next);setDirty(true);
  event.stopPropagation();
 };
 const endDrag=(event:PointerEvent<HTMLElement>)=>{
  const data=drag.current;if(!data||data.pointer!==event.pointerId)return;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  if(moving.current&&JSON.stringify(moving.current)!==JSON.stringify(data.before)){
   setPast(p=>[...p.slice(-39),data.before]);setFuture([]);
  }
  drag.current=null;moving.current=null;event.stopPropagation();
 };
 const dragHandlers=(target:Target)=>({
  onPointerDown:(event:PointerEvent<HTMLElement>)=>startDrag(event,target),
  onPointerMove:moveDrag,
  onPointerUp:endDrag,
  onPointerCancel:endDrag,
  onKeyDown:(event:React.KeyboardEvent<HTMLElement>)=>{
   if(event.key==="Enter"||event.key===" "){event.preventDefault();setSelected(target)}
  }
 });
 const region=(id:LayoutRegion,children:React.ReactNode,className:string)=>{
  const p=layout.profiles[device][id],start=starts[id];
  return <div key={id} role="button" tabIndex={0} aria-label={"Переместить панель: "+layoutRegionNames[id]}
   className={"li-stage-region "+className+(selected.kind==="panel"&&selected.id===id?" is-selected":"")}
   style={{left:(start.x+p.x)+"%",top:(start.y+p.y)+"%",scale:String(p.scale)}} {...dragHandlers({kind:"panel",id})}>
   {children}
  </div>;
 };
 const control=(id:LayoutControl,icon:LayoutControl|"more"|"grid"|"settings"|"hand"|"text"|"image"|"geometry"|"table"|"shapes"|"line"|"atom"|"plus"|"undo"|"search"|"share"=id)=>{
  const p=layout.controls[device][id];
  const isCurrent=selected.kind==="button"&&selected.id===id;
  return <span key={id} role="button" tabIndex={0} aria-label={"Переместить кнопку: "+layoutControlNames[id]}
   title={layoutControlNames[id]}
   className={"li-board-button li-board-button-"+id+(isCurrent?" is-selected":"")+(id==="select"?" is-default-tool":"")}
   style={{translate:(p.x*stageSize.width/100)+"px "+(p.y*stageSize.height/100)+"px",scale:String(p.scale)}}
   {...dragHandlers({kind:"button",id})}><StudioIcon name={icon}/></span>;
 };
 const buttonPreview=[control("select"),control("lasso"),control("pen"),control("marker"),control("eraser")];
 const apply=()=>{try{saveInterfaceLayout(layout);setDirty(false);setNotice("Макеты применены к доске в этом браузере.")}
  catch{setNotice("Не удалось сохранить макеты в браузере.")}};
 const resetDevice=()=>{const next=copy(layout),defaults=defaultInterfaceLayout();
  next.profiles[device]=defaults.profiles[device];next.controls[device]=defaults.controls[device];update(next)};
 const resetSelected=()=>patch({x:0,y:0,scale:1});
 const createTemplate=()=>{
  const clean=name.trim().slice(0,60);if(!clean){setNotice("Введите название шаблона.");return}
  const list=[...templates.slice(-29),{id:crypto.randomUUID(),name:clean,layout:copy(layout)}];
  setTemplates(list);saveInterfaceTemplates(list);setName("");setNotice("Шаблон сохранён со всеми версиями устройств.");
 };
 const exportLayout=()=>{
  const json=JSON.stringify({kind:"lektrus-interface-layout",layout,templates},null,2);
  const url=URL.createObjectURL(new Blob([json],{type:"application/json"}));
  const link=document.createElement("a");link.href=url;link.download="lektrus-interface-layout.json";link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const importLayout=async(file:File)=>{
  try{
   if(file.size>300000)throw Error("Слишком большой файл");
   const data=JSON.parse(await file.text());
   if(data?.kind!=="lektrus-interface-layout"||data.layout?.version!==1)throw Error("Неверный формат JSON");
   update(normalizeInterfaceLayout(data.layout));
   if(Array.isArray(data.templates)){
    const next=data.templates.filter((x:unknown)=>x!==null&&typeof x==="object"&&typeof (x as {name?:unknown}).name==="string")
     .slice(-30).map((x:{id?:string;name:string;layout?:unknown})=>({id:String(x.id??crypto.randomUUID()),name:x.name.slice(0,60),layout:normalizeInterfaceLayout(x.layout)}));
    setTemplates(next);saveInterfaceTemplates(next);
   }
   setNotice("Макет загружен. Нажмите «Применить», чтобы использовать его.");
  }catch(error){setNotice(error instanceof Error?error.message:"Ошибка импорта")}
 };
 const activeDevice=device==="phone"||device==="tablet";
 return <section className="li-studio" aria-label="Редактор интерфейса Lectrus">
  <header className="li-studio-editor-bar">
   <button type="button" className="li-studio-close" onClick={onClose}>← Администрирование</button>
   <div className="li-studio-editor-title"><strong>Lectrus · Редактор интерфейса</strong><small>Только оформление и расположение. Доска не изменяется.</small></div>
   <nav className="li-studio-devices" aria-label="Профиль экрана">
    {deviceProfiles.map(id=><button key={id} type="button" className={device===id?"active":""}
     aria-pressed={device===id} onClick={()=>setDevice(id)}>{deviceNames[id]}</button>)}
   </nav>
   <div className="li-studio-top-actions">
    <button type="button" onClick={undo} disabled={!past.length} title="Отменить">↶</button>
    <button type="button" onClick={redo} disabled={!future.length} title="Повторить">↷</button>
    <button type="button" onClick={()=>setShowTemplates(v=>!v)} aria-expanded={showTemplates}>Шаблоны</button>
    <button type="button" className="li-studio-apply" onClick={apply}>{dirty?"Применить":"Сохранено"}</button>
   </div>
  </header>
  <div className="li-studio-workspace">
   <div className="li-studio-stage-wrapper">
    <div ref={stage} className={"li-studio-stage li-stage-"+device} aria-label="Макет настоящей доски Lectrus. Нажмите или перетащите любую панель либо кнопку.">
     <div className="li-stage-surface"/>
     <div className="li-board-example li-board-plot" aria-hidden="true">
      <svg viewBox="0 0 205 172" width="100%" height="100%" preserveAspectRatio="none">
       {Array.from({length:11},(_,i)=><g key={i} stroke="#c9d9ed" strokeWidth=".7">
        <path d={`M${i*20} 0V172`}/><path d={`M0 ${i*18}H205`}/>
       </g>)}
       <path d="M10 152H196l-8-5m8 5-8 5M36 161V8l-5 9m5-9 5 9" stroke="#6383b7" fill="none" strokeWidth="1.6"/>
       <path d="M36 150 80 98 122 105 170 40" stroke="#3d66cf" strokeWidth="2.5" fill="none"/>
       <circle cx="170" cy="40" r="3" fill="#3d66cf"/>
      </svg>
     </div>
     <div className="li-board-example li-board-chem" aria-hidden="true"><b>CH₃ – CH₂ – OH</b><small>Органическая структура</small></div>
     <div className="li-board-example li-board-figure" aria-hidden="true">
      <svg viewBox="0 0 235 160" width="100%" height="100%">
       <path d="M10 146 65 29 207 109Z" stroke="#5472d5" strokeWidth="2.8" fill="#6a91fa15"/>
       <path d="M10 146 148 138 207 109" stroke="#7b94dd" fill="none" strokeDasharray="7 5"/>
       <circle cx="10" cy="146" r="3" fill="#3763ce"/><circle cx="65" cy="29" r="3" fill="#3763ce"/><circle cx="207" cy="109" r="3" fill="#3763ce"/>
      </svg>
     </div>
     {demoSelection&&<div className="li-stage-demo-selection" aria-hidden="true"><i/><i/><i/><i/></div>}
     {region("headerLeft",<div className="li-board-header-left">
      <span className="li-board-nav-back">← Доски</span>
      <strong>Новая доска</strong>
      <span className="li-board-subject-select"><small>Предмет</small><b>Химия ﹀</b></span>
     </div>,"li-stage-header-left")}
     {region("headerRight",<div className="li-board-header-right">
      {control("boardSettings")}<span className="li-board-online">● <b>1</b></span>
      {control("participants")}{control("chat")}<span className="li-board-header-more"><StudioIcon name="more"/></span>
     </div>,"li-stage-header-right")}
     {region("toolbar",<div className="li-board-toolbar">
      {buttonPreview}<span className="li-board-tool-separator"/>
      {(["geometry","text","shapes","table","image","atom"] as const).map(id=>
       <span className="li-board-tool-decor" key={id}><StudioIcon name={id}/></span>)}
      {control("subject")}<span className="li-board-tool-decor"><StudioIcon name="more"/></span>
     </div>,"li-stage-toolbar")}
     {region("zoom",<div className="li-board-zoom">
      {control("zoomOut")}{control("zoomValue")}{control("zoomIn")}
      <span className="li-board-divider"/><span className="li-board-tool-decor"><StudioIcon name="grid"/></span>
     </div>,"li-stage-zoom")}
     {region("mobileTools",<div className="li-board-mobile-tools">
       <span className="li-board-tool-decor"><StudioIcon name="hand"/></span>
       <span className="li-board-tool-decor"><StudioIcon name="pen"/></span>
       <span className="li-board-tool-decor"><StudioIcon name="eraser"/></span>
       <span className="li-board-tool-decor"><StudioIcon name="subject"/></span>
       <span className="li-board-tool-decor"><StudioIcon name="plus"/></span>
     </div>,"li-stage-mobile-tools"+(!activeDevice?" li-stage-dimmed":""))}
     {region("selection",<div className="li-board-selection">
      <span>Выделение</span><span className="li-board-tool-decor"><StudioIcon name="undo"/></span>
      <span>Цвет ●</span><span>Толщина ▬</span><span className="li-board-tool-decor"><StudioIcon name="more"/></span>
     </div>,"li-stage-selection")}
     {region("subjectTools",<div className="li-board-subject-panel">
      <b>Предметные инструменты</b><span>∑ Математика</span><span>⚗ Химия</span><span>◉ Физика</span>
     </div>,"li-stage-subject-tools")}
     <div className="li-board-minimap" aria-hidden="true"><small>НАВИГАЦИЯ</small><div><span/></div></div>
     <div className="li-board-status" aria-hidden="true">Сейчас: Выбрать · ЛКМ — выделение области</div>
     <span className="li-stage-preview-label">РЕДАКТОР ИНТЕРФЕЙСА · КНОПКИ ДОСКИ НЕАКТИВНЫ</span>
    </div>
    <div className="li-stage-hint">Перетаскивайте кнопки и панели прямо на макете. Нажмите на элемент, чтобы изменить положение и размер точнее.</div>
   </div>
   <aside className="li-studio-inspector" aria-label="Свойства элемента интерфейса">
    <div className="li-studio-inspector-head"><span>НАСТРОЙКА ИНТЕРФЕЙСА</span><strong>Свойства элемента</strong></div>
    <div className="li-studio-kind-tabs">
     <button type="button" className={selected.kind==="panel"?"active":""} onClick={()=>setSelected({kind:"panel",id:"toolbar"})}>Панели</button>
     <button type="button" className={selected.kind==="button"?"active":""} onClick={()=>setSelected({kind:"button",id:"select"})}>Кнопки</button>
    </div>
    <select aria-label="Выбрать элемент интерфейса"
     value={selected.id} onChange={e=>setSelected(selected.kind==="panel"?
      {kind:"panel",id:e.target.value as LayoutRegion}:{kind:"button",id:e.target.value as LayoutControl})}>
     {(selected.kind==="panel"?layoutRegions:layoutControls).map(id=><option key={id} value={id}>
      {selected.kind==="panel"?layoutRegionNames[id as LayoutRegion]:layoutControlNames[id as LayoutControl]}
     </option>)}
    </select>
    <div className="li-studio-inspector-sliders">
     <label>Горизонтальное положение <b>{formValue(selectedPosition.x)}%</b>
      <input type="range" min="-45" max="45" step=".5" value={selectedPosition.x} onChange={e=>patch({x:Number(e.target.value)})}/>
     </label>
     <label>Вертикальное положение <b>{formValue(selectedPosition.y)}%</b>
      <input type="range" min="-45" max="45" step=".5" value={selectedPosition.y} onChange={e=>patch({y:Number(e.target.value)})}/>
     </label>
     <label>Размер элемента <b>{Math.round(selectedPosition.scale*100)}%</b>
      <input type="range" min="65" max="145" step="5" value={Math.round(selectedPosition.scale*100)}
       onChange={e=>patch({scale:Number(e.target.value)/100})}/>
     </label>
    </div>
    <div className="li-studio-inspector-actions">
     <button type="button" onClick={resetSelected}>Сбросить элемент</button>
     <button type="button" onClick={resetDevice}>Сбросить {deviceNames[device].toLowerCase()}</button>
    </div>
    <div className="li-studio-detail-tip"><strong>{deviceNames[device]} · отдельный макет</strong>
     <p>Вы редактируете только интерфейс. Рисунки, задания, масштаб самой доски и данные учеников не изменяются.</p>
     <label><input type="checkbox" checked={demoSelection} onChange={e=>setDemoSelection(e.target.checked)}/> Показать пример выделенного объекта</label>
    </div>
    {notice&&<p className="li-studio-notice" role="status">{notice}</p>}
   </aside>
  </div>
  {showTemplates&&<section className="li-studio-templates" aria-label="Шаблоны интерфейса">
   <div><h3>Шаблоны и резервные копии</h3><p>В шаблоне сохраняются панели и отдельные кнопки для всех четырёх устройств.</p></div>
   <div className="li-studio-template-actions">
    <input value={name} onChange={e=>setName(e.target.value)} placeholder="Название шаблона" maxLength={60}/>
    <button onClick={createTemplate} type="button">Сохранить шаблон</button>
    <button onClick={exportLayout} type="button">Экспорт JSON</button>
    <button onClick={()=>input.current?.click()} type="button">Импорт JSON</button>
    <input ref={input} type="file" hidden accept=".json,application/json"
     onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void importLayout(file)}}/>
    <button type="button" onClick={()=>{setLayout(readInterfaceLayout());setPast([]);setFuture([]);setDirty(false)}}>Откатить к сохранённому</button>
   </div>
   {templates.length>0&&<div className="li-studio-template-list">{templates.map(template=>
    <div key={template.id}><b>{template.name}</b>
     <button onClick={()=>{update(copy(template.layout));setNotice("Шаблон открыт. Примените его для использования.")}}>Загрузить</button>
     <button aria-label={"Удалить "+template.name} onClick={()=>{const next=templates.filter(t=>t.id!==template.id);setTemplates(next);saveInterfaceTemplates(next)}}>×</button>
    </div>)}</div>}
  </section>}
 </section>;
}
