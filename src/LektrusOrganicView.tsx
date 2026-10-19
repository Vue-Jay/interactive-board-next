import type {Item} from "./boardModel";
import {analyzeOrganicStructure,organicAtomColor} from "./lektrusOrganicFormula";
const W=560,H=390,U=32;
export default function LektrusOrganicView({item}:{item:Item}){
 const points=item.graphPoints??[],links=item.graphSegments??[];
 const formula=analyzeOrganicStructure(item);
 const xy=(p:{x:number;y:number})=>({x:W/2+p.x*U,y:H/2-p.y*U});
 return <div className="lektrus-organic-board-view">
  <div className="lektrus-organic-board-caption"><strong>{item.text}</strong>
   {formula.valid&&<span>{formula.formula.replace(/[0-9]/g,d=>"₀₁₂₃₄₅₆₇₈₉"[Number(d)])}</span>}</div>
  <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={"Структурная формула "+item.text}>
   <rect width={W} height={H} fill="#fff"/>
   {links.map((edge,i)=>{
    const a=points[edge.a],b=points[edge.b];if(!a||!b)return null;
    const p=xy(a),q=xy(b),distance=Math.hypot(q.x-p.x,q.y-p.y)||1;
    return <g key={i}>{Array.from({length:edge.bondOrder??1},(_,k)=>{
     const off=(k-((edge.bondOrder??1)-1)/2)*5;
     const nx=-(q.y-p.y)/distance*off,ny=(q.x-p.x)/distance*off;
     return <line key={k} x1={p.x+nx} y1={p.y+ny} x2={q.x+nx} y2={q.y+ny}
      stroke="#3b526a" strokeWidth="2.8" strokeLinecap="round"/>;
    })}</g>;
   })}
   {points.map((p,i)=>p.label!=="C"&&<g key={i} transform={`translate(${xy(p).x} ${xy(p).y})`}>
    <rect x={-Math.max(9,p.label.length*5)} y="-11" width={Math.max(18,p.label.length*10)} height="23" rx="4" fill="#fff"/>
    <text x="0" y="5" textAnchor="middle" fontSize="17" fontWeight="750"
     fill={organicAtomColor(p.label)}>{p.label}</text>
   </g>)}
  </svg>
 </div>;
}
