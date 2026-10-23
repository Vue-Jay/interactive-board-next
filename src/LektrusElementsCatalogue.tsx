import {useState,type ReactNode} from "react";
import type {ShapeType} from "./boardModel";
import type {SolidFigureId} from "./lektrusSolid3d";
import "./lektrusElementsCatalogue.css";

const twoD=[
 {name:"Основные",items:[
 ["rectangle","Прямоугольник"],["square","Квадрат"],["circle","Круг"],
 ["ellipse","Овал"],["rounded","Скруглённая"],["triangle","Треугольник"],
 ["rightTriangle","Прямоугольный"],["arrow","Стрелка"]
 ]},
 {name:"Многоугольники",items:[
 ["diamond","Ромб"],["parallelogram","Параллелограмм"],["trapezoid","Трапеция"],
 ["pentagon","Пятиугольник"],["hexagon","Шестиугольник"],["star","Звезда"]
 ]}
] as const satisfies ReadonlyArray<{name:string;items:readonly (readonly [ShapeType,string])[]}>;
const threeD=[
 {name:"Призмы и пирамиды",items:[
 ["cube","Куб"],["rectangular-prism","Параллелепипед"],["prism","Призма"],
 ["pyramid","Пирамида"],["triangular-pyramid","Треугольная пирамида"]
 ]},
 {name:"Тела вращения",items:[
 ["sphere","Сфера"],["cylinder","Цилиндр"],["cone","Конус"]
 ]}
] as const satisfies ReadonlyArray<{name:string;items:readonly (readonly [SolidFigureId,string])[]}>;
const symbolGroups=[
 {title:"Математика",glyphs:["±","×","÷","≈","≠","≤","≥","∞","√","∑","∫","∂","π","Δ","∈","∉","∩","∪","⊂","∠","°","‰","∝","∅"]},
 {title:"Стрелки и связи",glyphs:["→","←","↔","↑","↓","⇒","⇔","↗","↘","⇑","⇓","↦","↩","⇢","⟶","↪"]},
 {title:"Физика и химия",glyphs:["α","β","γ","λ","μ","ν","ρ","σ","Ω","θ","φ","τ","ħ","℃","℉","ℓ","⇌","↑","↓","⊕","⊖"]},
 {title:"Текст и знаки",glyphs:["§","№","©","®","™","•","·","—","–","«","»","“","”","✓","✗","★","●","○","■","□","☐","☑"]}
] as const;

function ShapeGlyph({name,solid}:{name:string;solid:boolean}){
 if(solid){
  if(name==="sphere")return <svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="11"/><ellipse cx="16" cy="16" rx="5" ry="11"/><path d="M5 16h22"/></svg>;
  if(name==="cylinder")return <svg viewBox="0 0 32 32"><ellipse cx="16" cy="8" rx="10" ry="4"/><path d="M6 8v16c0 6 20 6 20 0V8M6 24c0-5 20-5 20 0" strokeDasharray="3 3"/></svg>;
  if(name==="cone")return <svg viewBox="0 0 32 32"><ellipse cx="16" cy="25" rx="11" ry="4"/><path d="M5 25 16 4 27 25"/></svg>;
  if(name.includes("pyramid"))return <svg viewBox="0 0 32 32"><path d="m4 23 11 5 13-6L17 4Z M17 4 15 28M4 23l24-1"/></svg>;
  return <svg viewBox="0 0 32 32"><path d="M6 11 16 5l11 6-11 6zM6 11v13l10 5 11-6V11M16 17v12"/></svg>;
 }
 if(name==="circle"||name==="ellipse")return <svg viewBox="0 0 32 32"><ellipse cx="16" cy="16" rx={name==="circle"?11:13} ry={name==="circle"?11:8}/></svg>;
 if(name==="triangle"||name==="rightTriangle")return <svg viewBox="0 0 32 32"><path d={name==="triangle"?"M16 4 29 27H3Z":"M5 5V27H28Z"}/></svg>;
 if(name==="diamond")return <svg viewBox="0 0 32 32"><path d="M16 3 29 16 16 29 3 16Z"/></svg>;
 if(name==="star")return <svg viewBox="0 0 32 32"><path d="m16 3 4 9 10 1-8 7 2 10-8-5-8 5 2-10-8-7 10-1Z"/></svg>;
 if(name==="arrow")return <svg viewBox="0 0 32 32"><path d="M4 16h23m-9-9 9 9-9 9"/></svg>;
 if(name==="rounded"||name==="rectangle"||name==="square")return <svg viewBox="0 0 32 32"><rect x={name==="rectangle"?3:6} y={name==="rectangle"?8:6} width={name==="rectangle"?26:20} height={name==="rectangle"?16:20} rx={name==="rounded"?7:1}/></svg>;
 if(name==="trapezoid")return <svg viewBox="0 0 32 32"><path d="M10 6h13l7 20H3Z"/></svg>;
 if(name==="parallelogram")return <svg viewBox="0 0 32 32"><path d="M11 6h19l-9 20H2Z"/></svg>;
 const n=name==="pentagon"?5:6,r=12;const pts=Array.from({length:n},(_,i)=>[16+r*Math.cos(i*Math.PI*2/n-Math.PI/2),16+r*Math.sin(i*Math.PI*2/n-Math.PI/2)]);return <svg viewBox="0 0 32 32"><polygon points={pts.map(p=>p.join(",")).join(" ")}/></svg>;
}

export default function LektrusElementsCatalogue({onTool,onShape,onSolid,onChart,onSymbol,renderIcon}:{
 onTool:(id:"text"|"sticky"|"table"|"frame"|"connector")=>void;
 onShape:(id:ShapeType)=>void;
 onSolid:(id:SolidFigureId)=>void;
 onChart:()=>void;
 onSymbol:(symbol:string)=>void;
 renderIcon:(id:"text"|"sticky"|"table"|"frame"|"connector")=>ReactNode;
}){
 const [dimension,setDimension]=useState<"2D"|"3D">("2D");
 const [symbolsOpen,setSymbolsOpen]=useState(false);
 const [symbolGroup,setSymbolGroup]=useState(0);
 const [connector,setConnector]=useState<"line"|"arrow"|"double">("arrow");
 return <div className="lektrus-elements-catalogue">
   <div className="lektrus-elements-hint">Текст, рисунки, объёмные модели, диаграммы и другие элементы доски</div>
   <section className="lektrus-elements-section">
     <h3>Текст и оформление</h3>
     <div className="lektrus-elements-quick">
       {(["text","sticky","table","frame"] as const).map(id=><button type="button" key={id} onClick={()=>onTool(id)}><span className="lektrus-elements-quick-icon">{renderIcon(id)}</span><span>{{text:"Текст",sticky:"Стикер",table:"Таблица",frame:"Фрейм"}[id]}</span></button>)}
       <button type="button" className={symbolsOpen?"active":""} onClick={()=>setSymbolsOpen(x=>!x)} aria-expanded={symbolsOpen}><span className="lektrus-elements-quick-icon">Ω</span><span>Спецсимволы</span></button>
     </div>
     {symbolsOpen&&<div className="lektrus-elements-symbols">
       <div className="lektrus-elements-symbol-tabs">{symbolGroups.map((g,i)=><button key={g.title} aria-pressed={symbolGroup===i} className={symbolGroup===i?"active":""} onClick={()=>setSymbolGroup(i)}>{g.title}</button>)}</div>
       <div className="lektrus-elements-symbol-grid">{symbolGroups[symbolGroup].glyphs.map((value,i)=><button type="button" key={value+i} title={`Добавить символ ${value}`} onClick={()=>onSymbol(value)}>{value}</button>)}</div>
     </div>}
   </section>
   <section className="lektrus-elements-section">
     <div className="lektrus-elements-heading"><h3>Фигуры</h3><div className="lektrus-elements-switch" role="group" aria-label="Плоские и объёмные фигуры">{(["2D","3D"] as const).map(id=><button type="button" key={id} aria-pressed={dimension===id} className={dimension===id?"active":""} onClick={()=>setDimension(id)}>{id}</button>)}</div></div>
     {(dimension==="2D"?twoD:threeD).map(group=><div key={group.name} className="lektrus-elements-shape-group">
       <h4>{group.name}</h4>
       <div className="lektrus-elements-shape-grid">{dimension==="2D"?twoD.find(g=>g.name===group.name)?.items.map(([id,label])=><button type="button" key={id} title={label} onClick={()=>onShape(id)}><ShapeGlyph name={id} solid={false}/><span>{label}</span></button>):threeD.find(g=>g.name===group.name)?.items.map(([id,label])=><button type="button" key={id} title={label} onClick={()=>onSolid(id)}><ShapeGlyph name={id} solid/><span>{label}</span></button>)}</div>
     </div>)}
   </section>
   <section className="lektrus-elements-section">
     <h3>Диаграммы</h3>
     <button className="lektrus-elements-chart-button" type="button" onClick={onChart}>
       <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 27V17h5v10M14 27V10h5v17M23 27V5h5v22" fill="#7697e2" stroke="#416aba" strokeWidth="1.7"/></svg>
       <span><strong>Создать диаграмму</strong><small>Столбчатая, линейная или круговая</small></span>
     </button>
   </section>
   <section className="lektrus-elements-section">
     <h3>Линии и соединения</h3>
     <div className="lektrus-elements-arrow-row">{(["line","arrow","double"] as const).map(type=><button type="button" key={type} className={connector===type?"active":""} onClick={()=>{setConnector(type);onTool("connector")}}><span>{type==="line"?"━":type==="arrow"?"⟶":"⟷"}</span><small>{type==="line"?"Линия":type==="arrow"?"Стрелка":"Двусторонняя"}</small></button>)}</div>
   </section>
 </div>;
}
