import type {LabBench} from "./lektrusChemistryBenchModel";
import {dripLabTitration,restartLabTitration,setLabTitration} from "./lektrusChemistryBenchModel";
import {defaultTitration,titrationEquation,titrationReading,updateTitration,type TitrationModel} from "./lektrusLabTitration";
type Props={bench:LabBench;onChange?:(bench:LabBench)=>void};
const fmt=(n:number)=>n.toLocaleString("ru-RU",{maximumFractionDigits:2});
export default function LektrusLabTitrationPanel({bench,onChange}:Props){
 const t=bench.titration??defaultTitration(),r=titrationReading(t);
 const change=(next:TitrationModel)=>{if(onChange)onChange(setLabTitration(bench,next))};
 const adjust=(ml:number)=>{if(onChange)onChange(dripLabTitration(bench,ml))};
 const setNumber=(key:"concentrationAnalyte"|"concentrationTitrant"|"volumeAnalyteMl",value:string)=>{
  if(value.trim()==="")return;
  change(updateTitration(t,{[key]:Number(value)}));
 };
 const points=Array.from({length:101},(_,i)=>{
  const v=i;
  const p=titrationReading({...t,addedMl:v}).pH;
  return `${Math.round(36+v*3.05)},${Math.round(174-p*10.1)}`;
 }).join(" ");
 return <div className="lektrus-lab-titration">
  <div className="lektrus-lab-titration-lead">
   <strong>Кислотно-основное титрование</strong>
   <span>Учебная модель сильной одноосновной кислоты и сильного основания при 25 °C</span>
  </div>
  <div className="lektrus-lab-titration-grid">
   <div className="lektrus-lab-titration-config">
    <label>Кислота
     <select value={t.acid} onChange={e=>change(updateTitration(t,{acid:e.target.value as TitrationModel["acid"]}))}>
      <option value="HCl">HCl · соляная</option><option value="HNO3">HNO₃ · азотная</option>
      <option value="HBr">HBr · бромоводородная</option>
     </select></label>
    <label>Основание
     <select value={t.base} onChange={e=>change(updateTitration(t,{base:e.target.value as TitrationModel["base"]}))}>
      <option value="NaOH">NaOH · гидроксид натрия</option>
      <option value="KOH">KOH · гидроксид калия</option>
     </select></label>
    <label>Что находится в колбе
     <select value={t.analyte} onChange={e=>change(updateTitration(t,{analyte:e.target.value as TitrationModel["analyte"]}))}>
      <option value="acid">Кислота, в бюретке щёлочь</option>
      <option value="base">Щёлочь, в бюретке кислота</option>
     </select></label>
    <div className="lektrus-lab-titration-numbers">
     <label>Объём в колбе, мл
      <input type="number" min="1" max="100" step=".5" value={t.volumeAnalyteMl}
       onChange={e=>setNumber("volumeAnalyteMl",e.target.value)}/></label>
     <label>С₁, моль/л
      <input type="number" min=".001" max="2" step=".01" value={t.concentrationAnalyte}
       onChange={e=>setNumber("concentrationAnalyte",e.target.value)}/></label>
     <label>С₂, моль/л
      <input type="number" min=".001" max="2" step=".01" value={t.concentrationTitrant}
       onChange={e=>setNumber("concentrationTitrant",e.target.value)}/></label>
    </div>
    <label>Индикатор
     <select value={t.indicator} onChange={e=>change(updateTitration(t,{
      indicator:e.target.value as TitrationModel["indicator"]}))}>
      <option value="phenolphthalein">Фенолфталеин</option>
      <option value="methyl-orange">Метилоранж</option>
      <option value="litmus">Лакмус</option>
      <option value="universal">Универсальный</option>
     </select></label>
   </div>
   <div className="lektrus-lab-titration-stage">
    <svg viewBox="0 0 280 250" role="img"
     aria-label={"Бюретка и коническая колба, добавлено "+fmt(t.addedMl)+" мл"}>
     <defs>
      <linearGradient id="lektrus-titration-glass" x1="0" y1="0" x2="1" y2="0">
       <stop stopColor="#d5edf0" stopOpacity=".85"/><stop offset=".44" stopColor="#fff" stopOpacity=".2"/>
       <stop offset="1" stopColor="#b4d6d2" stopOpacity=".6"/>
      </linearGradient>
     </defs>
     <path d="M45 9V232" stroke="#7c9e97" strokeWidth="6" strokeLinecap="round"/>
     <path d="M30 230H83" stroke="#819e98" strokeWidth="8" strokeLinecap="round"/>
     <path d="M47 30H128" stroke="#75998f" strokeWidth="4" strokeLinecap="round"/>
     <path d="M114 18H140V166H114Z" fill="url(#lektrus-titration-glass)" stroke="#669a9a" strokeWidth="2"/>
     <rect x="116" y={20+Math.min(100,t.addedMl)*1.44} width="22"
      height={Math.max(0,143-Math.min(100,t.addedMl)*1.44)} fill="#8bb7d5" opacity=".67"/>
     {Array.from({length:11},(_,i)=><path key={i} d={`M 115 ${25+i*13} h${i%2?7:12}`}
      stroke="#568c89" strokeWidth="1.3"/>)}
     <path d="M127 165v18" stroke="#598e8c" strokeWidth="5" strokeLinecap="round"/>
     <path d="M115 171h24" stroke="#416d69" strokeWidth="4" strokeLinecap="round"/>
     <circle cx="127" cy="174" r="5" fill="#e5f4f0" stroke="#719c94"/>
     {t.addedMl>0&&<path className="lektrus-lab-titration-drop" d="M127 183v10" stroke="#81bee5"
      strokeWidth="3" strokeLinecap="round"/>}
     <path d="M105 192H149V210L166 236Q168 242 158 242H96Q86 242 88 236L105 210Z"
      fill="url(#lektrus-titration-glass)" stroke="#669798" strokeWidth="3"/>
     <path d="M97 227H157L162 238H92Z" fill={r.tint} opacity=".85"
      style={{transition:"fill .4s"}}/>
     <path d="M110 198H144" stroke="#f8fffd" strokeWidth="2"/>
     <text x="196" y="38" fontSize="11" fill="#457466" fontWeight="700">Бюретка</text>
     <text x="196" y="54" fontSize="13" fill="#285d52">{fmt(t.addedMl)} мл</text>
     <text x="173" y="218" fontSize="11" fill="#457466">Индикатор</text>
     <circle cx="204" cy="235" r="7" fill={r.tint} stroke="#aec8c0" strokeWidth="1"/>
    </svg>
    <div className="lektrus-lab-titration-add">
     <span>Добавить из бюретки</span>
     <div>
      {[.1,1,5].map(ml=><button type="button" key={ml}
       disabled={t.addedMl>=100} onClick={()=>adjust(ml)}>+{fmt(ml)} мл</button>)}
      <button type="button" className="secondary" onClick={()=>{
       if(onChange)onChange(restartLabTitration(bench))}}>Сброс</button>
     </div>
    </div>
   </div>
  </div>
  <div className="lektrus-lab-titration-results" aria-live="polite">
   <div><span>Введено</span><strong>{fmt(t.addedMl)} мл</strong></div>
   <div><span>Расчётный pH</span><strong>{fmt(r.pH)}</strong></div>
   <div><span>Эквивалентный объём</span><strong>{fmt(r.endPointMl)} мл</strong></div>
   <div><span>Среда</span><strong>{r.phase==="acidic"?"Кислая":r.phase==="alkaline"?"Щелочная":"Эквивалентность"}</strong></div>
  </div>
  <div className="lektrus-lab-titration-curve">
   <strong>Кривая титрования</strong>
   <svg viewBox="0 0 370 200" role="img" aria-label="Расчётная зависимость pH от объёма добавленного титранта">
    {Array.from({length:8},(_,i)=><g key={i}>
     <path d={`M 36 ${174-i*20} H 342`} stroke="#e2eee6" strokeWidth="1"/>
     <text x="6" y={178-i*20} fontSize="10" fill="#6b9380">{i*2}</text>
    </g>)}
    <path d="M36 17V174H344" fill="none" stroke="#92b9a5" strokeWidth="2"/>
    <polyline points={points} fill="none" stroke="#32926c" strokeWidth="2.5"
     strokeLinecap="round" strokeLinejoin="round"/>
    <path d={`M ${36+3.05*t.addedMl} 17V174`} stroke="#b18c62"
     strokeDasharray="4 3"/>
    <circle cx={36+3.05*t.addedMl} cy={174-r.pH*10.1} r="4.5"
     fill="#277a59" stroke="#fff" strokeWidth="2"/>
    <text x="167" y="195" fontSize="10" fill="#4c7d69">Объём титранта, мл (0–100)</text>
   </svg>
  </div>
  <div className="lektrus-lab-titration-foot">
   <strong>{titrationEquation(t)}</strong>
   <span>Идеализированный расчёт для сильной одноосновной кислоты и сильного основания. Цвет индикатора приблизительный. Точка эквивалентности не всегда совпадает с наблюдаемой точкой конца титрования. Результат не распространяется на неизвестные смеси.</span>
  </div>
 </div>;
}
