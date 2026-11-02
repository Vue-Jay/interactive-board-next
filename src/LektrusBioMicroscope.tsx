import {useEffect,useMemo,useState} from "react";
import type {BioMicroscopeDiagram,BioNode} from "./lektrusBioMicroscopeModel";
import {BIO_LEVELS,BIO_LEVEL_LABELS,BIO_ORGANISMS,bioAncestors,bioChildren,bioNodes,bioLevelName,bioTaskChoices} from "./lektrusBioMicroscopeModel";
import LektrusBioAnatomyScene from "./LektrusBioAnatomyScene";
import "./lektrusBioMicroscope.css";

const clamp=(n:number)=>Math.max(0,Math.min(4,n));
export default function LektrusBioMicroscope({diagram}: {diagram:BioMicroscopeDiagram}){
 const nodes=useMemo(()=>bioNodes(diagram.organism),[diagram.organism]);
 const meta=BIO_ORGANISMS[diagram.organism];
 const [zoom,setZoom]=useState(0);
 const [path,setPath]=useState<string[]>(diagram.assignmentPath);
 const [progress,setProgress]=useState(1);
 const [feedback,setFeedback]=useState("");
 useEffect(()=>{setZoom(0);setPath(diagram.assignmentPath);setProgress(1);setFeedback("");},[diagram.organism,diagram.activity,diagram.assignmentPath.join("|")]);
 const step=Math.round(zoom);
 const lower=Math.floor(zoom),upper=Math.min(4,lower+1),blend=zoom-lower;
 const base=nodes.find(n=>n.id===path[lower])??nodes[0];
 const ahead=nodes.find(n=>n.id===path[upper])??base;
 const currentId=path[Math.min(step,path.length-1)]??diagram.organism;
 const selected=nodes.find(n=>n.id===currentId)??nodes[0];
 const children=bioChildren(nodes,selected.id);
 const picked=path.slice(0,step+1).map(id=>nodes.find(n=>n.id===id)).filter(Boolean) as BioNode[];
 const tutorial=diagram.assignmentPath.map(id=>nodes.find(n=>n.id===id)).filter(Boolean) as BioNode[];
 const target=tutorial[progress];
 const completeBranch=(node:BioNode):string[]=>{
  const ancestor=bioAncestors(nodes,node.id);
  // Follow the first available child on the selected branch so the slider
  // always has a genuine tissue and cell to magnify.
  const branch=[...ancestor];
  while(branch.length<5){const child=bioChildren(nodes,branch.at(-1)!.id)[0];if(!child)break;branch.push(child);}
  return branch.map(n=>n.id);
 };
 const next=(node:BioNode)=>{
  setPath(completeBranch(node));setZoom(clamp(BIO_LEVELS.indexOf(node.level)));setFeedback("");
 };
 const check=(node:BioNode)=>{
  if(!target)return;
  const correct=node.id===target.id;
  setFeedback(correct?"Верно! "+node.name:"Попробуйте ещё. Обратите внимание на связи уровней.");
  if(correct){setProgress(p=>Math.min(5,p+1));setPath(completeBranch(node));
   setZoom(clamp(BIO_LEVELS.indexOf(node.level)));}
 };
 const showLabels=diagram.activity==="explore";
 const isTask=diagram.activity!=="explore";
 const hotspotQuestion=diagram.activity==="label"&&!!target&&
  selected.id===target.parentId&&children.length>1;
 const options=target?bioTaskChoices(nodes,target):[];
 return <section className="lektrus-bio-microscope" aria-label="Биологический микроскоп" onPointerDown={e=>e.stopPropagation()}>
  <header className="lektrus-bio-head">
   <span className="lektrus-bio-eyepiece">◉</span>
   <div><strong>{diagram.title}</strong><small>{meta.name} · {meta.scientific}</small></div>
   <span className="lektrus-bio-kind">{meta.group==="animal"?"Животное":"Растение"}</span>
  </header>
  <div className="lektrus-bio-levels" role="group" aria-label="Уровни увеличения">
   {BIO_LEVELS.map((level,i)=><button type="button" key={level} className={Math.round(zoom)===i?"is-active":""}
    onClick={()=>{setZoom(i);setFeedback("");}}>{BIO_LEVEL_LABELS[level]}</button>)}
  </div>
  <div className="lektrus-bio-zoom">
   <button type="button" aria-label="Уменьшить" onClick={()=>setZoom(v=>clamp(Math.round(v)-1))}>−</button>
   <input aria-label="Плавный переход между схемами уровней строения" type="range" min={0} max={4}
    step={0.05} value={zoom} onChange={e=>setZoom(Number(e.target.value))}/>
   <button type="button" aria-label="Увеличить" onClick={()=>setZoom(v=>clamp(Math.round(v)+1))}>+</button>
  </div>
  <div className="lektrus-bio-path" aria-label="Путь изучения">
   {picked.map((n,i)=><button type="button" key={n.id} onClick={()=>setZoom(i)}>{n.name}{i<picked.length-1?" ›":""}</button>)}
  </div>
  <div className="lektrus-bio-stage">
   <div className="lektrus-bio-specimen" aria-label={"Изучение структуры: "+selected.name}>
    <div className="lektrus-bio-scene-layer"
     style={{opacity:1-blend,transform:"scale("+(1+blend*.24)+")",
      pointerEvents:step===lower?"auto":"none"}}>
     <LektrusBioAnatomyScene organism={diagram.organism} node={base}
      children={bioChildren(nodes,base.id)}
      interactive={step===lower&&(diagram.activity==="explore"||hotspotQuestion)}
      onSelect={diagram.activity==="label"?check:next}/>
    </div>
    {upper!==lower&&blend>0.001&&<div className="lektrus-bio-scene-layer"
     style={{opacity:blend,transform:"scale("+(.78+blend*.22)+")",
      pointerEvents:step===upper?"auto":"none"}}>
     <LektrusBioAnatomyScene organism={diagram.organism} node={ahead}
      children={bioChildren(nodes,ahead.id)}
      interactive={step===upper&&(diagram.activity==="explore"||hotspotQuestion)}
      onSelect={diagram.activity==="label"?check:next}/>
    </div>}
   </div>
   <div className="lektrus-bio-info">
    <span className="lektrus-bio-overline">{bioLevelName(selected)}</span>
    <strong>{selected.name}</strong>
    {diagram.showDescriptions&&<p>{selected.description}</p>}
    {selected.source&&<a className="lektrus-bio-reference" href={selected.source.url}
     target="_blank" rel="noopener noreferrer">Источник: {selected.source.title}</a>}
    {children.length>0&&diagram.activity==="explore"&&<span className="lektrus-bio-detail-hint">Выберите часть, чтобы приблизить её</span>}
   </div>
  </div>
  {diagram.activity==="explore"?<div className="lektrus-bio-items" aria-label="Интерактивные части организма">
   {children.map(node=><button type="button" key={node.id} onClick={()=>next(node)}>
    <span className="lektrus-bio-dot" aria-hidden="true"/>
    <strong>{showLabels?node.name:"?"}</strong>
    {diagram.showDescriptions&&<small>{node.description}</small>}
    <span aria-hidden="true">＋</span>
   </button>)}
   {!children.length&&<p className="lektrus-bio-end">Клеточный уровень. Можно вернуться назад по шкале и исследовать другую ветвь организма.</p>}
  </div>:<div className="lektrus-bio-task">
   <strong>{diagram.activity==="assemble"?"Соберите последовательность уровней":"Подпишите выбранную структуру"} · {Math.min(progress,4)}/4</strong>
   {target?<><p>Уровень «{bioLevelName(target)}». {diagram.activity==="assemble"?
    "Выберите правильное звено цепочки.":hotspotQuestion?
    "Найдите на изображении: "+target.name+". Нажмите на соответствующую метку.":
    "На схеме показана одна структура этого уровня. Выберите её точное название среди вариантов."}</p>
    {(diagram.activity==="assemble"||!hotspotQuestion)&&<div className="lektrus-bio-task-answers">
     {options.map(node=><button type="button" key={node.id} onClick={()=>check(node)}>{node.name}</button>)}
    </div>}
   </>:<p>Задание выполнено. Все уровни расположены правильно.</p>}
   {feedback&&<p className="lektrus-bio-feedback" role="status">{feedback}</p>}
   <button type="button" className="lektrus-bio-restart" onClick={()=>{setProgress(1);setPath(diagram.assignmentPath);setZoom(0);setFeedback("");}}>Начать заново</button>
  </div>}
  <footer>LEKTRUS · БИОЛОГИЯ · Уровни организации, схематический переход без реального оптического масштаба</footer>
 </section>;
}
