import {useMemo,useState} from "react";
import type {Item} from "./boardModel";
import "./lektrusDataChart.css";

export type ChartStyle="bar"|"line"|"pie";
export type ChartDatum={label:string;value:number};
export const chartPalette=["#4774d7","#49a4a3","#e6a54d","#9568d9","#d87786","#5896e4","#86aa59","#9e85c5","#ce8758","#53a0a0"];
export const emptyChartData=():ChartDatum[]=>[{label:"",value:0},{label:"",value:0},{label:"",value:0}];
export const validChartData=(entries:unknown):entries is ChartDatum[]=>Array.isArray(entries)&&entries.length>=1&&entries.length<=12&&entries.every(v=>!!v&&typeof v==="object"&&typeof v.label==="string"&&v.label.length<=80&&typeof v.value==="number"&&Number.isFinite(v.value)&&v.value>=0&&v.value<=1e9);
export const chartDataFor=(item:Item):ChartDatum[]=>validChartData(item.chartEntries)?item.chartEntries:[];
export const chartStyleFor=(item:Item):ChartStyle=>item.chartStyle==="line"||item.chartStyle==="pie"?item.chartStyle:"bar";

const format=(value:number)=>Number.isInteger(value)?value.toLocaleString("ru-RU"):value.toLocaleString("ru-RU",{maximumFractionDigits:2});
export function LektrusDataChartView({item}:{item:Item}){
 const entries=chartDataFor(item).filter(x=>x.label.trim());
 const type=chartStyleFor(item);
 const sum=entries.reduce((s,e)=>s+e.value,0);
 const max=Math.max(1,...entries.map(e=>e.value));
 const plot={left:55,right:510,top:35,bottom:277};
 const w=plot.right-plot.left,h=plot.bottom-plot.top;
 const ticks=Array.from({length:5},(_,i)=>max*i/4);
 const points=entries.map((entry,i)=>({x:plot.left+(i+.5)*w/Math.max(1,entries.length),y:plot.bottom-entry.value/max*h}));
 let angle=-Math.PI/2;
 return <div className="lektrus-data-chart" role="img" aria-label={item.text+": "+entries.map(e=>e.label+" "+format(e.value)).join(", ")}>
  <div className="lektrus-data-chart-title">{item.text||"Диаграмма"}</div>
  {entries.length===0?<div className="lektrus-data-chart-empty">Введите данные в редакторе диаграммы</div>:<svg className="lektrus-data-chart-svg" viewBox="0 0 560 325" preserveAspectRatio="xMidYMid meet">
   {type==="pie"?<>
     <g transform="translate(175 158)">
       {sum>0?entries.map((entry,i)=>{
         const sweep=entry.value/sum*2*Math.PI, start=angle;angle+=sweep;
         const end=angle;const sx=110*Math.cos(start),sy=110*Math.sin(start),ex=110*Math.cos(end),ey=110*Math.sin(end);
         const path=sweep>=2*Math.PI-1e-8?"M 0 -110 A 110 110 0 1 1 0 110 A 110 110 0 1 1 0 -110 Z":
           `M 0 0 L ${sx} ${sy} A 110 110 0 ${sweep>Math.PI?1:0} 1 ${ex} ${ey} Z`;
         return sweep>0?<path key={i} d={path} fill={chartPalette[i%chartPalette.length]} stroke="#fff" strokeWidth="2.5"><title>{entry.label}: {format(entry.value)} ({(entry.value/sum*100).toFixed(1)}%)</title></path>:null;
       }):<circle r="105" fill="#e5eafa"/>}
     </g>
     <g transform="translate(324 65)">
       {entries.map((entry,i)=><g key={i} transform={`translate(0 ${i*24})`}>
         <rect width="12" height="12" rx="3" fill={chartPalette[i%chartPalette.length]}/>
         <text x="19" y="11" fill="#34435e" fontSize="11" fontWeight="600">{entry.label.slice(0,22)} · {sum?Math.round(entry.value/sum*100):0}%</text>
       </g>)}
     </g>
   </>:<>
     {ticks.map((v,i)=>{const y=plot.bottom-i/4*h;return <g key={i}><line x1={plot.left} x2={plot.right} y1={y} y2={y} stroke="#e1e8f4" strokeDasharray={i?"3 4":undefined}/><text x={plot.left-9} y={y+4} textAnchor="end" fontSize="11" fill="#8290a6">{format(v)}</text></g>})}
     {type==="bar"?entries.map((entry,i)=>{
       const slot=w/entries.length,barW=Math.min(68,slot*.65),x=plot.left+i*slot+(slot-barW)/2;
       return <g key={i}><rect x={x} y={points[i].y} width={barW} height={Math.max(0,plot.bottom-points[i].y)} rx="5" fill={chartPalette[i%chartPalette.length]}/><title>{entry.label}: {format(entry.value)}</title></g>
     }):<>
       {points.length>1&&<polyline fill="none" stroke="#4774d7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={points.map(p=>`${p.x},${p.y}`).join(" ")}/>}
       {points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="6" fill={chartPalette[i%chartPalette.length]} stroke="#fff" strokeWidth="2"><title>{entries[i].label}: {format(entries[i].value)}</title></circle>)}
     </>}
     {entries.map((entry,i)=><text key={i} x={points[i].x} y={299} textAnchor="middle" fontSize="11" fill="#425571">{entry.label.length>13?entry.label.slice(0,12)+"…":entry.label}</text>)}
   </>}
  </svg>}
 </div>;
}

export function LektrusDataChartEditor({item,onSave,onClose}:{item:Item;onSave:(next:Item)=>void;onClose:()=>void}){
 const [title,setTitle]=useState(item.text||"");
 const [kind,setKind]=useState<ChartStyle>(chartStyleFor(item));
 const [rows,setRows]=useState<ChartDatum[]>(()=>chartDataFor(item).map(e=>({...e})).length?chartDataFor(item).map(e=>({...e})):emptyChartData());
 const [error,setError]=useState("");
 const preview=useMemo<Item>(()=>({...item,text:title||"Диаграмма",chartStyle:kind,chartEntries:rows}),[item,title,kind,rows]);
 const update=(index:number,patch:Partial<ChartDatum>)=>setRows(current=>current.map((v,i)=>i===index?{...v,...patch}:v));
 const save=()=>{
   const actual=rows.filter(r=>r.label.trim());
   if(!title.trim()){setError("Укажите название диаграммы");return}
   if(!actual.length||actual.some(x=>!Number.isFinite(x.value)||x.value<0)||!actual.some(x=>x.value>0)){setError("Заполните хотя бы одну категорию с положительным значением");return}
   onSave({...item,text:title.trim().slice(0,100),chartStyle:kind,chartEntries:actual.map(r=>({label:r.label.trim().slice(0,80),value:Math.min(1e9,r.value)}))});
 };
 return <div className="lektrus-data-chart-overlay" role="presentation" onPointerDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className="lektrus-data-chart-dialog" role="dialog" aria-modal="true" aria-label="Редактор диаграммы" onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();onClose()}}}>
   <header className="lektrus-data-chart-head"><div><strong>Диаграмма</strong><small>Данные и оформление перед размещением на доске</small></div><button type="button" onClick={onClose} title="Отмена без сохранения">×</button></header>
   <div className="lektrus-data-chart-editor-body">
    <section className="lektrus-data-chart-settings">
      <label>Название<input autoFocus value={title} placeholder="Название диаграммы" maxLength={100} onChange={e=>setTitle(e.target.value)}/></label>
      <div className="lektrus-data-chart-types" role="group" aria-label="Тип диаграммы">
        {([["bar","Столбцы"],["line","Линия"],["pie","Круговая"]] as const).map(([id,label])=><button key={id} type="button" aria-pressed={kind===id} className={kind===id?"active":""} onClick={()=>setKind(id)}>{label}</button>)}
      </div>
      <strong className="lektrus-data-chart-subtitle">Категории и значения</strong>
      <div className="lektrus-data-chart-rows">{rows.map((row,i)=><div className="lektrus-data-chart-row" key={i}>
        <span className="lektrus-data-chart-swatch" style={{background:chartPalette[i%chartPalette.length]}}/>
        <input aria-label={`Категория ${i+1}`} placeholder="Название" maxLength={80} value={row.label} onChange={e=>update(i,{label:e.target.value})}/>
        <input aria-label={`Значение ${i+1}`} type="number" min={0} max={1e9} step="any" value={row.value} onChange={e=>update(i,{value:Math.max(0,Math.min(1e9,Number(e.target.value)||0))})}/>
        <button type="button" disabled={rows.length<=1} onClick={()=>setRows(x=>x.filter((_,j)=>i!==j))} aria-label="Удалить строку">×</button>
      </div>)}</div>
      <button className="lektrus-data-chart-add" type="button" disabled={rows.length>=12} onClick={()=>setRows(x=>[...x,{label:"",value:0}])}>+ Добавить категорию</button>
      {error&&<p role="alert" className="lektrus-data-chart-error">{error}</p>}
    </section>
    <section className="lektrus-data-chart-preview"><span>Предпросмотр</span><LektrusDataChartView item={preview}/></section>
   </div>
   <footer><button type="button" className="secondary" onClick={onClose}>Отмена</button><button type="button" className="primary" onClick={save}>Сохранить на доску</button></footer>
  </div>
 </div>;
}
