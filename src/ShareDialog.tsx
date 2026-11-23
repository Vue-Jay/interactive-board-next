import { useEffect, useState } from "react";
import "./lektrusShareDialog.css";
import { type AuthUser, type BoardRole, BOARD_ROLE_LABELS, PARTICIPANT_ROLE_LABELS, participantAccess, participantRoleFor, type InvitedParticipantRole } from "./authStore";
import { getBoardAccess, inviteToBoard, changeMemberRole, removeMember, revokeInvitation, type BoardSummary } from "./boardStore";
import { isSelfhostBackendEnabled } from "./selfhostApi";
import { boardDirectUrl, boardShareUrl, copyBoardLink, createShareLink, listShareLinks, revokeShareLink, shareLinksEnabled, type ShareLink } from "./shareLinks";

type ShareIconName = "link" | "mail" | "people" | "settings" | "chevron" | "copy" | "check" | "observer" | "student" | "co_teacher" | "clock" | "close" | "info";
function ShareIcon({name}: {name: ShareIconName}) {
  const paths: Record<ShareIconName, React.ReactNode> = {
    link: <><path d="M10 13a4 4 0 0 0 6 .4l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7"/><path d="M14 11a4 4 0 0 0-6-.4l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
    people: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-3a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v3M16 5a3 3 0 0 1 0 6m2 2a5 5 0 0 1 3 5v2"/></>,
    settings: <><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="8" cy="7" r="2" fill="var(--lt-raised,#fff)"/><circle cx="16" cy="12" r="2" fill="var(--lt-raised,#fff)"/><circle cx="10" cy="17" r="2" fill="var(--lt-raised,#fff)"/></>,
    chevron: <path d="m6 9 6 6 6-6"/>, copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
    check: <path d="m5 12 4 4L19 6"/>, observer: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
    student: <><path d="m3 10 9-5 9 5-9 5-9-5Zm4 3v4c3 2.5 7 2.5 10 0v-4M21 10v6"/></>,
    co_teacher: <><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M7 21l5-5 5 5M7 8h10M7 12h6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, close: <path d="m6 6 12 12M18 6 6 18"/>, info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/></>,
  };
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function OptionSummary({icon,title,description}: {icon:ShareIconName;title:string;description:string}) {
  return <summary><span className="share-option-icon"><ShareIcon name={icon}/></span><span className="share-option-copy"><strong>{title}</strong><small>{description}</small></span><span className="share-chevron"><ShareIcon name="chevron"/></span></summary>;
}
function MemberIdentity({name,detail,pending=false}: {name:string;detail:string;pending?:boolean}) {
  return <div className="share-member-identity"><span className="share-member-avatar">{pending?<ShareIcon name="mail"/>:name.trim().slice(0,1).toUpperCase()||"?"}</span><div><strong>{name}</strong><small>{detail}</small></div></div>;
}

export default function ShareDialog({ board, user, onClose }: { board: BoardSummary; user: AuthUser; onClose: () => void }) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [created, setCreated] = useState<{ id: string; url: string } | null>(()=>{
    try { const value=localStorage.getItem("lektrus.share-link."+user.id+"."+board.id);return value?JSON.parse(value):null; } catch {return null;}
  });
  const [linksReady, setLinksReady] = useState(false);
  const [access, setAccess] = useState<Awaited<ReturnType<typeof getBoardAccess>>>({ members: [], invites: [] });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<BoardRole, "owner">>("viewer");
  const [busy, setBusy] = useState(false);
  const [expiry, setExpiry] = useState<"never"|"1d"|"7d"|"30d">("7d");
  const [maxUses, setMaxUses] = useState<number>(0);
  const [linkPassword, setLinkPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const [section,setSection]=useState<"link"|"people"|"manage">("link");
  const [linkRole,setLinkRole]=useState<ShareLink["role"]>("viewer");
  const explicitRoles=isSelfhostBackendEnabled();
  const [participant,setParticipant]=useState<InvitedParticipantRole>("observer");
  const [linkParticipant,setLinkParticipant]=useState<InvitedParticipantRole>("observer");
  const participantOptions=(<><option value="observer">Наблюдатель</option><option value="student">Ученик</option><option value="co_teacher">Сопреподаватель</option></>);
  const roleLabel=(access:BoardRole,kind?:InvitedParticipantRole)=>explicitRoles?PARTICIPANT_ROLE_LABELS[participantRoleFor(access,kind)]:BOARD_ROLE_LABELS[access];
  const [showAdvanced,setShowAdvanced]=useState(false);
  const remote = shareLinksEnabled();
  const shareCacheKey="lektrus.share-link."+user.id+"."+board.id;
  const isActive=(link:ShareLink)=>!link.revoked_at&&(!link.expires_at||Date.parse(link.expires_at)>Date.now())&&(link.max_uses===null||link.use_count<link.max_uses);
  const createdIsActive=Boolean(created&&linksReady&&links.some(link=>link.id===created.id&&isActive(link)));
  const reload = async () => { const [members, rows] = await Promise.all([getBoardAccess(user.id, board.id), remote ? listShareLinks(board.id) : Promise.resolve([])]); setAccess(members); setLinks(rows); setLinksReady(true); };
  useEffect(() => { let alive = true; void Promise.all([getBoardAccess(user.id, board.id), remote ? listShareLinks(board.id) : Promise.resolve([])]).then(([members, rows]) => { if (alive) { setAccess(members); setLinks(rows); setLinksReady(true); } }).catch(() => { if (alive) {setNoticeError(true);setNotice("Не удалось загрузить данные о доступе.");} }); return () => { alive = false; }; }, [board.id, user.id, remote]);
  useEffect(() => {
    if(!linksReady||busy||!created||createdIsActive)return;
    setCreated(null);
    try{localStorage.removeItem(shareCacheKey)}catch{/* Private browsing */}
  },[linksReady,busy,created,createdIsActive,shareCacheKey]);
  const run = async (action: () => Promise<void>) => { if (busy) return; setBusy(true); setNotice("");setNoticeError(false); try { await action(); } catch (error) { setNoticeError(true);setNotice(error instanceof Error ? error.message : "Не удалось выполнить действие"); } finally { setBusy(false); } };
  const switchSection = (next: typeof section) => {if(next===section)return;setSection(next);setNotice("");setNoticeError(false);};
  const copyLink = (url:string,message:string) => run(async()=>{if(!await copyBoardLink(url))throw new Error("Не удалось скопировать ссылку. Выделите адрес вручную.");setNotice(message);});
  const create = (linkRole: ShareLink["role"]) => run(async () => {
    const expiresAt=expiry==="never"?null:new Date(Date.now()+({"1d":1,"7d":7,"30d":30}[expiry])*86400000).toISOString();
    const link = await createShareLink(board.id, linkRole,{expiresAt,maxUses:maxUses>0?maxUses:null,password:linkPassword.trim()||null,participantRole:explicitRoles?linkParticipant:undefined});
    const saved={ id: link.id, url:boardShareUrl(link.token) };
    // The RPC has already succeeded. Keep the new link available even if
    // reloading the separate access/member list fails temporarily.
    setLinks(rows=>[link,...rows.filter(row=>row.id!==link.id)]);
    setLinksReady(true);
    setCreated(saved);
    try{localStorage.setItem(shareCacheKey,JSON.stringify(saved))}catch{/* private browsing */}
    setNotice("Ссылка создана. Скопируйте её и отправьте участнику.");
    setSection("link");
    try{await reload()}catch{setNotice("Ссылка создана, но обновить список участников пока не удалось.");}
  });
  if (board.role !== "owner") return null;
  return <div className="access-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="access-modal invite-modal" role="dialog" aria-modal="true" aria-label="Доступ к доске">
      <div className="access-head invite-head"><span className="share-head-icon"><ShareIcon name="people"/></span><div><span className="invite-kicker">Совместная работа</span><h2>Доступ к доске</h2><p>{board.title}</p></div><button onClick={onClose} aria-label="Закрыть"><ShareIcon name="close"/></button></div>
      <nav className="lektrus-share-tabs" aria-label="Разделы доступа">
        <button type="button" className={section==="link"?"active":""} aria-pressed={section==="link"} disabled={busy} onClick={()=>switchSection("link")}><ShareIcon name="mail"/>Приглашения</button>
        <button type="button" className={section==="people"?"active":""} aria-pressed={section==="people"} disabled={busy} onClick={()=>switchSection("people")}><ShareIcon name="people"/>Участники <span>{access.members.length+access.invites.length+1}</span></button>
        <button type="button" className={section==="manage"?"active":""} aria-pressed={section==="manage"} disabled={busy} onClick={()=>switchSection("manage")}><ShareIcon name="link"/>Ссылки <span>{links.filter(isActive).length}</span></button>
      </nav>
      {section==="link"&&<div className="lektrus-share-content">
        {remote&&<div className="lektrus-share-primary">
          <div className="share-section-heading"><h3>Приглашение по ссылке</h3><p>Выберите роль участника и отправьте ему ссылку для входа на доску.</p></div>
          <div className={`lektrus-share-roles${explicitRoles?" lektrus-share-participant-roles":""}`} role="group" aria-label="Права по ссылке">
            {explicitRoles? (["observer","student","co_teacher"] as const).map(kind=><button key={kind} type="button" disabled={busy} className={linkParticipant===kind?"active":""} aria-pressed={linkParticipant===kind} onClick={()=>{setLinkParticipant(kind);setLinkRole(participantAccess(kind))}}><span className="share-role-icon"><ShareIcon name={kind}/></span><b>{PARTICIPANT_ROLE_LABELS[kind]}</b><small>{kind==="observer"?"Просмотр доски":kind==="student"?"Рисование и выполнение заданий":"Редактирование доски и создание заданий"}</small></button>):<>
            <button type="button" disabled={busy} className={linkRole==="viewer"?"active":""} aria-pressed={linkRole==="viewer"} onClick={()=>setLinkRole("viewer")}><span className="share-role-icon"><ShareIcon name="observer"/></span><b>Только просмотр</b><small>Без изменения доски</small></button>
            <button type="button" disabled={busy} className={linkRole==="editor"?"active":""} aria-pressed={linkRole==="editor"} onClick={()=>setLinkRole("editor")}><span className="share-role-icon"><ShareIcon name="student"/></span><b>Редактирование</b><small>Рисование и работа с объектами</small></button></>}
          </div>
          <p className="share-inline-info"><ShareIcon name="info"/>{explicitRoles?"Ученик и наблюдатель могут войти без регистрации. Сопреподавателю нужен подтверждённый аккаунт преподавателя.":"По ссылке можно войти без регистрации."}</p>
          <details className="share-option lektrus-share-advanced" open={showAdvanced} onToggle={e=>setShowAdvanced(e.currentTarget.open)}>
            <OptionSummary icon="settings" title="Настройки приглашения" description="Срок действия, пароль и количество входов"/>
            <div className="share-link-settings invite-settings">
              <label><span>Срок действия</span><select value={expiry} onChange={e=>setExpiry(e.target.value as typeof expiry)}><option value="1d">1 день</option><option value="7d">7 дней</option><option value="30d">30 дней</option><option value="never">Без срока</option></select></label>
              <label><span>Количество входов</span><input type="number" min="0" max="10000" value={maxUses} onChange={e=>setMaxUses(Math.max(0,Math.min(10000,Number(e.target.value)||0)))}/><small>0 — без ограничений</small></label>
              <label><span>Пароль (необязательно)</span><input type="password" autoComplete="new-password" value={linkPassword} onChange={e=>setLinkPassword(e.target.value)} placeholder="Без пароля"/><small>Для защищённого входа</small></label>
            </div>
          </details>
          <button type="button" className="lektrus-share-create" disabled={busy} onClick={()=>void create(linkRole)}><ShareIcon name="link"/>{busy?"Подождите…":"Создать ссылку-приглашение"}</button>
        </div>}
        {createdIsActive&&created&&<div className="lektrus-share-result" role="group" aria-label="Созданная ссылка">
          <strong><ShareIcon name="check"/> Приглашение готово</strong>
          <div className="lektrus-share-copy"><input readOnly value={created.url} onFocus={e=>e.target.select()} aria-label="Новая ссылка"/><button type="button" disabled={busy} onClick={()=>void copyLink(created.url,"Ссылка скопирована")}><ShareIcon name="copy"/>Копировать</button></div>
          <small>Отправьте ссылку участнику. Активные приглашения доступны во вкладке «Ссылки».</small>
        </div>}
        {remote&&<details className="share-option share-direct-link">
          <OptionSummary icon="link" title="Прямая ссылка на доску" description="Для участников, у которых уже есть доступ"/>
          <div className="share-option-body"><div className="lektrus-share-copy"><input readOnly value={boardDirectUrl(board.id)} onFocus={e=>e.target.select()} aria-label="Адрес доски"/><button type="button" disabled={busy} onClick={()=>void copyLink(boardDirectUrl(board.id),"Адрес доски скопирован")}><ShareIcon name="copy"/>Копировать</button></div>
          <p className="share-inline-info"><ShareIcon name="info"/>Ссылка не предоставляет доступ новым участникам. Для этого создайте приглашение.</p></div>
        </details>}
        {!remote&&<p className="share-note">В локальном режиме доступны только аккаунты этого браузера. Для приглашений по ссылке требуется подключение к серверу.</p>}
        <details className="share-option share-email-panel"><OptionSummary icon="mail" title="Пригласить по электронной почте" description="Предоставьте доступ нужному аккаунту"/>
          <form className="share-option-body share-email-form" onSubmit={e=>{e.preventDefault();if(!email.trim())return;void run(async()=>{await inviteToBoard(user.id,board.id,email.trim(),role,explicitRoles?participant:undefined);setEmail("");await reload();setNotice("Приглашение отправлено");})}}>
            <label><span>Электронная почта</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" aria-label="Email пользователя"/></label>
            <label><span>Роль участника</span>{explicitRoles?<select value={participant} onChange={e=>{const kind=e.target.value as InvitedParticipantRole;setParticipant(kind);setRole(participantAccess(kind))}} aria-label="Роль приглашения">{participantOptions}</select>:<select value={role} onChange={e=>setRole(e.target.value as typeof role)} aria-label="Роль приглашения"><option value="viewer">Просмотр</option><option value="editor">Редактор</option></select>}</label>
            <button type="submit" className="share-primary-button" disabled={busy||!email.trim()}>Пригласить</button>
          </form>
        </details>
      </div>}
      {section==="manage"&&<div className="lektrus-share-content">
        <div className="share-section-heading"><h3>Активные приглашения</h3><p>Управляйте ссылками, по которым можно присоединиться к доске.</p></div>
        {!linksReady&&!notice&&<div className="share-empty" role="status"><span className="share-option-icon"><ShareIcon name="clock"/></span><p>Загружаем ссылки…</p></div>}
        {linksReady&&links.filter(isActive).length===0&&<div className="share-empty"><span className="share-option-icon"><ShareIcon name="link"/></span><strong>Нет активных ссылок</strong><p>Создайте приглашение, чтобы поделиться доской.</p><button type="button" className="share-primary-button" onClick={()=>switchSection("link")}>Создать приглашение</button></div>}
        {links.filter(isActive).map(link=><div className="access-person share-list-row share-link-row" key={link.id}><div className="share-link-identity"><span className="share-option-icon"><ShareIcon name="link"/></span><div><strong>{roleLabel(link.role,link.participant_role)}</strong><small>Создана {new Date(link.created_at).toLocaleDateString("ru-RU")}</small><div className="share-meta"><span>{link.expires_at?`До ${new Date(link.expires_at).toLocaleDateString("ru-RU")}`:"Без срока"}</span><span>Входы: {link.use_count}{link.max_uses?` из ${link.max_uses}`:""}</span>{link.protected&&<span>С паролем</span>}</div></div></div><button type="button" className="danger" disabled={busy} onClick={()=>void run(async()=>{await revokeShareLink(link.id);if(created?.id===link.id){setCreated(null);try{localStorage.removeItem(shareCacheKey)}catch{/* unavailable */}}await reload();setNotice("Ссылка отозвана")})}>Отозвать</button></div>)}
        <p className="share-inline-info"><ShareIcon name="info"/>После отзыва по ссылке нельзя войти. Доступ ранее приглашённых участников можно изменить во вкладке «Участники».</p>
      </div>}
      {section==="people"&&<div className="lektrus-share-content">
        <div className="share-section-heading"><h3>Участники доски</h3><p>Назначайте роли и управляйте доступом к этой доске.</p></div>
        <div className="access-list">
          <div className="access-person share-list-row share-owner-row"><MemberIdentity name={user.name} detail={user.email}/><b className="share-role-badge">Владелец</b></div>
          {access.members.map(member => <div className="access-person share-list-row share-member-row" key={member.userId}><MemberIdentity name={member.user?.name||"Пользователь"} detail={member.user?.email||"Участник доски"}/>{explicitRoles?<select disabled={busy} value={participantRoleFor(member.role,member.participantRole)} aria-label="Роль участника" onChange={e=>{const kind=e.target.value as InvitedParticipantRole;void run(async()=>{await changeMemberRole(user.id,board.id,member.userId,participantAccess(kind),kind);await reload();setNotice("Роль участника обновлена")})}}>{participantOptions}</select>:<select disabled={busy} value={member.role} aria-label="Роль участника" onChange={e => { const value = e.target.value as typeof role; void run(async () => { await changeMemberRole(user.id, board.id, member.userId, value); await reload();setNotice("Роль участника обновлена"); }); }}><option value="viewer">Просмотр</option><option value="editor">Редактор</option></select>}<button type="button" className="danger" disabled={busy} onClick={() => void run(async () => { await removeMember(user.id, board.id, member.userId); await reload();setNotice("Доступ участника отозван"); })}>Удалить</button></div>)}
        </div>
        {access.invites.length>0&&<><div className="share-section-heading share-pending-heading"><h3>Ожидают входа</h3><p>Приглашения, которые ещё не были приняты.</p></div><div className="access-list">
          {access.invites.map(invite => <div className="access-person share-list-row share-member-row pending" key={invite.id}><MemberIdentity name={invite.email} detail="Приглашение отправлено" pending/><b className="share-role-badge">{roleLabel(invite.role,invite.participantRole)}</b><button type="button" className="danger" disabled={busy} onClick={() => void run(async () => { await revokeInvitation(user.id, board.id, invite.id); await reload();setNotice("Приглашение отменено"); })}>Отменить</button></div>)}
        </div></>}
        {!linksReady&&!notice&&<p className="share-inline-info" role="status"><ShareIcon name="clock"/>Загружаем участников…</p>}
        {linksReady&&access.members.length===0&&access.invites.length===0&&<p className="share-inline-info"><ShareIcon name="info"/>Пока доступ есть только у вас. Пригласите участников во вкладке «Приглашения».</p>}
      </div>}
      {notice && <div className={`access-notice share-notice${noticeError?" is-error":""}`} role={noticeError?"alert":"status"}><ShareIcon name={noticeError?"info":"check"}/><span>{notice}</span><button type="button" onClick={()=>setNotice("")} aria-label="Закрыть уведомление"><ShareIcon name="close"/></button></div>}
    </section>
  </div>;
}
