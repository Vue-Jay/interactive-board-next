import type {Item} from "./boardModel";
import {labDisplayPoint} from "./lektrusLabLayout";
import {addTitrant,defaultTitration,resetTitration,validTitration,type TitrationModel}
 from "./lektrusLabTitration";
import {identifyReaction,substances,type ReactionEnvironment,type ReactionStatus,type ReactionCase} from "./lektrusReactionDatabase";

export type LabGlassware="beaker"|"tube"|"flask"|"cylinder"|"dish"|
 "conical"|"volumetric"|"crucible"|"pipette"|"burette"|"funnel";
export const labGlassware:{id:LabGlassware;name:string;description:string}[]=[
 {id:"beaker",name:"Стакан",description:"Смешивание растворов"},
 {id:"tube",name:"Пробирка",description:"Небольшие пробы"},
 {id:"flask",name:"Колба",description:"Работа с жидкостями"},
 {id:"cylinder",name:"Мерный цилиндр",description:"Отмеривание жидкости"},
 {id:"dish",name:"Чашка",description:"Открытый сосуд"},
 {id:"conical",name:"Коническая колба",description:"Титрование и перемешивание"},
 {id:"volumetric",name:"Мерная колба",description:"Приготовление растворов"},
 {id:"crucible",name:"Тигель",description:"Нагревание твёрдых веществ"},
 {id:"pipette",name:"Мерная пипетка",description:"Отбор небольшого объёма"},
 {id:"burette",name:"Бюретка",description:"Дозирование при титровании"},
 {id:"funnel",name:"Воронка",description:"Аккуратное переливание"}
];
export type LabDose={value:number;unit:"ml"|"g";concentrationM?:number};
export type LabDevice="hotplate"|"burner"|"stirrer"|"tripod"|"thermometer";
export type LabAvailableDevice=Exclude<LabDevice,"thermometer">;
export const labDevices:{id:LabAvailableDevice;name:string;description:string;symbol:string}[]=[
 {id:"hotplate",name:"Плитка",description:"Нагревать выбранный сосуд",symbol:"▤"},
 {id:"burner",name:"Горелка",description:"Виртуальный источник пламени",symbol:"♨"},
 {id:"stirrer",name:"Магнитная мешалка",description:"Перемешивать раствор",symbol:"◌"},
 {id:"tripod",name:"Штатив",description:"Закрепить пробирку, колбу или бюретку",symbol:"⌁"}
];
export type LabPlacedDevice={id:string;kind:LabDevice;x:number;y:number;
 /** Mounted on the vessel, regardless of power. */ active?:boolean;
 linkedVesselId?:string;
 powered?:boolean;heatLevel?:1|2|3;temperatureC?:number};
export const MAX_LAB_DEVICES=10;
const clampDevice=(v:number,min:number,max:number)=>Math.round(Math.min(max,Math.max(min,v))*10)/10;
/** V1 cabinets only stored the types. Preserve them when a board is upgraded. */
export function placedLabDevices(bench:LabBench):LabPlacedDevice[]{
 if(bench.placedDevices)return bench.placedDevices.filter(d=>d.kind!=="thermometer");
 return (bench.devices??[]).filter(kind=>kind!=="thermometer").map((kind,i)=>({
  id:"legacy-"+kind,kind,x:12+(i%3)*12,y:64+Math.floor(i/3)*18
 }));
}
export function addPlacedLabDevice(bench:LabBench,kind:LabDevice,point?:{x:number;y:number}):LabBench{
 if(!labDevices.some(v=>v.id===kind))return bench;
 const existing=placedLabDevices(bench);
 if(existing.length>=MAX_LAB_DEVICES)return bench;
 const occupied=existing.length;
 const id="device-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9);
 const placed:LabPlacedDevice={id,kind,
  x:clampDevice(point?.x??(12+(occupied%4)*12),9,81),
  y:clampDevice(point?.y??(63+Math.floor(occupied/4)*15),53,84),
  powered:false,heatLevel:2,temperatureC:22};
 return {...bench,placedDevices:[...existing,placed],
  devices:[...new Set([...(bench.devices??[]),kind])],event:bench.event+1};
}
export function movePlacedLabDevice(bench:LabBench,id:string,x:number,y:number):LabBench{
 const existing=placedLabDevices(bench);
 if(!existing.some(d=>d.id===id))return bench;
 return {...bench,placedDevices:existing.map(d=>d.id===id?
  {...d,x:clampDevice(x,9,81),y:clampDevice(y,53,84),
    linkedVesselId:undefined,active:false,powered:false}:d),
  event:bench.event+1};
}
export function returnPlacedLabDevice(bench:LabBench,id:string):LabBench{
 const existing=placedLabDevices(bench),target=existing.find(d=>d.id===id);
 if(!target)return bench;
 const normalized=target.active?stopPlacedLabDevice(bench,id):bench;
 const placedDevices=placedLabDevices(normalized).filter(d=>d.id!==id);
 const devices=[...new Set(placedDevices.map(d=>d.kind))];
 return {...normalized,placedDevices,devices,event:normalized.event+1,
  stirringVesselId:target.kind==="stirrer"&&!devices.includes("stirrer")?undefined:bench.stirringVesselId,
  instrumentTarget:bench.instrumentTarget&&(target.kind===bench.instrumentTarget.kind&&
   target.linkedVesselId===bench.instrumentTarget.vesselId)?
   undefined:bench.instrumentTarget};
}
/** Only appropriate vessel types are heated; do not fabricate temperatures,
 * reaction products or a laboratory measurement outside the reviewed database. */
/** Glassware may be supported/held only where its geometry is appropriate. */
export function canMountLabVessel(kind:LabPlacedDevice["kind"],glass:LabGlassware){
 if(kind==="tripod")return ["tube","flask","conical","burette","volumetric"].includes(glass);
 if(kind==="hotplate")return ["beaker","flask","conical","dish"].includes(glass);
 if(kind==="stirrer")return ["beaker","flask","conical"].includes(glass);
 if(kind==="burner")return ["beaker","tube","flask","conical","crucible"].includes(glass);
 return false;
}
export function applyPlacedLabDevice(bench:LabBench,id:string,vesselId:string):LabBench{
 const device=placedLabDevices(bench).find(d=>d.id===id);
 const vessel=bench.vessels.find(v=>v.id===vesselId);
 if(!device||!vessel||!canMountLabVessel(device.kind,vessel.kind))return bench;
 if(device.active&&device.linkedVesselId===vesselId)return bench;
 // One vessel cannot be mounted on two incompatible devices at once.
 const next=placedLabDevices(bench).map(d=>d.id===id?
  {...d,active:true,linkedVesselId:vesselId,powered:d.powered??false}:
  d.linkedVesselId===vesselId?{...d,active:false,linkedVesselId:undefined,powered:false}:d);
 const point=labDisplayPoint(vessel,bench.vessels.length>3);
 const placedDevices=next.map(d=>d.id===id?{...d,
  x:clampDevice(point.x,9,81),y:clampDevice(point.y+10,53,84)}:d);
 return {...bench,placedDevices,stirringVesselId:bench.stirringVesselId===vesselId?
  undefined:bench.stirringVesselId,event:bench.event+1};
}
export function setPlacedDevicePower(bench:LabBench,id:string,powered:boolean):LabBench{
 const d=placedLabDevices(bench).find(v=>v.id===id);
 if(!d||d.kind==="tripod"||d.kind==="thermometer")return bench;
 if(powered&&d.kind==="stirrer"&&(!d.linkedVesselId||
  !bench.vessels.some(v=>v.id===d.linkedVesselId&&v.reagents.length)))return bench;
 if(Boolean(d.powered)===powered)return bench;
 const placedDevices=placedLabDevices(bench).map(v=>v.id===id?{...v,powered}:v);
 return {...bench,placedDevices,
  stirringVesselId:d.kind==="stirrer"?
   (powered?d.linkedVesselId:undefined):bench.stirringVesselId,
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
  {...d,active:false,linkedVesselId:undefined,powered:false}:d);
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
 const target=targetId??source.buretteTargetId;
 if(open&&(!source.reagents.length||!target||target===id||
  !bench.vessels.some(v=>v.id===target)))return bench;
 const rate=rateMlS??source.buretteRateMlS??.2;
 if(!LAB_DRIP_RATES.some(v=>v===rate))return bench;
 return revise(bench,id,v=>({...v,buretteOpen:open,buretteTargetId:target,
  buretteRateMlS:rate}));
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
  const target=d.powered?(d.kind==="hotplate"?75+level*60:220+level*100):ambient;
  const rate=d.powered?0.075:0.11;
  const next=Math.round((old+(target-old)*(1-Math.exp(-seconds*rate)))*10)/10;
  if(next!==old)changed=true;
  return {...d,temperatureC:next};
 });
 let result:LabBench={...bench,placedDevices:devices,simulationAtMs:nowMs};
 let vessels=bench.vessels.map(v=>{
  const old=v.temperatureC??ambient;
  const device=devices.find(d=>d.active&&d.linkedVesselId===v.id&&
   ["hotplate","burner"].includes(d.kind));
  const toward=device&&device.powered?(device.temperatureC??ambient):ambient;
  const volumes=Object.values(v.doses??{}).reduce((total,d)=>total+d.value,0);
  const inertia=Math.max(.035,Math.min(.18,60/Math.max(100,volumes)*.10));
  const raw=old+(toward-old)*(1-Math.exp(-seconds*(device?.powered?inertia:.018)));
  // Aqueous solutions at ambient pressure boil near 100°C. Other materials
  // remain an approximation: no general boiling points are inferred.
  const isWater=v.environment==="aqueous"&&v.reagents.length>0;
  const next=Math.round(Math.max(ambient,Math.min(isWater?100:400,raw))*10)/10;
  const cooling=!device?.powered&&next<42&&v.temperatureC!==undefined&&
   ["heated","ignited"].includes(v.environment);
  if(next!==old||cooling)changed=true;
  if(next===old&&!cooling)return v;
  // Once the apparatus is off and a vessel has cooled, stop treating it
  // as continuously heated. Preserve its verified completed chemistry.
  const hasLiquid=Object.values(v.doses??{}).some(d=>d.unit==="ml");
  return {...v,temperatureC:next,
   environment:cooling?(hasLiquid?"aqueous":"dry"):v.environment};
 });
 result={...result,vessels};
 // Start pre-reviewed heated cases only after reaching a sufficiently warm state.
 vessels=result.vessels.map(v=>{
  if(v.temperatureC===undefined||v.temperatureC<60||!v.reagents.length)return v;
  const heater=devices.find(d=>d.active&&d.powered&&d.linkedVesselId===v.id&&
   ["hotplate","burner"].includes(d.kind));
  if(!heater)return v;
  // Realistic minimum activation temperatures for selected reviewed cases.
  // CaCO3 calcination requires kiln-level heat, not a hotplate.
  const thermalThreshold=v.reagents.includes("CaCO3")?825:
   v.reagents.includes("MgCO3")?350:
   v.reagents.includes("CuCO3")?200:
   v.reagents.includes("NaHCO3")?85:
   v.reagents.includes("Cu(OH)2")?95:
   v.reagents.includes("Fe")&&v.reagents.includes("S")?200:60;
  if(v.temperatureC<thermalThreshold)return v;
  const mode=heater.kind==="burner"&&v.temperatureC>=115?"ignited":"heated";
  if(v.environment===mode)return v;
  const next=setLabEnvironment({...result,vessels:[v]},v.id,mode);
  const updated=next.vessels[0];
  changed=true;
  return updated;
 });
 result={...result,vessels};
 // Titrate by opening a valve; dispensed volume is real, never a button animation.
 let dropChanged=false;
 for(const v of result.vessels){
  if(v.kind!=="burette"||!v.buretteOpen||!v.buretteTargetId)continue;
  const dose=v.doses?.[v.reagents[0]];
  if(!dose){result=setLabBuretteValve(result,v.id,false);continue}
  const amount=Math.max(0,Math.round(seconds*(v.buretteRateMlS??.2)*100)/100);
  if(!amount)continue;
  const next=dispenseLabBurette(result,v.id,v.buretteTargetId,amount);
  if(next===result){result=setLabBuretteValve(result,v.id,false);continue}
  result=next;dropChanged=true;
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
 const ml=Math.min(Math.round(requestedMl*100)/100,sourceDose.value,100-addedBefore);
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
   return {...v,reagents:[...new Set([...v.reagents,titrant])],doses:dosed,observed:true,
    uncertain:false};
  }
  return v;
 });
 return {...bump(bench,vessels,targetId),titration:model,titrationPair:{sourceId,targetId}};
}
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
 temperatureC?:number;
 buretteOpen?:boolean;buretteTargetId?:string;buretteRateMlS?:number;
 doses?:Record<string,LabDose>;
 /** A verified reaction already completed in this material; survives full transfer. */
 completedReaction?:ReactionCase;
};
export type LabBench={vessels:LabVessel[];selectedId:string;event:number;
 settings?:LabBenchSettings;devices?:LabDevice[];placedDevices?:LabPlacedDevice[];titration?:TitrationModel;stirringVesselId?:string;
 instrumentTarget?:{kind:"tripod"|"thermometer";vesselId:string};
 titrationPair?:{sourceId:string;targetId:string};simulationAtMs?:number;}
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
 return vessels.every((v,i)=>v.x===bench.vessels[i].x&&v.y===bench.vessels[i].y)?
  bench:bump(bench,vessels);
}
export function addLabVessel(bench:LabBench,kind:LabGlassware,position?:{x:number;y:number}):LabBench{
 if(bench.vessels.length>=MAX_BENCH_VESSELS)return bench;
 let n=1;while(bench.vessels.some(v=>v.id==="v"+n))n++;
 const next:LabVessel={id:"v"+n,kind,x:clamp(position?.x??50),
  y:clamp(position?.y??62),reagents:[],environment:"aqueous",observed:false};
 const result=bump(bench,[...bench.vessels,next],next.id);
 return position?result:arrangeLabVessels(result);
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
 return {...bump(bench,vessels,bench.selectedId===id?(vessels[0]?.id??""):bench.selectedId),
  stirringVesselId:bench.stirringVesselId===id?undefined:bench.stirringVesselId,
  instrumentTarget:bench.instrumentTarget?.vesselId===id?undefined:bench.instrumentTarget,
  placedDevices:placedLabDevices(bench).map(d=>d.linkedVesselId===id?
   {...d,linkedVesselId:undefined,active:false}:d),
  titrationPair:bench.titrationPair&&(bench.titrationPair.sourceId===id||bench.titrationPair.targetId===id)?
   undefined:bench.titrationPair};
}
export function emptyLabVessel(bench:LabBench,id:string):LabBench{
 const next=revise(bench,id,v=>({...v,reagents:[],observed:false,uncertain:false,indicator:undefined,doses:undefined,completedReaction:undefined}));
 return next===bench?bench:({...next,stirringVesselId:next.stirringVesselId===id?undefined:next.stirringVesselId,
  placedDevices:placedLabDevices(next).map(d=>d.linkedVesselId===id?
   {...d,linkedVesselId:undefined,active:false}:d),
  titrationPair:next.titrationPair&&(next.titrationPair.sourceId===id||next.titrationPair.targetId===id)?
   undefined:next.titrationPair});
}
export function setLabIndicator(bench:LabBench,id:string,indicator:LabIndicator|undefined):LabBench{
 if(!bench.vessels.some(v=>v.id===id&&v.reagents.length))return bench;
 const next=revise(bench,id,v=>v.indicator===indicator?v:{...v,indicator});
 return next!==bench&&bench.titrationPair?.targetId===id&&bench.titration&&indicator?
  {...next,titration:{...bench.titration,indicator}}:next;
}
export function setLabEnvironment(bench:LabBench,id:string,environment:ReactionEnvironment):LabBench{
 return revise(bench,id,v=>{
  const previous=labObservation(v);
  return {...v,environment,
   completedReaction:v.completedReaction??(previous.status==="reaction"?previous.caseData:undefined),
   // Future chemistry is unknown, but previously visible products stay visible.
   uncertain:v.uncertain||previous.status==="reaction",
   observed:v.reagents.length>1||identifyReaction(v.reagents,environment).status==="reaction"};
 });
}
export function putLabReagent(bench:LabBench,id:string,reagent:string,dose?:LabDose):LabBench{
 if(!bench.vessels.some(v=>v.id===id))return bench;
 const updated=revise(bench,id,v=>{
  const validDose=dose&&Number.isFinite(dose.value)&&dose.value>0&&
   dose.value<=10000&&(dose.unit==="ml"||dose.unit==="g")&&
   (dose.concentrationM===undefined||
    (dose.unit==="ml"&&Number.isFinite(dose.concentrationM)&&
     dose.concentrationM>=.001&&dose.concentrationM<=2))?dose:undefined;
  if(dose&&!validDose)return v;
  const present=v.reagents.includes(reagent);
  if(!present&&v.reagents.length>=MAX_VESSEL_REAGENTS)return v;
  const previous=v.doses?.[reagent];
  if(present&&!validDose)return v;
  if(previous&&validDose&&(previous.unit!==validDose.unit||
   (previous.concentrationM!==undefined&&validDose.concentrationM!==undefined&&
    previous.concentrationM!==validDose.concentrationM)))return v;
  const combined=validDose?{value:Math.round(((previous?.value??0)+validDose.value)*100)/100,
   unit:validDose.unit,concentrationM:validDose.concentrationM??previous?.concentrationM}:undefined;
  if(combined&&combined.value>10000)return v;
  const reagents=present?v.reagents:[...v.reagents,reagent];
  const beforeReaction=labObservation(v);
  return {...v,reagents,
   completedReaction:v.completedReaction??(beforeReaction.status==="reaction"?beforeReaction.caseData:undefined),
   doses:combined?{...v.doses,[reagent]:combined}:v.doses,
   observed:reagents.length>1,
   uncertain:v.uncertain||beforeReaction.status==="reaction"};
 });
 return updated!==bench&&bench.titrationPair&&
  (bench.titrationPair.sourceId===id||bench.titrationPair.targetId===id)?
  {...updated,titrationPair:undefined,titration:undefined}:updated;
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
   return {...v,reagents,observed:reagents.length>1||source.observed,
    doses,environment:targetWasEmpty?source.environment:target.environment,
    completedReaction:targetWasEmpty?sourceReaction:(targetReaction??sourceReaction),
    indicator:v.indicator??source.indicator,
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
 return {vessels:limited,selectedId,settings,devices,placedDevices:limitedDevices,titration,titrationPair,stirringVesselId,instrumentTarget,
  event:Math.max(remote.event,mine.event)+1};
}
