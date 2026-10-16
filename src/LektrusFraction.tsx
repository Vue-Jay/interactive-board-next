import {useEffect,useMemo,useState} from "react";
import type {Item} from "./boardModel";

type FractionMode="circle"|"bar";
type FractionData={title:string;mode:FractionMode;numerator:number;denominator:number};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,Number.isFinite(n)?Math.round(n):min));
const fractionFrom=(item:Item):FractionData=>({
  title:item.text||"Дробная модель",
  mode:item.fractionMode==="bar"?"bar":"circle",
  numerator:item.fractionNumerator??0,
  denominator:item.fractionDenominator??4
});
const gcd=(a:number,b:number):number=>b===0?a:gcd(b,a%b);

export function LektrusFractionView({item,onSelect}:{item:Item;onSelect?:(value:number)=>void}){
  const {title,mode}=fractionFrom(item);
  const denominator=clamp(item.fractionDenominator??4,1,24);
  const numerator=clamp(item.fractionNumerator??0,0,denominator);
  const simplifiedGcd=gcd(numerator,denominator)||1;
  const summary=numerator===0?"0":numerator===denominator?"1":
    `${numerator/simplifiedGcd}/${denominator/simplifiedGcd}`;
  const color=item.color||"#5074dc";
  const slices=useMemo(()=>Array.from({length:denominator},(_,i)=>i),[denominator]);
  const wedge=(i:number)=>{
    const start=-Math.PI/2+2*Math.PI*i/denominator;
    const end=-Math.PI/2+2*Math.PI*(i+1)/denominator;
    const x1=180+100*Math.cos(start),y1=125+100*Math.sin(start);
    const x2=180+100*Math.cos(end),y2=125+100*Math.sin(end);
    if(denominator===1)return <circle key={i} cx="180" cy="125" r="100" fill={i<numerator?color:"#f5f7fe"}
      stroke="#fff" strokeWidth="3" onClick={onSelect?()=>onSelect(numerator?0:1):undefined}/>;
    return <path key={i}
      d={`M180 125 L${x1} ${y1} A100 100 0 ${end-start>Math.PI?1:0} 1 ${x2} ${y2} Z`}
      fill={i<numerator?color:"#f5f7fe"} stroke="#fff" strokeWidth="2"
      style={{cursor:onSelect?"pointer":undefined}}
      onClick={onSelect?()=>onSelect(i<numerator?i:i+1):undefined}/>;
  };
  return <div className="lektrus-fraction-view">
    <div className="lektrus-fraction-heading"><strong>{title}</strong><span>{numerator} / {denominator} {summary!==`${numerator}/${denominator}`?`= ${summary}`:""}</span></div>
    <svg viewBox="0 0 360 250" role="img" aria-label={`Дробь ${numerator} из ${denominator}`}>
      {mode==="circle"?<g>{slices.map(wedge)}<circle cx="180" cy="125" r="100" stroke="#4b6cbb" strokeWidth="2" fill="none" pointerEvents="none"/></g>:
        <g>{slices.map(i=><rect key={i} x={22+i*316/denominator} y="86" width={316/denominator} height="80"
          fill={i<numerator?color:"#f5f7fe"} stroke="#fff" strokeWidth="2"
          style={{cursor:onSelect?"pointer":undefined}}
          onClick={onSelect?()=>onSelect(i<numerator?i:i+1):undefined}/>)}
          <rect x="22" y="86" width="316" height="80" fill="none" stroke="#4b6cbb" strokeWidth="2" pointerEvents="none"/></g>}
    </svg>
    <div className="lektrus-fraction-caption">{numerator} из {denominator} равных {mode==="circle"?"секторов":"частей"}</div>
  </div>;
}

export default function LektrusFractionEditor({item,onSave,onCancel}:{
  item:Item;onSave:(data:FractionData)=>void;onCancel:()=>void;
}){
  const [draft,setDraft]=useState<FractionData>(()=>fractionFrom(item));
  const change=(next:Partial<FractionData>)=>setDraft(current=>({...current,...next}));
  const preview:Item={...item,text:draft.title,fractionMode:draft.mode,fractionNumerator:draft.numerator,fractionDenominator:draft.denominator};
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){e.stopPropagation();e.preventDefault();onCancel()}
    };
    document.addEventListener("keydown",onKey,true);
    return()=>document.removeEventListener("keydown",onKey,true);
  },[onCancel]);
  return <div className="lektrus-fraction-overlay" onPointerDown={e=>{if(e.target===e.currentTarget)onCancel()}}>
    <div className="lektrus-fraction-dialog" role="dialog" aria-modal="true" aria-label="Редактор дробей" onPointerDown={e=>e.stopPropagation()}>
      <header><div><strong>Наглядные дроби</strong><small>Доли целого и сравнение дробей</small></div>
        <button type="button" aria-label="Закрыть" onClick={onCancel}>×</button></header>
      <div className="lektrus-fraction-editor-body">
        <section className="lektrus-fraction-fields">
          <label>Название<input value={draft.title} maxLength={100} onChange={e=>change({title:e.target.value})}/></label>
          <div className="lektrus-fraction-mode" role="group" aria-label="Вид дроби">
            <strong>Вид дроби</strong>
            <div className="lektrus-fraction-mode-tabs">
              <button type="button" aria-pressed={draft.mode==="circle"} className={draft.mode==="circle"?"active":""} onClick={()=>change({mode:"circle"})}>◉ Круг</button>
              <button type="button" aria-pressed={draft.mode==="bar"} className={draft.mode==="bar"?"active":""} onClick={()=>change({mode:"bar"})}>▤ Полоска</button>
            </div>
          </div>
          <div className="lektrus-fraction-numbers">
            <label>Числитель<input type="number" min="0" max={draft.denominator} step="1" value={draft.numerator}
              onChange={e=>change({numerator:clamp(Number(e.target.value),0,draft.denominator)})}/></label>
            <label>Знаменатель<input type="number" min="1" max="24" step="1" value={draft.denominator}
              onChange={e=>{const denominator=clamp(Number(e.target.value),1,24);change({denominator,numerator:Math.min(draft.numerator,denominator)})}}/></label>
          </div>
          <small>Знаменатель определяет число равных частей, числитель показывает закрашенные части. Можно выбрать от 1 до 24 частей.</small>
          <label>Закрашенные части<input type="range" min="0" max={draft.denominator} step="1" value={draft.numerator}
            onChange={e=>change({numerator:Number(e.target.value)})}/></label>
          <div className="lektrus-fraction-shortcuts">{[2,3,4,6,8,10,12].map(n=><button key={n} type="button" className={n===draft.denominator?"active":""}
            onClick={()=>change({denominator:n,numerator:Math.min(n,draft.numerator)})}>{n} частей</button>)}</div>
        </section>
        <section className="lektrus-fraction-preview"><LektrusFractionView item={preview} onSelect={numerator=>change({numerator})}/>
          <small>Нажимайте на сектора или части полоски, чтобы изменять числитель.</small></section>
      </div>
      <footer><button type="button" onClick={onCancel}>Отмена</button>
        <button type="button" className="primary" onClick={()=>onSave(draft)}>Сохранить</button></footer>
    </div>
  </div>;
}
