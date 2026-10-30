/** Recompute a conservative, measurable species inventory for reviewed school
 * reactions. Not a general Gibbs-energy minimizer: an unreviewed reaction is
 * never fabricated. Gases marked ↑ leave the open vessel; ↓ remain as solids.
 * Solutions are ideal at 25 °C for the limited Ksp cases listed below. */
import {reviewedReactionCases,type ReactionEnvironment,type ReactionCase} from "./lektrusReactionDatabase";
import {labDoseMoles,labMolarMass,parseBalancedLabEquation} from "./lektrusLabStoichiometry";
import type {LabDose} from "./lektrusChemistryBenchModel";
import {labEquilibrateNaClCrystals} from "./lektrusLabMaterialConstants";

/** Persistent, strictly quantitative phase inventory. A transfer can carry
 * these molecule counts without pretending the filtrate is a fresh stock
 * solution or replaying old reactants after the precipitate is removed. */
export type LabChemicalSnapshot={
 speciesMol:Record<string,number>;
 solidMol:Record<string,number>;
 retainedGasMol?:Record<string,number>;
};
export type LabInventoryStep={equation:string;extentMol:number;observation:string;heatKJ?:number};
export type LabInventory={
 speciesMol:Record<string,number>;solidMol:Record<string,number>;
 releasedGasMol:Record<string,number>;retainedGasMol:Record<string,number>;
 steps:LabInventoryStep[];
 unmeasured:string[];limited:boolean;knownHeatKJ?:number;heatEstimateComplete:boolean;
};
/** Selected Ksp at 25 °C. Source data: OpenStax Chemistry 2e,
 * Appendix J https://openstax.org/books/chemistry-2e/pages/j-solubility-products
 * BaSO4 follows the commonly used dilute-solution value in LibreTexts.
 * A Ksp is an ion-activity equilibrium constant, not a kinetic rate and
 * not a temperature-independent solubility. Numbers below support only
 * explicit two-component ideal-solution classroom approximations. */
export const LAB_KSP_25C:Readonly<Record<string,number>>=Object.freeze({
 AgCl:1.6e-10,AgBr:5.0e-13,AgI:1.5e-16,BaSO4:1.1e-10,
 CaCO3:8.7e-9,BaCO3:1.6e-9,PbSO4:1.3e-8,
 PbCl2:1.6e-5,PbBr2:4.6e-6,PbI2:1.4e-8,
 "Cu(OH)2":2.2e-20,"Fe(OH)2":1.8e-15,
 "Fe(OH)3":4.0e-38,"Mg(OH)2":8.9e-12,
 "Al(OH)3":2.0e-32,"Ni(OH)2":1.6e-16,
 Ag2CO3:8.1e-12,Ag3PO4:1.8e-18
});
const WATER_SOLUBLE_SOLIDS=new Set([
 "NaCl","KCl","NaBr","KBr","NaNO3","KNO3","LiCl","LiNO3",
 "Na2SO4","K2SO4","MgSO4","CuSO4","FeSO4","NiSO4","CaCl2",
 "BaCl2","AgNO3","Na2CO3","NaHCO3","KI","KMnO4",
 "C12H22O11","C6H12O6","KOH","NaOH","Ca(NO3)2","NH4Cl"
]);
const EPS=1e-12;
const knownRows=reviewedReactionCases.flatMap((row,index)=>{
 if(row.status!=="reaction")return [];
 const equation=parseBalancedLabEquation(row.equation);
 if(!equation)return [];
 // Each chemically consumed species must be declared in the curated case.
 if(equation.reactants.some(t=>!row.reactants.includes(t.formula)))return [];
 return [{row,equation,index}];
});
const sum=(record:Record<string,number>,name:string,delta:number)=>{
 const value=(record[name]??0)+delta;
 if(value>EPS)record[name]=value;
 else delete record[name];
};
const available=(record:Record<string,number>,name:string)=>Math.max(0,record[name]??0);
/** Product ion quotient Q = [cation]^a[anion]^b for a binary
 * precipitation producing ONE formula unit. All chemical species here are
 * neutral molecular stocks, so each participating stock must contribute
 * one precipitating ion per mole. Cases with further equilibria remain
 * explicitly approximate rather than inferred. */
function kspLimitedExtent(row:ReactionCase,
 equation:ReturnType<typeof parseBalancedLabEquation>,inventory:LabInventory,
 fullExtent:number,volumeL:number,temperatureC:number):number{
 if(!equation||row.environment!=="aqueous"||volumeL<=0||
  Math.abs(temperatureC-25)>5)return fullExtent;
 const marked=(row.equation.split("→")[1]??"").split(/\s+\+\s+/).
  filter(s=>s.includes("↓"));
 if(marked.length!==1)return fullExtent;
 const precipitate=marked[0].replace(/^\s*\d+\s*/,"").replace("↓","").trim();
 const ksp=LAB_KSP_25C[precipitate];
 if(!ksp||equation.reactants.length!==2||
  !equation.products.some(t=>t.formula===precipitate&&t.coefficient===1)||
  equation.reactants.some(t=>t.coefficient>3))return fullExtent;
 const terms=equation.reactants;
 const stocks=terms.map(t=>available(inventory.speciesMol,t.formula));
 const quotient=(extent:number)=>terms.reduce((value,term,i)=>{
  const concentration=Math.max(0,stocks[i]-extent*term.coefficient)/volumeL;
  return value*concentration**term.coefficient;
 },1);
 if(quotient(0)<=ksp)return 0;
 let low=0,high=fullExtent;
 for(let i=0;i<70;i++){
  const x=(low+high)/2;
  if(quotient(x)>ksp)low=x;else high=x;
 }
 return low;
}
const inventoryCache=new Map<string,LabInventory>();
const remember=(key:string,value:LabInventory)=>{
 if(inventoryCache.size>=256)inventoryCache.delete(inventoryCache.keys().next().value!);
 inventoryCache.set(key,value);return value;
};
export function simulateLabInventory(input:{
 reagents:readonly string[];doses?:Record<string,LabDose>;
 environment:ReactionEnvironment;temperatureC?:number;stoppered?:boolean;
 chemicalInventory?:LabChemicalSnapshot;
 /** Measured total liquid volume, independent of solute molar amounts. */
 volumeMl?:number;
},maxSteps=48):LabInventory{
 const key=JSON.stringify([input.reagents,input.doses,input.environment,input.temperatureC??22,!!input.stoppered,
  input.chemicalInventory,input.volumeMl,maxSteps]);
 const cached=inventoryCache.get(key);
 if(cached)return cached;
 const inventory:LabInventory={speciesMol:{},solidMol:{},releasedGasMol:{},retainedGasMol:{},
  steps:[],unmeasured:[],limited:false,heatEstimateComplete:true};
 const doses=input.doses??{};
 const volumeMl=input.volumeMl??Object.entries(doses).reduce((n,[id,d])=>
  n+(d.unit==="ml"&&!["CO2","H2","O2","NH3","Cl2","NO2","SO2"].includes(id)?d.value:0),0);
 if(input.chemicalInventory){
  Object.assign(inventory.speciesMol,input.chemicalInventory.speciesMol);
  Object.assign(inventory.solidMol,input.chemicalInventory.solidMol);
  Object.assign(inventory.retainedGasMol,input.chemicalInventory.retainedGasMol??{});
 }else for(const id of input.reagents){
  const dose=doses[id];
  const mol=dose?labDoseMoles(id,dose):undefined;
  if(mol===undefined||!Number.isFinite(mol)||mol<=0){
   inventory.unmeasured.push(id);continue;
  }
  sum(inventory.speciesMol,id,mol);
  if(dose?.unit==="g"&&
   (input.environment!=="aqueous"||!WATER_SOLUBLE_SOLIDS.has(id)))
   sum(inventory.solidMol,id,mol);
 }
 // Unknown quantities must not be treated as absent: suppress the entire
 // predictive stage rather than claiming a chemically complete result.
 if(inventory.unmeasured.length)return remember(key,inventory);
 const used=new Set<string>();
 for(let iteration=0;iteration<maxSteps;iteration++){
  let winner:typeof knownRows[number]|undefined;
  let winningExtent=0,priority=-Infinity;
  for(const entry of knownRows){
   const {row,equation}=entry;
   if(used.has(row.equation+"|"+row.environment))continue;
   if(row.environment!==input.environment)continue;
   if((row.minTemperatureC??0)>(input.temperatureC??22))continue;
   if(row.environment==="heated"&&(input.temperatureC??22)<90)continue;
   if(row.environment==="ignited"&&(input.temperatureC??22)<135)continue;
   if(!row.reactants.every(id=>available(inventory.speciesMol,id)>EPS))continue;
   const bound=Math.min(...equation.reactants.map(t=>
    available(inventory.speciesMol,t.formula)/t.coefficient));
   if(!Number.isFinite(bound)||bound<=EPS)continue;
   const extent=kspLimitedExtent(row,equation,inventory,bound,volumeMl/1000,input.temperatureC??25);
   if(extent<=EPS)continue;
   // Prefer precipitation / neutralization before secondary reactions.
   // No sign of ΔG° is inferred for cases lacking thermodynamic data.
   const rank=row.observation==="precipitate"?5:
    row.family==="neutralization"?4:row.observation==="gas"?3:2;
   const score=rank*1e6+Math.min(1,extent)*100-entry.index/1e5;
   if(score>priority){priority=score;winner=entry;winningExtent=extent}
  }
  if(!winner)break;
  const {row,equation}=winner;
  used.add(row.equation+"|"+row.environment);
  for(const term of equation.reactants){
   const consumed=winningExtent*term.coefficient;
   sum(inventory.speciesMol,term.formula,-consumed);
   const solid=Math.min(available(inventory.solidMol,term.formula),consumed);
   if(solid>0)sum(inventory.solidMol,term.formula,-solid);
  }
  const rhs=row.equation.split("→")[1]??"";
  const rawProducts=rhs.split(/\s+\+\s+/);
  for(const term of equation.products){
   const gained=winningExtent*term.coefficient;
   const marker=rawProducts.find(s=>s.replace(/^\s*\d+\s*/,"").
    replace(/[↓↑]/g,"").trim()===term.formula)??"";
   if(marker.includes("↑")){
    sum(input.stoppered?inventory.retainedGasMol:inventory.releasedGasMol,
     term.formula,gained);
   }else{
    sum(inventory.speciesMol,term.formula,gained);
    if(marker.includes("↓")||
     row.environment!=="aqueous"&&term.formula!=="H2O")
     sum(inventory.solidMol,term.formula,gained);
   }
  }
  const heatKJ=row.enthalpyKJPerMol===undefined?undefined:
   row.enthalpyKJPerMol*winningExtent;
  if(heatKJ===undefined)inventory.heatEstimateComplete=false;
  else inventory.knownHeatKJ=(inventory.knownHeatKJ??0)+heatKJ;
  inventory.steps.push({equation:row.equation,extentMol:winningExtent,
   observation:row.observation,...(heatKJ===undefined?{}:{heatKJ})});
 }
 inventory.limited=inventory.steps.length>=maxSteps;
 // Reference NaCl + pure-water crystallization is a reversible phase change,
 // not a chemical reaction. It never consumes NaCl, and never runs for other
 // ions, aqueous stocks without an explicit solvent, or unknown hydration.
 const isBinaryNaCl=inventory.steps.length===0&&input.environment==="aqueous"&&
  !!doses.H2O&&doses.H2O.unit==="ml"&&doses.H2O.concentrationM===undefined;
 if(isBinaryNaCl)labEquilibrateNaClCrystals(inventory,
  input.temperatureC??22,true);
 // Once the *explicit* pure water volume is entirely evaporated, the
 // originally weighed NaCl is dry. Do not treat arbitrary NaCl stock
 // solutions without a tracked solvent as evaporated residue.
 if(!doses.H2O&&doses.NaCl?.unit==="g"&&volumeMl===0&&
  inventory.steps.length===0&&
  Object.keys(inventory.speciesMol).every(id=>id==="NaCl"))
  inventory.solidMol.NaCl=inventory.speciesMol.NaCl;
 return remember(key,inventory);
}
export function labInventorySnapshot(inventory:LabInventory):LabChemicalSnapshot{
 return {speciesMol:{...inventory.speciesMol},solidMol:{...inventory.solidMol},
  retainedGasMol:{...inventory.retainedGasMol}};
}
export function labInventoryMassG(inventory:LabInventory):number|undefined{
 let sumMass=0;
 for(const record of [inventory.speciesMol,inventory.releasedGasMol,
  inventory.retainedGasMol]){
  for(const [formula,mol] of Object.entries(record)){
   const mass=labMolarMass(formula);
   if(mass===undefined)return undefined;
   sumMass+=mass*mol;
  }
 }
 return sumMass;
}
