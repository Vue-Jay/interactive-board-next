import { useEffect, useRef, useState, type FormEvent } from "react";
import SelfhostPilotCanvas from "./SelfhostPilotCanvas";
import {
  cachedPilotSession, pilotSession, pilotLogin, pilotLogout, pilotBoards,
  pilotCreateBoard, pilotReadDocument, pilotSaveDocument,
  pilotSubscribeBoard, pilotClaimInvitations, pilotInvite, pilotAccess,
  pilotSignup, pilotVerifyEmail, pilotAppendStroke, pilotUndoStroke,
  pilotInkHistory, PilotHttpError,
  type PilotSession, type PilotBoard, type PilotDocument, type PilotRealtimeStatus,
  type PilotAccess, type PilotBoardChannel, type PilotLiveEvent, type PilotLiveInkPacket,
  type PilotInkHistoryRow,
} from "./selfhostPilotApi";

const DEFAULT_PILOT_DOCUMENT:Record<string,unknown>={
  pilot_schema:1,version:1,items:[],ink:[],note:"",
};
const isPilotDocument=(doc:PilotDocument|null)=>
  doc?.document?.pilot_schema===1&&typeof doc.document.note==="string";
const issueText=(error:unknown)=>error instanceof Error?error.message:"Неизвестная ошибка тестового сервера.";

export default function SelfhostPilotApp(){
  const [session,setSession]=useState<PilotSession|null>(()=>cachedPilotSession());
  const [authMode,setAuthMode]=useState<"login"|"signup">("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [displayName,setDisplayName]=useState("");
  const [role,setRole]=useState<"teacher"|"student">("student");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [boards,setBoards]=useState<PilotBoard[]>([]);
  const [boardId,setBoardId]=useState<string|null>(null);
  const [newTitle,setNewTitle]=useState("");
  const [document,setDocument]=useState<PilotDocument|null>(null);
  const [note,setNote]=useState("");
  const [dirty,setDirty]=useState(false);
  const [serverChanged,setServerChanged]=useState(false);
  const [realtime,setRealtime]=useState<PilotRealtimeStatus>("offline");
  const [liveFrame,setLiveFrame]=useState<PilotLiveEvent|null>(null);
  const [inkHistory,setInkHistory]=useState<PilotInkHistoryRow[]>([]);
  const liveChannelRef=useRef<PilotBoardChannel|null>(null);
  const [inviteEmail,setInviteEmail]=useState("");
  const [inviteRole,setInviteRole]=useState<"viewer"|"editor">("viewer");
  const [access,setAccess]=useState<PilotAccess|null>(null);
  const savedNote=useRef("");
  const dirtyRef=useRef(false);
  const savingRef=useRef(false);
  const revisionRef=useRef(0);
  const docRef=useRef<PilotDocument|null>(null);
  const generationRef=useRef(0);
  const selected=boards.find(b=>b.id===boardId)||null;

  const applyDocument=(row:PilotDocument)=>{
    docRef.current=row;
    revisionRef.current=row.version;
    setDocument(row);
    const value=isPilotDocument(row)?String(row.document?.note||""):"";
    savedNote.current=value;
    dirtyRef.current=false;
    setNote(value);
    setDirty(false);
    setServerChanged(false);
  };

  useEffect(()=>{
    if(window.location.pathname!=="/confirm-email")return;
    const token=new URLSearchParams(window.location.hash.replace(/^#/,"")).get("token")||
      new URLSearchParams(window.location.search).get("token");
    // Remove the token from browser history, URL and later Referer headers.
    window.history.replaceState(null,"","/selfhost-pilot");
    if(!token){setError("В ссылке подтверждения нет токена.");return}
    void pilotVerifyEmail(token).then(result=>{
      setNotice(result.message||"Почта подтверждена. Теперь можно войти.");
      setAuthMode("login");
    }).catch(failure=>setError(issueText(failure)));
  },[]);

  useEffect(()=>{
    if(!session)return;
    let active=true;
    void pilotSession().then(next=>{
      if(active)setSession(next);
    }).catch(failure=>{
      if(active){setSession(null);setError(issueText(failure))}
    });
    return ()=>{active=false};
  },[]);

  useEffect(()=>{
    if(!session)return;
    let active=true;
    void (async()=>{
      try{
        await pilotClaimInvitations();
        const result=await pilotBoards();
        if(!active)return;
        setBoards(result);
        setBoardId(current=>
          current&&result.some(b=>b.id===current)?current:result[0]?.id||null);
      }catch(failure){if(active)setError(issueText(failure))}
    })();
    return()=>{active=false};
  },[session?.user.id]);

  useEffect(()=>{
    if(!session||!boardId){
      setDocument(null);setAccess(null);setRealtime("offline");return;
    }
    const localGeneration=++generationRef.current;
    let disposed=false,reading=false,queuedRevision=0;
    dirtyRef.current=false;
    savingRef.current=false;
    docRef.current=null;
    revisionRef.current=0;
    setDocument(null);setAccess(null);setNote("");setDirty(false);
    setLiveFrame(null);
    setInkHistory([]);
    setServerChanged(false);
    const read=async(force=false)=>{
      if(disposed||localGeneration!==generationRef.current)return;
      if(!force&&(dirtyRef.current||savingRef.current)){
        setServerChanged(true);return;
      }
      if(reading)return;
      reading=true;
      try{
        const row=await pilotReadDocument(boardId);
        if(disposed||localGeneration!==generationRef.current)return;
        if(!force&&(dirtyRef.current||savingRef.current)){
          setServerChanged(true);return;
        }
        // A delayed GET must not replace a newer result already applied.
        if(docRef.current&&row.version<revisionRef.current)return;
        applyDocument(row);
        void pilotInkHistory(boardId).then(rows=>{
          if(!disposed&&localGeneration===generationRef.current)
            setInkHistory(rows);
        }).catch(()=>{});
      }catch(failure){
        if(!disposed)setError(issueText(failure));
      }finally{
        reading=false;
        if(!disposed&&queuedRevision>revisionRef.current){
          const next=queuedRevision;queuedRevision=0;
          if(!dirtyRef.current&&!savingRef.current)void read();
          else if(next>revisionRef.current)setServerChanged(true);
        }
      }
    };
    const unsubscribe=pilotSubscribeBoard(boardId,version=>{
      if(version<=revisionRef.current)return;
      queuedRevision=Math.max(queuedRevision,version);
      if(dirtyRef.current||savingRef.current){setServerChanged(true);return;}
      void read();
    },status=>{if(!disposed)setRealtime(status)},
      frame=>{if(!disposed)setLiveFrame(frame)});
    liveChannelRef.current=unsubscribe;
    void read();
    void pilotInkHistory(boardId).then(value=>{
      if(!disposed)setInkHistory(value);
    }).catch(()=>{});
    if(selected?.role==="owner"){
      void pilotAccess(boardId).then(value=>{
        if(!disposed)setAccess(value);
      }).catch(()=>{});
    }
    return()=>{
      disposed=true;generationRef.current++;
      if(liveChannelRef.current===unsubscribe)liveChannelRef.current=null;
      unsubscribe();
    };
  },[boardId,session?.user.id]);

  const doAuth=async(event:FormEvent)=>{
    event.preventDefault();setBusy(true);setError("");setNotice("");
    try{
      if(authMode==="signup"){
        const result=await pilotSignup({
          email:email.trim().toLowerCase(),password,name:displayName.trim(),
          first_name:"",last_name:"",role,
        });
        setNotice(result.message+" Проверьте почту и откройте ссылку подтверждения.");
        setPassword("");
        setAuthMode("login");
      }else{
        const result=await pilotLogin(email,password);
        setSession(result);setPassword("");
      }
    }catch(failure){setError(issueText(failure))}
    finally{setBusy(false)}
  };
  const logout=async()=>{
    setBusy(true);setError("");
    try{await pilotLogout()}finally{
      setSession(null);setBoards([]);setBoardId(null);
      setDocument(null);setAccess(null);setBusy(false);
    }
  };
  const create=async(event:FormEvent)=>{
    event.preventDefault();if(!session)return;
    setBusy(true);setError("");setNotice("");
    try{
      const board=await pilotCreateBoard("Пилот: "+(newTitle.trim()||"Тест совместной работы"));
      // Keep real imported documents read-only in this test interface.
      await pilotSaveDocument(board.id,0,{...DEFAULT_PILOT_DOCUMENT});
      const next=await pilotBoards();
      setBoards(next);setBoardId(board.id);setNewTitle("");
    }catch(failure){setError(issueText(failure))}
    finally{setBusy(false)}
  };
  const save=async()=>{
    const board=boardId;
    const base=docRef.current;
    if(!board||!base||!isPilotDocument(base)||selected?.role==="viewer")return;
    if(serverChanged){
      setError("На сервере есть новая версия. Скопируйте черновик и загрузите изменения.");
      return;
    }
    setBusy(true);savingRef.current=true;setError("");
    try{
      const result=await pilotSaveDocument(board,base.version,{
        ...(base.document||{}),pilot_schema:1,note,items:base.document?.items||[],ink:base.document?.ink||[],
      });
      if(boardId===board){applyDocument(result);setNotice("Сохранено, версия "+result.version);}
    }catch(failure){
      if(failure instanceof PilotHttpError&&failure.status===409){
        setServerChanged(true);
        setError("Другой участник сохранил более новую версию. Черновик не потерян.");
      }else setError(issueText(failure));
    }finally{setBusy(false);savingRef.current=false}
  };
  const reload=async()=>{
    if(!boardId)return;
    if(dirty&&!window.confirm("Несохранённый текст будет заменён последней версией с сервера. Продолжить?"))return;
    setBusy(true);setError("");
    const target=boardId;
    try{
      const row=await pilotReadDocument(target);
      if(target===boardId)applyDocument(row);
    }catch(failure){setError(issueText(failure))}
    finally{setBusy(false)}
  };
  const refreshAfterInk=async(target:string,localGeneration:number)=>{
    const row=await pilotReadDocument(target);
    if(boardId!==target||generationRef.current!==localGeneration)return;
    if(dirtyRef.current){
      // Keep an unsaved note untouched; only rebase it if the server's note
      // has not changed. A remote note conflict remains explicit.
      if(!isPilotDocument(row)||row.document?.note!==savedNote.current)
        setServerChanged(true);
      docRef.current=row;revisionRef.current=row.version;
      setDocument(row);
    }else{
      applyDocument(row);
    }
    void pilotInkHistory(target).then(value=>{
      if(boardId===target&&generationRef.current===localGeneration)
        setInkHistory(value);
    }).catch(()=>{});
  };
  const persistInk=async(packet:PilotLiveInkPacket,operationId:string)=>{
    const target=boardId,localGeneration=generationRef.current;
    if(!target||selected?.role==="viewer")throw new Error("Нет права сохранять штрих.");
    await pilotAppendStroke(target,operationId,packet);
    await refreshAfterInk(target,localGeneration);
  };
  const undoInk=async()=>{
    const target=boardId,localGeneration=generationRef.current;
    if(!target||selected?.role==="viewer")throw new Error("Нет права отменять штрих.");
    await pilotUndoStroke(target,crypto.randomUUID());
    await refreshAfterInk(target,localGeneration);
  };
  const sendInvite=async(event:FormEvent)=>{
    event.preventDefault();if(!boardId||selected?.role!=="owner")return;
    setBusy(true);setError("");
    try{
      const result=await pilotInvite(boardId,inviteEmail,inviteRole);
      setAccess(await pilotAccess(boardId));
      setInviteEmail("");
      setNotice(result.kind==="member"?"Участник добавлен.":"Приглашение сохранено до регистрации.");
    }catch(failure){setError(issueText(failure))}
    finally{setBusy(false)}
  };

  return <div className="selfhost-pilot">
    <header className="pilot-topbar">
      <div><strong>Lektrus</strong><span>Тест собственного сервера</span></div>
      <span className="pilot-chip">Изолированный пилот · без Supabase</span>
      {session&&<button type="button" onClick={()=>void logout()} disabled={busy}>Выйти</button>}
    </header>
    <main className="pilot-main">
      <h1>Проверка миграции Lektrus</h1>
      <p className="pilot-muted">
        Здесь проверяются вход, доски и обмен версиями между браузерами.
        Это ещё не полноценная интерактивная доска с инструментами и общим рисованием.
      </p>
      {error&&<div className="pilot-alert" role="alert">{error}</div>}
      {notice&&<div className="pilot-notice" role="status">{notice}</div>}
      {!session?
        <section className="pilot-panel pilot-auth">
          <div className="pilot-tabs">
            <button type="button" aria-pressed={authMode==="login"}
              onClick={()=>{setAuthMode("login");setError("")}}>Вход</button>
            <button type="button" aria-pressed={authMode==="signup"}
              onClick={()=>{setAuthMode("signup");setError("")}}>Регистрация</button>
          </div>
          <form onSubmit={event=>void doAuth(event)}>
            <h2>{authMode==="login"?"Войти в тестовый сервер":"Создать тестовый аккаунт"}</h2>
            {authMode==="signup"&&<>
              <label>Имя<input required minLength={2} maxLength={100}
                value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label>
              <fieldset><legend>Роль при регистрации</legend>
                <label><input type="radio" checked={role==="teacher"}
                  onChange={()=>setRole("teacher")}/> Я учитель</label>
                <label><input type="radio" checked={role==="student"}
                  onChange={()=>setRole("student")}/> Я ученик</label>
              </fieldset>
            </>}
            <label>Email<input type="email" required autoComplete="email"
              value={email} onChange={e=>setEmail(e.target.value)}/></label>
            <label>Пароль<input type="password" required minLength={authMode==="signup"?6:1}
              autoComplete={authMode==="login"?"current-password":"new-password"}
              value={password} onChange={e=>setPassword(e.target.value)}/></label>
            <button disabled={busy} type="submit" className="pilot-primary">
              {authMode==="login"?"Войти":"Зарегистрироваться"}
            </button>
          </form>
          <p className="pilot-muted">Регистрация доступна только после настройки SMTP на тестовом VPS.</p>
        </section>
      :<>
        <div className="pilot-account">
          <span><strong>{session.user.user_metadata?.display_name||session.user.email}</strong></span>
          <span>{session.user.account_role==="teacher"?"Учитель":"Ученик"}</span>
          <span>Роль: серверная, не из браузера</span>
        </div>
        <div className="pilot-grid">
          <section className="pilot-panel">
            <h2>Доски</h2>
            <form onSubmit={event=>void create(event)} className="pilot-create">
              <input placeholder="Название новой тестовой доски" aria-label="Название доски"
                value={newTitle} onChange={e=>setNewTitle(e.target.value)}/>
              <button disabled={busy} type="submit">Создать</button>
            </form>
            <div className="pilot-board-list">
              {boards.map(board=><button key={board.id} type="button"
                aria-current={boardId===board.id?"page":undefined}
                onClick={()=>{if(dirty&&!window.confirm("Черновик не сохранён. Переключить доску?"))return;setBoardId(board.id)}}>
                <strong>{board.title}</strong><small>{board.role==="owner"?"Владелец":board.role==="editor"?"Редактор":"Читатель"}</small>
              </button>)}
              {!boards.length&&<p className="pilot-muted">Досок ещё нет.</p>}
            </div>
            <button type="button" onClick={()=>void pilotBoards().then(setBoards).catch(e=>setError(issueText(e)))}>
              Обновить список
            </button>
          </section>
          <section className="pilot-panel">
            <div className="pilot-doc-header">
              <h2>{selected?.title||"Выберите доску"}</h2>
              <span className="pilot-ws">{realtime==="online"?"● WebSocket подключён":realtime==="reconnecting"?"◌ Переподключение":"○ Отключено"}</span>
            </div>
            {selected?<>
              <p className="pilot-muted">Серверная версия: {document?.version??"загрузка"}</p>
              {!document?<p>Загрузка документа…</p>:
                !isPilotDocument(document)?
                  <p className="pilot-alert">Это существующий документ Lektrus. Во избежание повреждения он доступен здесь только для чтения.</p>:
                  <>
                    <label>Общая заметка для проверки синхронизации
                      <textarea rows={9} disabled={busy||selected.role==="viewer"}
                        value={note} onChange={e=>{
                          const value=e.target.value;setNote(value);
                          const changed=value!==savedNote.current;
                          dirtyRef.current=changed;setDirty(changed);
                        }}/>
                    </label>
                    {serverChanged&&<div className="pilot-alert" role="alert">
                      Другой браузер изменил доску. Твой текст сохранён в поле, но автоматически не перезаписывает сервер.
                    </div>}
                    <div className="pilot-actions">
                      <button type="button" className="pilot-primary" disabled={busy||!dirty||serverChanged||selected.role==="viewer"}
                        onClick={()=>void save()}>Сохранить</button>
                      <button type="button" disabled={busy} onClick={()=>void reload()}>
                        Загрузить последнюю версию
                      </button>
                      {dirty&&<button type="button" onClick={()=>void navigator.clipboard.writeText(note)
                        .then(()=>setNotice("Черновик скопирован")).catch(()=>setError("Скопируйте текст из поля вручную."))}>
                        Скопировать черновик
                      </button>}
                    </div>
                    <SelfhostPilotCanvas key={boardId} boardId={boardId||""}
                      canDraw={selected.role!=="viewer"} incoming={liveFrame}
                      savedStrokes={Array.isArray(document.document?.ink)?document.document.ink:[]}
                      undoneStrokeIds={inkHistory.filter(x=>x.type==="ink_undo").map(x=>x.stroke_id)}
                      sendCursor={(id,x,y)=>liveChannelRef.current?.sendCursor(id,x,y)??false}
                      sendInk={(packet:PilotLiveInkPacket)=>liveChannelRef.current?.sendInk(packet)??false}
                      onPersist={persistInk} onUndo={undoInk}/>
                    <div className="pilot-history">
                      <h3>Последние операции</h3>
                      {inkHistory.length===0?<p className="pilot-muted">Пока нет сохранённых штрихов.</p>:
                        <ul>{inkHistory.slice(0,8).map(entry=><li key={entry.operation_id}>
                          <span>{entry.type==="ink_append"?"Штрих добавлен":"Штрих отменён"}</span>
                          <span>Версия {entry.version}</span>
                        </li>)}</ul>}
                    </div>
                  </>
              }
              {selected.role==="owner"&&<div className="pilot-invites">
                <h3>Пригласить участника</h3>
                <form onSubmit={event=>void sendInvite(event)}>
                  <input type="email" aria-label="Email участника" placeholder="email ученика" required
                    value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/>
                  <select aria-label="Доступ" value={inviteRole}
                    onChange={e=>setInviteRole(e.target.value as "viewer"|"editor")}>
                    <option value="viewer">Просмотр</option><option value="editor">Редактор</option>
                  </select>
                  <button disabled={busy} type="submit">Пригласить</button>
                </form>
                {access&&<p className="pilot-muted">Участников: {access.members.length}; ожидающих приглашений: {access.invites.length}</p>}
              </div>}
            </>:<p className="pilot-muted">Создайте доску для проверки нового сервера.</p>}
          </section>
        </div>
      </>}
      <footer>Никакие данные этого экрана не отправляются в рабочий Supabase. Не используйте его для настоящих уроков.</footer>
    </main>
  </div>;
}
