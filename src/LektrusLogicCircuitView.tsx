import {useEffect,useState,type SyntheticEvent} from "react";
import type {LogicCircuitDiagram,LogicGate,LogicSignals,LogicBit} from "./lektrusLogicCircuitModel";
import {circuitUsesThirdInput,evaluateLogicCircuit,logicCircuitRows,
 logicGateNames,logicGateSymbols,logicSecondNames} from "./lektrusLogicCircuitModel";

const gateInverted=(name:string)=>name==="nand"||name==="nor"||name==="xnor"||name==="not";
const wire=(active:LogicBit)=>active?"#1a9d74":"#8199b0";
function Gate({gate,x,y,unary=false}:{gate:LogicGate|"not";x:number;y:number;unary?:boolean}){
 const symbol=gate==="not"?"1":logicGateSymbols[gate];
 return <g>
  <rect x={x} y={y} width="125" height="95" rx="13" fill="#f0f6fd" stroke="#6b95b9" strokeWidth="3"/>
  <text x={x+63} y={y+55} fontSize="31" fontWeight="750" textAnchor="middle" fill="#315c7e">{symbol}</text>
  <text x={x+63} y={y+81} fontSize="13" textAnchor="middle" fill="#6483a1">
   {gate==="not"?"НЕ":logicGateNames[gate]}
  </text>
  {gateInverted(gate)&&<circle cx={x+133} cy={y+47.5} r="8" fill="#fff" stroke="#6b95b9" strokeWidth="2.5"/>}
  {unary&&<text x={x+4} y={y+14} fontSize="11" fill="#6483a1">1 вход</text>}
 </g>;
}
export default function LektrusLogicCircuitView({diagram:d}:{diagram:LogicCircuitDiagram}){
 const [signals,setSignals]=useState<LogicSignals>({...d.initialSignals});
 useEffect(()=>{
  setSignals({...d.initialSignals});
 },[d.initialSignals.a,d.initialSignals.b,d.initialSignals.c]);
 const useC=circuitUsesThirdInput(d),second=d.secondGate!=="none";
 const result=evaluateLogicCircuit(d,signals);
 const rows=d.showTruthTable?logicCircuitRows(d):[];
 const stop=(e:SyntheticEvent)=>e.stopPropagation();
 const toggle=(key:keyof LogicSignals)=>setSignals(s=>({...s,[key]:(1-s[key]) as LogicBit}));
 const firstOutX=gateInverted(d.firstGate)?407:390;
 const secondOutX=gateInverted(d.secondGate)?711:695;
 const outputX=second?secondOutX:firstOutX;
 return <div className="lektrus-logic-circuit" role="group" aria-label={d.title}
  style={{background:"#fcfdff",color:"#2b4e6b",padding:"9px 13px",
   boxSizing:"border-box",height:"100%",overflow:"auto"}}
  onPointerDown={stop} onPointerUp={stop} onClick={stop}>
  <div style={{textAlign:"center",fontSize:20,fontWeight:750,marginBottom:3}}>{d.title}</div>
  <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap"}}>
   {(["a","b","c"] as const).filter(key=>key!=="c"||useC).map(key=>
    <button type="button" key={key} onClick={()=>toggle(key)}
     aria-label={"Переключить вход "+key.toUpperCase()} aria-pressed={signals[key]===1}
     style={{border:"1px solid #adc5db",borderRadius:9,
      background:signals[key]?"#d5f4e5":"#eef3fa",color:"#254968",padding:"5px 13px",
      fontWeight:700,cursor:"pointer"}}>
     {key.toUpperCase()} = {signals[key]}
    </button>
   )}
   <span role="status" aria-live="polite" style={{fontWeight:700,padding:"6px 9px"}}>
    Выход Y = {d.showResults?result.output:"?"}
   </span>
  </div>
  <svg viewBox="0 0 900 330" role="img" aria-label="Соединения логических элементов"
   style={{display:"block",width:"100%",height:205}}>
   <text x="100" y="132" fontSize="22" textAnchor="end" fontWeight="700" fill="#315877">A = {signals.a}</text>
   <text x="100" y="242" fontSize="22" textAnchor="end" fontWeight="700" fill="#315877">B = {signals.b}</text>
   <path d="M110 125H195V154H260" stroke={wire(signals.a)} strokeWidth="5" fill="none"/>
   <path d="M110 233H216V199H260" stroke={wire(signals.b)} strokeWidth="5" fill="none"/>
   <Gate gate={d.firstGate} x={260} y={129}/>
   <text x="326" y="117" fontSize="15" textAnchor="middle" fill="#5e7891">Элемент 1</text>
   {second?<>
    <path d={"M"+firstOutX+" 176H476V164H560"} fill="none"
     stroke={d.showResults?wire(result.intermediate):"#8199b0"} strokeWidth="5"/>
    {useC&&<>
     <text x="100" y="296" fontSize="22" textAnchor="end" fontWeight="700" fill="#315877">C = {signals.c}</text>
     <path d="M110 289H518V210H560" fill="none" stroke={wire(signals.c)} strokeWidth="5"/>
    </>}
    <Gate gate={d.secondGate==="not"?"not":d.secondGate} x={560} y={129} unary={!useC}/>
    <text x="625" y="117" fontSize="15" textAnchor="middle" fill="#5e7891">Элемент 2</text>
   </>:null}
   <path d={"M"+outputX+" 176H800"} stroke={d.showResults?wire(result.output):"#8199b0"}
    strokeWidth="5" fill="none"/>
   <text x="820" y="184" fontSize="24" fontWeight="800" fill="#315877">
    Y={d.showResults?result.output:"?"}
   </text>
  </svg>
  <div style={{fontSize:12,color:"#698298",textAlign:"center",marginTop:-9}}>
   {logicGateNames[d.firstGate]}{second?" → "+logicSecondNames[d.secondGate]:""} ·
   {" "}идеальные логические элементы, без моделирования задержек сигналов
  </div>
  {d.showTruthTable&&<div style={{overflowX:"auto",marginTop:7}}>
   <table style={{borderCollapse:"collapse",width:"100%",fontSize:13,textAlign:"center"}}>
    <thead><tr>{["A","B",...(useC?["C"]:[]),"Y"].map(x=>
     <th scope="col" key={x} style={{padding:"2px 4px",borderBottom:"1px solid #aac0d6"}}>{x}</th>)}
    </tr></thead>
    <tbody>{rows.map((row,i)=>{
     const selected=row.a===signals.a&&row.b===signals.b&&(!useC||row.c===signals.c);
     return <tr key={i} style={{background:selected?"#def1e7":i%2?"#f5f8fc":"transparent"}}>
      {[row.a,row.b,...(useC?[row.c]:[]),d.showResults?row.output:"?"].map((v,j)=>
       <td key={j} style={{padding:"2px 5px",fontWeight:selected?750:400}}>{v}</td>)}
     </tr>;
    })}</tbody>
   </table>
  </div>}
 </div>;
}
