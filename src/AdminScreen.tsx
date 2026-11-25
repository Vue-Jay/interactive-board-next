import { useEffect,useMemo,useRef,useState } from "react";
import UserAvatar from "./UserAvatar";
import type { AuthUser } from "./authStore";
import { adminDeleteUser,canAdminDeleteUsers,adminSetSubscription,listAdminUsers,listTeacherRequests,reviewTeacherRequest,type AdminUser,type SubscriptionPlan,type TeacherRequest } from "./accountRoleStore";
import { listAdminBoards,listAdminUserWorkspace,type AdminBoardSummary,type BoardSummary } from "./boardStore";
import {listPreviewTeacherRequests,removePreviewTeacherRequest} from "./previewTeacherRequestsStore";
import {listProductFeedback} from "./productFeedbackStore";
import AdminMailPanel from "./AdminMailPanel";
import AdminNewsPanel from "./AdminNewsPanel";
import AdminMaintenancePanel from "./AdminMaintenancePanel";
import AdminFinancePanel from "./AdminFinancePanel";
import AdminStoragePanel from "./AdminStoragePanel";
import "./AdminScreen.css";

type RolePreview="actual"|"teacher"|"student";
type Props={user:AuthUser;onBack:()=>void;onOpenBoard:(board:BoardSummary)=>void;onOpenLayout:()=>Promise<void>;invisible:boolean;onInvisibleChange:(value:boolean)=>void;adminEdit:boolean;onAdminEditChange:(value:boolean)=>void;rolePreview:RolePreview;onRolePreviewChange:(role:RolePreview)=>void;onCheckRegistration:()=>void};
const fmt=(x:string|null,withTime=false)=>x?new Intl.DateTimeFormat("ru-RU",withTime?{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}:{day:"2-digit",month:"long",year:"numeric"}).format(new Date(x)):"—";
const PLAN_LABEL:Record<SubscriptionPlan,string>={free:"Бесплатный",pro:"PRO"};
const isoDate=(days:number)=>{const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)};

type AdminTab="users"|"boards"|"feedback"|"news"|"maintenance"|"finance"|"storage";
type AdminIconName=AdminTab|"back"|"refresh"|"settings"|"chevron"|"search"|"edit"|"eye"|"shield";
const adminIcons:Record<AdminIconName,string>={
 users:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8",
 boards:"M3 4h18v13H3zM8 21l4-4 4 4M7 8h10m-10 4h6",
 feedback:"M3 5h18v14H3zM3 6l9 7 9-7",
 news:"M4 3h13v18H4zM17 7h4v12a2 2 0 0 1-2 2h-2M7 7h7m-7 4h7m-7 4h7",
 finance:"M4 20h16M7 16V9m5 7V4m5 12v-5",
 storage:"M4 5h16l2 9H2l2-9ZM2 14v5h20v-5M6 17h.01M10 17h.01",
 maintenance:"M14 6a5 5 0 0 0-6 6L3 17l4 4 5-5a5 5 0 0 0 6-6l-3 3-4-4 3-3Z",
 back:"M19 12H5m7-7-7 7 7 7",refresh:"M20 11a8 8 0 1 0-2 6M20 4v7h-7",settings:"M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M10 15v6",chevron:"m9 18 6-6-6-6",search:"M15 15l5 5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",edit:"m14 5 5 5M4 20l5-1L21 7l-5-5L4 14z",eye:"M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0",shield:"M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11ZM9 12l2 2 4-4"
};
function AdminIcon({name}:{name:AdminIconName}){return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={adminIcons[name]}/></svg>}
const adminTabs:readonly [AdminTab,string][]=[["users","Пользователи"],["boards","Доски"],["feedback","Почта"],["news","Новости"],["finance","Финансы"],["storage","Хранилище"],["maintenance","Техработы"]];

export default function AdminScreen({user,onBack,onOpenBoard,onOpenLayout,invisible,onInvisibleChange,adminEdit,onAdminEditChange,rolePreview,onRolePreviewChange,onCheckRegistration}:Props){
 const [tab,setTab]=useState<AdminTab>(()=>new URLSearchParams(window.location.search).get("mail")==="1"?"feedback":"users");
 const [users,setUsers]=useState<AdminUser[]>([]),[requests,setRequests]=useState<Array<TeacherRequest&{isPreview?:boolean}>>([]),[boards,setBoards]=useState<AdminBoardSummary[]>([]);
 const [refreshing,setRefreshing]=useState(false),[loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(""),[notice,setNotice]=useState(""),[query,setQuery]=useState(""),[boardQuery,setBoardQuery]=useState("");
 const [sort,setSort]=useState("newest"),[roleFilter,setRoleFilter]=useState("all");
 const [previewUserId,setPreviewUserId]=useState<string|null>(null);
 const [workspaceBoards,setWorkspaceBoards]=useState<AdminBoardSummary[]>([]);
 const [workspaceLoading,setWorkspaceLoading]=useState(false);
 const [workspaceError,setWorkspaceError]=useState("");
 const workspaceRequest=useRef(0);
 const [unread,setUnread]=useState(0);
 const [drafts,setDrafts]=useState<Record<string,{plan:SubscriptionPlan;until:string}>>({});
 const load=async()=>{setRefreshing(true);try{const [u,r,b]=await Promise.all([listAdminUsers(),listTeacherRequests(),listAdminBoards()]);setUsers(u);setRequests([...listPreviewTeacherRequests(),...r]);setBoards(b);setDrafts(current=>{const next={...current};for(const x of u)if(!next[x.userId])next[x.userId]={plan:x.subscriptionPlan,until:x.subscriptionUntil?.slice(0,10)??isoDate(30)};return next});setLoaded(true)}catch(e){setNotice(e instanceof Error?e.message:"Не удалось загрузить данные администратора")}finally{setRefreshing(false)}};
 useEffect(()=>{void load();void listProductFeedback().then(rows=>setUnread(rows.filter(x=>x.status==="new").length)).catch(()=>{});return()=>{workspaceRequest.current++}},[]);
 const filtered=useMemo(()=>{const q=query.trim().toLocaleLowerCase("ru");const role=(x:AdminUser)=>x.isAdmin?"admin":x.role;const time=(x:AdminUser)=>x.createdAt?new Date(x.createdAt).getTime():0;return users.filter(x=>(!q||`${x.name} ${x.email}`.toLocaleLowerCase("ru").includes(q))&&(roleFilter==="all"||(roleFilter==="pending"?x.teacherStatus==="pending":role(x)===roleFilter))).sort((a,b)=>sort==="oldest"?time(a)-time(b):sort==="name"?a.name.localeCompare(b.name,"ru"):sort==="email"?a.email.localeCompare(b.email):sort==="role"?role(a).localeCompare(role(b))||a.name.localeCompare(b.name,"ru"):time(b)-time(a))},[users,query,sort,roleFilter]);
 const closeWorkspace=()=>{workspaceRequest.current++;setPreviewUserId(null);setWorkspaceBoards([]);setWorkspaceLoading(false);setWorkspaceError("")};
 const openWorkspace=async(userId:string)=>{
  const request=++workspaceRequest.current;
  setPreviewUserId(userId);setWorkspaceBoards([]);setWorkspaceError("");setWorkspaceLoading(true);
  try{const rows=await listAdminUserWorkspace(userId);if(request===workspaceRequest.current)setWorkspaceBoards(rows)}
  catch(e){if(request===workspaceRequest.current)setWorkspaceError(e instanceof Error?e.message:"Не удалось получить рабочее пространство")}
  finally{if(request===workspaceRequest.current)setWorkspaceLoading(false)}
 };
 const toggleWorkspace=(userId:string)=>{if(previewUserId===userId)closeWorkspace();else void openWorkspace(userId)};
 const filteredBoards=useMemo(()=>{const q=boardQuery.trim().toLocaleLowerCase("ru");return !q?boards:boards.filter(x=>`${x.title} ${x.ownerName} ${x.ownerEmail}`.toLocaleLowerCase("ru").includes(q))},[boards,boardQuery]);
 const review=async(id:string,approve:boolean)=>{setBusy(id);try{await reviewTeacherRequest(id,approve);setNotice(approve?"Преподаватель одобрен":"Доступ преподавателя отозван");await load()}catch(e){setNotice(e instanceof Error?e.message:"Не удалось изменить доступ")}finally{setBusy("")}};
 const grant=async(x:AdminUser)=>{const draft=drafts[x.userId]??{plan:x.subscriptionPlan,until:isoDate(30)};setBusy(x.userId);try{await adminSetSubscription(x.userId,draft.plan,draft.plan==="free"?null:new Date(`${draft.until}T23:59:59`).toISOString());setNotice(draft.plan==="free"?`Тариф ${x.name} сброшен на бесплатный`:`${PLAN_LABEL[draft.plan]} выдан пользователю ${x.name}`);await load()}catch(e){setNotice(e instanceof Error?e.message:"Не удалось изменить тариф")}finally{setBusy("")}};
 const removeUser=async(x:AdminUser)=>{
  if(!canAdminDeleteUsers()||x.isAdmin||x.userId===user.id||busy)return;
  const email=window.prompt(`Удалить пользователя ${x.name} (\n${x.email})?\n\nАккаунт, его доски, личные данные и переписки будут удалены навсегда. Чужие доски останутся.\nДля подтверждения введи его email полностью:`);
  if(email===null)return;
  if(email.trim().toLowerCase()!==x.email.toLowerCase()){setNotice("Удаление отменено: email не совпадает.");return}
  setBusy(x.userId);
  try{
   const result=await adminDeleteUser(x.userId,email.trim());
   setUsers(rows=>rows.filter(row=>row.userId!==x.userId));
   setRequests(rows=>rows.filter(row=>row.userId!==x.userId));
   if(previewUserId===x.userId)closeWorkspace();
   setNotice(result.files_pending?`Пользователь ${x.email} удалён. Некоторые закрытые файлы требуют очистки.`:`Пользователь ${x.email} удалён.`);
   await load();
  }catch(e){setNotice(e instanceof Error?e.message:"Не удалось удалить пользователя")}
  finally{setBusy("")}
 };
 const pending=requests.filter(x=>x.status==="pending"),history=requests.filter(x=>x.status!=="pending");
 return <main className="students-shell admin-users-shell admin-redesign">
  <section className="students-content">
   <header className="admin-page-header"><div className="admin-page-actions"><button type="button" className="admin-back" onClick={onBack}><AdminIcon name="back"/>Назад</button><button type="button" className="admin-refresh" disabled={refreshing} onClick={()=>{setNotice("");void load();void listProductFeedback().then(rows=>setUnread(rows.filter(x=>x.status==="new").length)).catch(()=>{})}} aria-label="Обновить сводку"><AdminIcon name="refresh"/>{refreshing?"Обновление…":"Обновить"}</button></div><div className="admin-heading"><span className="admin-heading-icon"><AdminIcon name="shield"/></span><div><h1>Администрирование</h1><p>Управление платформой и пользователями</p></div></div></header>
   {notice&&<div className="access-notice admin-page-notice" role="status">{notice}<button type="button" onClick={()=>setNotice("")} aria-label="Закрыть сообщение">×</button></div>}
   <nav className="admin-section-nav" aria-label="Разделы администрирования">{adminTabs.map(([key,label])=>{const count=key==="users"&&loaded?users.length:key==="boards"&&loaded?boards.length:key==="feedback"&&unread>0?unread:null;return <button type="button" key={key} className={tab===key?"active":""} aria-pressed={tab===key} onClick={()=>setTab(key)}><AdminIcon name={key}/><span className="admin-nav-label">{label}</span>{count!==null&&<span className="admin-nav-count">{count}</span>}</button>})}</nav>
   <details className="admin-tools admin-control-panel"><summary><AdminIcon name="settings"/><span className="admin-control-summary"><strong>Режимы и инструменты</strong><small>{adminEdit?"Редактирование":"Только просмотр"} · {invisible?"Невидимка включена":"Присутствие видно"}</small></span><AdminIcon name="chevron"/></summary>
    <div className="admin-mode-grid"><label className="admin-mode-switch"><AdminIcon name="edit"/><span className="admin-mode-copy"><strong>Редактирование</strong><small>{adminEdit?"Изменения на чужих досках сохраняются":"Только просмотр чужих досок"}</small></span><input type="checkbox" role="switch" aria-label="Редактирование" checked={adminEdit} onChange={e=>onAdminEditChange(e.target.checked)}/><span className="admin-mode-track" aria-hidden="true"/></label><label className="admin-mode-switch"><AdminIcon name="eye"/><span className="admin-mode-copy"><strong>Невидимка</strong><small>{invisible?"Вы не отображаетесь на досках":"Ваше присутствие видно участникам"}</small></span><input type="checkbox" role="switch" aria-label="Невидимка" checked={invisible} onChange={e=>onInvisibleChange(e.target.checked)}/><span className="admin-mode-track" aria-hidden="true"/></label></div>
   <section className="admin-role-preview" aria-label="Проверка интерфейса по ролям"><div className="admin-role-preview-copy"><strong>Просмотр приложения по ролям</strong><small>Меню меняется для проверки, аккаунт и права доступа остаются прежними.</small></div><div className="admin-role-preview-options" role="group" aria-label="Выбрать роль для просмотра">{([ ["actual","Администратор"],["teacher","Преподаватель"],["student","Ученик"] ] as const).map(([value,label])=><button type="button" key={value} className={rolePreview===value?"active":""} aria-pressed={rolePreview===value} onClick={()=>onRolePreviewChange(value)}>{label}</button>)}</div>{rolePreview==="actual"&&<button type="button" className="admin-role-preview-registration" onClick={onCheckRegistration}>Проверить регистрацию</button>}</section>
    <div className="admin-tools-actions"><button className="boards-secondary" onClick={()=>void onOpenLayout().catch(e=>setNotice(e instanceof Error?e.message:"Не удалось открыть редактор интерфейса"))}>Конструктор интерфейса</button><button className="boards-secondary" onClick={()=>window.location.assign("/site-builder")}>Конструктор сайта</button></div>
   </details>
   {tab==="users"?<>
    <div className="admin-users-toolbar"><div><h2>Пользователи</h2><span>{loaded?`Найдено ${filtered.length} из ${users.length}`:"Загрузка пользователей…"}</span></div></div>
    <div className="admin-user-filters"><label className="admin-search"><AdminIcon name="search"/><input type="search" aria-label="Поиск пользователей" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Имя или email"/></label><select aria-label="Роль пользователя" value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option value="all">Все роли</option><option value="admin">Администраторы</option><option value="teacher">Преподаватели</option><option value="student">Ученики</option><option value="pending">Ожидают одобрения</option></select><select aria-label="Сортировка пользователей" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Сначала новые</option><option value="oldest">Сначала старые</option><option value="name">По имени</option><option value="email">По email</option><option value="role">По роли</option></select></div>
    {(pending.length>0||history.length>0)&&<details className="admin-teacher-requests"><summary><span className="admin-summary-title">Заявки преподавателей</span><span className="admin-count-pill">{pending.length} новых</span><AdminIcon name="chevron"/></summary>
    <div className="admin-approval-head"><h2>Заявки преподавателей</h2><span>{pending.length} ожидают решения</span></div>
    {pending.length===0?<div className="boards-empty"><strong>Новых заявок нет</strong><span>Когда пользователь запросит роль преподавателя, его анкета появится здесь.</span></div>:<div className="admin-request-list">{pending.map(x=><article className="admin-teacher-request-card" key={x.userId}><div className="admin-teacher-request-main"><strong>{x.name}{x.isPreview&&<em className="admin-preview-request-badge">Тестовая заявка</em>}</strong><span>{x.email}</span><small>Заявка: {fmt(x.requestedAt,true)}{x.isPreview?" · только в этом браузере":""}</small>{x.application&&<dl className="admin-teacher-application"><div><dt>Предметы</dt><dd>{x.application.focusArea||"—"}</dd></div><div><dt>Место работы</dt><dd>{x.application.organization||"—"}</dd></div>{x.application.phone&&<div><dt>Телефон</dt><dd>{x.application.phone}</dd></div>}{x.application.city&&<div><dt>Город</dt><dd>{x.application.city}</dd></div>}{x.application.experience&&<div className="admin-teacher-application-full"><dt>Опыт</dt><dd>{x.application.experience}</dd></div>}{x.application.motivation&&<div className="admin-teacher-application-full"><dt>Комментарий</dt><dd>{x.application.motivation}</dd></div>}</dl>}</div><div className="admin-teacher-request-actions">{x.isPreview?<button className="danger" onClick={()=>{removePreviewTeacherRequest(x.userId);setNotice("Тестовая заявка удалена");void load()}}>Удалить тестовую заявку</button>:<><button className="students-primary" disabled={busy===x.userId} onClick={()=>void review(x.userId,true)}>Одобрить</button><button className="danger" disabled={busy===x.userId} onClick={()=>void review(x.userId,false)}>Отклонить</button></>}</div></article>)}</div>}
    <div className="admin-approval-head"><h2>История решений</h2><span>{history.length}</span></div>
    <div className="admin-request-list">{history.map(x=><article key={x.userId}><div><strong>{x.name}</strong><span>{x.email}</span><small>{x.status==="approved"?"Одобрен":"Отклонён"} · {fmt(x.reviewedAt,true)}</small></div>{x.status==="approved"?<button className="danger" disabled={busy===x.userId} onClick={()=>void review(x.userId,false)}>Отозвать доступ</button>:<button disabled={busy===x.userId} onClick={()=>void review(x.userId,true)}>Одобрить</button>}</article>)}</div>
    </details>}
    <div className="admin-users-list">{filtered.map(x=>{const draft=drafts[x.userId]??{plan:x.subscriptionPlan,until:x.subscriptionUntil?.slice(0,10)??isoDate(30)};const active=x.subscriptionPlan!=="free"&&(!x.subscriptionUntil||new Date(x.subscriptionUntil)>new Date());const expanded=previewUserId===x.userId;const panelId=`admin-workspace-${x.userId}`;return <article className={`admin-user-card${expanded?" is-workspace-open":""}`} key={x.userId} data-admin-user={x.userId}>
      <div className="admin-user-main"><div className="admin-user-avatar"><UserAvatar/></div><div className="admin-user-identity"><strong>{x.name}</strong><span>{x.email}</span><small>{x.isAdmin?"Администратор":x.role==="teacher"?"Преподаватель":"Ученик"}{x.createdAt?` · с ${fmt(x.createdAt)}`:""}</small></div><div className="admin-user-actions"><button type="button" className="boards-secondary admin-user-boards-toggle" disabled={!!busy||x.isAdmin} aria-expanded={expanded} aria-controls={expanded?panelId:undefined} onClick={()=>toggleWorkspace(x.userId)}>{expanded?"Свернуть":"Доски"}<svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4"/></svg></button>{canAdminDeleteUsers()&&!x.isAdmin&&x.userId!==user.id&&<button type="button" className="boards-secondary danger" aria-label={`Удалить пользователя ${x.email}`} disabled={!!busy} onClick={()=>void removeUser(x)}>Удалить</button>}</div></div>
      
      <div className="admin-user-current"><span>Тариф</span><strong className={`admin-plan admin-plan-${x.isAdmin?"admin":x.subscriptionPlan}`}>{x.isAdmin?"Администратор":PLAN_LABEL[x.subscriptionPlan]}</strong><small>{x.isAdmin?"Без тарифных лимитов":x.subscriptionPlan==="free"?"Без подписки":active?`до ${fmt(x.subscriptionUntil)}`:`истёк ${fmt(x.subscriptionUntil)}`}</small></div>
      <details className="admin-user-settings"><summary><span>Изменить тариф</span><AdminIcon name="chevron"/></summary><div className="admin-user-grant"><label>Выдать тариф<select value={draft.plan} onChange={e=>setDrafts(v=>({...v,[x.userId]:{...draft,plan:e.target.value as SubscriptionPlan}}))}><option value="free">Бесплатный</option><option value="pro">PRO</option></select></label><label>До даты<input type="date" disabled={draft.plan==="free"} value={draft.until} min={new Date().toISOString().slice(0,10)} onChange={e=>setDrafts(v=>({...v,[x.userId]:{...draft,until:e.target.value}}))}/></label><div className="admin-duration-buttons"><button type="button" disabled={draft.plan==="free"} onClick={()=>setDrafts(v=>({...v,[x.userId]:{...draft,until:isoDate(30)}}))}>30 дн.</button><button type="button" disabled={draft.plan==="free"} onClick={()=>setDrafts(v=>({...v,[x.userId]:{...draft,until:isoDate(90)}}))}>90 дн.</button><button type="button" disabled={draft.plan==="free"} onClick={()=>setDrafts(v=>({...v,[x.userId]:{...draft,until:isoDate(365)}}))}>Год</button></div><button className="students-primary admin-grant-button" disabled={busy===x.userId||(!draft.until&&draft.plan!=="free")} onClick={()=>void grant(x)}>{busy===x.userId?"Сохраняем…":draft.plan==="free"?"Сбросить тариф":"Выдать"}</button></div></details>
      {expanded&&<section id={panelId} className="admin-user-workspace" aria-label={`Доски пользователя ${x.name}`} aria-busy={workspaceLoading}>
       <div className="admin-user-workspace-head"><h3>Доски пользователя</h3>{!workspaceLoading&&!workspaceError&&<span>{workspaceBoards.length}</span>}</div>
       {workspaceLoading?<div className="boards-empty" role="status">Загрузка досок…</div>:workspaceError?<div className="admin-user-workspace-error" role="alert"><span>{workspaceError}</span><button type="button" className="boards-secondary" onClick={()=>void openWorkspace(x.userId)}>Повторить</button></div>:workspaceBoards.length===0?<div className="boards-empty">Доступных досок нет.</div>:
        <div className="admin-board-list">{workspaceBoards.map(board=><article className="admin-board-card" key={board.id}><div className="admin-board-main"><div className="admin-board-icon"><AdminIcon name="boards"/></div><div><strong>{board.title}</strong><span>Владелец: {board.ownerName}</span><small>Обновлена {fmt(board.updatedAt,true)}</small></div></div><button type="button" className="students-primary" onClick={()=>onOpenBoard(board)}>{adminEdit?"Редактировать":"Просмотреть"}</button></article>)}</div>}
      </section>}
    </article>})}</div>
        {loaded&&filtered.length===0&&<div className="boards-empty"><strong>Пользователи не найдены</strong><span>Измени строку поиска.</span></div>}
   </>:tab==="boards"?<>
    <div className="admin-users-toolbar"><div><h2>Все доски</h2><span>{adminEdit?"Режим редактирования включён":"Режим просмотра чужих досок"} · {filteredBoards.length} из {boards.length}</span></div><input type="search" aria-label="Поиск досок" value={boardQuery} onChange={e=>setBoardQuery(e.target.value)} placeholder="Название, владелец или email"/></div>
    <div className="admin-board-list">{filteredBoards.map(board=><article className="admin-board-card" key={board.id}><div className="admin-board-main"><div className="admin-board-icon"><AdminIcon name="boards"/></div><div><strong>{board.title}</strong><span>{board.ownerName}{board.ownerEmail?` · ${board.ownerEmail}`:""}</span><small>Обновлена {fmt(board.updatedAt,true)} · участников: {board.memberCount}</small></div></div><button type="button" className="students-primary" onClick={()=>onOpenBoard(board)}>Открыть</button></article>)}</div>
    {loaded&&filteredBoards.length===0&&<div className="boards-empty"><strong>Доски не найдены</strong><span>Измени строку поиска.</span></div>}
   </>:tab==="news"?<AdminNewsPanel/>:tab==="finance"?<AdminFinancePanel/>:tab==="storage"?<AdminStoragePanel/>:tab==="maintenance"?<AdminMaintenancePanel users={users}/>:<AdminMailPanel onUnread={setUnread}/>}
  </section>
 </main>
}
