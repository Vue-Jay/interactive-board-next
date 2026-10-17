import {periodicElements,periodicFamilies,type ElementFamily} from "./lektrusPeriodicElements";
import {elementFacts} from "./lektrusElementFacts";
type Props={
 selected?:number[];active?:number|null;showNames?:boolean;
 familyFilter?:ElementFamily|"all";onPick?:(number:number)=>void;
};
const bx=45,by=68,step=54,cell=49;
const colors=Object.fromEntries(periodicFamilies.map(f=>[f.id,f.color])) as Record<ElementFamily,string>;
const mass=(n:number)=>elementFacts[n-1]?.atomicMass?.replace(/\(\d+\)/g,"").replace(/[\[\]]/g,"")??"";
export default function LektrusPeriodicTableView({
 selected=[],active=null,showNames=true,familyFilter="all",onPick
}:Props){
 const marked=new Set(selected);
 return <svg className="lektrus-periodic-svg" viewBox="0 0 1080 601"
   preserveAspectRatio="xMidYMid meet" role="img"
   aria-label="Интерактивная периодическая таблица 118 химических элементов">
  <rect x="0" y="0" width="1080" height="601" rx="10" fill="#f9fbff"/>
  <text x={bx} y="30" className="lektrus-periodic-heading">Периодическая система химических элементов</text>
  {Array.from({length:18},(_,i)=><text key={i} className="lektrus-periodic-index"
    x={bx+i*step+cell/2} y={55} textAnchor="middle">{i+1}</text>)}
  {Array.from({length:7},(_,i)=><text key={i} className="lektrus-periodic-index"
    x="23" y={by+i*step+28} textAnchor="middle">{i+1}</text>)}
  <text x="45" y="470" className="lektrus-periodic-lanthanoid-label">Лантаноиды</text>
  <text x="45" y="527" className="lektrus-periodic-lanthanoid-label">Актиноиды</text>
  {[{period:6,label:"57–71"},{period:7,label:"89–103"}].map(v=>{
    const x=bx+2*step,y=by+(v.period-1)*step;
    return <g key={v.period} opacity=".7">
      <rect x={x} y={y} width={cell} height={cell} rx="5" fill="#f0e2f6" stroke="#decce8"/>
      <text x={x+cell/2} y={y+27} fontSize="9" textAnchor="middle" fill="#745b86">{v.label}</text>
    </g>;
  })}
  {periodicElements.map(el=>{
    const x=bx+(el.col-1)*step;
    const y=el.row<=7?by+(el.row-1)*step:el.row===9?480:535;
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
      <text x={x+cell/2} y={y+46} fontSize="7.5" fontWeight="650" textAnchor="middle"
        textLength={Math.min(41,Math.max(14,readableMass.length*4))}
        lengthAdjust="spacingAndGlyphs" fill="#54708d">{readableMass}</text>
      {chosen&&<circle cx={x+44} cy={y+5} r="3" fill="#2d60c8"/>}
    </g>;
  })}
  <text x="47" y="597" fontSize="10" fill="#8a9bb0">Z · символ · название · относительная атомная масса</text>
 </svg>;
}
