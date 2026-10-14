import { useEffect, useState, type ReactNode } from "react";
import type { AccountRole } from "./accountRoleStore";

type NavIcon = "home" | "boards" | "users" | "assignments" | "schedule" | "progress" | "materials" | "templates" | "notification" | "profile" | "settings" | "admin" | "menu" | "chevron";
type NavItem = { id: string; label: string; icon: NavIcon; teacher?: boolean; admin?: boolean };
const items: NavItem[] = [
  { id:"", label:"Главная", icon:"home" },
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
  home:<><path d="m3 10 9-7 9 7v11H3z"/><path d="M9 21v-8h6v8"/></>,
  boards:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M10 10v10"/></>,
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
  const available=items.filter(x=>(!x.teacher||role==="teacher")&&(!x.admin||isAdmin));
  const active=available.some(x=>x.id===section)?section:"";
  useEffect(()=>setMoreOpen(false),[section]);
  const move=(target:string)=>{
    setMoreOpen(false);
    window.history.pushState({}, "",target?"/?section="+encodeURIComponent(target):"/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  const toggle=()=>setCollapsed(prev=>{const next=!prev;try{localStorage.setItem("lectris.shell.collapsed",next?"1":"0")}catch{}return next});
  const mainTabs=available.filter(x=>["","boards","assignments","schedule"].includes(x.id));
  const navButton=(entry:NavItem, className="")=><button key={entry.id} type="button" className={["lectris-nav-link",className,active===entry.id?"is-active":""].filter(Boolean).join(" ")} title={entry.label} aria-label={entry.label} aria-current={active===entry.id?"page":undefined} onClick={()=>move(entry.id)}><NavGlyph name={entry.icon}/><span>{entry.label}</span></button>;
  return <div className={`lectris-workspace ${collapsed?"is-collapsed":""}`}>
    <header className="lectris-workspace-header">
      <button className="lectris-brand" type="button" onClick={()=>move("")} aria-label="Lectris, главная"><span className="lectris-brand-mark" aria-hidden="true">L</span><strong>Lectris</strong></button>
      <span className="lectris-header-divider" aria-hidden="true"/>
      <div className="lectris-header-page"><span>{available.find(x=>x.id===active)?.label||"Главная"}</span><small>{role==="teacher"?"Преподаватель":"Ученик"}</small></div>
      <div className="lectris-header-actions">
        <button type="button" className="lectris-header-icon" title="Уведомления" aria-label="Уведомления" onClick={()=>move("notifications")}><NavGlyph name="notification"/></button>
        <button type="button" className="lectris-header-account" onClick={()=>move("profile")} title="Открыть профиль"><span className="lectris-avatar">{name.trim().slice(0,1).toUpperCase()||"?"}</span><span className="lectris-account-name">{name}</span></button>
      </div>
    </header>
    <div className="lectris-workspace-body">
      <aside className="lectris-workspace-sidebar" aria-label="Основная навигация">
        <div className="lectris-sidebar-head"><span>РАЗДЕЛЫ</span><button className="lectris-collapse-button" type="button" aria-label={collapsed?"Развернуть меню":"Свернуть меню"} title={collapsed?"Развернуть меню":"Свернуть меню"} onClick={toggle}><NavGlyph name={collapsed?"menu":"chevron"}/></button></div>
        <nav className="lectris-workspace-links">
          {available.filter(x=>!["profile","settings","admin"].includes(x.id)).map(x=>navButton(x))}
        </nav>
        <div className="lectris-sidebar-footer">
          {available.filter(x=>["profile","settings","admin"].includes(x.id)).map(x=>navButton(x))}
        </div>
      </aside>
      <div className="lectris-workspace-stage">{children}</div>
    </div>
    <nav className="lectris-mobile-bottom" aria-label="Навигация Lectris">
      {mainTabs.map(x=>navButton(x,"lectris-mobile-tab"))}
      <button type="button" className={`lectris-nav-link lectris-mobile-tab ${moreOpen||!mainTabs.some(tab=>tab.id===active)?"is-active":""}`} aria-label="Ещё разделы" aria-expanded={moreOpen} onClick={()=>setMoreOpen(v=>!v)}><NavGlyph name="menu"/><span>Ещё</span></button>
    </nav>
    {moreOpen&&<div className="lectris-mobile-more" role="dialog" aria-label="Другие разделы">
      <div className="lectris-mobile-more-head"><strong>Разделы Lectris</strong><button type="button" onClick={()=>setMoreOpen(false)} aria-label="Закрыть">×</button></div>
      {available.filter(x=>!mainTabs.some(tab=>tab.id===x.id)).map(x=>navButton(x))}
    </div>}
  </div>;
}
