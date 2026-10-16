import {useEffect,useState,type MouseEvent} from "react";
import type {Item} from "./boardModel";

type FractionMode="circle"|"bar";
type FractionData={title:string;mode:FractionMode;numerator:number;denominator:number};
const normalizeCount=(n:number,min:number)=>Number.isFinite(n)?Math.max(min,Math.min(Number.MAX_SAFE_INTEGER,Math.trunc(n))):min;
const fractionFrom=(item:Item):FractionData=>({
  title:item.text||"Дробная модель",
  mode:item.fractionMode==="bar"?"bar":"circle",
  numerator:item.fractionNumerator??0,
  denominator:item.fractionDenominator??4
});
const gcd=(a:number,b:number):number=>b===0?a:gcd(b,a%b);

export function LektrusFractionView({item,onSelect}:{item:Item;onSelect?:(value:number)=>void}){
  const {title,mode}=fractionFrom(item);
  const denominator=normalizeCount(item.fractionDenominator??4,1);
  const numerator=Math.min(denominator,normalizeCount(item.fractionNumerator??0,0));
  const simplifiedGcd=gcd(numerator,denominator)||1;
  const summary=numerator===0?"0":numerator===denominator?"1":
    `${numerator/simplifiedGcd}/${denominator/simplifiedGcd}`;
  const color=item.color||"#5074dc";
  // At high denominators, sectors become subpixel. Render a proportional fill
  // and only the visible grid lines instead of allocating N DOM elements.
  const visibleDivisions=Math.min(denominator,120);
  const lines=Array.from({length:visibleDivisions},(_,i)=>i);
  const proportion=numerator/denominator;
  const arcEnd=-Math.PI/2+2*Math.PI*proportion;
  const endX=180+100*Math.cos(arcEnd),endY=125+100*Math.sin(arcEnd);
  const onBarClick=(event:MouseEvent<SVGSVGElement>)=>{
    if(!onSelect)return;
    const rect=event.currentTarget.getBoundingClientRect();
    const px=(event.clientX-rect.left)/rect.width*360;
    const part=Math.floor(Math.max(0,Math.min(.999999,(px-22)/316))*denominator);
    onSelect(part<numerator?part:part+1);
  };
  const onCircleClick=(event:MouseEvent<SVGSVGElement>)=>{
    if(!onSelect)return;
    const rect=event.currentTarget.getBoundingClientRect();
    const x=(event.clientX-rect.left)/rect.width*360-180;
    const y=(event.clientY-rect.top)/rect.height*250-125;
    if(Math.hypot(x,y)>100)return;
    const angle=((Math.atan2(y,x)+Math.PI/2+2*Math.PI)%(2*Math.PI))/(2*Math.PI);
    const part=Math.min(denominator-1,Math.floor(angle*denominator));
    onSelect(part<numerator?part:part+1);
  };
  return <div className="lektrus-fraction-view">
    <div className="lektrus-fraction-heading"><strong>{title}</strong><span>{numerator} / {denominator} {summary!==`${numerator}/${denominator}`?`= ${summary}`:""}</span></div>
    <svg viewBox="0 0 360 250" role="img" aria-label={`Дробь ${numerator} из ${denominator}`}
      onClick={mode==="circle"?onCircleClick:onBarClick} style={{cursor:onSelect?"pointer":undefined}}>
      {mode==="circle"?<g>
        <circle cx="180" cy="125" r="100" fill="#f5f7fe"/>
        {numerator===denominator?<circle cx="180" cy="125" r="100" fill={color}/>:
          numerator>0&&<path d={`M180 125 L180 25 A100 100 0 ${proportion>.5?1:0} 1 ${endX} ${endY} Z`} fill={color}/>}
        {denominator<=120&&lines.map(i=>{
          const angle=-Math.PI/2+2*Math.PI*i/denominator;
          return <line key={i} x1="180" y1="125" x2={180+100*Math.cos(angle)} y2={125+100*Math.sin(angle)} stroke="white" strokeWidth={denominator>48?.65:1.4} pointerEvents="none"/>;
        })}
        <circle cx="180" cy="125" r="100" stroke="#4b6cbb" strokeWidth="2" fill="none" pointerEvents="none"/>
      </g>:<g>
        <rect x="22" y="86" width="316" height="80" fill="#f5f7fe"/>
        <rect x="22" y="86" width={316*proportion} height="80" fill={color}/>
        {denominator<=120&&lines.slice(1).map(i=><line key={i} x1={22+i*316/denominator} x2={22+i*316/denominator} y1="86" y2="166" stroke="white" strokeWidth="1" pointerEvents="none"/>)}
        <rect x="22" y="86" width="316" height="80" fill="none" stroke="#4b6cbb" strokeWidth="2" pointerEvents="none"/>
      </g>}
    </svg>
    <div className="lektrus-fraction-caption">{numerator} из {denominator} равных {mode==="circle"?"секторов":"частей"}{denominator>120?" · деления мельче масштаба":""}</div>
  </div>;
}

export default function LektrusFractionEditor({item,onSave,onCancel,onClose}:{
  item:Item;onSave:(data:FractionData)=>void;onCancel:()=>void;onClose:(data:FractionData)=>void;
}){
  const [draft,setDraft]=useState<FractionData>(()=>fractionFrom(item));
  const change=(next:Partial<FractionData>)=>setDraft(current=>({...current,...next}));
  const preview:Item={...item,text:draft.title,fractionMode:draft.mode,fractionNumerator:draft.numerator,fractionDenominator:draft.denominator};
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){e.stopPropagation();e.preventDefault();onClose(draft)}
    };
    document.addEventListener("keydown",onKey,true);
    return()=>document.removeEventListener("keydown",onKey,true);
  },[onCancel,onClose,draft]);
  return <div className="lektrus-fraction-overlay" onPointerDown={e=>{if(e.target===e.currentTarget)onClose(draft)}}>
    <div className="lektrus-fraction-dialog" role="dialog" aria-modal="true" aria-label="Редактор дробей" onPointerDown={e=>e.stopPropagation()}>
      <header><div><strong>Наглядные дроби</strong><small>Доли целого и сравнение дробей</small></div>
        <button type="button" aria-label="Закрыть" onClick={()=>onClose(draft)}>×</button></header>
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
              onChange={e=>change({numerator:Math.min(draft.denominator,normalizeCount(Number(e.target.value),0))})}/></label>
            <label>Знаменатель<input type="number" min="1" step="1" value={draft.denominator}
              onChange={e=>{const denominator=normalizeCount(Number(e.target.value),1);change({denominator,numerator:Math.min(draft.numerator,denominator)})}}/></label>
          </div>
          <small>Знаменатель определяет число равных частей, числитель показывает закрашенные части. Количество частей не ограничено; при большом числе делений они отображаются пропорционально без перегрузки редактора.</small>
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
