import {useEffect,useState} from "react";
import {LEKTRUS_SCHOOL_SUBJECTS,normalizeLektrusSubject} from "./lektrusSchoolSubjects";
import type {AuthUser} from "./authStore";
import {getStudentsForTeacher,type StudentRecord} from "./studentsStore";
import {listTemplates,type BoardTemplate} from "./templatesStore";
import {starterTemplates,starterDocument} from "./TemplatesScreen";
import type {DocumentData} from "./boardModel";
export type NewBoardOptions={title:string;subject:string;group:string;studentEmail:string;template:{id:string;document:DocumentData}|null};
export const SUBJECTS=[...LEKTRUS_SCHOOL_SUBJECTS];
export default function LektrusCreateBoardDialog({user,initial,onClose,onCreate,busy}:{user:AuthUser;initial?:{subject?:string;group?:string};onClose:()=>void;onCreate:(options:NewBoardOptions)=>void;busy:boolean}){
 const [title,setTitle]=useState("");
 const [subject,setSubject]=useState(normalizeLektrusSubject(initial?.subject||""));
 const [group,setGroup]=useState(initial?.group||"");
 const [studentEmail,setStudentEmail]=useState("");
 const [templateId,setTemplateId]=useState("");
 const [students,setStudents]=useState<StudentRecord[]>([]);
 const [templates,setTemplates]=useState<BoardTemplate[]>([]);
 useEffect(()=>{let active=true;void getStudentsForTeacher(user).then(x=>{if(active)setStudents(x)}).catch(()=>{});void listTemplates(user.id).then(x=>{if(active)setTemplates(x)}).catch(()=>{});return()=>{active=false}},[user.id]);
 return <div className="lektrus-create-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}>
  <form className="lektrus-create-dialog" role="dialog" aria-modal="true" aria-label="Создание доски" onSubmit={e=>{e.preventDefault();onCreate({title:title.trim()||"Новая доска",subject:normalizeLektrusSubject(subject),group,studentEmail,template:templateId.startsWith("builtin:")?(()=>{const t=starterTemplates.find(x=>x.id===templateId.slice(8));return t?{id:templateId,document:starterDocument(t)}:null})():templates.find(t=>t.id===templateId)||null})}}>
   <header><div><small>НОВАЯ РАБОЧАЯ ДОСКА</small><h2>Создать доску</h2><p>Настройте пространство для занятия. Всё можно будет изменить позже.</p></div><button type="button" aria-label="Закрыть" disabled={busy} onClick={onClose}>×</button></header>
   <div className="lektrus-create-fields">
    <label className="wide"><span>Название доски</span><input autoFocus maxLength={120} placeholder="Например, Химия · 9 класс" value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label><span>Предмет</span><input list="lektrus-create-subjects" placeholder="Выберите или напишите" value={subject} onChange={e=>setSubject(e.target.value)} maxLength={80}/><datalist id="lektrus-create-subjects">{SUBJECTS.map(s=><option value={s} key={s}/>)}</datalist></label>
    <label><span>Группа или класс <small>необязательно</small></span><input value={group} onChange={e=>setGroup(e.target.value)} placeholder="Например, 9А" maxLength={80}/></label>
    <label><span>Ученик <small>необязательно</small></span><input list="lektrus-create-students" type="email" placeholder="Email ученика" value={studentEmail} onChange={e=>setStudentEmail(e.target.value)}/><datalist id="lektrus-create-students">{students.filter(x=>x.email).map(s=><option value={s.email} key={s.userId}>{s.name}</option>)}</datalist></label>
    <label><span>Шаблон <small>необязательно</small></span><select value={templateId} onChange={e=>setTemplateId(e.target.value)}><option value="">Пустая доска</option>{starterTemplates.map(t=><option value={"builtin:"+t.id} key={t.id}>{t.title} · базовый</option>)}{templates.map(t=><option value={t.id} key={t.id}>{t.title}</option>)}</select></label>
   </div>
   <footer><button type="button" disabled={busy} onClick={onClose}>Отмена</button><button type="submit" disabled={busy}>{busy?"Создание…":"Создать и открыть →"}</button></footer>
  </form>
 </div>
}