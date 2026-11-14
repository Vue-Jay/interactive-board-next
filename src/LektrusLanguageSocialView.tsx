import {useEffect,useMemo,useRef,useState,type KeyboardEvent as ReactKeyboardEvent,type PointerEvent as ReactPointerEvent,type SyntheticEvent} from "react";
import {createPortal} from "react-dom";
import type {LanguageSocialDiagram,StateNode} from "./lektrusLanguageSocialModel";
import {initialScramble,sentencePatternById,stateEdgeNames} from "./lektrusLanguageSocialModel";
import {moveSentenceWord,sentenceWordDropSlot} from "./lektrusSentenceDrag";

type WordGesture={
 id:string;pointerId:number;startX:number;startY:number;
 offsetX:number;offsetY:number;width:number;active:boolean;origin:string[];
};
type WordPreview={id:string;left:number;top:number;width:number};

function SentenceBoard({d}:{d:Extract<LanguageSocialDiagram,{kind:"sentence-builder"}>}){
 const key=d.parts.map(p=>p.id+"="+p.text).join("|");
 const initial=useMemo(()=>initialScramble(d.parts),[key]);
 const [order,setOrder]=useState<string[]>(initial);
 const [checked,setChecked]=useState(false);
 const [preview,setPreview]=useState<WordPreview|null>(null);
 const partsRef=useRef<HTMLDivElement|null>(null);
 const gestureRef=useRef<WordGesture|null>(null);
 useEffect(()=>{
  gestureRef.current=null;setOrder(initial);setChecked(false);setPreview(null);
 },[initial]);
 const dictionary=new Map(d.parts.map(p=>[p.id,p]));
 const correct=d.parts.every((p,i)=>order[i]===p.id);
 const reset=()=>{gestureRef.current=null;setPreview(null);setOrder([...initial]);setChecked(false)};
 const stop=(event:SyntheticEvent)=>event.stopPropagation();
 const pattern=sentencePatternById(d.patternId);

 const beginDrag=(event:ReactPointerEvent<HTMLButtonElement>,id:string)=>{
  if(event.pointerType==="mouse"&&event.button!==0)return;
  event.preventDefault();event.stopPropagation();
  if(gestureRef.current)return;
  const rect=event.currentTarget.getBoundingClientRect();
  gestureRef.current={
   id,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,
   offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,width:rect.width,
   active:false,origin:[...order]
  };
  event.currentTarget.focus();
  event.currentTarget.setPointerCapture(event.pointerId);
 };
 const dragWord=(event:ReactPointerEvent<HTMLButtonElement>)=>{
  const gesture=gestureRef.current;
  if(!gesture||gesture.pointerId!==event.pointerId)return;
  event.preventDefault();event.stopPropagation();
  if(!gesture.active&&Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY)<5)return;
  gesture.active=true;
  setPreview({id:gesture.id,left:event.clientX-gesture.offsetX,
   top:event.clientY-gesture.offsetY,width:gesture.width});
  const siblings=Array.from(partsRef.current?.querySelectorAll<HTMLButtonElement>("[data-sentence-word]")??[])
   .filter(element=>element.dataset.sentenceWord!==gesture.id);
  const slot=sentenceWordDropSlot(event.clientX,event.clientY,
   siblings.map(element=>element.getBoundingClientRect()));
  setOrder(current=>moveSentenceWord(current,gesture.id,slot));
  setChecked(false);
 };
 const endDrag=(event:ReactPointerEvent<HTMLButtonElement>,cancel=false)=>{
  const gesture=gestureRef.current;
  if(!gesture||gesture.pointerId!==event.pointerId)return;
  event.stopPropagation();
  gestureRef.current=null;
  if(cancel&&gesture.active)setOrder(gesture.origin);
  setPreview(null);
  if(event.currentTarget.hasPointerCapture(event.pointerId))
   event.currentTarget.releasePointerCapture(event.pointerId);
 };
 const releaseLostCapture=(event:ReactPointerEvent<HTMLButtonElement>)=>{
  const gesture=gestureRef.current;
  if(!gesture||gesture.pointerId!==event.pointerId)return;
  gestureRef.current=null;setPreview(null);
 };
 const reorderWithKeyboard=(event:ReactKeyboardEvent<HTMLButtonElement>,id:string)=>{
  const at=order.indexOf(id);
  const next=event.key==="ArrowLeft"?at-1:event.key==="ArrowRight"?at+1:
   event.key==="Home"?0:event.key==="End"?order.length-1:at;
  if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key)||at<0)return;
  event.preventDefault();event.stopPropagation();
  setOrder(current=>moveSentenceWord(current,id,next));
  setChecked(false);
 };
 return <>
  <div className="lektrus-sentence-on-board" role="group" aria-label={d.title}
   onPointerDown={stop} onPointerMove={stop} onPointerUp={stop} onClick={stop}>
   <strong>{d.title}</strong>
   <p className="lektrus-sentence-task">{d.instructions}</p>
   {d.showHint&&pattern&&<p className="lektrus-sentence-tip">{pattern.label}: {pattern.tip}</p>}
   <div ref={partsRef} className="lektrus-sentence-parts"
    aria-label="Соберите предложение, перетаскивая слова в правильном порядке">
    {order.map((id,i)=><button type="button" key={id} data-sentence-word={id}
     draggable={false} className={preview?.id===id?"is-dragging":""}
     aria-label={`Слово ${dictionary.get(id)?.text??"?"}, позиция ${i+1}. Перетащите или используйте стрелки для перемещения.`}
     title={`Позиция ${i+1}. Перетащите слово или используйте стрелки.`}
     onPointerDown={event=>beginDrag(event,id)}
     onPointerMove={dragWord} onPointerUp={event=>endDrag(event)}
     onPointerCancel={event=>endDrag(event,true)}
     onLostPointerCapture={releaseLostCapture}
     onKeyDown={event=>reorderWithKeyboard(event,id)}>
     {dictionary.get(id)?.text??"?"}
    </button>)}
   </div>
   <div className="lektrus-sentence-status" role="status" aria-live="polite">
    {checked?(correct?"Правильно! Порядок совпадает с заданным преподавателем.":"Есть неточности. Попробуйте ещё раз."):
     preview?"Переместите слово на нужное место и отпустите.":"Перетаскивайте слова, чтобы собрать предложение. Можно использовать стрелки клавиатуры."}
   </div>
   <div className="lektrus-sentence-actions">
    <button type="button" onClick={reset}>Заново</button>
    <button type="button" onClick={()=>setChecked(true)}>Проверить</button>
   </div>
   {d.showKey&&<div className="lektrus-sentence-key">
    <small>Ответ преподавателя:</small> {d.parts.map(p=>p.text).join(" ")}
   </div>}
  </div>
  {preview&&createPortal(
   <span className="lektrus-sentence-drag-preview" aria-hidden="true"
    style={{left:preview.left,top:preview.top,width:preview.width}}>
    {dictionary.get(preview.id)?.text??"?"}
   </span>,document.body)}
 </>;
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
   {d.templateId.startsWith("lit-")?"Содержание и связи определяет преподаватель по тексту произведения.":"Типы и направления связей задаёт преподаватель. Это учебная модель."}
  </text>
 </svg>;
}
export default function LektrusLanguageSocialView({diagram}:{diagram:LanguageSocialDiagram}){
 return diagram.kind==="sentence-builder"?<SentenceBoard d={diagram}/>:<CivicsView d={diagram}/>;
}
