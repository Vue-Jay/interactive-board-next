/** Temperature-dependent evaporation of measured pure liquids.
 * NIST Chemistry WebBook Antoine equation:
 * log10(P/bar) = A-B/(T/K+C), valid only within listed temperature limits.
 * A mixed *neat* liquid follows ideal Raoult mole fractions. This is an
 * intentionally bounded educational evaporation/boiling model, not a
 * non-ideal VLE solver or a measured room ventilation rate.
 *
 * Sources: https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Type=ANTOINE
 * https://webbook.nist.gov/cgi/cbook.cgi?ID=C64175&Type=ANTOINE
 * https://webbook.nist.gov/cgi/cbook.cgi?Name=methanol&cTP=on
 * https://webbook.nist.gov/cgi/cbook.cgi?ID=C7726956&Type=ANTOINE
 */
import type {LabDose} from "./lektrusLabStoichiometry";
export type EvaporatingLiquid="H2O"|"C2H5OH"|"CH3OH"|"C3H8O"|"Br2";
type Antoine={minK:number;maxK:number;A:number;B:number;C:number;molG:number;densityGml:number};
const table:Record<EvaporatingLiquid,Antoine>={
 H2O:{minK:255.9,maxK:373,A:4.6543,B:1435.264,C:-64.848,molG:18.015,densityGml:.997},
 C2H5OH:{minK:292.77,maxK:366.63,A:5.24677,B:1598.673,C:-46.424,molG:46.069,densityGml:.789},
 CH3OH:{minK:288.1,maxK:356.83,A:5.20409,B:1581.341,C:-33.5,molG:32.042,densityGml:.792},
 C3H8O:{minK:283.15,maxK:363.15,A:5.1806,B:1560.5,C:-33.5,molG:60.096,densityGml:.785},
 Br2:{minK:224.5,maxK:331.4,A:2.94529,B:638.258,C:-115.144,molG:159.808,densityGml:3.11}
};
export const LAB_VAPOR_REFERENCE=table;
export function labSaturationPressureKPa(id:string,tempC:number):number|undefined{
 const entry=table[id as EvaporatingLiquid];if(!entry)return;
 const kelvin=tempC+273.15;
 if(!Number.isFinite(kelvin)||kelvin<entry.minK||kelvin>entry.maxK)return;
 return Math.pow(10,entry.A-entry.B/(kelvin+entry.C))*100;
}
export type LabEvaporationState={
 doses?:Record<string,LabDose>;stoppered?:boolean;kind:string;
 temperatureC?:number;ventedVaporMl?:Record<string,number>;
};
const aperture:Record<string,number>={
 beaker:1,tube:.2,flask:.38,conical:.52,volumetric:.19,
 cylinder:.28,dish:1.7,pipette:.06,burette:.08,crucible:.8
};
const own=(obj:object,key:string)=>Object.prototype.hasOwnProperty.call(obj,key);
function components(v:LabEvaporationState){
 const liquid=Object.entries(v.doses??{}).filter(([id,d])=>
  own(table,id)&&d.unit==="ml"&&d.concentrationM===undefined&&d.value>0);
 // Prepared stocks have implicit, unknown solvent volumes. They must not
 // be approximated as a mixture of neat molecules.
 const otherLiquids=Object.entries(v.doses??{}).some(([id,d])=>
  d.unit==="ml"&&!own(table,id));
 if(otherLiquids||liquid.length===0)return [];
 const totalMol=liquid.reduce((s,[id,d])=>{
  const p=table[id as EvaporatingLiquid];
  return s+d.value*p.densityGml/p.molG;
 },0);
 return liquid.map(([id,d])=>{
  const p=table[id as EvaporatingLiquid];
  return {id,d,moleFraction:(d.value*p.densityGml/p.molG)/totalMol};
 });
}
/** Evaporation raises with saturation pressure, exposed surface and heating.
 * A stopper gives a saturated closed headspace: no material leaves. Pressure
 * beyond 125 kPa pops an ordinary rubber stopper (not pressure-rated).
 * max 10 seconds per tick, deterministic from current shared state.
 */
export function labEvaporate(v:LabEvaporationState,seconds:number,
 temperatureC=v.temperatureC??22,heaterTargetC=22){
 const items=components(v),dt=Math.max(0,Math.min(10,seconds));
 const partials=items.map(c=>({
  ...c,pressureKPa:labSaturationPressureKPa(c.id,temperatureC)
 }));
 const known=partials.length>0&&partials.every(c=>c.pressureKPa!==undefined);
 const totalPressureKPa=known?partials.reduce((s,c)=>s+c.moleFraction*c.pressureKPa!,0):undefined;
 const popped=!!v.stoppered&&totalPressureKPa!==undefined&&
  totalPressureKPa>=125;
 if(!known||dt===0||v.stoppered&&!popped)return {
  doses:v.doses,ventedVaporMl:v.ventedVaporMl,
  stoppered:v.stoppered,popped:false,boiling:false,
  pressureKPa:totalPressureKPa,evaporatedMl:0
 };
 const boiling=(totalPressureKPa??0)>=101.325;
 const doses={...v.doses},vented={...v.ventedVaporMl};
 let evaporatedMl=0;
 for(const item of partials){
  const partial=item.moleFraction*item.pressureKPa!;
  // Diffusion-limited loss to a ventilated virtual room. Area coefficient is
  // a controlled teaching parameter, not a universal evaporation constant.
  // Heat delivered above the boiling range drives faster vapor generation.
  const rate=aperture[v.kind]??.4;
  const diffusionMlPerS=.0002*rate*partial*Math.sqrt(18.015/table[item.id as EvaporatingLiquid].molG);
  const heatBoost=boiling?Math.max(0,heaterTargetC-temperatureC)*.00014*
   rate*item.moleFraction:0;
  const loss=Math.min(item.d.value,dt*(diffusionMlPerS+heatBoost));
  if(loss<1e-7)continue;
  const left=Math.max(0,Math.round((item.d.value-loss)*1e5)/1e5);
  const actual=item.d.value-left;
  if(actual<=0)continue;
  evaporatedMl+=actual;
  if(left>0)doses[item.id]={...item.d,value:left};
  else delete doses[item.id];
  vented[item.id]=Math.round(((vented[item.id]??0)+actual)*1e5)/1e5;
 }
 return {
  doses,ventedVaporMl:vented,stoppered:popped?false:v.stoppered,
  popped,boiling,pressureKPa:totalPressureKPa,evaporatedMl
 };
}
export const labCanStopper=(kind:string)=>
 ["tube","flask","conical","volumetric"].includes(kind);
