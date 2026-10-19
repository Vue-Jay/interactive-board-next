import {useRef,useState,type PointerEvent,type ReactNode} from "react";
import {createPortal} from "react-dom";
import {
 currentDeviceProfile,defaultInterfaceLayout,deviceProfiles,layoutRegions,layoutRegionNames,
 normalizeInterfaceLayout,readInterfaceLayout,readInterfaceTemplates,saveInterfaceLayout,
 saveInterfaceTemplates,type DeviceProfile,type InterfaceLayout,type LayoutRegion,type NamedInterfaceLayout
} from "./lektrusInterfaceLayout";

const starts:Record<LayoutRegion,{x:number;y:number}>={
 headerLeft:{x:3,y:5},headerRight:{x:69,y:5},toolbar:{x:3,y:21},
 zoom:{x:4,y:87},mobileTools:{x:31,y:88},selection:{x:34,y:72},subjectTools:{x:69,y:27}
};
const labels:Record<DeviceProfile,string>={
 desktop:"ПК · 1200+ px",laptop:"Ноутбук · 901–1199 px",
 tablet:"Планшет · 601–900 px",phone:"Телефон · до 600 px"
};

const previewGlyphs:Record<string,ReactNode>={
 select:<path d="M4.5 3.5 18.8 11.4l-6.5 1.2-2.7 6.1L4.5 3.5Z"/>,
 lasso:<><path strokeDasharray="3 2" d="M18.5 9c0 3.5-3.5 6-7.5 6S3.5 13.5 3.5 11s3.5-6 8-6 7 1.5 7 4Z"/><path d="M12 15c0 3 2 4 5 3"/></>,
 pen:<><path d="M4 20l4.8-1.2 10-10a2.2 2.2 0 0 0-3.2-3.2l-10 10L4 20Z"/><path d="m13.5 8 3 3"/></>,
 marker:<><path d="m4.5 15.6 9.9-10a2 2 0 0 1 2.8 0l2 2a2 2 0 0 1 0 2.8L9.3 20H4.5Z"/><path d="M3 21h12"/></>,
 eraser:<><path d="m4 12 8-8a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-7 7H9l-5-4a2 2 0 0 1 0-3Z"/><path d="m9 8 7 7M12 19h9"/></>,
 connector:<><path d="M4 12h16m-5-5 5 5-5 5"/></>,
 text:<><path d="M4 5h16M7 5v3m10-3v3M12 6v13M8 19h8"/></>,
 shape:<><rect x="3" y="4" width="9" height="9" rx="1"/><circle cx="17" cy="9" r="4"/><path d="m9 21 4-6 4 6Z"/></>,
 media:<><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="2"/><path d="m4 17 5-5 4 4 3-3 4 4"/></>,
 subject:<><path d="M3 5.5Q8 4 12 7q4-3 9-1.5v13q-5-1.5-9 1.5-4-3-9-1.5Z"/><path d="M12 7v13M6 10h3m6 0h3"/></>,
 table:<><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 10h16M10 4v16"/></>,
 comment:<><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3V6a2 2 0 0 1 1-2Z"/><path d="M8 9h9M8 13h6"/></>,
 zoom:<><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/></>,
 settings:<><circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2.4 2.4m9.2 9.2L19 19M19 5l-2.4 2.4M7.4 16.6 5 19"/></>,
 more:<><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
 undo:<path d="M8 7 4 11l4 4M5 11h8a6 6 0 0 1 6 6"/>,
 redo:<path d="m16 7 4 4-4 4M19 11h-8a6 6 0 0 0-6 6"/>,
 lock:<><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
};
function PreviewGlyph({name}:{name:string}){
 return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{previewGlyphs[name]??previewGlyphs.shape}</svg>;
}
const previewToolIds=["select","lasso","pen","marker","eraser","connector","text","shape","table","media","subject","comment","more","settings"] as const;
const previewOrigin:Record<DeviceProfile,Record<LayoutRegion,{x:number;y:number}>>={
 desktop:{
  headerLeft:{x:1,y:0},headerRight:{x:71,y:0},toolbar:{x:1,y:11},
  zoom:{x:2,y:90},mobileTools:{x:28,y:90},selection:{x:40,y:78},subjectTools:{x:7,y:55}},
 laptop:{
  headerLeft:{x:1,y:0},headerRight:{x:65,y:0},toolbar:{x:1,y:12},
  zoom:{x:2,y:89},mobileTools:{x:28,y:90},selection:{x:32,y:78},subjectTools:{x:8,y:56}},
 tablet:{
  headerLeft:{x:1,y:0},headerRight:{x:64,y:0},toolbar:{x:1,y:11},
  zoom:{x:2,y:87},mobileTools:{x:25,y:91},selection:{x:35,y:76},subjectTools:{x:8,y:56}},
 phone:{
  headerLeft:{x:1,y:0},headerRight:{x:59,y:0},toolbar:{x:1,y:13},
  zoom:{x:2,y:81},mobileTools:{x:18,y:90},selection:{x:28,y:72},subjectTools:{x:8,y:55}}
};

const copy=(v:InterfaceLayout):InterfaceLayout=>structuredClone(v);
export default function LektrusInterfaceStudio({onClose}:{onClose?:()=>void}={}){
 const [device,setDevice]=useState<DeviceProfile>(currentDeviceProfile);
 const [layout,setLayout]=useState<InterfaceLayout>(readInterfaceLayout);
 const [selected,setSelected]=useState<LayoutRegion>("toolbar");
 const [past,setPast]=useState<InterfaceLayout[]>([]);
 const [future,setFuture]=useState<InterfaceLayout[]>([]);
 const [templates,setTemplates]=useState<NamedInterfaceLayout[]>(readInterfaceTemplates);
 const [name,setName]=useState("");
 const [notice,setNotice]=useState("");
 const [dirty,setDirty]=useState(false);
 const input=useRef<HTMLInputElement>(null);
 const drag=useRef<{pointer:number;region:LayoutRegion;x:number;y:number;before:InterfaceLayout;width:number;height:number}|null>(null);
 const moving=useRef<InterfaceLayout|null>(null);
 const placement=layout.profiles[device][selected];
 const update=(next:InterfaceLayout,before=layout)=>{
  setPast(list=>[...list.slice(-29),copy(before)]);
  setFuture([]);
  setLayout(next);setDirty(true);
 };
 const patch=(region:LayoutRegion,values:Partial<{x:number;y:number;scale:number}>)=>{
  const next=copy(layout);
  next.profiles[device][region]={...next.profiles[device][region],...values};
  update(normalizeInterfaceLayout(next));
 };
 const undo=()=>{const prev=past[past.length-1];if(!prev)return;setPast(x=>x.slice(0,-1));setFuture(x=>[...x.slice(-29),copy(layout)]);setLayout(copy(prev));setDirty(true)};
 const redo=()=>{const next=future[future.length-1];if(!next)return;setFuture(x=>x.slice(0,-1));setPast(x=>[...x.slice(-29),copy(layout)]);setLayout(copy(next));setDirty(true)};
 const beginDrag=(event:PointerEvent<HTMLDivElement>,region:LayoutRegion)=>{
  if(event.button!==0)return;
  const stage=event.currentTarget.closest(".li-studio-stage");
  if(!(stage instanceof HTMLElement))return;
  const rect=stage.getBoundingClientRect();
  setSelected(region);
  drag.current={pointer:event.pointerId,region,x:event.clientX,y:event.clientY,
   before:copy(layout),width:Math.max(1,rect.width),height:Math.max(1,rect.height)};
  moving.current=null;
  event.currentTarget.setPointerCapture(event.pointerId);
  event.preventDefault();
 };
 const moveDrag=(event:PointerEvent<HTMLButtonElement>)=>{
  const data=drag.current;if(!data||data.pointer!==event.pointerId)return;
  const next=copy(data.before);
  const old=next.profiles[device][data.region];
  next.profiles[device][data.region]={
   ...old,x:Math.max(-45,Math.min(45,Math.round((old.x+(event.clientX-data.x)/data.width*100)*10)/10)),
   y:Math.max(-45,Math.min(45,Math.round((old.y+(event.clientY-data.y)/data.height*100)*10)/10))
  };
  moving.current=next;
  setLayout(next);setDirty(true);
 };
 const endDrag=(event:PointerEvent<HTMLButtonElement>)=>{
  const data=drag.current;if(!data||data.pointer!==event.pointerId)return;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  if(moving.current&&JSON.stringify(moving.current)!==JSON.stringify(data.before)){
   setPast(v=>[...v.slice(-29),data.before]);setFuture([]);
  }
  drag.current=null;moving.current=null;
 };
 const apply=()=>{
  try{saveInterfaceLayout(layout);setDirty(false);setNotice("Макеты всех устройств сохранены и применены в этом браузере.")}
  catch{setNotice("Не удалось сохранить макеты в памяти браузера.")}
 };
 const resetDevice=()=>{const next=copy(layout);next.profiles[device]=defaultInterfaceLayout().profiles[device];update(next)};
 const createTemplate=()=>{
  const clean=name.trim().slice(0,60);
  if(!clean){setNotice("Введите название шаблона.");return;}
  const next=[...templates.slice(-29),{id:crypto.randomUUID(),name:clean,layout:copy(layout)}];
  saveInterfaceTemplates(next);setTemplates(next);setName("");setNotice("Шаблон сохранён для всех четырёх разрешений.");
 };
 const exportLayout=()=>{
  const data=JSON.stringify({kind:"lektrus-interface-layout",layout,templates},null,2);
  const url=URL.createObjectURL(new Blob([data],{type:"application/json"}));
  const anchor=document.createElement("a");anchor.href=url;anchor.download="lektrus-interface-layout.json";anchor.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1500);
 };
 const importLayout=async(file:File)=>{
  try{
   if(file.size>300000)throw Error("Файл слишком большой");
   const value=JSON.parse(await file.text());
   if(value?.kind!=="lektrus-interface-layout"||value.layout?.version!==1)throw Error("Неверный формат шаблона Lectrus");
   update(normalizeInterfaceLayout(value.layout));
   if(Array.isArray(value.templates)){
    const imported=value.templates.filter((x:unknown)=>x!==null&&typeof x==="object"&&typeof (x as {name?:unknown}).name==="string")
      .slice(-30).map((x:{name:string;id?:string;layout?:unknown})=>({
       id:typeof x.id==="string"?x.id.slice(0,100):crypto.randomUUID(),
       name:x.name.slice(0,60),layout:normalizeInterfaceLayout(x.layout)
      }));
    setTemplates(imported);saveInterfaceTemplates(imported);
   }
   setNotice("Макеты загружены. Нажмите «Применить», чтобы активировать.");
  }catch(error){setNotice(error instanceof Error?error.message:"Не удалось прочитать файл")}
 };
 const loadTemplate=(template:NamedInterfaceLayout)=>{update(copy(template.layout));setNotice("Шаблон открыт для редактирования. Примените его, когда будете готовы.")};
 const discard=()=>{setLayout(readInterfaceLayout());setPast([]);setFuture([]);setDirty(false);setNotice("Несохранённые изменения отменены.")};

 const [templatesOpen,setTemplatesOpen]=useState(false);
 const preview=(region:LayoutRegion,body:ReactNode,extraClass="")=>{
  if(region==="mobileTools" && device!=="phone"&&device!=="tablet")return null;
  const p=layout.profiles[device][region],base=previewOrigin[device][region];
  const style={left:`${base.x+p.x}%`,top:`${base.y+p.y}%`,scale:String(p.scale)} as const;
  return <div key={region} role="button" tabIndex={0}
   data-region={region} aria-label={"Переместить "+layoutRegionNames[region]}
   title={layoutRegionNames[region]+" · перетащить"}
   className={"li-preview-region li-preview-"+region+" "+extraClass+(selected===region?" active":"")}
   style={style}
   onPointerDown={e=>beginDrag(e,region)} onPointerMove={moveDrag}
   onPointerUp={endDrag} onPointerCancel={endDrag}
   onKeyDown={e=>{
    const delta=e.shiftKey?5:1;
    if(e.key==="ArrowLeft"||e.key==="ArrowRight"||e.key==="ArrowUp"||e.key==="ArrowDown"){
     e.preventDefault();setSelected(region);
     if(e.key==="ArrowLeft")patch(region,{x:p.x-delta});
     if(e.key==="ArrowRight")patch(region,{x:p.x+delta});
     if(e.key==="ArrowUp")patch(region,{y:p.y-delta});
     if(e.key==="ArrowDown")patch(region,{y:p.y+delta});
    }else if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelected(region)}
   }}>
   {body}
  </div>;
 };
 const compact=device==="phone"||device==="tablet";
 const stage=<div className={"li-studio-stage li-stage-"+device} aria-label="Редактируемый интерфейс доски Lectrus">
  <div className="li-mock-surface" aria-hidden="true"/>
  <div className="li-mock-board-label" aria-hidden="true">Макет доски · инструменты отключены</div>
  <div className="li-mock-header-bg"/>
  {preview("headerLeft",<div className="li-mock-top-left">
   <span className="li-mock-back">← Доски</span>
   <strong>{compact?"Доска":"Новая доска"}</strong>
   {!compact&&<span className="li-mock-subject">Предмет&nbsp; <b>Химия⌄</b></span>}
  </div>)}
  {preview("headerRight",<div className="li-mock-top-right">
   <span><PreviewGlyph name="settings"/></span>
   <span className="li-mock-online">● 1</span>
   <span><PreviewGlyph name="comment"/></span>
   <span><PreviewGlyph name="more"/></span>
  </div>)}
  {preview("toolbar",<div className="li-mock-toolbar">
   {previewToolIds.filter(id=>id!=="subject").map((id,i)=>
    <span key={id} className={i===0?"chosen":""}><PreviewGlyph name={id}/></span>)}
  </div>)}
  {preview("subjectTools",<div className="li-mock-subject-button">
   <PreviewGlyph name="subject"/>
  </div>)}
  {preview("zoom",<div className="li-mock-zoom">
   <span><PreviewGlyph name="zoom"/></span><span>78%</span><span>⊕</span><span>▦</span>
  </div>)}
  {preview("mobileTools",<div className="li-mock-mobile-dock">
   {["select","pen","marker","eraser","subject","more"].map(id=><span key={id}><PreviewGlyph name={id}/></span>)}
  </div>)}
  {preview("selection",<div className="li-mock-selection">
   <span><PreviewGlyph name="undo"/></span><span><PreviewGlyph name="redo"/></span>
   <span>▱</span><span><PreviewGlyph name="lock"/></span><span><PreviewGlyph name="more"/></span>
  </div>)}
  <div className="li-mock-minimap" aria-hidden="true"><small>НАВИГАЦИЯ</small><div/></div>
  <div className="li-mock-status" aria-hidden="true">Сейчас: Выбрать · ЛКМ — выделение областью</div>
  <span className="li-mock-editor-watermark" aria-hidden="true">РЕДАКТОР ИНТЕРФЕЙСА</span>
 </div>;
 const interfacePage=<div className="li-editor-fullscreen" role="dialog" aria-modal="true" aria-label="Визуальный конструктор интерфейса Lectrus">
  <div className="li-editor-top">
   <div className="li-editor-top-start">
    <button type="button" className="li-editor-back" onClick={onClose}>← Администрирование</button>
    <strong>Редактор интерфейса</strong><span className="li-editor-hint">Перетаскивайте панели прямо на доске</span>
   </div>
   <div className="li-editor-actions">
    <button type="button" onClick={undo} disabled={!past.length} title="Отменить">↶</button>
    <button type="button" onClick={redo} disabled={!future.length} title="Вернуть">↷</button>
    <button type="button" onClick={discard} title="Вернуть сохранённую раскладку">Сброс</button>
    <button type="button" onClick={()=>setTemplatesOpen(v=>!v)} aria-pressed={templatesOpen}>Шаблоны</button>
    <button type="button" className="li-editor-save" onClick={apply}>{dirty?"Сохранить":"Сохранено"}</button>
   </div>
  </div>
  <div className="li-editor-body">
   <div className="li-editor-canvas">
    <nav className="li-editor-devices" aria-label="Разрешение доски">
     {deviceProfiles.map(id=><button key={id} type="button" className={device===id?"active":""}
      aria-pressed={device===id} onClick={()=>{setDevice(id);setSelected("toolbar")}}>{labels[id]}</button>)}
    </nav>
    <div className="li-editor-board-container">{stage}</div>
    <p className="li-editor-canvas-note">Это внешний вид доски. Рисование, добавление и удаление объектов здесь отключены. Выделите панель и перетащите её на новое место.</p>
   </div>
   <aside className="li-editor-sidebar">
    <div className="li-editor-sidebar-head"><strong>Параметры интерфейса</strong><small>{labels[device]}</small></div>
    <label>Элемент
     <select value={selected} onChange={e=>setSelected(e.target.value as LayoutRegion)}
      aria-label="Редактируемый элемент">{layoutRegions.map(id=><option key={id} value={id}>{layoutRegionNames[id]}</option>)}</select>
    </label>
    <label>Горизонталь <output>{placement.x}%</output>
     <input type="range" min="-45" max="45" step=".5" value={placement.x} onChange={e=>patch(selected,{x:Number(e.target.value)})}/>
    </label>
    <label>Вертикаль <output>{placement.y}%</output>
     <input type="range" min="-45" max="45" step=".5" value={placement.y} onChange={e=>patch(selected,{y:Number(e.target.value)})}/>
    </label>
    <label>Размер <output>{Math.round(placement.scale*100)}%</output>
     <input type="range" min="65" max="145" step="5" value={Math.round(placement.scale*100)}
      onChange={e=>patch(selected,{scale:Number(e.target.value)/100})}/>
    </label>
    <div className="li-editor-reset-row"><button type="button" onClick={()=>patch(selected,{x:0,y:0,scale:1})}>Сбросить элемент</button>
     <button type="button" onClick={resetDevice}>Сбросить устройство</button></div>
    <p>Каждое разрешение сохраняется отдельно. Перемещаются сами панели, не содержимое урока.</p>
    {notice&&<div className="li-editor-notice" role="status">{notice}</div>}
   </aside>
  </div>
  {templatesOpen&&<div className="li-editor-templates" role="dialog" aria-label="Сохранённые шаблоны интерфейса">
   <header><strong>Шаблоны раскладки</strong><button type="button" onClick={()=>setTemplatesOpen(false)} aria-label="Закрыть шаблоны">×</button></header>
   <p>Шаблон включает все четыре профиля устройств. Настройки сохраняются в браузере, а JSON можно перенести на другой компьютер.</p>
   <div className="li-editor-template-create">
    <input aria-label="Название шаблона" value={name} onChange={e=>setName(e.target.value)} placeholder="Название шаблона" maxLength={60}/>
    <button type="button" onClick={createTemplate}>+ Создать</button>
   </div>
   {templates.map(template=><div className="li-editor-template-row" key={template.id}>
    <strong>{template.name}</strong>
    <button onClick={()=>{loadTemplate(template);setTemplatesOpen(false)}}>Применить</button>
    <button title="Удалить шаблон" onClick={()=>{const remaining=templates.filter(t=>t.id!==template.id);setTemplates(remaining);saveInterfaceTemplates(remaining)}}>×</button>
   </div>)}
   <div className="li-editor-template-create">
    <button type="button" onClick={exportLayout}>Экспорт JSON</button>
    <button type="button" onClick={()=>input.current?.click()}>Импорт JSON</button>
    <input ref={input} type="file" hidden accept=".json,application/json" onChange={e=>{
     const file=e.target.files?.[0];e.target.value="";if(file)void importLayout(file);
    }}/>
   </div>
  </div>}
 </div>;
 return createPortal(interfacePage,document.body);
}
