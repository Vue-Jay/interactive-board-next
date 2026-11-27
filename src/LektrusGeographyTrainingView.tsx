import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {geoMatchingPreferredWidth} from "./lektrusGeoMatchingLayout";
import {atlasCountryFlagUrl} from "./lektrusAtlasCountrySymbols";
import LektrusGeoCountryOutline from "./LektrusGeoCountryOutline";
import type {GeoCountry,GeoTrainingDiagram,GeoPractice} from "./lektrusGeographyTrainingModel";
import {getGeoCountry,geoPair,geoRelationNames} from "./lektrusGeographyTrainingModel";
import "./lektrusGeographyTraining.css";

function Flag({code}:{code:string}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[code]);
 return <span className="lektrus-geo-flag" role="img" aria-label="Государственный флаг">
  {!failed?<img src={atlasCountryFlagUrl(code)} alt="Государственный флаг"
   loading="lazy" draggable={false} onError={()=>setFailed(true)}/>:
   <span className="lektrus-geo-no-flag" title="Изображение флага недоступно">Флаг недоступен</span>}
 </span>;
}
function asToken(country:GeoCountry,token:string){
 return token==="flag"?<Flag code={country.code}/>:token==="outline"?
  <LektrusGeoCountryOutline code={country.code}/>:
  <span className="lektrus-geo-answer-text">{token}</span>;
}
function shuffled<T,>(array:readonly T[]):T[]{
 const items=[...array];
 for(let i=items.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[items[i],items[j]]=[items[j],items[i]]}
 if(items.length>1&&items.every((v,i)=>v===array[i]))[items[0],items[1]]=[items[1],items[0]];
 return items;
}
function sideLabels(d:GeoTrainingDiagram):[string,string]{
 const first=d.relation==="flag-country"?"Флаг":d.relation==="outline-country"?"Контур":"Страна";
 const second=d.relation==="country-capital"?"Столица":"Страна";
 return d.reverse?[second,first]:[first,second];
}
function token(country:GeoCountry,d:GeoTrainingDiagram,side:"left"|"right"){
 const pair=geoPair(country,d.relation);
 const first=d.reverse?pair.right:pair.left;
 const second=d.reverse?pair.left:pair.right;
 return asToken(country,side==="left"?first:second);
}
// Embedded answer buttons belong to the exercise, but its non-clickable
// header, progress and blank space are valid board drag surfaces.
// Stop only interactive targets so selecting and moving the whole exercise
// works without clicking or changing a pupil's answer.
const stopInteractive=(e:React.SyntheticEvent)=>{
 const target=e.target as Element;
 if(target.closest("button,input,select,textarea,a,[role='button'],[data-board-interactive]")){
  e.stopPropagation();
 }
};

function initialPractice(d:GeoTrainingDiagram,shared:boolean):GeoPractice{
 const order=shared?[...d.countryCodes.slice(1),...d.countryCodes.slice(0,1)]:shuffled(d.countryCodes);
 return {order,matched:[],wrong:0,index:0,revealed:false,known:[],selected:null,feedback:""};
}
function useGeoPractice(d:GeoTrainingDiagram,onChange?: (next:GeoTrainingDiagram)=>void){
 const codesKey=d.countryCodes.join("|");
 const shared=!!onChange;
 const savedKey=JSON.stringify(d.practice);
 const [state,setState]=useState(()=>d.practice??initialPractice(d,shared));
 const stateRef=useRef(state);
 useEffect(()=>{
  const next=d.practice??initialPractice(d,shared);
  stateRef.current=next;setState(next);
 },[codesKey,d.relation,d.reverse,d.exercise,savedKey,shared]);
 const update=(patch:Partial<GeoPractice>)=>{
  const next={...stateRef.current,...patch};
  stateRef.current=next;setState(next);onChange?.({...d,practice:next});
 };
 const restart=()=>update(initialPractice(d,false));
 return {state,update,restart};
}
function Matching({diagram:d,onMatchingSize,onChange}:{diagram:GeoTrainingDiagram;
 onMatchingSize?:(width:number,height:number)=>void;onChange?:(next:GeoTrainingDiagram)=>void}){
 const gameRef=useRef<HTMLDivElement|null>(null);
 const preferredWidth=geoMatchingPreferredWidth(d);
 const sizeCallback=useRef(onMatchingSize);
 useLayoutEffect(()=>{sizeCallback.current=onMatchingSize});
 useLayoutEffect(()=>{
  if(!onMatchingSize||!gameRef.current)return;
  const element=gameRef.current;
  const report=()=>{
   if(!element.isConnected)return;
   const height=Math.min(2100,Math.max(220,Math.ceil(element.offsetHeight)));
   sizeCallback.current?.(preferredWidth,height);
  };
  report();
  const observer=typeof ResizeObserver==="undefined"?null:new ResizeObserver(report);
  observer?.observe(element);
  return()=>observer?.disconnect();
 },[preferredWidth,!!onMatchingSize]);
 const {state,update,restart}=useGeoPractice(d,onChange);
 const {order:rightOrder,selected,matched,wrong,feedback}=state;
 const choose=(side:"left"|"right",code:string)=>{
  if(matched.includes(code))return;
  if(!selected||selected.side===side){update({selected:{side,code},feedback:""});return;}
  if(selected.code===code)update({matched:[...matched,code],feedback:"correct",selected:null});
  else update({wrong:Math.min(10000,wrong+1),feedback:"wrong",selected:null});
 };
 const done=matched.length===d.countryCodes.length;
 const [leftName,rightName]=sideLabels(d);
 const button=(code:string,side:"left"|"right")=>{
  const country=getGeoCountry(code);
  if(!country)return null;
  const solved=matched.includes(code),active=selected?.side===side&&selected.code===code;
  return <button key={code} type="button" disabled={solved}
   className={"lektrus-geo-match-item"+(solved?" is-correct":"")+(active?" is-selected":"")}
   aria-pressed={active} aria-label={side==="left"?leftName+" "+(d.countryCodes.indexOf(code)+1):rightName+" "+(rightOrder.indexOf(code)+1)}
   onClick={()=>choose(side,code)}>
   {token(country,d,side)}
   {solved&&<span className="lektrus-geo-complete-mark" aria-label="Верно">✓</span>}
  </button>;
 };
 return <div ref={gameRef} className={"lektrus-geo-game"+(onMatchingSize?" lektrus-geo-game--auto-matching":"")}
  style={onMatchingSize?{width:preferredWidth}:undefined} onPointerDown={stopInteractive} onPointerUp={stopInteractive}
  onClick={stopInteractive} onDoubleClick={stopInteractive}>
  <header className="lektrus-geo-game-header">
   <div><strong>{d.title}</strong><small>{geoRelationNames[d.relation]} · {d.reverse?"Обратный порядок":"Обычный порядок"}</small></div>
   <button type="button" className="lektrus-geo-reset" onClick={restart}>↻ Заново</button>
  </header>
  <div className="lektrus-geo-game-progress">
   <span>Найдено пар: <b>{matched.length} / {d.countryCodes.length}</b></span>
   <span>Ошибок: <b>{wrong}</b></span>
  </div>
  <div className="lektrus-geo-match-grid">
   <section aria-label={leftName}><h3>{leftName}</h3>
    {d.countryCodes.map(code=>button(code,"left"))}
   </section>
   <section aria-label={rightName}><h3>{rightName}</h3>
    {rightOrder.map(code=>button(code,"right"))}
   </section>
  </div>
  <p role="status" className={"lektrus-geo-message"+(done?" is-done":"")}>
   {done?"Все пары найдены! Задание выполнено.":feedback==="correct"?"Верно! Пара найдена.":feedback==="wrong"?"Пока не совпало. Попробуйте ещё раз.":"Выберите элемент, а затем найдите соответствующий ему во второй колонке."}
  </p>
 </div>;
}
function Flashcards({diagram:d,onChange}:{diagram:GeoTrainingDiagram;onChange?:(next:GeoTrainingDiagram)=>void}){
 const {state,update,restart}=useGeoPractice(d,onChange);
 const {order,index,revealed,known}=state;
 const country=getGeoCountry(order[Math.min(index,order.length-1)]??"");
 const [frontName,backName]=sideLabels(d);
 const go=(next:number)=>update({index:next,revealed:false});
 const rate=(yes:boolean)=>{
  if(!country)return;
  update({known:yes?[...new Set([...known,country.code])]:known.filter(c=>c!==country.code),
   index:Math.min(index+1,order.length-1),revealed:index===order.length-1});
 };
 return <div className="lektrus-geo-game lektrus-geo-cards" onPointerDown={stopInteractive}
  onPointerUp={stopInteractive} onClick={stopInteractive} onDoubleClick={stopInteractive}>
  <header className="lektrus-geo-game-header">
   <div><strong>{d.title}</strong><small>{geoRelationNames[d.relation]} · {frontName} → {backName}</small></div>
   <button type="button" className="lektrus-geo-reset" onClick={restart}>↻ Заново</button>
  </header>
  <div className="lektrus-geo-game-progress">
   <span>Карточка <b>{index+1} / {order.length}</b></span>
   <span>Знаю: <b>{known.length} / {order.length}</b></span>
  </div>
  {country&&<button type="button" className={"lektrus-geo-flashcard"+(revealed?" is-flipped":"")}
   aria-label={revealed?"Скрыть ответ":"Показать ответ"}
   onClick={()=>update({revealed:!revealed})}>
   <small>{revealed?backName:frontName}</small>
   <div className="lektrus-geo-flashcard-content">{token(country,d,revealed?"right":"left")}</div>
   {revealed&&country.note&&d.relation==="country-capital"&&
    <span className="lektrus-geo-fact-note">{country.note}</span>}
   <span className="lektrus-geo-card-help">{revealed?"Нажмите, чтобы скрыть ответ":"Нажмите, чтобы перевернуть карточку"}</span>
  </button>}
  <div className="lektrus-geo-card-actions">
   <button type="button" disabled={index===0} onClick={()=>go(index-1)}>‹ Назад</button>
   <button type="button" onClick={()=>update({revealed:!revealed})}>{revealed?"Скрыть":"Ответ"}</button>
   <button type="button" disabled={index===order.length-1} onClick={()=>go(index+1)}>Далее ›</button>
  </div>
  <div className="lektrus-geo-rating">
   <button type="button" disabled={!revealed} onClick={()=>rate(false)}>↻ Повторить</button>
   <button type="button" disabled={!revealed} onClick={()=>rate(true)}>✓ Знаю</button>
  </div>
  <p className="lektrus-geo-message" role="status">Ответы скрыты до переворота. Оценка «Знаю» сохраняется в ходе прохождения.</p>
 </div>;
}
export default function LektrusGeographyTrainingView({diagram,onMatchingSize,onChange}:{diagram:GeoTrainingDiagram;
 onMatchingSize?:(width:number,height:number)=>void;onChange?:(next:GeoTrainingDiagram)=>void}){
 if(diagram.countryCodes.length<2)return <div className="lektrus-geo-game lektrus-geo-empty-preview" role="status">
  <strong>{diagram.title}</strong>
  <p>Задание пока пустое. Выберите страны вручную или сгенерируйте набор в редакторе.</p>
 </div>;
 return diagram.exercise==="matching"?<Matching diagram={diagram} onMatchingSize={onMatchingSize} onChange={onChange}/>:<Flashcards diagram={diagram} onChange={onChange}/>;
}
