import type {LabGlassware} from "./lektrusChemistryBenchModel";
/** Consistent vector pictograms. Each silhouette is a recognizable vessel,
 * not a resized placeholder glyph. Used on both cupboard shelves and cards. */
const paths:Record<LabGlassware,{glass:string;rim?:string;detail?:string;liquid?:string}>={
 beaker:{glass:"M17 13V61Q17 70 28 70H52Q63 70 63 61V13",rim:"M13 13H67",detail:"M52 26h9 M52 35h9 M52 44h9",liquid:"M20 49H60V61Q60 67 52 67H28Q20 67 20 61Z"},
 tube:{glass:"M30 13V56Q30 72 40 72Q50 72 50 56V13",rim:"M26 13H54",liquid:"M33 47H47V55Q47 69 40 69Q33 69 33 55Z"},
 flask:{glass:"M32 10V32L13 63Q9 72 23 72H57Q71 72 67 63L48 32V10",rim:"M29 10H51",liquid:"M24 55H56L63 66Q65 69 57 69H23Q15 69 17 66Z"},
 cylinder:{glass:"M28 10V64Q28 70 33 70H47Q52 70 52 64V10",rim:"M24 10H56",detail:"M31 22H39 M31 30H36 M31 38H39 M31 46H36",liquid:"M31 49H49V63Q49 67 46 67H34Q31 67 31 63Z"},
 dish:{glass:"M10 45Q12 71 40 71Q68 71 70 45",rim:"M9 45Q40 57 71 45",liquid:"M18 53Q40 60 62 53Q55 67 40 67Q25 67 18 53Z"},
 conical:{glass:"M31 10V31L12 64Q9 72 23 72H57Q71 72 68 64L49 31V10",rim:"M28 10H52",liquid:"M20 56H60L65 67Q63 70 57 70H23Q17 70 15 67Z"},
 volumetric:{glass:"M34 8V34Q16 43 16 56Q16 73 40 73Q64 73 64 56Q64 43 46 34V8",rim:"M31 8H49",detail:"M28 23H52",liquid:"M21 53Q40 49 59 53Q64 69 40 69Q16 69 21 53Z"},
 crucible:{glass:"M15 31H65L59 62Q56 70 40 70Q24 70 21 62Z",rim:"M13 31H67",detail:"M26 21H54",liquid:"M21 49H59L56 62Q53 67 40 67Q27 67 24 62Z"},
 pipette:{glass:"M36 8V32Q22 43 36 54V70H44V54Q58 43 44 32V8",rim:"M33 8H47",detail:"M40 70V76 M34 20H46",liquid:"M34 42Q40 48 46 42Q48 50 41 55V67H39V55Q32 50 34 42Z"},
 burette:{glass:"M33 7V60H47V7",rim:"M29 7H51",detail:"M36 14h7 M36 24h7 M36 34h7 M36 44h7 M27 60h26 M40 60v15",liquid:"M36 21H44V57H36Z"},
 funnel:{glass:"M10 18H70L45 47V73H35V47Z",rim:"M10 18H70",liquid:"M18 26H62L42 44H38Z"}
};
export default function LektrusLabGlasswareIcon({kind,size=36}:{
 kind:LabGlassware;size?:number}){
 const p=paths[kind];
 return <svg viewBox="0 0 80 82" width={size} height={size} aria-hidden="true"
  className={"lektrus-lab-ware-icon is-"+kind} fill="none"
  strokeLinecap="round" strokeLinejoin="round">
  {p.liquid&&<path d={p.liquid} fill="#9dcfc5" fillOpacity=".58" stroke="none"/>}
  <path d={p.glass} stroke="#518f89" strokeWidth="3.5" fill="#eff9f6" fillOpacity=".14"/>
  {p.rim&&<path d={p.rim} stroke="#427f7b" strokeWidth="3.2"/>}
  {p.detail&&<path d={p.detail} stroke="#82aba6" strokeWidth="2.3"/>}
  <path d="M25 20v16" stroke="#fff" strokeWidth="2" opacity=".52"/>
 </svg>;
}
