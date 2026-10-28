import type {Item} from "./boardModel";
import {identifyReaction,type ReactionEnvironment,type ReactionStatus} from "./lektrusReactionDatabase";

export type LabGlassware="beaker"|"tube"|"flask";
export type LabVessel={
 id:string;kind:LabGlassware;x:number;y:number;
 reagents:string[];environment:ReactionEnvironment;
 observed:boolean;uncertain?:boolean;
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
const revise=(bench:LabBench,id:string,update:(v:LabVessel)=>LabVessel):LabBench=>
 bump(bench,bench.vessels.map(v=>v.id===id?update(v):v),id);
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
 return revise(bench,id,v=>({...v,reagents:[],observed:false,uncertain:false}));
}
export function setLabEnvironment(bench:LabBench,id:string,environment:ReactionEnvironment):LabBench{
 return revise(bench,id,v=>({...v,environment,
  // Keep previous products opaque when reaction conditions change.
  uncertain:v.uncertain||v.observed&&v.reagents.length>1,
  observed:v.observed||v.reagents.length>1}));
}
export function putLabReagent(bench:LabBench,id:string,reagent:string):LabBench{
 if(!bench.vessels.some(v=>v.id===id))return bench;
 return revise(bench,id,v=>{
  if(v.reagents.includes(reagent)||v.reagents.length>=MAX_VESSEL_REAGENTS)return v;
  const reagents=[...v.reagents,reagent];
  return {...v,reagents,observed:reagents.length>1,
   uncertain:v.uncertain||v.observed&&v.reagents.length>1};
 });
}
/** Full transfer. Never assume that a second step using already reacted
 * mixtures can be predicted from their original reagent identifiers. */
export function pourLabVessel(bench:LabBench,sourceId:string,targetId:string):LabBench{
 if(sourceId===targetId)return bench;
 const source=bench.vessels.find(v=>v.id===sourceId);
 const target=bench.vessels.find(v=>v.id===targetId);
 if(!source||!target||!source.reagents.length)return bench;
 const reagents=[...new Set([...target.reagents,...source.reagents])];
 if(reagents.length>MAX_VESSEL_REAGENTS)return bench;
 const uncertain=Boolean(source.uncertain||target.uncertain||
  source.observed&&source.reagents.length>1||
  target.observed&&target.reagents.length>1||
  source.environment!==target.environment&&source.environment!=="aqueous");
 const vessels=bench.vessels.map(v=>{
  if(v.id===sourceId)return {...v,reagents:[],observed:false,uncertain:false};
  if(v.id===targetId)return {...v,reagents,observed:reagents.length>1,
   uncertain};
  return v;
 });
 return bump(bench,vessels,targetId);
}
