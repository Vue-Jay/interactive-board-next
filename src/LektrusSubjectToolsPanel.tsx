import {useLayoutEffect,useRef,useState,type CSSProperties,type ReactNode} from "react";
import {createPortal} from "react-dom";

export type SubjectToolOption={id:string;label:string;description?:string;group?:string;icon:ReactNode};
type Props={
  anchor:HTMLElement|null;
  subject:string;
  canChangeSubject:boolean;
  subjects:string[];
  tools:SubjectToolOption[];
  onSubjectChange:(subject:string)=>void;
  onChoose:(id:string)=>void;
  onClose:()=>void;
};
export default function LektrusSubjectToolsPanel({anchor,subject,canChangeSubject,subjects,tools,onSubjectChange,onChoose,onClose}:Props){
  const panelRef=useRef<HTMLElement>(null);
  const [position,setPosition]=useState<CSSProperties>({left:70,top:86});
  useLayoutEffect(()=>{
    if(!anchor)return;
    let frame=0;
    const update=()=>{
      const rect=anchor.getBoundingClientRect();
      const width=Math.min(340,window.innerWidth-20);
      const mobilePortrait=window.innerWidth<=700&&window.innerHeight>window.innerWidth;
      if(mobilePortrait){
        const height=Math.min(440,window.innerHeight-142);
        setPosition({left:Math.max(10,(window.innerWidth-width)/2),top:Math.max(52,rect.top-height-12),width});
      }else{
        const left=rect.right+width+12<=window.innerWidth?rect.right+10:Math.max(10,rect.left-width-10);
        const maxHeight=Math.min(540,window.innerHeight-88);
        const top=Math.max(54,Math.min(rect.top-14,window.innerHeight-maxHeight-12));
        setPosition({left,top,width});
      }
    };
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update)};
    update();
    const observer=typeof ResizeObserver==="undefined"?null:new ResizeObserver(schedule);
    observer?.observe(anchor);
    window.addEventListener("resize",schedule);
    window.addEventListener("scroll",schedule,true);
    window.visualViewport?.addEventListener("resize",schedule);
    return()=>{
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize",schedule);
      window.removeEventListener("scroll",schedule,true);
      window.visualViewport?.removeEventListener("resize",schedule);
    };
  },[anchor]);
  useLayoutEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.stopPropagation();onClose()}
    };
    const onOutside=(event:PointerEvent)=>{
      if(!(event.target instanceof Node))return;
      if(panelRef.current?.contains(event.target)||anchor?.contains(event.target))return;
      onClose();
    };
    document.addEventListener("keydown",onKey,true);
    document.addEventListener("pointerdown",onOutside,true);
    return()=>{
      document.removeEventListener("keydown",onKey,true);
      document.removeEventListener("pointerdown",onOutside,true);
    };
  },[anchor,onClose]);
  return createPortal(
    <section id="lektrus-subject-tools-panel" ref={panelRef} className="lektrus-subject-tools-panel" role="dialog"
      aria-modal="false" aria-label="Предметные инструменты"
      style={position} onPointerDown={e=>e.stopPropagation()} onContextMenu={e=>e.stopPropagation()}>
      <header className="lektrus-subject-tools-head">
        <div><strong>Предметные инструменты</strong><small>Инструменты выбранного предмета</small></div>
        <button type="button" aria-label="Закрыть предметные инструменты" onClick={onClose}>×</button>
      </header>
      <div className="lektrus-subject-tools-body">
        <label className="lektrus-subject-tools-category">
          <span>Предмет доски</span>
          <select aria-label="Предмет доски для набора инструментов" value={subject} disabled={!canChangeSubject} onChange={e=>onSubjectChange(e.target.value)}>
            <option value="">Выберите предмет</option>
            {subjects.filter(Boolean).map(name=><option key={name} value={name}>{name}</option>)}
            {subject&&!subjects.includes(subject)&&<option value={subject}>{subject}</option>}
          </select>
          {!canChangeSubject&&<small>Предмет закреплён создателем доски</small>}
        </label>
        {tools.length>0?
          <div className="lektrus-subject-tools-groups" role="group" aria-label={subject+" инструменты"}>
            {Array.from(new Set(tools.map(t=>t.group||"Инструменты"))).map(group=>
              <section className="lektrus-subject-tools-group" key={group}>
                <h3>{group}</h3>
                <div className="lektrus-subject-tools-list">
                  {tools.filter(t=>(t.group||"Инструменты")===group).map(t=>
                    <button type="button" key={t.id} onClick={()=>onChoose(t.id)}>
                      <span className="lektrus-subject-tools-icon">{t.icon}</span>
                      <span className="lektrus-subject-tools-name">{t.label}</span>
                      {t.description&&<small>{t.description}</small>}
                    </button>)}
                </div>
              </section>)}
          </div>:
          <div className="lektrus-subject-tools-empty">
            <strong>Выберите учебный предмет</strong>
            <p>Набор инструментов появится здесь. Универсальные инструменты остаются в основной панели.</p>
          </div>}
      </div>
    </section>,document.body
  );
}
