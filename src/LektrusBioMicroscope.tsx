import {useEffect,useMemo,useState} from "react";
import type {BioMicroscopeDiagram,BioNode,BioLevel} from "./lektrusBioMicroscopeModel";
import {BIO_LEVELS,BIO_LEVEL_LABELS,BIO_ORGANISMS,bioAncestors,bioChildren,bioNodes} from "./lektrusBioMicroscopeModel";
import "./lektrusBioMicroscope.css";

const clamp=(n:number)=>Math.max(0,Math.min(4,n));
function Specimen({species,level}:{species:BioMicroscopeDiagram["organism"];level:BioLevel}){
 const plant=BIO_ORGANISMS[species].group==="plant";
 if(level==="cell")return <svg viewBox="0 0 280 215" role="img" aria-label={plant?"Схема растительной клетки":"Схема животной клетки"}>
  {plant?<><rect x="18" y="18" width="242" height="177" rx="27" fill="#dceac6" stroke="#679748" strokeWidth="12"/>
   <rect x="30" y="30" width="218" height="153" rx="23" fill="#eef7d9" stroke="#91b676" strokeWidth="3"/>
   <ellipse cx="157" cy="106" rx="70" ry="49" fill="#c9def0" stroke="#86b1c7" strokeWidth="2"/>
   {[0,1,2,3,4,5,6].map((n)=><ellipse key={n} cx={47+n*30} cy={n%2?50:168}
    rx="12" ry="6" fill="#5fa756" stroke="#347641" strokeWidth="2" transform={`rotate(${n*13} ${47+n*30} ${n%2?50:168})`}/>)}
   <circle cx="67" cy="106" r="25" fill="#c7b5db" stroke="#8369a4" strokeWidth="3"/>
   <circle cx="67" cy="106" r="7" fill="#7f639e"/></>:
   <><path d="M34 107C15 29 93 13 146 32C217 8 275 55 250 131C245 195 175 211 124 187C63 201 23 171 34 107Z" fill="#f8e2c9" stroke="#ba997a" strokeWidth="5"/>
   <ellipse cx="146" cy="111" rx="53" ry="45" fill="#d2bbeb" stroke="#9575bd" strokeWidth="4"/>
   <circle cx="147" cy="112" r="18" fill="#9870bb"/>
   {[0,1,2].map(n=><ellipse key={n} cx={52+n*73} cy={n%2?165:63} rx="16" ry="8" fill="#e4b18f" stroke="#b77e67" strokeWidth="2" transform={`rotate(${n*23} ${52+n*73} ${n%2?165:63})`}/>)}</>}
  <text x="140" y="210" textAnchor="middle" fontSize="9" fill="#62786d">Учебная схема, не в масштабе</text>
 </svg>;
 if(plant)return <svg viewBox="0 0 280 215" role="img" aria-label={species==="sunflower"?"Схема подсолнечника":"Схема дуба"}>
  {species==="sunflower"?<>
   <path d="M137 197V66" stroke="#397d4b" strokeWidth="9" strokeLinecap="round"/>
   <path d="M137 137Q94 95 66 121Q92 155 137 137M141 111Q182 77 209 108Q183 137 141 111" fill="#65a96d" stroke="#387b49" strokeWidth="3"/>
   {Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return <ellipse key={i} cx={138+57*Math.cos(a)} cy={63+57*Math.sin(a)} rx="17" ry="31" transform={`rotate(${i*30+90} ${138+57*Math.cos(a)} ${63+57*Math.sin(a)})`} fill="#e9b847" stroke="#c58a2a" strokeWidth="2"/>;})}
   <circle cx="138" cy="63" r="29" fill="#745838" stroke="#4f4028" strokeWidth="3"/>
  </>:<>
   <path d="M115 197Q137 150 124 107L156 107Q145 156 165 197Z" fill="#936d4d" stroke="#795238" strokeWidth="4"/>
   <path d="M136 130Q78 131 68 94Q33 97 35 57Q29 20 77 22Q97-4 141 15Q190-4 208 31Q254 30 254 76Q262 108 208 113Q177 146 136 130Z" fill="#659959" stroke="#3f7c4b" strokeWidth="4"/>
  </>}
  <path d="M15 198H265" stroke="#91ac83" strokeWidth="3"/>
 </svg>;
 return <svg viewBox="0 0 280 215" role="img" aria-label={species==="cat"?"Схема кошки":"Схема человека"}>
  {species==="cat"?<>
   <path d="M60 143Q34 125 46 100L57 60L79 80Q111 62 157 81L179 59L192 106Q207 128 191 154L183 188H88L84 161Z" fill="#dfba92" stroke="#a47955" strokeWidth="4"/>
   <path d="M184 153Q246 128 235 81" fill="none" stroke="#b38862" strokeWidth="15" strokeLinecap="round"/>
   <ellipse cx="112" cy="115" rx="13" ry="20" fill="#fff6df"/><ellipse cx="155" cy="115" rx="13" ry="20" fill="#fff6df"/>
   <ellipse cx="114" cy="117" rx="4" ry="12" fill="#567a53"/><ellipse cx="153" cy="117" rx="4" ry="12" fill="#567a53"/>
   <path d="M129 140L140 140L135 148Z" fill="#ab6a70"/>
   <path d="M123 151L134 158L148 151" fill="none" stroke="#865f4d" strokeWidth="3"/>
  </>:<>
   <circle cx="140" cy="32" r="22" fill="#dfb79c" stroke="#a8806e" strokeWidth="3"/>
   <path d="M101 66Q140 51 179 66L187 131L163 139L167 197H147L140 140L132 197H113L116 137L93 131Z" fill="#b0cfbb" stroke="#66927c" strokeWidth="4"/>
   <path d="M104 78L75 145M174 78L203 145" stroke="#dfb79c" strokeWidth="17" strokeLinecap="round"/>
   <path d="M123 194L119 212M158 194L163 212" stroke="#699584" strokeWidth="14" strokeLinecap="round"/>
  </>}
 </svg>;
}
export default function LektrusBioMicroscope({diagram}: {diagram:BioMicroscopeDiagram}){
 const nodes=useMemo(()=>bioNodes(diagram.organism),[diagram.organism]);
 const meta=BIO_ORGANISMS[diagram.organism];
 const [zoom,setZoom]=useState(0);
 const [path,setPath]=useState<string[]>([diagram.organism]);
 const [progress,setProgress]=useState(1);
 const [feedback,setFeedback]=useState("");
 useEffect(()=>{setZoom(0);setPath([diagram.organism]);setProgress(1);setFeedback("");},[diagram.organism,diagram.activity,diagram.assignmentPath.join("|")]);
 const step=Math.round(zoom);
 const currentId=path[Math.min(step,path.length-1)]??diagram.organism;
 const selected=nodes.find(n=>n.id===currentId)??nodes[0];
 const children=bioChildren(nodes,selected.id);
 const picked=path.slice(0,step+1).map(id=>nodes.find(n=>n.id===id)).filter(Boolean) as BioNode[];
 const tutorial=diagram.assignmentPath.map(id=>nodes.find(n=>n.id===id)).filter(Boolean) as BioNode[];
 const target=tutorial[progress];
 const next=(node:BioNode)=>{
  const ancestor=bioAncestors(nodes,node.id);
  setPath(ancestor.map(n=>n.id));setZoom(clamp(ancestor.length-1));setFeedback("");
 };
 const check=(node:BioNode)=>{
  if(!target)return;
  const correct=node.id===target.id;
  setFeedback(correct?"Верно! "+node.name:"Попробуйте ещё. Обратите внимание на связи уровней.");
  if(correct){setProgress(p=>Math.min(5,p+1));setPath(bioAncestors(nodes,node.id).map(n=>n.id));
   setZoom(clamp(BIO_LEVELS.indexOf(node.level)));}
 };
 const showLabels=diagram.activity==="explore";
 const isTask=diagram.activity!=="explore";
 const taskOptions=isTask&&target?nodes.filter(node=>node.level===target.level&&node.parentId===target.parentId):[];
 const options=taskOptions.length>=2?taskOptions:
  nodes.filter(node=>node.level===target?.level).slice(0,6);
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
   <input aria-label="Плавное увеличение от организма до клетки" type="range" min={0} max={4}
    step={0.05} value={zoom} onChange={e=>setZoom(Number(e.target.value))}/>
   <button type="button" aria-label="Увеличить" onClick={()=>setZoom(v=>clamp(Math.round(v)+1))}>+</button>
  </div>
  <div className="lektrus-bio-path" aria-label="Путь изучения">
   {picked.map((n,i)=><button type="button" key={n.id} onClick={()=>setZoom(i)}>{n.name}{i<picked.length-1?" ›":""}</button>)}
  </div>
  <div className="lektrus-bio-stage">
   <div className="lektrus-bio-specimen" style={{transform:`scale(${1+((zoom-Math.floor(zoom))*.2)})`}}>
    <Specimen species={diagram.organism} level={selected.level}/>
   </div>
   <div className="lektrus-bio-info">
    <span className="lektrus-bio-overline">{BIO_LEVEL_LABELS[selected.level]}</span>
    <strong>{selected.name}</strong>
    {diagram.showDescriptions&&<p>{selected.description}</p>}
    {children.length>0&&<span className="lektrus-bio-detail-hint">Выберите часть, чтобы приблизить её</span>}
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
   {target?<><p>Уровень «{BIO_LEVEL_LABELS[target.level]}». {diagram.activity==="assemble"?"Какое звено продолжит правильную цепочку?":"Выберите название следующей структуры."}</p>
    <div className="lektrus-bio-task-answers">
     {options.map(node=><button type="button" key={node.id} onClick={()=>check(node)}>{node.name}</button>)}
    </div>
   </>:<p>Задание выполнено. Все уровни расположены правильно.</p>}
   {feedback&&<p className="lektrus-bio-feedback" role="status">{feedback}</p>}
   <button type="button" className="lektrus-bio-restart" onClick={()=>{setProgress(1);setPath([diagram.organism]);setZoom(0);setFeedback("");}}>Начать заново</button>
  </div>}
  <footer>LEKTRUS · БИОЛОГИЯ · Учебные схемы, не в масштабе</footer>
 </section>;
}
