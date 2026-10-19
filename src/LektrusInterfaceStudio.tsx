import {useRef,useState,type PointerEvent} from "react";
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
const copy=(v:InterfaceLayout):InterfaceLayout=>structuredClone(v);
export default function LektrusInterfaceStudio(){
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
 const beginDrag=(event:PointerEvent<HTMLButtonElement>,region:LayoutRegion)=>{
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
 return <div className="li-studio">
  <div className="li-studio-intro"><div><h2>Конструктор интерфейса доски</h2>
   <p>Перетаскивайте панели в макете, меняйте масштаб и сохраняйте варианты для разных устройств. Макеты меняют только интерфейс, не объекты на доске.</p></div>
   <span className="li-studio-local">Локальные настройки · перенос между устройствами через JSON</span></div>
  <nav className="li-studio-devices" aria-label="Профиль устройства">
   {deviceProfiles.map(id=><button key={id} type="button" aria-pressed={device===id}
    className={device===id?"active":""} onClick={()=>{setDevice(id);setSelected("toolbar")}}>{labels[id]}</button>)}
  </nav>
  <div className="li-studio-workspace">
   <div className="li-studio-stage-wrapper">
    <div className={"li-studio-stage li-stage-"+device} aria-label="Интерактивный макет интерфейса">
     <div className="li-stage-board"><span>Доска Lectrus</span><small>Перетаскивайте блоки</small></div>
     {layoutRegions.map(region=>{
      const p=layout.profiles[device][region],start=starts[region];
      return <button key={region} type="button" className={"li-stage-panel "+(region===selected?"active":"")}
       title={layoutRegionNames[region]} aria-label={"Переместить "+layoutRegionNames[region]}
       style={{left:(start.x+p.x)+"%",top:(start.y+p.y)+"%",scale:String(p.scale)}}
       onPointerDown={e=>beginDrag(e,region)} onPointerMove={moveDrag} onPointerUp={endDrag}
       onPointerCancel={endDrag}>{region==="toolbar"?"✎  ▧  ◯":region==="zoom"?"−  100%  +":region==="mobileTools"?"◁  ✎  +":region==="selection"?"↶  ↷  ⋯":region==="subjectTools"?"⚗  ∑  ▱":region==="headerLeft"?"← Доски   Lectrus":"⚙  ♧  ⋯"}<small>{layoutRegionNames[region]}</small></button>;
     })}
    </div>
    <small>Рамка предварительного просмотра показывает расположение групп, а не реальный масштаб элементов. Внешний вид применится к доске после сохранения.</small>
   </div>
   <aside className="li-studio-inspector">
    <h3>Выбранная панель</h3>
    <select value={selected} onChange={e=>setSelected(e.target.value as LayoutRegion)}
     aria-label="Выбрать панель">{layoutRegions.map(id=><option key={id} value={id}>{layoutRegionNames[id]}</option>)}</select>
    <label>Сдвиг по горизонтали <span>{placement.x}% экрана</span>
     <input type="range" min="-45" max="45" step=".5" value={placement.x} onChange={e=>patch(selected,{x:Number(e.target.value)})}/></label>
    <label>Сдвиг по вертикали <span>{placement.y}% экрана</span>
     <input type="range" min="-45" max="45" step=".5" value={placement.y} onChange={e=>patch(selected,{y:Number(e.target.value)})}/></label>
    <label>Размер панели <span>{Math.round(placement.scale*100)}%</span>
     <input type="range" min="65" max="145" step="5" value={Math.round(placement.scale*100)}
      onChange={e=>patch(selected,{scale:Number(e.target.value)/100})}/></label>
    <div className="li-studio-inspector-actions"><button onClick={()=>patch(selected,{x:0,y:0,scale:1})}>Сбросить панель</button>
     <button onClick={resetDevice}>Сбросить устройство</button></div>
    <p>Профили переключаются автоматически по ширине экрана и типу указателя. Изменения в одном профиле не затрагивают остальные.</p>
   </aside>
  </div>
  <div className="li-studio-bar">
   <button type="button" disabled={!past.length} onClick={undo}>↶ Отменить</button>
   <button type="button" disabled={!future.length} onClick={redo}>↷ Вернуть</button>
   <button type="button" onClick={discard}>Откатить к сохранённому</button>
   <button type="button" className="students-primary" onClick={apply}>{dirty?"Применить изменения":"Сохранить макеты"}</button>
  </div>
  <div className="li-studio-templates">
   <div><h3>Шаблоны и перенос настроек</h3>
    <p>Шаблон содержит сразу четыре версии: ПК, ноутбук, планшет и телефон.</p></div>
   <div className="li-studio-template-actions">
    <input value={name} onChange={e=>setName(e.target.value)} placeholder="Название нового шаблона" maxLength={60} aria-label="Название шаблона"/>
    <button type="button" onClick={createTemplate}>Сохранить шаблон</button>
    <button type="button" onClick={exportLayout}>Экспорт JSON</button>
    <button type="button" onClick={()=>input.current?.click()}>Импорт JSON</button>
    <input ref={input} type="file" hidden accept=".json,application/json" onChange={e=>{
     const file=e.target.files?.[0];e.target.value="";if(file)void importLayout(file);
    }}/>
   </div>
   {templates.length>0&&<div className="li-studio-template-list">{templates.map(template=>
    <div key={template.id}><strong>{template.name}</strong><button onClick={()=>loadTemplate(template)}>Загрузить</button>
     <button aria-label={"Удалить "+template.name} onClick={()=>{const remaining=templates.filter(t=>t.id!==template.id);setTemplates(remaining);saveInterfaceTemplates(remaining)}}>×</button></div>)}</div>}
  </div>
  {notice&&<p className="li-studio-notice" role="status">{notice}</p>}
 </div>;
}
