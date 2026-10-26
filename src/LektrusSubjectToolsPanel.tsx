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

/** Curated, compact subject-specific sections. Never add generic board tools here. */
const subjectToolSections:Record<string,{title:string;ids:string[]}[]>={
  "математика":[{title:"Формулы и вычисления",ids:["math-formula","math-fractions"]},
    {title:"Построения",ids:["math-geometry","math-coordinate"]}],
  "физика":[{title:"Механика и движение",ids:["physics-mechanics","physics-graphs"]},
    {title:"Свет и электричество",ids:["physics-optics","physics-circuits"]}],
  "химия":[{title:"Вещества и органика",ids:["chem-periodic-table","chem-organic"]},
    {title:"Реакции и опыты",ids:["chem-formulas","chem-experiments"]}],
  "биология":[{title:"Клетка и генетика",ids:["bio-cell","bio-division","bio-dna","bio-genetics"]},
    {title:"Организмы и экология",ids:["bio-taxonomy","bio-food-chain"]},
    {title:"Человек",ids:["bio-organ-systems"]}],
  "география":[{title:"Карты",ids:["maps-atlas","contour-atlas"]},
    {title:"Учебные задания",ids:["geo-matching","geo-question-cards"]}],
  "история":[{title:"Карты и хронология",ids:["history-atlas","history-timeline"]},
    {title:"Родословные",ids:["history-family-tree"]}],
  "информатика":[{title:"Информация",ids:["info-encoding","info-place-value"]},
    {title:"Программирование и алгоритмы",ids:["info-programming","info-flowchart"]},
    {title:"Логика",ids:["info-circuit","info-logic"]}],
  "русский язык":[{title:"Разбор",ids:["ru-syntax","ru-morphemes","ru-morphology","ru-phonetics"]},
    {title:"Практика",ids:["ru-orthography","ru-sentence-builder"]}],
  "иностранный язык":[{title:"Грамматика и лексика",ids:["language-sentence-builder","language-flashcards"]}],
  "литература":[{title:"Анализ",ids:["literature-analysis"]}],
  "обществознание":[{title:"Учебные схемы",ids:["civics-structure"]}]
};

function sectionsForSubject(subject:string,tools:SubjectToolOption[]){
  const scheme=subjectToolSections[subject.trim().toLocaleLowerCase("ru-RU")]??[];
  const byId=new Map(tools.map(tool=>[tool.id,tool]));
  const used=new Set<string>();
  const sections=scheme.map(({title,ids})=>{
    const items=ids.map(id=>byId.get(id)).filter((tool):tool is SubjectToolOption=>Boolean(tool));
    for(const item of items)used.add(item.id);
    return {title,items};
  }).filter(section=>section.items.length);
  const remaining=tools.filter(tool=>!used.has(tool.id));
  if(remaining.length)sections.push({title:scheme.length?"Другие инструменты":"Инструменты",items:remaining});
  return sections;
}

export default function LektrusSubjectToolsPanel({anchor,subject,canChangeSubject,subjects,tools,onSubjectChange,onChoose,onClose}:Props){
  const panelRef=useRef<HTMLElement>(null);
  const [position,setPosition]=useState<CSSProperties>({left:70,top:86});
  const sections=sectionsForSubject(subject,tools);
  useLayoutEffect(()=>{
    if(!anchor)return;
    let frame=0;
    const update=()=>{
      const rect=anchor.getBoundingClientRect();
      const width=Math.min(396,window.innerWidth-20);
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
        <div><strong>Предметные инструменты</strong><small>{subject?subject+" · "+tools.length:"Выберите предмет"}</small></div>
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
        {sections.length>0?
          <div className="lektrus-subject-tools-groups" role="group" aria-label={subject+" инструменты"}>
            {sections.map(section=>
              <section className="lektrus-subject-tools-group" key={section.title}>
                {sections.length>1&&<h3>{section.title}</h3>}
                <div className="lektrus-subject-tools-list">
                  {section.items.map(t=>
                    <button type="button" key={t.id} onClick={()=>onChoose(t.id)} title={t.description??t.label} aria-label={t.label}>
                      <span className="lektrus-subject-tools-icon">{t.icon}</span>
                      <span className="lektrus-subject-tools-name">{t.label}</span>
                    </button>)}
                </div>
              </section>)}
          </div>:
          <div className="lektrus-subject-tools-empty">
            <strong>{subject?"Нет предметных инструментов":"Выберите учебный предмет"}</strong>
            <p>Универсальные инструменты доступны в основной панели доски.</p>
          </div>}
      </div>
    </section>,document.body
  );
}
