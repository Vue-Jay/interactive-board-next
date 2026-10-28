import type {Item} from "./boardModel";
import {identifyReaction,substances,type ReactionEnvironment,type ReactionStatus} from "./lektrusReactionDatabase";

export type LabGlassware="beaker"|"tube"|"flask";
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
};
export type LabBench={vessels:LabVessel[];selectedId:string;event:number};
export const MAX_BENCH_VESSELS=6,MAX_VESSEL_REAGENTS=6;
const clamp=(v:number)=>Math.round(Math.min(92,Math.max(8,v))*10)/10;
export const defaultLabBench=():LabBench=>({
 vessels:[{id:"v1",kind:"beaker",x:48,y:57,reagents:[],environment:"aqueous",observed:false}],
 selectedId:"v1",event:0
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
 if(vessel.reagents.length===1&&!vessel.observed)
  return{status:"unknown",message:"Добавьте второй реагент или настройте условия."};
 if(vessel.uncertain)return{status:"unknown",
  message:"Смесь уже содержит продукты предыдущего опыта. Для следующего превращения требуется отдельная проверенная модель; продукты не предполагаются."};
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
export function addLabVessel(bench:LabBench,kind:LabGlassware):LabBench{
 if(bench.vessels.length>=MAX_BENCH_VESSELS)return bench;
 let n=1;while(bench.vessels.some(v=>v.id==="v"+n))n++;
 const position=bench.vessels.length;
 const next:LabVessel={id:"v"+n,kind,x:23+(position%3)*25,
  y:position<3?49:76,reagents:[],environment:"aqueous",observed:false};
 return bump(bench,[...bench.vessels,next],next.id);
}
export function positionLabVessel(bench:LabBench,id:string,x:number,y:number):LabBench{
 if(!bench.vessels.some(v=>v.id===id))return bench;
 return revise(bench,id,v=>({...v,x:clamp(x),y:clamp(y)}));
}
export function selectLabVessel(bench:LabBench,id:string):LabBench{
 return bench.vessels.some(v=>v.id===id)?{...bench,selectedId:id}:bench;
}
export function removeLabVessel(bench:LabBench,id:string):LabBench{
 if(bench.vessels.length<=1)return bench;
 const vessels=bench.vessels.filter(v=>v.id!==id);
 return bump(bench,vessels,bench.selectedId===id?vessels[0].id:bench.selectedId);
}
export function emptyLabVessel(bench:LabBench,id:string):LabBench{
 return revise(bench,id,v=>({...v,reagents:[],observed:false,uncertain:false,indicator:undefined}));
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
export function putLabReagent(bench:LabBench,id:string,reagent:string):LabBench{
 if(!bench.vessels.some(v=>v.id===id))return bench;
 return revise(bench,id,v=>{
  if(v.reagents.includes(reagent)||v.reagents.length>=MAX_VESSEL_REAGENTS)return v;
  const reagents=[...v.reagents,reagent];
  return {...v,reagents,observed:reagents.length>1,
   uncertain:v.uncertain||labObservation(v).status==="reaction"};
 });
}
/** Full transfer. Never assume that a second step using already reacted
 * mixtures can be predicted from their original reagent identifiers. */
export function activateLabVessel(bench:LabBench,id:string):LabBench{
 return revise(bench,id,v=>({...v,observed:true}));
}
export function pourLabVessel(bench:LabBench,sourceId:string,targetId:string):LabBench{
 if(sourceId===targetId)return bench;
 const source=bench.vessels.find(v=>v.id===sourceId);
 const target=bench.vessels.find(v=>v.id===targetId);
 if(!source||!target||!source.reagents.length)return bench;
 const reagents=[...new Set([...target.reagents,...source.reagents])];
 if(reagents.length>MAX_VESSEL_REAGENTS)return bench;
 const uncertain=Boolean(source.uncertain||target.uncertain||
  labObservation(source).status==="reaction"||
  labObservation(target).status==="reaction"||
  source.environment!==target.environment&&source.environment!=="aqueous");
 const vessels=bench.vessels.map(v=>{
  if(v.id===sourceId)return {...v,reagents:[],observed:false,uncertain:false,indicator:undefined};
  if(v.id===targetId)return {...v,reagents,observed:reagents.length>1,
   indicator:v.indicator??source.indicator,
   uncertain:uncertain||Boolean(v.indicator&&source.indicator&&v.indicator!==source.indicator)};
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
 if(!limited.length)return defaultLabBench();
 const selectedId=limited.some(v=>v.id===mine.selectedId)?mine.selectedId:
  limited.some(v=>v.id===remote.selectedId)?remote.selectedId:limited[0].id;
 return {vessels:limited,selectedId,event:Math.max(remote.event,mine.event)+1};
}
