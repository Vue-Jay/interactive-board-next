import {substances,type Substance} from "./lektrusReactionDatabase";
import {reagentAppearance} from "./lektrusLabAppearance";
export type StoragePhase="liquid"|"solid"|"gas";
export type CatalogueSort="recommended"|"name"|"formula";
export type CatalogueGroup="class"|"phase"|"none";
export const phaseNames:Record<StoragePhase,string>={
 liquid:"Жидкие и растворы",solid:"Твёрдые",gas:"Газообразные"
};
export const classNames:Record<string,string>={
 кислота:"Кислоты",основание:"Основания",соль:"Соли",оксид:"Оксиды",
 металл:"Металлы",неметалл:"Неметаллы",газ:"Газы",органика:"Органические",
 вода:"Вода", "простое вещество":"Простые вещества"
};
/** Physical state as stocked in a school virtual reagent cabinet. The same
 * formula can be a solution during an experiment and a solid in storage. */
export function cabinetPhase(v:Substance):StoragePhase{
 if(v.kind==="газ"||["CO2","NH3","Cl2","NO2"].includes(v.id))return "gas";
 if(v.kind==="кислота"||v.id==="H2O"||v.id==="NH4OH"||
  ["C2H5OH","CH3OH","CH3COOH","H2O2","Br2"].includes(v.id))return "liquid";
 return "solid";
}
/** Presentation in the reagent cabinet is determined by the supplied form,
 * not inferred from a chemical formula alone. A solid and its prepared
 * solution are different shelf choices. Insoluble classroom compounds are
 * deliberately not offered as ready-to-pour solutions. */
const insolubleStock=new Set([
 "AgCl","AgBr","AgI","BaSO4","CaCO3","MgCO3","BaCO3","CuCO3",
 "FeS","CuS","Cu(OH)2","Fe(OH)2","Fe(OH)3","PbI2","PbSO4",
 "AgBr","AgI","SrSO4","SrCO3","Ni(OH)2","Co(OH)2","ZnS","Li2CO3"
]);
export function labReagentForms(v:Substance):("ml"|"g")[]{
 const state=cabinetPhase(v);
 if(state==="gas")return ["ml"];
 if(v.kind==="кислота"||v.kind==="вода"||v.id==="H2O"||
  ["C2H5OH","CH3OH","CH3COOH","H2O2","Br2"].includes(v.id))return ["ml"];
 if(v.kind==="металл"||v.kind==="неметалл"||v.kind==="оксид"||
  insolubleStock.has(v.id))return ["g"];
 if(v.kind==="соль"||v.kind==="основание")return ["g","ml"];
 return state==="liquid"?["ml"]:["g"];
}
export function labReagentPhaseLabel(v:Substance,unit:"ml"|"g"){
 return unit==="g"?"Твёрдое вещество":cabinetPhase(v)==="gas"?
  "Газообразное вещество":"Раствор / жидкость";
}
export function cabinetColor(v:Substance){
 return reagentAppearance(v.id,cabinetPhase(v)==="solid"?"dry":"aqueous").color;
}
export function buildLabCatalog(options:{query?:string;kind?:string;phase?:"all"|StoragePhase;
 sort?:CatalogueSort;group?:CatalogueGroup}){
 const {query="",kind="Все",phase="all",sort="recommended",group="class"}=options;
 const needle=query.toLocaleLowerCase("ru-RU").trim();
 const entries=substances.filter(v=>
  (kind==="Все"||v.kind===kind)&&
  (phase==="all"||(phase==="liquid"&&cabinetPhase(v)!=="gas"&&labReagentForms(v).includes("ml"))||
   (phase==="solid"&&labReagentForms(v).includes("g"))||
   (phase==="gas"&&cabinetPhase(v)==="gas"))&&
  (v.name+" "+v.formula+" "+(classNames[v.kind]??v.kind)).toLocaleLowerCase("ru-RU").includes(needle));
 const recommended=(v:Substance)=>{
  if(v.id==="H2O")return -3;
  const forms=labReagentForms(v),liquid=forms.includes("ml");
  const common=["HCl","NaOH","AgNO3","NaCl","CuSO4","BaCl2","CaCl2","Na2CO3","KOH","H2SO4","NaHCO3"];
  return liquid?(common.includes(v.id)?-2:-1):1;
 };
 const cmp=(a:Substance,b:Substance)=>{
  const score=sort==="recommended"?recommended(a)-recommended(b):0;
  if(score)return score;
  return sort==="formula"?a.formula.localeCompare(b.formula,"ru-RU",{numeric:true}):
   a.name.localeCompare(b.name,"ru-RU",{numeric:true});
 };
 const groupName=(v:Substance)=>group==="none"?"Все вещества":
  group==="phase"?(cabinetPhase(v)==="gas"?"Газообразные":labReagentForms(v).includes("ml")?"Растворы и жидкости":phaseNames[cabinetPhase(v)]):(classNames[v.kind]??v.kind);
 const grouped=new Map<string,Substance[]>();
 for(const v of entries){
  const title=groupName(v);
  if(!grouped.has(title))grouped.set(title,[]);
  grouped.get(title)?.push(v);
 }
 return [...grouped.entries()].sort(([a],[b])=>
  (a==="Растворы и жидкости"?-1:b==="Растворы и жидкости"?1:0)||
  a.localeCompare(b,"ru-RU"))
  .map(([title,items])=>({title,items:items.sort(cmp)}));
}
