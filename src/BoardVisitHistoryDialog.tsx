import {useEffect,useMemo,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {formatVisitDuration,type BoardVisit} from "./boardVisits";
import "./boardVisitHistoryDialog.css";

type Props={
 boardTitle:string;
 visits:BoardVisit[];
 loading:boolean;
 error:string;
 onClose:()=>void;
 onRefresh:()=>void;
};

const dateTime=new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});
const timeOnly=new Intl.DateTimeFormat("ru-RU",{hour:"2-digit",minute:"2-digit"});
type Period="all"|"today"|"week";

function isInPeriod(iso:string,period:Period){
 if(period==="all")return true;
 const since=new Date();
 if(period==="today")since.setHours(0,0,0,0);
 else{since.setDate(since.getDate()-7);since.setHours(0,0,0,0)}
 return new Date(iso).getTime()>=since.getTime();
}

export default function BoardVisitHistoryDialog({boardTitle,visits,loading,error,onClose,onRefresh}:Props){
 const [query,setQuery]=useState("");
 const [period,setPeriod]=useState<Period>("all");
 const [onlyOnline,setOnlyOnline]=useState(false);
 const closeRef=useRef(onClose);
 closeRef.current=onClose;
 const titleRef=useRef<HTMLHeadingElement>(null);

 useEffect(()=>{
  const oldOverflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  titleRef.current?.focus({preventScroll:true});
  const dismiss=(event:KeyboardEvent)=>{
   if(event.key!=="Escape")return;
   event.preventDefault();
   event.stopPropagation();
   closeRef.current();
  };
  window.addEventListener("keydown",dismiss,true);
  return()=>{
   window.removeEventListener("keydown",dismiss,true);
   document.body.style.overflow=oldOverflow;
  };
 },[]);

 const shown=useMemo(()=>{
  const normalized=query.trim().toLocaleLowerCase("ru");
  return visits.filter(visit=>
   (!normalized || visit.user_name.toLocaleLowerCase("ru").includes(normalized)) &&
   isInPeriod(visit.started_at,period) &&
   (!onlyOnline||visit.active)
  );
 },[visits,query,period,onlyOnline]);
 const attendees=new Set(shown.map(row=>row.user_id)).size;
 const minutes=shown.reduce((sum,row)=>sum+row.duration_seconds,0);
 const filtered=query.trim()!==""||period!=="all"||onlyOnline;

 return createPortal(
  <div className="bv-overlay" onPointerDown={event=>{
    event.stopPropagation();
    if(event.target===event.currentTarget)onClose();
   }} onClick={event=>event.stopPropagation()}>
   <section className="bv-dialog" role="dialog" aria-modal="true" aria-labelledby="bv-dialog-title" onPointerDown={event=>event.stopPropagation()}>
    <header className="bv-header">
     <div className="bv-heading">
      <div className="bv-eyebrow"><span className="bv-eyebrow-dot"/> LEKTRUS · ПОСЕЩАЕМОСТЬ</div>
      <h2 id="bv-dialog-title" tabIndex={-1} ref={titleRef}>История посещений</h2>
      <p title={boardTitle}>{boardTitle}</p>
     </div>
     <button className="bv-close" type="button" aria-label="Закрыть журнал посещений" title="Закрыть" onClick={onClose}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19"/></svg>
     </button>
    </header>

    <div className="bv-stats" aria-label="Сводка посещаемости">
     <div className="bv-stat"><span>Всего заходов</span><strong>{shown.length}</strong><small>сеансов</small></div>
     <div className="bv-stat"><span>Участников</span><strong>{attendees}</strong><small>разных пользователей</small></div>
     <div className="bv-stat"><span>Время на доске</span><strong>{formatVisitDuration(minutes)}</strong><small>суммарно</small></div>
    </div>

    <div className="bv-toolbar">
     <div className="bv-periods" role="group" aria-label="Период посещений">
      <button type="button" className={period==="all"?"is-active":""} aria-pressed={period==="all"} onClick={()=>setPeriod("all")}>Все</button>
      <button type="button" className={period==="today"?"is-active":""} aria-pressed={period==="today"} onClick={()=>setPeriod("today")}>Сегодня</button>
      <button type="button" className={period==="week"?"is-active":""} aria-pressed={period==="week"} onClick={()=>setPeriod("week")}>7 дней</button>
     </div>
     <div className="bv-toolbar-actions">
      <label className="bv-search">
       <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
       <input type="search" aria-label="Поиск ученика в посещениях" placeholder="Найти ученика" value={query} onChange={event=>setQuery(event.target.value)}/>
      </label>
      <button className="bv-refresh" type="button" onClick={onRefresh} disabled={loading} title="Обновить посещения" aria-label="Обновить посещения">
       <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.5 6.4M20 4v7h-7"/></svg>
      </button>
     </div>
    </div>

    <div className="bv-results-heading">
     <div><strong>Журнал активности</strong><span>{shown.length} записей · до 150 последних</span></div>
     <label className="bv-online-toggle"><input type="checkbox" checked={onlyOnline} onChange={event=>setOnlyOnline(event.target.checked)}/><span>Сейчас на доске</span></label>
    </div>

    <div className="bv-list" aria-live="polite" aria-busy={loading}>
     {error&&!loading&&<div className="bv-empty bv-failure">
       <span className="bv-empty-icon">!</span><strong>Не удалось загрузить историю</strong><p>{error}</p><button type="button" onClick={onRefresh}>Повторить</button>
      </div>}
     {loading&&<div className="bv-empty"><div className="bv-loading"/>Загружаем историю посещений…</div>}
     {!loading&&!error&&shown.length===0&&<div className="bv-empty">
       <div className="bv-empty-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17M8 14h3M8 17h7"/></svg></div>
       <strong>{filtered?"По этому запросу ничего не найдено":"Посещений пока нет"}</strong>
       <p>{filtered?"Попробуйте другой период или измените имя в поиске.":"Когда ученики начнут открывать эту доску, здесь появятся даты входа, выхода и продолжительность сеансов."}</p>
       {filtered&&<button type="button" onClick={()=>{setQuery("");setPeriod("all");setOnlyOnline(false)}}>Сбросить фильтры</button>}
      </div>}
     {!loading&&!error&&shown.map(visit=>
      <article key={visit.visit_id} className="bv-visit">
       <div className="bv-avatar" aria-hidden="true">{visit.user_name.trim().charAt(0).toUpperCase()||"У"}</div>
       <div className="bv-visit-main">
        <div className="bv-visit-name">{visit.user_name}</div>
        <time dateTime={visit.started_at}>{dateTime.format(new Date(visit.started_at))}</time>
        <span className="bv-visit-exit">{visit.active?"На доске прямо сейчас":visit.left_at?"Выход в "+timeOnly.format(new Date(visit.left_at)):"Сеанс завершён"}</span>
       </div>
       <div className="bv-visit-side">
        <strong>{formatVisitDuration(visit.duration_seconds)}</strong>
        <span className={visit.active?"bv-status is-online":"bv-status"}>{visit.active?"● Онлайн":"Завершён"}</span>
       </div>
      </article>
     )}
    </div>

    <footer className="bv-footer">
     <span>Время фиксируется автоматически. При обрыве связи завершение определяется приблизительно.</span>
     <button type="button" onClick={onClose}>Готово</button>
    </footer>
   </section>
  </div>,
  document.body
 );
}
