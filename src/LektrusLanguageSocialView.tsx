import {useEffect,useMemo,useState,type SyntheticEvent} from "react";
import type {LanguageSocialDiagram,StateNode} from "./lektrusLanguageSocialModel";
import {initialScramble,sentencePatternById,stateEdgeNames} from "./lektrusLanguageSocialModel";

function SentenceBoard({d}:{d:Extract<LanguageSocialDiagram,{kind:"sentence-builder"}>}){
 const key=d.parts.map(p=>p.id+"="+p.text).join("|");
 const initial=useMemo(()=>initialScramble(d.parts),[key]);
 const [order,setOrder]=useState<string[]>(initial);
 const [chosen,setChosen]=useState<string|null>(null);
 const [checked,setChecked]=useState(false);
 useEffect(()=>{setOrder(initial);setChosen(null);setChecked(false)},[initial]);
 const dictionary=new Map(d.parts.map(p=>[p.id,p]));
 const correct=d.parts.every((p,i)=>order[i]===p.id);
 const swap=(id:string)=>{
  if(!chosen){setChosen(id);setChecked(false);return}
  if(chosen===id){setChosen(null);return}
  const next=[...order],first=next.indexOf(chosen),second=next.indexOf(id);
  if(first>=0&&second>=0){[next[first],next[second]]=[next[second],next[first]];setOrder(next)}
  setChosen(null);setChecked(false);
 };
 const reset=()=>{setOrder([...initial]);setChecked(false);setChosen(null)};
 const stop=(event:SyntheticEvent)=>event.stopPropagation();
 const pattern=sentencePatternById(d.patternId);
 return <div className="lektrus-sentence-on-board" role="group" aria-label={d.title}
  onPointerDown={stop} onPointerUp={stop} onClick={stop}>
  <strong>{d.title}</strong>
  <p className="lektrus-sentence-task">{d.instructions}</p>
  {d.showHint&&pattern&&<p className="lektrus-sentence-tip">{pattern.label}: {pattern.tip}</p>}
  <div className="lektrus-sentence-parts" aria-label="Соберите предложение, выбирая два элемента для перестановки">
   {order.map((id,i)=><button type="button" key={id} className={chosen===id?"selected":""}
    aria-pressed={chosen===id} title={"Позиция "+(i+1)+". Нажмите два элемента для обмена."}
    onClick={()=>swap(id)}>{dictionary.get(id)?.text??"?"}</button>)}
  </div>
  <div className="lektrus-sentence-status" role="status">
   {checked?(correct?"Правильно! Порядок совпадает с заданным преподавателем.":"Есть неточности. Попробуйте ещё раз."):"Нажмите два элемента, чтобы поменять их местами"}
  </div>
  <div className="lektrus-sentence-actions">
   <button type="button" onClick={reset}>Заново</button>
   <button type="button" onClick={()=>setChecked(true)}>Проверить</button>
  </div>
  {d.showKey&&<div className="lektrus-sentence-key">
   <small>Ответ преподавателя:</small> {d.parts.map(p=>p.text).join(" ")}
  </div>}
 </div>;
}
function CivicsView({d}:{d:Extract<LanguageSocialDiagram,{kind:"state-structure"}>}){
 const positions=new Map<string,{x:number;y:number}>();
 d.nodes.forEach(n=>positions.set(n.id,{x:135+n.column*210,y:108+n.row*75}));
 const label=(n:StateNode)=>{
  const max=22,words=n.text.split(/\s+/u),lines:string[]=[],pending={text:""};
  for(const word of words){
   if(pending.text&&pending.text.length+word.length+1>max){lines.push(pending.text);pending.text=word}
   else pending.text+=(pending.text?" ":"")+word;
  }
  if(pending.text)lines.push(pending.text);
  if(lines.length>3)return [lines[0],lines[1],lines[2].slice(0,18)+"…"];
  return lines;
 };
 return <svg viewBox="0 0 900 500" className="lektrus-school-svg" role="img" aria-label={d.title}>
  <defs><marker id="lektrus-civics-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"
   markerUnits="userSpaceOnUse"><path d="M0 0L7 3.5L0 7Z" fill="#5b7ea8"/></marker></defs>
  <rect width="900" height="500" rx="20" fill="#fcfdff"/>
  <text x="450" y="37" fontSize="23" fontWeight="750" textAnchor="middle" fill="#285078">{d.title}</text>
  <text x="450" y="58" fontSize="12" textAnchor="middle" fill="#8397ac">
   {d.subtitle.length>99?d.subtitle.slice(0,98)+"…":d.subtitle}
  </text>
  {d.edges.map(e=>{
   const a=positions.get(e.from),b=positions.get(e.to);
   if(!a||!b)return null;
   const vertical=Math.abs(b.y-a.y)>=Math.abs(b.x-a.x)*.35;
   const sx=a.x+(vertical?0:b.x>a.x?88:-88),sy=a.y+(vertical?b.y>a.y?29:-29:0);
   const ex=b.x+(vertical?0:b.x>a.x?-88:88),ey=b.y+(vertical?b.y>a.y?-29:29:0);
   const path=vertical?`M${sx} ${sy}V${(sy+ey)/2}H${ex}V${ey}`:
    `M${sx} ${sy}H${ex}`;
   const dashed=e.kind==="interacts"?"6 5":undefined;
   return <g key={e.id}>
    <path d={path} fill="none" stroke={e.kind==="subordinate"?"#aa7456":"#5b87b2"}
     strokeWidth={e.kind==="subordinate"?2.8:2.2} strokeDasharray={dashed}
     strokeLinejoin="round" markerEnd={e.kind==="subordinate"?"url(#lektrus-civics-arrow)":undefined}/>
    {d.showRelationships&&<g>
     <rect x={(sx+ex)/2-46} y={(sy+ey)/2-10} width="92" height="18" rx="5" fill="#fff" stroke="#d6e3f0"/>
     <text x={(sx+ex)/2} y={(sy+ey)/2+2} textAnchor="middle" fontSize="10" fill="#607d9b">{stateEdgeNames[e.kind]}</text>
    </g>}
   </g>;
  })}
  {d.nodes.map(n=>{
   const p=positions.get(n.id)!,lines=label(n);
   return <g key={n.id}>
    <rect x={p.x-88} y={p.y-29} width="176" height="58" rx="12"
     fill={n.kind==="concept"?"#e6efff":n.kind==="institution"?"#e9f5ed":"#f3effd"}
     stroke={n.kind==="concept"?"#729ed1":n.kind==="institution"?"#84b89c":"#ad9bcf"}
     strokeWidth="2"/>
    {d.showLabels?lines.map((line,i)=><text key={i} x={p.x} y={p.y+(i-(lines.length-1)/2)*16+5}
     textAnchor="middle" fontSize={lines.length>2?12:14} fontWeight="690" fill="#325674">{line}</text>):
     <text x={p.x} y={p.y+5} textAnchor="middle" fill="#93a6bc" fontSize="14">?</text>}
   </g>;
  })}
  <text x="450" y="483" textAnchor="middle" fontSize="12" fill="#8498aa">
   Типы и направления связей задаёт преподаватель. Это учебная модель, а не официальная организационная схема.
  </text>
 </svg>;
}
export default function LektrusLanguageSocialView({diagram}:{diagram:LanguageSocialDiagram}){
 return diagram.kind==="sentence-builder"?<SentenceBoard d={diagram}/>:<CivicsView d={diagram}/>;
}
