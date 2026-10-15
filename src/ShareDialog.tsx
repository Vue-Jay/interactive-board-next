import { useEffect, useState } from "react";
import { type AuthUser, type BoardRole, BOARD_ROLE_LABELS } from "./authStore";
import { isRemoteBackendEnabled } from "./backend";
import { getBoardAccess, inviteToBoard, changeMemberRole, removeMember, revokeInvitation, type BoardSummary } from "./boardStore";
import { createShareLink, listShareLinks, revokeShareLink, type ShareLink } from "./shareLinks";

export default function ShareDialog({ board, user, onClose }: { board: BoardSummary; user: AuthUser; onClose: () => void }) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [created, setCreated] = useState<{ id: string; url: string; presentationUrl?: string } | null>(()=>{
    try { const value=localStorage.getItem("lektrus.share-link."+user.id+"."+board.id);return value?JSON.parse(value):null; } catch {return null;}
  });
  const [access, setAccess] = useState<Awaited<ReturnType<typeof getBoardAccess>>>({ members: [], invites: [] });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<BoardRole, "owner">>("viewer");
  const [busy, setBusy] = useState(false);
  const [expiry, setExpiry] = useState<"never"|"1d"|"7d"|"30d">("7d");
  const [maxUses, setMaxUses] = useState<number>(0);
  const [linkPassword, setLinkPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [section,setSection]=useState<"link"|"people"|"manage">("link");
  const [linkRole,setLinkRole]=useState<ShareLink["role"]>("viewer");
  const [showAdvanced,setShowAdvanced]=useState(false);
  const remote = isRemoteBackendEnabled();
  const reload = async () => { const [members, rows] = await Promise.all([getBoardAccess(user.id, board.id), remote ? listShareLinks(board.id) : Promise.resolve([])]); setAccess(members); setLinks(rows); };
  useEffect(() => { let alive = true; void Promise.all([getBoardAccess(user.id, board.id), remote ? listShareLinks(board.id) : Promise.resolve([])]).then(([members, rows]) => { if (alive) { setAccess(members); setLinks(rows); } }).catch(() => { if (alive) setNotice("Не удалось загрузить доступ."); }); return () => { alive = false; }; }, [board.id, user.id, remote]);
  const run = async (action: () => Promise<void>) => { if (busy) return; setBusy(true); setNotice(""); try { await action(); } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось выполнить действие"); } finally { setBusy(false); } };
  const create = (linkRole: ShareLink["role"]) => run(async () => {
    const expiresAt=expiry==="never"?null:new Date(Date.now()+({"1d":1,"7d":7,"30d":30}[expiry])*86400000).toISOString();
    const link = await createShareLink(board.id, linkRole,{expiresAt,maxUses:maxUses>0?maxUses:null,password:linkPassword.trim()||null});
    const url=`${window.location.origin}/join/${link.token}`; const saved={ id: link.id, url, ...(linkRole==="viewer"?{presentationUrl:`${url}?present=1`}:{}) };setCreated(saved);try{localStorage.setItem("lektrus.share-link."+user.id+"."+board.id,JSON.stringify(saved));}catch{/* private browsing */} setNotice("Ссылка создана. Скопируйте её и отправьте участнику."); setSection("link"); await reload();
  });
  if (board.role !== "owner") return null;
  return <div className="access-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="access-modal invite-modal" role="dialog" aria-modal="true" aria-label="Поделиться доской">
      <div className="access-head invite-head"><div><span className="invite-kicker">Совместная работа</span><h2>Поделиться доской</h2><p>{board.title}</p></div><button onClick={onClose} aria-label="Закрыть">×</button></div>
      <nav className="lektrus-share-tabs" aria-label="Разделы доступа">
        <button type="button" className={section==="link"?"active":""} onClick={()=>setSection("link")}>Ссылка</button>
        <button type="button" className={section==="people"?"active":""} onClick={()=>setSection("people")}>Участники <span>{access.members.length+access.invites.length+1}</span></button>
        <button type="button" className={section==="manage"?"active":""} onClick={()=>setSection("manage")}>Управление ссылками <span>{links.filter(l=>!l.revoked_at&&(!l.expires_at||Date.parse(l.expires_at)>Date.now())).length}</span></button>
      </nav>
      {section==="link"&&<div className="lektrus-share-content">
        {remote&&<div className="lektrus-share-primary">
          <h3>Создать ссылку-приглашение</h3>
          <p>Гость сможет войти по ссылке без регистрации. Выберите, что ему разрешено.</p>
          <div className="lektrus-share-roles" role="group" aria-label="Права по ссылке">
            <button type="button" disabled={busy} className={linkRole==="viewer"?"active":""} onClick={()=>setLinkRole("viewer")}><b>◉ Только просмотр</b><small>Без изменения доски</small></button>
            <button type="button" disabled={busy} className={linkRole==="editor"?"active":""} onClick={()=>setLinkRole("editor")}><b>✎ Редактирование</b><small>Рисование и работа с объектами</small></button>
          </div>
          <details className="lektrus-share-advanced" open={showAdvanced} onToggle={e=>setShowAdvanced(e.currentTarget.open)}>
            <summary>Дополнительные настройки <span>{showAdvanced?"Скрыть":"Срок, пароль, ограничения"}</span></summary>
            <div className="share-link-settings invite-settings">
              <label><span>Срок действия</span><select value={expiry} onChange={e=>setExpiry(e.target.value as typeof expiry)}><option value="1d">1 день</option><option value="7d">7 дней</option><option value="30d">30 дней</option><option value="never">Без срока</option></select></label>
              <label><span>Максимум входов</span><input type="number" min="0" max="10000" value={maxUses} onChange={e=>setMaxUses(Math.max(0,Math.min(10000,Number(e.target.value)||0)))}/><small>0 = без ограничения</small></label>
              <label><span>Пароль (необязательно)</span><input type="password" autoComplete="new-password" value={linkPassword} onChange={e=>setLinkPassword(e.target.value)} placeholder="Без пароля"/><small>Для защищённого входа</small></label>
            </div>
          </details>
          <button type="button" className="lektrus-share-create" disabled={busy} onClick={()=>void create(linkRole)}>{busy?"Подождите…":"Создать ссылку"}</button>
        </div>}
        {created&&<div className="lektrus-share-result" role="group" aria-label="Созданная ссылка">
          <strong>✓ Ссылка готова</strong>
          <div className="lektrus-share-copy"><input readOnly value={created.url} onFocus={e=>e.target.select()} aria-label="Новая ссылка"/><button type="button" onClick={()=>void run(async()=>{await navigator.clipboard.writeText(created.url);setNotice("Ссылка скопирована")})}>Копировать</button></div>
          {created.presentationUrl&&<details><summary>Отдельная ссылка для показа</summary><div className="lektrus-share-copy"><input readOnly value={created.presentationUrl} onFocus={e=>e.target.select()} aria-label="Ссылка презентации"/><button type="button" onClick={()=>void run(async()=>{await navigator.clipboard.writeText(created.presentationUrl!);setNotice("Ссылка для показа скопирована")})}>Копировать</button></div></details>}
          <small>Ссылка видна здесь только после создания. Для остальных приглашений используйте управление ссылками.</small>
        </div>}
        {!remote&&<p className="share-note">Локальный режим: пригласить можно только существующий аккаунт этого браузера. Для ссылок требуется Supabase.</p>}
        <details className="invite-email-panel"><summary><span>✉</span><div><strong>Пригласить конкретного человека по email</strong><small>Выдать доступ определённому аккаунту</small></div><b>⌄</b></summary><div className="invite-row"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email пользователя" aria-label="Email пользователя"/><select value={role} onChange={e=>setRole(e.target.value as typeof role)} aria-label="Роль приглашения"><option value="viewer">Просмотр</option><option value="editor">Редактор</option></select><button disabled={busy||!email.trim()} onClick={()=>void run(async()=>{await inviteToBoard(user.id,board.id,email.trim(),role);setEmail("");await reload();setNotice("Приглашение отправлено")})}>Пригласить</button></div></details>
      </div>}
      {section==="manage"&&<div className="lektrus-share-content">
        <h3>Действующие ссылки</h3>
        {links.filter(l=>!l.revoked_at&&(!l.expires_at||Date.parse(l.expires_at)>Date.now())).length===0&&<p className="share-note">Активных ссылок пока нет. Создайте первую во вкладке «Ссылка».</p>}
        {links.filter(l=>!l.revoked_at&&(!l.expires_at||Date.parse(l.expires_at)>Date.now())).map(link=><div className="access-person invite-link-row" key={link.id}><div><strong>{BOARD_ROLE_LABELS[link.role]}</strong><span>Создана {new Date(link.created_at).toLocaleDateString("ru-RU")}{link.expires_at?` · до ${new Date(link.expires_at).toLocaleDateString("ru-RU")}`:" · без срока"} · входов {link.use_count}{link.max_uses?`/${link.max_uses}`:""}{link.protected?" · с паролем":""}</span></div><button disabled={busy} onClick={()=>void run(async()=>{await revokeShareLink(link.id);if(created?.id===link.id){setCreated(null);try{localStorage.removeItem("lektrus.share-link."+user.id+"."+board.id)}catch{/* unavailable */}}await reload();setNotice("Ссылка отозвана")})}>Отозвать</button></div>)}
        <p className="share-note">Отзыв запрещает новые входы по ссылке. Уже подключённым участникам доступ отменяется отдельно.</p>
      </div>}
      {notice && <div className="access-notice" role="status">{notice}</div>}
      {section==="people"&&<><div className="invite-section-title members"><span>👥</span><div><h3>Участники</h3><small>Кто уже имеет доступ к доске</small></div></div>
      <div className="access-list"><div className="access-person"><div><strong>{user.name}</strong><span>{user.email}</span></div><b>Владелец</b></div>
        {access.members.map(member => <div className="access-person" key={member.userId}><div><strong>{member.user?.name || "Пользователь"}</strong><span>{member.user?.email || "Участник доски"}</span></div><select disabled={busy} value={member.role} aria-label="Роль участника" onChange={e => { const value = e.target.value as typeof role; void run(async () => { await changeMemberRole(user.id, board.id, member.userId, value); await reload(); }); }}><option value="viewer">Просмотр</option><option value="editor">Редактор</option></select><button disabled={busy} onClick={() => void run(async () => { await removeMember(user.id, board.id, member.userId); await reload(); })}>Удалить</button></div>)}
        {access.invites.map(invite => <div className="access-person" key={invite.id}><div><strong>{invite.email}</strong><span>Ожидает входа</span></div><b>{BOARD_ROLE_LABELS[invite.role]}</b><button disabled={busy} onClick={() => void run(async () => { await revokeInvitation(user.id, board.id, invite.id); await reload(); })}>Отменить</button></div>)}
      </div></>}
    </section>
  </div>;
}
