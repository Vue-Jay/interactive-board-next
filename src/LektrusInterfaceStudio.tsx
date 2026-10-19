import {useCallback,useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from "react";
import {createPortal} from "react-dom";
import {
 applyInterfaceLayout,currentDeviceProfile,deviceProfiles,layoutControls,layoutRegions,
 readInterfaceLayout,saveInterfaceLayout,type DeviceProfile,type InterfaceLayout,type LayoutControl,type LayoutRegion
} from "./lektrusInterfaceLayout";

/** Edit actual Lektrus board controls. Responsive previews also load the actual
 * BoardApp at the chosen viewport size: never recreate tool icons or panels. */
type Target={kind:"panel";id:LayoutRegion}|{kind:"control";id:LayoutControl};
type Rectangle={left:number;top:number;width:number;height:number};
type Gesture={
 id:number;x:number;y:number;mode:"drag"|"marquee"|"click";
 before:InterfaceLayout;targets:Target[];moved:boolean;
};
const controlSelectors:Record<LayoutControl,string>={
 select:".toolbar-pinned>.tool-button:nth-child(1),.mobile-tool-cluster-navigation>button:first-child",
 lasso:".toolbar-pinned>.tool-button:nth-child(2)",
 pen:".toolbar-pinned>.tool-button:nth-child(3)",
 marker:".toolbar-pinned>.tool-button:nth-child(4)",
 eraser:".toolbar-pinned>.tool-button:nth-child(5)",
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
 desktop:{width:1440,height:900,label:"ПК"},
 laptop:{width:1100,height:720,label:"Ноутбук"},
 tablet:{width:820,height:600,label:"Планшет"},
 phone:{width:560,height:320,label:"Телефон"}
};
const clone=(value:InterfaceLayout):InterfaceLayout=>structuredClone(value);
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const same=(a:Target,b:Target)=>a.kind===b.kind&&a.id===b.id;
const placement=(layout:InterfaceLayout,device:DeviceProfile,target:Target)=>
 target.kind==="panel"?layout.profiles[device][target.id]:layout.controls[device][target.id];
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
}
export default function LektrusInterfaceStudio({onClose}:{onClose:()=>void}){
 const [nativeDevice,setNativeDevice]=useState<DeviceProfile>(currentDeviceProfile);
 const [device,setDevice]=useState<DeviceProfile>(currentDeviceProfile);
 const [layout,setLayout]=useState<InterfaceLayout>(readInterfaceLayout);
 const [selected,setSelected]=useState<Target[]>([]);
 const [marquee,setMarquee]=useState<Rectangle|null>(null);
 const [message,setMessage]=useState("");
 const [version,setVersion]=useState(0);
 const [viewport,setViewport]=useState({width:window.innerWidth,height:window.innerHeight});
 const frame=useRef<HTMLIFrameElement>(null);
 const gesture=useRef<Gesture|null>(null);
 const latest=useRef(layout);latest.current=layout;
 const past=useRef<InterfaceLayout[]>([]);
 const future=useRef<InterfaceLayout[]>([]);
 const alternate=device!==nativeDevice;
 const dimensions=specs[device];
 const fit=Math.min((viewport.width-12)/dimensions.width,(viewport.height-70)/dimensions.height,2.2);
 const frameUrl=window.location.pathname+"?layout-editor=1&layout-preview=1";
 const activeDocument=()=>{
  if(!alternate)return document;
  try{return frame.current?.contentDocument??null}catch{return null}
 };
 const mapBox=(box:DOMRect):Rectangle=>{
  if(!alternate)return {left:box.left,top:box.top,width:box.width,height:box.height};
  const element=frame.current;
  if(!element)return {left:0,top:0,width:0,height:0};
  const frameBox=element.getBoundingClientRect();
  const k=frameBox.width/Math.max(element.clientWidth,1);
  return {left:frameBox.left+box.left*k,top:frameBox.top+box.top*k,width:box.width*k,height:box.height*k};
 };
 const candidates=()=>{
  const doc=activeDocument();
  if(!doc)return [] as {target:Target;box:Rectangle}[];
  const found:{target:Target;box:Rectangle}[]=[];
  const add=(target:Target,selector:string)=>{
   for(const node of doc.querySelectorAll<HTMLElement>(selector)){
    const box=node.getBoundingClientRect();
    if(box.width<8||box.height<8||!node.getClientRects().length)continue;
    const style=doc.defaultView?.getComputedStyle(node);
    if(style?.display==="none"||style?.visibility==="hidden")continue;
    found.push({target,box:mapBox(box)});
   }
  };
  for(const id of layoutRegions)add({kind:"panel",id},panelSelectors[id]);
  for(const id of layoutControls)add({kind:"control",id},controlSelectors[id]);
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
 },[device,nativeDevice]);
 const redo=useCallback(()=>{
  const following=future.current.pop();if(!following)return;
  past.current=[...past.current.slice(-49),clone(latest.current)];
  apply(following);setVersion(v=>v+1);
 },[device,nativeDevice]);
 useEffect(()=>{
  const resize=()=>{
   setNativeDevice(currentDeviceProfile());
   setViewport({width:window.innerWidth,height:window.innerHeight});
  };
  window.addEventListener("resize",resize);
  return()=>window.removeEventListener("resize",resize);
 },[]);
 useEffect(()=>{
  const doc=activeDocument();
  if(doc)applyDraft(latest.current,device,doc);
  // When returning from a breakpoint preview, update the original viewport too.
  if(!alternate)applyDraft(latest.current,device,document);
 },[device,nativeDevice,alternate,version]);
 useEffect(()=>()=>{applyInterfaceLayout()},[]);
 const leave=()=>{
  applyInterfaceLayout();
  onClose();
 };
 const save=()=>{
  try{saveInterfaceLayout(latest.current);onClose()}
  catch{setMessage("Не удалось сохранить изменения интерфейса")}
 };
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{
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
  if(event.button!==0)return;
  const targets=candidates().filter(c=>{
   const r=c.box;
   return event.clientX>=r.left&&event.clientX<=r.left+r.width&&event.clientY>=r.top&&event.clientY<=r.top+r.height;
  }).sort((a,b)=>a.box.width*a.box.height-b.box.width*b.box.height);
  // When a selected panel contains buttons, dragging any point inside that
  // panel moves the selected group, not just the button under the pointer.
  const alreadySelected=targets.find(c=>selected.some(t=>same(t,c.target)));
  const hit=alreadySelected??
   (event.shiftKey?targets.find(c=>c.target.kind==="panel"):targets.find(c=>c.target.kind==="control"))??targets[0];
  const additive=event.ctrlKey||event.metaKey;
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
  if(current.mode!=="drag"||!current.moved)return;
  const next=clone(current.before);
  const viewWidth=alternate?dimensions.width*fit:viewport.width;
  const viewHeight=alternate?dimensions.height*fit:viewport.height;
  for(const target of current.targets){
   const p=placement(next,device,target);
   p.x=clamp(Math.round((p.x+dx/Math.max(viewWidth,1)*100)*10)/10,-45,45);
   p.y=clamp(Math.round((p.y+dy/Math.max(viewHeight,1)*100)*10)/10,-45,45);
  }
  apply(next);
 };
 const pointerUp=(event:ReactPointerEvent<HTMLDivElement>)=>{
  const current=gesture.current;
  if(!current||current.id!==event.pointerId)return;
  if(current.mode==="marquee"){
   const area=rectFromPoints(current.x,current.y,event.clientX,event.clientY);
   if(area.width>5&&area.height>5){
    const intersected=candidates().filter(c=>intersects(area,c.box));
    // Selecting a panel also moves its child controls; avoid doubling the offset.
    const chosen=intersected.some(c=>c.target.kind==="panel")?
     intersected.filter(c=>c.target.kind==="panel"):intersected;
    const unique=chosen.filter((item,index,all)=>all.findIndex(x=>same(item.target,x.target))===index)
     .map(item=>item.target);
    setSelected(selectedNow=>event.ctrlKey||event.metaKey?
     [...selectedNow,...unique.filter(x=>!selectedNow.some(y=>same(x,y)))]:unique);
   }
   setMarquee(null);
  }else if(current.mode==="drag"&&current.moved){
   record(current.before);
  }
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  gesture.current=null;
 };
 const changingDevice=(value:DeviceProfile)=>{
  if(gesture.current)return;
  setDevice(value);setSelected([]);setMarquee(null);setMessage("");
 };
 return createPortal(<div className="lektrus-live-layout-editor" role="application" aria-label="Редактирование интерфейса Lectrus">
  {alternate&&<div className="lektrus-layout-device-backdrop">
   <iframe ref={frame} title={"Настоящая доска Lectrus: "+dimensions.label} src={frameUrl}
    className="lektrus-layout-device-frame"
    style={{width:dimensions.width,height:dimensions.height,
     left:(viewport.width-dimensions.width*fit)/2,top:(viewport.height-dimensions.height*fit)/2,
     transform:`scale(${fit})`}}
    onLoad={()=>{const doc=activeDocument();if(doc)applyDraft(latest.current,device,doc);setVersion(v=>v+1)}}/>
  </div>}
  <div className="lektrus-live-layout-hit-area" onPointerDown={pointerDown} onPointerMove={pointerMove}
   onPointerUp={pointerUp} onPointerCancel={pointerUp}
   onClickCapture={event=>{event.preventDefault();event.stopPropagation()}}
   onContextMenu={event=>event.preventDefault()} onWheelCapture={event=>event.preventDefault()}
   title="Протяните прямоугольник по пустому месту для выделения нескольких панелей. Затем перетащите группу."/>
  {outlines.map((rect,index)=><div key={index} className="lektrus-live-layout-outline" aria-hidden="true"
   style={{left:rect.left,top:rect.top,width:rect.width,height:rect.height}}/>)}
  {marquee&&<div className="lektrus-live-layout-marquee" aria-hidden="true" style={marquee}/>}
  <div className="lektrus-live-layout-actions">
   <div className="lektrus-live-layout-device-switch" role="group" aria-label="Версия интерфейса">
    {deviceProfiles.map(id=><button key={id} type="button" className={device===id?"is-active":""}
     aria-pressed={device===id} onClick={()=>changingDevice(id)}>{specs[id].label}</button>)}
   </div>
   <span className="lektrus-live-layout-actions-divider"/>
   <button type="button" onClick={undo} disabled={!past.current.length} title="Отменить последнее изменение (Ctrl+Z)">↶ Отменить</button>
   <button type="button" onClick={redo} disabled={!future.current.length} title="Вернуть отменённое (Ctrl+Y)">↷ Вернуть</button>
   <span className="lektrus-live-layout-actions-divider"/>
   <button type="button" onClick={leave}>Выход</button>
   <button type="button" className="primary" onClick={save}>Сохранить</button>
  </div>
  {message&&<div role="status" className="lektrus-live-layout-status">{message}</div>}
 </div>,document.body);
}
