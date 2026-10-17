import type {ReactNode} from "react";

/** Small SVG symbol placed over a continuous circuit line.
 * Rendered identically in the subject editor and on the board.
 */
export type CircuitSymbol="wire"|"resistor"|"lamp"|"source"|"switch"|"ammeter"|"voltmeter";
export const circuitSymbols:{id:CircuitSymbol;label:string}[]=[
  {id:"wire",label:"Провод"},
  {id:"resistor",label:"Резистор"},
  {id:"lamp",label:"Лампа"},
  {id:"source",label:"Источник питания"},
  {id:"switch",label:"Выключатель"},
  {id:"ammeter",label:"Амперметр"},
  {id:"voltmeter",label:"Вольтметр"}
];
export default function ScienceCircuitGlyph({type,x,y,angle=0}:{
  type:CircuitSymbol;x:number;y:number;angle?:number;
}){
  if(type==="wire")return null;
  let drawing:ReactNode=null;
  if(type==="resistor")drawing=<rect x="-15" y="-9" width="30" height="18" fill="#fff" stroke="#27466b" strokeWidth="2.5" rx="1"/>;
  if(type==="lamp")drawing=<><circle r="14" fill="#fff" stroke="#27466b" strokeWidth="2.5"/><path d="M-9 -9L9 9M-9 9L9 -9" stroke="#27466b" strokeWidth="2"/></>;
  if(type==="source")drawing=<><path d="M-8 -17V17M3 -10V10" stroke="#27466b" strokeWidth="2.5"/><path d="M-12 -22V-19M-13 -20H-7" stroke="#27466b" strokeWidth="1.8"/></>;
  if(type==="switch")drawing=<><circle cx="-13" r="2.5" fill="#27466b"/><circle cx="13" r="2.5" fill="#27466b"/><path d="M-13 0L9 -12" stroke="#27466b" strokeWidth="2.5" strokeLinecap="round"/></>;
  if(type==="ammeter"||type==="voltmeter")drawing=<><circle r="14" fill="#fff" stroke="#27466b" strokeWidth="2.5"/><text x="0" y="6" textAnchor="middle" fontWeight="800" fontSize="17" fill="#27466b" transform={"rotate("+(-angle)+")"}>{type==="ammeter"?"A":"V"}</text></>;
  return <g transform={"translate("+x+" "+y+") rotate("+angle+")"} pointerEvents="none" aria-label={circuitSymbols.find(s=>s.id===type)?.label}>
    <rect x="-17" y="-19" width="34" height="38" fill="#fff" rx="3"/>
    {drawing}
  </g>;
}
