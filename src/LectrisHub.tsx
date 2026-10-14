import { useEffect, useMemo, useState } from "react";
import type { AccountRole } from "./accountRoleStore";
import type { AuthUser } from "./authStore";
import type { BoardSummary } from "./boardStore";
import { getStudentsForTeacher, type StudentRecord } from "./studentsStore";
import { listScheduledLessons, type ScheduledLesson } from "./scheduleStore";

type View = "home" | "subjects" | "groups";
type Organization = { subject: string; group: string };
type Props = {
  user: AuthUser;
  role: AccountRole;
  view: View;
  boards: BoardSummary[];
  loading: boolean;
  creating: boolean;
  onOpenBoard: (board: BoardSummary) => void;
  onCreateBoard: () => void;
};
const commonSubjects = ["Математика","Русский язык","Физика","Химия","Биология","География","История","Английский язык","Информатика","Литература"];
const storageKey=(id:string)=>"lectris.board-organization.v1."+id;
function loadOrganization(id:string):Record<string,Organization> {
  try{
    const parsed:unknown=JSON.parse(localStorage.getItem(storageKey(id))||"{}");
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return {};
    const result:Record<string,Organization>={};
    for(const [key,raw] of Object.entries(parsed)){
      if(!raw||typeof raw!=="object")continue;
      const o=raw as Record<string,unknown>;
      result[key]={subject:typeof o.subject==="string"?o.subject.slice(0,80):"",group:typeof o.group==="string"?o.group.slice(0,80):""};
    }
    return result;
  }catch{return {}}
}
const shortDate=(iso:string)=>new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(iso));
const navigate=(section:string)=>{window.history.pushState({},"",section?"/?section="+encodeURIComponent(section):"/");window.dispatchEvent(new PopStateEvent("popstate"))};

export default function LectrisHub({user,role,view,boards,loading,creating,onOpenBoard,onCreateBoard}:Props){
  const teacher=role==="teacher";
  const [organization,setOrganization]=useState<Record<string,Organization>>(()=>loadOrganization(user.id));
  const [editing,setEditing]=useState<string|null>(null);
  const [subjectDraft,setSubjectDraft]=useState("");
  const [groupDraft,setGroupDraft]=useState("");
  const [scope,setScope]=useState<string|null>(null);
  const [students,setStudents]=useState<StudentRecord[]>([]);
  const [lessons,setLessons]=useState<ScheduledLesson[]>([]);
  const [dataLoading,setDataLoading]=useState(true);
  useEffect(()=>{setOrganization(loadOrganization(user.id));setScope(null);setEditing(null)},[user.id]);
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
  const subjectList=useMemo(()=>[...new Set(boards.map(b=>organization[b.id]?.subject||"").filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ru")),[boards,organization]);
  const groupList=useMemo(()=>[...new Set(boards.map(b=>organization[b.id]?.group||"").filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ru")),[boards,organization]);
  const openEdit=(board:BoardSummary)=>{
    const current=getOrg(board);setEditing(board.id);setSubjectDraft(current.subject);setGroupDraft(current.group);
  };
  const saveEdit=()=>{
    if(!editing)return;
    const next={...organization,[editing]:{subject:subjectDraft.trim().slice(0,80),group:groupDraft.trim().slice(0,80)}};
    try{localStorage.setItem(storageKey(user.id),JSON.stringify(next));setOrganization(next);setEditing(null)}catch{
      window.alert("Не удалось сохранить организацию доски в браузере.");
    }
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
    <button type="button" className="lectris-hub-board-edit" onClick={()=>openEdit(board)} aria-label={"Организация доски "+board.title} title="Предмет и группа">⋯</button>
  </article>;
  const totals=<div className="lectris-hub-stats">
    <div><strong>{boards.length}</strong><span>{teacher?"Мои и общие доски":"Доступные доски"}</span></div>
    <div><strong>{teacher?students.length:subjectList.length}</strong><span>{teacher?"Ученики":"Предметы"}</span></div>
    <div><strong>{upcoming.length}</strong><span>Ближайшие занятия</span></div>
  </div>;
  return <section className="lectris-hub" aria-label="Рабочее пространство Lectris">
    {view==="home"?<>
      <div className="lectris-hub-hero">
        <div className="lectris-hub-hero-copy"><span className="lectris-hub-overline">{teacher?"ПРОСТРАНСТВО ПРЕПОДАВАТЕЛЯ":"ПРОСТРАНСТВО УЧЕНИКА"}</span>
          <h1>{teacher?"Организуйте занятия в Lectris":"Ваше обучение в Lectris"}</h1>
          <p>{teacher?"Все доски, предметы, ученики и ближайшие уроки под рукой.":"Занятия, задания и доступные доски в одном месте."}</p>
        </div>
        <div className="lectris-hub-hero-actions">
          {teacher&&<button type="button" className="lectris-hub-primary" onClick={onCreateBoard} disabled={creating}>+ Создать доску</button>}
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
        </div>
        <section className="lectris-hub-section lectris-hub-collection-content">
          <div className="lectris-hub-section-head"><div><small>{chosenBoards.length} досок</small><h2>{scope===null?"Все доски":named(scope)}</h2></div></div>
          {loading?<p className="lectris-hub-placeholder">Загружаем…</p>:chosenBoards.length?<div className="lectris-hub-board-list">{chosenBoards.map(boardTile)}</div>:
            <div className="lectris-hub-empty"><strong>Здесь пока пусто</strong><p>Откройте меню «⋯» у доски и укажите предмет или группу.</p></div>}
          <p className="lectris-hub-local-note">Организация предметов и групп пока хранится только в этом браузере. Содержимое досок сохраняется как прежде.</p>
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
        <p className="lectris-hub-local-note">Эти метки видны только в данном браузере и не изменяют данные Supabase.</p>
        <footer><button type="button" onClick={()=>setEditing(null)}>Отмена</button><button type="button" className="lectris-hub-primary" onClick={saveEdit}>Сохранить</button></footer>
      </section>
    </div>}
  </section>;
}
