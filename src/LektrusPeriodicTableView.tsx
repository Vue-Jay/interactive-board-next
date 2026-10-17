import {periodicElements,periodicFamilies,type ElementFamily} from "./lektrusPeriodicElements";
import {elementFacts} from "./lektrusElementFacts";

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
 const schoolPosition=(el:(typeof periodicElements)[number]):[number,number]=>{
  const n=el.number,p=el.period;
  if(n>=58&&n<=71)return [n-58,11];
  if(n>=90&&n<=103)return [n-90,12];
  if(p<=3)return [el.col<=2?el.col-1:el.col-11,p-1];
  const offset=3+(p-4)*2;
  const top=p===4?[19,20,21,22,23,24,25,26,27,28]:
    p===5?[37,38,39,40,41,42,43,44,45,46]:
    p===6?[55,56,57,72,73,74,75,76,77,78]:
      [87,88,89,104,105,106,107,108,109,110];
  const topIndex=top.indexOf(n);
  if(topIndex>=0)return [topIndex,offset];
  const bottom=p===4?[29,30,31,32,33,34,35,36]:
    p===5?[47,48,49,50,51,52,53,54]:
    p===6?[79,80,81,82,83,84,85,86]:
      [111,112,113,114,115,116,117,118];
  const bottomIndex=bottom.indexOf(n);
  return [Math.max(0,bottomIndex),offset+1];
 };
 const element=active==null?null:periodicElements[active-1];
 const facts=active==null?null:elementFacts[active-1];
 return <svg className="lektrus-periodic-svg" viewBox={school?"0 0 1080 810":"0 0 1080 665"}
   preserveAspectRatio="xMidYMid meet" role="img"
   aria-label="Интерактивная периодическая таблица 118 химических элементов">
  <rect x="0" y="0" width="1080" height={school?810:665} rx="10" fill="#f9fbff"/>
  <text x={bx} y="30" className="lektrus-periodic-heading">Периодическая система химических элементов</text>
  {Array.from({length:school?8:18},(_,i)=><text key={i} className="lektrus-periodic-index"
    x={school?bx+i*107:bx+i*step+cell/2} y={55} textAnchor="middle">{school?["I","II","III","IV","V","VI","VII","VIII"][i]:i+1}</text>)}
  {Array.from({length:7},(_,i)=><text key={i} className="lektrus-periodic-index"
    x="23" y={school?by+(i<=2?i:3+(i-3)*2)*51+28:by+i*step+28} textAnchor="middle">{i+1}</text>)}
  {school&&Array.from({length:4},(_,i)=><g key={"subgroup-"+i}>
    <text x="8" y={by+(3+i*2)*51+18} fontSize="9" fill="#7485a2">А</text>
    <text x="8" y={by+(4+i*2)*51+18} fontSize="9" fill="#7485a2">Б</text>
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
    const [shortCol,shortRow]=schoolPosition(el);
    const x=school?bx+((el.row>=9&&el.number!==57&&el.number!==89)?shortCol*61:shortCol*94):bx+(el.col-1)*step;
    const y=school?by+shortRow*51:el.row<=7?by+(el.row-1)*step:el.row===9?480:535;
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
      <rect x={x} y={y} width={school?(el.row>=9?57:89):cell} height={school?47:cell} rx="4"
        stroke={chosen?"#2d60c8":focused?"#5b82b9":"#c5d4e7"}
        strokeWidth={chosen?2.4:focused?1.75:.8} fill={colors[el.family]}/>
      <text x={x+4} y={y+9.5} fontSize="8.5" fontWeight="750" fill="#415d80">{el.number}</text>
      <text x={x+(school?(el.row>=9?28:44):cell/2)} y={y+27} fontSize="19" textAnchor="middle"
        fontWeight="730" fill="#1d3558">{el.symbol}</text>
      {showNames&&<text x={x+(school?(el.row>=9?28:44):cell/2)} y={y+37.1} fontSize="7.5"
        textAnchor="middle" textLength={Math.min(44,Math.max(15,el.name.length*4.1))}
        lengthAdjust="spacingAndGlyphs" fill="#4c6483">{el.name}</text>}
      {<text x={x+(school?(el.row>=9?28:44):cell/2)} y={school?y+45:y+46} fontSize="7.5" fontWeight="650" textAnchor="middle"
        textLength={Math.min(41,Math.max(14,readableMass.length*4))}
        lengthAdjust="spacingAndGlyphs" fill="#54708d">{readableMass}</text>}
      {chosen&&<circle cx={x+(school?(el.row>=9?52:83):44)} cy={y+5} r="3" fill="#2d60c8"/>}
    </g>;
  })}
  {showInfo&&element&&facts&&<foreignObject x={school?770:185} y={school?75:78} width={school?284:385} height={school?180:170}>
    <div style={{height:"100%",boxSizing:"border-box",padding:"8px 10px",border:"1px solid #c9d5e6",borderRadius:10,background:"#ffffff",fontFamily:"Arial,sans-serif",color:"#263956",display:"flex",flexDirection:"column",gap:6,overflow:"hidden"}}
      onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <b style={{fontSize:25,lineHeight:1,color:"#234a81"}}>{element.symbol}</b>
        <span style={{fontSize:12,fontWeight:700,flex:1}}>{element.name}</span>
        <button type="button" style={{border:0,background:"#edf2f9",borderRadius:5,cursor:"pointer"}} onClick={onCloseInfo} aria-label="Закрыть сведения">×</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 9px",fontSize:11,lineHeight:1.15}}>
        <span>№ <b>{element.number}</b></span><span>Ar <b>{facts.atomicMass}</b></span>
        <span>Период <b>{element.period}</b></span><span>Группа <b>{school?["I","II","III","IV","V","VI","VII","VIII"][Math.min(7,Math.max(0,element.group===18?7:element.group<=2?element.group-1:element.group>=13?element.group-11:element.group-3))]:element.group}</b></span>
      </div>
      <div style={{fontSize:10,lineHeight:1.2}}><span style={{color:"#61748f"}}>Конфигурация: </span>{facts.electronConfiguration}</div>
      <div style={{fontSize:10,lineHeight:1.2}}><span style={{color:"#61748f"}}>Степени окисления: </span>{facts.oxidationStates}</div>
      {onToggleInfo&&<button type="button" style={{border:"1px solid #b5c9ed",background:"#eff5ff",borderRadius:5,padding:4,fontSize:10,cursor:"pointer",marginTop:"auto"}} onClick={onToggleInfo}>{marked.has(active!)?"Снять выделение":"Выделить элемент"}</button>}
    </div>
  </foreignObject>}
  <g transform={school?"translate(45 777)":"translate(45 615)"}>
   <text x="0" y="-10" fontSize="11" fill="#475569">Цветовая легенда</text>
   {periodicFamilies.map((family,i)=><g key={family.id} transform={"translate("+(i*144)+" 0)"}>
     <rect width="12" height="12" rx="2" fill={family.color} stroke="#cbd5e1"/>
     <text x="16" y="10" fontSize="10" fill="#475569">{family.name}</text>
   </g>)}
  </g>
  <text x="47" y={school?806:655} fontSize="10" fill="#8a9bb0">Z · символ · название · относительная атомная масса</text>
 </svg>;
}
