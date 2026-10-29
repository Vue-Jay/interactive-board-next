import {useId} from "react";
import type {LabGlassware} from "./lektrusChemistryBenchModel";

/** True-to-purpose glassware silhouettes, consistent fine graduations and light
 * reflections. Shelf vessels are empty, never fake filled with colored liquid. */
const drawings:Record<LabGlassware,{body:string;rim?:string;markings?:string;parts?:string}> = {
 beaker:{body:"M18 13V60Q18 69 28 69H54Q64 69 64 59V13",
  rim:"M12 13H17L20 17M64 13H67Q70 13 70 9",markings:"M51 26h9M54 32h6M51 38h9M54 44h6M51 50h9"},
 tube:{body:"M30 12V58Q30 73 42 73Q54 73 54 58V12",
  rim:"M27 12H57",markings:"M35 32h6M35 40h6"},
 flask:{body:"M36 10V35Q15 42 15 57A27 22 0 0 0 69 57Q69 43 48 35V10",
  rim:"M33 10H51",markings:"M23 52h7M23 58h7"},
 cylinder:{body:"M32 9V66Q32 69 36 69H48Q52 69 52 66V9",
  rim:"M29 9H55",markings:"M34 19h12M34 26h7M34 33h12M34 40h7M34 47h12M34 54h7",
  parts:"M25 70H59V74H25Z"},
 dish:{body:"M11 48Q14 68 42 68Q70 68 73 48",
  rim:"M11 48Q42 56 73 48Q42 39 11 48",markings:"M18 53Q42 63 66 53"},
 conical:{body:"M33 10V34L13 62Q8 71 21 71H63Q76 71 71 62L51 34V10",
  rim:"M30 10H54",markings:"M22 55h8M22 62h12M59 55h6"},
 volumetric:{body:"M37 8V39Q18 48 18 59Q18 73 42 73Q66 73 66 59Q66 48 47 39V8",
  rim:"M34 8H50",markings:"M34 28H50M39 24H45"},
 crucible:{body:"M16 32L21 61Q23 71 42 71Q61 71 63 61L68 32Z",
  rim:"M14 32H70M17 22Q42 16 67 22L70 26H14Z",markings:"M23 44h38"},
 pipette:{body:"M38 6V23Q29 29 35 39Q38 44 38 52V70H46V52Q46 44 49 39Q55 29 46 23V6",
  rim:"M34 6H50",markings:"M42 70V77M40 15h4"},
 burette:{body:"M37 5V57H47V5",
  rim:"M34 5H50",markings:"M39 13h6M39 20h4M39 27h6M39 34h4M39 41h6M39 48h4M37 56H47",
  parts:"M35 58H50M42 58V73M30 60H54M50 58L56 53M56 53h8"}
};
export default function LektrusLabGlasswareIcon({kind,size=36}:{
 kind:LabGlassware;size?:number}){
 const p=drawings[kind],uid=useId().replace(/:/g,"");
 return <svg viewBox="0 0 84 82" width={size} height={size}
  aria-hidden="true" className={"lektrus-lab-ware-icon is-"+kind}
  fill="none" strokeLinecap="round" strokeLinejoin="round">
  <defs>
   <linearGradient id={uid+"glass"} x1="0" y1="0" x2="1" y2=".25">
    <stop stopColor="#fcffff" stopOpacity=".83"/>
    <stop offset=".23" stopColor="#d7f3f1" stopOpacity=".4"/>
    <stop offset=".65" stopColor="#c2e2df" stopOpacity=".18"/>
    <stop offset="1" stopColor="#8cbcb5" stopOpacity=".57"/>
   </linearGradient>
   <linearGradient id={uid+"ceramic"} x1="0" y1="0" x2="1" y2="1">
    <stop stopColor="#ffffff"/><stop offset=".75" stopColor="#d1e2dc"/>
    <stop offset="1" stopColor="#a2bcb0"/>
   </linearGradient>
  </defs>
  <ellipse cx="42" cy="76" rx={kind==="dish"?29:17} ry="3"
   fill="#2a5d52" opacity=".12"/>
  <path d={p.body} fill={kind==="crucible"?
   "url(#"+uid+"ceramic)":"url(#"+uid+"glass)"}
   stroke={kind==="crucible"?"#7b9a90":"#467f80"}
   strokeWidth="2.9"/>
  {p.rim&&<path d={p.rim} stroke="#568e8c" strokeWidth="2.6"/>}
  {p.markings&&<path d={p.markings} stroke="#86aaa7" strokeWidth="1.9"/>}
  {p.parts&&<path d={p.parts} stroke="#5b837c" strokeWidth="2.6"
   fill={kind==="cylinder"?"#d2e4dc":"none"}/>}
  <path d={kind==="dish"?"M18 51Q42 57 66 51":"M25 24V42"}
   stroke="#fff" strokeWidth="2.6" strokeOpacity=".68"/>
 </svg>;
}
