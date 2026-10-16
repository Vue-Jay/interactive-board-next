import { useEffect, useState, type ReactNode } from "react";
import type { AccountRole } from "./accountRoleStore";
import { listNotifications } from "./notificationsStore";
import { readLectrisPalette } from "./lectrisPalette";

type NavIcon = "search" | "home" | "subjects" | "groups" | "boards" | "users" | "assignments" | "schedule" | "progress" | "materials" | "templates" | "notification" | "profile" | "settings" | "admin" | "menu" | "chevron";
type NavItem = { id: string; label: string; icon: NavIcon; teacher?: boolean; admin?: boolean };
const items: NavItem[] = [
  { id:"", label:"Главная", icon:"home" },
  { id:"subjects", label:"Предметы", icon:"subjects" },
  { id:"groups", label:"Группы и классы", icon:"groups", teacher:true },
  { id:"boards", label:"Доски", icon:"boards" },
  { id:"students", label:"Ученики", icon:"users", teacher:true },
  { id:"assignments", label:"Задания", icon:"assignments" },
  { id:"schedule", label:"Расписание", icon:"schedule" },
  { id:"progress", label:"Прогресс", icon:"progress", teacher:true },
  { id:"materials", label:"Материалы", icon:"materials", teacher:true },
  { id:"templates", label:"Шаблоны", icon:"templates", teacher:true },
  { id:"notifications", label:"Уведомления", icon:"notification" },
  { id:"profile", label:"Профиль", icon:"profile" },
  { id:"settings", label:"Настройки", icon:"settings" },
  { id:"admin", label:"Администрирование", icon:"admin", admin:true },
];
const icons: Record<NavIcon, ReactNode> = {
  search:<><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
  home:<><path d="m3 10 9-7 9 7v11H3z"/><path d="M9 21v-8h6v8"/></>,
  boards:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M10 10v10"/></>,
  subjects:<><path d="M4 4h8a4 4 0 0 1 4 4v12H8a4 4 0 0 0-4 1V4z"/><path d="M16 8a4 4 0 0 1 4-4v17a4 4 0 0 0-4-1"/></>,
  groups:<><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 14h8M8 17h5"/></>,
  users:<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 6a3 3 0 0 1 0 6M19 15a5 5 0 0 1 2 4v1"/></>,
  assignments:<><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 11h6M9 16h6"/></>,
  schedule:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15h3"/></>,
  progress:<><path d="M4 20V13M10 20V8M16 20V11M22 20V4"/></>,
  materials:<><path d="M4 4h10l2 3h4v13H4z"/><path d="M4 10h16"/></>,
  templates:<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 10h18M10 10v11"/></>,
  notification:<><path d="M6 9a6 6 0 1 1 12 0v5l2 3H4l2-3zM10 21h4"/></>,
  profile:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="m10 2-.4 2.2-2 1-2.1-.8-2 3.4 1.7 1.5v2.4l-1.7 1.5 2 3.4 2.1-.8 2 1 .4 2.2h4l.4-2.2 2-1 2.1.8 2-3.4-1.7-1.5V9.3l1.7-1.5-2-3.4-2.1.8-2-1L14 2z"/></>,
  admin:<><path d="M12 2 3 6v6c0 5 4 8 9 10 5-2 9-5 9-10V6z"/><path d="m9 12 2 2 4-4"/></>,
  menu:<><path d="M4 6h16M4 12h16M4 18h16"/></>,
  chevron:<><path d="m9 5 7 7-7 7"/></>,
};
function NavGlyph({ name }: { name:NavIcon }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}
type Props={children:ReactNode;section:string;role:AccountRole;isAdmin:boolean;name:string};
export default function LectrisWorkspaceShell({children,section,role,isAdmin,name}:Props) {
  const [collapsed,setCollapsed]=useState(()=>{try{return localStorage.getItem("lectris.shell.collapsed")==="1"}catch{return false}});
  const [moreOpen,setMoreOpen]=useState(false);
  const [menuQuery,setMenuQuery]=useState("");
  const [commandOpen,setCommandOpen]=useState(false);
  const [commandQuery,setCommandQuery]=useState("");
  const [unreadCount,setUnreadCount]=useState(0);
  useEffect(()=>{
    let active=true;
    const refresh=()=>{if(document.visibilityState==="hidden")return;void listNotifications().then(rows=>{if(active)setUnreadCount(rows.filter(x=>!x.readAt).length)}).catch(()=>{})};
    refresh();
    const timer=window.setInterval(refresh,60000);
    const wake=()=>{if(document.visibilityState==="visible")refresh()};
    window.addEventListener("focus",wake);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener("focus",wake)};
  },[section]);

  const available=items.filter(x=>(!x.teacher||role==="teacher")&&(!x.admin||isAdmin));
  const active=available.some(x=>x.id===section)?section:"";
  useEffect(()=>{setMoreOpen(false);setMenuQuery("");setCommandOpen(false);setCommandQuery("")},[section]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){
        event.preventDefault();setCommandOpen(prev=>!prev);
      }else if(event.key==="Escape")setCommandOpen(false);
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[]);
  useEffect(()=>{
    if(!moreOpen)return;
    const onEscape=(event:KeyboardEvent)=>{if(event.key==="Escape")setMoreOpen(false)};
    window.addEventListener("keydown",onEscape);
    return()=>window.removeEventListener("keydown",onEscape);
  },[moreOpen]);
  const move=(target:string)=>{
    setMoreOpen(false);
    setMenuQuery("");
    setCommandOpen(false);
    setCommandQuery("");
    window.history.pushState({}, "",target?"/?section="+encodeURIComponent(target):"/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  const toggle=()=>setCollapsed(prev=>{const next=!prev;try{localStorage.setItem("lectris.shell.collapsed",next?"1":"0")}catch{}return next});
  const mainTabs=available.filter(x=>["","boards","assignments","schedule"].includes(x.id));
  const commandResults=available.filter(entry=>entry.label.toLocaleLowerCase("ru-RU").includes(commandQuery.trim().toLocaleLowerCase("ru-RU")));
  const navButton=(entry:NavItem, className="")=><button key={entry.id} type="button" className={["lectris-nav-link",className,active===entry.id?"is-active":""].filter(Boolean).join(" ")} title={entry.label} aria-label={entry.label} aria-current={active===entry.id?"page":undefined} onClick={()=>move(entry.id)}><NavGlyph name={entry.icon}/><span>{entry.label}</span>{entry.id==="notifications"&&unreadCount>0&&<b className="lectris-unread-badge">{unreadCount>99?"99+":unreadCount}</b>}</button>;
  return <div className={`lectris-workspace ${collapsed?"is-collapsed":""}`}>
    <header className="lectris-workspace-header">
      <button className="lectris-brand" type="button" onClick={()=>move("")} aria-label="Lektrus, главная"><span className="lectris-brand-mark" aria-hidden="true" style={{background:"transparent",boxShadow:"none",padding:0,overflow:"visible"}}><img src={`/lektrus-logo-${active===""?readLectrisPalette():"sapphire"}.png`} alt="" width="30" height="30" style={{display:"block",width:"100%",height:"100%",objectFit:"contain"}} /></span><strong>Lektrus</strong></button>
      <span className="lectris-header-divider" aria-hidden="true"/>
      <div className="lectris-header-page"><span>{available.find(x=>x.id===active)?.label||"Главная"}</span><small>{role==="teacher"?"Преподаватель":"Ученик"}</small></div>
      <div className="lectris-header-actions">
        <button type="button" className="lectris-header-search" title="Найти раздел (Ctrl+K)" aria-label="Поиск по разделам Lektrus" onClick={()=>setCommandOpen(true)}>
          <NavGlyph name="search"/><span>Поиск по разделам</span><kbd>Ctrl K</kbd>
        </button>
        <button type="button" className="lectris-header-icon" title="Уведомления" aria-label="Уведомления" onClick={()=>move("notifications")}><NavGlyph name="notification"/>{unreadCount>0&&<span className="lectris-unread-dot" aria-label={"Непрочитанных уведомлений: "+unreadCount}/>}</button>
        <button type="button" className="lectris-header-account" onClick={()=>move("profile")} title="Открыть профиль"><span className="lectris-avatar">{name.trim().slice(0,1).toUpperCase()||"?"}</span><span className="lectris-account-name">{name}</span></button>
      </div>
    </header>
    <div className="lectris-workspace-body">
      <aside className="lectris-workspace-sidebar" aria-label="Основная навигация">
        <div className="lectris-sidebar-head"><span>РАЗДЕЛЫ</span><button className="lectris-collapse-button" type="button" aria-label={collapsed?"Развернуть меню":"Свернуть меню"} title={collapsed?"Развернуть меню":"Свернуть меню"} onClick={toggle}><NavGlyph name={collapsed?"menu":"chevron"}/></button></div>
        <nav className="lectris-workspace-links">
          <div className="lectris-nav-group">
            <span className="lectris-nav-group-title">Рабочий стол</span>
            {available.filter(x=>["","boards","subjects","groups"].includes(x.id)).map(x=>navButton(x))}
          </div>
          <div className="lectris-nav-group">
            <span className="lectris-nav-group-title">Учебный процесс</span>
            {available.filter(x=>["students","assignments","schedule","progress"].includes(x.id)).map(x=>navButton(x))}
          </div>
          <div className="lectris-nav-group">
            <span className="lectris-nav-group-title">Библиотека и события</span>
            {available.filter(x=>["materials","templates","notifications"].includes(x.id)).map(x=>navButton(x))}
          </div>
        </nav>
        <div className="lectris-sidebar-footer">
          {available.filter(x=>["profile","settings","admin"].includes(x.id)).map(x=>navButton(x))}
        </div>
      </aside>
      <div className="lectris-workspace-stage">{children}</div>
    </div>
    <nav className="lectris-mobile-bottom" aria-label="Навигация Lektrus">
      {mainTabs.map(x=>navButton(x,"lectris-mobile-tab"))}
      <button type="button" className={`lectris-nav-link lectris-mobile-tab ${moreOpen||!mainTabs.some(tab=>tab.id===active)?"is-active":""}`} aria-label="Ещё разделы" aria-expanded={moreOpen} onClick={()=>setMoreOpen(v=>!v)}><NavGlyph name="menu"/><span>Ещё</span></button>
    </nav>
    {commandOpen&&<div className="lectris-command-overlay" onPointerDown={event=>{if(event.target===event.currentTarget)setCommandOpen(false)}}>
      <section className="lectris-command-dialog" role="dialog" aria-modal="true" aria-label="Быстрый переход по разделам">
        <div className="lectris-command-input-row">
          <NavGlyph name="search"/>
          <input autoFocus type="search" aria-label="Название раздела" placeholder="Куда перейти?"
            value={commandQuery} onChange={event=>setCommandQuery(event.target.value)}
            onKeyDown={event=>{if(event.key==="Enter"&&commandResults.length){event.preventDefault();move(commandResults[0].id)}}}/>
          <button type="button" onClick={()=>setCommandOpen(false)} aria-label="Закрыть поиск">Esc</button>
        </div>
        <div className="lectris-command-results" role="list">
          {commandResults.length?commandResults.map(entry=><button role="listitem" type="button" key={entry.id} onClick={()=>move(entry.id)}>
            <NavGlyph name={entry.icon}/><span>{entry.label}</span><span aria-hidden="true">↗</span>
          </button>):<p>Раздел не найден. Попробуйте другое название.</p>}
        </div>
        <div className="lectris-command-hint">Enter: первый результат · Esc: закрыть</div>
      </section>
    </div>}
    {moreOpen&&<>
      <button type="button" tabIndex={-1} aria-label="Закрыть меню разделов"
        className="lectris-mobile-more-backdrop" onClick={()=>setMoreOpen(false)}/>
      <div className="lectris-mobile-more" role="dialog" aria-modal="true" aria-label="Другие разделы">
        <div className="lectris-mobile-more-head"><strong>Разделы Lektrus</strong><button type="button" onClick={()=>setMoreOpen(false)} aria-label="Закрыть">×</button></div>
        <input type="search" className="lectris-mobile-more-search" placeholder="Найти раздел"
          value={menuQuery} onChange={event=>setMenuQuery(event.target.value)} aria-label="Поиск раздела"/>
        {available.filter(x=>!mainTabs.some(tab=>tab.id===x.id)&&x.label.toLocaleLowerCase("ru-RU").includes(menuQuery.trim().toLocaleLowerCase("ru-RU"))).map(x=>navButton(x))}
        {!available.some(x=>!mainTabs.some(tab=>tab.id===x.id)&&x.label.toLocaleLowerCase("ru-RU").includes(menuQuery.trim().toLocaleLowerCase("ru-RU")))&&<p className="lectris-mobile-more-empty">Разделы не найдены</p>}
      </div>
    </>}
  </div>;
}
