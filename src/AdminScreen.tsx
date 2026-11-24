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

type RolePreview="actual"|"teacher"|"student";
type Props={user:AuthUser;onBack:()=>void;onOpenBoard:(board:BoardSummary)=>void;onOpenLayout:()=>Promise<void>;invisible:boolean;onInvisibleChange:(value:boolean)=>void;adminEdit:boolean;onAdminEditChange:(value:boolean)=>void;rolePreview:RolePreview;onRolePreviewChange:(role:RolePreview)=>void;onCheckRegistration:()=>void};
const fmt=(x:string|null,withTime=false)=>x?new Intl.DateTimeFormat("ru-RU",withTime?{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}:{day:"2-digit",month:"long",year:"numeric"}).format(new Date(x)):"—";
const PLAN_LABEL:Record<SubscriptionPlan,string>={free:"Бесплатный",pro:"PRO"};
const isoDate=(days:number)=>{const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)};

export default function AdminScreen({user,onBack,onOpenBoard,onOpenLayout,invisible,onInvisibleChange,adminEdit,onAdminEditChange,rolePreview,onRolePreviewChange,onCheckRegistration}:Props){
 const [tab,setTab]=useState<"users"|"boards"|"feedback"|"news"|"maintenance"|"finance">(()=>new URLSearchParams(window.location.search).get("mail")==="1"?"feedback":"users");
 const [users,setUsers]=useState<AdminUser[]>([]),[requests,setRequests]=useState<Array<TeacherRequest&{isPreview?:boolean}>>([]),[boards,setBoards]=useState<AdminBoardSummary[]>([]);
 const [busy,setBusy]=useState(""),[notice,setNotice]=useState(""),[query,setQuery]=useState(""),[boardQuery,setBoardQuery]=useState("");
 const [sort,setSort]=useState("newest"),[roleFilter,setRoleFilter]=useState("all");
 const [previewUserId,setPreviewUserId]=useState<string|null>(null);
 const [workspaceBoards,setWorkspaceBoards]=useState<AdminBoardSummary[]>([]);
 const [workspaceLoading,setWorkspaceLoading]=useState(false);
 const [workspaceError,setWorkspaceError]=useState("");
 const workspaceRequest=useRef(0);
 const [unread,setUnread]=useState(0);
 const [drafts,setDrafts]=useState<Record<string,{plan:SubscriptionPlan;until:string}>>({});
 const load=async()=>{try{const [u,r,b]=await Promise.all([listAdminUsers(),listTeacherRequests(),listAdminBoards()]);setUsers(u);setRequests([...listPreviewTeacherRequests(),...r]);setBoards(b);setDrafts(current=>{const next={...current};for(const x of u)if(!next[x.userId])next[x.userId]={plan:x.subscriptionPlan,until:x.subscriptionUntil?.slice(0,10)??isoDate(30)};return next})}catch(e){setNotice(e instanceof Error?e.message:"Не удалось загрузить данные администратора")}};
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
 return <main className="students-shell admin-users-shell">
  <header className="students-header"><div><button className="boards-secondary" onClick={onBack}>← Доски</button><div><strong>Администрирование</strong><span>{user.email}</span></div></div><button className="boards-secondary" onClick={()=>void load()}>Обновить</button></header>
  <section className="students-content">
   {notice&&<div className="access-notice">{notice}</div>}
   <div className="admin-top-controls"><nav className="admin-tabs" aria-label="Разделы администрирования"><button className={tab==="users"?"active":""} onClick={()=>setTab("users")}>Пользователи <span>{users.length}</span></button><button className={tab==="boards"?"active":""} onClick={()=>setTab("boards")}>Доски <span>{boards.length}</span></button><button className={tab==="feedback"?"active":""} onClick={()=>setTab("feedback")}>Почта {unread>0&&<span>{unread}</span>}</button><button className={tab==="news"?"active":""} onClick={()=>setTab("news")}>Новости</button><button className={tab==="finance"?"active":""} onClick={()=>setTab("finance")}>Финансы</button><button className={tab==="maintenance"?"active":""} onClick={()=>setTab("maintenance")}>Техработы</button></nav><label className="admin-invisible-toggle"><input type="checkbox" checked={adminEdit} onChange={e=>onAdminEditChange(e.target.checked)}/><span className="admin-toggle-track"><span/></span><span><strong>Редактирование</strong><small>{adminEdit?"Изменения на чужих досках сохраняются":"Только просмотр чужих досок"}</small></span></label><label className="admin-invisible-toggle"><input type="checkbox" checked={invisible} onChange={e=>onInvisibleChange(e.target.checked)}/><span className="admin-toggle-track"><span/></span><span><strong>Невидимка</strong><small>{invisible?"Вы не отображаетесь на досках":"Ваше присутствие видно участникам"}</small></span></label></div>
   <details className="admin-tools"><summary>Инструменты администратора</summary>
   <section className="admin-role-preview" aria-label="Проверка интерфейса по ролям"><div className="admin-role-preview-copy"><strong>Просмотр приложения по ролям</strong><small>Меню меняется для проверки, аккаунт и права доступа остаются прежними.</small></div><div className="admin-role-preview-options" role="group" aria-label="Выбрать роль для просмотра">{([ ["actual","Администратор"],["teacher","Преподаватель"],["student","Ученик"] ] as const).map(([value,label])=><button type="button" key={value} className={rolePreview===value?"active":""} aria-pressed={rolePreview===value} onClick={()=>onRolePreviewChange(value)}>{label}</button>)}</div>{rolePreview==="actual"&&<button type="button" className="admin-role-preview-registration" onClick={onCheckRegistration}>Проверить регистрацию</button>}</section>
    <div className="admin-tools-actions"><button className="boards-secondary" onClick={()=>void onOpenLayout().catch(e=>setNotice(e instanceof Error?e.message:"Не удалось открыть редактор интерфейса"))}>Конструктор интерфейса</button><button className="boards-secondary" onClick={()=>window.location.assign("/site-builder")}>Конструктор сайта</button></div>
   </details>
   {tab==="users"?<>
    <div className="admin-users-toolbar"><div><h2>Пользователи</h2><span>Найдено {filtered.length} из {users.length}. Управление тарифами, ролями и досками.</span></div></div>
    <div className="admin-user-filters"><input type="search" aria-label="Поиск пользователей" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по имени или email"/><select aria-label="Роль пользователя" value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option value="all">Все роли</option><option value="admin">Администраторы</option><option value="teacher">Преподаватели</option><option value="student">Ученики</option><option value="pending">Ожидают одобрения</option></select><select aria-label="Сортировка пользователей" value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">Сначала новые</option><option value="oldest">Сначала старые</option><option value="name">По имени</option><option value="email">По email</option><option value="role">По роли</option></select></div>
    {(pending.length>0||history.length>0)&&<details className="admin-teacher-requests"><summary>Заявки на роль преподавателя <span>{pending.length} новых</span></summary>
    <div className="admin-approval-head"><h2>Заявки преподавателей</h2><span>{pending.length} ожидают решения</span></div>
    {pending.length===0?<div className="boards-empty"><strong>Новых заявок нет</strong><span>Когда пользователь запросит роль преподавателя, его анкета появится здесь.</span></div>:<div className="admin-request-list">{pending.map(x=><article className="admin-teacher-request-card" key={x.userId}><div className="admin-teacher-request-main"><strong>{x.name}{x.isPreview&&<em className="admin-preview-request-badge">Тестовая заявка</em>}</strong><span>{x.email}</span><small>Заявка: {fmt(x.requestedAt,true)}{x.isPreview?" · только в этом браузере":""}</small>{x.application&&<dl className="admin-teacher-application"><div><dt>Предметы</dt><dd>{x.application.focusArea||"—"}</dd></div><div><dt>Место работы</dt><dd>{x.application.organization||"—"}</dd></div>{x.application.phone&&<div><dt>Телефон</dt><dd>{x.application.phone}</dd></div>}{x.application.city&&<div><dt>Город</dt><dd>{x.application.city}</dd></div>}{x.application.experience&&<div className="admin-teacher-application-full"><dt>Опыт</dt><dd>{x.application.experience}</dd></div>}{x.application.motivation&&<div className="admin-teacher-application-full"><dt>Комментарий</dt><dd>{x.application.motivation}</dd></div>}</dl>}</div><div className="admin-teacher-request-actions">{x.isPreview?<button className="danger" onClick={()=>{removePreviewTeacherRequest(x.userId);setNotice("Тестовая заявка удалена");void load()}}>Удалить тестовую заявку</button>:<><button className="students-primary" disabled={busy===x.userId} onClick={()=>void review(x.userId,true)}>Одобрить</button><button className="danger" disabled={busy===x.userId} onClick={()=>void review(x.userId,false)}>Отклонить</button></>}</div></article>)}</div>}
    <div className="admin-approval-head"><h2>История решений</h2><span>{history.length}</span></div>
    <div className="admin-request-list">{history.map(x=><article key={x.userId}><div><strong>{x.name}</strong><span>{x.email}</span><small>{x.status==="approved"?"Одобрен":"Отклонён"} · {fmt(x.reviewedAt,true)}</small></div>{x.status==="approved"?<button className="danger" disabled={busy===x.userId} onClick={()=>void review(x.userId,false)}>Отозвать доступ</button>:<button disabled={busy===x.userId} onClick={()=>void review(x.userId,true)}>Одобрить</button>}</article>)}</div>
    </details>}
    <div className="admin-users-list">{filtered.map(x=>{const draft=drafts[x.userId]??{plan:x.subscriptionPlan,until:x.subscriptionUntil?.slice(0,10)??isoDate(30)};const active=x.subscriptionPlan!=="free"&&(!x.subscriptionUntil||new Date(x.subscriptionUntil)>new Date());const expanded=previewUserId===x.userId;const panelId=`admin-workspace-${x.userId}`;return <article className={`admin-user-card${expanded?" is-workspace-open":""}`} key={x.userId} data-admin-user={x.userId}>
      <div className="admin-user-main"><div className="admin-user-avatar"><UserAvatar/></div><div className="admin-user-identity"><strong>{x.name}</strong><span>{x.email}</span><small>{x.isAdmin?"Администратор":x.role==="teacher"?"Преподаватель":"Ученик"}{x.createdAt?` · с ${fmt(x.createdAt)}`:""}</small></div><div className="admin-user-actions"><button type="button" className="boards-secondary admin-user-boards-toggle" disabled={!!busy||x.isAdmin} aria-expanded={expanded} aria-controls={expanded?panelId:undefined} onClick={()=>toggleWorkspace(x.userId)}>{expanded?"Свернуть":"Доски"}<svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4"/></svg></button>{canAdminDeleteUsers()&&!x.isAdmin&&x.userId!==user.id&&<button type="button" className="boards-secondary danger" aria-label={`Удалить пользователя ${x.email}`} disabled={!!busy} onClick={()=>void removeUser(x)}>Удалить</button>}</div></div>
      
      <div className="admin-user-current"><span>Текущий тариф</span><strong className={`admin-plan admin-plan-${x.subscriptionPlan}`}>{PLAN_LABEL[x.subscriptionPlan]}</strong><small>{x.subscriptionPlan==="free"?"Без подписки":active?`до ${fmt(x.subscriptionUntil)}`:`истёк ${fmt(x.subscriptionUntil)}`}</small></div>
      <details className="admin-user-settings"><summary>Изменить тариф</summary><div className="admin-user-grant"><label>Выдать тариф<select value={draft.plan} onChange={e=>setDrafts(v=>({...v,[x.userId]:{...draft,plan:e.target.value as SubscriptionPlan}}))}><option value="free">Бесплатный</option><option value="pro">PRO</option></select></label><label>До даты<input type="date" disabled={draft.plan==="free"} value={draft.until} min={new Date().toISOString().slice(0,10)} onChange={e=>setDrafts(v=>({...v,[x.userId]:{...draft,until:e.target.value}}))}/></label><div className="admin-duration-buttons"><button type="button" disabled={draft.plan==="free"} onClick={()=>setDrafts(v=>({...v,[x.userId]:{...draft,until:isoDate(30)}}))}>30 дн.</button><button type="button" disabled={draft.plan==="free"} onClick={()=>setDrafts(v=>({...v,[x.userId]:{...draft,until:isoDate(90)}}))}>90 дн.</button><button type="button" disabled={draft.plan==="free"} onClick={()=>setDrafts(v=>({...v,[x.userId]:{...draft,until:isoDate(365)}}))}>Год</button></div><button className="students-primary admin-grant-button" disabled={busy===x.userId||(!draft.until&&draft.plan!=="free")} onClick={()=>void grant(x)}>{busy===x.userId?"Сохраняем…":draft.plan==="free"?"Сбросить тариф":"Выдать"}</button></div></details>
      {expanded&&<section id={panelId} className="admin-user-workspace" aria-label={`Доски пользователя ${x.name}`} aria-busy={workspaceLoading}>
       <div className="admin-user-workspace-head"><h3>Доски пользователя</h3>{!workspaceLoading&&!workspaceError&&<span>{workspaceBoards.length}</span>}</div>
       {workspaceLoading?<div className="boards-empty" role="status">Загрузка досок…</div>:workspaceError?<div className="admin-user-workspace-error" role="alert"><span>{workspaceError}</span><button type="button" className="boards-secondary" onClick={()=>void openWorkspace(x.userId)}>Повторить</button></div>:workspaceBoards.length===0?<div className="boards-empty">Доступных досок нет.</div>:
        <div className="admin-board-list">{workspaceBoards.map(board=><article className="admin-board-card" key={board.id}><div className="admin-board-main"><div className="admin-board-icon">▣</div><div><strong>{board.title}</strong><span>Владелец: {board.ownerName}</span><small>Обновлена {fmt(board.updatedAt,true)}</small></div></div><button type="button" className="students-primary" onClick={()=>onOpenBoard(board)}>{adminEdit?"Редактировать":"Просмотреть"}</button></article>)}</div>}
      </section>}
    </article>})}</div>
        {filtered.length===0&&<div className="boards-empty"><strong>Пользователи не найдены</strong><span>Измени строку поиска.</span></div>}
   </>:tab==="boards"?<>
    <div className="admin-users-toolbar"><div><h2>Все доски</h2><span>Режим открытия задаётся переключателем «Редактирование» рядом с «Невидимкой».</span></div><input value={boardQuery} onChange={e=>setBoardQuery(e.target.value)} placeholder="Название, владелец или email"/></div>
    <div className="admin-board-list">{filteredBoards.map(board=><article className="admin-board-card" key={board.id}><div className="admin-board-main"><div className="admin-board-icon">▣</div><div><strong>{board.title}</strong><span>{board.ownerName}{board.ownerEmail?` · ${board.ownerEmail}`:""}</span><small>Обновлена {fmt(board.updatedAt,true)} · участников: {board.memberCount}</small></div></div><button type="button" className="students-primary" onClick={()=>onOpenBoard(board)}>Открыть</button></article>)}</div>
    {filteredBoards.length===0&&<div className="boards-empty"><strong>Доски не найдены</strong><span>Измени строку поиска.</span></div>}
   </>:tab==="news"?<AdminNewsPanel/>:tab==="finance"?<AdminFinancePanel/>:tab==="maintenance"?<AdminMaintenancePanel users={users}/>:<AdminMailPanel onUnread={setUnread}/>}
  </section>
 </main>
}
