import {useCallback,useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from "react";
import {createPortal} from "react-dom";
import {applyExtraLayout,getInterfaceElements} from "./lektrusInterfaceTargets";
import {
 applyInterfaceLayout,currentDeviceProfile,deviceProfiles,layoutControls,layoutRegions,
 readInterfaceLayout,publishGlobalInterfaceLayout,loadGlobalInterfaceLayout,type DeviceProfile,type InterfaceLayout,type LayoutControl,type LayoutRegion
} from "./lektrusInterfaceLayout";

/** Edit actual Lektrus board controls. Responsive previews also load the actual
 * BoardApp at the chosen viewport size: never recreate tool icons or panels. */
type Target={kind:"panel";id:LayoutRegion}|{kind:"control";id:LayoutControl}|{kind:"extra";id:string};
type Rectangle={left:number;top:number;width:number;height:number};
type Gesture={
 id:number;x:number;y:number;mode:"drag"|"marquee"|"click"|"resize";
 before:InterfaceLayout;targets:Target[];moved:boolean;
};
const controlSelectors:Record<LayoutControl,string>={
 select:'[data-interface-control="select"]',
 lasso:'[data-interface-control="lasso"]',
 pen:'[data-interface-control="pen"]',
 marker:'[data-interface-control="marker"]',
 eraser:'[data-interface-control="eraser"]',
 subject:".lektrus-desktop-subject-trigger,.lektrus-mobile-subject-trigger",
 zoomOut:".board-controls>button:first-child",
 zoomValue:".board-controls>.zoom-value",
 zoomIn:".board-controls>button:nth-child(3)",
 boardSettings:".topbar-right>.lectris-layout-picker",
 participants:".topbar-right>.presence-menu",
 chat:".topbar-right>.board-chat-button"
};
const panelSelectors:Record<LayoutRegion,string>={
 headerLeft:".topbar>.topbar-left",headerRight:".topbar>.topbar-right",
 toolbar:".workspace .toolbar.compact-toolbar",zoom:".workspace .board-controls",
 mobileTools:".workspace .mobile-board-tools",selection:".workspace .selection-toolbar-screen",
 subjectTools:"#lektrus-subject-tools-panel"
};
const specs:Record<DeviceProfile,{width:number;height:number;label:string}>={
 desktop:{width:1920,height:1080,label:"ПК"},
 laptop:{width:1366,height:768,label:"Ноутбук"},
 tablet:{width:1024,height:768,label:"Планшет"},
 tabletPortrait:{width:768,height:1024,label:"Планшет"},
 phone:{width:844,height:390,label:"Телефон"},
 phonePortrait:{width:390,height:844,label:"Телефон"}
};
const clone=(value:InterfaceLayout):InterfaceLayout=>structuredClone(value);
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const same=(a:Target,b:Target)=>a.kind===b.kind&&a.id===b.id;
const placement=(layout:InterfaceLayout,device:DeviceProfile,target:Target)=>
 target.kind==="panel"?layout.profiles[device][target.id]:target.kind==="control"?
 layout.controls[device][target.id]:(layout.extras[device][target.id]??=
 {x:0,y:0,scale:1});
const rectFromPoints=(ax:number,ay:number,bx:number,by:number):Rectangle=>({
 left:Math.min(ax,bx),top:Math.min(ay,by),
 width:Math.abs(ax-bx),height:Math.abs(ay-by)
});
const intersects=(a:Rectangle,b:Rectangle)=>a.left<b.left+b.width&&a.left+a.width>b.left&&
 a.top<b.top+b.height&&a.top+a.height>b.top;
function applyDraft(layout:InterfaceLayout,device:DeviceProfile,doc:Document){
 const root=doc.documentElement;
 for(const id of layoutRegions){
  const p=layout.profiles[device][id];
  root.style.setProperty("--li-"+id+"-x",p.x+"vw");
  root.style.setProperty("--li-"+id+"-y",p.y+"vh");
  root.style.setProperty("--li-"+id+"-scale",String(p.scale));
 }
 for(const id of layoutControls){
  const p=layout.controls[device][id];
  root.style.setProperty("--li-control-"+id+"-x",p.x+"vw");
  root.style.setProperty("--li-control-"+id+"-y",p.y+"vh");
  root.style.setProperty("--li-control-"+id+"-scale",String(p.scale));
 }
 applyExtraLayout(doc,layout.extras[device],device);
}
export default function LektrusInterfaceStudio({onClose}:{onClose:()=>void}){
 const [device,setDevice]=useState<DeviceProfile>(currentDeviceProfile);
 const [customSizes,setCustomSizes]=useState<Partial<Record<DeviceProfile,{width:number;height:number}>>>({});
 const [frameReady,setFrameReady]=useState(false);
 const [frameError,setFrameError]=useState(false);
 const [frameRetry,setFrameRetry]=useState(0);
 const [configReady,setConfigReady]=useState(false);
 const [interact,setInteract]=useState(false);
 const [layout,setLayout]=useState<InterfaceLayout>(readInterfaceLayout);
 const [selected,setSelected]=useState<Target[]>([]);
 const [marquee,setMarquee]=useState<Rectangle|null>(null);
 const [message,setMessage]=useState("");
 const [showGrid,setShowGrid]=useState(false);
 const [version,setVersion]=useState(0);
 const [viewport,setViewport]=useState({width:window.innerWidth,height:window.innerHeight});
 const frame=useRef<HTMLIFrameElement>(null);
 const actions=useRef<HTMLDivElement>(null);
 const [dockHeight,setDockHeight]=useState(110);
 const gesture=useRef<Gesture|null>(null);
 const latest=useRef(layout);latest.current=layout;
 const past=useRef<InterfaceLayout[]>([]);
 const future=useRef<InterfaceLayout[]>([]);
 const dimensions={...specs[device],...customSizes[device]};
 const availableHeight=Math.max(40,viewport.height-dockHeight-36);
 const fit=Math.max(.01,Math.min(1,(viewport.width-24)/dimensions.width,availableHeight/dimensions.height));
 const frameLeft=(viewport.width-dimensions.width*fit)/2;
 const frameTop=12+(availableHeight-dimensions.height*fit)/2;
 const frameUrl=window.location.pathname+"?layout-editor=1&layout-preview=1&device="+device;
 const activeDocument=()=>{
  try{return frame.current?.contentDocument??null}catch{return null}
 };
 const mapBox=(box:DOMRect):Rectangle=>{
  const element=frame.current;
  if(!element)return {left:0,top:0,width:0,height:0};
  const frameBox=element.getBoundingClientRect();
  const k=frameBox.width/Math.max(element.clientWidth,1);
  return {left:frameBox.left+box.left*k,top:frameBox.top+box.top*k,width:box.width*k,height:box.height*k};
 };
 const candidates=()=>{
  const doc=activeDocument();
  if(!doc||!frameReady||!configReady)return [] as {target:Target;box:Rectangle}[];
  const found:{target:Target;box:Rectangle}[]=[];
  const known=new Set<Element>();
  const add=(target:Target,selector:string)=>{
   for(const node of doc.querySelectorAll<HTMLElement>(selector)){
    const box=node.getBoundingClientRect();
    if(box.width<8||box.height<8||!node.getClientRects().length)continue;
    const style=doc.defaultView?.getComputedStyle(node);
    if(style?.display==="none"||style?.visibility==="hidden")continue;
    known.add(node);
    found.push({target,box:mapBox(box)});
   }
  };
  for(const id of layoutRegions)add({kind:"panel",id},panelSelectors[id]);
  for(const id of layoutControls)add({kind:"control",id},controlSelectors[id]);
  // Enumerate all remaining real controls and UI regions, including mobile
  // toolbar groups and actions not previously known to the editor.
  for(const item of getInterfaceElements(doc)){
   if(known.has(item.node))continue;
   found.push({target:{kind:"extra",id:item.selector},box:mapBox(item.rect)});
  }
  return found;
 };
 const outlines=selected.flatMap(target=>candidates().filter(c=>same(c.target,target)).slice(0,1).map(c=>c.box));
 const apply=(value:InterfaceLayout)=>{
  latest.current=value;setLayout(value);
  const doc=activeDocument();
  if(doc)applyDraft(value,device,doc);
 };
 const record=(before:InterfaceLayout)=>{
  past.current=[...past.current.slice(-49),clone(before)];
  future.current=[];setVersion(v=>v+1);
 };
 const undo=useCallback(()=>{
  const previous=past.current.pop();if(!previous)return;
  future.current=[...future.current.slice(-49),clone(latest.current)];
  apply(previous);setVersion(v=>v+1);
 },[device]);
 const redo=useCallback(()=>{
  const following=future.current.pop();if(!following)return;
  past.current=[...past.current.slice(-49),clone(latest.current)];
  apply(following);setVersion(v=>v+1);
 },[device]);
 useEffect(()=>{
  const resize=()=>{
   setViewport({width:window.innerWidth,height:window.innerHeight});
  };
  window.addEventListener("resize",resize);
  return()=>window.removeEventListener("resize",resize);
 },[]);
 useEffect(()=>{
  const element=actions.current;if(!element)return;
  const observer=new ResizeObserver(()=>setDockHeight(element.getBoundingClientRect().height));
  observer.observe(element);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  let alive=true;
  void loadGlobalInterfaceLayout().then(value=>{
   if(alive){if(value){latest.current=value;setLayout(value)}setConfigReady(true)}
  }).catch(()=>{if(alive)setMessage("Не удалось загрузить общую конфигурацию. Обновите страницу.")});
  return()=>{alive=false};
 },[]);
 useEffect(()=>{
  setFrameReady(false);setFrameError(false);
  const start=Date.now();
  const timer=window.setInterval(()=>{
   const doc=activeDocument();
   if(doc?.querySelector(".workspace .board")&&doc.querySelector(".topbar")){
    applyDraft(latest.current,device,doc);setFrameReady(true);window.clearInterval(timer);
   }else if(Date.now()-start>20_000){setFrameError(true);window.clearInterval(timer)}
  },100);
  return()=>window.clearInterval(timer);
 },[device,frameRetry]);
 useEffect(()=>{
  const doc=activeDocument();if(doc&&frameReady)applyDraft(layout,device,doc);
 },[device,version,layout,frameReady]);
 useEffect(()=>()=>{applyInterfaceLayout()},[]);
 const leave=()=>{
  applyInterfaceLayout();
  onClose();
 };
 const [saving,setSaving]=useState(false);
 const save=async()=>{
  if(saving||!configReady||!frameReady)return;
  setSaving(true);setMessage("");
  try{await publishGlobalInterfaceLayout(latest.current);onClose()}
  catch{setMessage("Не удалось опубликовать дизайн. Проверьте подключение и права администратора.")}
  finally{setSaving(false)}
 };
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{
   if(event.target instanceof HTMLInputElement)return;
   const ctrl=event.ctrlKey||event.metaKey;
   if(ctrl&&event.code==="KeyZ"){
    event.preventDefault();event.stopImmediatePropagation();
    if(event.shiftKey)redo();else undo();return;
   }
   if(ctrl&&event.code==="KeyY"){
    event.preventDefault();event.stopImmediatePropagation();redo();return;
   }
   if(event.key==="Escape"){event.preventDefault();event.stopImmediatePropagation();setSelected([]);setMarquee(null);return}
   if(selected.length&&["Equal","Minus","NumpadAdd","NumpadSubtract"].includes(event.code)){
    event.preventDefault();event.stopImmediatePropagation();
    const before=clone(latest.current),next=clone(before);
    for(const target of selected){
     const p=placement(next,device,target);
     p.scale=clamp(Math.round((p.scale+(event.code==="Minus"||event.code==="NumpadSubtract"?-.05:.05))*100)/100,.65,1.45);
    }
    record(before);apply(next);return;
   }
   if(!ctrl&&!event.altKey&&/^(Key|Digit|Arrow|Delete|Backspace)/.test(event.code)){
    event.preventDefault();event.stopImmediatePropagation();
   }
  };
  window.addEventListener("keydown",onKey,true);
  return()=>window.removeEventListener("keydown",onKey,true);
 },[selected,device,undo,redo]);
 const pointerDown=(event:ReactPointerEvent<HTMLDivElement>)=>{
  if(event.button!==0||!frameReady||!configReady)return;
  const targets=candidates().filter(c=>{
   const r=c.box;
   return event.clientX>=r.left&&event.clientX<=r.left+r.width&&event.clientY>=r.top&&event.clientY<=r.top+r.height;
  }).sort((a,b)=>a.box.width*a.box.height-b.box.width*b.box.height);
  // When a selected panel contains buttons, dragging any point inside that
  // panel moves the selected group, not just the button under the pointer.
  const alreadySelected=targets.find(c=>selected.some(t=>same(t,c.target)));
  const hit=alreadySelected??
   (event.shiftKey?targets.find(c=>c.target.kind==="panel"):
    targets.find(c=>c.target.kind==="extra"||c.target.kind==="control"))??targets[0];
  const resizeHit=selected.length>0&&outlines.some(box=>
   Math.abs(event.clientX-(box.left+box.width))<=15&&
   Math.abs(event.clientY-(box.top+box.height))<=15);
  const additive=event.ctrlKey||event.metaKey;
  if(resizeHit){
   gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,before:clone(latest.current),
    mode:"resize",targets:selected,moved:false};
   event.preventDefault();event.stopPropagation();
   event.currentTarget.setPointerCapture(event.pointerId);return;
  }
  if(!hit){
   if(!additive)setSelected([]);
   gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,before:clone(latest.current),
    mode:"marquee",targets:[],moved:false};
   setMarquee({left:event.clientX,top:event.clientY,width:0,height:0});
  }else if(additive){
   setSelected(current=>current.some(x=>same(x,hit.target))?current.filter(x=>!same(x,hit.target)):[...current,hit.target]);
   gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,before:clone(latest.current),
    mode:"click",targets:[],moved:false};
  }else{
   const group=selected.some(x=>same(x,hit.target))?selected:[hit.target];
   setSelected(group);
   gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,before:clone(latest.current),
    mode:"drag",targets:group,moved:false};
  }
  setMessage("");
  event.preventDefault();event.stopPropagation();
  event.currentTarget.setPointerCapture(event.pointerId);
 };
 const pointerMove=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const current=gesture.current;
  if(!current||current.id!==event.pointerId)return;
  const dx=event.clientX-current.x,dy=event.clientY-current.y;
  if(Math.hypot(dx,dy)>2)current.moved=true;
  if(current.mode==="marquee"){
   setMarquee(rectFromPoints(current.x,current.y,event.clientX,event.clientY));return;
  }
  if((current.mode!=="drag"&&current.mode!=="resize")||!current.moved)return;
  const next=clone(current.before);
  if(current.mode==="resize"){
   const change=(dx+dy)/(250*fit);
   for(const target of current.targets){
    const p=placement(next,device,target),before=placement(current.before,device,target);
    p.scale=clamp(Math.round((before.scale+change)*100)/100,.65,1.45);
   }
   apply(next);return;
  }
  const viewWidth=dimensions.width*fit;
  const viewHeight=dimensions.height*fit;
  const step=showGrid?16*fit:0;
  const moveX=step?Math.round(dx/step)*step:dx;
  const moveY=step?Math.round(dy/step)*step:dy;
  for(const target of current.targets){
   const p=placement(next,device,target);
   p.x=clamp(Math.round((p.x+moveX/Math.max(viewWidth,1)*100)*10)/10,-100,100);
   p.y=clamp(Math.round((p.y+moveY/Math.max(viewHeight,1)*100)*10)/10,-100,100);
  }
  apply(next);
 };
 const pointerUp=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const current=gesture.current;
  if(!current||current.id!==event.pointerId)return;
  if(current.mode==="marquee"){
   const area=rectFromPoints(current.x,current.y,event.clientX,event.clientY);
   if(area.width>5&&area.height>5){
    const intersected=candidates().filter(c=>intersects(area,c.box)&&
     c.box.left+c.box.width/2>=area.left&&
     c.box.left+c.box.width/2<=area.left+area.width&&
     c.box.top+c.box.height/2>=area.top&&
     c.box.top+c.box.height/2<=area.top+area.height);
    // Prefer the smallest real UI pieces inside the marquee. Selecting the
    // whole toolbar as an ancestor would otherwise exclude every button.
    const leaves=intersected.filter(item=>!intersected.some(other=>
     !same(item.target,other.target)&&
     item.box.width*item.box.height>other.box.width*other.box.height*1.05&&
     other.box.left>=item.box.left-2&&other.box.top>=item.box.top-2&&
     other.box.left+other.box.width<=item.box.left+item.box.width+2&&
     other.box.top+other.box.height<=item.box.top+item.box.height+2));
    const unique=leaves.filter((item,index,all)=>all.findIndex(x=>
     same(item.target,x.target)||
     (Math.abs(item.box.left-x.box.left)<2&&Math.abs(item.box.top-x.box.top)<2&&
      Math.abs(item.box.width-x.box.width)<2&&Math.abs(item.box.height-x.box.height)<2))===index)
     .map(item=>item.target);
    setSelected(selectedNow=>event.ctrlKey||event.metaKey?
     [...selectedNow,...unique.filter(x=>!selectedNow.some(y=>same(x,y)))]:unique);
   }
   setMarquee(null);
  }else if((current.mode==="drag"||current.mode==="resize")&&current.moved){
   record(current.before);
  }
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  gesture.current=null;
 };
 const changingDevice=(value:DeviceProfile)=>{
  if(gesture.current)return;
  if(value===device)return;
  setFrameReady(false);setFrameError(false);setInteract(false);setDevice(value);setSelected([]);setMarquee(null);
 };
 const baseDevice=device==="phonePortrait"?"phone":device==="tabletPortrait"?"tablet":device;
 const touch=baseDevice==="phone"||baseDevice==="tablet";
 const resizeDimension=(key:"width"|"height",value:number)=>{
  if(!Number.isFinite(value)||value<240||value>3840)return;
  setCustomSizes(previous=>({...previous,[device]:{width:dimensions.width,height:dimensions.height,[key]:value}}));
  setSelected([]);
 };
 return createPortal(<div className="lektrus-live-layout-editor" role="application" aria-label="Редактирование интерфейса Lectrus">
  <div className="lektrus-layout-device-backdrop">
   <iframe key={device+":"+frameRetry} ref={frame} title={"Настоящая доска Lectrus: "+dimensions.label} src={frameUrl}
    className="lektrus-layout-device-frame"
    style={{width:dimensions.width,height:dimensions.height,
     left:frameLeft,top:frameTop,
     pointerEvents:interact?"auto":"none",visibility:frameReady?"visible":"hidden",transform:`scale(${fit})`}}/>
  </div>
  {!frameReady&&<div className="lektrus-layout-preview-status" role="status">
   {frameError?<><span>Не удалось загрузить доску в предпросмотре.</span><button onClick={()=>{setFrameError(false);setFrameRetry(v=>v+1)}}>Повторить</button></>:<span>Загрузка настоящей доски…</span>}
  </div>}
  {showGrid&&<div className="lektrus-layout-alignment-grid" aria-hidden="true"
   style={{width:dimensions.width*fit,height:dimensions.height*fit,
    left:frameLeft,top:frameTop,backgroundSize:`${16*fit}px ${16*fit}px`}}/>}
  <div className="lektrus-live-layout-hit-area" style={{pointerEvents:interact?"none":"auto"}} onPointerDown={pointerDown} onPointerMove={pointerMove}
   onPointerUp={pointerUp} onPointerCancel={pointerUp}
   onClickCapture={event=>{event.preventDefault();event.stopPropagation()}}
   onContextMenu={event=>event.preventDefault()} onWheelCapture={event=>event.preventDefault()}
   title="Протяните прямоугольник по пустому месту для выделения нескольких панелей. Затем перетащите группу."/>
  {outlines.map((rect,index)=><div key={index} className="lektrus-live-layout-outline" aria-hidden="true"
   style={{left:rect.left,top:rect.top,width:rect.width,height:rect.height}}>
   <span className="lektrus-layout-resize-grip"/>
  </div>)}
  {marquee&&<div className="lektrus-live-layout-marquee" aria-hidden="true" style={marquee}/>}
  <div ref={actions} className="lektrus-live-layout-actions">
   <div className="lektrus-live-layout-device-switch" role="group" aria-label="Версия интерфейса">
    {deviceProfiles.map(id=><button key={id} type="button" className={baseDevice===id?"is-active":""}
     aria-pressed={baseDevice===id} onClick={()=>changingDevice(id==="phone"?"phonePortrait":id)}>{specs[id].label}</button>)}
   </div>
   {touch&&<button type="button" onClick={()=>changingDevice(device.endsWith("Portrait")?baseDevice:baseDevice==="phone"?"phonePortrait":"tabletPortrait")}>↻ Повернуть</button>}
   <label className="lektrus-layout-size"><span>Размер (CSS px)</span>
    <input key={device+"w"} type="number" min={240} max={3840} aria-label="Ширина предпросмотра" defaultValue={dimensions.width} onBlur={e=>resizeDimension("width",Number(e.target.value))}/>
    ×
    <input key={device+"h"} type="number" min={240} max={3840} aria-label="Высота предпросмотра" defaultValue={dimensions.height} onBlur={e=>resizeDimension("height",Number(e.target.value))}/>
    <span>{Math.round(fit*100)}%</span>
   </label>
   <button type="button" className={showGrid?"is-active":""} aria-pressed={showGrid}
    onClick={()=>setShowGrid(v=>!v)} title="Сетка и привязка элементов с шагом 16 пикселей">▦ Сетка</button>
   <button type="button" className={interact?"is-active":""} aria-pressed={interact}
    disabled={!frameReady} onClick={()=>{setInteract(v=>!v);setSelected([]);setVersion(v=>v+1)}}>{interact?"Вернуться к настройке":"Проверить кнопки"}</button>
   <span className="lektrus-live-layout-actions-divider"/>
   <button type="button" onClick={undo} disabled={!past.current.length} title="Отменить последнее изменение (Ctrl+Z)">↶ Отменить</button>
   <button type="button" onClick={redo} disabled={!future.current.length} title="Вернуть отменённое (Ctrl+Y)">↷ Вернуть</button>
   <span className="lektrus-live-layout-actions-divider"/>
   <button type="button" onClick={leave}>Выход</button>
   <button type="button" className="primary" onClick={()=>void save()} disabled={saving||!configReady||!frameReady}>{saving?"Публикуем…":"Опубликовать для всех"}</button>
  </div>
  {message&&<div role="status" className="lektrus-live-layout-status">{message}</div>}
 </div>,document.body);
}
