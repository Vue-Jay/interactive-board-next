import type {Item} from "./boardModel";
import {labVesselPH,labIndicatorTint} from "./lektrusLabPH";
import {labDefaultStockDose,labIsPreparedStock,LAB_STOCK_MOLARITY_M} from "./lektrusLabCatalog";
import {labVesselThermal} from "./lektrusLabPhysicalProperties";
import {labSensibleHeatStep} from "./lektrusLabCalorimetry";
import {labBinarySaltEquilibrium,labAdvanceBinarySaltPhase,labVisibleBinarySaltSolid,
 labSchoolMixedSaltEquilibrium,labAdvanceSchoolMixedSaltPhase,
 type LabBinarySaltState} from "./lektrusLabDissolution";
import {labReactionGasProgress} from "./lektrusLabGasDynamics";
import {labEvaporate,labCanStopper,labIdealBoilingC,labVaporPressureKPa} from "./lektrusLabEvaporation";
import {LAB_CRYSTAL_DENSITY_G_ML,labSchoolSolidDensityGml,labSingleSaltSolubilityGPer100gWater} from "./lektrusLabMaterialConstants";
import {startQuantifiedLabReaction,advanceQuantifiedLabReaction,parseBalancedLabEquation,labMolarMass,labDoseMoles,type LabReactionAmounts}
 from "./lektrusLabStoichiometry";
import {labDisplayPoint,labLogicalPoint,labMountedGlasswarePoint,labStandBaseVesselPoint} from "./lektrusLabLayout";
import {addTitrant,defaultTitration,resetTitration,validTitration,type TitrationModel}
 from "./lektrusLabTitration";
import {identifyReaction,reviewedReactionCases,substances,type ReactionEnvironment,type ReactionStatus,type ReactionCase} from "./lektrusReactionDatabase";
import {simulateLabInventory,labInventorySnapshot,type LabChemicalSnapshot} from "./lektrusLabReactionNetwork";

export type LabGlassware="beaker"|"tube"|"flask"|"cylinder"|"dish"|
 "conical"|"volumetric"|"crucible"|"pipette"|"burette";
export const labGlassware:{id:LabGlassware;name:string;description:string}[]=[
 {id:"beaker",name:"Стакан",description:"Смешивание растворов"},
 {id:"tube",name:"Пробирка",description:"Небольшие пробы"},
 {id:"flask",name:"Колба",description:"Работа с жидкостями"},
 {id:"dish",name:"Чашка",description:"Открытый сосуд"},
 {id:"conical",name:"Коническая колба",description:"Титрование и перемешивание"},
 {id:"crucible",name:"Тигель",description:"Нагревание твёрдых веществ"},
 {id:"pipette",name:"Пипетка",description:"Отбор и перенос точного объёма"},
 {id:"burette",name:"Бюретка",description:"Дозирование при титровании"}
];
/** A work mode selects the useful tools; existing apparatus stays on the table. */
/** Legacy qualitative/quantitative values are migrated on read. */
export type LabMode="reactions"|"qualitative"|"quantitative"|"titration"|"solutions"|"synthesis"|"evaporation";
export const LAB_MODES:{id:LabMode;name:string;description:string;
 glassware:LabGlassware[];devices:LabAvailableDevice[]}[]=[
 {id:"reactions",name:"Реакции",
  description:"Качественные наблюдения и расчёты по измеренным количествам",
  glassware:["tube","beaker","pipette","conical","dish","flask"],
  devices:["tripod","burner","hotplate","stirrer","filter"]},
 {id:"titration",name:"Титрование",
  description:"Бюретка со штативом, дозирование по каплям и точка эквивалентности",
  glassware:["burette","conical","pipette","beaker"],
  devices:["tripod","stirrer"]},
 {id:"solutions",name:"Приготовление растворов",
  description:"Растворение, дозирование и перемешивание",
  glassware:["beaker","pipette","flask","conical"],
  devices:["stirrer","hotplate","tripod"]},
 {id:"evaporation",name:"Выпаривание",
  description:"Нагревание водного раствора, удаление растворителя и рост кристаллов",
  glassware:["dish","beaker","flask","conical","pipette"],
  devices:["hotplate","burner","tripod","stirrer"]},
 {id:"synthesis",name:"Синтез",
  description:"Нагревание, получение и сбор продуктов проверенных превращений",
  glassware:["flask","conical","tube","beaker","crucible","dish"],
  devices:["tripod","burner","hotplate","stirrer","filter"]}
];
export const labMode=(bench:LabBench):LabMode=>
 bench.mode==="qualitative"||bench.mode==="quantitative"?"reactions":
 LAB_MODES.some(m=>m.id===bench.mode)?bench.mode!:"reactions";
export const labModeInfo=(bench:LabBench)=>LAB_MODES.find(m=>m.id===labMode(bench))!;
export function setLabMode(bench:LabBench,mode:LabMode):LabBench{
 if(!LAB_MODES.some(v=>v.id===mode)||labMode(bench)===mode)return bench;
 return {...bench,mode,event:bench.event+1};
}
export const glasswareForLabMode=(bench:LabBench)=>
 labModeInfo(bench).glassware.flatMap(id=>labGlassware.filter(v=>v.id===id));
export const devicesForLabMode=(bench:LabBench)=>
 labModeInfo(bench).devices.flatMap(id=>labDevices.filter(v=>v.id===id));

export type LabDose={value:number;unit:"ml"|"g";concentrationM?:number};
/** Preserved heat exchange from one verified reaction, not a predicted
 * experiment temperature. All clients advance the same progress. */
export type LabReactionHeat={
 equation:string;direction:"exothermic"|"endothermic";
 elapsedSeconds:number;durationSeconds:number;deltaC:number;complete:boolean;
};
export type LabDevice="hotplate"|"burner"|"stirrer"|"tripod"|"filter"|"thermometer";
export type LabAvailableDevice=Exclude<LabDevice,"thermometer">;
export const labDevices:{id:LabAvailableDevice;name:string;description:string;symbol:string}[]=[
 {id:"hotplate",name:"Плитка",description:"Для посуды с устойчивым плоским дном",symbol:"▤"},
 {id:"burner",name:"Горелка",description:"Нагревание посуды над пламенем",symbol:"♨"},
 {id:"stirrer",name:"Магнитная мешалка",description:"Перемешивание в плоскодонных сосудах",symbol:"◌"},
 {id:"tripod",name:"Штатив",description:"Один регулируемый зажим для посуды",symbol:"⌁"},
 {id:"filter",name:"Мембранный фильтр",description:"Отделение твёрдого осадка от жидкого фильтрата",symbol:"▧"}
];
export type LabPlacedDevice={id:string;kind:LabDevice;x:number;y:number;
 /** Mounted on the vessel, regardless of power. */ active?:boolean;
 linkedVesselId?:string;
 powered?:boolean;heatLevel?:1|2|3;temperatureC?:number;
 targetTemperatureC?:number;standHeight?:number;shelfVesselId?:string;
 /** Solid retained inside the cartridge after pouring a precipitated mixture. */
 collectedResidue?:LabFilteredResidue;filterStartedAtMs?:number;};
export type LabFilteredResidue={formula:string;massG?:number;color:string;
 /** Each retained solid is conserved separately, even with one cartridge. */
 components?:{formula:string;massG:number;color:string}[]};
export const MAX_LAB_DEVICES=10;
const clampDevice=(v:number,min:number,max:number)=>Math.round(Math.min(max,Math.max(min,v))*10)/10;
/** V1 cabinets only stored the types. Preserve them when a board is upgraded. */
export function placedLabDevices(bench:LabBench):LabPlacedDevice[]{
 if(bench.placedDevices)return bench.placedDevices.filter(d=>d.kind!=="thermometer").map(d=>
  d.kind==="tripod"&&d.shelfVesselId?{...d,active:!!(d.linkedVesselId||d.shelfVesselId),
   linkedVesselId:d.linkedVesselId??d.shelfVesselId,shelfVesselId:undefined}:d);
 return (bench.devices??[]).filter(kind=>kind!=="thermometer").map((kind,i)=>({
  id:"legacy-"+kind,kind,x:35+(i%4)*11,y:74+Math.floor(i/4)*5
 }));
}
export function addPlacedLabDevice(bench:LabBench,kind:LabDevice,point?:{x:number;y:number}):LabBench{
 if(!labDevices.some(v=>v.id===kind))return bench;
 const existing=placedLabDevices(bench);
 if(existing.length>=MAX_LAB_DEVICES)return bench;
 const occupied=existing.length;
 const id="device-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9);
 const placed:LabPlacedDevice={id,kind,
  x:clampDevice(point?.x??(22+(occupied%5)*13),9,79),
  y:clampDevice(point?.y??(62+Math.floor(occupied/5)*22),58,kind==="tripod"?72:84),
  powered:false,heatLevel:2,temperatureC:22,targetTemperatureC:150,standHeight:kind==="tripod"?.88:.5};
 return {...bench,placedDevices:[...existing,placed],
  devices:[...new Set([...(bench.devices??[]),kind])],event:bench.event+1};
}
export function movePlacedLabDevice(bench:LabBench,id:string,x:number,y:number):LabBench{
 const existing=placedLabDevices(bench),source=existing.find(d=>d.id===id);
 if(!source)return bench;
 const updated={...source,x:clampDevice(x,9,79),y:clampDevice(y,58,source.kind==="tripod"?72:84)};
 // A shared heater and clamp are two separate units. Moving just one
 // releases that fixture, without touching its power switch.
 const shared=!!source.linkedVesselId&&existing.some(d=>d.id!==id&&d.active&&
  d.linkedVesselId===source.linkedVesselId);
 const placedDevices=existing.map(d=>d.id===id?
  (shared?{...updated,active:false,linkedVesselId:undefined}:updated):d);
 const positions=new Map<string,{x:number;y:number}>();
 const savePosition=(vesselId:string|undefined,kind:string)=>{
  const vessel=bench.vessels.find(v=>v.id===vesselId);
  if(!vessel)return;
  positions.set(vessel.id,labLogicalPoint(labMountedGlasswarePoint({...updated,kind},
   vessel,1600,1000,bench.vessels.length>3)));
 };
 if(source.active&&!shared)savePosition(source.linkedVesselId,source.kind);

 return {...bench,placedDevices,
  vessels:bench.vessels.map(v=>positions.has(v.id)?{...v,...positions.get(v.id)!}:v),
  stirringVesselId:shared&&source.kind==="stirrer"?undefined:bench.stirringVesselId,
  event:bench.event+1};
}
export function returnPlacedLabDevice(bench:LabBench,id:string):LabBench{
 const existing=placedLabDevices(bench),target=existing.find(d=>d.id===id);
 if(!target)return bench;
 const normalized=target.active?stopPlacedLabDevice(bench,id):bench;
 const placedDevices=placedLabDevices(normalized).filter(d=>d.id!==id);
 const devices=[...new Set(placedDevices.map(d=>d.kind))];
 const vessels=normalized.vessels.map(v=>{
  if(v.restingOnStandId!==id)return v;
  const foot=labStandBaseVesselPoint(target,v,1600,1000);
  return {...v,...labLogicalPoint(foot),restingOnStandId:undefined};
 });
 return {...normalized,vessels,placedDevices,devices,event:normalized.event+1,
  stirringVesselId:normalized.stirringVesselId,
  instrumentTarget:normalized.instrumentTarget};
}
/** Only appropriate vessel types are heated; do not fabricate temperatures,
 * reaction products or a laboratory measurement outside the reviewed database. */
/** Glassware may be supported/held only where its geometry is appropriate. */
/** Base geometry and safe laboratory placement matrix.
 * Flat plates need a stable flat bottom, while a ring/clamp stand can hold
 * tubes, narrow necks, a crucible or a beaker on gauze. */
const LAB_MOUNTABLE:Record<LabAvailableDevice,readonly LabGlassware[]>={
 tripod:["beaker","tube","flask","conical","volumetric","crucible","pipette","burette","dish"],
 filter:[],
 hotplate:["beaker","conical","dish"],
 stirrer:["beaker","conical"],
 burner:["beaker","tube","flask","conical","crucible","dish"]
};
export function canMountLabVessel(kind:LabPlacedDevice["kind"],glass:LabGlassware){
 return kind!=="thermometer"&&LAB_MOUNTABLE[kind].includes(glass);
}
/** A burner may heat a vessel secured by the retort stand; all other
 * combinations use just one support to avoid physically conflicting mounts. */
const mayShareLabVessel=(a:LabDevice,b:LabDevice)=>
 (a==="burner"&&b==="tripod")||(a==="tripod"&&b==="burner");
/** Historical shelf operations now use the stand's single clamp.
 * Earlier two-holder tables are normalized by placedLabDevices. */
export const LAB_STAND_SHELF_TYPES:readonly LabGlassware[]=["beaker","conical","crucible","dish"];
export function setLabStandShelf(bench:LabBench,id:string,vesselId?:string):LabBench{
 const stand=placedLabDevices(bench).find(d=>d.id===id&&d.kind==="tripod");
 if(!stand)return bench;
 if(vesselId)return applyPlacedLabDevice(bench,id,vesselId,"clamp");
 return {...bench,placedDevices:placedLabDevices(bench).map(d=>d.id===id?
  {...d,active:false,linkedVesselId:undefined,shelfVesselId:undefined}:d),
  event:bench.event+1};
}
export function setLabStandHeight(bench:LabBench,id:string,height:number):LabBench{
 const stand=placedLabDevices(bench).find(d=>d.id===id&&d.kind==="tripod");
 if(!stand||!Number.isFinite(height))return bench;
 const standHeight=clampDevice(height,0,1);
 if(stand.standHeight===standHeight)return bench;
 const updated={...stand,standHeight};
 const vessel=bench.vessels.find(v=>v.id===stand.linkedVesselId);
 const logical=vessel?labLogicalPoint(labMountedGlasswarePoint(updated,vessel,
  1600,1000,bench.vessels.length>3)):null;
 return {...bench,
  placedDevices:placedLabDevices(bench).map(d=>d.id===id?updated:d),
  vessels:logical?bench.vessels.map(v=>v.id===vessel?.id?{...v,...logical}:v):bench.vessels,
  event:bench.event+1};
}
export function setLabHotplateTemperature(bench:LabBench,id:string,temperature:number):LabBench{
 const device=placedLabDevices(bench).find(d=>d.id===id&&d.kind==="hotplate");
 if(!device||!Number.isFinite(temperature))return bench;
 const targetTemperatureC=Math.round(Math.min(350,Math.max(30,temperature)));
 if(device.targetTemperatureC===targetTemperatureC)return bench;
 return {...bench,placedDevices:placedLabDevices(bench).map(d=>d.id===id?
  {...d,targetTemperatureC}:d),event:bench.event+1};
}
export function applyPlacedLabDevice(bench:LabBench,id:string,vesselId:string,
 mount:"clamp"|"shelf"="clamp"):LabBench{
 if(mount==="shelf")return setLabStandShelf(bench,id,vesselId);
 const device=placedLabDevices(bench).find(d=>d.id===id);
 const vessel=bench.vessels.find(v=>v.id===vesselId);
 if(!device||!vessel||!canMountLabVessel(device.kind,vessel.kind))return bench;
 if(device.active&&device.linkedVesselId===vesselId)return bench;
 const companion=placedLabDevices(bench).find(d=>d.id!==id&&d.active&&
  d.linkedVesselId===vesselId&&mayShareLabVessel(device.kind,d.kind));
 // A retort stand and a burner are not independent, distant heaters:
 // align the flame under the vessel held in the upper clamp.
 const aligned=companion?{
  ...device,
  x:clampDevice(companion.x+(device.kind==="burner"?2.2:-2.2),9,79),
  y:clampDevice(companion.y+(device.kind==="burner"?10:-10),58,84)
 }:device;
 const placedDevices=placedLabDevices(bench).map(d=>d.id===id?
  {...aligned,active:true,linkedVesselId:vesselId,shelfVesselId:undefined}:
  d.linkedVesselId===vesselId&&d.active&&!mayShareLabVessel(device.kind,d.kind)?
  {...d,active:false,linkedVesselId:undefined}:
  d.shelfVesselId===vesselId?{...d,shelfVesselId:undefined}:d);
 const stand=placedDevices.find(d=>d.kind==="tripod"&&d.active&&d.linkedVesselId===vesselId);
 const anchor=stand??aligned;
 const point=labMountedGlasswarePoint(anchor,vessel,1600,1000,bench.vessels.length>3);
 const logical=labLogicalPoint(point);
 const mixer=placedDevices.find(d=>d.kind==="stirrer"&&d.active&&d.powered&&
  d.linkedVesselId&&bench.vessels.some(v=>v.id===d.linkedVesselId&&v.reagents.length));
 return {...bench,placedDevices,
  vessels:bench.vessels.map(v=>v.id===vesselId?{...v,x:logical.x,y:logical.y,restingOnStandId:undefined}:v),
  stirringVesselId:mixer?.linkedVesselId,
  event:bench.event+1};
}
/** Apparatus standing below a suspended vessel is NOT attached to its clamp.
 * The vertical limits approximate tabletop distance to the burner flame or
 * the magnetic drive plate. No heater affects a high-raised vessel. */
export function labAppliancesBelowStand(bench:LabBench,vesselId:string){
 const stands=placedLabDevices(bench).filter(d=>d.kind==="tripod"&&
  d.active&&d.linkedVesselId===vesselId);
 return placedLabDevices(bench).filter(d=>
  ["hotplate","burner","stirrer"].includes(d.kind)&&stands.some(stand=>{
   const maxHeight=d.kind==="burner"?.7:.36;
   return (stand.standHeight??.5)<=maxHeight&&
    Math.abs(d.x-(stand.x+3.5))<=7&&
    d.y>stand.y+1&&d.y<=stand.y+17;
  }));
}
/** A free vessel rests on the rectangular foot, directly under the clamp. */
export function placeLabVesselOnStandBase(bench:LabBench,vesselId:string,standId:string):LabBench{
 const stand=placedLabDevices(bench).find(d=>d.id===standId&&d.kind==="tripod");
 const vessel=bench.vessels.find(v=>v.id===vesselId);
 if(!stand||!vessel||stand.linkedVesselId===vesselId)return bench;
 const point=labStandBaseVesselPoint(stand,vessel,1600,1000,bench.vessels.length>3);
 const logical=labLogicalPoint(point);
 const positioned=positionLabVessel(bench,vesselId,logical.x,logical.y);
 return revise(positioned,vesselId,v=>({...v,restingOnStandId:standId}));
}
/** Only glassware physically positioned over the stand foot receives
 * liquid from a clamped burette; geometry is shared with drop placement. */
export function labReceiverBelowStand(bench:LabBench,sourceId:string):LabVessel|undefined{
 const devices=placedLabDevices(bench);
 const stand=devices.find(d=>d.kind==="tripod"&&d.active&&d.linkedVesselId===sourceId);
 if(!stand)return;
 return bench.vessels.filter(v=>v.id!==sourceId&&
  !devices.some(d=>d.active&&d.linkedVesselId===v.id)&&
  ["beaker","conical","flask","tube","cylinder"].includes(v.kind))
  .map(v=>{
   const p=labDisplayPoint(v,bench.vessels.length>3);
   const foot=labStandBaseVesselPoint(stand,v,1600,1000,bench.vessels.length>3);
   return {v,distance:v.restingOnStandId===stand.id?0:
    Math.hypot((p.x-foot.x)*16,(p.y-foot.y)*10)};
  })
  .filter(({distance})=>distance<=67)
  .sort((a,b)=>a.distance-b.distance)[0]?.v;
}
export function setPlacedDevicePower(bench:LabBench,id:string,powered:boolean):LabBench{
 const d=placedLabDevices(bench).find(v=>v.id===id);
 if(!d||d.kind==="tripod"||d.kind==="thermometer")return bench;
 if(Boolean(d.powered)===powered)return bench;
 const placedDevices=placedLabDevices(bench).map(v=>v.id===id?{...v,powered}:v);
 return {...bench,placedDevices,
  stirringVesselId:d.kind==="stirrer"?
   (powered&&bench.vessels.some(v=>v.id===d.linkedVesselId&&v.reagents.length)?
    d.linkedVesselId:undefined):bench.stirringVesselId,
  event:bench.event+1};
}
export function setPlacedDeviceLevel(bench:LabBench,id:string,level:1|2|3):LabBench{
 const d=placedLabDevices(bench).find(v=>v.id===id);
 if(!d||!["hotplate","burner","stirrer"].includes(d.kind)||
  ![1,2,3].includes(level))return bench;
 return {...bench,placedDevices:placedLabDevices(bench).map(v=>v.id===id?
  {...v,heatLevel:level}:v),event:bench.event+1};
}
export function stopPlacedLabDevice(bench:LabBench,id:string):LabBench{
 const target=placedLabDevices(bench).find(d=>d.id===id);
 if(!target)return bench;
 const placedDevices=placedLabDevices(bench).map(d=>d.id===id?
  {...d,active:false,linkedVesselId:undefined,shelfVesselId:undefined}:d);
 return {...bench,placedDevices,
  stirringVesselId:target.kind==="stirrer"&&
   bench.stirringVesselId===target.linkedVesselId?undefined:bench.stirringVesselId,
  instrumentTarget:target.kind==="tripod"&&
   bench.instrumentTarget?.vesselId===target.linkedVesselId?undefined:bench.instrumentTarget,
  event:bench.event+1};
}
/** Burette valve is attached to a specific target and has an actual flow rate. */
export const LAB_DRIP_RATES=[.05,.2,1] as const;
export function setLabBuretteValve(bench:LabBench,id:string,open:boolean,
 targetId?:string,rateMlS?:number):LabBench{
 const source=bench.vessels.find(v=>v.id===id);
 if(source?.kind!=="burette")return bench;
 const target=targetId??labReceiverBelowStand(bench,id)?.id??source.buretteTargetId;
 const clamped=placedLabDevices(bench).some(d=>d.kind==="tripod"&&
  d.active&&d.linkedVesselId===id);
 if(open&&(!source.reagents.length||!target||target===id||
  !bench.vessels.some(v=>v.id===target)||
  (clamped&&labReceiverBelowStand(bench,id)?.id!==target)))return bench;
 const rate=rateMlS??source.buretteRateMlS??.2;
 if(!LAB_DRIP_RATES.some(v=>v===rate))return bench;
 return revise(bench,id,v=>({...v,buretteOpen:open,buretteTargetId:target,
  buretteRateMlS:rate,buretteRemainderMl:open&&!v.buretteOpen?0:v.buretteRemainderMl}));
}
export function dispenseLabBurette(bench:LabBench,id:string,targetId:string,ml:number):LabBench{
 const src=bench.vessels.find(v=>v.id===id);
 if(src?.kind!=="burette"||!src.reagents.length||!Number.isFinite(ml)||ml<=0)return bench;
 if(labTitrationTargets(bench,id).some(v=>v.id===targetId))
  return dripLabVessel(bench,id,targetId,ml);
 const reagent=src.reagents[0],dose=src.doses?.[reagent];
 const target=bench.vessels.find(v=>v.id===targetId);
 if(!target||!["beaker","conical","flask","tube"].includes(target.kind)||
  !dose||dose.unit!=="ml"||dose.value<=0)return bench;
 const amount=Math.min(dose.value,Math.round(ml*100)/100);
 if(amount<=0)return bench;
 const updated=putLabReagent(bench,targetId,reagent,{...dose,value:amount});
 if(updated===bench)return bench;
 const vessels=updated.vessels.map(v=>v.id!==id?v:{
  ...v,
  doses:dose.value>amount?{...v.doses,[reagent]:{...dose,value:Math.round((dose.value-amount)*100)/100}}:undefined,
  reagents:dose.value>amount?v.reagents:[],
  observed:dose.value>amount?v.observed:false
 });
 return {...updated,vessels};
}
/** Schedule simulation work only while something can actually evolve.
 * A dormant tabletop has NO timer. Ambient evaporation is deliberately
 * slower than a reaction, titration or active phase transition.
 * The simulation clock itself stays in the shared bench for deterministic
 * catch-up after a hidden tab becomes visible again. */
export function labSimulationTickWaitMs(bench:LabBench,nowMs:number):number|null{
 const vessels=bench.vessels;
 const burette=vessels.some(v=>v.buretteOpen);
 const reactions=vessels.some(labReactionNeedsTick);
 const phase=vessels.some(v=>
  v.physicalProcess==="dissolving"||v.physicalProcess==="crystallizing");
 const devices=placedLabDevices(bench);
 const powered=devices.some(d=>d.powered||(d.temperatureC??22)>22.1);
 const hot=vessels.some(v=>(v.temperatureC??22)>22.1);
 const evaporating=vessels.some(v=>!v.stoppered&&
  labVaporPressureKPa(v,v.temperatureC??22)!==undefined);
 if(!burette&&!reactions&&!phase&&!powered&&!hot&&!evaporating)return null;
 const cadenceMs=burette||reactions||phase?500:powered||hot?1900:9800;
 if(bench.simulationAtMs===undefined)return 500;
 return Math.max(0,Math.ceil(cadenceMs-Math.max(0,nowMs-bench.simulationAtMs)));
}

/** Deterministic approximate educational heat-transfer model.
 * No claim of laboratory-grade thermometry or chemistry at arbitrary temperatures.
 * Time is passed explicitly so all viewers can reproduce the same evolution. */
export function advanceLabSimulation(bench:LabBench,nowMs:number):LabBench{
 if(!Number.isFinite(nowMs)||nowMs<0)return bench;
 if(bench.simulationAtMs===undefined)return {...bench,simulationAtMs:nowMs,event:bench.event+1};
 const seconds=Math.min(10,Math.max(0,(nowMs-bench.simulationAtMs)/1000));
 if(seconds<.05)return bench;
 const ambient=22;
 let changed=false;
 const devices=placedLabDevices(bench).map(d=>{
  if(d.kind!=="hotplate"&&d.kind!=="burner")return d;
  const old=d.temperatureC??ambient;
  const level=d.heatLevel??2;
  // The open flame is hotter than the effective vessel temperature.
  // A crucible can take substantially more heat than ordinary glassware.
  const target=d.powered?(d.kind==="hotplate"?(d.targetTemperatureC??150):
   level===1?450:level===2?850:1350):ambient;
  const rate=d.powered?0.075:0.11;
  const next=Math.round((old+(target-old)*(1-Math.exp(-seconds*rate)))*10)/10;
  if(next!==old)changed=true;
  return {...d,temperatureC:next};
 });
 let result:LabBench={...bench,placedDevices:devices,simulationAtMs:nowMs};
 let vessels=bench.vessels.map(v=>{
  const old=v.temperatureC??ambient;
  const device=devices.find(d=>d.active&&d.linkedVesselId===v.id&&
   ["hotplate","burner"].includes(d.kind))??
   labAppliancesBelowStand({...bench,placedDevices:devices},v.id).find(d=>
    d.powered&&["hotplate","burner"].includes(d.kind));
  const toward=device&&device.powered?(device.temperatureC??ambient):ambient;
  const volumes=Object.values(v.doses??{}).reduce((total,d)=>total+d.value,0);
  const inertia=Math.max(.035,Math.min(.18,60/Math.max(100,volumes)*.10));
  const heaterPower=device?.powered?
   device.kind==="hotplate"?160:120*(device.heatLevel??2):0;
  const calorimetry=labSensibleHeatStep(v.kind,v.doses,old,ambient,seconds,
   device?.powered?{kind:device.kind==="hotplate"?"hotplate":"burner",
    temperatureC:toward,powerW:heaterPower}:undefined);
  // Measured pure materials follow energy conservation (m*c*delta(T)).
  // Unsupported prepared solutions keep the previous bounded educational
  // temperature curve rather than receiving a fictitious specific heat.
  const raw=calorimetry?.temperatureC??
   old+(toward-old)*(1-Math.exp(-seconds*(device?.powered?inertia:.018)));
  const pure=labVesselThermal(v.reagents,v.doses);
  // No generic 100°C ceiling: concentrations and gaseous samples have no
  // single verified boiling point. Only a neat liquid with known properties
  // receives a boiling plateau below.
  const maxVesselC=device?.kind==="burner"&&v.kind==="crucible"?1250:
   device?.kind==="burner"?450:350;
  let next=Math.round(Math.max(ambient,Math.min(maxVesselC,raw))*10)/10;
  let meltFraction=v.meltFraction??0;
  let phaseTransition=v.phaseTransition;
  const point=pure?.unit==="g"&&!v.uncertain&&!v.completedReaction?
   pure.info.meltingC:undefined;
  if(point!==undefined&&point>ambient){
   // Latent-heat plateau. Heat changes the LIQUID FRACTION at the melting
   // point before the measured temperature rises above it. Cooling reverses
   // this process, at the same point (equilibrium crystallization).
   const heating=toward>point+.1&&(raw>=point||old>=point-.1&&meltFraction<1);
   const cooling=toward<point-.1&&(raw<=point||old<=point+.1&&meltFraction>0);
   if(heating&&meltFraction<1){
    phaseTransition="melting";
    meltFraction=Math.min(1,meltFraction+seconds*Math.max(.008,(toward-point)/350)*.14);
    next=point;
   }else if(cooling&&meltFraction>0){
    phaseTransition="crystallizing";
    meltFraction=Math.max(0,meltFraction-seconds*Math.max(.008,(point-toward)/350)*.14);
    next=point;
   }
  }
  // Verified pure liquids receive a boiling plateau. Neat mixtures get
  // ideal Raoult vapor pressures; stock solvents with unrecorded composition
  // must never be assigned a fictitious boiling point.
  // The same ideal liquid activity governs both vapor escape and the
  // measured mixture's boiling plateau, rather than using arbitrary 100°C
  // for an ethanol/water mixture.
  const boilingPoint=labIdealBoilingC(v)??(pure?.unit==="ml"?pure.info.boilingC:undefined);
  if(boilingPoint!==undefined&&next>boilingPoint&&!v.stoppered)next=boilingPoint;
  const gasMoles=v.stoppered?labHeadspaceGasMoles(v):0;
  const {occupiedMl,capacityMl}=labVesselQuantity(v);
  // The effective power arriving at the liquid is a bounded instrument
  // parameter. At a known boiling plateau, latent heat limits how much
  // water can actually leave the open vessel per simulation tick.
  const deliveredHeatW=calorimetry?.heaterWattsToContents??heaterPower;
  const phase=labEvaporate({...v,
   headspaceMl:Math.max(1,capacityMl-occupiedMl),
   reactionGasMol:gasMoles},seconds,next,toward,deliveredHeatW);
  const evaporating=phase.evaporatedMl>0,popped=phase.popped;
  const updatedDoses=evaporating?phase.doses:v.doses;
  const updatedReagents=evaporating?v.reagents.filter(id=>
   !v.doses?.[id]||updatedDoses?.[id]):v.reagents;
  const stirring=devices.some(d=>d.kind==="stirrer"&&d.active&&
   d.powered&&d.linkedVesselId===v.id)||
   bench.stirringVesselId===v.id&&devices.some(d=>d.kind==="stirrer"&&d.powered);
  const phaseInput={...v,doses:updatedDoses,reagents:updatedReagents};
  const kinetic=labAdvanceBinarySaltPhase(phaseInput,next,seconds,stirring,
   v.binarySaltPhase,v.physicalProcess==="dissolving"&&!v.binarySaltPhase);
  const mixedKinetic=kinetic?undefined:labAdvanceSchoolMixedSaltPhase(
   phaseInput,next,seconds,stirring,v.mixedSaltPhase,
   v.physicalProcess==="dissolving"&&!v.mixedSaltPhase);
  const nextSalt=kinetic?.state;
  const phaseMotion:LabVessel["physicalProcess"]=
   kinetic?.active||mixedKinetic?.active?
    ((mixedKinetic?.direction??kinetic?.direction)==="crystallizing"?
     "crystallizing":"dissolving"):undefined;
  const kineticChanged=!!nextSalt&&(nextSalt.formula!==v.binarySaltPhase?.formula||
   Math.abs(nextSalt.solidMol-(v.binarySaltPhase?.solidMol??-1))>1e-10);
  const mixedChanged=!!mixedKinetic&&(Object.keys(mixedKinetic.state).some(id=>
   Math.abs(mixedKinetic.state[id]-(v.mixedSaltPhase?.[id]??-1))>1e-10)||
   Object.keys(v.mixedSaltPhase??{}).length!==
    Object.keys(mixedKinetic.state).length);
  const dissolutionComplete=kinetic||mixedKinetic?
   v.physicalProcess!==phaseMotion:
   v.physicalProcess==="crystallizing"||
   v.physicalProcess==="dissolving"&&
   v.physicalStartedAtMs!==undefined&&nowMs-v.physicalStartedAtMs>=4500;
  const cooling=!device?.powered&&next<42&&v.temperatureC!==undefined&&
   ["heated","ignited"].includes(v.environment);
  const phaseChanged=meltFraction!==(v.meltFraction??0)||
   phaseTransition!==v.phaseTransition;
  if(next!==old||cooling||evaporating||popped||dissolutionComplete||
   phaseChanged||kineticChanged||mixedChanged)changed=true;
  if(next===old&&!cooling&&!evaporating&&!popped&&!dissolutionComplete&&
   !phaseChanged&&!kineticChanged&&!mixedChanged)return v;
  const doses=updatedDoses,reagents=updatedReagents;
  const hasLiquid=Object.entries(doses??{}).some(([id,d])=>d.unit==="ml"&&
   substances.find(s=>s.id===id)?.kind!=="газ");
  return {...v,temperatureC:next,
   ...(phaseChanged?{meltFraction,phaseTransition}:{}),
   ...(kinetic||mixedKinetic?
    {binarySaltPhase:nextSalt,mixedSaltPhase:mixedKinetic?.state,
     physicalProcess:phaseMotion,
     physicalStartedAtMs:phaseMotion?(v.physicalStartedAtMs??nowMs):undefined}:
    dissolutionComplete?{physicalProcess:undefined,physicalStartedAtMs:undefined,
     binarySaltPhase:undefined,mixedSaltPhase:undefined}:
    {binarySaltPhase:undefined,mixedSaltPhase:undefined}),
   ...(evaporating?{doses,reagents,observed:reagents.length>1,
    ventedVaporMl:phase.ventedVaporMl}:{}),
   ...(popped?{stoppered:false,stopperedAtC:undefined,
    sealedReactionGasBaselineMol:undefined}:{}),
   environment:evaporating&&reagents.length===0?"dry":
    cooling?(hasLiquid?"aqueous":"dry"):v.environment};
 });
 result={...result,vessels};
 // Quantitative progress is allowed only for balanced and fully measured cases.
 // Carrier-solution volume stays constant while solute moles are consumed.
 vessels=result.vessels.map(v=>{
  if(v.uncertain||!v.observed)return v;
  let state=v.reactionAmounts;
  if(!state){
   if(v.completedReaction)return v;
   const reaction=identifyReaction(v.reagents,v.environment);
   if(reaction.status!=="reaction"||!reaction.caseData)return v;
   state=startQuantifiedLabReaction(reaction.caseData,v.reagents,v.doses,nowMs)??undefined;
   if(!state)return v;
  }else if(state.complete)return v;
  const elapsed=state.startedAtMs===undefined?seconds:
   Math.max(0,(nowMs-state.startedAtMs)/1000-state.elapsedSeconds);
  const next=v.reactionAmounts?advanceQuantifiedLabReaction(state,elapsed):state;
  if(next===v.reactionAmounts)return v;
  changed=true;
  return {...v,reactionAmounts:next};
 });
 result={...result,vessels};
 // A rapid measured gas reaction can release the stopper immediately after
 // THIS tick's stoichiometric progress, not one thermal tick later. The
 // labEvaporate pressure helper already accounts for air, vapor and nRT/V.
 vessels=result.vessels.map(v=>{
  if(!v.stoppered||!v.reactionAmounts)return v;
  const pressure=labVesselPressure(v);
  if(!pressure.popped)return v;
  changed=true;
  return {...v,stoppered:false,stopperedAtC:undefined,
   sealedReactionGasBaselineMol:undefined,visualStartedAtMs:nowMs};
 });
 result={...result,vessels};
 // Start pre-reviewed heated cases only after reaching a sufficiently warm state.
 vessels=result.vessels.map(v=>{
  if(v.temperatureC===undefined||v.temperatureC<60||!v.reagents.length)return v;
  const heater=devices.find(d=>d.active&&d.powered&&d.linkedVesselId===v.id&&
   ["hotplate","burner"].includes(d.kind))??
   labAppliancesBelowStand({...bench,placedDevices:devices},v.id).find(d=>
    d.powered&&["hotplate","burner"].includes(d.kind));
  if(!heater)return v;
  // Only a matching reviewed thermal or combustion case can start.
  // No ignition of an unrelated aqueous solution and no invented explosion.
  const ignition=heater.kind==="burner"?identifyReaction(v.reagents,"ignited"):null;
  const heating=identifyReaction(v.reagents,"heated");
  const ignited=ignition?.status==="reaction"&&
   v.temperatureC>=(ignition.caseData?.minTemperatureC??135);
  const warmed=heating.status==="reaction"&&
   v.temperatureC>=(heating.caseData?.minTemperatureC??90);
  if(!ignited&&!warmed)return v;
  const mode=ignited?"ignited":"heated";
  if(v.environment===mode)return v;
  const next=setLabEnvironment({...result,vessels:[v]},v.id,mode);
  const updated=next.vessels[0];
  changed=true;
  return updated;
 });
 result={...result,vessels};
 // A verified reaction transfers heat as it progresses. This runs for both
 // quantified and qualitative reactions, including single-solid calcination.
 // A fallback change is explicitly illustrative when no amounts are known.
 vessels=result.vessels.map(v=>{
  if(!v.observed||v.uncertain||v.completedReaction)return v;
  const matching=identifyReaction(v.reagents,v.environment);
  const row=matching.status==="reaction"?matching.caseData:undefined;
  if(!row?.thermalEffect)return v;
  const same=v.reactionHeat?.equation===row.equation;
  const previous=same?v.reactionHeat:undefined;
  if(previous?.complete)return v;
  let deltaC=previous?.deltaC;
  if(deltaC===undefined){
   const quantified=v.reactionAmounts??
    startQuantifiedLabReaction(row,v.reagents,v.doses);
   const heatKJ=quantified&&row.enthalpyKJPerMol!==undefined?
    quantified.maxExtentMol*row.enthalpyKJPerMol:undefined;
   const heatCapacityJPerK=60+Object.values(v.doses??{}).reduce(
    (sum,d)=>sum+d.value*(d.unit==="ml"?4.18:0.85),0);
   deltaC=heatKJ!==undefined?
    Math.max(-30,Math.min(42,-heatKJ*1000/heatCapacityJPerK)):
    row.thermalEffect==="exothermic"?12:-9;
   // Preserve the vetted direction even after rounding and small doses.
   deltaC=row.thermalEffect==="exothermic"?
    Math.max(0,deltaC):Math.min(0,deltaC);
  }
  const durationSeconds=4,elapsedSeconds=Math.min(durationSeconds,
   (previous?.elapsedSeconds??0)+seconds);
  const fraction=elapsedSeconds/durationSeconds;
  const oldFraction=(previous?.elapsedSeconds??0)/durationSeconds;
  const increment=deltaC*(fraction-oldFraction);
  const temperatureC=Math.round(Math.max(0,Math.min(1250,
   (v.temperatureC??ambient)+increment))*10)/10;
  const reactionHeat:LabReactionHeat={
   equation:row.equation,direction:row.thermalEffect,deltaC,
   elapsedSeconds,durationSeconds,complete:elapsedSeconds>=durationSeconds
  };
  changed=true;
  return {...v,temperatureC,reactionHeat};
 });
 result={...result,vessels};
 // Titrate by opening a valve; dispensed volume is real, never a button animation.
 let dropChanged=false;
 for(const v of result.vessels){
  if(v.kind!=="burette"||!v.buretteOpen||!v.buretteTargetId)continue;
  // A clamped burette feeds only glassware physically positioned below it.
  const held=devices.some(d=>d.kind==="tripod"&&d.active&&d.linkedVesselId===v.id);
  if(held&&labReceiverBelowStand(result,v.id)?.id!==v.buretteTargetId){
   result=setLabBuretteValve(result,v.id,false);continue;
  }
  const dose=v.doses?.[v.reagents[0]];
  if(!dose){result=setLabBuretteValve(result,v.id,false);continue}
  const precise=Math.max(0,seconds*(v.buretteRateMlS??.2)+(v.buretteRemainderMl??0));
  const amount=Math.floor(precise*100+1e-9)/100;
  const remainder=Math.max(0,Math.round((precise-amount)*1e7)/1e7);
  if(!amount){
   result=revise(result,v.id,x=>({...x,buretteRemainderMl:remainder}));
   dropChanged=true;continue;
  }
  const next=dispenseLabBurette(result,v.id,v.buretteTargetId,amount);
  if(next===result){result=setLabBuretteValve(result,v.id,false);continue}
  result=revise(next,v.id,x=>({...x,buretteRemainderMl:remainder}));
  dropChanged=true;
  if(!result.vessels.find(x=>x.id===v.id)?.reagents.length)
   result=setLabBuretteValve(result,v.id,false);
 }
 return changed||dropChanged||result.event!==bench.event?
  {...result,event:Math.max(result.event,bench.event)+1}:result;
}
export function toggleLabDevice(bench:LabBench,id:LabDevice):LabBench{
 const devices=bench.devices??[];
 if(!labDevices.some(v=>v.id===id))return bench;
 const next=devices.includes(id)?devices.filter(v=>v!==id):[...devices,id];
 return {...bench,devices:next,stirringVesselId:next.includes("stirrer")?bench.stirringVesselId:undefined,
 instrumentTarget:bench.instrumentTarget&&!next.includes(bench.instrumentTarget.kind)?undefined:bench.instrumentTarget,event:bench.event+1};
}
export function useLabDevice(bench:LabBench,id:LabDevice,vesselId:string):LabBench{
 if(!(bench.devices??[]).includes(id)||!bench.vessels.some(v=>v.id===vesselId))return bench;
 if(id==="hotplate")return setLabEnvironment(bench,vesselId,"heated");
 if(id==="burner")return setLabEnvironment(bench,vesselId,"ignited");
 if(id==="stirrer")return {...bench,
  stirringVesselId:bench.stirringVesselId===vesselId?undefined:vesselId,event:bench.event+1};
 if(id==="tripod"||id==="thermometer")
  return {...bench,instrumentTarget:{kind:id,vesselId},event:bench.event+1};
 return bench;
}
export function setLabTitration(bench:LabBench,titration:TitrationModel):LabBench{
 return validTitration(titration)?{...bench,titration,event:bench.event+1}:bench;
}
export function dripLabTitration(bench:LabBench,ml:number):LabBench{
 const initial=bench.titration??defaultTitration();
 const next=addTitrant(initial,ml);
 return next===initial?bench:setLabTitration(bench,next);
}
export function restartLabTitration(bench:LabBench):LabBench{
 return setLabTitration(bench,resetTitration(bench.titration??defaultTitration()));
}
/** Use a filled burette over a vessel, not a separate titration mode. Only
 * explicit concentrations and familiar strong monoprotic acids/bases qualify. */
const titrationAcids=["HCl","HNO3","HBr"] as const;
const titrationBases=["NaOH","KOH"] as const;
export function labTitrationTargets(bench:LabBench,sourceId:string){
 const source=bench.vessels.find(v=>v.id===sourceId);
 if(source?.kind!=="burette"||source.reagents.length!==1)return [];
 const reagent=source.reagents[0],dose=source.doses?.[reagent];
 if(!dose||dose.unit!=="ml"||!dose.concentrationM||dose.value<=0)return [];
 const isAcid=titrationAcids.some(a=>a===reagent);
 const isBase=titrationBases.some(a=>a===reagent);
 if(!isAcid&&!isBase)return [];
 return bench.vessels.filter(v=>v.id!==sourceId&&
  ["conical","beaker","flask"].includes(v.kind)&&
  (v.reagents.length===1||(bench.titrationPair?.sourceId===sourceId&&
   bench.titrationPair.targetId===v.id))&&
  v.reagents.some(id=>isAcid?titrationBases.some(b=>b===id):titrationAcids.some(a=>a===id))&&
  v.reagents.some(id=>{
   const d=v.doses?.[id];
   return d?.unit==="ml"&&d.value>0&&d.concentrationM!==undefined;
  }));
}
export function dripLabVessel(bench:LabBench,sourceId:string,targetId:string,requestedMl:number):LabBench{
 if(!Number.isFinite(requestedMl)||requestedMl<=0||
  !labTitrationTargets(bench,sourceId).some(v=>v.id===targetId))return bench;
 const src=bench.vessels.find(v=>v.id===sourceId)!;
 const dst=bench.vessels.find(v=>v.id===targetId)!;
 if(src.stoppered||dst.stoppered)return bench;
 const titrant=src.reagents[0],sourceDose=src.doses![titrant];
 const isAcid=titrationAcids.some(id=>id===titrant);
 const analyte=dst.reagents.find(id=>isAcid?
  titrationBases.some(b=>b===id):titrationAcids.some(a=>a===id))!;
 const initialDose=dst.doses![analyte];
 const old=bench.titrationPair?.sourceId===sourceId&&bench.titrationPair.targetId===targetId?
  bench.titration:undefined;
 if(old&&(old.analyte!==(isAcid?"base":"acid")||
  old.concentrationAnalyte!==initialDose.concentrationM||
  old.concentrationTitrant!==sourceDose.concentrationM))return bench;
 const addedBefore=old?.addedMl??0;
 const freeMl=Math.max(0,labVesselQuantity(dst).availableMl);
 const ml=Math.min(Math.round(requestedMl*100)/100,sourceDose.value,100-addedBefore,
  Math.floor(freeMl*100+1e-7)/100);
 if(ml<=0)return bench;
 const newTotal=Math.round((addedBefore+ml)*100)/100;
 const model:TitrationModel=old?{...old,addedMl:newTotal}:{
  acid:(isAcid?titrant:analyte) as TitrationModel["acid"],
  base:(isAcid?analyte:titrant) as TitrationModel["base"],
  analyte:isAcid?"base":"acid",
  concentrationAnalyte:initialDose.concentrationM!,
  concentrationTitrant:sourceDose.concentrationM!,
  volumeAnalyteMl:initialDose.value,addedMl:newTotal,
  indicator:dst.indicator??"phenolphthalein"
 };
 if(!validTitration(model))return bench;
 const vessels=bench.vessels.map(v=>{
  if(v.id===sourceId){
   const left=Math.round((sourceDose.value-ml)*100)/100;
   return {...v,reagents:left?[titrant]:[],doses:left?
    {[titrant]:{...sourceDose,value:left}}:undefined,observed:false};
  }
  if(v.id===targetId){
   const dosed={...v.doses};
   dosed[titrant]={value:newTotal,unit:"ml" as const,concentrationM:sourceDose.concentrationM};
   // Strong acid/base titration reaches equilibrium between individual drops.
   // Both consumption and salt/water production follow limiting-reagent moles.
   const ids=[...new Set([...v.reagents,titrant])];
   const row=identifyReaction(ids,"aqueous");
   const initial=row.status==="reaction"&&row.caseData?
    startQuantifiedLabReaction(row.caseData,ids,dosed):null;
   const reactionAmounts=initial?
    advanceQuantifiedLabReaction(initial,initial.durationSeconds):undefined;
   return {...v,reagents:ids,doses:dosed,observed:true,
    reactionAmounts,uncertain:false};
  }
  return v;
 });
 return {...bump(bench,vessels,targetId),titration:model,titrationPair:{sourceId,targetId}};
}
export type LabBenchSettings={
 showEquationBoard:boolean;showVesselLabels:boolean;animateEffects:boolean;
 showTemperatures:boolean;
};
export const defaultLabBenchSettings=():LabBenchSettings=>({
 showEquationBoard:true,showVesselLabels:true,animateEffects:true,showTemperatures:true
});
export const labBenchSettings=(bench:LabBench):LabBenchSettings=>({
 ...defaultLabBenchSettings(),...bench.settings
});
export const formatLabDose=(dose:LabDose)=>`${dose.value.toLocaleString("ru-RU")} ${dose.unit==="ml"?"мл":"г"}`;

export type LabIndicator="litmus"|"phenolphthalein"|"methyl-orange"|"universal";
export const labIndicators:{id:LabIndicator;name:string;note:string;form:"solution"|"paper";stockColor:string}[]=[
 {id:"litmus",name:"Лакмус",form:"solution",stockColor:"#8f6ab8",note:"Раствор: красный в кислой среде, синий в щелочной"},
 {id:"phenolphthalein",name:"Фенолфталеин",form:"solution",stockColor:"#e9f1f4",note:"Бесцветный раствор: малиновый при pH выше 8,2"},
 {id:"methyl-orange",name:"Метилоранж",form:"solution",stockColor:"#e9a74c",note:"Раствор: красный при pH ниже 3,1, жёлтый выше 4,4"},
 {id:"universal",name:"Универсальный",form:"paper",stockColor:"#e9edb4",note:"Бумажная тест-полоска, не окрашивает раствор"}
];
export type LabIndicatorResult={medium:"acid"|"base"|"neutral"|"unknown";
 label:string;color?:string;pH?:number;note:string};
/** Indicator colour comes from concentrations, including after every
 * neutralisation/titration dose. Unsupported equilibria remain unknown. */
export function labIndicatorResult(vessel:LabVessel):LabIndicatorResult|null{
 if(!vessel.indicator)return null;
 const ph=labVesselPH(vessel);
 if(!ph)return {medium:"unknown",label:"pH не определён",
  note:"Недостаточно измерений либо равновесие вещества не поддерживается; цвет не придумывается."};
 return {medium:ph.pH<6.5?"acid":ph.pH>7.5?"base":"neutral",
  label:ph.label,pH:ph.pH,color:labIndicatorTint(vessel.indicator,ph.pH),
  note:ph.note};
}

export type LabVessel={pourFraction?:number;
 id:string;kind:LabGlassware;x:number;y:number;
 /** A free receiving vessel resting on a real metal stand base.
  * Its anchor follows the stand at every viewport size, independent of zoom. */
 restingOnStandId?:string;
 reagents:string[];environment:ReactionEnvironment;
 observed:boolean;uncertain?:boolean;indicator?:LabIndicator;
 /** Reagent indicator drops are traced separately, not mistaken for analytes. */
 indicatorDrops?:number;indicatorAddedAtMs?:number;
 temperatureC?:number;
 reactionHeat?:LabReactionHeat;
 /** Reusable cork for suitable laboratory necks. */
 stoppered?:boolean;
 /** Temperature in °C when the air headspace was sealed. */
 stopperedAtC?:number;
 /** Gas formed before this stopper was inserted already escaped if open. */
 sealedReactionGasBaselineMol?:number;
 /** Measured liquid volumes vented to the room as vapor. */
 ventedVaporMl?:Record<string,number>;
 /** 0 = solid, 1 = fully molten. Conserved across viewers and cooling. */
 meltFraction?:number;
 phaseTransition?:"melting"|"crystallizing";
 /** Shared event timestamp: peer clients render brief physical effects once. */
 visualStartedAtMs?:number;
 /** Target volume when collecting a sample with a graduated pipette. */
 pipetteTargetMl?:number;
 buretteOpen?:boolean;buretteTargetId?:string;buretteRateMlS?:number;
 /** Sub-centimillilitre remainder is saved between dosing ticks. */
 buretteRemainderMl?:number;
 doses?:Record<string,LabDose>;
 /** Physical dissolution animation; no chemical product is invented. */
 physicalProcess?:"dissolving"|"crystallizing";physicalStartedAtMs?:number;
 /** Persisted crystalline fraction, conserved with dissolved molecules. */
 binarySaltPhase?:LabBinarySaltState;
 /** Each solid's independently evolving mass fraction in nonreacting mixtures. */
 mixedSaltPhase?:Record<string,number>;
 /** Filtered insoluble solid; mass only when quantities were measured. */
 filteredResidue?:LabFilteredResidue;
 /** Physical carrier volume and identities of dissolved filtrate products. */
 filteredSolution?:{sourceEquation:string;solutes:string[];volumeMl?:number};
 /** Exact persistent chemical phase amounts after separation or transfer.
  * The current doses then describe NEW additions, not consumed stock. */
 chemicalInventory?:LabChemicalSnapshot;
 /** Moles of reagents/products; solvent volume is conserved separately. */
 reactionAmounts?:LabReactionAmounts;
 /** A verified reaction already completed in this material; survives full transfer. */
 completedReaction?:ReactionCase;
};
export type LabQuickReagent={id:string;dose:LabDose};
export const MAX_QUICK_REAGENTS=12;
/** Essentials for school titrations, precipitation, metal reactions and
 * thermolysis. Designed to be useful without opening the full catalog.
 * Existing user-customised quick shelves are never overwritten. */
export const defaultLabQuickReagents=():LabQuickReagent[]=>[
 {id:"H2O",dose:{value:20,unit:"ml"}},
 {id:"HCl",dose:{value:10,unit:"ml",concentrationM:.1}},
 {id:"H2SO4",dose:{value:10,unit:"ml",concentrationM:.1}},
 {id:"NaOH",dose:{value:10,unit:"ml",concentrationM:.1}},
 {id:"AgNO3",dose:{value:10,unit:"ml",concentrationM:.1}},
 {id:"NaCl",dose:{value:10,unit:"ml",concentrationM:.1}},
 {id:"BaCl2",dose:{value:10,unit:"ml",concentrationM:.1}},
 {id:"CuSO4",dose:{value:10,unit:"ml",concentrationM:.1}},
 {id:"Na2CO3",dose:{value:10,unit:"ml",concentrationM:.1}},
 {id:"KI",dose:{value:10,unit:"ml",concentrationM:.1}},
 {id:"CaCO3",dose:{value:1,unit:"g"}},
 {id:"Na",dose:{value:.1,unit:"g"}}
];
export function labQuickReagents(bench:LabBench):LabQuickReagent[]{
 return (bench.quickReagents??defaultLabQuickReagents()).filter(q=>
  substances.some(v=>v.id===q.id)).slice(0,MAX_QUICK_REAGENTS)
  .map(q=>({id:q.id,dose:{
   ...q.dose,
   ...(q.dose.unit==="ml"&&q.dose.concentrationM===undefined&&labIsPreparedStock(q.id)?
    {concentrationM:LAB_STOCK_MOLARITY_M}:{})}}));
}
export function setLabQuickReagent(bench:LabBench,id:string,dose?:LabDose):LabBench{
 if(!substances.some(v=>v.id===id))return bench;
 const list=labQuickReagents(bench),existing=list.find(v=>v.id===id);
 if(!dose){
  if(!existing)return bench;
  return {...bench,quickReagents:list.filter(v=>v.id!==id),event:bench.event+1};
 }
 if(!Number.isFinite(dose.value)||dose.value<=0||dose.value>10000||
  !["g","ml"].includes(dose.unit)||
  (dose.concentrationM!==undefined&&(dose.unit!=="ml"||dose.concentrationM<.001||
   dose.concentrationM>2)))return bench;
 if(!existing&&list.length>=MAX_QUICK_REAGENTS)return bench;
 const normalized={id,dose:{...dose,value:Math.round(dose.value*100)/100,
  ...(dose.unit==="ml"&&dose.concentrationM===undefined&&labIsPreparedStock(id)?
   {concentrationM:LAB_STOCK_MOLARITY_M}:{})}};
 return {...bench,quickReagents:existing?list.map(v=>v.id===id?normalized:v):
  [...list,normalized],event:bench.event+1};
}
export function clearLabTable(bench:LabBench):LabBench{
 if(!bench.vessels.length&&!placedLabDevices(bench).length&&!bench.pouring)return bench;
 // Empty only the physical worktop. The configured quick shelf and
 // presentation settings must survive cleaning.
 return {...bench,vessels:[],selectedId:"",placedDevices:[],devices:[],
  titration:undefined,titrationPair:undefined,stirringVesselId:undefined,
  instrumentTarget:undefined,simulationAtMs:undefined,pouring:undefined,event:bench.event+1};
}
export type LabPourProgress={id:string;sourceId:string;targetId:string;step:number;totalSteps:20;
 initialDoses:Record<string,LabDose>;unmeasured:boolean};
export const LAB_POUR_STEPS=20,LAB_POUR_INTERVAL_MS=150;
export const labPourPercent=(p:LabPourProgress)=>Math.round(p.step/p.totalSteps*100);
export const labPourAmounts=(p:LabPourProgress)=>Object.entries(p.initialDoses).map(([id,d])=>({
 id,unit:d.unit,transferred:Math.round(d.value*p.step/p.totalSteps*1000)/1000,
 remaining:Math.round(d.value*(1-p.step/p.totalSteps)*1000)/1000}));
export type LabBench={vessels:LabVessel[];selectedId:string;event:number;mode?:LabMode;pouring?:LabPourProgress;
 /** Equations remain on the shared chalkboard until manually wiped. */
 reactionLog?:string[];
 /** Prevents a wiped, still-present reaction from being written again. */
 seenReactionKeys?:string[];
 settings?:LabBenchSettings;quickReagents?:LabQuickReagent[];devices?:LabDevice[];placedDevices?:LabPlacedDevice[];titration?:TitrationModel;stirringVesselId?:string;
 instrumentTarget?:{kind:"tripod"|"thermometer";vesselId:string};
 titrationPair?:{sourceId:string;targetId:string};simulationAtMs?:number;}
export const MAX_BENCH_VESSELS=6,MAX_VESSEL_REAGENTS=48;
const clamp=(v:number)=>Math.round(Math.min(90,Math.max(10,v))*10)/10;
export function setLabBenchSettings(bench:LabBench,settings:Partial<LabBenchSettings>):LabBench{
 const next={...labBenchSettings(bench),...settings};
 return JSON.stringify(next)===JSON.stringify(labBenchSettings(bench))?bench:
  {...bench,settings:next,event:bench.event+1};
}
export const defaultLabBench=():LabBench=>({
 vessels:[{id:"v1",kind:"beaker",x:48,y:70,reagents:[],environment:"aqueous",observed:false}],
 selectedId:"v1",event:0,mode:"reactions",settings:defaultLabBenchSettings()
});
export function readLabBench(item:Item):LabBench{
 if(item.scienceLabBench)return {...item.scienceLabBench,
  // Legacy funnels were retired: preserve any measured contents by migrating
  // the old vessel to a beaker instead of silently deleting its reagents.
  vessels:item.scienceLabBench.vessels.map(v=>(v.kind as string)==="funnel"?
   {...v,kind:"beaker" as const}:v)};
 const initial=defaultLabBench();
 initial.vessels[0].reagents=(item.scienceReagents??[]).slice(0,MAX_VESSEL_REAGENTS);
 initial.vessels[0].environment=item.scienceEnvironment??"aqueous";
 initial.vessels[0].observed=(item.scienceExperimentStage??0)===1;
 return initial;
}
export const selectedLabVessel=(bench:LabBench)=>bench.vessels.find(v=>v.id===bench.selectedId)??bench.vessels[0];
/** Persistent equation history. Recognized reactions are recorded once per
 * source vessel and equation; wiping the board never restarts an old entry. */
export function recordLabReactions(bench:LabBench):LabBench{
 const seen=new Set(bench.seenReactionKeys??[]);
 const log=[...(bench.reactionLog??[])];
 let changed=false;
 for(const vessel of bench.vessels){
  const inventory=vessel.chemicalInventory?
   simulateLabInventory({...vessel,volumeMl:labVesselQuantity(vessel).volumeMl}):
   vessel.doses&&!vessel.filteredResidue&&!vessel.filteredSolution?
   simulateLabInventory(vessel):undefined;
  const current=labObservation(vessel);
  const row=current.status==="reaction"?current.caseData:undefined;
  const equations=inventory?.steps.length?
   inventory.steps.map(step=>step.equation):row?.equation?[row.equation]:[];
  for(const equation of equations){
   const key=vessel.id+"|"+equation;
   if(seen.has(key))continue;
   seen.add(key);changed=true;
   if(log.length>=30)log.shift();
   log.push(equation);
  }
 }
 return changed?{...bench,reactionLog:log,seenReactionKeys:[...seen].slice(-150),
  event:bench.event+1}:bench;
}
export function wipeLabChalkboard(bench:LabBench):LabBench{
 if(!(bench.reactionLog?.length))return bench;
 return {...bench,reactionLog:[],event:bench.event+1};
}
/** A measured suspension is two physically different phases.
 * Insoluble products are selected ONLY by a ↓ in the reviewed equation.
 * Mass is calculated from measured product moles, never inferred from a
 * precipitation animation. Densities give physical layer volume. */
const precipitateDensity=labSchoolSolidDensityGml;
const formatMol=(v:number)=>Number((v*1000).toPrecision(4));
function calculateLabVesselContents(v:LabVessel){
 const {volumeMl,capacityMl}=labVesselQuantity(v);
 const quantities=v.reactionAmounts;
 // The chemical species inventory is reconstructed from the measured initial
 // doses, so adding another reagent cannot erase prior precipitates and
 // previously formed products can react in the next reviewed stage.
 const inventory=v.chemicalInventory?
  simulateLabInventory({...v,volumeMl}):
  !v.filteredResidue&&!v.filteredSolution&&v.doses&&v.reagents.length?
  simulateLabInventory(v):undefined;
 if(inventory&&!inventory.unmeasured.length){
  // Reaction totals are conserved; only the binary phase partition moves.
  const visible=labVisibleBinarySaltSolid(v,v.binarySaltPhase,v.temperatureC??22);
  const solidPhase={...inventory.solidMol};
  if(visible)solidPhase[visible.formula]=visible.solidMol;
  const solid:{formula:string;massG?:number}[]=[];
  const solution:{formula:string;mmol?:number}[]=[];
  const precipitated=new Set(inventory.steps.flatMap(step=>
   (step.equation.split("→")[1]??"").split(/\s+\+\s+/)
    .filter(term=>term.includes("↓")).map(term=>
     term.replace(/^\d+\s*/,"").replace(/[↓↑]/g,"").trim())));
  let precipitateG=0,precipitateVolumeMl=0,unknownDensity=false;
  for(const [formula,mol] of Object.entries(inventory.speciesMol)){
   if(mol<=1e-12)continue;
   const solidMol=solidPhase[formula]??0;
   if(solidMol>1e-12){
    const mass=labMolarMass(formula);
    solid.push({formula,massG:mass===undefined?undefined:mass*solidMol});
    if(precipitated.has(formula)||labSingleSaltSolubilityGPer100gWater(formula,v.temperatureC??22)!==undefined||
     (v.filteredResidue?.components?.some(component=>component.formula===formula))||
     (v.chemicalInventory&&v.environment==="aqueous"&&
      !LAB_WATER_SOLUTES.has(formula))){
     if(mass!==undefined){
      const productMass=mass*solidMol;
      precipitateG+=productMass;
      if(precipitateDensity(formula))
       precipitateVolumeMl+=productMass/precipitateDensity(formula);
      else unknownDensity=true;
     }
    }
   }
   if(mol-solidMol>1e-12&&substances.find(s=>s.id===formula)?.kind!=="газ")
    solution.push({formula,mmol:formatMol(mol-solidMol)});
  }
  return {solutionMl:volumeMl,capacityMl,solution,solid,
   remainderUnknown:inventory.limited,
   precipitateG:precipitateG>1e-10?precipitateG:undefined,
   precipitateVolumeMl:unknownDensity?undefined:
    precipitateVolumeMl>1e-12?precipitateVolumeMl:undefined,
   precipitateFraction:unknownDensity?undefined:
    precipitateVolumeMl>1e-12?Math.max(0,Math.min(.8,precipitateVolumeMl/capacityMl)):undefined};
 }
 const equation=(v.completedReaction??labObservation(v).caseData)?.equation??"";
 const products=(equation.split("→")[1]??"").split(/\s+\+\s+/);
 const precipitates=new Set(products.filter(t=>t.includes("↓"))
  .map(t=>t.replace(/^\d+\s*/,"").replace(/[↓↑]/g,"").trim()));
 const gases=new Set(products.filter(t=>t.includes("↑"))
  .map(t=>t.replace(/^\d+\s*/,"").replace(/[↓↑]/g,"").trim()));
 const solid:{formula:string;massG?:number}[]=[];
 const solution:{formula:string;mmol?:number}[]=[];
 let precipitateG: number|undefined=undefined,precipitateVolumeMl: number|undefined=undefined;
 if(v.filteredResidue){
  solid.push({formula:v.filteredResidue.formula,massG:v.filteredResidue.massG});
  precipitateG=v.filteredResidue.massG;
  if(precipitateG!==undefined&&precipitateDensity(v.filteredResidue.formula))
   precipitateVolumeMl=precipitateG/precipitateDensity(v.filteredResidue.formula);
 }else if(quantities){
  for(const [formula,mol] of Object.entries(quantities.productsMol)){
   if(mol<=1e-12||gases.has(formula))continue;
   if(precipitates.has(formula)){
    const mass=labMolarMass(formula);
    const massG=mass===undefined?undefined:mol*mass;
    solid.push({formula,massG});
    if(massG!==undefined)precipitateG=(precipitateG??0)+massG;
    if(massG!==undefined&&precipitateDensity(formula))
     precipitateVolumeMl=(precipitateVolumeMl??0)+massG/precipitateDensity(formula);
   }else solution.push({formula,mmol:formatMol(mol)});
  }
  for(const [formula,mol] of Object.entries(quantities.remainingMol)){
   if(mol<=1e-12)continue;
   // Only non-dissolved solids remain a separate particulate phase.
   if(v.doses?.[formula]?.unit==="g"&&!LAB_WATER_SOLUTES.has(formula)&&formula!=="H2O")
    solid.push({formula,massG:labMolarMass(formula)===undefined?undefined:labMolarMass(formula)!*mol});
   else solution.push({formula,mmol:formatMol(mol)});
  }
  // Carry non-reacting catalysts and any newly added measured material in
  // the readout. A known older precipitate is not erased, and a newly
  // introduced reagent is not silently omitted while the next chemistry
  // stage awaits an independently verified reaction model.
  const accounted=new Set([...Object.keys(quantities.initialMol),
   ...Object.keys(quantities.productsMol),"H2O"]);
  for(const formula of v.reagents){
   if(accounted.has(formula))continue;
   const dose=v.doses?.[formula];
   if(!dose)continue;
   if(dose.unit==="g"&&!LAB_WATER_SOLUTES.has(formula))
    solid.push({formula,massG:dose.value});
   else{
    const n=labDoseMoles(formula,dose);
    solution.push({formula,mmol:n===undefined?undefined:formatMol(n)});
   }
  }
 }else if(v.filteredSolution){
  solution.push(...v.filteredSolution.solutes.map(formula=>({formula})));
  if(!solution.length&&volumeMl>0)solution.push({formula:"Раствор"});
 }else if(v.observed&&!v.uncertain&&equation){
  // A qualitative experiment still displays its KNOWN products, even when
  // concentrations are unavailable. It does not pretend to know how much
  // of the initial reactants remains after the reaction.
  for(const term of products){
   const formula=term.replace(/^\d+\s*/,"").replace(/[↓↑]/g,"").trim();
   if(!formula||gases.has(formula))continue;
   if(precipitates.has(formula))solid.push({formula});
   else solution.push({formula});
  }
 }else{
  for(const formula of v.reagents){
   const d=v.doses?.[formula];
   if(d?.unit==="g"&&!LAB_WATER_SOLUTES.has(formula))solid.push({formula,massG:d.value});
   else solution.push({formula});
  }
 }
 return {solutionMl:volumeMl,capacityMl,solution,solid,
  remainderUnknown:!quantities&&v.observed&&!v.uncertain&&!!equation,
  precipitateG,precipitateVolumeMl,
  precipitateFraction:precipitateVolumeMl===undefined?undefined:
   Math.max(0,Math.min(.8,precipitateVolumeMl/capacityMl))};
}

/** The board updates vessel objects immutably. A fixed vessel reference has
 * a fixed measured composition, so UI redraws and unrelated apparatus edits
 * can reuse its already resolved phase / precipitate readout. Weak keys do
 * not retain removed glassware or old collaborative versions in memory. */
const contentsByVessel=new WeakMap<LabVessel,ReturnType<typeof calculateLabVesselContents>>();
export function labVesselContents(v:LabVessel){
 const cached=contentsByVessel.get(v);
 if(cached)return cached;
 const contents=calculateLabVesselContents(v);
 contentsByVessel.set(v,contents);
 return contents;
}

export function labReactionNeedsTick(vessel:LabVessel):boolean{
 if(vessel.uncertain)return false;
 if(vessel.reactionHeat&&!vessel.reactionHeat.complete)return true;
 if(vessel.reactionAmounts&&!vessel.reactionAmounts.complete)return true;
 if(!vessel.observed||vessel.completedReaction)return false;
 const reaction=identifyReaction(vessel.reagents,vessel.environment);
 if(reaction.status!=="reaction"||!reaction.caseData)return false;
 if(reaction.caseData.thermalEffect&&!vessel.reactionHeat)return true;
 return !vessel.reactionAmounts&&
  !!startQuantifiedLabReaction(reaction.caseData,vessel.reagents,vessel.doses);
}
export function labObservation(vessel:LabVessel):{status:ReactionStatus;message:string;
 caseData?:ReturnType<typeof identifyReaction>["caseData"]}{
 if(vessel.reagents.length===0)return{status:"unknown",message:"Сосуд пуст."};
 const inventory=vessel.chemicalInventory?
  simulateLabInventory({...vessel,volumeMl:labVesselQuantity(vessel).volumeMl}):
  vessel.doses&&!vessel.filteredResidue&&!vessel.filteredSolution?
  simulateLabInventory(vessel):undefined;
 if(inventory&&!inventory.unmeasured.length&&inventory.steps.length){
  const last=inventory.steps[inventory.steps.length-1];
  const row=identifyReaction(vessel.reagents,vessel.environment);
  if(row.caseData?.equation===last.equation)return row;
  const lastCase=reviewedReactionCases.find(c=>c.equation===last.equation);
  if(lastCase)return {status:"reaction",message:lastCase.description,caseData:lastCase};
 }
 if(vessel.reactionAmounts){
  const row=identifyReaction(vessel.reagents,vessel.environment);
  if(row.status==="reaction")return row;
 }
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
/** Tidy into one row of up to three, or two unobstructed rows of up to six.
 * Existing contents and stable IDs remain untouched. */
export function arrangeLabVessels(bench:LabBench):LabBench{
 const count=bench.vessels.length;
 if(count===0)return bench;
 const upper=count<=3?count:Math.ceil(count/2);
 const lower=count<=3?0:count-upper;
 const lane=(index:number,size:number)=>size===1?50:
  size===2?(index===0?31:69):20+index*30;
 const vessels=bench.vessels.map((v,index)=>{
  const first=index<upper,groupSize=first?upper:lower;
  const laneIndex=first?index:index-upper;
  return {...v,x:lane(laneIndex,groupSize),
   y:count<=3?62:first?40:78};
 });
 if(vessels.every((v,i)=>v.x===bench.vessels[i].x&&v.y===bench.vessels[i].y))return bench;
 // Arrange only free vessels. Mounted vessels keep their attachments.
 const stabilized=vessels.map((v,i)=>placedLabDevices(bench).some(d=>
  d.active&&d.linkedVesselId===v.id||d.shelfVesselId===v.id)||bench.vessels[i].restingOnStandId?bench.vessels[i]:v);
 return bump(bench,stabilized);
}
/** Pick an unused tabletop position, leaving EVERY existing vessel untouched.
 * Explicit pointer drops always win, even when placed close to another vessel.
 * Automatic spots are only used for keyboard/cabinet insertion. */
export function labFreeVesselPosition(bench:LabBench):{x:number;y:number}{
 const spaces=[
  {x:50,y:64},{x:33,y:64},{x:68,y:64},
  {x:17,y:73},{x:83,y:73},{x:40,y:84},{x:60,y:84},
  {x:23,y:49},{x:77,y:49},{x:50,y:49}
 ];
 const devices=placedLabDevices(bench);
 const occupied=bench.vessels.map(v=>{
  const stand=devices.find(d=>d.kind==="tripod"&&d.id===v.restingOnStandId);
  return stand?labStandBaseVesselPoint(stand,v,1600,1000):labDisplayPoint(v);
 });
 const score=(p:{x:number;y:number})=>{
  const display=labDisplayPoint(p,bench.vessels.length>3);
  const nearestVessel=occupied.length?Math.min(...occupied.map(v=>
   Math.hypot((v.x-display.x)*1.4,v.y-display.y))):100;
  const nearestDevice=devices.length?Math.min(...devices.map(d=>
   Math.hypot((d.x-display.x)*1.4,d.y-display.y))):100;
  return Math.min(nearestVessel,nearestDevice);
 };
 return spaces.reduce((best,p)=>score(p)>score(best)?p:best,spaces[0]);
}
/** Keep retired shapes loadable from saved classroom boards, but never
 * allow creating them in a new experiment or a mode starter kit. */
export const LAB_RETIRED_GLASSWARE:readonly LabGlassware[]=["cylinder","volumetric"];
export function addLabVessel(bench:LabBench,kind:LabGlassware,position?:{x:number;y:number}):LabBench{
 if(bench.vessels.length>=MAX_BENCH_VESSELS||LAB_RETIRED_GLASSWARE.includes(kind))return bench;
 let n=1;while(bench.vessels.some(v=>v.id==="v"+n))n++;
 const location=position??labFreeVesselPosition(bench);
 const next:LabVessel={id:"v"+n,kind,x:clamp(location.x),
  y:clamp(location.y),reagents:[],environment:"aqueous",observed:false};
 // Never run arrangeLabVessels implicitly: it used to make other glassware jump.
 return bump(bench,[...bench.vessels,next],next.id);
}
/** Optional one-click preparation. Adds only missing EMPTY glassware and
 * compatible apparatus, never clearing or moving existing experiments. */
const LAB_STARTER_SETS:Record<LabMode,{glassware:LabGlassware[];devices:LabAvailableDevice[]}>={
 reactions:{glassware:["beaker","tube","pipette","flask"],devices:["filter"]},
 qualitative:{glassware:["beaker","tube","tube","pipette"],devices:["filter"]},
 quantitative:{glassware:["beaker","pipette","conical","flask"],devices:["stirrer"]},
 titration:{glassware:["burette","conical","pipette"],devices:["tripod"]},
 solutions:{glassware:["beaker","pipette","flask","conical"],devices:["stirrer"]},
 evaporation:{glassware:["dish","beaker","pipette"],devices:["hotplate"]},
 synthesis:{glassware:["flask","crucible","beaker"],devices:["hotplate","tripod"]}
};
export function prepareLabModeSetup(bench:LabBench):LabBench{
 const setup=LAB_STARTER_SETS[labMode(bench)];
 let result=bench;
 const required=new Map<LabGlassware,number>();
 for(const kind of setup.glassware)required.set(kind,(required.get(kind)??0)+1);
 for(const [kind,count] of required){
  while(result.vessels.filter(v=>v.kind===kind).length<count&&
   result.vessels.length<MAX_BENCH_VESSELS){
   const next=addLabVessel(result,kind);
   if(next===result)break;
   result=next;
  }
 }
 for(const kind of setup.devices){
  if(placedLabDevices(result).some(d=>d.kind===kind))continue;
  result=addPlacedLabDevice(result,kind);
 }
 if(labMode(result)==="titration"){
  const stand=placedLabDevices(result).find(d=>d.kind==="tripod"&&!d.linkedVesselId);
  const burette=result.vessels.find(v=>v.kind==="burette");
  const receiver=result.vessels.find(v=>v.kind==="conical");
  if(stand&&burette){
   const mounted=applyPlacedLabDevice(result,stand.id,burette.id);
   if(mounted!==result){
    result=mounted;
    if(receiver&&!placedLabDevices(result).some(d=>d.linkedVesselId===receiver.id))
     result=placeLabVesselOnStandBase(result,receiver.id,stand.id);
   }
  }
 }
 return result;
}
export function positionLabVessel(bench:LabBench,id:string,x:number,y:number):LabBench{
 const vessel=bench.vessels.find(v=>v.id===id);
 if(!vessel)return bench;
 const nextX=clamp(x),nextY=clamp(y);
 if(vessel.x===nextX&&vessel.y===nextY&&!vessel.restingOnStandId)return bench;
 const moved=revise(bench,id,v=>({...v,x:nextX,y:nextY,restingOnStandId:undefined}));
 // Picking the vessel up physically disconnects equipment. The powered
 // burner may remain on, but it must no longer heat a distant vessel.
 if(!placedLabDevices(bench).some(d=>d.linkedVesselId===id||d.shelfVesselId===id))return moved;
 return {...moved,placedDevices:placedLabDevices(bench).map(d=>({
   ...d,...(d.linkedVesselId===id?{linkedVesselId:undefined,active:false}:{}),
   ...(d.shelfVesselId===id?{shelfVesselId:undefined}:{})})),
  stirringVesselId:bench.stirringVesselId===id?undefined:bench.stirringVesselId};
}
/** Empty id means nothing is selected. It must remain a valid state so a
 * click on the free worktop can dismiss the vessel readout. */
export function selectLabVessel(bench:LabBench,id:string):LabBench{
 return bench.selectedId===id?bench:id===""||bench.vessels.some(v=>v.id===id)?
  {...bench,selectedId:id}:bench;
}
export function removeLabVessel(bench:LabBench,id:string,discardContents=false):LabBench{
 const target=bench.vessels.find(v=>v.id===id);
 // A filled vessel requires explicit confirmation. Never silently discard
 // the student's reagents just because of a swipe toward the top shelf.
 if(!target||(!discardContents&&target.reagents.length>0))return bench;
 const vessels=bench.vessels.filter(v=>v.id!==id);
 return {...bump(bench,vessels,""),
  stirringVesselId:bench.stirringVesselId===id?undefined:bench.stirringVesselId,
  instrumentTarget:bench.instrumentTarget?.vesselId===id?undefined:bench.instrumentTarget,
  placedDevices:placedLabDevices(bench).map(d=>({
   ...d,...(d.linkedVesselId===id?{linkedVesselId:undefined,active:false}:{}),
   ...(d.shelfVesselId===id?{shelfVesselId:undefined}:{})})),
  titrationPair:bench.titrationPair&&(bench.titrationPair.sourceId===id||bench.titrationPair.targetId===id)?
   undefined:bench.titrationPair};
}
export function setLabVesselStopper(bench:LabBench,id:string,stoppered:boolean):LabBench{
 return revise(bench,id,v=>labCanStopper(v.kind)&&!!v.stoppered!==stoppered?
  {...v,stoppered,stopperedAtC:stoppered?(v.temperatureC??22):undefined,
   sealedReactionGasBaselineMol:stoppered?
    (labReactionGasProgress(v.reactionAmounts)?.totalMol??0):undefined}:v);
}
/** Ideal-gas headspace uses the same measured chemical species ledger as the
 * vessel inspector. The seal temperature is saved, never assumed to equal
 * the current temperature. */
/** One shared gas tally for live pressure and saved lab inspection.
 * During a measured gas reaction, inventory equilibrium is a FUTURE final
 * state: only progress so far may pressurize a sealed container. */
export function labHeadspaceGasMoles(v:LabVessel){
 const measured=labReactionGasProgress(v.reactionAmounts);
 if(measured){
  // Existing gaseous stock may be present independently of products.
  const sourceGas=Object.entries(v.doses??{}).reduce((sum,[id,d])=>
   sum+(substances.find(x=>x.id===id)?.kind==="газ"?
    labDoseMoles(id,d)??0:0),0);
  const baseline=v.stoppered?Math.max(0,
   v.sealedReactionGasBaselineMol??0):0;
  return Math.max(0,measured.totalMol-baseline)+sourceGas;
 }
 // Before the first reaction tick, the measured inputs have not produced
 // their final gas yield. Do not import future products into the headspace.
 if(!v.completedReaction&&!v.chemicalInventory){
  const row=identifyReaction(v.reagents,v.environment);
  if(row.status==="reaction"&&row.caseData?.observation==="gas"&&
   startQuantifiedLabReaction(row.caseData,v.reagents,v.doses))return 0;
 }
 const inventory=simulateLabInventory({...v,volumeMl:labVesselQuantity(v).volumeMl});
 return Object.values(inventory.retainedGasMol).reduce((s,m)=>s+m,0)+
  Object.entries(inventory.speciesMol).reduce((s,[id,m])=>
   s+(substances.find(x=>x.id===id)?.kind==="газ"?m:0),0);
}
export function labVesselPressure(v:LabVessel,temperatureC=v.temperatureC??22){
 const {occupiedMl,capacityMl}=labVesselQuantity(v);
 return labEvaporate({...v,headspaceMl:Math.max(1,capacityMl-occupiedMl),
  reactionGasMol:v.stoppered?labHeadspaceGasMoles(v):0},0,temperatureC);
}
export function emptyLabVessel(bench:LabBench,id:string):LabBench{
 const next=revise(bench,id,v=>({...v,reagents:[],observed:false,uncertain:false,indicator:undefined,indicatorDrops:undefined,indicatorAddedAtMs:undefined,doses:undefined,completedReaction:undefined,reactionAmounts:undefined,filteredResidue:undefined,filteredSolution:undefined,chemicalInventory:undefined,physicalProcess:undefined,physicalStartedAtMs:undefined,binarySaltPhase:undefined,sealedReactionGasBaselineMol:undefined,meltFraction:undefined,phaseTransition:undefined,reactionHeat:undefined,ventedVaporMl:undefined}));
 return next===bench?bench:({...next,stirringVesselId:next.stirringVesselId===id?undefined:next.stirringVesselId,
  placedDevices:placedLabDevices(next).map(d=>({
   ...d,...(d.linkedVesselId===id?{linkedVesselId:undefined,active:false}:{}),
   ...(d.shelfVesselId===id?{shelfVesselId:undefined}:{})})),
  titrationPair:next.titrationPair&&(next.titrationPair.sourceId===id||next.titrationPair.targetId===id)?
   undefined:next.titrationPair});
}
export function setLabIndicator(bench:LabBench,id:string,indicator:LabIndicator|undefined):LabBench{
 // Testing an empty/dry vessel is invalid. Only solutions receive drops;
 // the universal paper stays a separate test strip and never colors the bulk.
 const target=bench.vessels.find(v=>v.id===id&&v.reagents.length);
 if(!target||target.stoppered||!indicator&&target.indicator==null)return bench;
 if(indicator&&!(labVesselQuantity(target).volumeMl>0||!target.doses&&
  target.environment==="aqueous"))return bench;
 if(indicator&&target.indicator===indicator&&indicator==="universal")return bench;
 if(indicator&&target.indicator===indicator&&(target.indicatorDrops??0)>=6)return bench;
 const next=revise(bench,id,v=>({
  ...v,indicator,
  indicatorDrops:indicator&&indicator!=="universal"?
   Math.min(6,(v.indicator===indicator?v.indicatorDrops??0:0)+1):undefined,
  indicatorAddedAtMs:indicator&&indicator!=="universal"?Date.now():undefined
 }));
 return next!==bench&&bench.titrationPair?.targetId===id&&bench.titration&&indicator?
  {...next,titration:{...bench.titration,indicator}}:next;
}
/** The universal paper remains separate; only dissolved indicator travels
 * when the solution is poured into another vessel. */
function carriedLabIndicator(source:LabVessel,target:LabVessel){
 const donor=source.indicator&&source.indicator!=="universal"?source:undefined;
 return {indicator:target.indicator??donor?.indicator,
  indicatorDrops:target.indicatorDrops??donor?.indicatorDrops,
  indicatorAddedAtMs:target.indicatorAddedAtMs};
}
export function setLabEnvironment(bench:LabBench,id:string,environment:ReactionEnvironment):LabBench{
 return revise(bench,id,v=>{
  const previous=labObservation(v);
  const next=identifyReaction(v.reagents,environment);
  const starts=previous.status!=="reaction"&&!v.uncertain&&next.status==="reaction";
  return {...v,environment,
   reactionHeat:environment!==v.environment?undefined:v.reactionHeat,
   reactionAmounts:environment===v.environment?v.reactionAmounts:undefined,
   completedReaction:v.completedReaction??(previous.status==="reaction"?previous.caseData:undefined),
   // Future chemistry is unknown, but previously visible products stay visible.
   uncertain:v.uncertain||previous.status==="reaction",
   visualStartedAtMs:starts?Date.now():v.visualStartedAtMs,
   observed:v.reagents.length>1||next.status==="reaction"};
 });
}
/** Classroom water-soluble solids: appearance only, not a solubility claim. */
/** The physical form wins over the dry storage state. A poured sodium
 * granule does not make a beaker of water "dry". Aqueous acid stock remains
 * aqueous even when the destination vessel was dry. Gas or neat organic
 * liquids are not silently reclassified as water. */
const LAB_NEAT_LIQUIDS=new Set(["C2H5OH","CH3OH","C3H8O","Br2","CH3CHO"]);
export function labMixEnvironment(
 inputs:readonly {environment:ReactionEnvironment;doses?:Record<string,LabDose>}[],
 combinedDoses?:Record<string,LabDose>
):ReactionEnvironment{
 const all:Record<string,LabDose>=combinedDoses??Object.assign({},...inputs.map(x=>x.doses??{}));
 const measured=Object.entries(all);
 if(measured.some(([id,d])=>d.unit==="ml"&&!LAB_NEAT_LIQUIDS.has(id)&&
  substances.find(s=>s.id===id)?.kind!=="газ"))return "aqueous";
 // Preserve explicitly requested dry experiments when every portion is solid.
 if(measured.length&&measured.every(([,d])=>d.unit==="g")&&
  inputs.some(x=>x.environment==="dry"))return "dry";
 return inputs.some(x=>x.environment==="aqueous")?"aqueous":"dry";
}
export const LAB_WATER_SOLUTES=new Set([
 "NaCl","KCl","NaBr","KBr","NaNO3","KNO3","LiCl","LiNO3",
 "Na2SO4","K2SO4","MgSO4","CuSO4","FeSO4","NiSO4","CaCl2",
 "BaCl2","AgNO3","Na2CO3","NaHCO3","KI","KMnO4",
 "C12H22O11","C6H12O6"
]);
export function putLabReagent(bench:LabBench,id:string,reagent:string,dose?:LabDose):LabBench{
 if(!bench.vessels.some(v=>v.id===id&&!v.stoppered))return bench;
 // Legacy callsites and presets receive a REAL, explicit stock dose.
 // Never create a reagent name without material quantity / concentration.
 const stock=dose??labDefaultStockDose(reagent);
 if(!stock)return bench;
 const measured:LabDose=stock.unit==="ml"&&stock.concentrationM===undefined&&
  labIsPreparedStock(reagent)?{...stock,concentrationM:LAB_STOCK_MOLARITY_M}:stock;
 const updated=revise(bench,id,v=>{
  const validDose=Number.isFinite(measured.value)&&measured.value>0&&
   measured.value<=10000&&(measured.unit==="ml"||measured.unit==="g")&&
   (measured.concentrationM===undefined||
    (measured.unit==="ml"&&Number.isFinite(measured.concentrationM)&&
     measured.concentrationM>=.001&&measured.concentrationM<=2))?measured:undefined;
  if(!validDose)return v;
  // Graduated glassware has a real maximum capacity, not an unlimited beaker.
  const priorMl=labVesselQuantity(v).occupiedMl;
  if(validDose?.unit==="ml"&&
   priorMl+(substances.find(s=>s.id===reagent)?.kind==="газ"?0:validDose.value)>
    labVesselQuantity(v).capacityMl+1e-7)return v;
  if((v.kind==="pipette"||v.kind==="burette")&&validDose?.unit==="g")return v;
  // Known crystalline solids occupy physical vessel volume too. Don't
  // accept an extra weighed sample if it would exceed the rim.
  if(validDose.unit==="g"&&precipitateDensity(reagent)&&
   priorMl+validDose.value/precipitateDensity(reagent)>
    labVesselQuantity(v).capacityMl+1e-7)return v;
  const present=v.reagents.includes(reagent);
  if(!present&&v.reagents.length>=MAX_VESSEL_REAGENTS)return v;
  const previous=v.doses?.[reagent];
  if(present&&!validDose)return v;
  if(previous&&validDose&&previous.unit!==validDose.unit)return v;
  const combined=validDose?{value:Math.round(((previous?.value??0)+validDose.value)*100)/100,
   unit:validDose.unit,
   ...(validDose.unit==="ml"&&validDose.concentrationM!==undefined?
    {concentrationM:previous?.concentrationM!==undefined?
      ((previous.value*previous.concentrationM)+(validDose.value*validDose.concentrationM))/
        ((previous.value+validDose.value)) :validDose.concentrationM}:
    previous?.concentrationM!==undefined?{concentrationM:previous.concentrationM}:{})}:undefined;
  if(combined&&combined.value>10000)return v;
  const reagents=present?v.reagents:[...v.reagents,reagent];
  const beforeReaction=labObservation(v);
  const nextDoses=combined?{...v.doses,[reagent]:combined}:v.doses;
  const environment=labMixEnvironment([{environment:v.environment,doses:v.doses},
   {environment:validDose?.unit==="g"?"dry":"aqueous",
    doses:validDose?{[reagent]:validDose}:undefined}],nextDoses);
  // Once a reviewed reaction has FINISHED, material is identified by
  // its balanced products and leftover reactants, not by historical stock
  // names. Switch to the persistent species ledger before a new addition.
  // Never replay a partially completed gas reaction as a final product.
  const finishedPrevious=!!v.completedReaction||!!v.reactionAmounts?.complete;
  const previousInventory=!v.chemicalInventory&&finishedPrevious&&
   !v.uncertain&&v.doses?
   simulateLabInventory({...v,volumeMl:labVesselQuantity(v).volumeMl}):undefined;
  const persistent= v.chemicalInventory??(
   previousInventory&&!previousInventory.unmeasured.length&&
   !previousInventory.limited?labInventorySnapshot(previousInventory):undefined);
  if(persistent){
   const addedMol=labDoseMoles(reagent,validDose);
   if(addedMol===undefined||!Number.isFinite(addedMol)||addedMol<=0)return v;
   const original=persistent;
   const speciesMol={...original.speciesMol,
    [reagent]:(original.speciesMol[reagent]??0)+addedMol};
   const solidMol={...original.solidMol};
   if(validDose.unit==="g"&&
    (environment!=="aqueous"||!LAB_WATER_SOLUTES.has(reagent)))
    solidMol[reagent]=(solidMol[reagent]??0)+addedMol;
   const currentVolume=labVesselQuantity(v).volumeMl+
    (validDose.unit==="ml"&&substances.find(s=>s.id===reagent)?.kind!=="газ"?
     validDose.value:0);
   const quantified=simulateLabInventory({
    reagents:Object.keys(speciesMol),environment,stoppered:v.stoppered,
    temperatureC:v.temperatureC,volumeMl:currentVolume,
    chemicalInventory:{speciesMol,solidMol,
     retainedGasMol:original.retainedGasMol,
     releasedGasMol:original.releasedGasMol,
     equilibriumEquations:original.equilibriumEquations,
     settled:original.settled===true&&reagent==="H2O"}
   });
   const productIds=Object.keys(quantified.speciesMol);
   const confirmed=quantified.steps.length?
    reviewedReactionCases.find(row=>row.equation===quantified.steps[quantified.steps.length-1].equation):
    undefined;
   return {...v,reagents:productIds,doses:nextDoses,environment,
    chemicalInventory:{...labInventorySnapshot(quantified),
     ...(original.settled===true&&reagent==="H2O"?{settled:true}:{})},
    binarySaltPhase:undefined,mixedSaltPhase:undefined,
    physicalProcess:undefined,physicalStartedAtMs:undefined,
    filteredSolution:v.filteredSolution?
     {...v.filteredSolution,solutes:productIds.filter(x=>x!=="H2O")}:undefined,
    reactionAmounts:undefined,completedReaction:confirmed??v.completedReaction,
    reactionHeat:undefined,
    observed:true,uncertain:quantified.limited||quantified.unmeasured.length>0,
    visualStartedAtMs:confirmed?Date.now():v.visualStartedAtMs};
  }
  const matching=identifyReaction(reagents,environment);
  const previousAmounts=v.reactionAmounts;
  const recorded=v.completedReaction??(beforeReaction.status==="reaction"?
   beforeReaction.caseData:undefined);
  const equation=previousAmounts?.equation??recorded?.equation;
  // Adding solvent cannot annihilate an existing precipitate! Pure carrier
  // H2O is distinguished from H2O consumed by a balanced reaction.
  const carrierWater=reagent==="H2O"&&!!equation&&
   !parseBalancedLabEquation(equation)?.reactants.some(t=>t.formula==="H2O");
  const sameReaction=!!equation&&matching.status==="reaction"&&
   matching.caseData?.equation===equation;
  // Redosing an original reactant recomputes extent from the complete
  // cumulative inventory. An already settled solid does not disappear.
  const newState=previousAmounts&&sameReaction&&matching.caseData?
   startQuantifiedLabReaction(matching.caseData,reagents,nextDoses):null;
  const preservedAmounts=previousAmounts&&carrierWater?previousAmounts:
   newState?advanceQuantifiedLabReaction(newState,
    previousAmounts?.elapsedSeconds??0):previousAmounts;
  const physicalDissolution=!!nextDoses?.H2O&&nextDoses.H2O.unit==="ml"&&
   reagents.some(key=>key!=="H2O"&&
    (LAB_WATER_SOLUTES.has(key)||
     labSingleSaltSolubilityGPer100gWater(key,v.temperatureC??22)!==undefined)&&
    nextDoses?.[key]?.unit==="g")&&matching.status!=="reaction";
  const priorReaction=!!equation;
  const unsupportedAddition=priorReaction&&!carrierWater&&!sameReaction;
  const eq=labBinarySaltEquilibrium({...v,reagents,doses:nextDoses,
   environment},v.temperatureC??22);
  const prior=eq&&v.binarySaltPhase?.formula===eq.formula?v.binarySaltPhase:undefined;
  const freshDryMol=eq?.formula===reagent&&measured.unit==="g"?
   measured.value/eq.molarMass:0;
  const binarySaltPhase=eq?{formula:eq.formula,
   solidMol:Math.min(eq.totalMol,prior?prior.solidMol+freshDryMol:
    physicalDissolution?eq.totalMol:eq.equilibriumSolidMol)}:undefined;
  // Store separately moving solid fractions when adding water or dry
  // material to two or more salts. An actual balanced reaction takes
  // priority over the approximate nonreactive mixture calculation.
  const proposedMix=!recorded&&!preservedAmounts&&!v.uncertain?
   labSchoolMixedSaltEquilibrium({...v,reagents,doses:nextDoses,
    environment,completedReaction:undefined,reactionAmounts:undefined},
    v.temperatureC??22):undefined;
  const mixedEq=proposedMix&&!simulateLabInventory({
   reagents,doses:nextDoses,environment,
   temperatureC:v.temperatureC??22}).steps.length?proposedMix:undefined;
  const mixedSaltPhase:Record<string,number>|undefined=mixedEq?
   Object.fromEntries(mixedEq.formulas.map(key=>{
    const mass=labMolarMass(key)!;
    const priorMeasured=v.doses?.[key];
    const priorTotal=priorMeasured?.unit==="g"?priorMeasured.value/mass:0;
    const oldPhase=v.mixedSaltPhase?.[key]??
     (v.binarySaltPhase?.formula===key?v.binarySaltPhase.solidMol:
      priorMeasured?.unit==="g"?
       !v.doses?.H2O?priorTotal:
        labBinarySaltEquilibrium(v,v.temperatureC??22)?.equilibriumSolidMol??priorTotal:
       0);
    const added=key===reagent&&validDose.unit==="g"?
     validDose.value/mass:0;
    const total=nextDoses?.[key]?.value?nextDoses[key].value/mass:0;
    return [key,Math.max(0,Math.min(total,oldPhase+added))];
   })):undefined;
  const movingMixture=!!mixedEq&&mixedEq.formulas.some(key=>
   Math.abs((mixedSaltPhase?.[key]??0)-(mixedEq.solidMol[key]??0))>
   Math.max(1e-10,(nextDoses?.[key]?.value??0)/
    (labMolarMass(key)??1)*.0005));
  const crystallizingMixture=movingMixture&&mixedEq!.formulas.some(key=>
   (mixedSaltPhase?.[key]??0)<(mixedEq!.solidMol[key]??0)-1e-10);
  return {...v,reagents,meltFraction:undefined,phaseTransition:undefined,
   reactionHeat:unsupportedAddition?undefined:v.reactionHeat,
   binarySaltPhase,mixedSaltPhase,
   physicalProcess:movingMixture?
    (crystallizingMixture?"crystallizing":"dissolving"):
    physicalDissolution?"dissolving":undefined,
   physicalStartedAtMs:movingMixture||physicalDissolution?Date.now():undefined,
   reactionAmounts:preservedAmounts,
   completedReaction:recorded,
   doses:nextDoses,
   observed:reagents.length>1,
   environment,
   visualStartedAtMs:reagents.length>1&&!v.uncertain&&!priorReaction&&
    matching.status==="reaction"?Date.now():v.visualStartedAtMs,
   // Unsupported next-stage chemistry remains explicit, but known measured
   // products are NEVER erased just because another substance was added.
   uncertain:v.uncertain||unsupportedAddition};
 });
 const activeMixer=placedLabDevices(updated).some(d=>
  d.kind==="stirrer"&&d.active&&d.powered&&d.linkedVesselId===id);
 const running=updated!==bench&&activeMixer?
  {...updated,stirringVesselId:id}:updated;
 return running!==bench&&bench.titrationPair&&
  (bench.titrationPair.sourceId===id||bench.titrationPair.targetId===id)?
  {...running,titrationPair:undefined,titration:undefined}:running;
}
/** Graduated transfers for pipettes and cylinders. Only a single
 * homogeneous liquid with a known volume can be transferred precisely. */
export const labMeasuredCapacityMl=(kind:LabGlassware):number|undefined=>
 kind==="pipette"?25:kind==="burette"?50:kind==="cylinder"?100:
 kind==="volumetric"?100:undefined;
/** Measure a declared volume of a homogeneous liquid without creating
 * substance from nothing. Mixed SOLUTIONS are transferred proportionally,
 * while dry powders and unmeasured compositions cannot be pipetted. */
/** Transfer a requested volume in hundredth-milliliter units.
 * Mixed solutions are sampled proportionally, without intermediate
 * reactions or floating-point rounding losing / inventing liquid. */
/** Exact supernatant sampling from a mixed measured inventory. Insoluble
 * particles remain in the donor; all dissolved molecule counts are divided
 * by the requested physical liquid-volume fraction. */
function transferSnapshotSample(bench:LabBench,source:LabVessel,target:LabVessel,
 amountMl:number):LabBench{
 if(source.reactionAmounts&&!source.reactionAmounts.complete||
  target.reactionAmounts&&!target.reactionAmounts.complete)return bench;
 const donorMl=labVesselQuantity(source).volumeMl;
 if(donorMl<amountMl-1e-8||donorMl<=0||
  labVesselQuantity(target).volumeMl+amountMl>
   labVesselQuantity(target).capacityMl+1e-8)return bench;
 const donor=simulateLabInventory({...source,volumeMl:donorMl});
 const receiver=simulateLabInventory({...target,
  volumeMl:labVesselQuantity(target).volumeMl});
 if(donor.unmeasured.length||receiver.unmeasured.length||
  donor.limited||receiver.limited)return bench;
 const fraction=amountMl/donorMl;
 const fromSpecies={...donor.speciesMol};
 const toSpecies={...receiver.speciesMol};
 for(const [id,total] of Object.entries(donor.speciesMol)){
  const dissolved=Math.max(0,total-(donor.solidMol[id]??0));
  const portion=dissolved*fraction;
  const remainder=total-portion;
  if(remainder>1e-12)fromSpecies[id]=remainder;
  else delete fromSpecies[id];
  if(portion>1e-12)toSpecies[id]=(toSpecies[id]??0)+portion;
 }
 const fromDoses={...source.doses},toDoses={...target.doses};
 for(const [id,dose] of Object.entries(source.doses??{})){
  if(dose.unit!=="ml")continue;
  const portion=dose.value*fraction;
  const old=toDoses[id];
  if(old&&(old.unit!=="ml"||old.value+portion>10000))return bench;
  const value=(old?.value??0)+portion;
  const concentrationM=old?.concentrationM!==undefined&&
   dose.concentrationM!==undefined?
    (old.value*old.concentrationM+portion*dose.concentrationM)/value:
    old?undefined:dose.concentrationM;
  toDoses[id]={value,unit:"ml",
   ...(concentrationM===undefined?{}:{concentrationM})};
  const left=dose.value-portion;
  if(left>1e-9)fromDoses[id]={...dose,value:left};
  else delete fromDoses[id];
 }
 const movedCarrier=(source.filteredSolution?.volumeMl??0)*fraction;
 const leftCarrier=(source.filteredSolution?.volumeMl??0)-movedCarrier;
 const toCarrier=(target.filteredSolution?.volumeMl??0)+movedCarrier;
 const medium=labMixEnvironment([source,target],toDoses);
 const targetInventory=simulateLabInventory({
  reagents:Object.keys(toSpecies),environment:medium,
  volumeMl:labVesselQuantity(target).volumeMl+amountMl,
  temperatureC:target.temperatureC,
  chemicalInventory:{speciesMol:toSpecies,solidMol:receiver.solidMol,
   retainedGasMol:receiver.retainedGasMol,
   settled:!!source.chemicalInventory?.settled&&
    !target.reagents.length,
   releasedGasMol:receiver.releasedGasMol,
   equilibriumEquations:[...new Set([
    ...donor.equilibriumEquations,...receiver.equilibriumEquations])].slice(-8)}
 });
 if(targetInventory.limited||targetInventory.unmeasured.length||
  Object.keys(targetInventory.speciesMol).length>MAX_VESSEL_REAGENTS)return bench;
 const toSnapshot:LabChemicalSnapshot={...labInventorySnapshot(targetInventory),
  ...(source.chemicalInventory?.settled&&!target.reagents.length?
   {settled:true}:{})};
 const fromSnap:LabChemicalSnapshot={speciesMol:fromSpecies,
  solidMol:{...donor.solidMol},retainedGasMol:{...donor.retainedGasMol},
  releasedGasMol:{...donor.releasedGasMol},
  equilibriumEquations:[...donor.equilibriumEquations],
  settled:!!source.chemicalInventory?.settled};
 const fromIds=Object.keys(fromSpecies),toIds=Object.keys(toSnapshot.speciesMol);
 const last=targetInventory.steps[targetInventory.steps.length-1];
 const lastCase=last?reviewedReactionCases.find(c=>c.equation===last.equation):undefined;
 const vessels=bench.vessels.map(v=>{
  if(v.id===source.id)return {...v,reagents:fromIds,
   doses:Object.keys(fromDoses).length?fromDoses:undefined,
   chemicalInventory:fromIds.length?fromSnap:undefined,
   filteredSolution:leftCarrier>1e-9&&source.filteredSolution?
    {...source.filteredSolution,solutes:fromIds.filter(x=>x!=="H2O"),
     volumeMl:leftCarrier}:undefined,
   observed:fromIds.length>0,uncertain:false,
   reactionAmounts:undefined,
   completedReaction:fromIds.length?v.completedReaction:undefined};
  if(v.id===target.id)return {...v,reagents:toIds,
   doses:Object.keys(toDoses).length?toDoses:undefined,
   chemicalInventory:toSnapshot,
   filteredSolution:toCarrier>1e-9?
    {sourceEquation:source.filteredSolution?.sourceEquation??
     target.filteredSolution?.sourceEquation??"",
     solutes:toIds.filter(x=>x!=="H2O"),volumeMl:toCarrier}:undefined,
   environment:medium,observed:true,uncertain:false,
   completedReaction:lastCase??v.completedReaction,
   reactionAmounts:undefined,
   ...carriedLabIndicator(source,v),
   visualStartedAtMs:lastCase?Date.now():v.visualStartedAtMs};
  return v;
 });
 return bump(bench,vessels,target.id);
}
export function transferLabMeasuredLiquid(
 bench:LabBench,sourceId:string,targetId:string,volumeMl:number
):LabBench{
 if(sourceId===targetId||!Number.isFinite(volumeMl)||volumeMl<.01||
  Math.abs(volumeMl*100-Math.round(volumeMl*100))>1e-6)return bench;
 const source=bench.vessels.find(v=>v.id===sourceId);
 const target=bench.vessels.find(v=>v.id===targetId);
 if(!source||!target||!source.reagents.length||source.stoppered||target.stoppered)return bench;
 if(source.chemicalInventory||target.chemicalInventory)
  return transferSnapshotSample(bench,source,target,volumeMl);
 const entries=source.reagents.map(id=>({id,dose:source.doses?.[id]}));
 if(entries.some(e=>!e.dose||e.dose.unit!=="ml"||e.dose.value<=0))return bench;
 const amounts=entries.map(e=>Math.round(e.dose!.value*100));
 const totalCents=amounts.reduce((n,v)=>n+v,0);
 const requested=Math.round(volumeMl*100);
 if(requested>totalCents)return bench;
 const capacity=labVesselQuantity(target).capacityMl;
 const current=labVesselQuantity(target).volumeMl;
 if(capacity!==undefined&&current+volumeMl>capacity+1e-7)return bench;
 // Decide which solutes actually enter the recipient after rounding to 0.01 ml.
 // An untransferred trace must not appear as a new reagent in the target.
 // Largest remainder allocation: every 0.01ml is attributed to a component,
 // and no component can contribute more than its actual stock.
 const exactShares=amounts.map(v=>requested*v/totalCents);
 const allocated=exactShares.map(v=>Math.floor(v));
 let remainder=requested-allocated.reduce((n,v)=>n+v,0);
 const order=exactShares.map((_,i)=>i).sort((a,b)=>
  (exactShares[b]-Math.floor(exactShares[b]))-
  (exactShares[a]-Math.floor(exactShares[a]))||a-b);
 for(const i of order){
  if(remainder<=0)break;
  if(allocated[i]<amounts[i]){allocated[i]++;remainder--}
 }
 if(remainder!==0)return bench;
 const transferredIds=entries.filter((_,i)=>allocated[i]>0).map(e=>e.id);
 const ids=[...new Set([...target.reagents,...transferredIds])];
 if(ids.length>MAX_VESSEL_REAGENTS)return bench;
 const received={...target.doses};
 const left={...source.doses};
 for(let i=0;i<entries.length;i++){
  const {id,dose}=entries[i],portion=allocated[i]/100;
  if(portion<=0)continue;
  const existing=received[id];
  if(existing?.unit!=="ml"&&existing!==undefined)return bench;
  const quantity=Math.round(((existing?.value??0)+portion)*100)/100;
  if(quantity>10000)return bench;
  const concentrationM=existing?
   existing.concentrationM!==undefined&&dose!.concentrationM!==undefined?
    ((existing.value*existing.concentrationM)+(portion*dose!.concentrationM))/quantity:
    undefined:dose!.concentrationM;
  received[id]={value:quantity,unit:"ml",
   ...(concentrationM!==undefined?{concentrationM:Math.round(concentrationM*1e5)/1e5}:{})};
  const remaining=Math.round((dose!.value-portion)*100)/100;
  if(remaining>0)left[id]={...dose!,value:remaining};
  else delete left[id];
 }
 const remainingIds=source.reagents.filter(id=>left[id]);
 const wasEmpty=target.reagents.length===0;
 const sourceReaction=source.completedReaction??labObservation(source).caseData;
 const targetReaction=target.completedReaction??labObservation(target).caseData;
 const medium=wasEmpty?source.environment:target.environment;
 const uncertain=Boolean(source.uncertain||target.uncertain||source.reactionAmounts||target.reactionAmounts||
  (!wasEmpty&&(sourceReaction||targetReaction))||
  (!wasEmpty&&source.environment!==target.environment&&source.environment!=="aqueous"));
 const newReaction=!uncertain&&!sourceReaction&&!targetReaction&&
  identifyReaction(ids,medium).status==="reaction";
 const now=newReaction?Date.now():undefined;
 const vessels=bench.vessels.map(v=>{
  if(v.id===sourceId)return {...v,reactionAmounts:undefined,
    uncertain:!!source.reactionAmounts||v.uncertain,reagents:remainingIds,
   doses:remainingIds.length?left:undefined,
   observed:remainingIds.length?v.observed:false,
   completedReaction:remainingIds.length?v.completedReaction:undefined,
   indicator:remainingIds.length?v.indicator:undefined,
    indicatorDrops:remainingIds.length?v.indicatorDrops:undefined,
    indicatorAddedAtMs:remainingIds.length?v.indicatorAddedAtMs:undefined,
   visualStartedAtMs:remainingIds.length?v.visualStartedAtMs:undefined};
  if(v.id===targetId)return {...v,reactionAmounts:undefined,reagents:ids,doses:received,
   observed:ids.length>1||source.observed,
   environment:medium,uncertain,
   completedReaction:wasEmpty?sourceReaction:targetReaction,
   ...carriedLabIndicator(source,v),
   visualStartedAtMs:now??v.visualStartedAtMs};
  return v;
 });
 return {...bench,vessels,event:bench.event+1};
}
/** Quantity readout shared by the board and fullscreen laboratory.
 * Liquid fill is proportional to the simulated vessel capacity. For loose
 * solids a reference scale is used because density/packing are unknown. */
/** The insoluble reviewed product stays as residue on the virtual filter;
 * the liquid moves into an EMPTY receiving vessel. No funnel is reinstated. */
export function filterLabPrecipitate(bench:LabBench,sourceId:string,targetId:string):LabBench{
 if(sourceId===targetId||!placedLabDevices(bench).some(d=>d.kind==="filter"))return bench;
 const source=bench.vessels.find(v=>v.id===sourceId);
 const target=bench.vessels.find(v=>v.id===targetId);
 if(!source||!target||source.filteredResidue||source.uncertain||
  source.stoppered||target.stoppered||target.reagents.length||
  target.filteredResidue||target.filteredSolution||
  !["beaker","tube","flask","conical","volumetric"].includes(target.kind)||
  (source.reactionAmounts&&!source.reactionAmounts.complete))return bench;
 const reaction=labObservation(source).caseData;
 if(!reaction||reaction.observation!=="precipitate")return bench;
 // A measured suspension cannot be filtered before the visual/reaction
 // timer has reached completion, even though the equilibrium solver can
 // already calculate its final mass balance.
 if(!source.reactionAmounts&&!source.completedReaction&&
  startQuantifiedLabReaction(reaction,source.reagents,source.doses))return bench;
 const inventory=simulateLabInventory({
  ...source,volumeMl:labVesselQuantity(source).volumeMl
 });
 if(inventory.unmeasured.length||inventory.limited)return bench;
 const solidEntries=Object.entries(inventory.solidMol).filter(([,mol])=>mol>1e-12);
 // Filter paper RETAINS every solid particle. It does not identify or
 // chemically separate one precipitate from another. Retain their
 // distinct quantified inventories and masses as a mixed filter cake.
 if(!solidEntries.length)return bench;
 const components=solidEntries.map(([formula,mol])=>{
  const molar=labMolarMass(formula);
  return molar!==undefined?{formula,massG:mol*molar,
   color:reaction.afterColor??"#eef0ed"}:undefined;
 });
 if(components.some(component=>!component))return bench;
 const retained=components as {formula:string;massG:number;color:string}[];
 const [first]=retained;
 const solid=first.formula,massG=retained.reduce((mass,c)=>mass+c.massG,0);
 const volume=labVesselQuantity(source).volumeMl;
 if(volume<=0||volume>labVesselQuantity(target).capacityMl)return bench;
 const soluble:Record<string,number>={};
 for(const [formula,mol] of Object.entries(inventory.speciesMol)){
  const remaining=Math.max(0,mol-(inventory.solidMol[formula]??0));
  if(remaining>1e-12)soluble[formula]=remaining;
 }
 // List reaction products first, then residual reactants. Both remain
 // present quantitatively, including nonzero solubility at equilibrium.
 const productOrder=parseBalancedLabEquation(reaction.equation)?.products.map(t=>t.formula)??[];
 const solutes=[...new Set([...productOrder,...Object.keys(soluble)])].
  filter(id=>id!=="H2O"&&(soluble[id]??0)>1e-12);
 if(solutes.length>MAX_VESSEL_REAGENTS)return bench;
 const color=reaction.afterColor??"#eef0ed";
 const mixed=retained.length>1;
 const solidMoles=Object.fromEntries(solidEntries);
 const filteredResidue:LabFilteredResidue={formula:solid,color,massG,
  ...(mixed?{components:retained}: {})};
 const vessels=bench.vessels.map(v=>{
  if(v.id===sourceId)return {...v,reagents:mixed?
   retained.map(item=>item.formula):[solid],
   reactionHeat:undefined,
   environment:"dry" as const,observed:false,uncertain:false,
   indicator:undefined,completedReaction:undefined,reactionAmounts:undefined,
   chemicalInventory:mixed?{speciesMol:{...solidMoles},
    solidMol:{...solidMoles},retainedGasMol:{},
    releasedGasMol:{...inventory.releasedGasMol}}:undefined,
   filteredSolution:undefined,filteredResidue,
   doses:mixed?undefined:{[solid]:{unit:"g" as const,value:massG}},
   visualStartedAtMs:undefined};
  if(v.id===targetId)return {...v,reagents:solutes,
   reactionHeat:undefined,environment:"aqueous" as const,
   observed:false,uncertain:false,
   indicator:undefined,completedReaction:undefined,reactionAmounts:undefined,
   filteredResidue:undefined,
   filteredSolution:{sourceEquation:reaction.equation,solutes,volumeMl:volume},
   chemicalInventory:{speciesMol:soluble,solidMol:{},retainedGasMol:{},
    settled:true},
   doses:undefined,visualStartedAtMs:undefined};
  return v;
 });
 return {...bench,vessels,selectedId:sourceId,event:bench.event+1};
}

/** Pour a reacted suspension onto a placed filter cartridge.
 * It retains the actual precipitate and lets the liquid through into a
 * clean receiver automatically. No chooser, extra dialogs, or funnel. */
export function pourLabIntoFilter(bench:LabBench,sourceId:string,filterId:string):LabBench{
 const device=placedLabDevices(bench).find(d=>d.id===filterId&&d.kind==="filter");
 const source=bench.vessels.find(v=>v.id===sourceId);
 if(!device||device.collectedResidue||!source)return bench;
 const pouringVolume=Object.values(source.doses??{}).reduce((sum,d)=>
  sum+(d.unit==="ml"?d.value:0),0);
 const receiver=bench.vessels.filter(v=>v.id!==sourceId&&!v.reagents.length&&
  ["beaker","conical","flask","tube","volumetric"].includes(v.kind)&&
  (labMeasuredCapacityMl(v.kind)??(v.kind==="tube"?25:v.kind==="conical"||v.kind==="flask"?200:150))>=pouringVolume)
  .sort((a,b)=>Math.hypot(a.x-device.x,a.y-device.y)-
                 Math.hypot(b.x-device.x,b.y-device.y))[0];
 let prepared=bench;
 if(!receiver){
  if(bench.vessels.length>=MAX_BENCH_VESSELS)return bench;
  if(pouringVolume>200)return bench;
  prepared=addLabVessel(bench,pouringVolume>150?"conical":"beaker",
   {x:Math.min(82,device.x+8),y:Math.min(84,device.y+11)});
 }
 const target=receiver??prepared.vessels[prepared.vessels.length-1];
 const separated=filterLabPrecipitate(prepared,sourceId,target.id);
 if(separated===prepared)return bench;
 const solid=separated.vessels.find(v=>v.id===sourceId)?.filteredResidue;
 if(!solid)return bench;
 return {...separated,selectedId:target.id,
  vessels:separated.vessels.map(v=>v.id!==sourceId?v:{
   ...v,reagents:[],doses:undefined,filteredResidue:undefined,
   filteredSolution:undefined,chemicalInventory:undefined,environment:"aqueous" as const,
   physicalProcess:undefined,physicalStartedAtMs:undefined,
   indicator:undefined,visualStartedAtMs:undefined,
   reactionAmounts:undefined,completedReaction:undefined,observed:false}),
  placedDevices:placedLabDevices(separated).map(d=>d.id===filterId?
   {...d,collectedResidue:solid,filterStartedAtMs:Date.now()}:d),
  event:separated.event+1};
}

/** School displacement: source crystal density when measured, a marked
 * illustrative particle density otherwise. This is not wet-sediment porosity.
 * A separate flag distinguishes estimates from verified true densities.
 * BaSO4 4.5 g/cm³: ICSC 0827 (ILO/WHO);
 * density table shared with the existing precipitate appearance model.
 * Keep this independent of labVesselQuantity to avoid recursion. */
export function labVesselSolidDisplacement(vessel:LabVessel){
 const liquidMl=(vessel.filteredSolution?.volumeMl??0)+
  Object.entries(vessel.doses??{}).reduce((total,[id,d])=>
   total+(d.unit==="ml"&&substances.find(s=>s.id===id)?.kind!=="газ"?
    d.value:0),0);
 const inventory=vessel.reagents.length?simulateLabInventory({
  ...vessel,volumeMl:liquidMl}):undefined;
 let volumeMl=0;
 let complete=true,estimated=false;
 if(inventory?.unmeasured.length||inventory?.limited)complete=false;
 for(const [formula,mol] of Object.entries(inventory?.solidMol??{})){
  if(mol<=1e-12)continue;
  const density=precipitateDensity(formula),mass=labMolarMass(formula);
  if(LAB_CRYSTAL_DENSITY_G_ML[formula]===undefined)estimated=true;
  if(!density||mass===undefined){complete=false;continue}
  volumeMl+=mol*mass/density;
 }
 return {volumeMl,complete,estimated};
}
function calculateLabVesselQuantity(vessel:LabVessel){
 const doses=Object.values(vessel.doses??{});
 const volumeMl=Math.round(((vessel.filteredSolution?.volumeMl??0)+
  Object.entries(vessel.doses??{}).reduce((total,[id,d])=>
  total+(d.unit==="ml"&&substances.find(s=>s.id===id)?.kind!=="газ"?d.value:0),0))*100)/100;
 const massG=Math.round(doses.reduce((total,d)=>
  total+(d.unit==="g"?d.value:0),0)*100)/100;
 const capacityMl=labMeasuredCapacityMl(vessel.kind)??(
  vessel.kind==="tube"?25:vessel.kind==="dish"||vessel.kind==="crucible"?70:
  vessel.kind==="conical"||vessel.kind==="flask"?200:150);
 const massReferenceG=vessel.kind==="tube"||vessel.kind==="pipette"?10:
  vessel.kind==="crucible"||vessel.kind==="dish"?30:100;
 const displacement=labVesselSolidDisplacement(vessel);
 const solidVolumeMl=displacement.volumeMl;
 const occupiedMl=volumeMl+solidVolumeMl;
 return {volumeMl,massG,capacityMl,massReferenceG,solidVolumeMl,occupiedMl,
  availableMl:Math.max(0,capacityMl-occupiedMl),
  solidVolumeComplete:displacement.complete,
  solidVolumeEstimated:displacement.estimated,
  liquidFraction:Math.min(.96,volumeMl/capacityMl),
  solidFraction:Math.min(.9,massG/massReferenceG)};
}
/** Solid displacement runs a full measured reaction inventory. It must not
 * repeat on every render, pointer movement or unrelated bench state change.
 * Every actual lab process produces a new vessel object and is recalculated. */
const quantityByVessel=new WeakMap<LabVessel,ReturnType<typeof calculateLabVesselQuantity>>();
export function labVesselQuantity(vessel:LabVessel){
 const cached=quantityByVessel.get(vessel);
 if(cached)return cached;
 const quantity=calculateLabVesselQuantity(vessel);
 quantityByVessel.set(vessel,quantity);
 return quantity;
}

/** Adjust the exact sampling volume (ml) of this graduated pipette. */
export function setLabPipetteTarget(bench:LabBench,id:string,ml:number):LabBench{
 if(!Number.isFinite(ml)||ml<.01||ml>25||Math.abs(ml*100-Math.round(ml*100))>1e-6)
  return bench;
 return revise(bench,id,v=>v.kind==="pipette"&&v.pipetteTargetMl!==ml?
  {...v,pipetteTargetMl:ml}:v);
}
export function fillLabVolumetricFlask(bench:LabBench,id:string):LabBench{
 const vessel=bench.vessels.find(v=>v.id===id&&v.kind==="volumetric");
 if(!vessel)return bench;
 const total=Object.values(vessel.doses??{}).reduce((sum,d)=>sum+
  (d.unit==="ml"?d.value:0),0);
 if(total>=100||Object.values(vessel.doses??{}).some(d=>d.unit==="g"))return bench;
 return putLabReagent(bench,id,"H2O",{value:Math.round((100-total)*100)/100,unit:"ml"});
}
/** Full transfer. Never assume that a second step using already reacted
 * mixtures can be predicted from their original reagent identifiers. */
export function activateLabVessel(bench:LabBench,id:string):LabBench{
 return revise(bench,id,v=>({...v,observed:true}));
}
/** Complete transfer of contents: products and their visible appearance move with
 * the liquid. Adding a new reagent to spent material is deliberately unknown. */
/** One shared 20-step pour. The initiating client advances 5% per 150ms tick. */
export function startLabPour(b:LabBench,sourceId:string,targetId:string,id:string):LabBench{
 if(!id||sourceId===targetId||(b.pouring&&b.pouring.step<20))return b;
 const a=b.vessels.find(v=>v.id===sourceId),t=b.vessels.find(v=>v.id===targetId);
 if(!a||!t||!a.reagents.length||a.stoppered||t.stoppered||
  [...new Set([...a.reagents,...t.reagents])].length>MAX_VESSEL_REAGENTS)return b;
 // A quantified filtrate is a phase snapshot, not a set of stock doses.
 // Transfer it atomically rather than running the old dose-only 20-step
 // algorithm which would otherwise leave its dissolved products behind.
 if(a.chemicalInventory||t.chemicalInventory)return pourLabVessel(b,sourceId,targetId);
 const initialDoses={...a.doses};
 const volume=labVesselQuantity(a).volumeMl;
 const current=labVesselQuantity(t).volumeMl;
 const max=labVesselQuantity(t).capacityMl;
 if(volume+current+labVesselQuantity(a).solidVolumeMl+
   labVesselQuantity(t).solidVolumeMl>max+1e-7)return b;
 if(Object.entries(initialDoses).some(([name,d])=>{
  const old=t.doses?.[name];
  return old&&(old.unit!==d.unit||old.value+d.value>10000);
 }))return b;
 return {...b,pouring:{id,sourceId,targetId,step:0,totalSteps:20,initialDoses,
  unmeasured:a.reagents.some(r=>!initialDoses[r])},event:b.event+1};
}
const portionRound=(x:number)=>Math.round(x*1000000)/1000000;
export function advanceLabPour(b:LabBench):LabBench{
 const p=b.pouring;if(!p||p.step>=20)return b;
 const source=b.vessels.find(v=>v.id===p.sourceId),target=b.vessels.find(v=>v.id===p.targetId);
 if(!source||!target||!source.reagents.length)return stopLabPour(b);
 const n=p.step+1,finish=n===20;
 const left={...source.doses},received={...target.doses};
 for(const [reagent,original] of Object.entries(p.initialDoses)){
  const amount=portionRound(portionRound(original.value*n/20)-
   portionRound(original.value*p.step/20));
  const remaining=left[reagent]?.value??0,old=received[reagent];
  if(amount>remaining+1e-7||(old?.value??0)+amount>10000)return stopLabPour(b);
  const updated=portionRound((old?.value??0)+amount);
  const concentrationM=old?
   old.concentrationM!==undefined&&original.concentrationM!==undefined?
    portionRound(((old.value*old.concentrationM)+(amount*original.concentrationM))/updated):
    undefined:original.concentrationM;
  received[reagent]={...original,value:updated,
   ...(concentrationM===undefined?{concentrationM:undefined}:{concentrationM})};
  left[reagent]={...original,value:portionRound(Math.max(0,remaining-amount))};
 }
 const combined=[...new Set([...target.reagents,...source.reagents])];
 const targetWasEmpty=!target.reagents.length;
 const sourceReaction=source.completedReaction??labObservation(source).caseData;
 const targetReaction=target.completedReaction??labObservation(target).caseData;
 const medium=labMixEnvironment([source,target],received);
 const verifiedContinuing=identifyReaction(combined,medium);
 const sameReaction=verifiedContinuing.status==="reaction"&&
  !!target.reactionAmounts&&target.reactionAmounts.equation===verifiedContinuing.caseData?.equation;
 const uncertain=target.uncertain||source.uncertain||!!source.reactionAmounts||
  (!!target.reactionAmounts&&!sameReaction)||
  (p.step===0&&!targetWasEmpty&&Boolean(sourceReaction||targetReaction));
 const vessels=b.vessels.map(v=>{
  if(v.id===source.id)return {...v,reactionAmounts:undefined,
    reactionHeat:finish?undefined:v.reactionHeat,
    uncertain:!!source.reactionAmounts||v.uncertain,reagents:finish?[]:v.reagents,
   doses:finish?undefined:left,observed:finish?false:v.observed,
   completedReaction:finish?undefined:v.completedReaction,
   indicator:finish?undefined:v.indicator,
    indicatorDrops:finish?undefined:v.indicatorDrops,
    indicatorAddedAtMs:finish?undefined:v.indicatorAddedAtMs,
   pourFraction:p.unmeasured?portionRound(.5*(20-n)/20):v.pourFraction};
  if(v.id===target.id){
   const dissolving=received.H2O?.unit==="ml"&&combined.some(key=>
    key!=="H2O"&&LAB_WATER_SOLUTES.has(key)&&received[key]?.unit==="g")&&
    identifyReaction(combined,medium).status!=="reaction";
   return {...v,reactionAmounts:undefined,reagents:combined,doses:received,
   reactionHeat:p.step===0?undefined:v.reactionHeat,
   physicalProcess:dissolving?"dissolving" as const:undefined,
   physicalStartedAtMs:dissolving?(v.physicalStartedAtMs??Date.now()):undefined,
   observed:true,uncertain,environment:medium,
   visualStartedAtMs:!uncertain&&!sourceReaction&&!targetReaction&&
    identifyReaction(combined,medium).status==="reaction"?
    (v.visualStartedAtMs??Date.now()):v.visualStartedAtMs,
   completedReaction:targetWasEmpty?sourceReaction:v.completedReaction,
   ...carriedLabIndicator(source,v),
   pourFraction:p.unmeasured?portionRound(Math.min(1,(v.pourFraction??(targetWasEmpty?0:.5))+.025)):v.pourFraction};
  }
  return v;
 });
 return {...b,vessels,pouring:{...p,step:n},event:b.event+1,
  ...(b.titrationPair&&(b.titrationPair.sourceId===source.id||
   b.titrationPair.targetId===target.id)?{titrationPair:undefined,titration:undefined}:{})};
}
export function stopLabPour(b:LabBench,id?:string):LabBench{
 if(!b.pouring||(id&&b.pouring.id!==id))return b;
 return {...b,pouring:undefined,event:b.event+1};
}
/** Merge the exact physical species ledgers, not their historical stock
 * labels. A later reaction can then consume a filtered product without
 * pretending the original starting materials are still present. */
function mergeLabMoles(a:Record<string,number>,b:Record<string,number>){
 const merged={...a};
 for(const [id,n] of Object.entries(b))merged[id]=(merged[id]??0)+n;
 return merged;
}
function pourMeasuredFiltrate(bench:LabBench,source:LabVessel,target:LabVessel):LabBench{
 const a=simulateLabInventory({...source,volumeMl:labVesselQuantity(source).volumeMl});
 const b=simulateLabInventory({...target,volumeMl:labVesselQuantity(target).volumeMl});
 if(a.unmeasured.length||b.unmeasured.length||a.limited||b.limited)return bench;
 const received={...target.doses};
 for(const [id,dose] of Object.entries(source.doses??{})){
  const existing=received[id];
  if(existing&&existing.unit!==dose.unit)return bench;
  const value=Math.round(((existing?.value??0)+dose.value)*1e6)/1e6;
  if(value<=0||value>10000)return bench;
  const concentrationM=dose.unit==="ml"&&(existing?.concentrationM!==undefined||
   dose.concentrationM!==undefined)?
   existing?.concentrationM!==undefined&&dose.concentrationM!==undefined?
    (existing.value*existing.concentrationM+dose.value*dose.concentrationM)/value:
    undefined:undefined;
  received[id]={value,unit:dose.unit,
   ...(concentrationM===undefined?{}:{concentrationM})};
 }
 const carrier=(source.filteredSolution?.volumeMl??0)+
  (target.filteredSolution?.volumeMl??0);
 const volume=labVesselQuantity(source).volumeMl+labVesselQuantity(target).volumeMl;
 const environment=labMixEnvironment([source,target],received);
 const chemicalInventory:LabChemicalSnapshot={
  speciesMol:mergeLabMoles(a.speciesMol,b.speciesMol),
  solidMol:mergeLabMoles(a.solidMol,b.solidMol),
  retainedGasMol:{},
  releasedGasMol:mergeLabMoles(a.releasedGasMol,b.releasedGasMol),
  equilibriumEquations:[...new Set([
   ...a.equilibriumEquations,...b.equilibriumEquations])].slice(-8),
  settled:!!source.chemicalInventory?.settled&&
   !target.reagents.length
 };
 const reacted=simulateLabInventory({reagents:Object.keys(chemicalInventory.speciesMol),
  chemicalInventory,volumeMl:volume,environment,stoppered:false,
  temperatureC:target.temperatureC??source.temperatureC});
 if(reacted.unmeasured.length||reacted.limited||
  Object.keys(reacted.speciesMol).length>MAX_VESSEL_REAGENTS)return bench;
 const inventory:LabChemicalSnapshot={...labInventorySnapshot(reacted),
  ...(chemicalInventory.settled?{settled:true}:{})};
 const ids=Object.keys(inventory.speciesMol);
 const last=reacted.steps[reacted.steps.length-1];
 const lastCase=last?reviewedReactionCases.find(r=>r.equation===last.equation):undefined;
 const vessels=bench.vessels.map(v=>{
  if(v.id===source.id)return {...v,reagents:[],doses:undefined,
   filteredSolution:undefined,filteredResidue:undefined,chemicalInventory:undefined,
   reactionAmounts:undefined,completedReaction:undefined,reactionHeat:undefined,
   observed:false,uncertain:false,indicator:undefined,
   indicatorDrops:undefined,indicatorAddedAtMs:undefined};
  if(v.id===target.id)return {...v,reagents:ids,
   doses:Object.keys(received).length?received:undefined,
   filteredSolution:carrier>0?{sourceEquation:source.filteredSolution?.sourceEquation??
    target.filteredSolution?.sourceEquation??"",solutes:ids.filter(x=>x!=="H2O"),
    volumeMl:carrier}:undefined,
   filteredResidue:undefined,chemicalInventory:inventory,
   reactionAmounts:undefined,completedReaction:lastCase??target.completedReaction,
   reactionHeat:undefined,environment,observed:true,uncertain:false,
   ...carriedLabIndicator(source,v),
   visualStartedAtMs:lastCase?Date.now():v.visualStartedAtMs};
  return v;
 });
 return bump(bench,vessels,target.id);
}
export function pourLabVessel(bench:LabBench,sourceId:string,targetId:string):LabBench{
 if(sourceId===targetId)return bench;
 const source=bench.vessels.find(v=>v.id===sourceId);
 const target=bench.vessels.find(v=>v.id===targetId);
 if(!source||!target||!source.reagents.length||source.stoppered||target.stoppered)return bench;
 if(source.chemicalInventory||target.chemicalInventory){
  if(labVesselQuantity(source).occupiedMl+labVesselQuantity(target).occupiedMl>
   labVesselQuantity(target).capacityMl+1e-7)return bench;
  return pourMeasuredFiltrate(bench,source,target);
 }
 const reagents=[...new Set([...target.reagents,...source.reagents])];
 if(reagents.length>MAX_VESSEL_REAGENTS)return bench;
 if(labVesselQuantity(source).occupiedMl+labVesselQuantity(target).occupiedMl>
  labVesselQuantity(target).capacityMl+1e-7)return bench;
 const incompatible=Object.entries(source.doses??{}).some(([id,dose])=>{
  const previous=target.doses?.[id];
  return previous&&(previous.unit!==dose.unit||previous.value+dose.value>10000);
 });
 if(incompatible)return bench;
 const targetWasEmpty=target.reagents.length===0;
 const sourceResult=labObservation(source),targetResult=labObservation(target);
 const sourceReaction=source.completedReaction??(sourceResult.status==="reaction"?sourceResult.caseData:undefined);
 const targetReaction=target.completedReaction??(targetResult.status==="reaction"?targetResult.caseData:undefined);
 // Unlike arbitrary product mixtures, putting a dry solid into a liquid
 // is an ordinary, recognized school reaction, not "unknown chemistry".
 const uncertain=Boolean(source.uncertain||target.uncertain||source.reactionAmounts||target.reactionAmounts||
  (!targetWasEmpty&&(sourceReaction||targetReaction)));
 const vessels=bench.vessels.map(v=>{
  if(v.id===sourceId)return {...v,reactionAmounts:undefined,reactionHeat:undefined,reagents:[],observed:false,uncertain:false,
   completedReaction:undefined,indicator:undefined,
    indicatorDrops:undefined,indicatorAddedAtMs:undefined,doses:undefined,
    binarySaltPhase:undefined,physicalProcess:undefined,
    physicalStartedAtMs:undefined};
  if(v.id===targetId){
   const doses={...v.doses};
   for(const [id,dose] of Object.entries(source.doses??{})){
    const old=doses[id];
    const total=Math.round(((old?.value??0)+dose.value)*100)/100;
    // Preserve known concentrations when decanting, and use a
    // volume-weighted average for two same-solute solutions.
    const concentrationM=dose.unit==="ml"&&
     (old?old.concentrationM!==undefined&&dose.concentrationM!==undefined:
      dose.concentrationM!==undefined)?
     Math.round(((old?.value??0)*(old?.concentrationM??0)+
      dose.value*(dose.concentrationM??0))/total*100000)/100000:undefined;
    doses[id]={value:total,unit:dose.unit,
     ...(concentrationM!==undefined?{concentrationM}:{})};
   }
   const medium=labMixEnvironment([source,target],doses);
   const newReaction=!uncertain&&!sourceReaction&&!targetReaction&&
    identifyReaction(reagents,medium).status==="reaction";
   const dissolving=!newReaction&&doses.H2O?.unit==="ml"&&
    reagents.some(key=>key!=="H2O"&&LAB_WATER_SOLUTES.has(key)&&doses[key]?.unit==="g");
   return {...v,reagents,reactionAmounts:undefined,reactionHeat:undefined,observed:reagents.length>1||source.observed,
    // A complete transfer to empty glassware carries the physical crystal
    // inventory. Mixed recipients must re-evaluate their phase separately.
    binarySaltPhase:targetWasEmpty?source.binarySaltPhase:undefined,
    physicalProcess:dissolving?"dissolving" as const:undefined,
    physicalStartedAtMs:dissolving?Date.now():undefined,
    doses,environment:medium,
    visualStartedAtMs:newReaction?Date.now():v.visualStartedAtMs,
    completedReaction:targetWasEmpty?sourceReaction:(targetReaction??sourceReaction),
    ...carriedLabIndicator(source,v),
    uncertain:uncertain||Boolean(v.indicator&&source.indicator&&v.indicator!==source.indicator)};
  }
  return v;
 });
 const result=bump(bench,vessels,targetId);
 return bench.titrationPair&&
  [bench.titrationPair.sourceId,bench.titrationPair.targetId].some(id=>
   id===sourceId||id===targetId)?
  {...result,titrationPair:undefined,titration:undefined}:result;
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
    }else if(key==="reactionAmounts"&&a.reactionAmounts&&b.reactionAmounts&&
       a.reactionAmounts.equation===b.reactionAmounts.equation){
      merged.reactionAmounts=a.reactionAmounts.elapsedSeconds>=b.reactionAmounts.elapsedSeconds?
       a.reactionAmounts:b.reactionAmounts;
    }else (merged as unknown as Record<string,unknown>)[key]=a[key];
   }
  }
  vessels.push(merged);
 }
 const limited=vessels.slice(0,MAX_BENCH_VESSELS);
 // Selection is transient shared board state; an explicit deselection is
 // different from a missing/invalid id and must not reselect the first vessel.
 const candidate=mine.selectedId!==previous.selectedId?mine.selectedId:remote.selectedId;
 const selectedId=candidate===""?"":limited.some(v=>v.id===candidate)?candidate:
  (limited[0]?.id??"");
 const originalSettings=labBenchSettings(previous),mineSettings=labBenchSettings(mine);
 const settings={...labBenchSettings(remote)};
 for(const key of Object.keys(mineSettings) as (keyof LabBenchSettings)[]){
  if(mineSettings[key]!==originalSettings[key])settings[key]=mineSettings[key];
 }
 // Merge concurrent apparatus additions and moves by durable instance ID.
 // Replacing the entire array would erase a peer's newly placed instrument.
 const physicalOld=new Map(placedLabDevices(previous).map(d=>[d.id,d]));
 const physicalMine=new Map(placedLabDevices(mine).map(d=>[d.id,d]));
 const physicalRemote=new Map(placedLabDevices(remote).map(d=>[d.id,d]));
 const placedDevices:LabPlacedDevice[]=[];
 for(const id of new Set([...physicalOld.keys(),...physicalRemote.keys(),...physicalMine.keys()])){
  const base=physicalOld.get(id),local=physicalMine.get(id),peer=physicalRemote.get(id);
  if(!local&&base)continue;
  if(!peer&&base&&local&&JSON.stringify(local)===JSON.stringify(base))continue;
  if(!local){if(peer)placedDevices.push(peer);continue}
  if(!base||!peer){placedDevices.push(local);continue}
  const combined={...peer};
  for(const key of Object.keys(local) as (keyof LabPlacedDevice)[]){
   if(JSON.stringify(local[key])!==JSON.stringify(base[key]))
    (combined as unknown as Record<string,unknown>)[key]=local[key];
  }
  placedDevices.push(combined);
 }
 const limitedDevices=placedDevices.slice(0,MAX_LAB_DEVICES);
 const devices=[...new Set(limitedDevices.map(d=>d.kind))];
 const titration=JSON.stringify(mine.titration??null)===JSON.stringify(previous.titration??null)?
  remote.titration:mine.titration;
 const instrumentTarget=JSON.stringify(mine.instrumentTarget??null)===JSON.stringify(previous.instrumentTarget??null)?
  remote.instrumentTarget:mine.instrumentTarget;
 const stirringVesselId=mine.stirringVesselId===previous.stirringVesselId?
  remote.stirringVesselId:mine.stirringVesselId;
 const titrationPair=JSON.stringify(mine.titrationPair??null)===JSON.stringify(previous.titrationPair??null)?
  remote.titrationPair:mine.titrationPair;
 const simulationAtMs=Math.max(mine.simulationAtMs??0,remote.simulationAtMs??0)||undefined;
 const pouring=mine.pouring?.id===remote.pouring?.id&&mine.pouring&&remote.pouring?
  (mine.pouring.step>=remote.pouring.step?mine.pouring:remote.pouring):
  JSON.stringify(mine.pouring??null)===JSON.stringify(previous.pouring??null)?
   remote.pouring:mine.pouring;
 const quickReagents=JSON.stringify(labQuickReagents(mine))===JSON.stringify(labQuickReagents(previous))?
  labQuickReagents(remote):labQuickReagents(mine);
 const mode=labMode(mine)===labMode(previous)?labMode(remote):labMode(mine);
 // The chalkboard is a shared write-once ledger, except for an EXPLICIT wipe.
 // A wiped equation must not resurrect because a stale peer edited a vessel.
 const baseLog=previous.reactionLog??[];
 const localLog=mine.reactionLog??[];
 const peerLog=remote.reactionLog??[];
 const localWipe=baseLog.length>0&&localLog.length===0;
 const peerWipe=baseLog.length>0&&peerLog.length===0;
 const logSources=localWipe?peerLog:peerWipe?localLog:
  [...peerLog,...localLog];
 const reactionLog=(localWipe||peerWipe?
  logSources.filter(eq=>!baseLog.includes(eq)):
  [...new Set(logSources)]).slice(-30);
 const seenReactionKeys=[...new Set([...(previous.seenReactionKeys??[]),
  ...(remote.seenReactionKeys??[]),...(mine.seenReactionKeys??[])])].slice(-150);
 return {vessels:limited,selectedId,mode,settings,quickReagents,devices,placedDevices:limitedDevices,titration,titrationPair,stirringVesselId,instrumentTarget,simulationAtMs,pouring,
  reactionLog,seenReactionKeys,event:Math.max(remote.event,mine.event)+1};
}
