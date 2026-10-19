import {useCallback,useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from "react";
import {createPortal} from "react-dom";
import {
 applyInterfaceLayout,currentDeviceProfile,layoutControls,layoutControlNames,layoutRegions,layoutRegionNames,
 readInterfaceLayout,saveInterfaceLayout,type DeviceProfile,type InterfaceLayout,type LayoutControl,type LayoutRegion
} from "./lektrusInterfaceLayout";

/** The editor runs ON the actual BoardApp DOM. No copied toolbar, fake icons,
 * iframe, resized stage or independent recreation of the board UI. */
type Target={kind:"panel";id:LayoutRegion}|{kind:"control";id:LayoutControl};
type PointerDrag={id:number;x:number;y:number;previous:InterfaceLayout;target:Target;moved:boolean};
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
 toolbar:".workspace>.toolbar.compact-toolbar,.workspace .toolbar.compact-toolbar",
 zoom:".workspace .board-controls",mobileTools:".workspace .mobile-board-tools",
 selection:".workspace .selection-toolbar-screen",
 subjectTools:"#lektrus-subject-tools-panel"
};
const clone=(layout:InterfaceLayout):InterfaceLayout=>structuredClone(layout);
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const targetValue=(layout:InterfaceLayout,device:DeviceProfile,target:Target)=>
 target.kind==="panel"?layout.profiles[device][target.id]:layout.controls[device][target.id];
function previewLayout(layout:InterfaceLayout,device:DeviceProfile){
 const root=document.documentElement;
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
function hitTarget(x:number,y:number,preferPanel:boolean):{target:Target;box:DOMRect}|null{
 const hits:{target:Target;box:DOMRect;size:number}[]=[];
 const collect=(kind:"panel"|"control",id:LayoutRegion|LayoutControl,selector:string)=>{
  for(const element of document.querySelectorAll<HTMLElement>(selector)){
   const rect=element.getBoundingClientRect();
   if(rect.width<9||rect.height<9||x<rect.left||x>rect.right||y<rect.top||y>rect.bottom)continue;
   if(getComputedStyle(element).visibility==="hidden"||getComputedStyle(element).display==="none")continue;
   hits.push({target:kind==="panel"?{kind,id:id as LayoutRegion}:{kind,id:id as LayoutControl},
    box:rect,size:rect.width*rect.height});
  }
 };
 for(const id of layoutRegions)collect("panel",id,panelSelectors[id]);
 for(const id of layoutControls)collect("control",id,controlSelectors[id]);
 hits.sort((a,b)=>a.size-b.size);
 const preferred=hits.find(p=>p.target.kind===(preferPanel?"panel":"control"));
 const found=preferred??hits[0];
 return found?{target:found.target,box:found.box}:null;
}
function previewBox(target:Target){
 const selector=target.kind==="panel"?panelSelectors[target.id]:controlSelectors[target.id];
 for(const element of document.querySelectorAll<HTMLElement>(selector)){
  const box=element.getBoundingClientRect();
  if(box.width>9&&box.height>9&&getComputedStyle(element).display!=="none")return box;
 }
 return null;
}
/** The only two visible editing actions are Cancel and Save.
 * Shift+drag moves a whole panel; ordinary drag moves the individual button
 * if one is under the pointer. Ctrl+Z/Y provides invisible undo/redo. */
export default function LektrusInterfaceStudio({onClose}:{onClose:()=>void}){
 const [layout,setLayout]=useState<InterfaceLayout>(readInterfaceLayout);
 const [device,setDevice]=useState<DeviceProfile>(currentDeviceProfile);
 const [selected,setSelected]=useState<Target|null>(null);
 const [history,setHistory]=useState<InterfaceLayout[]>([]);
 const [redoStack,setRedoStack]=useState<InterfaceLayout[]>([]);
 const [hint,setHint]=useState("");
 const [selectionBox,setSelectionBox]=useState<DOMRect|null>(null);
 const drag=useRef<PointerDrag|null>(null);
 const latest=useRef(layout);latest.current=layout;
 const commitDraft=useCallback((next:InterfaceLayout)=>{latest.current=next;setLayout(next);previewLayout(next,currentDeviceProfile())},[]);
 useEffect(()=>{
  const refresh=()=>{
   const next=currentDeviceProfile();setDevice(next);
   previewLayout(latest.current,next);
  };
  refresh();
  window.addEventListener("resize",refresh);
  return ()=>{window.removeEventListener("resize",refresh);applyInterfaceLayout()};
 },[]);
 useEffect(()=>{
  if(!selected){setSelectionBox(null);return}
  const update=()=>setSelectionBox(previewBox(selected));
  update();
  window.addEventListener("resize",update);
  return()=>window.removeEventListener("resize",update);
 },[selected,layout,device]);
 const cancel=()=>{
  previewLayout(readInterfaceLayout(),currentDeviceProfile());
  onClose();
 };
 const save=()=>{
  try{saveInterfaceLayout(latest.current);onClose()}
  catch{setHint("Не удалось сохранить макет в браузере")}
 };
 const undo=useCallback(()=>{
  setHistory(previous=>{
   if(!previous.length)return previous;
   const snapshot=previous[previous.length-1];
   setRedoStack(next=>[...next.slice(-49),clone(latest.current)]);
   commitDraft(clone(snapshot));return previous.slice(0,-1);
  });
 },[commitDraft]);
 const redo=useCallback(()=>{
  setRedoStack(previous=>{
   if(!previous.length)return previous;
   const snapshot=previous[previous.length-1];
   setHistory(next=>[...next.slice(-49),clone(latest.current)]);
   commitDraft(clone(snapshot));return previous.slice(0,-1);
  });
 },[commitDraft]);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{
   if((event.ctrlKey||event.metaKey)&&event.code==="KeyZ"){
    event.preventDefault();event.stopImmediatePropagation();if(event.shiftKey)redo();else undo();return;
   }
   if((event.ctrlKey||event.metaKey)&&event.code==="KeyY"){
    event.preventDefault();event.stopImmediatePropagation();redo();return;
   }
   if(selected && (event.key==="+"||event.key==="="||event.key==="-")){
    event.preventDefault();event.stopImmediatePropagation();
    const original=clone(latest.current);
    const next=clone(original);
    const p=targetValue(next,currentDeviceProfile(),selected);
    p.scale=clamp(Math.round((p.scale+(event.key==="-"?-.05:.05))*100)/100,.65,1.45);
    setHistory(stack=>[...stack.slice(-49),original]);setRedoStack([]);
    commitDraft(next);return;
   }
   if(event.key==="Escape"){event.preventDefault();event.stopImmediatePropagation();cancel();return}
   // Disable the real board's keyboard shortcuts while the layout editor is open.
   if(!event.ctrlKey&&!event.metaKey&&!event.altKey && /^(Key|Digit|Arrow|Delete|Backspace)/.test(event.code)){
    event.preventDefault();event.stopImmediatePropagation();
   }
  };
  window.addEventListener("keydown",key,true);
  return()=>window.removeEventListener("keydown",key,true);
 },[undo,redo,selected]);
 const down=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(e.button!==0)return;
  const hit=hitTarget(e.clientX,e.clientY,e.shiftKey);
  if(!hit){setSelected(null);setSelectionBox(null);return}
  e.preventDefault();e.stopPropagation();
  setSelected(hit.target);setHint("");
  const snapshot=clone(latest.current);
  drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,previous:snapshot,target:hit.target,moved:false};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const move=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const current=drag.current;
  if(!current||e.pointerId!==current.id)return;
  const dx=e.clientX-current.x,dy=e.clientY-current.y;
  if(Math.hypot(dx,dy)>2)current.moved=true;
  if(!current.moved)return;
  const next=clone(current.previous),p=targetValue(next,currentDeviceProfile(),current.target);
  p.x=clamp(Math.round((p.x+dx/window.innerWidth*100)*10)/10,-45,45);
  p.y=clamp(Math.round((p.y+dy/window.innerHeight*100)*10)/10,-45,45);
  commitDraft(next);
 };
 const up=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const current=drag.current;
  if(!current||e.pointerId!==current.id)return;
  if(current.moved){
   setHistory(previous=>[...previous.slice(-49),current.previous]);setRedoStack([]);
  }
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  drag.current=null;
 };
 const capture=(e:ReactPointerEvent<HTMLDivElement>)=>{e.preventDefault();e.stopPropagation()};
 return createPortal(<div className="lektrus-live-layout-editor" role="application"
   aria-label="Редактор настоящего интерфейса доски Lectrus">
   <div className="lektrus-live-layout-hit-area" onPointerDown={down} onPointerMove={move}
    onPointerUp={up} onPointerCancel={up} onClickCapture={capture}
    onContextMenu={e=>e.preventDefault()} onWheelCapture={e=>e.preventDefault()}
    title="Перетащите кнопку. Shift + перетаскивание: вся панель. Ctrl+Z: отмена, +/−: размер."/>
   {selectionBox&&<div className="lektrus-live-layout-outline" aria-hidden="true"
    style={{left:selectionBox.left,top:selectionBox.top,width:selectionBox.width,height:selectionBox.height}}/>}
   <div className="lektrus-live-layout-actions">
    <button type="button" onClick={cancel}>Отмена</button>
    <button type="button" className="primary" onClick={save}>Сохранить</button>
   </div>
   {hint&&<div role="status" className="lektrus-live-layout-status">{hint}</div>}
  </div>,document.body);
}
