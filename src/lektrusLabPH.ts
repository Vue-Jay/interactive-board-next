/** Ideal aqueous acid/base equilibrium, 25°C. Ref:
 * OpenStax Chemistry 2e §14.7; Chemistry LibreTexts, Acid-Base Indicators.
 * No pH is guessed from "acid/salt" labels when amounts or equilibria
 * of an unsupported dissolved species are missing.
 * Solutions are ideal; activities, solubility and temperature shifts
 * are outside this teaching approximation.
 */
import {simulateLabInventory} from "./lektrusLabReactionNetwork";
export type LabPHInput={
 reagents:readonly string[];
 doses?:Record<string,{value:number;unit:"ml"|"g";concentrationM?:number}>;
 environment:string;uncertain?:boolean;temperatureC?:number;
 /** Products and reactants tracked by the measured balanced equation. */
 reactionAmounts?:{equation:string;productsMol:Record<string,number>;
  remainingMol:Record<string,number>};
};
export type LabPHResult={pH:number;label:string;note:string;acidMol:number;baseMol:number};
const KW=1e-14;
const STRONG_ACIDS=new Set(["HCl","HBr","HNO3"]);
const STRONG_BASES=new Set(["NaOH","KOH"]);
const NEUTRAL_SPECTATORS=new Set([
 "H2O","NaCl","KCl","NaNO3","KNO3","NaBr","KBr","LiCl",
 "Na2SO4","K2SO4","CaCl2"
]);
const MOLAR_MASS:Record<string,number>={NaOH:39.997,KOH:56.1056,
 CH3COOH:60.052,NH4OH:35.045};
const weakAcidKa=1.8e-5; // acetic acid
const weakBaseKb=1.8e-5; // NH3(aq), conventionally NH4OH in school catalog
function doseMoles(id:string,dose:{value:number;unit:"ml"|"g";concentrationM?:number}){
 if(!Number.isFinite(dose.value)||dose.value<=0)return null;
 if(dose.unit==="ml")return dose.concentrationM!==undefined&&
  Number.isFinite(dose.concentrationM)&&dose.concentrationM>0?
  dose.value*dose.concentrationM/1000:null;
 const mass=MOLAR_MASS[id];
 return mass?dose.value/mass:null;
}
export function labVesselPH(v:LabPHInput):LabPHResult|null{
 if(v.environment!=="aqueous"||!v.reagents.length)return null;
 const inventory=v.doses?simulateLabInventory({...v,environment:"aqueous"}):undefined;
 if(v.uncertain&&(!inventory||inventory.unmeasured.length||inventory.limited))return null;
 const doses=v.doses??{};
 if(v.reagents.length===1&&v.reagents[0]==="H2O")
  return {pH:7,label:"pH 7,00",acidMol:0,baseMol:0,
   note:"Чистая вода, идеальная модель при 25 °C."};
 let acidMol=0,baseMol=0,aceticMol=0,ammoniaMol=0;
 const volumeMl=Object.values(doses).reduce((total,d)=>
  total+(d.unit==="ml"?d.value:0),0);
 // When precipitation is completed (or in progress), calculate aqueous
 // species from the balance sheet, NOT the original AgNO3/NaCl inputs.
 // AgCl is insoluble and must not become a source of imaginary free ions.
 const precipitated=v.reactionAmounts?.equation.includes("↓");
 const species:Record<string,number>={};
 if(inventory&&!inventory.unmeasured.length&&!inventory.limited){
  for(const [id,mol] of Object.entries(inventory.speciesMol))
   species[id]=Math.max(0,mol-(inventory.solidMol[id]??0));
 }else if(precipitated&&v.reactionAmounts){
  for(const stock of [v.reactionAmounts.remainingMol,v.reactionAmounts.productsMol])
   for(const [id,mol] of Object.entries(stock))
    species[id]=(species[id]??0)+mol;
  for(const term of (v.reactionAmounts.equation.split("→")[1]??"")
   .split(/\s+\+\s+/)){
   if(term.includes("↓")){
    const solid=term.replace(/^\d+\s*/,"").replace(/[↓↑]/g,"").trim();
    delete species[solid];
   }
  }
 }else{
  for(const id of v.reagents){
   // Solvent water and inert salts contribute dilution without requiring
   // fictitious molarity for H2O itself.
   if(NEUTRAL_SPECTATORS.has(id)){species[id]=0;continue}
   const dose=doses[id];
   if(!dose)return null;
   species[id]=doseMoles(id,dose)??NaN;
  }
 }
 for(const [id,mol] of Object.entries(species)){
  if(mol<=1e-12)continue;
  if(!Number.isFinite(mol))return null;
  if(NEUTRAL_SPECTATORS.has(id))continue;
  if(STRONG_ACIDS.has(id))acidMol+=mol;
  else if(STRONG_BASES.has(id))baseMol+=mol;
  else if(id==="CH3COOH")aceticMol+=mol;
  else if(id==="NH4OH")ammoniaMol+=mol;
  else return null;
 }
 if(!Number.isFinite(volumeMl)||volumeMl<=0)return null;
 const volumeL=volumeMl/1000;
 const acid=acidMol/volumeL,base=baseMol/volumeL,
  acetic=aceticMol/volumeL,ammonia=ammoniaMol/volumeL;
 // Charge balance for strong acid/base and the two supported monoprotic
 // weak systems. Bisection in log[H+] is stable even at equivalence.
 // [H+] + [Na+] + [NH4+] = [OH-] + [Cl-] + [CH3COO-].
 const charge=(logH:number)=>{
  const h=Math.pow(10,logH),oh=KW/h;
  const acetate=acetic*weakAcidKa/(weakAcidKa+h);
  const ammonium=ammonia*h/(h+KW/weakBaseKb);
  return h+base+ammonium-oh-acid-acetate;
 };
 let lower=-16,upper=1;
 for(let i=0;i<95;i++){
  const mid=(lower+upper)/2;
  if(charge(mid)>0)upper=mid;else lower=mid;
 }
 const value=-(lower+upper)/2;
 if(!Number.isFinite(value))return null;
 const pH=Math.max(0,Math.min(14,Math.round(value*100)/100));
 return {pH,label:"pH "+pH.toFixed(2).replace(".",","),
  acidMol,baseMol,
  note:"Расчёт по измеренным количествам и равновесию при 25 °C; без поправок на активности."};
}
export type LabIndicatorKind="litmus"|"phenolphthalein"|"methyl-orange"|"universal";
/** Indicator transition ranges (LibreTexts):
 * litmus 5–8; methyl orange 3.1–4.4; phenolphthalein 8.3–10.
 * Interpolate within transitions instead of jumping at neutrality.
 */
function mix(a:string,b:string,t:number){
 const k=Math.max(0,Math.min(1,t));
 const ar=[1,3,5].map(i=>parseInt(a.slice(i,i+2),16));
 const br=[1,3,5].map(i=>parseInt(b.slice(i,i+2),16));
 return "#"+ar.map((x,i)=>Math.round(x+(br[i]-x)*k).toString(16).padStart(2,"0")).join("");
}
export function labIndicatorTint(id:LabIndicatorKind,pH:number):string|undefined{
 if(!Number.isFinite(pH))return undefined;
 if(id==="litmus")return mix("#d85761","#426cce",(pH-5)/3);
 if(id==="methyl-orange")return mix("#db4444","#efc94b",(pH-3.1)/1.3);
 if(id==="phenolphthalein")
  return pH<=8.3?undefined:mix("#f8d9e7","#d83a96",(pH-8.3)/1.7);
 const scale:[number,string][]=[
  [0,"#da4d45"],[2,"#ee7048"],[4,"#edb449"],[6,"#c6cc55"],
  [7,"#79b865"],[8,"#4aa987"],[10,"#4c90b8"],[12,"#6867b3"],[14,"#884e9f"]
 ];
 for(let i=1;i<scale.length;i++){
  const [end,c]=scale[i];
  if(pH<=end){const [start,before]=scale[i-1];
   return mix(before,c,(pH-start)/(end-start))}
 }
 return scale[scale.length-1][1];
}
