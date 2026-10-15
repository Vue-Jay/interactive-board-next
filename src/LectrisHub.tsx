import { useEffect, useMemo, useState } from "react";
import type { AccountRole } from "./accountRoleStore";
import type { AuthUser } from "./authStore";
import type { BoardSummary } from "./boardStore";
import { getStudentsForTeacher, type StudentRecord } from "./studentsStore";
import { listScheduledLessons, type ScheduledLesson } from "./scheduleStore";
import { flushLectrisOrganization, lectrisOrganizationSyncEnabled, loadLectrisOrganization, pendingLectrisOrganizationCount, queueLectrisBoardOrganization, queueLectrisCategory, queueLectrisLocalImport, readLectrisLocalCatalog, readLectrisLocalOrganization, type LectrisOrganization, type LectrisCategoryCatalog } from "./lectrisOrganizationStore";

type View = "home" | "subjects" | "groups";
type Organization=LectrisOrganization;
type Props = {
  user: AuthUser;
  role: AccountRole;
  view: View;
  boards: BoardSummary[];
  previews: Record<string,string>;
  loading: boolean;
  creating: boolean;
  onOpenBoard: (board: BoardSummary) => void;
  onCreateBoard: (association?:Partial<Organization>) => void;
};
const commonSubjects = ["Математика","Русский язык","Физика","Химия","Биология","География","История","Английский язык","Информатика","Литература"];
const shortDate=(iso:string)=>new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(iso));
const navigate=(section:string)=>{window.history.pushState({},"",section?"/?section="+encodeURIComponent(section):"/");window.dispatchEvent(new PopStateEvent("popstate"))};

export default function LectrisHub({user,role,view,boards,previews,loading,creating,onOpenBoard,onCreateBoard}:Props){
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
  const [boardSearch,setBoardSearch]=useState("");
  const [collectionSearch,setCollectionSearch]=useState("");
  const [categorySearch,setCategorySearch]=useState("");
  const [collectionMode,setCollectionMode]=useState<"tiles"|"list">(()=>{
    try{return localStorage.getItem("lektrus.collection-view")==="list"?"list":"tiles"}catch{return "tiles"}
  });
  const changeCollectionMode=(mode:"tiles"|"list")=>{
    setCollectionMode(mode);
    try{localStorage.setItem("lektrus.collection-view",mode)}catch{/* Display preferences are optional. */}
  };
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
  const importLocalOrganization=()=>{
    if(!teacher||!lectrisOrganizationSyncEnabled())return;
    const owned=boards.filter(board=>board.role==="owner").map(board=>board.id);
    if(!window.confirm("Перенести местные предметы, группы и привязки собственных досок в Lektrus? Существующие связи на сервере не будут перезаписаны."))return;
    const count=queueLectrisLocalImport(user.id,owned);
    if(!count){window.alert("Новых локальных данных для переноса нет.");return}
    setPendingCount(pendingLectrisOrganizationCount(user.id));
    void sendOrganization();
  };
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
  const recent=useMemo(()=>[...boards].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,3),[boards]);
  const getOrg=(board:BoardSummary):Organization=>organization[board.id]||{subject:"",group:""};
  const visibleHomeBoards=useMemo(()=>{
    const query=boardSearch.trim().toLocaleLowerCase("ru-RU");
    if(!query)return recent;
    return [...boards].filter(board=>{
      const org=organization[board.id];
      return [board.title,org?.subject||"",org?.group||""].some(value=>
        value.toLocaleLowerCase("ru-RU").includes(query));
    }).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  },[boardSearch,boards,organization,recent]);
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
  const collectionCategories=groupBy(view==="subjects"?"subject":"group").filter(value=>
    named(value).toLocaleLowerCase("ru-RU").includes(categorySearch.trim().toLocaleLowerCase("ru-RU")));
  const collectionBoards=chosenBoards.filter(board=>
    [board.title,getOrg(board).subject,getOrg(board).group].some(value=>
      value.toLocaleLowerCase("ru-RU").includes(collectionSearch.trim().toLocaleLowerCase("ru-RU"))));

  const label=(board:BoardSummary)=>getOrg(board);
  const boardTile=(board:BoardSummary)=> <article className="lectris-hub-board" key={board.id}>
    <button type="button" className="lectris-hub-board-main" onClick={()=>onOpenBoard(board)}>
      <span className="lectris-hub-board-cover" aria-hidden="true">
        {previews[board.id]
          ?<img src={previews[board.id]} alt="" decoding="async" className="lectris-hub-board-thumbnail"/>
          :<span className="lectris-hub-board-placeholder">Пустой холст</span>}
      </span>
      <span className="lectris-hub-board-info">
        <span className="lectris-hub-board-kind">{label(board).subject||"Рабочая доска"}{label(board).group?" · "+label(board).group:""}</span>
        <strong>{board.title}</strong>
        <small>{board.role==="owner"?"Моя доска":"Общая доска"} · {shortDate(board.updatedAt)}</small>
      </span>
      <span className="lectris-hub-board-arrow" aria-hidden="true">↗</span>
    </button>
    {teacher&&board.role==="owner"&&<button type="button" className="lectris-hub-board-edit" onClick={()=>openEdit(board)} aria-label={"Организация доски "+board.title} title="Предмет и группа">⋯</button>}
  </article>;
  const quickTiles=[
    {id:"boards",icon:"▤",eyebrow:"РАБОЧИЕ ПРОСТРАНСТВА",title:"Доски",description:"Открыть и продолжить",count:boards.length,theme:"blue"},
    {id:"assignments",icon:"✓",eyebrow:"УЧЕБНЫЙ ПРОЦЕСС",title:"Задания",description:"Проверка и выполнение",count:null,theme:"violet"},
    {id:"schedule",icon:"◷",eyebrow:"ПЛАНИРОВАНИЕ",title:"Занятия",description:"Расписание уроков",count:upcoming.length,theme:"coral"},
    {id:"notifications",icon:"✧",eyebrow:"НОВОСТИ И СОБЫТИЯ",title:"События",description:"Обновления и уведомления",count:null,theme:"mint"},
  ];
  const syncIndicator=<div className="lectris-hub-sync" role="status">
    <span className={`lectris-hub-sync-dot status-${syncStatus}`}/>
    {syncStatus==="synced"?"Структура синхронизирована":syncStatus==="saving"?"Сохраняем структуру…":syncStatus==="error"?"Не удалось синхронизировать":"Предметы и группы сохраняются на этом устройстве"}
    {pendingCount>0&&<span> · ожидает отправки: {pendingCount}</span>}
    {lectrisOrganizationSyncEnabled()&&teacher&&<button type="button" disabled={syncStatus==="saving"} onClick={importLocalOrganization}>Перенести локальные метки</button>}
    {lectrisOrganizationSyncEnabled()&&<button type="button" disabled={syncStatus==="saving"} onClick={()=>void sendOrganization()}>Повторить синхронизацию</button>}
  </div>;
  return <section className="lectris-hub" aria-label="Рабочее пространство Lektrus">
    {view!=="home"&&syncIndicator}
    {view==="home"?<>
      <header className="lectris-hub-hero lectris-hub-hero-compact">
        <div className="lectris-hub-hero-copy">
          <div className="lectris-hub-hero-topline">
            <span className="lectris-hub-hero-chip">{teacher?"РАБОЧЕЕ МЕСТО ПРЕПОДАВАТЕЛЯ":"МОЁ ОБУЧЕНИЕ"}</span>
            <span className="lectris-hub-hero-metric">{teacher?`Доски: ${boards.length} · Ученики: ${students.length}`:`Доступные доски: ${boards.length}`}</span>
          </div>
          <h1>{teacher?"Всё для ваших занятий":"Ваше учебное пространство"}</h1>
          <p>{teacher?"Создавайте доски, готовьте уроки и продолжайте с того места, где остановились.":"Доски, задания и занятия собраны в одном месте."}</p>
          {syncIndicator}
        </div>
        <div className="lectris-hub-hero-actions">
          {teacher&&<button type="button" className="lectris-hub-primary" onClick={()=>onCreateBoard()} disabled={creating}>+ Новая доска</button>}
          <button type="button" onClick={()=>navigate("schedule")}>Расписание <span aria-hidden="true">↗</span></button>
        </div>
      </header>
      <div className="lectris-hub-section-label"><div><span className="lectris-hub-overline">БЫСТРЫЙ ДОСТУП</span><h2>Ваш рабочий стол</h2></div><span>Выберите, с чего начать</span></div>
      <div className="lectris-hub-tiles" aria-label="Основные разделы">
        {quickTiles.map(tile=><button type="button" key={tile.id} className={`lectris-hub-tile lectris-hub-tile-${tile.theme}`} onClick={()=>navigate(tile.id)}>
          <span className="lectris-hub-tile-head"><span className="lectris-hub-tile-icon" aria-hidden="true">{tile.icon}</span><span className="lectris-hub-tile-arrow" aria-hidden="true">↗</span></span>
          <span className="lectris-hub-tile-copy"><small>{tile.eyebrow}</small><strong>{tile.title}</strong><span>{tile.description}</span></span>
          {tile.count!==null&&<span className="lectris-hub-tile-count">{tile.count}</span>}
        </button>)}
      </div>
      <div className="lectris-hub-section-label lectris-hub-section-label-secondary"><div><span className="lectris-hub-overline">ЗАНЯТИЯ И МАТЕРИАЛЫ</span><h2>Продолжить работу</h2></div></div>
      <div className="lectris-hub-columns">
        <section className="lectris-hub-section">
          <div className="lectris-hub-section-head"><div><small>МОИ РАБОЧИЕ ДОСКИ</small><h2>{boardSearch.trim()?"Результаты поиска":"Недавние доски"}</h2></div><button type="button" onClick={()=>navigate("boards")}>Все доски →</button></div>
          <div className="lectris-hub-board-search">
            <input type="search" value={boardSearch} onChange={event=>setBoardSearch(event.target.value)}
              placeholder="Найти доску, предмет или группу" aria-label="Поиск по всем доскам, предметам и группам"/>
            {boardSearch&&<button type="button" aria-label="Очистить поиск" title="Очистить поиск" onClick={()=>setBoardSearch("")}>×</button>}
          </div>
          {loading?<p className="lectris-hub-placeholder">Загружаем доски…</p>:visibleHomeBoards.length?
            <div className="lectris-hub-board-list">{visibleHomeBoards.map(boardTile)}</div>:
            <div className="lectris-hub-empty"><strong>{boardSearch.trim()?"Ничего не найдено":"Пока нет досок"}</strong>
              <p>{boardSearch.trim()?"Попробуйте другое название или очистите поиск.":teacher?"Создайте доску, чтобы начать занятие.":"Откройте доску по приглашению преподавателя."}</p></div>}
        </section>
        <div className="lectris-hub-aside">
          <section className="lectris-hub-section">
            <div className="lectris-hub-section-head"><div><small>ПЛАН</small><h2>Ближайшие занятия</h2></div><button type="button" onClick={()=>navigate("schedule")}>Календарь →</button></div>
            {dataLoading?<p className="lectris-hub-placeholder">Загружаем расписание…</p>:upcoming.length?
              upcoming.slice(0,2).map(lesson=><div className="lectris-hub-lesson" key={lesson.id}><div><strong>{lesson.title}</strong><small>{shortDate(lesson.startsAt)} · {lesson.durationMinutes} мин</small>{teacher&&<small>{lesson.studentName}</small>}</div>
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
      <div className="lektrus-collection">
        <div className="lektrus-page-heading">
          <div>
            <span className="lectris-hub-overline">ОРГАНИЗАЦИЯ ЗАНЯТИЙ</span>
            <h1>{view==="subjects"?"Предметы":"Группы и классы"}</h1>
            <p>{view==="subjects"?"Быстрый доступ к доскам по учебным предметам.":"Объединяйте доски по классам и учебным группам."}</p>
          </div>
          <div className="lektrus-page-heading-actions">
            {teacher&&<button type="button" className="lektrus-category-create" onClick={()=>setCategoryEntryOpen(true)}>
              <span aria-hidden="true">＋</span> {view==="subjects"?"Добавить предмет":"Добавить группу"}
            </button>}
            <button type="button" className="lektrus-page-secondary" onClick={()=>navigate("boards")}>Все доски ↗</button>
          </div>
        </div>
        <section className="lektrus-category-panel" aria-label={view==="subjects"?"Каталог предметов":"Каталог групп"}>
          <div className="lektrus-category-panel-heading">
            <div><strong>{view==="subjects"?"Выберите предмет":"Выберите группу"}</strong><small>{groupBy(view==="subjects"?"subject":"group").length} разделов</small></div>
            <input type="search" aria-label="Поиск по разделам" placeholder={view==="subjects"?"Найти предмет":"Найти группу"}
              value={categorySearch} onChange={event=>setCategorySearch(event.target.value)}/>
          </div>
          <div className="lektrus-category-strip" role="group" aria-label="Фильтр по категории">
            <button type="button" aria-pressed={scope===null} className={scope===null?"selected":""} onClick={()=>setScope(null)}>
              <span className="lektrus-category-symbol" aria-hidden="true">▦</span><span className="lektrus-category-name">Все доски</span><b>{boards.length}</b>
            </button>
            {collectionCategories.map((value,index)=><button type="button" key={value||"-"} aria-pressed={scope===value} className={scope===value?"selected":""} onClick={()=>setScope(value)}>
              <span className={`lektrus-category-symbol lektrus-category-color-${index%4}`} aria-hidden="true">{view==="subjects"?"▤":"♧"}</span>
              <span className="lektrus-category-name">{named(value)}</span>
              <b>{boards.filter(board=>getOrg(board)[view==="subjects"?"subject":"group"]===value).length}</b>
            </button>)}
            {categorySearch&&!collectionCategories.length&&<div className="lektrus-category-no-results">Ничего не найдено</div>}
          </div>
          {teacher&&categoryEntryOpen&&<form className="lektrus-category-form" onSubmit={event=>{event.preventDefault();createCategory()}}>
            <input autoFocus aria-label={view==="subjects"?"Название предмета":"Название группы"} maxLength={80}
              placeholder={view==="subjects"?"Новый предмет, например химия":"Новая группа, например 9А"}
              value={categoryDraft} onChange={event=>setCategoryDraft(event.target.value)}
              onKeyDown={event=>event.stopPropagation()}/>
            <button type="submit" disabled={!categoryDraft.trim()}>Добавить</button>
            <button type="button" onClick={()=>{setCategoryEntryOpen(false);setCategoryDraft("")}}>Отмена</button>
          </form>}
        </section>
        <section className="lektrus-collection-boards" aria-label="Доски выбранной категории">
          <div className="lektrus-collection-topline">
            <div><span className="lectris-hub-overline">РАБОЧИЕ ДОСКИ</span>
              <h2>{scope===null?"Все доски":named(scope)} <span className="lektrus-collection-count">{chosenBoards.length}</span></h2>
            </div>
            <div className="lektrus-collection-actions">
              <input type="search" aria-label="Поиск досок в категории" placeholder="Найти доску"
                value={collectionSearch} onChange={event=>setCollectionSearch(event.target.value)}/>
              <div className="lektrus-view-switch" role="group" aria-label="Представление досок">
                <button type="button" aria-label="Плитки" title="Плитки" aria-pressed={collectionMode==="tiles"}
                  className={collectionMode==="tiles"?"selected":""} onClick={()=>changeCollectionMode("tiles")}>▦</button>
                <button type="button" aria-label="Список" title="Список" aria-pressed={collectionMode==="list"}
                  className={collectionMode==="list"?"selected":""} onClick={()=>changeCollectionMode("list")}>☰</button>
              </div>
              {teacher&&<button type="button" className="lektrus-collection-add" disabled={creating}
                onClick={()=>onCreateBoard(scope===null?undefined:view==="subjects"?{subject:scope}:{group:scope})}>+ Доска</button>}
            </div>
          </div>
          {loading?<p className="lectris-hub-placeholder">Загружаем доски…</p>:
            collectionBoards.length?<div className={`lectris-hub-board-list lektrus-collection-gallery ${collectionMode==="list"?"is-list":"is-tiles"}`}>
              {collectionBoards.map(boardTile)}
            </div>:<div className="lektrus-collection-empty">
              <strong>{collectionSearch?"Ничего не найдено":"В этом разделе пока нет досок"}</strong>
              <p>{collectionSearch?"Попробуйте изменить запрос.":"Откройте настройки доски и укажите предмет или группу."}</p>
              {collectionSearch&&<button type="button" onClick={()=>setCollectionSearch("")}>Очистить поиск</button>}
              {!collectionSearch&&teacher&&<button type="button" disabled={creating} onClick={()=>onCreateBoard(scope===null?undefined:view==="subjects"?{subject:scope}:{group:scope})}>Создать доску</button>}
            </div>}
          <p className="lektrus-collection-sync-note">{lectrisOrganizationSyncEnabled()?
            "Предметы и группы синхронизируются с сервером Lektrus.":
            "Категории пока сохраняются в этом браузере. Содержимое досок сохраняется отдельно."}</p>
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
        <p className="lectris-hub-local-note">{lectrisOrganizationSyncEnabled()?"Метаданные синхронизируются с сервером Lektrus.":"Метки сохраняются локально и не изменяют общую базу Supabase."}</p>
        <footer><button type="button" onClick={()=>setEditing(null)}>Отмена</button><button type="button" className="lectris-hub-primary" onClick={saveEdit}>Сохранить</button></footer>
      </section>
    </div>}
  </section>;
}
