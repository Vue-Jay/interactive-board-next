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
 * https://www.rsc.org/suppdata/cc/c3/c3cc39116g/c3cc39116g.pdf (IPA)
 */
/** Same structural dose shape as the bench, without a runtime cycle. */
type LabDose={value:number;unit:"ml"|"g";concentrationM?:number};
export type EvaporatingLiquid="H2O"|"C2H5OH"|"CH3OH"|"C3H8O"|"Br2";
type Antoine={minK:number;maxK:number;A:number;B:number;C:number;molG:number;densityGml:number};
const table:Record<EvaporatingLiquid,Antoine>={
 H2O:{minK:255.9,maxK:373,A:4.6543,B:1435.264,C:-64.848,molG:18.015,densityGml:.997},
 C2H5OH:{minK:292.77,maxK:366.63,A:5.24677,B:1598.673,C:-46.424,molG:46.069,densityGml:.789},
 CH3OH:{minK:288.1,maxK:356.83,A:5.20409,B:1581.341,C:-33.5,molG:32.042,densityGml:.792},
 C3H8O:{minK:329.92,maxK:362.41,A:4.8610,B:1357.427,C:-75.814,molG:60.096,densityGml:.785},
 Br2:{minK:224.5,maxK:331.4,A:2.94529,B:638.258,C:-115.144,molG:159.808,densityGml:3.11}
};
export const LAB_VAPOR_REFERENCE=table;
export function labSaturationPressureKPa(id:string,tempC:number):number|undefined{
 const entry=table[id as EvaporatingLiquid];if(!entry)return;
 const kelvin=tempC+273.15;
 // Published low-temperature IPA correlation, 10–56.77 °C, pressure mmHg.
 // RSC Chemical Communications 2013 electronic supporting information,
 // Table S2: A=8.00308, B=1505.52, C=211.6.
 if(id==="C3H8O"&&tempC>=10&&tempC<56.77)
  return Math.pow(10,8.00308-1505.52/(tempC+211.6))*.133322368;
 if(!Number.isFinite(kelvin))return;
 // Use the adjacent NIST measurement ranges above normal boiling and
 // a narrow interpolation across their gaps. A hot stoppered vessel must
 // be able to release its stopper instead of silently losing vapor data.
 if(id==="H2O"&&kelvin>373&&kelvin<=379)
  return Math.pow(10,5.08354-1663.125/(kelvin-45.622))*100;
 if(id==="H2O"&&kelvin>=379&&kelvin<=573)
  return Math.pow(10,3.55959-643.748/(kelvin-198.043))*100;
 if(id==="C2H5OH"&&kelvin>366.63&&kelvin<=513.91)
  return Math.pow(10,4.92531-1432.526/(kelvin-61.819))*100;
 if(id==="CH3OH"&&kelvin>356.83&&kelvin<=512.63)
  return Math.pow(10,5.15853-1569.613/(kelvin-34.846))*100;
 if(id==="Br2"&&kelvin>331.4&&kelvin<=343)
  return Math.pow(10,2.94529-638.258/(kelvin-115.144))*100;
 if(id==="Br2"&&kelvin>=343&&kelvin<=383)
  return Math.pow(10,4.70827-1562.264/(kelvin+.628))*100;
 if(kelvin<entry.minK||kelvin>entry.maxK)return;
 return Math.pow(10,entry.A-entry.B/(kelvin+entry.C))*100;
}
export type LabEvaporationState={
 doses?:Record<string,LabDose>;stoppered?:boolean;kind:string;
 temperatureC?:number;ventedVaporMl?:Record<string,number>;
 /** Actual temperature when the stopper was put in. */
 stopperedAtC?:number;
 /** Explicit gas retained by reviewed equations or measured gas stocks. */
 reactionGasMol?:number;
 /** Gas space inside the vessel above the measured liquid level. */
 headspaceMl?:number;
};
const aperture:Record<string,number>={
 beaker:1,tube:.2,flask:.38,conical:.52,volumetric:.19,
 cylinder:.28,dish:1.7,pipette:.06,burette:.08,crucible:.8
};
const own=(obj:object,key:string)=>Object.prototype.hasOwnProperty.call(obj,key);
/** Ideal liquid-phase mole fractions. For explicitly weighed soluble
 * nonvolatile salt/sugar in measured water, use the number of dissolved
 * solute particles; electrolyte coefficients are upper-bound dilute ideals.
 * Reject any unknown stock solvent, mixed undissolved powder, or molality
 * outside the dilute range instead of silently treating it as pure water. */
function components(v:LabEvaporationState){
 const entries=Object.entries(v.doses??{});
 const liquid=entries.filter(([id,d])=>
  own(table,id)&&d.unit==="ml"&&d.concentrationM===undefined&&d.value>0);
 const otherLiquids=entries.some(([id,d])=>
  d.unit==="ml"&&(!own(table,id)||d.concentrationM!==undefined));
 if(otherLiquids||liquid.length===0)return [];
 const solids=entries.filter(([,d])=>d.unit==="g"&&d.value>0);
 let particlesMol=0;
 if(solids.length){
  if(liquid.length!==1||liquid[0][0]!=="H2O")return [];
  const waterKg=liquid[0][1].value*.000997;
  if(waterKg<=0)return [];
  for(const [id,d] of solids){
   const known=aqueousNonvolatile[id];
   if(!known)return [];
   particlesMol+=d.value/known.molarG*known.i;
  }
  if(particlesMol/waterKg>4)return [];
 }
 const totalMol=particlesMol+liquid.reduce((s,[id,d])=>{
  const p=table[id as EvaporatingLiquid];
  return s+d.value*p.densityGml/p.molG;
 },0);
 return liquid.map(([id,d])=>{
  const p=table[id as EvaporatingLiquid];
  return {id,d,moleFraction:(d.value*p.densityGml/p.molG)/totalMol};
 });
}
export function labVaporPressureKPa(v:LabEvaporationState,tempC:number):number|undefined{
 const items=components(v);
 if(!items.length)return;
 let pressure=0;
 for(const item of items){
  const saturation=labSaturationPressureKPa(item.id,tempC);
  if(saturation===undefined)return;
  pressure+=item.moleFraction*saturation;
 }
 return pressure;
}
/** Equilibrium bubble point of a MEASURED ideal liquid mixture at 1 atm.
 * Uses the same Raoult mole fractions as vapor loss; limited to the
 * published Antoine ranges, and intentionally undefined for unsupported
 * non-ideal / concentrated mixtures. */
export function labIdealBoilingC(v:LabEvaporationState):number|undefined{
 const diluteWater=labApproxWaterBoilingC(v.doses);
 if(diluteWater!==undefined)return diluteWater;
 if(!components(v).length)return;
 const key=JSON.stringify(v.doses??{});
 if(bubbleCache.has(key))return bubbleCache.get(key);
 let lowerT=20,lowerP=labVaporPressureKPa(v,lowerT);
 if(lowerP!==undefined&&lowerP>=101.325)return lowerT;
 let solved:number|undefined;
 for(let t=21;t<=125;t++){
  const currentP=labVaporPressureKPa(v,t);
  if(lowerP!==undefined&&currentP!==undefined&&
   lowerP<101.325&&currentP>=101.325){
   let low=lowerT,high=t;
   for(let k=0;k<34;k++){
    const mid=(low+high)/2;
    if((labVaporPressureKPa(v,mid)??0)<101.325)low=mid;
    else high=mid;
   }
   solved=Math.round((low+high)*50)/100;
   break;
  }
  lowerT=t;lowerP=currentP;
 }
 if(bubbleCache.size>=256)bubbleCache.delete(bubbleCache.keys().next().value!);
 bubbleCache.set(key,solved);
 return solved;
}
const bubbleCache=new Map<string,number|undefined>();
/** Evaporation raises with saturation pressure, exposed surface and heating.
 * A stopper gives a saturated closed headspace: no material leaves. Pressure
 * beyond 160 kPa absolute pops a simulated cork (not pressure-rated).
 * max 10 seconds per tick, deterministic from current shared state.
 */
export function labEvaporate(v:LabEvaporationState,seconds:number,
 temperatureC=v.temperatureC??22,heaterTargetC=22){
 const items=components(v),dt=Math.max(0,Math.min(10,seconds));
 const partials=items.map(c=>({
  ...c,pressureKPa:labSaturationPressureKPa(c.id,temperatureC)
 }));
 const known=partials.length>0&&partials.every(c=>c.pressureKPa!==undefined);
 const vaporPressureKPa=known?partials.reduce((s,c)=>
  s+c.moleFraction*c.pressureKPa!,0):undefined;
 // Closed vessel: Dalton's law and PV=nRT with *measured* headspace.
 // The trapped air was at ambient pressure when the cork was inserted,
 // not necessarily at 22°C. Reaction gas adds a separate ideal partial
 // pressure. Never assume an unsupported liquid has zero vapor pressure.
 const sealedAtK=(v.stopperedAtC??22)+273.15;
 const kelvin=temperatureC+273.15;
 const hasUnsupportedLiquid=Object.entries(v.doses??{}).some(([id,d])=>
  d.unit==="ml"&&d.value>0&&
  (!own(table,id)||d.concentrationM!==undefined)&&
  !["CO2","H2","O2","NH3","Cl2","NO2","SO2","CO","H2S"].includes(id));
 const gasOnly=!items.length&&!hasUnsupportedLiquid;
 const vaporKnown=known||gasOnly;
 const vaporAtSeal=known?items.reduce((s,item)=>
  s+item.moleFraction*(labSaturationPressureKPa(item.id,v.stopperedAtC??22)??0),0):0;
 const gasMoles=v.reactionGasMol??0;
 const headspaceL=Math.max(.001,(v.headspaceMl??100)/1000);
 const reactionGasPressureKPa=gasMoles>0&&Number.isFinite(gasMoles)?
  gasMoles*8.314462618*kelvin/headspaceL:0;
 const sealedPressureKPa=vaporKnown&&sealedAtK>0&&kelvin>0?
  Math.max(0,101.325-vaporAtSeal)*kelvin/sealedAtK+
   (vaporPressureKPa??0)+reactionGasPressureKPa:undefined;
 const popped=!!v.stoppered&&sealedPressureKPa!==undefined&&
  sealedPressureKPa>=160;
 const totalPressureKPa=v.stoppered?sealedPressureKPa:vaporPressureKPa;
 if(!known||dt===0||v.stoppered&&!popped)return {
  doses:v.doses,ventedVaporMl:v.ventedVaporMl,
  stoppered:v.stoppered,popped:false,boiling:false,
  pressureKPa:totalPressureKPa,evaporatedMl:0
 };
 const boiling=(vaporPressureKPa??0)>=101.325;
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
/** First-order colligative boiling elevation for explicitly measured water
 * and a short list of known, nonvolatile, water-soluble solids.
 * ΔT = Kb * Σ(i*n) / kg(H2O); Kb=0.512 K kg mol-1 (OpenStax Chemistry 2e).
 * i is the *ideal* dissociation count. High ionic strengths are outside the
 * dilute-solution range and intentionally not assigned a precise plateau.
 * This does not claim an arbitrary stock solution has a known boiling point.
 * The vapor-pressure model uses the SAME particle count for water activity.
 */
const aqueousNonvolatile:Record<string,{molarG:number;i:number}>={
 NaCl:{molarG:58.44,i:2},KCl:{molarG:74.55,i:2},
 NaBr:{molarG:102.89,i:2},KBr:{molarG:119.00,i:2},
 C6H12O6:{molarG:180.16,i:1},C12H22O11:{molarG:342.30,i:1}
};
export function labApproxWaterBoilingC(doses?:Record<string,LabDose>):number|undefined{
 const entries=Object.entries(doses??{}),water=doses?.H2O;
 if(!water||water.unit!=="ml"||water.concentrationM!==undefined||water.value<.5)return;
 let soluteParticles=0;
 for(const [id,d] of entries){
  if(id==="H2O")continue;
  const solid=aqueousNonvolatile[id];
  if(!solid||d.unit!=="g")return;
  soluteParticles+=d.value/solid.molarG*solid.i;
 }
 const molality=soluteParticles/(water.value*.000997);
 if(!Number.isFinite(molality)||molality>4)return;
 return Math.round((100+.512*molality)*100)/100;
}
export const labCanStopper=(kind:string)=>
 ["tube","flask","conical","volumetric"].includes(kind);
