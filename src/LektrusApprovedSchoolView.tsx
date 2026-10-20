import {useEffect,useState} from "react";
import type {ApprovedSchoolDiagram,FamilyPerson,MorphemeRole} from "./lektrusApprovedSchoolModel";
import type {SchoolDiagram} from "./lektrusSchoolDiagramModel";
import {familyGenerations,morphemeNames} from "./lektrusApprovedSchoolModel";

function MorphemeGraphic({diagram:d}:{diagram:Extract<ApprovedSchoolDiagram,{kind:"morphemes"}>}){
 const widths=d.segments.map(s=>Math.min(155,Math.max(52,s.text.length*28+16)));
 const combined=widths.reduce((a,b)=>a+b,0)+ (d.zeroEnding?52:0),ratio=Math.min(1,788/Math.max(1,combined));
 let x=450-combined*ratio/2;
 const word=d.segments.map(v=>v.text).join("");
 const sign=(role:MorphemeRole,x0:number,w:number)=>{
  const center=x0+w/2,low=209,high=168;
  switch(role){
   case "prefix":return <path d={`M${x0+5} ${high}V${low-2}H${x0+w-6}`} fill="none" stroke="#4475b3" strokeWidth="3" strokeLinejoin="round"/>;
   case "root":return <path d={`M${x0+4} ${low}Q${center} ${high-21} ${x0+w-4} ${low}`} fill="none" stroke="#4475b3" strokeWidth="3"/>;
   case "suffix":return <path d={`M${x0+5} ${low}L${center} ${high}L${x0+w-5} ${low}`} fill="none" stroke="#4475b3" strokeWidth="3"/>;
   case "ending":return <rect x={x0+3} y={high} width={w-6} height={low-high+12} fill="none" stroke="#4475b3" strokeWidth="3" rx="2"/>;
   case "postfix":return <path d={`M${x0+4} ${high+3}H${x0+w-4}M${center} ${high+3}V${low+9}`} stroke="#4475b3" strokeWidth="3" fill="none"/>;
  }
 };
 const coords=d.segments.map((s,i)=>{const cx=x,w=widths[i]*ratio;x+=w;return {s,i,x:cx,w}});
 const left=coords[0]?.x??120;
 const baseEnd=[...coords].reverse().find(v=>v.s.role!=="ending"&&v.s.role!=="postfix");
 return <svg viewBox="0 0 900 500" role="img" aria-label={d.title} className="lektrus-school-svg">
  <rect width="900" height="500" rx="20" fill="#fcfdff"/>
  <text x="450" y="48" fill="#25486d" textAnchor="middle" fontWeight="750" fontSize="24">{d.title}</text>
  <text x="450" y="99" textAnchor="middle" fill="#7992a9" fontSize="15">Разбор слова по составу</text>
  {coords.map(({s,x:x0,w})=><g key={s.id}>
   <text x={x0+w/2} y="273" textAnchor="middle" fill="#233e5c" fontWeight="700" fontSize={Math.min(33,36*ratio+5)}>{s.text}</text>
   {d.showMarks&&sign(s.role,x0,w)}
   {d.showMarks&&<text x={x0+w/2} y="324" fontSize="12" textAnchor="middle" fill="#718eaa">{morphemeNames[s.role]}</text>}
  </g>)}
  {d.zeroEnding&&<g>
   <text x={x-4*ratio+21} y="273" textAnchor="middle" fill="#6688ac" fontSize="28">∅</text>
   {d.showMarks&&<text x={x-4*ratio+21} y="324" textAnchor="middle" fill="#718eaa" fontSize="11">нулевое окончание</text>}
  </g>}
  {d.showBase&&baseEnd&&<g>
   <path d={`M${left+3} 355V366H${baseEnd.x+baseEnd.w-3}V355`}
    stroke="#b48350" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
   <text x={(left+baseEnd.x+baseEnd.w)/2} y="395" textAnchor="middle" fontSize="13" fill="#98734c">основа слова</text>
  </g>}
  <text x="450" y="442" fontSize="16" textAnchor="middle" fill="#54708a">{word}{d.zeroEnding?" (нулевое окончание)":""}</text>
  <text x="450" y="478" fontSize="13" textAnchor="middle" fill="#8498ac">
   Границы и виды морфем задаёт преподаватель
  </text>
 </svg>;
}
function FamilyGraphic({diagram:d}:{diagram:Extract<ApprovedSchoolDiagram,{kind:"family-tree"}>}){
 const levels=familyGenerations(d.people);
 const byLevel=new Map<number,FamilyPerson[]>();
 for(const person of d.people){
  const n=levels.get(person.id)??0;
  byLevel.set(n,[...(byLevel.get(n)??[]),person]);
 }
 const maxLevel=Math.max(0,...levels.values());
 const stepY=Math.min(117,330/Math.max(1,maxLevel)),top=120;
 const pos=new Map<string,{x:number;y:number}>();
 for(const [level,people] of byLevel){
  people.forEach((person,i)=>{
   pos.set(person.id,{x:450+(i-(people.length-1)/2)*Math.min(205,780/Math.max(1,people.length)),y:top+level*stepY});
  });
 }
 return <svg viewBox="0 0 900 500" role="img" aria-label={d.title} className="lektrus-school-svg">
  <rect width="900" height="500" rx="20" fill="#fcfdff"/>
  <text x="450" y="43" textAnchor="middle" fontSize="24" fontWeight="750" fill="#274b70">{d.title}</text>
  {d.showGenerations&&Array.from(byLevel.keys()).sort((a,b)=>a-b).map(level=>
   <text key={level} x="28" y={top+level*stepY+5} fontSize="12" fill="#8b9fb0">Поколение {level+1}</text>)}
  {d.people.flatMap(person=>person.parents.map(parent=>{
   const from=pos.get(parent),to=pos.get(person.id);
   if(!from||!to)return null;
   const mid=(from.y+to.y)/2;
   return <path key={parent+"-"+person.id}
    d={`M${from.x} ${from.y+26}V${mid}H${to.x}V${to.y-26}`}
    stroke="#7092bb" strokeWidth="2.4" fill="none" strokeLinejoin="round"/>;
  }))}
  {d.people.map(person=>{
   const p=pos.get(person.id)!;
   return <g key={person.id}>
    <rect x={p.x-80} y={p.y-25} width="160" height="50" rx="13"
     fill={person.parents.length?"#ebf2ff":"#e4f4ee"}
     stroke={person.parents.length?"#86a9d6":"#7bb4a2"} strokeWidth="2"/>
    <text x={p.x} y={p.y+5} fill="#30567e" fontSize={person.name.length>17?13:16}
     fontWeight="700" textAnchor="middle">{person.name.length>23?person.name.slice(0,22)+"…":person.name}</text>
   </g>;
  })}
  <text x="450" y="477" fill="#879bae" fontSize="13" textAnchor="middle">
   Родственные связи задаются вручную · схема учебная
  </text>
 </svg>;
}
function FlashcardGraphic({diagram:d}:{diagram:Extract<ApprovedSchoolDiagram,{kind:"flashcards"}>}){
 const [index,setIndex]=useState(0),[revealed,setRevealed]=useState(false);
 const card=d.cards[Math.min(index,d.cards.length-1)];
 const front=d.direction==="foreign-first"?(card?.term??""):(card?.translation??"");
 const back=d.direction==="foreign-first"?(card?.translation??""):(card?.term??"");
 useEffect(()=>{setIndex(0);setRevealed(false)},[d.cards,d.direction]);
 const stop=(e:React.SyntheticEvent)=>e.stopPropagation();
 const navigation=(to:number)=>{setIndex(to);setRevealed(false)};
 return <div className="lektrus-flashcards-on-board" aria-label={d.title}
  onPointerDown={stop} onPointerUp={stop} onClick={stop}>
  <div className="lektrus-flashcard-heading">{d.title}</div>
  <div className="lektrus-flashcard-counter">{d.cards.length?index+1:0} / {d.cards.length}</div>
  <button type="button" className="lektrus-flashcard-surface"
   onClick={()=>setRevealed(v=>!v)} aria-label={revealed?"Вернуть лицевую сторону":"Перевернуть карточку"}>
   <span className="lektrus-flashcard-word">{card?(revealed?back:front):"Добавьте слова в редакторе карточек"}</span>
   {!revealed&&d.showTranscription&&d.direction==="foreign-first"&&card?.transcription&&
    <span className="lektrus-flashcard-pronunciation">{card.transcription}</span>}
   {!revealed&&d.showTranslation&&<span className="lektrus-flashcard-hint">{back}</span>}
   <span className="lektrus-flashcard-interaction-hint">{revealed?"Нажмите, чтобы закрыть":"Нажмите, чтобы перевернуть"}</span>
  </button>
  <div className="lektrus-flashcard-actions">
   <button type="button" onClick={()=>navigation(Math.max(0,index-1))}
    disabled={index===0} aria-label="Предыдущая карточка">‹ Предыдущая</button>
   <button type="button" onClick={()=>setRevealed(v=>!v)}>{revealed?"Скрыть ответ":"Показать ответ"}</button>
   <button type="button" onClick={()=>navigation(Math.min(d.cards.length-1,index+1))}
    disabled={index===d.cards.length-1} aria-label="Следующая карточка">Следующая ›</button>
  </div>
 </div>;
}
export default function LektrusApprovedSchoolView({diagram,onChange}: {diagram:ApprovedSchoolDiagram;onChange?:(v:SchoolDiagram)=>void}){
 if(diagram.kind==="morphemes")return <div className="lektrus-inline-lesson"
  onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
  {onChange&&<div className="lektrus-inline-lesson-controls">
   <button type="button" onClick={()=>onChange({...diagram,showMarks:!diagram.showMarks})}>
    {diagram.showMarks?"Скрыть обозначения":"Показать обозначения"}</button>
   <button type="button" onClick={()=>onChange({...diagram,showBase:!diagram.showBase})}>
    {diagram.showBase?"Скрыть основу":"Показать основу"}</button>
   {diagram.segments.length===1&&<label>Слово <input maxLength={24}
    value={diagram.segments[0].text}
    onChange={e=>{const value=e.target.value.trim();
     if(value)onChange({...diagram,segments:[{...diagram.segments[0],text:value}]});
    }}/></label>}
  </div>}
  <MorphemeGraphic diagram={diagram}/>
 </div>;
 if(diagram.kind==="family-tree")return <FamilyGraphic diagram={diagram}/>;
 return <FlashcardGraphic diagram={diagram}/>;
}
