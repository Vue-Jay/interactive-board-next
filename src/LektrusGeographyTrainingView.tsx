import {useEffect,useState} from "react";
import {atlasCountryFlagUrl} from "./lektrusAtlasCountrySymbols";
import LektrusGeoCountryOutline from "./LektrusGeoCountryOutline";
import type {GeoCountry,GeoTrainingDiagram} from "./lektrusGeographyTrainingModel";
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
const stop=(e:React.SyntheticEvent)=>e.stopPropagation();

function Matching({diagram:d}:{diagram:GeoTrainingDiagram}){
 const [rightOrder,setRightOrder]=useState(()=>shuffled(d.countryCodes));
 const [selected,setSelected]=useState<{side:"left"|"right";code:string}|null>(null);
 const [matched,setMatched]=useState<string[]>([]);
 const [wrong,setWrong]=useState(0);
 const [feedback,setFeedback]=useState("");
 useEffect(()=>{
  setRightOrder(shuffled(d.countryCodes));setSelected(null);
  setMatched([]);setWrong(0);setFeedback("");
 },[d.countryCodes,d.relation,d.reverse]);
 const restart=()=>{setRightOrder(shuffled(d.countryCodes));setSelected(null);setMatched([]);setWrong(0);setFeedback("")};
 const choose=(side:"left"|"right",code:string)=>{
  if(matched.includes(code))return;
  if(!selected||selected.side===side){
   setSelected({side,code});setFeedback("");return;
  }
  if(selected.code===code){
   setMatched(prev=>[...prev,code]);setFeedback("Верно! Пара найдена.");
  }else{
   setWrong(v=>v+1);setFeedback("Пока не совпало. Попробуйте ещё раз.");
  }
  setSelected(null);
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
 return <div className="lektrus-geo-game" onPointerDown={stop} onPointerUp={stop}
  onClick={stop} onDoubleClick={stop}>
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
   {done?"Все пары найдены! Задание выполнено.":feedback||"Выберите элемент, а затем найдите соответствующий ему во второй колонке."}
  </p>
 </div>;
}
function Flashcards({diagram:d}:{diagram:GeoTrainingDiagram}){
 const [order,setOrder]=useState(()=>shuffled(d.countryCodes));
 const [index,setIndex]=useState(0),[revealed,setRevealed]=useState(false);
 const [known,setKnown]=useState<string[]>([]);
 useEffect(()=>{setOrder(shuffled(d.countryCodes));setIndex(0);setRevealed(false);setKnown([])},
  [d.countryCodes,d.relation,d.reverse]);
 const country=getGeoCountry(order[Math.min(index,order.length-1)]??"");
 const [frontName,backName]=sideLabels(d);
 const go=(next:number)=>{setIndex(next);setRevealed(false)};
 const restart=()=>{setOrder(shuffled(d.countryCodes));setIndex(0);setRevealed(false);setKnown([])};
 const rate=(yes:boolean)=>{
  if(!country)return;
  setKnown(prev=>yes?[...new Set([...prev,country.code])]:prev.filter(c=>c!==country.code));
  if(index<order.length-1)go(index+1);else setRevealed(true);
 };
 return <div className="lektrus-geo-game lektrus-geo-cards" onPointerDown={stop}
  onPointerUp={stop} onClick={stop} onDoubleClick={stop}>
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
   onClick={()=>setRevealed(v=>!v)}>
   <small>{revealed?backName:frontName}</small>
   <div className="lektrus-geo-flashcard-content">{token(country,d,revealed?"right":"left")}</div>
   {revealed&&country.note&&d.relation==="country-capital"&&
    <span className="lektrus-geo-fact-note">{country.note}</span>}
   <span className="lektrus-geo-card-help">{revealed?"Нажмите, чтобы скрыть ответ":"Нажмите, чтобы перевернуть карточку"}</span>
  </button>}
  <div className="lektrus-geo-card-actions">
   <button type="button" disabled={index===0} onClick={()=>go(index-1)}>‹ Назад</button>
   <button type="button" onClick={()=>setRevealed(v=>!v)}>{revealed?"Скрыть":"Ответ"}</button>
   <button type="button" disabled={index===order.length-1} onClick={()=>go(index+1)}>Далее ›</button>
  </div>
  <div className="lektrus-geo-rating">
   <button type="button" disabled={!revealed} onClick={()=>rate(false)}>↻ Повторить</button>
   <button type="button" disabled={!revealed} onClick={()=>rate(true)}>✓ Знаю</button>
  </div>
  <p className="lektrus-geo-message" role="status">Ответы скрыты до переворота. Оценка «Знаю» сохраняется только на время этого прохождения.</p>
 </div>;
}
export default function LektrusGeographyTrainingView({diagram}:{diagram:GeoTrainingDiagram}){
 return diagram.exercise==="matching"?<Matching diagram={diagram}/>:<Flashcards diagram={diagram}/>;
}
