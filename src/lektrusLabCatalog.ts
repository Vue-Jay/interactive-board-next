import {substances,type Substance} from "./lektrusReactionDatabase";
import {reagentAppearance} from "./lektrusLabAppearance";
export type StoragePhase="liquid"|"solid"|"gas";
export type CatalogueSort="name"|"formula";
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
  ["C2H5OH","CH3OH","CH3COOH","H2O2","Br2","I2"].includes(v.id))return "liquid";
 return "solid";
}
export function cabinetColor(v:Substance){
 return reagentAppearance(v.id,cabinetPhase(v)==="solid"?"dry":"aqueous").color;
}
export function buildLabCatalog(options:{query?:string;kind?:string;phase?:"all"|StoragePhase;
 sort?:CatalogueSort;group?:CatalogueGroup}){
 const {query="",kind="Все",phase="all",sort="name",group="class"}=options;
 const needle=query.toLocaleLowerCase("ru-RU").trim();
 const entries=substances.filter(v=>
  (kind==="Все"||v.kind===kind)&&(phase==="all"||cabinetPhase(v)===phase)&&
  (v.name+" "+v.formula+" "+(classNames[v.kind]??v.kind)).toLocaleLowerCase("ru-RU").includes(needle));
 const cmp=(a:Substance,b:Substance)=>sort==="formula"?
  a.formula.localeCompare(b.formula,"ru-RU",{numeric:true}):
  a.name.localeCompare(b.name,"ru-RU",{numeric:true});
 const groupName=(v:Substance)=>group==="none"?"Все вещества":
  group==="phase"?phaseNames[cabinetPhase(v)]:(classNames[v.kind]??v.kind);
 const grouped=new Map<string,Substance[]>();
 for(const v of entries){
  const title=groupName(v);
  if(!grouped.has(title))grouped.set(title,[]);
  grouped.get(title)?.push(v);
 }
 return [...grouped.entries()].sort(([a],[b])=>a.localeCompare(b,"ru-RU"))
  .map(([title,items])=>({title,items:items.sort(cmp)}));
}
