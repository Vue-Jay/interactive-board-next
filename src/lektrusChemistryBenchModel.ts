import type {Item} from "./boardModel";
import {identifyReaction,substances,type ReactionEnvironment,type ReactionStatus,type ReactionCase} from "./lektrusReactionDatabase";

export type LabGlassware="beaker"|"tube"|"flask"|"cylinder"|"dish";
export const labGlassware:{id:LabGlassware;name:string;description:string}[]=[
 {id:"beaker",name:"Стакан",description:"Смешивание растворов"},
 {id:"tube",name:"Пробирка",description:"Небольшие пробы"},
 {id:"flask",name:"Колба",description:"Работа с жидкостями"},
 {id:"cylinder",name:"Мерный цилиндр",description:"Отмеривание жидкости"},
 {id:"dish",name:"Чашка",description:"Открытый сосуд"}
];
export type LabDose={value:number;unit:"ml"|"g"};
export type LabBenchSettings={
 showEquationBoard:boolean;showVesselLabels:boolean;animateEffects:boolean;
};
export const defaultLabBenchSettings=():LabBenchSettings=>({
 showEquationBoard:false,showVesselLabels:true,animateEffects:true
});
export const labBenchSettings=(bench:LabBench):LabBenchSettings=>({
 ...defaultLabBenchSettings(),...bench.settings
});
export const formatLabDose=(dose:LabDose)=>`${dose.value.toLocaleString("ru-RU")} ${dose.unit==="ml"?"мл":"г"}`;

export type LabIndicator="litmus"|"phenolphthalein"|"methyl-orange"|"universal";
export const labIndicators:{id:LabIndicator;name:string;note:string}[]=[
 {id:"litmus",name:"Лакмус",note:"Красный в кислой среде, синий в щелочной"},
 {id:"phenolphthalein",name:"Фенолфталеин",note:"Малиновый в щелочной среде"},
 {id:"methyl-orange",name:"Метилоранж",note:"Красный в кислой среде, жёлтый в щелочной"},
 {id:"universal",name:"Универсальный",note:"Условная цветовая шкала кислотности"}
];
export type LabIndicatorResult={medium:"acid"|"base"|"neutral"|"unknown";
 label:string;color?:string;note:string};
const indicatorPalette:Record<LabIndicator,Record<"acid"|"base"|"neutral",string>>={
 litmus:{acid:"#d85761",base:"#426cce",neutral:"#8978b5"},
 phenolphthalein:{acid:"#c8e3eb",base:"#d83a96",neutral:"#c8e3eb"},
 "methyl-orange":{acid:"#db4444",base:"#efc94b",neutral:"#eda24f"},
 universal:{acid:"#e55b45",base:"#5673cc",neutral:"#72ad5c"}
};
/** Qualitative indicator reading only where medium is unambiguous.
 * Never invent pH for neutralisation, salts or multi-stage mixtures. */
export function labIndicatorResult(vessel:LabVessel):LabIndicatorResult|null{
 if(!vessel.indicator)return null;
 const reagents=vessel.reagents;
 let medium:LabIndicatorResult["medium"]="unknown";
 if(reagents.length&&vessel.environment==="aqueous"&&!vessel.uncertain&&
    !(vessel.observed&&identifyReaction(reagents,vessel.environment).status==="reaction")){
  if(reagents.length===1&&reagents[0]==="H2O")medium="neutral";
  else if(reagents.every(id=>substances.find(s=>s.id===id)?.kind==="кислота"))medium="acid";
  else if(reagents.every(id=>["NaOH","KOH","Ca(OH)2","Ba(OH)2","NH4OH"].includes(id)))medium="base";
 }
 const descriptions={acid:"Кислая среда",base:"Щелочная среда",
  neutral:"Нейтральная среда",unknown:"Окраска не определена"};
 const color=medium==="unknown"?undefined:indicatorPalette[vessel.indicator][medium];
 return{medium,label:descriptions[medium],color,
  note:medium==="unknown"?
   "Без известных pH и концентраций нельзя надёжно определить цвет индикатора.":
   "Качественная оценка среды, без вычисления pH и концентраций."};
}

export type LabVessel={
 id:string;kind:LabGlassware;x:number;y:number;
 reagents:string[];environment:ReactionEnvironment;
 observed:boolean;uncertain?:boolean;indicator?:LabIndicator;
 doses?:Record<string,LabDose>;
 /** A verified reaction already completed in this material; survives full transfer. */
 completedReaction?:ReactionCase;
};
export type LabBench={vessels:LabVessel[];selectedId:string;event:number;
 settings?:LabBenchSettings};
export const MAX_BENCH_VESSELS=6,MAX_VESSEL_REAGENTS=6;
const clamp=(v:number)=>Math.round(Math.min(90,Math.max(10,v))*10)/10;
export function setLabBenchSettings(bench:LabBench,settings:Partial<LabBenchSettings>):LabBench{
 const next={...labBenchSettings(bench),...settings};
 return JSON.stringify(next)===JSON.stringify(labBenchSettings(bench))?bench:
  {...bench,settings:next,event:bench.event+1};
}
export const defaultLabBench=():LabBench=>({
 vessels:[{id:"v1",kind:"beaker",x:48,y:70,reagents:[],environment:"aqueous",observed:false}],
 selectedId:"v1",event:0,settings:defaultLabBenchSettings()
});
export function readLabBench(item:Item):LabBench{
 if(item.scienceLabBench)return item.scienceLabBench;
 const initial=defaultLabBench();
 initial.vessels[0].reagents=(item.scienceReagents??[]).slice(0,MAX_VESSEL_REAGENTS);
 initial.vessels[0].environment=item.scienceEnvironment??"aqueous";
 initial.vessels[0].observed=(item.scienceExperimentStage??0)===1;
 return initial;
}
export const selectedLabVessel=(bench:LabBench)=>bench.vessels.find(v=>v.id===bench.selectedId)??bench.vessels[0];
export function labObservation(vessel:LabVessel):{status:ReactionStatus;message:string;
 caseData?:ReturnType<typeof identifyReaction>["caseData"]}{
 if(vessel.reagents.length===0)return{status:"unknown",message:"Сосуд пуст."};
 if(vessel.uncertain)return{status:"unknown",
  message:"Смесь уже содержит продукты предыдущего опыта. Для следующего превращения требуется отдельная проверенная модель; продукты не предполагаются."};
 if(vessel.completedReaction)return{
  status:"reaction",message:vessel.completedReaction.description,caseData:vessel.completedReaction
 };
 if(vessel.reagents.length===1&&!vessel.observed)
  return{status:"unknown",message:"Добавьте второй реагент или настройте условия."};
 if(!vessel.observed)return{status:"unknown",message:"До смешивания изменений нет."};
 return identifyReaction(vessel.reagents,vessel.environment);
}
const bump=(bench:LabBench,vessels:LabVessel[],selectedId=bench.selectedId):LabBench=>({
 ...bench,vessels,selectedId,event:bench.event+1
});
const revise=(bench:LabBench,id:string,update:(v:LabVessel)=>LabVessel):LabBench=>{
 const vessels=bench.vessels.map(v=>v.id===id?update(v):v);
 return vessels.every((v,i)=>v===bench.vessels[i])?bench:bump(bench,vessels,id);
};
export function addLabVessel(bench:LabBench,kind:LabGlassware,position?:{x:number;y:number}):LabBench{
 if(bench.vessels.length>=MAX_BENCH_VESSELS)return bench;
 let n=1;while(bench.vessels.some(v=>v.id==="v"+n))n++;
 const index=bench.vessels.length;
 const next:LabVessel={id:"v"+n,kind,x:clamp(position?.x??(36+(index%3)*15)),
  y:clamp(position?.y??(index<3?70:79)),reagents:[],environment:"aqueous",observed:false};
 return bump(bench,[...bench.vessels,next],next.id);
}
export function positionLabVessel(bench:LabBench,id:string,x:number,y:number):LabBench{
 if(!bench.vessels.some(v=>v.id===id))return bench;
 return revise(bench,id,v=>({...v,x:clamp(x),y:clamp(y)}));
}
export function selectLabVessel(bench:LabBench,id:string):LabBench{
 return bench.selectedId===id?bench:bench.vessels.some(v=>v.id===id)?
  {...bench,selectedId:id}:bench;
}
export function removeLabVessel(bench:LabBench,id:string):LabBench{
 const target=bench.vessels.find(v=>v.id===id);
 if(!target||target.reagents.length>0)return bench; // Only clean glassware returns to storage.
 const vessels=bench.vessels.filter(v=>v.id!==id);
 return bump(bench,vessels,bench.selectedId===id?(vessels[0]?.id??""):bench.selectedId);
}
export function emptyLabVessel(bench:LabBench,id:string):LabBench{
 return revise(bench,id,v=>({...v,reagents:[],observed:false,uncertain:false,indicator:undefined,doses:undefined,completedReaction:undefined}));
}
export function setLabIndicator(bench:LabBench,id:string,indicator:LabIndicator|undefined):LabBench{
 if(!bench.vessels.some(v=>v.id===id&&v.reagents.length))return bench;
 return revise(bench,id,v=>v.indicator===indicator?v:{...v,indicator});
}
export function setLabEnvironment(bench:LabBench,id:string,environment:ReactionEnvironment):LabBench{
 return revise(bench,id,v=>({...v,environment,
  // Keep previous products opaque when reaction conditions change.
  uncertain:v.uncertain||labObservation(v).status==="reaction",
  observed:v.reagents.length>1||identifyReaction(v.reagents,environment).status==="reaction"}));
}
export function putLabReagent(bench:LabBench,id:string,reagent:string,dose?:LabDose):LabBench{
 if(!bench.vessels.some(v=>v.id===id))return bench;
 return revise(bench,id,v=>{
  const validDose=dose&&Number.isFinite(dose.value)&&dose.value>0&&
   dose.value<=10000&&(dose.unit==="ml"||dose.unit==="g")?dose:undefined;
  if(dose&&!validDose)return v;
  const present=v.reagents.includes(reagent);
  if(!present&&v.reagents.length>=MAX_VESSEL_REAGENTS)return v;
  const previous=v.doses?.[reagent];
  if(present&&!validDose)return v;
  if(previous&&validDose&&previous.unit!==validDose.unit)return v;
  const combined=validDose?{value:Math.round(((previous?.value??0)+validDose.value)*100)/100,
   unit:validDose.unit}:undefined;
  if(combined&&combined.value>10000)return v;
  const reagents=present?v.reagents:[...v.reagents,reagent];
  return {...v,reagents,
   doses:combined?{...v.doses,[reagent]:combined}:v.doses,
   observed:reagents.length>1,
   uncertain:v.uncertain||labObservation(v).status==="reaction"};
 });
}
/** Full transfer. Never assume that a second step using already reacted
 * mixtures can be predicted from their original reagent identifiers. */
export function activateLabVessel(bench:LabBench,id:string):LabBench{
 return revise(bench,id,v=>({...v,observed:true}));
}
/** Complete transfer of contents: products and their visible appearance move with
 * the liquid. Adding a new reagent to spent material is deliberately unknown. */
export function pourLabVessel(bench:LabBench,sourceId:string,targetId:string):LabBench{
 if(sourceId===targetId)return bench;
 const source=bench.vessels.find(v=>v.id===sourceId);
 const target=bench.vessels.find(v=>v.id===targetId);
 if(!source||!target||!source.reagents.length)return bench;
 const reagents=[...new Set([...target.reagents,...source.reagents])];
 if(reagents.length>MAX_VESSEL_REAGENTS)return bench;
 const incompatible=Object.entries(source.doses??{}).some(([id,dose])=>{
  const previous=target.doses?.[id];
  return previous&&(previous.unit!==dose.unit||previous.value+dose.value>10000);
 });
 if(incompatible)return bench;
 const targetWasEmpty=target.reagents.length===0;
 const sourceResult=labObservation(source),targetResult=labObservation(target);
 const sourceReaction=source.completedReaction??(sourceResult.status==="reaction"?sourceResult.caseData:undefined);
 const targetReaction=target.completedReaction??(targetResult.status==="reaction"?targetResult.caseData:undefined);
 const uncertain=Boolean(source.uncertain||target.uncertain||
  (!targetWasEmpty&&(sourceReaction||targetReaction))||
  (source.environment!==target.environment&&source.environment!=="aqueous"));
 const vessels=bench.vessels.map(v=>{
  if(v.id===sourceId)return {...v,reagents:[],observed:false,uncertain:false,
   completedReaction:undefined,indicator:undefined,doses:undefined};
  if(v.id===targetId){
   const doses={...v.doses};
   for(const [id,dose] of Object.entries(source.doses??{})){
    const old=doses[id];
    doses[id]={value:Math.round(((old?.value??0)+dose.value)*100)/100,unit:dose.unit};
   }
   return {...v,reagents,observed:reagents.length>1||source.observed,
    doses,environment:targetWasEmpty?source.environment:target.environment,
    completedReaction:targetWasEmpty?sourceReaction:(targetReaction??sourceReaction),
    indicator:v.indicator??source.indicator,
    uncertain:uncertain||Boolean(v.indicator&&source.indicator&&v.indicator!==source.indicator)};
  }
  return v;
 });
 return bump(bench,vessels,targetId);
}

/** Reconcile simultaneous edits to different vessels. Array replacement would
 * silently erase a peer's vessel. Merge by stable vessel ID and changed fields. */
export function mergeLabBench(previous:LabBench,mine:LabBench,remote:LabBench):LabBench{
 const old=new Map(previous.vessels.map(v=>[v.id,v]));
 const local=new Map(mine.vessels.map(v=>[v.id,v]));
 const peer=new Map(remote.vessels.map(v=>[v.id,v]));
 const allIds=new Set([...old.keys(),...peer.keys(),...local.keys()]);
 const vessels:LabVessel[]=[];
 for(const id of allIds){
  const base=old.get(id),a=local.get(id),b=peer.get(id);
  if(!a&&base)continue; // Explicit local removal
  if(!b&&base&&a&&JSON.stringify(a)===JSON.stringify(base))continue; // Peer removal
  if(!a){if(b)vessels.push(b);continue}
  if(!base||!b){vessels.push(a);continue}
  const merged={...b} as LabVessel;
  for(const key of Object.keys(a) as (keyof LabVessel)[]){
   if(JSON.stringify(a[key])!==JSON.stringify(base[key])){
    // Independent additions to the same beaker should both survive.
    if(key==="reagents"&&Array.isArray(a.reagents)&&
      JSON.stringify(b.reagents)!==JSON.stringify(base.reagents)){
      const baseSet=new Set(base.reagents);
      const removed=new Set(base.reagents.filter(v=>!a.reagents.includes(v)));
      merged.reagents=[...new Set([...b.reagents.filter(v=>!removed.has(v)),
       ...a.reagents.filter(v=>!baseSet.has(v))])].slice(0,MAX_VESSEL_REAGENTS);
    }else (merged as unknown as Record<string,unknown>)[key]=a[key];
   }
  }
  vessels.push(merged);
 }
 const limited=vessels.slice(0,MAX_BENCH_VESSELS);
 const selectedId=limited.some(v=>v.id===mine.selectedId)?mine.selectedId:
  limited.some(v=>v.id===remote.selectedId)?remote.selectedId:(limited[0]?.id??"");
 const originalSettings=labBenchSettings(previous),mineSettings=labBenchSettings(mine);
 const settings={...labBenchSettings(remote)};
 for(const key of Object.keys(mineSettings) as (keyof LabBenchSettings)[]){
  if(mineSettings[key]!==originalSettings[key])settings[key]=mineSettings[key];
 }
 return {vessels:limited,selectedId,settings,event:Math.max(remote.event,mine.event)+1};
}
