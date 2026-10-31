/** Ideal aqueous acid/base equilibrium with IAPWS water ionization. Ref:
 * OpenStax Chemistry 2e §14.7; Chemistry LibreTexts, Acid-Base Indicators.
 * School estimates for less-documented salts explicitly say "approximate";
 * the exact stoichiometric inventory is never replaced by an invented mole count.
 * Solutions are ideal. Water ionization follows temperature-dependent
 * IAPWS data (0–100°C); weak Ka/Kb values remain 25°C reference only
 * and used outside that range only as a labelled school approximation.
 * Nonideal ionic activities and multistage hydrolysis are not simulated.
 */
import {simulateLabInventory,type LabChemicalSnapshot} from "./lektrusLabReactionNetwork";
import {labWaterIonProduct,labNeutralWaterPH} from "./lektrusLabWaterIonization";
import {substances} from "./lektrusReactionDatabase";
export type LabPHInput={
 reagents:readonly string[];
 doses?:Record<string,{value:number;unit:"ml"|"g";concentrationM?:number}>;
 environment:string;uncertain?:boolean;temperatureC?:number;
 chemicalInventory?:LabChemicalSnapshot;
 /** A follow-up transformation staged while the global simulation is paused. */
 pendingInventoryReaction?:boolean;
 filteredSolution?:{volumeMl?:number};
 /** Products and reactants tracked by the measured balanced equation. */
 reactionAmounts?:{equation:string;productsMol:Record<string,number>;
  remainingMol:Record<string,number>};
};
export type LabPHResult={pH:number;label:string;note:string;acidMol:number;baseMol:number};
// Share the chemical catalogue's physical phase with the bench volume model.
 // A preloaded H2/CO2 sample is measured in gas ml, NOT aqueous solvent ml.
 // Including those millilitres would artificially dilute real acids/bases and
 // change the indicator colour whenever gas is collected above the liquid.
const GAS_REAGENTS=new Set(substances.filter(s=>s.kind==="газ").map(s=>s.id));
const STRONG_ACIDS=new Set(["HCl","HBr","HNO3","HI"]);
const STRONG_BASES=new Set(["NaOH","KOH","LiOH"]);
const NEUTRAL_SPECTATORS=new Set([
 "H2O","NaCl","KCl","NaNO3","KNO3","NaBr","KBr","LiCl",
 "CaCl2"
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
 if(v.environment!=="aqueous"||
  (!v.reagents.length&&!v.chemicalInventory))return null;
 const volumeMl=(v.filteredSolution?.volumeMl??0)+
  Object.entries(v.doses??{}).reduce((total,[id,d])=>
   total+(d.unit==="ml"&&!GAS_REAGENTS.has(id)?d.value:0),0);
 if(!Number.isFinite(volumeMl)||volumeMl<=0)return null;
 // For paused multi-stage experiments, pH must use the PRESENT species.
 // A saved mixture's possible future neutralisation cannot tint indicators.
 const inventory=v.chemicalInventory||v.doses?
  simulateLabInventory({...v,environment:"aqueous",volumeMl,
   chemicalInventory:v.pendingInventoryReaction&&v.chemicalInventory?
    {...v.chemicalInventory,settled:true}:v.chemicalInventory}):undefined;
 if(v.uncertain&&(!inventory||inventory.unmeasured.length||inventory.limited))return null;
 const temperatureC=v.temperatureC??25;
 const KW=labWaterIonProduct(temperatureC);
 if(KW===undefined)return null;
 const doses=v.doses??{};
 // "H2O" is only a display label on some preserved/legacy chemical ledgers.
 // Do not report neutral water if the molecule inventory still has real acid
 // or base products from a previous stage of this experiment.
 if(!v.chemicalInventory&&v.reagents.length===1&&v.reagents[0]==="H2O"){
  const neutral=labNeutralWaterPH(temperatureC)!;
  const pH=Math.round(neutral*100)/100;
  return {pH,label:"pH "+pH.toFixed(2).replace(".",","),
   acidMol:0,baseMol:0,
   note:"Нейтральная вода при "+temperatureC.toLocaleString("ru-RU")+
    " °C; K_w по IAPWS. Нейтральность не всегда означает pH 7."};
 }
 let acidMol=0,baseMol=0,aceticMol=0,ammoniaMol=0;
 let carbonateMol=0,phosphateMol=0,sulfateMol=0,metalAcidMol=0;
 let metalWeightedKa=0,schoolApproximation=false;
 const otherWeakAcids:{mol:number;ka:number}[]=[];
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
  // Apply first-order hydrated-metal-ion hydrolysis EVEN when its sulfate
  // or acetate already has an acid/base counterion model. Distinguish
  // Fe(II) from strongly hydrolysing Fe(III), never confuse valences.
  const metal=/^(Fe2|Al2|Fe|Al|Cu|Zn|Ni|Co|Mg|Pb|Ag)(?=Cl|NO3|\(NO3\)|\(SO4\)|SO4|\(CH3COO\))/.exec(id);
  if(metal){
   const species=metal[1];
   const ferric=species.startsWith("Fe")&&
    (id==="FeCl3"||id==="Fe(NO3)3"||id==="Fe2(SO4)3");
   const ka:Record<string,number>={Al:1e-5,Cu:1e-8,Zn:1e-9,
    Ni:1e-10,Co:1e-10,Mg:4e-12,Pb:1e-8,Ag:1e-12};
   const strength=species.startsWith("Fe")?
    (ferric?1e-3:3e-10):
    (ka[species.replace(/2$/,"")]??1e-10);
   const ions=species.endsWith("2")?2*mol:mol;
   metalAcidMol+=ions;metalWeightedKa+=ions*strength;
   schoolApproximation=true;
  }
  if(STRONG_ACIDS.has(id))acidMol+=mol;
  else if(STRONG_BASES.has(id))baseMol+=mol;
  else if(id==="CH3COOH")aceticMol+=mol;
  else if(id==="CH3COONa"||id==="CH3COOK"){
   // Conjugate acetate and its alkali counterion survive neutralisation.
   aceticMol+=mol;baseMol+=mol;
  }
  else if(id==="NH4Cl"){
   // Ammonium is a weak acid; chloride is the counterion.
   ammoniaMol+=mol;acidMol+=mol;
  }
  else if(id==="NH4OH"||id==="NH3")ammoniaMol+=mol;
  else if(id==="H2SO4"){
   acidMol+=mol;sulfateMol+=mol;schoolApproximation=true;
  }else if(["Na2SO4","K2SO4","Li2SO4","(NH4)2SO4",
    "MgSO4","CuSO4","FeSO4","ZnSO4","NiSO4","BaSO4"].includes(id)){
   baseMol+=2*mol;acidMol+=mol;sulfateMol+=mol;
   if(id==="(NH4)2SO4"){ammoniaMol+=2*mol;acidMol+=2*mol}
   schoolApproximation=true;
  }else if(["Na2CO3","K2CO3","Li2CO3","BaCO3","CaCO3",
    "MgCO3","(NH4)2CO3"].includes(id)){
   carbonateMol+=mol;baseMol+=2*mol;
   if(id==="(NH4)2CO3"){ammoniaMol+=2*mol;acidMol+=2*mol}
   schoolApproximation=true;
  }else if(id==="NaHCO3"){
   carbonateMol+=mol;baseMol+=mol;schoolApproximation=true;
  }else if(id==="H2CO3"||id==="CO2"){
   carbonateMol+=mol;schoolApproximation=true;
  }else if(id==="H3PO4"){
   phosphateMol+=mol;schoolApproximation=true;
  }else if(id==="NaH2PO4"){
   phosphateMol+=mol;baseMol+=mol;schoolApproximation=true;
  }else if(id==="Na3PO4"||id==="K3PO4"){
   phosphateMol+=mol;baseMol+=3*mol;schoolApproximation=true;
  }else if(id==="HF"||id==="H2S"){
   otherWeakAcids.push({mol,ka:id==="HF"?6.8e-4:1e-7});
   schoolApproximation=true;
  }else if(id==="NH4NO3"){
   ammoniaMol+=mol;acidMol+=mol;schoolApproximation=true;
  }else if(id==="CH3COOLi"){
   aceticMol+=mol;baseMol+=mol;schoolApproximation=true;
  }else if(["Ca(CH3COO)2","Mg(CH3COO)2","Zn(CH3COO)2",
    "Fe(CH3COO)2"].includes(id)){
   aceticMol+=2*mol;baseMol+=2*mol;schoolApproximation=true;
  }else if(id==="Ca(OH)2"||id==="Ba(OH)2"||id==="Mg(OH)2"){
   baseMol+=2*mol;schoolApproximation=true;
  }else if(id==="Fe(OH)3"||id==="Al(OH)3"){
   baseMol+=3*mol;schoolApproximation=true;
  }else{
   // Unknown aqueous solute: contribute no extra acid/base charge.
   // It remains present in the mass ledger; pH is marked approximate.
   schoolApproximation=true;
  }
 }
 // 25°C reference Ka are used as explicit qualitative classroom estimates
 // at other water temperatures. Kw itself follows temperature-dependent data.
 const weak=aceticMol>0||ammoniaMol>0||carbonateMol>0||
  phosphateMol>0||sulfateMol>0||otherWeakAcids.length>0||metalAcidMol>0;
 const effectiveKw=KW;
 const volumeL=volumeMl/1000;
 const acid=acidMol/volumeL,base=baseMol/volumeL,
  acetic=aceticMol/volumeL,ammonia=ammoniaMol/volumeL;
 const kaC1=4.3e-7,kaC2=4.7e-11;
 const kaP1=7.1e-3,kaP2=6.3e-8,kaP3=4.2e-13;
 // Charge-balance bisection. Each polyprotic fraction is normalized,
 // guaranteeing stable results for dilute and partially neutralized stocks.
 const charge=(logH:number)=>{
  const h=Math.pow(10,logH),oh=effectiveKw/h;
  const acetate=acetic*weakAcidKa/(weakAcidKa+h);
  const ammonium=ammonia*h/(h+effectiveKw/weakBaseKb);
  const cd=h*h+kaC1*h+kaC1*kaC2;
  const carbon=carbonateMol/volumeL*(kaC1*h+2*kaC1*kaC2)/cd;
  const pd=h*h*h+kaP1*h*h+kaP1*kaP2*h+kaP1*kaP2*kaP3;
  const phosphate=phosphateMol/volumeL*
   (kaP1*h*h+2*kaP1*kaP2*h+3*kaP1*kaP2*kaP3)/pd;
  const bisulfate=sulfateMol/volumeL*.012/(.012+h);
  const other=otherWeakAcids.reduce((sum,x)=>sum+
   x.mol/volumeL*x.ka/(x.ka+h),0);
  const avgMetalKa=metalAcidMol>0?metalWeightedKa/metalAcidMol:0;
  const hydrolysis=metalAcidMol>0?
   metalAcidMol/volumeL*avgMetalKa/(avgMetalKa+h):0;
  return h+base+ammonium-oh-acid-acetate-carbon-phosphate-
   bisulfate-other-hydrolysis;
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
  note:schoolApproximation||weak?
   "Школьная приближённая модель кислотно-основных равновесий при 25 °C; без поправок на активности и сложные гидролизные формы.":
   "Расчёт из заданных молей и K_w воды при "+temperatureC.toLocaleString("ru-RU")+
    " °C (IAPWS). Без поправок на активности."};
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
