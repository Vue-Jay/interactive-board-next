import {useRef,useState,type PointerEvent} from "react";
import type {Item} from "./boardModel";
import {organicAtomColor} from "./lektrusOrganicFormula";

type P={x:number;y:number};
const W=560,H=390;
const elements=new Set(["C","N","O","H","S","F","Cl","Br"]);
const toGraph=(p:P)=>({x:(p.x-W/2)/32,y:(H/2-p.y)/32});
const distance=(a:P,b:P)=>Math.hypot(a.x-b.x,a.y-b.y);
/** Conservative hints only. Every suggestion must be explicitly confirmed. */
export function suggestHandwriting(strokes:P[][]):string{
 const points=strokes.flat();
 if(!points.length)return"?";
 if(strokes.length!==1)return"?";
 const s=strokes[0],start=s[0],end=s[s.length-1];
 const length=s.slice(1).reduce((v,p,i)=>v+distance(p,s[i]),0);
 const dx=end.x-start.x,dy=end.y-start.y,dist=Math.hypot(dx,dy);
 if(dist>34&&length/dist<1.22){
  if(Math.abs(dx)<Math.abs(dy)*.22)return"1";
  return"bond";
 }
 const xs=s.map(p=>p.x),ys=s.map(p=>p.y);
 const w=Math.max(...xs)-Math.min(...xs),h=Math.max(...ys)-Math.min(...ys);
 if(w>14&&h>14&&length>60&&dist/length<.23)return"O";
 if(w>14&&h>14&&length>40&&dist/length<.5)return"C";
 return"?";
}
export default function LektrusOrganicHandwriting({
 item,onChange,onExit
}:{item:Item;onChange:(updater:(item:Item)=>Item)=>void;onExit:()=>void}){
 const svg=useRef<SVGSVGElement>(null),active=useRef<{id:number;stroke:P[]}|null>(null);
 const [strokes,setStrokes]=useState<P[][]>([]);
 const [choice,setChoice]=useState<string>("");
 const [notice,setNotice]=useState("Нарисуйте один символ или одну связь. Результат нужно подтвердить.");
 const xy=(e:PointerEvent<SVGSVGElement>):P=>{
  const r=e.currentTarget.getBoundingClientRect();
  return{x:(e.clientX-r.left)/Math.max(1,r.width)*W,y:(e.clientY-r.top)/Math.max(1,r.height)*H};
 };
 const finish=(e:PointerEvent<SVGSVGElement>)=>{
  const writing=active.current;
  if(!writing||writing.id!==e.pointerId)return;
  active.current=null;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  if(writing.stroke.length<2)return;
  setStrokes(old=>{
   const next=[...old,writing.stroke];
   setChoice(suggestHandwriting(next));
   return next;
  });
 };
 const apply=()=>{
  const points=strokes.flat();
  if(!points.length||!choice||choice==="?")return;
  const x=points.reduce((v,p)=>v+p.x,0)/points.length,y=points.reduce((v,p)=>v+p.y,0)/points.length;
  const center=toGraph({x,y});
  const original=item.graphPoints??[];
  const existing=item.graphSegments??[];
  if(choice==="bond"||choice==="double"||choice==="triple"){
   if(strokes.length!==1){setNotice("Для распознавания связи нарисуйте один прямой штрих");return;}
   const s=strokes[0],begin=toGraph(s[0]),end=toGraph(s[s.length-1]);
   if(Math.hypot(begin.x-end.x,begin.y-end.y)<.55){setNotice("Штрих слишком короткий для связи");return;}
   const find=(pos:typeof center,excluded?:number)=>original.findIndex((p,i)=>i!==excluded&&Math.hypot(p.x-pos.x,p.y-pos.y)<.9);
   let a=find(begin),b=find(end,a);
   const next=original.map(p=>({...p}));
   if(a<0){a=next.length;next.push({...begin,label:"C",color:organicAtomColor("C")});}
   if(b<0){b=next.length;next.push({...end,label:"C",color:organicAtomColor("C")});}
   if(a===b){setNotice("Оба конца должны быть у разных атомов");return;}
   const degree=next.map(()=>0);
   const order=choice==="triple"?3:choice==="double"?2:1;
   const existingIndex=existing.findIndex(edge=>(edge.a===a&&edge.b===b)||(edge.a===b&&edge.b===a));
   existing.forEach((edge,i)=>{if(i===existingIndex)return;degree[edge.a]+=(edge.bondOrder??1);degree[edge.b]+=(edge.bondOrder??1)});
   const valence=(atom:string)=>({C:4,N:3,O:2,H:1,S:2,F:1,Cl:1,Br:1} as Record<string,number>)[atom]??4;
   if(degree[a]+order>valence(next[a].label)||degree[b]+order>valence(next[b].label)){
    setNotice("Связь превышает типичную валентность одного из атомов");return;
   }
   const bonds=existingIndex<0?[...existing,{a,b,bondOrder:order as 1|2|3,kind:"segment" as const,label:"",measure:false}]:
     existing.map((edge,i)=>i===existingIndex?{...edge,bondOrder:order as 1|2|3}:edge);
   onChange(old=>({...old,graphPoints:next,graphSegments:bonds}));
  }else if(elements.has(choice)){
   const nearest=original.findIndex(p=>Math.hypot(p.x-center.x,p.y-center.y)<.85);
   onChange(old=>({...old,graphPoints:nearest>=0?
    (old.graphPoints??[]).map((p,i)=>i===nearest?{...p,label:choice,color:organicAtomColor(choice)}:p):
    [...(old.graphPoints??[]),{...center,label:choice,color:organicAtomColor(choice)}]}));
  }else{
   onChange(old=>({...old,scienceOrganicAnnotations:[...(old.scienceOrganicAnnotations??[]),{...center,text:choice}]}));
  }
  setStrokes([]);setChoice("");setNotice("Добавлено. Можно нарисовать следующий символ или связь.");
 };
 const choices=[["bond","Одинарная связь"],["double","Двойная связь"],["triple","Тройная связь"],
 ...["C","N","O","H","S","F","Cl","Br","0","1","2","3","4","5","6","7","8","9"].map(x=>[x,x])];
 return <div className="lektrus-organic-handwriting">
  <svg ref={svg} viewBox={`0 0 ${W} ${H}`} aria-label="Рукописный ввод атомов и связей"
   onPointerDown={e=>{e.preventDefault();e.stopPropagation();const p=xy(e);
    active.current={id:e.pointerId,stroke:[p]};e.currentTarget.setPointerCapture(e.pointerId)}}
   onPointerMove={e=>{if(active.current?.id!==e.pointerId)return;
    active.current.stroke.push(xy(e));setStrokes(old=>[...old.slice(0,-1),active.current!.stroke.slice()]);}}
   onPointerUp={finish} onPointerCancel={e=>{active.current=null;setNotice("Ввод прерван. Повторите штрих.");if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}
   style={{touchAction:"none"}}>
   <rect width={W} height={H} fill="#fff" fillOpacity=".68"/>
   {strokes.map((stroke,i)=><polyline key={i} points={stroke.map(p=>p.x+","+p.y).join(" ")}
      stroke="#2b72c0" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>)}
  </svg>
  <div className="lektrus-organic-handwrite-controls">
   <strong>Рукописный ввод с проверкой</strong>
   <small>{notice}</small>
   <div><label>Распознано:
    <select aria-label="Проверьте и исправьте распознанное" value={choice}
     onChange={e=>setChoice(e.target.value)}>
     <option value="">Выберите символ</option><option value="?">Не уверено</option>
     {choices.map(([v,label])=><option value={v} key={v}>{label}</option>)}
    </select>
   </label>
   <button type="button" disabled={!strokes.length||!choice||choice==="?"} onClick={apply}>Вставить</button>
   <button type="button" onClick={()=>{setStrokes([]);setChoice("");setNotice("Введите новый символ.")}}>Очистить штрихи</button>
   <button type="button" onClick={onExit}>Готово</button></div>
  </div>
 </div>;
}
