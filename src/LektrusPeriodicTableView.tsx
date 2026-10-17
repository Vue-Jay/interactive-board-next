import {periodicElements,periodicFamilies,type ElementFamily} from "./lektrusPeriodicElements";
import {elementFacts} from "./lektrusElementFacts";
import LektrusElementInfo from "./LektrusElementInfo";
type Props={
 selected?:number[];active?:number|null;showNames?:boolean;
 familyFilter?:ElementFamily|"all";onPick?:(number:number)=>void;
 layout?:"school"|"long";showInfo?:boolean;onCloseInfo?:()=>void;onToggleInfo?:()=>void;
};
const bx=45,by=68,step=54,cell=49;
const colors=Object.fromEntries(periodicFamilies.map(f=>[f.id,f.color])) as Record<ElementFamily,string>;
const mass=(n:number)=>elementFacts[n-1]?.atomicMass?.replace(/\(\d+\)/g,"").replace(/[\[\]]/g,"")??"";
export default function LektrusPeriodicTableView({
 selected=[],active=null,showNames=true,familyFilter="all",onPick,layout="school",showInfo=false,onCloseInfo,onToggleInfo
}:Props){
 const marked=new Set(selected);
 const school=layout==="school";
 const schoolColumn=(col:number)=>col<=2?col===1?0:2:col>=13?col===18?17:4+(col-13)*2:col<=10?col+1:col===11?0:2;
 const schoolRow=(el:(typeof periodicElements)[number])=>el.period<=3?el.period-1:3+(el.period-4)*2;
 return <svg className="lektrus-periodic-svg" viewBox={school?"0 0 1080 795":"0 0 1080 660"}
   preserveAspectRatio="xMidYMid meet" role="img"
   aria-label="Интерактивная периодическая таблица 118 химических элементов">
  <rect x="0" y="0" width="1080" height={school?795:660} rx="10" fill="#f9fbff"/>
  <text x={bx} y="30" className="lektrus-periodic-heading">Периодическая система химических элементов</text>
  {Array.from({length:school?8:18},(_,i)=><text key={i} className="lektrus-periodic-index"
    x={bx+(school?[0,2,4,6,8,10,12,17][i]:i)*step+cell/2} y={55} textAnchor="middle">{school?["I","II","III","IV","V","VI","VII","VIII"][i]:i+1}</text>)}
  {Array.from({length:7},(_,i)=><text key={i} className="lektrus-periodic-index"
    x="23" y={school?by+(i<=2?i:3+(i-3)*2)*step+28:by+i*step+28} textAnchor="middle">{i+1}</text>)}
  {school&&Array.from({length:4},(_,i)=><g key={"subgroup-"+i}>
    <text x="8" y={by+(3+i*2)*step+12} fontSize="9" fill="#7485a2">А</text>
    <text x="8" y={by+(4+i*2)*step+12} fontSize="9" fill="#7485a2">Б</text>
  </g>)}
  <text x="45" y={school?657:470} className="lektrus-periodic-lanthanoid-label">Лантаноиды</text>
  <text x="45" y={school?711:527} className="lektrus-periodic-lanthanoid-label">Актиноиды</text>
  {!school&&[{period:6,label:"57–71"},{period:7,label:"89–103"}].map(v=>{
    const x=bx+2*step,y=by+(v.period-1)*step;
    return <g key={v.period} opacity=".7">
      <rect x={x} y={y} width={cell} height={cell} rx="5" fill="#f0e2f6" stroke="#decce8"/>
      <text x={x+cell/2} y={y+27} fontSize="9" textAnchor="middle" fill="#745b86">{v.label}</text>
    </g>;
  })}
  {periodicElements.map(el=>{
    const subgroupB=school&&el.col>=3&&el.col<=12&&el.row<=7;
    const x=school?(el.row>=9?bx+(el.col-3)*step:bx+schoolColumn(el.col)*step):bx+(el.col-1)*step;
    const y=school?(el.row>=9?(el.row===9?662:716):by+(schoolRow(el)+(subgroupB?1:0))*step):el.row<=7?by+(el.row-1)*step:el.row===9?480:535;
    const chosen=marked.has(el.number),focused=el.number===active;
    const dim=familyFilter!=="all"&&familyFilter!==el.family&&!chosen;
    const compactMass=mass(el.number);
    const readableMass=compactMass.length>8?Number(compactMass).toPrecision(5):compactMass;
    return <g key={el.number}
      className={"lektrus-periodic-cell"+(onPick?" interactive":"")+(chosen?" selected":"")+
        (focused?" focused":"")+(dim?" dimmed":"")}
      role={onPick?"button":undefined} tabIndex={onPick?0:undefined}
      aria-label={el.number+". "+el.name+" ("+el.symbol+"), масса "+compactMass}
      onPointerDown={onPick?e=>e.stopPropagation():undefined}
      onClick={onPick?e=>{e.stopPropagation();onPick(el.number)}:undefined}
      onKeyDown={onPick?e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();onPick(el.number)}}:undefined}>
      <title>{el.number+". "+el.name+" ("+el.symbol+"), Ar ≈ "+compactMass}</title>
      <rect x={x} y={y} width={cell} height={cell} rx="5"
        stroke={chosen?"#2d60c8":focused?"#5b82b9":"#c5d4e7"}
        strokeWidth={chosen?2.4:focused?1.75:.8} fill={colors[el.family]}/>
      <text x={x+4} y={y+9.5} fontSize="8.5" fontWeight="750" fill="#415d80">{el.number}</text>
      <text x={x+cell/2} y={y+27} fontSize="19" textAnchor="middle"
        fontWeight="730" fill="#1d3558">{el.symbol}</text>
      {showNames&&<text x={x+cell/2} y={y+37.1} fontSize="7.5"
        textAnchor="middle" textLength={Math.min(44,Math.max(15,el.name.length*4.1))}
        lengthAdjust="spacingAndGlyphs" fill="#4c6483">{el.name}</text>}
      {<text x={x+cell/2} y={y+46} fontSize="7.5" fontWeight="650" textAnchor="middle"
        textLength={Math.min(41,Math.max(14,readableMass.length*4))}
        lengthAdjust="spacingAndGlyphs" fill="#54708d">{readableMass}</text>}
      {chosen&&<circle cx={x+44} cy={y+5} r="3" fill="#2d60c8"/>}
    </g>;
  })}
  <text x="47" y={school?790:655} fontSize="10" fill="#8a9bb0">Z · символ · название · относительная атомная масса</text>
 </svg>;
}
