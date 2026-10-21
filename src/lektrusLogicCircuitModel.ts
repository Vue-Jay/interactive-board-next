/** Small, deterministic school-level circuit simulator (ideal Boolean gates only). */
export type LogicGate="and"|"or"|"xor"|"nand"|"nor"|"xnor";
export type LogicSecondGate=LogicGate|"none"|"not";
export type LogicBit=0|1;
export type LogicSignals={a:LogicBit;b:LogicBit;c:LogicBit};
export type LogicCircuitDiagram={
 kind:"logic-circuit";title:string;firstGate:LogicGate;secondGate:LogicSecondGate;
 initialSignals:LogicSignals;showTruthTable:boolean;showResults:boolean;
};
export const logicGateNames:Record<LogicGate,string>={
 and:"И",or:"ИЛИ",xor:"Исключающее ИЛИ",
 nand:"И-НЕ",nor:"ИЛИ-НЕ",xnor:"Эквивалентность"
};
export const logicSecondNames:Record<LogicSecondGate,string>={
 none:"Без второго элемента",not:"НЕ",...logicGateNames
};
export const logicGateSymbols:Record<LogicGate,string>={
 and:"&",or:"≥1",xor:"=1",nand:"&",nor:"≥1",xnor:"=1"
};
export const logicGateOptions=Object.keys(logicGateNames) as LogicGate[];
export const logicSecondOptions=Object.keys(logicSecondNames) as LogicSecondGate[];
export const isLogicCircuitId=(id:string|undefined):id is "info-circuit"=>id==="info-circuit";
export const defaultLogicCircuit=():LogicCircuitDiagram=>({
 kind:"logic-circuit",title:"Логическая схема",firstGate:"and",secondGate:"or",
 initialSignals:{a:0,b:1,c:1},showTruthTable:true,showResults:true
});
export const isLogicBit=(v:unknown):v is LogicBit=>v===0||v===1;
export function evaluateLogicGate(gate:LogicGate,a:LogicBit,b:LogicBit):LogicBit{
 switch(gate){
  case "and":return (a&b) as LogicBit;
  case "or":return (a|b) as LogicBit;
  case "xor":return (a^b) as LogicBit;
  case "nand":return Number(!(a&b)) as LogicBit;
  case "nor":return Number(!(a|b)) as LogicBit;
  case "xnor":return Number(a===b) as LogicBit;
 }
}
export function circuitUsesThirdInput(circuit:LogicCircuitDiagram):boolean{
 return circuit.secondGate!=="none"&&circuit.secondGate!=="not";
}
export function evaluateLogicCircuit(circuit:LogicCircuitDiagram,inputs:LogicSignals):{
 intermediate:LogicBit;output:LogicBit
}{
 const intermediate=evaluateLogicGate(circuit.firstGate,inputs.a,inputs.b);
 const output=circuit.secondGate==="none"?intermediate:
  circuit.secondGate==="not"?Number(!intermediate) as LogicBit:
  evaluateLogicGate(circuit.secondGate,intermediate,inputs.c);
 return {intermediate,output};
}
export type LogicCircuitRow=LogicSignals&{intermediate:LogicBit;output:LogicBit};
export function logicCircuitRows(circuit:LogicCircuitDiagram):LogicCircuitRow[]{
 const rows:LogicCircuitRow[]=[];
 for(const a of [0,1] as const)for(const b of [0,1] as const){
  for(const c of (circuitUsesThirdInput(circuit)?[0,1] as const:[0] as const)){
   const signals={a,b,c};
   rows.push({...signals,...evaluateLogicCircuit(circuit,signals)});
  }
 }
 return rows;
}
export function validateLogicCircuit(value:unknown):value is LogicCircuitDiagram{
 if(!value||typeof value!=="object")return false;
 const d=value as Record<string,unknown>;
 if(d.kind!=="logic-circuit"||typeof d.title!=="string"||
   !d.title.trim()||d.title.length>120||
   !Object.hasOwn(logicGateNames,String(d.firstGate))||
   !Object.hasOwn(logicSecondNames,String(d.secondGate))||
   typeof d.showTruthTable!=="boolean"||typeof d.showResults!=="boolean")return false;
 if(!d.initialSignals||typeof d.initialSignals!=="object"||Array.isArray(d.initialSignals))return false;
 const s=d.initialSignals as Record<string,unknown>;
 return isLogicBit(s.a)&&isLogicBit(s.b)&&isLogicBit(s.c);
}
