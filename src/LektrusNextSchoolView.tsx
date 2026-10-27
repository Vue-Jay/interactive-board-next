import {useId,useState} from "react";
import type {NextSchoolDiagram,WordRole,AlgorithmNode} from "./lektrusNextSchoolModel";
import {grammarRoles} from "./lektrusNextSchoolModel";
type Props={diagram:NextSchoolDiagram;onChange?:(next:NextSchoolDiagram)=>void};
function SyntaxView({d,onMark}:{d:Extract<NextSchoolDiagram,{kind:"syntax"}>;onMark?:(id:string)=>void}){
 const widths=d.words.map(w=>Math.min(230,Math.max(75,20+w.text.length*13)));
 const lines:{indices:number[];width:number}[]=[{indices:[],width:0}];
 widths.forEach((width,index)=>{
  let line=lines[lines.length-1];
  if(line.width+width>812&&line.indices.length){line={indices:[],width:0};lines.push(line)}
  line.indices.push(index);line.width+=width;
 });
 const mark=(role:WordRole,x:number,y:number,w:number)=>{
  const a=x+8,b=x+w-8;
  if(role==="none")return null;
  const line=(offset=0)=> <line x1={a} x2={b} y1={y+offset} y2={y+offset}
   stroke="#3c689d" strokeWidth="2.8" strokeLinecap="round"/>;
  if(role==="subject")return line();
  if(role==="predicate")return <>{line(-3)}{line(4)}</>;
  if(role==="attribute"){
   const n=Math.max(4,Math.round((b-a)/12));
   return <path d={Array.from({length:n*2+1},(_,i)=>`${i===0?"M":"L"}${a+i*(b-a)/(n*2)} ${y+(i%2?4:-4)}`).join(" ")}
    fill="none" stroke="#3c689d" strokeWidth="2.5"/>;
  }
  if(role==="object")return <line x1={a} x2={b} y1={y} y2={y}
   stroke="#3c689d" strokeDasharray="7 5" strokeWidth="2.6"/>;
  return <line x1={a} x2={b} y1={y} y2={y} stroke="#3c689d"
   strokeDasharray="11 4 2 4" strokeWidth="2.6"/>;
 };
 const startY=lines.length===1?205:155;
 return <svg viewBox="0 0 900 500" className="lektrus-school-svg" role="img" aria-label={d.title}>
  <rect width="900" height="500" rx="20" fill="#fcfdff"/>
  <text x="450" y="52" textAnchor="middle" fill="#254568" fontSize="24" fontWeight="750">{d.title}</text>
  {lines.map((line,li)=>{
   let x=450-line.width/2;
   return <g key={li}>{line.indices.map(i=>{
    const word=d.words[i],width=widths[i],pos=x,y=startY+li*95;x+=width;
    return <g key={word.id} onClick={onMark?()=>onMark(word.id):undefined}
       role={onMark?"button":undefined} tabIndex={onMark?0:undefined}
       aria-label={onMark?word.text+": "+grammarRoles[word.role]:undefined}
       onKeyDown={onMark?e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onMark(word.id)}}:undefined}
       style={onMark?{cursor:"pointer"}:undefined}>
     <text x={pos+width/2} y={y} textAnchor="middle" fill="#293e57" fontSize={word.text.length>18?18:23} fontWeight="600">
      {word.text}
     </text>
     {d.showMarks&&mark(word.role,pos,y+24,width)}
    </g>;
   })}</g>;
  })}
  {d.showMarks&&<g>
   <text x="450" y="411" fill="#8499ae" textAnchor="middle" fontSize="13">
    Одна черта · подлежащее | две · сказуемое | волнистая · определение
   </text>
   <text x="450" y="431" fill="#8499ae" textAnchor="middle" fontSize="13">
    Пунктир · дополнение | штрихпунктир · обстоятельство
   </text>
  </g>}
  <text x="450" y="480" textAnchor="middle" fill="#7e95ae" fontSize="13">
   Учитель задаёт члены предложения, автоматический разбор не выполняется
  </text>
 </svg>;
}
type P={x:number;y:number};
function FlowView({d}:{d:Extract<NextSchoolDiagram,{kind:"flowchart"}>}){
 const uid=useId().replace(/:/g,"");
 const centers=new Map(d.nodes.map((node,i)=>[node.id,{x:450+node.lane*220,y:106+i*59}]));
 const shape=(n:AlgorithmNode,p:P)=>{
  const selected=n.kind==="decision",io=n.kind==="input"||n.kind==="output";
  const stroke=n.kind==="start"||n.kind==="end"?"#49967f":selected?"#b78940":"#5b8cb9";
  const fill=n.kind==="start"||n.kind==="end"?"#e4f5ee":selected?"#fff4db":"#eef5ff";
  return <g key={n.id}>
   {selected?<polygon points={`${p.x} ${p.y-27} ${p.x+104} ${p.y} ${p.x} ${p.y+27} ${p.x-104} ${p.y}`}
    fill={fill} stroke={stroke} strokeWidth="2.1"/>:
    io?<path d={`M${p.x-96} ${p.y-23}H${p.x+108}L${p.x+96} ${p.y+23}H${p.x-108}Z`}
     fill={fill} stroke={stroke} strokeWidth="2.1"/>:
    <rect x={p.x-99} y={p.y-23} width="198" height="46"
     rx={n.kind==="start"||n.kind==="end"?23:8} fill={fill} stroke={stroke} strokeWidth="2.1"/>}
   <text x={p.x} y={p.y+5} fontSize={n.label.length>22?13:16} fontWeight="650" fill="#284d71"
    textAnchor="middle">{n.label.length>27?n.label.slice(0,26)+"…":n.label}</text>
  </g>;
 };
 const edgePath=(from:P,to:P)=>{
  if(from.y<to.y&&from.x===to.x){
   return {d:`M${from.x} ${from.y+27} V${to.y-29}`,label:{x:from.x+10,y:(from.y+to.y)/2}};
  }
  if(from.y>=to.y){
   const outside=from.x===to.x?from.x+132:(from.x+to.x)/2;
   return {d:`M${from.x+98} ${from.y}H${outside}V${to.y-36}H${to.x}V${to.y-29}`,
    label:{x:outside+9,y:(from.y+to.y)/2}};
  }
  const mid=(from.y+to.y)/2;
  return {d:`M${from.x} ${from.y+27}V${mid}H${to.x}V${to.y-29}`,
   label:{x:(from.x+to.x)/2,y:mid-7}};
 };
 return <svg viewBox="0 0 900 500" className="lektrus-school-svg" role="img" aria-label={d.title}>
  <defs><marker id={"arrow-"+uid} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
   <path d="M0 0L8 4L0 8Z" fill="#6386ae"/></marker></defs>
  <rect width="900" height="500" rx="20" fill="#fcfdff"/>
  <text x="450" y="44" textAnchor="middle" fontSize="23" fontWeight="750" fill="#264b6e">{d.title}</text>
  {d.edges.map(edge=>{
   const from=centers.get(edge.from),to=centers.get(edge.to);
   if(!from||!to)return null;
   const line=edgePath(from,to);
   return <g key={edge.id}>
    <path d={line.d} fill="none" stroke="#6386ae" strokeWidth="2.2"
     strokeLinejoin="round" markerEnd={`url(#arrow-${uid})`}/>
    {d.showEdgeLabels&&edge.label&&<g>
     <rect x={line.label.x-18} y={line.label.y-14} width="36" height="20" rx="6" fill="#fff" stroke="#dce7f2"/>
     <text x={line.label.x} y={line.label.y} textAnchor="middle" fontSize="12"
      fill="#436b94" fontWeight="750">{edge.label}</text>
    </g>}
   </g>;
  })}
  {d.nodes.map(n=>{const p=centers.get(n.id)!;return shape(n,p)})}
  <text x="450" y="486" fill="#8196ac" textAnchor="middle" fontSize="12">
   Учебная блок-схема · стрелки задаются вручную · алгоритм не выполняется
  </text>
 </svg>;
}
function PlaceValueView({d}:{d:Extract<NextSchoolDiagram,{kind:"place-value"}>}){
 const count=d.digits.length,cellWidth=Math.min(90,805/Math.max(1,count)),left=450-count*cellWidth/2;
 const displayBase=d.base.toString();
 return <svg viewBox="0 0 900 500" className="lektrus-school-svg" role="img" aria-label={d.title}>
  <rect width="900" height="500" rx="20" fill="#fcfdff"/>
  <text x="450" y="53" textAnchor="middle" fontSize="24" fontWeight="750" fill="#254a70">{d.title}</text>
  <text x="450" y="102" textAnchor="middle" fill="#597999" fontSize="17">Система счисления с основанием {displayBase}</text>
  {Array.from(d.digits).map((digit,i)=>{
   const x=left+i*cellWidth,power=count-i-1;
   return <g key={i}>
    <rect x={x+2} y="165" width={cellWidth-4} height="92" rx="9" fill={i%2===0?"#eaf3ff":"#f4f8ff"} stroke="#aac5e3" strokeWidth="1.5"/>
    <text x={x+cellWidth/2} y="219" fontSize="34" textAnchor="middle" fontWeight="750" fill="#2459a1">{digit}</text>
    {d.showPowers&&<>
     <text x={x+cellWidth/2} y="291" fontSize="17" textAnchor="middle" fill="#547896">{d.base}<tspan baselineShift="super" fontSize="12">{power}</tspan></text>
     <text x={x+cellWidth/2} y="317" fontSize="12" textAnchor="middle" fill="#829bb4">
      разряд {power}
     </text>
    </>}
   </g>;
  })}
  <text x="450" y="377" fontSize="20" textAnchor="middle" fill="#2f537a" fontWeight="650">
   {d.digits}<tspan baselineShift="sub" fontSize="15">{displayBase}</tspan>
  </text>
  <text x="450" y="425" fontSize="14" textAnchor="middle" fill="#8298b0">
   Каждый разряд соответствует степени основания системы счисления
  </text>
  <text x="450" y="476" fontSize="12" textAnchor="middle" fill="#97a8b9">
   Значение числа в другой системе не вычисляется автоматически
  </text>
 </svg>;
}
const stop=(e:React.SyntheticEvent)=>e.stopPropagation();
const panelStyle:React.CSSProperties={display:"flex",gap:5,alignItems:"center",flexWrap:"wrap",
 padding:6,background:"#f5f9ff",borderBottom:"1px solid #d8e5f2",fontSize:12};
const entryStyle:React.CSSProperties={fontSize:12,padding:"5px 7px",minWidth:0,border:"1px solid #c9dced",borderRadius:6};
export default function LektrusNextSchoolView({diagram:d,onChange}:Props){
 const [markRole,setMarkRole]=useState<WordRole>("subject");
 if(d.kind==="syntax")return <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column"}}
  onPointerDown={stop} onPointerUp={stop} onClick={stop}>
  {onChange&&<div style={panelStyle}>
   <label>Предложение <input style={entryStyle} value={d.words.map(w=>w.text).join(" ")}
    placeholder="Введите предложение" onChange={e=>{
     const words=e.target.value.trim().split(/\s+/).filter(Boolean).slice(0,14);
     onChange({...d,words:words.map((text,i)=>({id:d.words[i]?.id??crypto.randomUUID(),
      text:text.slice(0,28),role:d.words[i]?.text===text?d.words[i].role:"none"}))});
    }}/></label>
   <label>Подчёркивание
    <select style={entryStyle} aria-label="Выберите член предложения" value={markRole}
     onChange={e=>setMarkRole(e.target.value as WordRole)}>
     {(Object.entries(grammarRoles) as [WordRole,string][]).map(([role,label])=>
      <option key={role} value={role}>{label}</option>)}
    </select></label>
   <span style={{color:"#63829a"}}>Нажимайте на слова прямо в схеме</span>
  </div>}
  <div style={{flex:1,minHeight:0}}><SyntaxView d={d} onMark={onChange?
    id=>onChange({...d,words:d.words.map(w=>w.id===id?{...w,role:markRole}:w)}):undefined}/></div></div>;
 if(d.kind==="flowchart")return <FlowView d={d}/>;
 return <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column"}}
  onPointerDown={stop} onPointerUp={stop} onClick={stop}>
  {onChange&&<div style={panelStyle}>
   <label>Основание <select style={entryStyle} value={d.base}
    onChange={e=>onChange({...d,base:Number(e.target.value) as 2|8|10|16,digits:""})}>
    {[2,8,10,16].map(v=><option value={v} key={v}>{v}</option>)}</select></label>
   <label>Число <input style={entryStyle} value={d.digits} maxLength={10}
    placeholder="Введите число" onChange={e=>{
     const value=e.target.value.toUpperCase();
     if([...value].every(c=>/[0-9A-F]/.test(c)&&parseInt(c,16)<d.base))onChange({...d,digits:value});
    }}/></label>
  </div>}
  <div style={{flex:1,minHeight:0}}><PlaceValueView d={d}/></div></div>;
}
