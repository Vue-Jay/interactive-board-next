import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {App as CapacitorApp} from "@capacitor/app";
import {Capacitor,registerPlugin} from "@capacitor/core";
import {isSelfhostBackendEnabled,selfhostAndroidUpdate} from "./selfhostApi";
import {LEKTRUS_LOCAL_TEST_MODE} from "./lektrusLocalTestMode";
import {androidUpdateKind,parseAndroidUpdate,resolveAndroidUpdate,shouldOfferAndroidUpdate,type AndroidUpdate} from "./androidUpdatePolicy";
import "./lektrusAndroidUpdate.css";

const nativeUi=registerPlugin<{openAndroidUpdate(options:{version:string}):Promise<void>;openAndroidReleasePage():Promise<void>}>("LektrusSystemUi");
const DEFER_KEY="lektrus.android-update-deferred.v1";
const KNOWN_KEY="lektrus.android-update-known.v1";
const RESUME_INTERVAL=15*60*1000;
const safeScreen=()=>!/^\/(board\/|demo\/board|join\/)/.test(window.location.pathname);
function readDefer():{version:string;until:number}{
  try{const value=JSON.parse(localStorage.getItem(DEFER_KEY)||"null");if(value&&typeof value.version==="string"&&Number.isFinite(value.until))return value}catch{/* storage unavailable */}
  return {version:"",until:0};
}
function readKnown():AndroidUpdate|null{
  try{return parseAndroidUpdate(JSON.parse(localStorage.getItem(KNOWN_KEY)||"null"))}catch{return null}
}
const UpdateContext=createContext<{version:string;checking:boolean;message:string;recovery:boolean;check:()=>void;openReleases:()=>void}|null>(null);

export function AndroidUpdateSettings(){
  const state=useContext(UpdateContext);
  if(!state)return null;
  return <section className="settings-row-card lektrus-update-settings"><div><b>Обновление приложения</b><small>{state.version?"Установлена версия "+state.version:"Версия Lektrus"}</small>{state.message&&<small role="status">{state.message}</small>}{state.recovery&&<button type="button" className="lektrus-update-recovery" onClick={state.openReleases}>Открыть официальные релизы</button>}</div><button type="button" disabled={state.checking} onClick={state.check}>{state.checking?"Проверяем…":"Проверить"}</button></section>;
}

export function AndroidUpdateGate({children}:{children:ReactNode}){
  if(!Capacitor.isNativePlatform()||Capacitor.getPlatform()!=="android"||!isSelfhostBackendEnabled()||LEKTRUS_LOCAL_TEST_MODE)return children;
  return <AndroidUpdateController>{children}</AndroidUpdateController>;
}

function AndroidUpdateController({children}:{children:ReactNode}){
  const [version,setVersion]=useState(""),[starting,setStarting]=useState(true),[checking,setChecking]=useState(false);
  const [message,setMessage]=useState(""),[offer,setOffer]=useState<AndroidUpdate|null>(null),[downloadStatus,setDownloadStatus]=useState(""),[recovery,setRecovery]=useState(false);
  const [busy,setBusy]=useState(false),[safe,setSafe]=useState(safeScreen);
  const current=useRef(""),lastCheck=useRef(0),inFlight=useRef(false),alive=useRef(true);
  const pending=useRef<AndroidUpdate|null>(null);
  const dialog=useRef<HTMLDialogElement>(null);

  const check=async(manual=false,initial=false)=>{
    if(inFlight.current)return;
    inFlight.current=true;lastCheck.current=Date.now();setChecking(true);
    if(manual){setMessage("");setRecovery(false)}
    try{
      const info=await CapacitorApp.getInfo();
      if(!alive.current)return;
      current.current=info.version;setVersion(info.version);
      const incoming=parseAndroidUpdate(await selfhostAndroidUpdate());
      if(!alive.current)return;
      if(!incoming)throw new Error("Invalid release metadata");
      const update=resolveAndroidUpdate(info.version,incoming,pending.current||readKnown());
      if(!incoming.catalog_stale){
        try{localStorage.setItem(KNOWN_KEY,JSON.stringify(incoming))}catch{/* no persistent cache */}
      }
      const kind=androidUpdateKind(info.version,update);
      const deferred=readDefer();
      if(shouldOfferAndroidUpdate(info.version,update,deferred.version,deferred.until,Date.now(),manual)){
        pending.current=update;setDownloadStatus("");
        // A required release may gate a cold launch, but neither kind should
        // interrupt a board already in use when the app returns to foreground.
        if(safeScreen()||initial&&kind==="required"){setOffer(update);setSafe(true)}
        if(manual)setMessage("Доступна версия "+update.version);
      }else{
        pending.current=null;setOffer(null);
        if(manual){setMessage(kind==="none"?(update.catalog_stale?"Каталог временно недоступен. Новые версии можно проверить на официальной странице.":"Установлена актуальная версия."):"Обновление можно установить позже.");setRecovery(kind==="none"&&!!update.catalog_stale)}
      }
    }catch{
      // Network failures must not block login, local boards, or the workspace.
      if(alive.current&&manual){setMessage("Не удалось проверить обновления. Откройте официальную страницу или повторите попытку.");setRecovery(true)}
    }finally{
      inFlight.current=false;
      if(alive.current){setStarting(false);setChecking(false)}
    }
  };
  useEffect(()=>{
    alive.current=true;
    void check(false,true);
    const onRoute=()=>{
      const next=safeScreen();setSafe(next);
      if(!next)return;
      const update=pending.current;
      if(update){const defer=readDefer();if(shouldOfferAndroidUpdate(current.current,update,defer.version,defer.until,Date.now()))setOffer(update)}
      if(Date.now()-lastCheck.current>=RESUME_INTERVAL)void check();
    };
    const listener=CapacitorApp.addListener("appStateChange",({isActive})=>{if(isActive)onRoute()});
    window.addEventListener("popstate",onRoute);
    window.addEventListener("lektrus:workspace-route",onRoute);
    return()=>{alive.current=false;window.removeEventListener("popstate",onRoute);window.removeEventListener("lektrus:workspace-route",onRoute);void listener.then(handle=>handle.remove()).catch(()=>{})};
  // The controller remains mounted for the lifetime of the native shell.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const required=!!offer&&androidUpdateKind(version,offer)==="required";
  const visible=!!offer&&(safe||required);
  const blocking=!!offer&&required;
  useEffect(()=>{
    const element=dialog.current;
    if(!element)return;
    if(visible&&!element.open){if(typeof element.showModal==="function")element.showModal();else element.setAttribute("open","")}
    else if(!visible&&element.open){if(typeof element.close==="function")element.close();else element.removeAttribute("open")}
  },[visible]);
  const defer=()=>{
    if(!offer||required)return;
    try{localStorage.setItem(DEFER_KEY,JSON.stringify({version:offer.version,until:Date.now()+24*60*60*1000}))}catch{/* session-only dismissal */}
    pending.current=null;setOffer(null);setMessage("Обновление доступно в настройках.");
  };
  const download=async()=>{
    if(!offer||busy)return;
    setBusy(true);setDownloadStatus("");
    try{await nativeUi.openAndroidUpdate({version:offer.version});setDownloadStatus("Откройте скачанный APK в загрузках браузера и подтвердите установку.")}
    catch{setDownloadStatus("Не удалось открыть загрузку. Повторите попытку или скачайте APK с lektrus.ru.")}
    finally{setBusy(false)}
  };
  useEffect(()=>{
    if(!visible)return;
    const back=(event:Event)=>{event.stopImmediatePropagation();if(!required)defer()};
    window.addEventListener("lektrus:native-back",back,true);
    return()=>window.removeEventListener("lektrus:native-back",back,true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[visible,required,offer]);
  const openReleases=()=>void nativeUi.openAndroidReleasePage().catch(()=>setMessage("Не удалось открыть браузер. Страница загрузки доступна на lektrus.ru."));
  return <UpdateContext.Provider value={{version,checking,message,recovery,check:()=>void check(true),openReleases}}>
    {starting?<main className="lektrus-update-start"><img src="/lektrus-icon-192.png" alt="Lektrus"/><strong>Запускаем Lektrus</strong><span>Проверяем версию приложения…</span></main>:!blocking||!visible?children:null}
    {offer&&<dialog ref={dialog} className="lektrus-update-dialog" aria-labelledby="lektrus-update-title" onCancel={event=>{event.preventDefault();defer()}}>
      <div className="lektrus-update-heading"><img src="/lektrus-icon-192.png" alt=""/><div><span className={required?"lektrus-update-kicker required":"lektrus-update-kicker"}>{required?"ОБЯЗАТЕЛЬНОЕ ОБНОВЛЕНИЕ":"НОВАЯ ВЕРСИЯ"}</span><h1 id="lektrus-update-title">Обновление Lektrus</h1></div></div>
      <p>{required?"Эта версия приложения больше не совместима с сервером. Установите обновление, чтобы продолжить работу.":"Установите актуальную версию, чтобы пользоваться последними улучшениями и возможностями Lektrus."}</p>
      <div className="lektrus-update-versions"><div><span>Установлена</span><strong>{version}</strong></div><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg><div><span>Доступна</span><strong>{offer.version}</strong></div></div>
      <div className="lektrus-update-file"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-3 7-12V5l-7-3-7 3v5c0 9 7 12 7 12Z"/><path d="m9 12 2 2 4-4"/></svg><span>Официальная подписанная сборка · {new Intl.NumberFormat("ru-RU",{maximumFractionDigits:1}).format(offer.size_bytes/1024/1024)} МБ</span></div>
      <button type="button" className="lektrus-update-primary" disabled={busy} onClick={()=>void download()}>{busy?"Открываем загрузку…":"Скачать обновление"}</button>
      {!required&&<button type="button" className="lektrus-update-later" onClick={defer}>Позже</button>}
      {downloadStatus&&<p className="lektrus-update-feedback" role="status">{downloadStatus}</p>}
      <small className="lektrus-update-note">Промежуточные версии устанавливать не нужно. Установите APK поверх текущего приложения, не удаляя его. Ваши доски и учётная запись сохранятся.</small>
    </dialog>}
  </UpdateContext.Provider>;
}
