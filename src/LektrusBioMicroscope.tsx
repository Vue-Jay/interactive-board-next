import {useEffect,useMemo,useState} from "react";
import type {BioMicroscopeDiagram,BioNode} from "./lektrusBioMicroscopeModel";
import {BIO_LEVELS,BIO_LEVEL_LABELS,BIO_ORGANISMS,bioAncestors,bioChildren,bioNodes,bioLevelName,bioTaskChoices,bioCellFeatures,withBioOrganism,type BioOrganism} from "./lektrusBioMicroscopeModel";
import LektrusBioTaxonomyBrowser from "./LektrusBioTaxonomyBrowser";
import LektrusBioAlternativeView from "./LektrusBioAlternativeView";
import type {BioAlternativeOrganism} from "./lektrusBioAlternativeAtlas";
import LektrusBioAnatomyScene from "./LektrusBioAnatomyScene";
import {bioSpecimenPlateFor} from "./lektrusBioSpecimenPlates";
import {bioCellPlateFor} from "./lektrusBioCellPlates";
import {isBioNewOrganism} from "./lektrusBioNewLineages";
import {isBioFurtherOrganism} from "./lektrusBioMicroscopeModel";
import LektrusBioAssemblyBoard from "./LektrusBioAssemblyBoard";
import "./lektrusBioMicroscope.css";

const clamp=(n:number)=>Math.max(0,Math.min(4,n));
export default function LektrusBioMicroscope({diagram}: {diagram:BioMicroscopeDiagram}){
 const [activeOrganism,setActiveOrganism]=useState<BioOrganism>(diagram.organism);
 const [atlasOpen,setAtlasOpen]=useState(false);
 const [alternativeId,setAlternativeId]=useState<BioAlternativeOrganism|null>(null);
 const nodes=useMemo(()=>bioNodes(activeOrganism),[activeOrganism]);
 const meta=BIO_ORGANISMS[activeOrganism];
 const [zoom,setZoom]=useState(0);
 const [path,setPath]=useState<string[]>(diagram.assignmentPath);
 const [progress,setProgress]=useState(1);
 const [feedback,setFeedback]=useState("");
 const [activeFeatureName,setActiveFeatureName]=useState<string|null>(null);
 useEffect(()=>{setActiveOrganism(diagram.organism);setAtlasOpen(false);setAlternativeId(null);setZoom(0);setPath(diagram.assignmentPath);setProgress(1);setFeedback("");},[diagram.organism,diagram.activity,diagram.assignmentPath.join("|")]);
 const exploreCatalogOrganism=(organism:BioOrganism)=>{
  const next=withBioOrganism(diagram,organism);
  setActiveOrganism(organism);setPath(next.assignmentPath);setZoom(0);setProgress(1);setFeedback("");setAtlasOpen(false);
 };
 const exploreAlternative=(organism:BioAlternativeOrganism)=>{
  setAlternativeId(organism);setAtlasOpen(false);setFeedback("");
 };
 const step=Math.round(zoom);
 const lower=Math.floor(zoom),upper=Math.min(4,lower+1),blend=zoom-lower;
 const base=nodes.find(n=>n.id===path[lower])??nodes[0];
 const ahead=nodes.find(n=>n.id===path[upper])??base;
 const currentId=path[Math.min(step,path.length-1)]??diagram.organism;
 const selected=nodes.find(n=>n.id===currentId)??nodes[0];
 const specimenPlate=bioSpecimenPlateFor(activeOrganism,selected);
 const cellPlate=bioCellPlateFor(activeOrganism,selected);
 useEffect(()=>setActiveFeatureName(null),[activeOrganism,selected.id]);
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
 const hotspotQuestion=diagram.activity==="label"&&!!target&&
  selected.id===target.parentId&&children.length>1;
 const options=target?bioTaskChoices(nodes,target):[];
 const cellFeatures=bioCellFeatures(selected);
 const chosenFeature=cellFeatures.find(f=>f.name===activeFeatureName)??null;
 if(diagram.activity==="explore"&&alternativeId)return <section className="lektrus-bio-microscope" onPointerDown={e=>e.stopPropagation()}>
  <LektrusBioAlternativeView speciesId={alternativeId} onBack={()=>{setAlternativeId(null);setAtlasOpen(true);}}/>
 </section>;
 if(diagram.activity==="explore"&&atlasOpen)return <section className="lektrus-bio-microscope" onPointerDown={e=>e.stopPropagation()}>
  <LektrusBioTaxonomyBrowser onExplore={exploreCatalogOrganism} onExploreAlternative={exploreAlternative} onBack={()=>setAtlasOpen(false)}/>
 </section>;
 return <section className="lektrus-bio-microscope" aria-label="Биологический микроскоп" onPointerDown={e=>e.stopPropagation()}>
  <header className="lektrus-bio-head">
   <span className="lektrus-bio-eyepiece">◉</span>
   <div><strong>{diagram.title}</strong><small>{meta.name} · {meta.scientific}</small></div>
   <span className="lektrus-bio-kind">{meta.group==="animal"?"Животное":"Растение"}</span>
   {diagram.activity==="explore"&&<button type="button" className="lektrus-bio-open-atlas" onClick={()=>setAtlasOpen(true)}>☷ Классы и виды</button>}
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
  {diagram.activity!=="assemble"&&<div className="lektrus-bio-stage">
   <div className="lektrus-bio-specimen" aria-label={"Изучение структуры: "+selected.name}>
    <div className="lektrus-bio-scene-layer"
     style={{opacity:1-blend,transform:"scale("+(1+blend*.24)+")",
      pointerEvents:step===lower?"auto":"none"}}>
     <LektrusBioAnatomyScene organism={activeOrganism} node={base}
      children={bioChildren(nodes,base.id)}
      interactive={step===lower&&(diagram.activity==="explore"||hotspotQuestion)}
      onSelect={diagram.activity==="label"?check:next}
      activeFeatureName={activeFeatureName}
      onFeatureSelect={diagram.activity==="explore"&&step===lower?setActiveFeatureName:undefined}/>
    </div>
    {upper!==lower&&blend>0.001&&<div className="lektrus-bio-scene-layer"
     style={{opacity:blend,transform:"scale("+(.78+blend*.22)+")",
      pointerEvents:step===upper?"auto":"none"}}>
     <LektrusBioAnatomyScene organism={activeOrganism} node={ahead}
      children={bioChildren(nodes,ahead.id)}
      interactive={step===upper&&(diagram.activity==="explore"||hotspotQuestion)}
      onSelect={diagram.activity==="label"?check:next}
      activeFeatureName={activeFeatureName}
      onFeatureSelect={diagram.activity==="explore"&&step===upper?setActiveFeatureName:undefined}/>
    </div>}
   </div>
   <div className="lektrus-bio-info">
    <span className="lektrus-bio-overline">{bioLevelName(selected)}</span>
    <strong>{selected.name}</strong>
    {diagram.showDescriptions&&<p>{selected.description}</p>}
    {cellPlate&&diagram.activity==="explore"&&<div className="lektrus-bio-cell-inspector">
     <strong>{cellPlate.title}</strong>
     <p>{cellPlate.description}</p>
     <span className="lektrus-bio-cell-hint">Нажмите на номер у клеточной структуры, чтобы узнать её назначение.</span>
     {chosenFeature&&<div className="lektrus-bio-cell-selection" role="status" aria-live="polite">
      <b>{chosenFeature.name}</b>
      <p>{chosenFeature.description}</p>
     </div>}
     <small>{cellPlate.caveat}</small>
     <a href={cellPlate.source.url} target="_blank" rel="noopener noreferrer">Научный источник: {cellPlate.source.title}</a>
    </div>}
    {isBioNewOrganism(activeOrganism)&&selected.level==="cell"&&diagram.activity==="explore"&&<div className="lektrus-bio-cell-inspector">
     <strong>{selected.name} · видовые микроструктуры</strong>
     <p>Выберите одну из трёх отмеченных структур на рисунке. Форма и пропорции клеток показаны схематично, без реального микроскопического масштаба.</p>
     {chosenFeature&&<div className="lektrus-bio-cell-selection" role="status" aria-live="polite">
      <b>{chosenFeature.name}</b>
      <p>{chosenFeature.description}</p>
     </div>}
     <small>Анатомическое описание привязано к выбранному организму и его настоящей клетке.</small>
    </div>}
    {isBioFurtherOrganism(activeOrganism)&&selected.level==="cell"&&diagram.activity==="explore"&&<div className="lektrus-bio-cell-inspector">
     <strong>{selected.name} · микроструктуры</strong>
     <p>Нажмите на одну из трёх структур на рисунке, чтобы посмотреть её функцию. Рисунок является учебной схемой без измеренного оптического масштаба.</p>
     {chosenFeature&&<div className="lektrus-bio-cell-selection" role="status" aria-live="polite">
      <b>{chosenFeature.name}</b>
      <p>{chosenFeature.description}</p>
     </div>}
     {selected.source&&<a href={selected.source.url} target="_blank" rel="noopener noreferrer">
      Научный источник: {selected.source.title}
     </a>}
    </div>}
    {cellFeatures.length>0&&<div className="lektrus-bio-cell-features" aria-label="Микроструктуры клетки">
     <strong>Строение клетки крупнее</strong>
     <div>{cellFeatures.map(f=><details key={f.name}><summary>{f.name}</summary><p>{f.description}</p></details>)}</div>
    </div>}
    {specimenPlate&&<div className="lektrus-bio-specimen-explainer">
     <strong>{specimenPlate.title}</strong>
     <p>{specimenPlate.caption}</p>
     <a href={specimenPlate.source} target="_blank" rel="noopener noreferrer">Проверить строение по научному источнику ↗</a>
     <small>Авторская схема, без реального оптического масштаба</small>
    </div>}
    {selected.source&&<a className="lektrus-bio-reference" href={selected.source.url}
     target="_blank" rel="noopener noreferrer">Источник: {selected.source.title}</a>}
    {children.length>0&&diagram.activity==="explore"&&<span className="lektrus-bio-detail-hint">Выберите часть, чтобы приблизить её</span>}
   </div>
  </div>}
  {diagram.activity==="explore"?<div className="lektrus-bio-items" aria-label="Интерактивные части организма">
   {children.map(node=><button type="button" key={node.id} onClick={()=>next(node)}>
    <span className="lektrus-bio-dot" aria-hidden="true"/>
    <strong>{showLabels?node.name:"?"}</strong>
    {diagram.showDescriptions&&<small>{node.description}</small>}
    <span aria-hidden="true">＋</span>
   </button>)}
   {!children.length&&<p className="lektrus-bio-end">Клеточный уровень. Можно вернуться назад по шкале и исследовать другую ветвь организма.</p>}
  </div>:diagram.activity==="assemble"?
   <LektrusBioAssemblyBoard diagram={diagram} nodes={nodes}/>:
   <div className="lektrus-bio-task">
   <strong>Подпишите выбранную структуру · {Math.min(progress,4)}/4</strong>
   {target?<><p>Уровень «{bioLevelName(target)}». {hotspotQuestion?
    "Найдите на изображении: "+target.name+". Нажмите на соответствующую метку.":
    "На схеме показана одна структура этого уровня. Выберите её точное название среди вариантов."}</p>
    {!hotspotQuestion&&<div className="lektrus-bio-task-answers">
     {options.map(node=><button type="button" key={node.id} onClick={()=>check(node)}>{node.name}</button>)}
    </div>}
   </>:<p>Задание выполнено. Все уровни расположены правильно.</p>}
   {feedback&&<p className="lektrus-bio-feedback" role="status">{feedback}</p>}
   <button type="button" className="lektrus-bio-restart" onClick={()=>{setProgress(1);setPath(diagram.assignmentPath);setZoom(0);setFeedback("");}}>Начать заново</button>
  </div>}
  <footer>LEKTRUS · БИОЛОГИЯ · Схематический переход без реального оптического масштаба · Пример вида не заменяет строение всего класса</footer>
 </section>;
}
