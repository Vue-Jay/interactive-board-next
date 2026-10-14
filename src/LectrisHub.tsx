import { useEffect, useMemo, useState } from "react";
import type { AccountRole } from "./accountRoleStore";
import type { AuthUser } from "./authStore";
import type { BoardSummary } from "./boardStore";
import { getStudentsForTeacher, type StudentRecord } from "./studentsStore";
import { listScheduledLessons, type ScheduledLesson } from "./scheduleStore";
import { flushLectrisOrganization, lectrisOrganizationSyncEnabled, loadLectrisOrganization, pendingLectrisOrganizationCount, queueLectrisBoardOrganization, queueLectrisCategory, readLectrisLocalCatalog, readLectrisLocalOrganization, type LectrisOrganization, type LectrisCategoryCatalog } from "./lectrisOrganizationStore";

type View = "home" | "subjects" | "groups";
type Organization=LectrisOrganization;
type Props = {
  user: AuthUser;
  role: AccountRole;
  view: View;
  boards: BoardSummary[];
  loading: boolean;
  creating: boolean;
  onOpenBoard: (board: BoardSummary) => void;
  onCreateBoard: (association?:Partial<Organization>) => void;
};
const commonSubjects = ["Математика","Русский язык","Физика","Химия","Биология","География","История","Английский язык","Информатика","Литература"];
const shortDate=(iso:string)=>new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(iso));
const navigate=(section:string)=>{window.history.pushState({},"",section?"/?section="+encodeURIComponent(section):"/");window.dispatchEvent(new PopStateEvent("popstate"))};

export default function LectrisHub({user,role,view,boards,loading,creating,onOpenBoard,onCreateBoard}:Props){
  const teacher=role==="teacher";
  const [organization,setOrganization]=useState<Record<string,Organization>>(()=>readLectrisLocalOrganization(user.id));
  const [editing,setEditing]=useState<string|null>(null);
  const [subjectDraft,setSubjectDraft]=useState("");
  const [groupDraft,setGroupDraft]=useState("");
  const [scope,setScope]=useState<string|null>(null);
  const [categoryCatalog,setCategoryCatalog]=useState<LectrisCategoryCatalog>(()=>readLectrisLocalCatalog(user.id));
  const [categoryEntryOpen,setCategoryEntryOpen]=useState(false);
  const [categoryDraft,setCategoryDraft]=useState("");
  const [syncStatus,setSyncStatus]=useState<"local"|"synced"|"error"|"saving">("local");
  const [pendingCount,setPendingCount]=useState(()=>pendingLectrisOrganizationCount(user.id));

  const [students,setStudents]=useState<StudentRecord[]>([]);
  const [lessons,setLessons]=useState<ScheduledLesson[]>([]);
  const [dataLoading,setDataLoading]=useState(true);
  useEffect(()=>{
    setOrganization(readLectrisLocalOrganization(user.id));
    setCategoryCatalog(readLectrisLocalCatalog(user.id));
    setPendingCount(pendingLectrisOrganizationCount(user.id));
    setScope(null);setEditing(null);setCategoryEntryOpen(false);
  },[user.id]);
  const boardIds=useMemo(()=>boards.map(board=>board.id),[boards]);
  const reloadOrganization=async()=>{
    const result=await loadLectrisOrganization(user.id,boardIds);
    setOrganization(result.organization);
    setCategoryCatalog(result.catalog);
    setPendingCount(result.pending);
    setSyncStatus(result.status);
  };
  useEffect(()=>{
    let alive=true;
    void loadLectrisOrganization(user.id,boardIds).then(result=>{
      if(!alive)return;
      setOrganization(result.organization);
      setCategoryCatalog(result.catalog);
      setPendingCount(result.pending);
      setSyncStatus(result.status);
    });
    return()=>{alive=false};
  },[user.id,boardIds]);
  useEffect(()=>{
    const onFocus=()=>{if(document.visibilityState==="visible")void reloadOrganization()};
    window.addEventListener("focus",onFocus);
    return()=>window.removeEventListener("focus",onFocus);
  },[user.id,boardIds]);
  const sendOrganization=async()=>{
    if(!lectrisOrganizationSyncEnabled()){setSyncStatus("local");return}
    setSyncStatus("saving");
    try{await flushLectrisOrganization(user.id);await reloadOrganization()}
    catch{setSyncStatus("error");setPendingCount(pendingLectrisOrganizationCount(user.id))}
  };

  useEffect(()=>{
    let active=true;setDataLoading(true);
    void Promise.allSettled([
      teacher?getStudentsForTeacher(user):Promise.resolve([] as StudentRecord[]),
      listScheduledLessons(user.id)
    ]).then(([a,b])=>{
      if(!active)return;
      setStudents(a.status==="fulfilled"?a.value:[]);
      setLessons(b.status==="fulfilled"?b.value:[]);
    }).finally(()=>{if(active)setDataLoading(false)});
    return()=>{active=false};
  },[user.id,teacher]);
  const boardById=useMemo(()=>new Map(boards.map(b=>[b.id,b])),[boards]);
  const upcoming=useMemo(()=>lessons.filter(l=>l.status==="planned"&&Date.parse(l.startsAt)>=Date.now()-30*60*1000)
    .sort((a,b)=>a.startsAt.localeCompare(b.startsAt)),[lessons]);
  const recent=useMemo(()=>[...boards].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,6),[boards]);
  const getOrg=(board:BoardSummary):Organization=>organization[board.id]||{subject:"",group:""};
  const subjectList=useMemo(()=>[...new Set([...categoryCatalog.subjects,...boards.map(b=>organization[b.id]?.subject||"").filter(Boolean)])].sort((a,b)=>a.localeCompare(b,"ru")),[boards,organization,categoryCatalog.subjects]);
  const groupList=useMemo(()=>[...new Set([...categoryCatalog.groups,...boards.map(b=>organization[b.id]?.group||"").filter(Boolean)])].sort((a,b)=>a.localeCompare(b,"ru")),[boards,organization,categoryCatalog.groups]);
  const openEdit=(board:BoardSummary)=>{
    const current=getOrg(board);setEditing(board.id);setSubjectDraft(current.subject);setGroupDraft(current.group);
  };
  const saveEdit=()=>{
    if(!editing||!teacher||boards.find(b=>b.id===editing)?.role!=="owner")return;
    const value={subject:subjectDraft.trim().slice(0,80),group:groupDraft.trim().slice(0,80)};
    try{
      queueLectrisBoardOrganization(user.id,editing,value);
      setOrganization(readLectrisLocalOrganization(user.id));
      setEditing(null);
      setPendingCount(pendingLectrisOrganizationCount(user.id));
      void sendOrganization();
    }catch{window.alert("Не удалось сохранить организацию доски в браузере.")}
  };
  const createCategory=()=>{
    if(!teacher)return;
    const name=categoryDraft.trim().slice(0,80);
    if(!name)return;
    const key=view==="subjects"?"subjects":"groups";
    const existing=key==="subjects"?subjectList:groupList;
    const matched=existing.find(value=>value.toLocaleLowerCase("ru")===name.toLocaleLowerCase("ru"));
    if(matched){setScope(matched);setCategoryDraft("");setCategoryEntryOpen(false);return}
    try{
      queueLectrisCategory(user.id,key==="subjects"?"subject":"group",name);
      setCategoryCatalog(readLectrisLocalCatalog(user.id));
      setScope(name);setCategoryDraft("");setCategoryEntryOpen(false);
      setPendingCount(pendingLectrisOrganizationCount(user.id));
      void sendOrganization();
    }catch{window.alert("Браузер не разрешил сохранить новый раздел.")}
  };
  const groupBy=(key:"subject"|"group")=>{
    const values=key==="subject"?subjectList:groupList;
    return [...values,...(boards.some(b=>!getOrg(b)[key])?[""]:[])];
  };
  const chosenBoards=scope===null?boards:boards.filter(b=>getOrg(b)[view==="subjects"?"subject":"group"]===scope);
  const named=(v:string)=>v||(view==="subjects"?"Без предмета":"Без группы");
  const label=(board:BoardSummary)=>getOrg(board);
  const boardTile=(board:BoardSummary)=> <article className="lectris-hub-board" key={board.id}>
    <button type="button" className="lectris-hub-board-main" onClick={()=>onOpenBoard(board)}>
      <span className="lectris-hub-board-icon" aria-hidden="true">▧</span>
      <span className="lectris-hub-board-info"><strong>{board.title}</strong>
        <small>{label(board).subject||"Без предмета"}{label(board).group?" · "+label(board).group:""}</small>
        <small>{board.role==="owner"?"Моя доска":"Доступ предоставлен"} · {shortDate(board.updatedAt)}</small>
      </span>
      <span className="lectris-hub-board-arrow" aria-hidden="true">↗</span>
    </button>
    {teacher&&board.role==="owner"&&<button type="button" className="lectris-hub-board-edit" onClick={()=>openEdit(board)} aria-label={"Организация доски "+board.title} title="Предмет и группа">⋯</button>}
  </article>;
  const totals=<div className="lectris-hub-stats">
    <div><strong>{boards.length}</strong><span>{teacher?"Мои и общие доски":"Доступные доски"}</span></div>
    <div><strong>{teacher?students.length:subjectList.length}</strong><span>{teacher?"Ученики":"Предметы"}</span></div>
    <div><strong>{upcoming.length}</strong><span>Ближайшие занятия</span></div>
  </div>;
  return <section className="lectris-hub" aria-label="Рабочее пространство Lectris">
    <div className="lectris-hub-sync" role="status">
      <span className={`lectris-hub-sync-dot status-${syncStatus}`}/>
      {syncStatus==="synced"?"Структура синхронизирована":syncStatus==="saving"?"Сохраняем структуру…":syncStatus==="error"?"Не удалось синхронизировать":"Предметы и группы сохраняются на этом устройстве"}
      {pendingCount>0&&<span> · ожидает отправки: {pendingCount}</span>}
      {lectrisOrganizationSyncEnabled()&&<button type="button" disabled={syncStatus==="saving"} onClick={()=>void sendOrganization()}>Повторить синхронизацию</button>}
    </div>
    {view==="home"?<>
      <div className="lectris-hub-hero">
        <div className="lectris-hub-hero-copy"><span className="lectris-hub-overline">{teacher?"ПРОСТРАНСТВО ПРЕПОДАВАТЕЛЯ":"ПРОСТРАНСТВО УЧЕНИКА"}</span>
          <h1>{teacher?"Организуйте занятия в Lectris":"Ваше обучение в Lectris"}</h1>
          <p>{teacher?"Все доски, предметы, ученики и ближайшие уроки под рукой.":"Занятия, задания и доступные доски в одном месте."}</p>
        </div>
        <div className="lectris-hub-hero-actions">
          {teacher&&<button type="button" className="lectris-hub-primary" onClick={()=>onCreateBoard()} disabled={creating}>+ Создать доску</button>}
          <button type="button" onClick={()=>navigate("schedule")}>{teacher?"Расписание занятий":"Мои занятия"} ↗</button>
        </div>
      </div>
      {totals}
      <div className="lectris-hub-columns">
        <section className="lectris-hub-section">
          <div className="lectris-hub-section-head"><div><small>ПРОДОЛЖИТЬ РАБОТУ</small><h2>Недавние доски</h2></div><button type="button" onClick={()=>navigate("boards")}>Все доски →</button></div>
          {loading?<p className="lectris-hub-placeholder">Загружаем доски…</p>:recent.length?
            <div className="lectris-hub-board-list">{recent.map(boardTile)}</div>:
            <div className="lectris-hub-empty"><strong>Пока нет досок</strong><p>{teacher?"Создайте доску, чтобы начать занятие.":"Откройте доску по приглашению преподавателя."}</p></div>}
        </section>
        <div className="lectris-hub-aside">
          <section className="lectris-hub-section">
            <div className="lectris-hub-section-head"><div><small>ПЛАН</small><h2>Ближайшие занятия</h2></div><button type="button" onClick={()=>navigate("schedule")}>Календарь →</button></div>
            {dataLoading?<p className="lectris-hub-placeholder">Загружаем расписание…</p>:upcoming.length?
              upcoming.slice(0,4).map(lesson=><div className="lectris-hub-lesson" key={lesson.id}><div><strong>{lesson.title}</strong><small>{shortDate(lesson.startsAt)} · {lesson.durationMinutes} мин</small>{teacher&&<small>{lesson.studentName}</small>}</div>
                {boardById.has(lesson.boardId)&&<button type="button" onClick={()=>onOpenBoard(boardById.get(lesson.boardId)!)}>Открыть</button>}
              </div>):
              <p className="lectris-hub-placeholder">Предстоящих занятий пока нет.</p>}
          </section>
          <section className="lectris-hub-section">
            <div className="lectris-hub-section-head"><div><small>ОРГАНИЗАЦИЯ</small><h2>Разделы</h2></div></div>
            <div className="lectris-hub-shortcuts">
              <button type="button" onClick={()=>navigate("subjects")}>Предметы <span>→</span></button>
              {teacher&&<button type="button" onClick={()=>navigate("groups")}>Группы и классы <span>→</span></button>}
              {teacher&&<button type="button" onClick={()=>navigate("students")}>Ученики <span>→</span></button>}
              <button type="button" onClick={()=>navigate("assignments")}>Задания <span>→</span></button>
            </div>
          </section>
        </div>
      </div>
    </>:<>
      <div className="lectris-hub-list-heading">
        <div><span className="lectris-hub-overline">ЕДИНОЕ РАБОЧЕЕ ПРОСТРАНСТВО</span><h1>{view==="subjects"?"Предметы":"Группы и классы"}</h1>
          <p>Одна доска может отображаться в разных разделах. Новые копии при этом не создаются.</p></div>
        <button type="button" onClick={()=>navigate("boards")}>Все доски →</button>
      </div>
      <div className="lectris-hub-collection">
        <div className="lectris-hub-categories" role="group" aria-label={view==="subjects"?"Выбор предмета":"Выбор группы"}>
          <button type="button" className={scope===null?"selected":""} onClick={()=>setScope(null)}>Все <span>{boards.length}</span></button>
          {groupBy(view==="subjects"?"subject":"group").map(value=><button type="button" key={value||"-"} className={scope===value?"selected":""} onClick={()=>setScope(value)}>{named(value)}
            <span>{boards.filter(b=>getOrg(b)[view==="subjects"?"subject":"group"]===value).length}</span>
          </button>)}
          {teacher&&<div className="lectris-hub-new-category">
            {categoryEntryOpen?<form onSubmit={e=>{e.preventDefault();createCategory()}}>
              <input aria-label={view==="subjects"?"Название предмета":"Название группы"} maxLength={80}
                placeholder={view==="subjects"?"Название предмета":"Название группы"}
                value={categoryDraft} onChange={e=>setCategoryDraft(e.target.value)}
                onKeyDown={e=>e.stopPropagation()}/>
              <div><button type="submit" disabled={!categoryDraft.trim()}>Создать</button>
                <button type="button" onClick={()=>{setCategoryEntryOpen(false);setCategoryDraft("")}}>Отмена</button></div>
            </form>:<button type="button" className="lectris-hub-new-category-trigger"
              onClick={()=>setCategoryEntryOpen(true)}>+ {view==="subjects"?"Новый предмет":"Новая группа"}</button>}
          </div>}
        </div>
        <section className="lectris-hub-section lectris-hub-collection-content">
          <div className="lectris-hub-section-head"><div><small>{chosenBoards.length} досок</small><h2>{scope===null?"Все доски":named(scope)}</h2></div>
            {teacher&&<button type="button" disabled={creating}
              onClick={()=>onCreateBoard(scope===null?undefined:view==="subjects"?{subject:scope}:{group:scope})}>+ Доска</button>}
          </div>
          {loading?<p className="lectris-hub-placeholder">Загружаем…</p>:chosenBoards.length?<div className="lectris-hub-board-list">{chosenBoards.map(boardTile)}</div>:
            <div className="lectris-hub-empty"><strong>Здесь пока пусто</strong><p>Откройте меню «⋯» у доски и укажите предмет или группу.</p></div>}
          <p className="lectris-hub-local-note">{lectrisOrganizationSyncEnabled()?"Структура сохраняется в отдельном Supabase Lectris. Изменения досок остаются в прежней системе совместной работы.":"Сейчас предметы и группы сохраняются в этом браузере. Для синхронизации потребуется отдельный проект Supabase Lectris."}</p>
        </section>
      </div>
    </>}
    {editing&&<div className="lectris-hub-dialog-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)setEditing(null)}}>
      <section className="lectris-hub-dialog" role="dialog" aria-modal="true" aria-label="Организация доски">
        <header><div><small>LECTRIS · ОРГАНИЗАЦИЯ</small><h2>Предмет и группа</h2></div><button type="button" onClick={()=>setEditing(null)} aria-label="Закрыть">×</button></header>
        <p>Привяжите эту доску к предмету и группе. Она останется той же самой доской.</p>
        <label>Предмет<input list="lectris-subject-suggestions" placeholder="Например, химия" maxLength={80} value={subjectDraft} onChange={e=>setSubjectDraft(e.target.value)}/></label>
        <datalist id="lectris-subject-suggestions">{commonSubjects.map(x=><option value={x} key={x}/>)}</datalist>
        <label>Группа или класс<input placeholder="Например, 9А" maxLength={80} value={groupDraft} onChange={e=>setGroupDraft(e.target.value)}/></label>
        <p className="lectris-hub-local-note">{lectrisOrganizationSyncEnabled()?"Метаданные синхронизируются с сервером Lectris.":"Метки сохраняются локально и не изменяют общую базу Supabase."}</p>
        <footer><button type="button" onClick={()=>setEditing(null)}>Отмена</button><button type="button" className="lectris-hub-primary" onClick={saveEdit}>Сохранить</button></footer>
      </section>
    </div>}
  </section>;
}
