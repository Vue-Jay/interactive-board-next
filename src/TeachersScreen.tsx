import { useEffect, useState } from "react";
import { getUserById, participantRoleFor, type AuthUser } from "./authStore";
import { getUserBoards } from "./boardStore";
import { isSelfhostBackendEnabled, selfhostRequest } from "./selfhostApi";
import { isRemoteBackendEnabled } from "./backend";
import UserAvatar from "./UserAvatar";

type Teacher = { user_id:string; name:string; boards:{id:string;title:string}[] };

async function listTeachers(user:AuthUser):Promise<Teacher[]> {
  if(isSelfhostBackendEnabled())return selfhostRequest<Teacher[]>("/api/v1/teachers");
  if(isRemoteBackendEnabled())throw new Error("Список преподавателей доступен на сервере Lektrus.");
  const teachers=new Map<string,Teacher>();
  for(const board of await getUserBoards(user)){
    if(board.ownerId===user.id||participantRoleFor(board.role,board.participantRole)!=="student")continue;
    const teacher=teachers.get(board.ownerId)||{user_id:board.ownerId,name:getUserById(board.ownerId)?.name||"Преподаватель",boards:[]};
    teacher.boards.push({id:board.id,title:board.title});
    teachers.set(board.ownerId,teacher);
  }
  return [...teachers.values()].sort((a,b)=>a.name.localeCompare(b.name,"ru"));
}

export default function TeachersScreen({user,onOpenBoard}:{user:AuthUser;onOpenBoard:(id:string)=>void}){
  const [teachers,setTeachers]=useState<Teacher[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;
    setLoading(true);setError("");
    void listTeachers(user).then(rows=>{if(active)setTeachers(rows)})
      .catch(()=>{if(active)setError("Не удалось загрузить преподавателей. Проверьте подключение и попробуйте ещё раз.")})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[user.id,attempt]);
  return <main className="assignments-shell teachers-shell">
    <header className="students-header"><div><div><strong>Преподаватели</strong><span>Ваши преподаватели и доступные учебные доски</span></div></div></header>
    <section className="assignments-content">
      {loading?<div className="boards-empty" role="status"><strong>Загружаем преподавателей…</strong></div>
        :error?<div className="boards-empty" role="alert"><strong>Не удалось загрузить список</strong><span>{error}</span><button type="button" className="boards-secondary" onClick={()=>setAttempt(n=>n+1)}>Повторить</button></div>
        :teachers.length===0?<div className="boards-empty"><strong>Преподавателей пока нет</strong><span>Они появятся здесь, когда вы присоединитесь к учебной доске по приглашению преподавателя.</span></div>
        :<div className="lektrus-teacher-list">{teachers.map(teacher=><article key={teacher.user_id} className="lektrus-teacher-card">
          <header><span className="student-avatar"><UserAvatar/></span><div><h2>{teacher.name}</h2><small>Учебные доски: {teacher.boards.length}</small></div></header>
          <div>{teacher.boards.map(board=><button type="button" key={board.id} className="boards-secondary" onClick={()=>onOpenBoard(board.id)}>{board.title}<span aria-hidden="true">↗</span></button>)}</div>
        </article>)}</div>}
    </section>
  </main>;
}
