/** Recompute a conservative, measurable species inventory for reviewed school
 * reactions. Not a general Gibbs-energy minimizer: an unreviewed reaction is
 * never fabricated. Gases marked ↑ leave the open vessel; ↓ remain as solids.
 * Solutions are ideal at 25 °C for the limited Ksp cases listed below. */
import {reviewedReactionCases,type ReactionEnvironment,type ReactionCase} from "./lektrusReactionDatabase";
import {labDoseMoles,labMolarMass,parseBalancedLabEquation} from "./lektrusLabStoichiometry";
import type {LabDose} from "./lektrusChemistryBenchModel";

export type LabInventoryStep={equation:string;extentMol:number;observation:string};
export type LabInventory={
 speciesMol:Record<string,number>;solidMol:Record<string,number>;
 releasedGasMol:Record<string,number>;steps:LabInventoryStep[];
 unmeasured:string[];limited:boolean;
};
/** Solids with known low solubility products (25°C, ideal concentrations).
 * The 1:1 solver is only used for binary equations with unit coefficients,
 * not for multivalent ions or nonideal concentrated solutions. */
const KSP_1_TO_1:Record<string,number>={
 AgCl:1.8e-10,AgBr:5.0e-13,AgI:8.3e-17,BaSO4:1.1e-10,
 CaCO3:3.3e-9,BaCO3:5.1e-9,PbSO4:1.6e-8
};
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
function kspLimitedExtent(row:ReactionCase,
 equation:ReturnType<typeof parseBalancedLabEquation>,inventory:LabInventory,
 fullExtent:number,volumeL:number):number{
 if(!equation||row.environment!=="aqueous"||volumeL<=0)return fullExtent;
 const precipitate=row.equation.split("→")[1]?.split(/\s+\+\s+/).
  find(s=>s.includes("↓"))?.replace(/^\s*\d+\s*/,"").replace("↓","").trim();
 const ksp=precipitate&&KSP_1_TO_1[precipitate];
 if(!ksp||equation.reactants.length!==2||
  equation.reactants.some(t=>t.coefficient!==1)||
  !equation.products.some(t=>t.formula===precipitate&&t.coefficient===1))return fullExtent;
 const [a,b]=equation.reactants.map(t=>available(inventory.speciesMol,t.formula));
 if(a*b/(volumeL*volumeL)<=ksp)return 0;
 // Binary ionic approximation: Q=(a-x)(b-x)/V². Bisection preserves
 // a small soluble residue instead of precipitating everything.
 let low=0,high=fullExtent;
 for(let i=0;i<60;i++){
  const x=(low+high)/2;
  const quotient=(a-x)*(b-x)/(volumeL*volumeL);
  if(quotient>ksp)low=x;else high=x;
 }
 return low;
}
export function simulateLabInventory(input:{
 reagents:readonly string[];doses?:Record<string,LabDose>;
 environment:ReactionEnvironment;temperatureC?:number;
},maxSteps=48):LabInventory{
 const inventory:LabInventory={speciesMol:{},solidMol:{},releasedGasMol:{},
  steps:[],unmeasured:[],limited:false};
 const doses=input.doses??{};
 const volumeMl=Object.values(doses).reduce((n,d)=>n+(d.unit==="ml"?d.value:0),0);
 for(const id of input.reagents){
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
 if(inventory.unmeasured.length)return inventory;
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
   const extent=kspLimitedExtent(row,equation,inventory,bound,volumeMl/1000);
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
    sum(inventory.releasedGasMol,term.formula,gained);
   }else{
    sum(inventory.speciesMol,term.formula,gained);
    if(marker.includes("↓")||
     row.environment!=="aqueous"&&term.formula!=="H2O")
     sum(inventory.solidMol,term.formula,gained);
   }
  }
  inventory.steps.push({equation:row.equation,extentMol:winningExtent,
   observation:row.observation});
 }
 inventory.limited=inventory.steps.length>=maxSteps;
 return inventory;
}
export function labInventoryMassG(inventory:LabInventory):number|undefined{
 let sumMass=0;
 for(const record of [inventory.speciesMol,inventory.releasedGasMol]){
  for(const [formula,mol] of Object.entries(record)){
   const mass=labMolarMass(formula);
   if(mass===undefined)return undefined;
   sumMass+=mass*mol;
  }
 }
 return sumMass;
}
