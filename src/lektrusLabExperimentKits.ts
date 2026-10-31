/** Curated experiment kits: only measured cupboard reagents, suitable glassware
 * and optional unpowered equipment. A kit never starts a reaction on its own.
 * Replacing a tabletop is an EXPLICIT user choice in the catalogue UI. */
import {labDefaultStockDose,labReagentForms} from "./lektrusLabCatalog";
import {substances,type ReactionCase} from "./lektrusReactionDatabase";
import {addPlacedLabDevice,canMountLabVessel,type LabBench,type LabGlassware,
 type LabDose,type LabVessel,type LabAvailableDevice} from "./lektrusChemistryBenchModel";

const glassName:Record<LabGlassware,string>={
 beaker:"Стакан",tube:"Пробирка",flask:"Колба",conical:"Коническая колба",
 crucible:"Тигель",dish:"Чашка",pipette:"Пипетка",burette:"Бюретка",
 cylinder:"Мерный цилиндр",volumetric:"Мерная колба"
};
const layout=[{x:32,y:70},{x:67,y:70},{x:82,y:70}];
const isWet=(row:ReactionCase)=>row.environment==="aqueous";
const dryHeating=(row:ReactionCase)=>row.environment==="heated"||row.environment==="ignited";
export function labExperimentGlassware(row:ReactionCase):LabGlassware[]{
 return row.reactants.map((_,i)=>{
  if(i>0)return "tube";
  if(dryHeating(row))return row.reactants.length===1?"crucible":"crucible";
  return row.reactants.length===1?"tube":row.reactants.length===3?"conical":"beaker";
 });
}
export function labExperimentEquipment(row:ReactionCase):LabAvailableDevice[]{
 if(dryHeating(row))return ["burner","tripod"];
 return [];
}
export function labExperimentDose(row:ReactionCase,id:string):LabDose|undefined{
 const entry=substances.find(s=>s.id===id);
 if(!entry)return;
 const forms=labReagentForms(entry);
 // In aqueous experiments use prepared school solutions where possible.
 // In combustion/decomposition prefer a weighed solid, not an invented
 // liquid form of metals/oxides. Gases remain measured by volume.
 const unit:isUnit = isWet(row)&&forms.includes("ml")?"ml":
  forms.includes("g")?"g":"ml";
 const dose=labDefaultStockDose(id,unit);
 if(!dose)return;
 // A small amount is more legible in the narrow test tubes, does not
 // fill the receiver excessively and keeps hot experiments controlled.
 return {...dose,value:unit==="ml"?5:0.5};
}
type isUnit="ml"|"g";
export function labExperimentKitSummary(row:ReactionCase){
 const glassware=labExperimentGlassware(row);
 const equipment=labExperimentEquipment(row);
 return {
  glassware:glassware.map(g=>glassName[g]),
  equipment:equipment.map(k=>k==="burner"?"Горелка":k==="tripod"?"Штатив":k),
  conditions:row.environment==="heated"?"Нагревание":row.environment==="ignited"?
   "Воспламенение":row.environment==="dry"?"Сухие вещества":"Растворы",
  recommended:row.reactants.length<=2&&row.environment==="aqueous"&&
   ["precipitate","gas","color"].includes(row.observation)
 };
}
export function prepareLabExperimentKit(bench:LabBench,row:ReactionCase):LabBench{
 if(row.status!=="reaction"||!row.reactants.length||row.reactants.length>3||
  row.reactants.some(id=>!labExperimentDose(row,id)))return bench;
 const kinds=labExperimentGlassware(row);
 const vessels:LabVessel[]=row.reactants.map((id,i)=>{
  const dose=labExperimentDose(row,id)!;
  const pos=layout[row.reactants.length===3?i:i===0?0:1];
  return {id:"v"+(i+1),kind:kinds[i],x:pos.x,y:pos.y,reagents:[id],
   doses:{[id]:dose},environment:isWet(row)?"aqueous":"dry",
   observed:false};
 });
 // No old powered equipment or stale object IDs follow a new experiment.
 let result:LabBench={...bench,vessels,selectedId:vessels[0].id,
  placedDevices:[],devices:[],stirringVesselId:undefined,
  titration:undefined,titrationPair:undefined,instrumentTarget:undefined,
  pouring:undefined,simulationAtMs:undefined,event:bench.event+1};
 const devices=labExperimentEquipment(row);
 for(const [i,kind] of devices.entries()){
  result=addPlacedLabDevice(result,kind,kind==="tripod"?{x:49,y:65}:
   {x:50,y:79+i});
 }
 // Heater and stand are only arranged near the reaction vessel. Do NOT
 // switch on flame or auto-fire reactions in an unattended classroom.
 // If the vessel does not fit the tool, leave the tool detached.
 result={...result,placedDevices:result.placedDevices?.map(d=>({
  ...d,active:false,linkedVesselId:undefined,powered:false
 }))};
 // Use the same compatible glassware rules as the rest of the laboratory.
 if(devices.length&&devices.some(d=>canMountLabVessel(d,kinds[0]))){
  return result;
 }
 return result;
}
