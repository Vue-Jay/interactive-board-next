import {useEffect,useRef,useState} from "react";
import {selfhostRequest} from "./selfhostApi";

type Guest={id:string;name:string;board_title:string|null;joined_at:string;expires_at:string;cleanup_eligible_at:string;protected:boolean};
type Directory={server_time:string;access_hours:number;offset:number;has_more:boolean;guests:Guest[]};
const date=(value:string)=>new Date(value).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
const remaining=(ms:number)=>{const m=Math.max(1,Math.ceil(ms/60000)),d=Math.floor(m/1440),h=Math.floor(m%1440/60);return [d?d+" дн.":"",h?h+" ч.":"",m%60+" мин."].filter(Boolean).join(" ")};
export default function AdminGuestsPanel({refreshKey}:{refreshKey:number}){
 const [data,setData]=useState<Directory|null>(null),[query,setQuery]=useState(""),[search,setSearch]=useState(""),[offset,setOffset]=useState(0),[loading,setLoading]=useState(false),[error,setError]=useState(""),[clock,setClock]=useState(Date.now()),[skew,setSkew]=useState(0);
 const sequence=useRef(0),busy=useRef(false);
 useEffect(()=>{const id=window.setTimeout(()=>{setSearch(query.trim());setOffset(0)},300);return()=>window.clearTimeout(id)},[query]);
 useEffect(()=>{
  let active=true;
  const load=async(quiet=false)=>{if(busy.current&&quiet)return;const id=++sequence.current;busy.current=true;if(!quiet){setLoading(true);setError("");setData(null)}
   try{const started=Date.now(),next=await selfhostRequest<Directory>("/api/v1/admin/guests?offset="+offset+"&q="+encodeURIComponent(search));if(active&&sequence.current===id){setData(next);setSkew(Date.parse(next.server_time)-(started+Date.now())/2);setClock(Date.now());setError("");if(offset>0&&!next.guests.length)setOffset(Math.max(0,offset-50))}}
   catch(e){if(active&&sequence.current===id)setError(e instanceof Error?e.message:"Не удалось загрузить гостей")}
   finally{if(sequence.current===id){busy.current=false;if(active)setLoading(false)}}
  };
  void load();const poll=window.setInterval(()=>{if(document.visibilityState==="visible")void load(true)},60000);
  const focus=()=>void load(true);window.addEventListener("focus",focus);
  return()=>{active=false;sequence.current++;busy.current=false;window.clearInterval(poll);window.removeEventListener("focus",focus)};
 },[offset,search,refreshKey]);
 useEffect(()=>{const t=window.setInterval(()=>setClock(Date.now()),1000);return()=>window.clearInterval(t)},[]);
 const now=clock+skew;
 return <section className="admin-guests-panel" aria-label="Гостевые аккаунты">
  <div className="admin-users-toolbar"><div><h2>Гости</h2><span>Временные аккаунты · доступ на {data?.access_hours??72} часа</span></div></div>
  <input className="admin-guest-search" type="search" maxLength={120} aria-label="Поиск гостей" placeholder="Имя гостя или доска" value={query} onChange={e=>setQuery(e.target.value)}/>
  <p className="admin-guest-note">После окончания доступа аккаунт удаляется при очередной автоматической очистке. История посещений и комментарии сохраняются.</p>
  {loading&&<p role="status">Загрузка гостей…</p>}{error&&<p className="access-notice" role="alert">{error}</p>}
  {data&&<><div className="admin-guest-list">{data.guests.map(g=>{const left=Date.parse(g.expires_at)-now,expired=left<=0;return <article className="admin-guest-card" key={g.id} data-guest-id={g.id}>
   <div className="admin-guest-identity"><span className="admin-guest-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg></span><div><strong>{g.name}</strong><small title={g.id}>ID: {g.id.slice(0,8)}</small><span>{g.board_title??"Доска недоступна"}</span></div><span className={"admin-guest-status "+(expired?"expired":"active")}>{expired?(g.protected?"Защищён":"Истёк"):"Активен"}</span></div>
   <dl className="admin-guest-dates"><div><dt>Первый вход</dt><dd>{date(g.joined_at)}</dd></div><div><dt>Окончание доступа</dt><dd>{date(g.expires_at)}</dd></div></dl>
   <div className="admin-guest-countdown"><span>{expired?(g.protected?"Удаление требует проверки":now<Date.parse(g.cleanup_eligible_at)?"Подготовка к очистке":"Ожидает автоудаления"):"До окончания доступа"}</span><strong>{expired?(g.protected?"Защищённая запись":now<Date.parse(g.cleanup_eligible_at)?remaining(Date.parse(g.cleanup_eligible_at)-now):"При очередной очистке"):remaining(left)}</strong></div>
   {!expired&&<progress aria-label="Оставшийся срок гостя" max={Math.max(1,Date.parse(g.expires_at)-Date.parse(g.joined_at))} value={Math.min(Math.max(1,Date.parse(g.expires_at)-Date.parse(g.joined_at)),Math.max(0,left))}/>}
  </article>})}</div>{!data.guests.length&&<div className="boards-empty"><strong>{search?"Гости не найдены":"Гостевых аккаунтов нет"}</strong></div>}
  {(offset>0||data.has_more)&&<div className="admin-guest-pages"><button className="boards-secondary" disabled={offset===0||loading} onClick={()=>setOffset(x=>Math.max(0,x-50))}>Назад</button><span>{offset+1}–{offset+data.guests.length}</span><button className="boards-secondary" disabled={!data.has_more||loading} onClick={()=>setOffset(x=>x+50)}>Далее</button></div>}</>}
 </section>
}
