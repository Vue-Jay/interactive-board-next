import {useEffect,useRef,useState} from "react";
type Props={value:string;options:string[];disabled?:boolean;onChange:(value:string)=>void};
export default function LektrusSubjectPicker({value,options,disabled,onChange}:Props){
 const [draft,setDraft]=useState(value);
 const [open,setOpen]=useState(false);
 const [active,setActive]=useState(0);
 const root=useRef<HTMLDivElement>(null);
 const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(!open)setDraft(value)},[value,open]);
 useEffect(()=>{
   if(!open)return;
   const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node)){setOpen(false);setDraft(value)}};
   document.addEventListener("pointerdown",close);
   return()=>document.removeEventListener("pointerdown",close);
 },[open,value]);
 const matched=options.filter(s=>s.toLocaleLowerCase("ru").startsWith(draft.trim().toLocaleLowerCase("ru")));
 const results=draft.trim()?matched:options;
 const choose=(subject:string)=>{onChange(subject);setDraft(subject);setOpen(false);input.current?.blur()};
 return <div className="lektrus-subject-combobox" ref={root}>
  <span className="lektrus-subject-label">Предмет</span>
  <div className="lektrus-subject-field">
   <input ref={input} type="text" role="combobox" aria-label="Выбрать предмет доски" aria-autocomplete="list" aria-expanded={open} aria-controls="lektrus-subject-options" autoComplete="off" placeholder="Выбрать предмет" value={draft} disabled={disabled} onFocus={()=>{setOpen(true);setActive(0)}} onChange={e=>{setDraft(e.target.value);setActive(0);setOpen(true)}} onKeyDown={e=>{e.stopPropagation();if(e.key==="Escape"){setOpen(false);setDraft(value);input.current?.blur()}else if(e.key==="ArrowDown"){e.preventDefault();setOpen(true);setActive(i=>Math.min(i+1,results.length-1))}else if(e.key==="ArrowUp"){e.preventDefault();setActive(i=>Math.max(0,i-1))}else if(e.key==="Enter"){e.preventDefault();if(results.length)choose(results[Math.min(active,results.length-1)]);else if(draft.trim())choose(draft.trim())}}}/>
   <button type="button" aria-label="Показать список предметов" disabled={disabled} onClick={()=>{setOpen(v=>!v);input.current?.focus()}}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
  </div>
  {open&&!disabled&&<div id="lektrus-subject-options" role="listbox" className="lektrus-subject-options">
   <button role="option" aria-selected={!value} className={!value?"selected":""} type="button" onPointerDown={e=>e.preventDefault()} onClick={()=>choose("")}>Без предмета</button>
   {results.map((subject,i)=><button role="option" aria-selected={value===subject} className={i===active?"focused":value===subject?"selected":""} type="button" key={subject} onPointerDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(i)} onClick={()=>choose(subject)}>{subject}</button>)}
   {results.length===0&&<button type="button" role="option" aria-selected={false} onPointerDown={e=>e.preventDefault()} onClick={()=>choose(draft.trim())}>Использовать «{draft.trim()}»</button>}
  </div>}
 </div>;
}
