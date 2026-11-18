import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {LEKTRUS_SCHOOL_SUBJECTS,normalizeLektrusSubject} from "./lektrusSchoolSubjects";
import type {AuthUser} from "./authStore";
import {getStudentsForTeacher,type StudentRecord} from "./studentsStore";
import {listTemplates,type BoardTemplate} from "./templatesStore";
export type NewBoardOptions={title:string;subject:string;group:string;studentEmail:string;template:BoardTemplate|null};
export const SUBJECTS=[...LEKTRUS_SCHOOL_SUBJECTS];
export default function LektrusCreateBoardDialog({user,initial,onClose,onCreate,busy}:{user:AuthUser;initial?:{subject?:string;group?:string};onClose:()=>void;onCreate:(options:NewBoardOptions)=>void;busy:boolean}){
 const [title,setTitle]=useState("");
 const [subject,setSubject]=useState(normalizeLektrusSubject(initial?.subject||""));
 const [group,setGroup]=useState(initial?.group||"");
 const [studentEmail,setStudentEmail]=useState("");
 const [templateId,setTemplateId]=useState("");
 const [students,setStudents]=useState<StudentRecord[]>([]);
 const [templates,setTemplates]=useState<BoardTemplate[]>([]);
 const backdrop=useRef<HTMLDivElement>(null);
 const submitting=useRef(false);
 const submitTouch=useRef<{id:number;x:number;y:number}|null>(null);
 useEffect(()=>{if(!busy)submitting.current=false},[busy]);
 // iOS Safari/WKWebView often leaves the layout viewport unchanged when
 // the keyboard opens. Size the dialog to the visible viewport instead.
 useLayoutEffect(()=>{
  const element=backdrop.current;
  if(!element)return;
  const viewport=window.visualViewport;
  const update=()=>{
   element.style.setProperty("--lektrus-dialog-visible-top",`${viewport?.offsetTop??0}px`);
   element.style.setProperty("--lektrus-dialog-visible-left",`${viewport?.offsetLeft??0}px`);
   element.style.setProperty("--lektrus-dialog-visible-width",`${viewport?.width??window.innerWidth}px`);
   element.style.setProperty("--lektrus-dialog-visible-height",`${viewport?.height??window.innerHeight}px`);
  };
  update();
  viewport?.addEventListener("resize",update);
  viewport?.addEventListener("scroll",update);
  window.addEventListener("resize",update);
  return()=>{viewport?.removeEventListener("resize",update);viewport?.removeEventListener("scroll",update);window.removeEventListener("resize",update)};
 },[]);
 useEffect(()=>{let active=true;void getStudentsForTeacher(user).then(x=>{if(active)setStudents(x)}).catch(()=>{});void listTemplates(user.id).then(x=>{if(active)setTemplates(x)}).catch(()=>{});return()=>{active=false}},[user.id]);
 return <div ref={backdrop} className="lektrus-create-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}>
  <form className="lektrus-create-dialog" role="dialog" aria-modal="true" aria-label="Создание доски" onSubmit={e=>{e.preventDefault();if(busy||submitting.current)return;submitting.current=true;onCreate({title:title.trim()||"Новая доска",subject:normalizeLektrusSubject(subject),group,studentEmail,template:templates.find(t=>t.id===templateId)||null})}}>
   <header><div><small>НОВАЯ РАБОЧАЯ ДОСКА</small><h2>Создать доску</h2><p>Настройте пространство для занятия. Всё можно будет изменить позже.</p></div><button type="button" aria-label="Закрыть" disabled={busy} onClick={onClose}>×</button></header>
   <div className="lektrus-create-fields">
    <label className="wide"><span>Название доски</span><input autoFocus maxLength={120} placeholder="Например, Химия · 9 класс" value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label><span>Предмет</span><input list="lektrus-create-subjects" placeholder="Выберите или напишите" value={subject} onChange={e=>setSubject(e.target.value)} maxLength={80}/><datalist id="lektrus-create-subjects">{SUBJECTS.map(s=><option value={s} key={s}/>)}</datalist></label>
    <label><span>Группа или класс <small>необязательно</small></span><input value={group} onChange={e=>setGroup(e.target.value)} placeholder="Например, 9А" maxLength={80}/></label>
    <label><span>Ученик <small>необязательно</small></span><input list="lektrus-create-students" type="email" placeholder="Email ученика" value={studentEmail} onChange={e=>setStudentEmail(e.target.value)}/><datalist id="lektrus-create-students">{students.filter(x=>x.email).map(s=><option value={s.email} key={s.userId}>{s.name}</option>)}</datalist></label>
    <label><span>Мой шаблон <small>необязательно</small></span><select value={templateId} onChange={e=>setTemplateId(e.target.value)}><option value="">Пустая доска</option>{templates.map(t=><option value={t.id} key={t.id}>{t.title}</option>)}</select></label>
   </div>
   <footer><button type="button" disabled={busy} onClick={onClose}>Отмена</button><button type="submit" disabled={busy}
    onPointerDown={e=>{
     // WKWebView may blur the field and move the dialog underneath the
     // finger before its synthetic click. Finish a genuine touch tap while
     // the visible button is still anchored above the keyboard.
     if(e.pointerType!=="touch"||!e.isPrimary||!document.activeElement?.matches("input,textarea,[contenteditable=true]"))return;
     e.preventDefault();submitTouch.current={id:e.pointerId,x:e.clientX,y:e.clientY};
    }}
    onPointerCancel={()=>{submitTouch.current=null}}
    onPointerUp={e=>{
     const touch=submitTouch.current;submitTouch.current=null;
     if(!touch||touch.id!==e.pointerId||Math.hypot(e.clientX-touch.x,e.clientY-touch.y)>10||!e.currentTarget.contains(document.elementFromPoint(e.clientX,e.clientY)))return;
     e.preventDefault();const form=e.currentTarget.form;
     if(form&&typeof form.requestSubmit==="function")form.requestSubmit(e.currentTarget);
     else e.currentTarget.click();
    }}>{busy?"Создание…":"Создать и открыть →"}</button></footer>
  </form>
 </div>
}
