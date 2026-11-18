import {lazy,Suspense,useEffect,useLayoutEffect,useRef,useState,type ComponentProps} from "react";
import {Capacitor} from "@capacitor/core";
import type BoardApp from "./BoardApp";
import {parseRoute} from "./routes";

const Board=lazy(()=>import("./BoardApp"));
const Demo=lazy(()=>import("./PublicDemoBoard"));
const FRAME="lektrus-board-frame";
const CHANNEL="lektrus:browser-board";
type BoardProps=ComponentProps<typeof BoardApp>;
export type BrowserBoardPayload=Omit<BoardProps,"onBackToBoards"|"onLogout"|"onBoardChanged"|"onGlobalRolePreviewChange"> & {mountKey:number};
type Orientation=ScreenOrientation & {lock?:(value:"landscape")=>Promise<void>};
let orientationGeneration=0;
let orientationEngaged=false;
let ownsFullscreen=false;

export function isBrowserBoardFrame(){
 if(window.parent===window||new URLSearchParams(location.search).get(FRAME)!=="1")return false;
 const route=parseRoute(location.pathname);
 if(route.kind!=="board"&&route.kind!=="demo")return false;
 try{return window.parent.location.origin===location.origin}catch{return false}
}
export function wantsBrowserBoardLandscape(){
 if(Capacitor.isNativePlatform()||window.parent!==window)return false;
 const params=new URLSearchParams(location.search);
 if(params.get("layout-editor")==="1"||params.get("capture")==="1")return false;
 return matchMedia("(any-pointer:coarse)").matches||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
}

// Request the actual OS landscape when allowed. A direct link has no user
// activation, so the logical frame is immediately available as the fallback.
export function requestBrowserBoardLandscape(fromNavigation=false){
 if(!wantsBrowserBoardLandscape()||orientationEngaged)return;
 const orientation=screen.orientation as Orientation|undefined;
 if(!orientation?.lock)return;
 orientationEngaged=true;
 const generation=++orientationGeneration;
 void (async()=>{
  try{
   if(fromNavigation&&innerHeight>innerWidth&&!document.fullscreenElement&&
      !matchMedia("(display-mode:standalone)").matches&&navigator.userActivation?.isActive&&
      document.fullscreenEnabled&&document.documentElement.requestFullscreen){
    await document.documentElement.requestFullscreen();
    if(generation!==orientationGeneration){
     if(document.fullscreenElement===document.documentElement)await document.exitFullscreen().catch(()=>{});
     return;
    }
    ownsFullscreen=true;
   }
   if(generation!==orientationGeneration)return;
   await orientation.lock!("landscape");
   if(generation!==orientationGeneration)orientation.unlock?.();
  }catch{
   if(generation===orientationGeneration&&ownsFullscreen){
    ownsFullscreen=false;
    if(document.fullscreenElement===document.documentElement)await document.exitFullscreen().catch(()=>{});
   }
  }
 })();
}
export function releaseBrowserBoardLandscape(){
 if(!orientationEngaged&&!ownsFullscreen)return;
 ++orientationGeneration;orientationEngaged=false;
 try{screen.orientation?.unlock?.()}catch{/* Unsupported browser. */}
 if(ownsFullscreen){ownsFullscreen=false;if(document.fullscreenElement===document.documentElement)void document.exitFullscreen().catch(()=>{})}
}

export function BoardLoadingScreen({browserRotate=false,nativeRotate=Capacitor.isNativePlatform()}:{browserRotate?:boolean;nativeRotate?:boolean}={}){
 // The first painted loader must not depend on a parent layout effect or
 // the asynchronous native orientation transition.
 return <main className="lektrus-board-loading" data-native-rotate={nativeRotate} data-browser-rotate={browserRotate||undefined} role="status" aria-live="polite"><section className="lektrus-board-loading-card"><div className="lektrus-board-loading-mark"><img src="/lektrus-icon-192.png" alt=""/><i/></div><span className="lektrus-board-loading-kicker">LEKTRUS · РАБОЧЕЕ ПРОСТРАНСТВО</span><h1>Готовим доску</h1><p>Подключаем материалы и инструменты для занятия.</p><div className="lektrus-board-loading-progress" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></section></main>;
}

function frameUrl(path:string){
 const url=new URL(path,location.origin);
 url.searchParams.set(FRAME,"1");
 return url.pathname+url.search+url.hash;
}
type HostProps={
 path:string; demo?:boolean; payload?:BrowserBoardPayload;
 onBack:()=>void;onLogout:()=>void;onChanged?:(board:BoardProps["boardSummary"])=>void;
 onRoleChange?:BoardProps["onGlobalRolePreviewChange"];
};
/** The transformed element is the iframe, not BoardApp. The browser itself
 * converts pointer coordinates into its independent landscape CSS viewport.
 * Canvas, editor portals, overlays and pinch gestures all share that viewport. */
export function BrowserBoardLandscape({path,demo,payload,onBack,onLogout,onChanged,onRoleChange}:HostProps){
 const iframe=useRef<HTMLIFrameElement>(null),host=useRef<HTMLDivElement>(null),area=useRef<HTMLDivElement>(null);
 const [ready,setReady]=useState(false),[timedOut,setTimedOut]=useState(false),[attempt,setAttempt]=useState(0);
 const [size,setSize]=useState(()=>({width:innerWidth,height:innerHeight,rotated:innerHeight>innerWidth}));
 const callbacks=useRef({onBack,onLogout,onChanged,onRoleChange});
 callbacks.current={onBack,onLogout,onChanged,onRoleChange};
 const latest=useRef({payload,demo});
 latest.current={payload,demo};
 const send=()=>iframe.current?.contentWindow?.postMessage({channel:CHANNEL,type:"payload",...latest.current},location.origin);
 useLayoutEffect(()=>{
  const root=document.documentElement;
  root.classList.add("lektrus-browser-board-active");
  if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
  window.scrollTo(0,0);
  requestBrowserBoardLandscape();
  // Also own fullscreen explicitly requested from inside this board.
  const startedFullscreen=document.fullscreenElement!==null&&!ownsFullscreen;
  const fullscreenChanged=()=>{if(!startedFullscreen&&document.fullscreenElement===root)ownsFullscreen=true;else if(!document.fullscreenElement)ownsFullscreen=false};
  document.addEventListener("fullscreenchange",fullscreenChanged);
  let lastScreen=[screen.width,screen.height],rotated=innerHeight>innerWidth;
  const update=()=>{
   const v=window.visualViewport,element=host.current,region=area.current;
   if(!element||!region)return;
   const width=v?.width??innerWidth,height=v?.height??innerHeight;
   Object.assign(element.style,{left:(v?.offsetLeft??0)+"px",top:(v?.offsetTop??0)+"px",width:width+"px",height:height+"px"});
   const physicalChanged=lastScreen[0]!==screen.width||lastScreen[1]!==screen.height;
   lastScreen=[screen.width,screen.height];
   const focused=iframe.current?.contentDocument?.activeElement;
   const editing=focused?.matches("input,textarea,[contenteditable=true]")===true;
   // A keyboard reducing the vertical viewport must not choose a new rotation.
   if(!editing||physicalChanged)rotated=innerHeight>innerWidth;
   const w=region.clientWidth,h=region.clientHeight;
   if(w>0&&h>0)setSize(old=>old.width===w&&old.height===h&&old.rotated===rotated?old:{width:w,height:h,rotated});
  };
  update();
  const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(update):undefined; if(area.current)observer?.observe(area.current);
  window.addEventListener("resize",update);
  screen.orientation?.addEventListener?.("change",update);
  window.visualViewport?.addEventListener("resize",update);
  window.visualViewport?.addEventListener("scroll",update);
  return()=>{
   root.classList.remove("lektrus-browser-board-active");observer?.disconnect();
   document.removeEventListener("fullscreenchange",fullscreenChanged);
   window.removeEventListener("resize",update);screen.orientation?.removeEventListener?.("change",update);
   window.visualViewport?.removeEventListener("resize",update);window.visualViewport?.removeEventListener("scroll",update);
   releaseBrowserBoardLandscape();
  };
 },[]);
 useLayoutEffect(()=>{
  const receive=(event:MessageEvent)=>{
   if(event.origin!==location.origin||event.source!==iframe.current?.contentWindow||event.data?.channel!==CHANNEL)return;
   switch(event.data.type){
    case "ready":setReady(true);setTimedOut(false);send();break;
    case "back":callbacks.current.onBack();break;
    case "logout":callbacks.current.onLogout();break;
    case "changed":if(event.data.board?.id===latest.current.payload?.boardSummary.id)callbacks.current.onChanged?.(event.data.board);break;
    case "role":if(["actual","teacher","student"].includes(event.data.role))callbacks.current.onRoleChange?.(event.data.role);break;
    case "apply-update":window.dispatchEvent(new Event("lektrus:apply-update"));break;
   }
  };
  window.addEventListener("message",receive);
  return()=>window.removeEventListener("message",receive);
 },[]);
 useEffect(()=>{if(ready)send()},[ready,payload,demo]);
 useEffect(()=>{if(ready)return;const timer=window.setTimeout(()=>setTimedOut(true),25000);return()=>window.clearTimeout(timer)},[ready,attempt]);
 return <div ref={host} className="lektrus-browser-board-host"><div ref={area} className="lektrus-browser-board-area">
  <div data-rotated={size.rotated} className="lektrus-browser-board-logical" style={{width:size.rotated?size.height:size.width,height:size.rotated?size.width:size.height,transform:`translate(-50%,-50%) rotate(${size.rotated?90:0}deg)`}}>
   {!ready&&<BoardLoadingScreen/>}
   <iframe key={attempt} ref={iframe} className="lektrus-browser-board-frame" title="Рабочая доска Lektrus" src={frameUrl(path)} allow="fullscreen" allowFullScreen style={{visibility:ready?"visible":"hidden"}}/>
   {!ready&&timedOut&&<div className="lektrus-browser-board-error"><strong>Не удалось загрузить рабочую область</strong><button type="button" onClick={()=>{setTimedOut(false);setAttempt(n=>n+1)}}>Повторить</button><button type="button" onClick={onBack}>К доскам</button></div>}
  </div>
 </div></div>;
}

// The same-origin embedded entry mounts only BoardApp, not a second App/auth
// shell. The parent still resolves access, loads the document and owns history.
export function BrowserBoardFrameEntry(){
 const [state,setState]=useState<{payload?:BrowserBoardPayload;demo?:boolean}>({});
 const emit=(type:string,data:Record<string,unknown>={})=>window.parent.postMessage({channel:CHANNEL,type,...data},location.origin);
 useLayoutEffect(()=>{
  const route=parseRoute(location.pathname);
  // The embedded document also owns its overscroll boundary. Otherwise
  // a horizontal physical swipe in the rotated portrait browser can
  // become a top-level history navigation rather than a board gesture.
  document.documentElement.classList.add("lektrus-browser-board-frame-active");
  const receive=(event:MessageEvent)=>{
   if(event.source!==window.parent||event.origin!==location.origin||event.data?.channel!==CHANNEL||event.data.type!=="payload")return;
   const payload=event.data.payload as BrowserBoardPayload|undefined;
   if(payload&&(route.kind!=="board"||route.boardId.toLowerCase()!==payload.boardSummary.id.toLowerCase()))return;
   setState({payload,demo:route.kind==="demo"&&event.data.demo===true});
  };
  window.addEventListener("message",receive);
  const applyUpdate=()=>emit("apply-update");
  window.addEventListener("lektrus:apply-update",applyUpdate);
  emit("ready");
  return()=>{document.documentElement.classList.remove("lektrus-browser-board-frame-active");window.removeEventListener("message",receive);window.removeEventListener("lektrus:apply-update",applyUpdate)};
 },[]);
 if(state.demo)return <Suspense fallback={<BoardLoadingScreen/>}><Demo onExit={()=>emit("back")}/></Suspense>;
 if(!state.payload)return <BoardLoadingScreen/>;
 const {mountKey,...props}=state.payload;
 return <Suspense fallback={<BoardLoadingScreen/>}><Board key={`${props.boardSummary.id}:${mountKey}`} {...props} onBackToBoards={()=>emit("back")} onLogout={()=>emit("logout")} onBoardChanged={board=>emit("changed",{board})} onGlobalRolePreviewChange={role=>emit("role",{role})}/></Suspense>;
}
