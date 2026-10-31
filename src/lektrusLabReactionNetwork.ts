/** Recompute a conservative, measurable species inventory for reviewed school
 * reactions. Not a general Gibbs-energy minimizer: an unreviewed reaction is
 * never fabricated. Gases marked ↑ leave the open vessel; ↓ remain as solids.
 * Solutions are ideal at 25 °C for the limited Ksp cases listed below. */
import {reviewedReactionCases,type ReactionEnvironment,type ReactionCase} from "./lektrusReactionDatabase";
import {labDoseMoles,labMolarMass,parseBalancedLabEquation,type LabReactionAmounts} from "./lektrusLabStoichiometry";
import type {LabDose} from "./lektrusChemistryBenchModel";
import {labEquilibrateSingleSaltCrystals,labSingleSaltSolubilityGPer100gWater} from "./lektrusLabMaterialConstants";
import {labSchoolMixedSaltEquilibrium} from "./lektrusLabDissolution";

/** Persistent, strictly quantitative phase inventory. A transfer can carry
 * these molecule counts without pretending the filtrate is a fresh stock
 * solution or replaying old reactants after the precipitate is removed. */
export type LabChemicalSnapshot={
 speciesMol:Record<string,number>;
 solidMol:Record<string,number>;
 retainedGasMol?:Record<string,number>;
 /** Ventilated products belong to the global mass balance but not the
  * vessel headspace. Never transfer this historical gas to new glassware. */
 releasedGasMol?:Record<string,number>;
 /** Balanced precipitation equations verified for this exact molecule ledger.
  * No guessed reaction identity and no implicit creation of ions. */
 equilibriumEquations?:string[];
};
export type LabInventoryStep={equation:string;extentMol:number;observation:string;heatKJ?:number};
export type LabInventory={
 speciesMol:Record<string,number>;solidMol:Record<string,number>;
 releasedGasMol:Record<string,number>;retainedGasMol:Record<string,number>;
 steps:LabInventoryStep[];
 equilibriumEquations:string[];
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
/** DILUTE water solubility CLASS, not a saturation-curve dataset.
 * Exact solubility is still available only for a separately tabulated
 * binary compound. OpenStax Chemistry 2e §4.2 (precipitation solubility
 * rules): https://openstax.org/books/chemistry-2e/pages/4-2-classifying-chemical-reactions
 * Exceptions excluded: Ag, Pb halides; Ba/Pb/Sr/Ca sulphates; metal
 * carbonates, phosphates and most hydroxides. Existing dose quantities
 * are conserved; classification does NOT invent saturation constants. */
export const LAB_DILUTE_WATER_SOLUBLE_STOCKS:ReadonlySet<string>=new Set([
 // Existing soluble salts, metal hydroxides, sugars and misc. reagents
 "NaCl","KCl","NaBr","KBr","NaNO3","KNO3","LiCl","LiNO3",
 "Na2SO4","K2SO4","MgSO4","CuSO4","FeSO4","NiSO4","CaCl2",
 "BaCl2","AgNO3","Na2CO3","NaHCO3","KI","KMnO4",
 "C12H22O11","C6H12O6","KOH","NaOH","Ca(NO3)2","NH4Cl",
 // Additional catalog chlorides (except verified poorly-soluble Pb/Ag)
 "MgCl2","FeCl2","FeCl3","CuCl2","AlCl3","ZnCl2",
 "SrCl2","NiCl2","CoCl2",
 // All catalog nitrates, ammonium salts, and strongly soluble acetates
 "Cu(NO3)2","Pb(NO3)2","NH4NO3","Mg(NO3)2",
 "Ba(NO3)2","Fe(NO3)3","Fe(NO3)2","Zn(NO3)2","Al(NO3)3",
 "(NH4)2SO4","(NH4)2CO3",
 "CH3COONa","CH3COOK","CH3COOLi","Ca(CH3COO)2",
 "Mg(CH3COO)2","Zn(CH3COO)2","Fe(CH3COO)2",
 // Other catalog sulphates, alkali phosphate/carbonate/sulphite salts
 "ZnSO4","Fe2(SO4)3","Li2SO4","Al2(SO4)3","MnSO4",
 "K2CO3","Na3PO4","K3PO4","NaH2PO4",
 "Na2SO3","K2SO3","Na2S",
 // Alkali hydroxide, nitrate and other vetted soluble compounds
 "LiOH","NaNO2","KNO2","K2Cr2O7","K2MnO4"
]);
export const labIsTypicallyWaterSoluble=(formula:string):boolean=>
 LAB_DILUTE_WATER_SOLUBLE_STOCKS.has(formula);
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
/** A measured precipitate is not necessarily permanently insoluble:
 * when dilution makes Q < Ksp, dissolve it back into exactly those
 * stoichiometric neutral stocks and spectator salts that were consumed.
 *
 * Narrow applicability: TWO original reactants, ONE solid product of
 * coefficient one, at least one dissolved product, a curated 25 °C Ksp,
 * and an exact verified equation saved from the original experiment.
 * This is a molecular bookkeeping approximation, not a general ionic
 * speciation or multi-phase thermodynamic solver.
 */
function labReequilibrateRecordedPrecipitates(
 inventory:LabInventory,volumeL:number
):void{
 // Multiple precipitates can share metal/anion inventories. Applying
 // independent molecular Ksp reversals to each would double-count ionic
 // spectators and can reprecipitate material after filtration. Leave
 // multi-solid equilibria unchanged until a coupled ion solver exists.
 if(Object.values(inventory.solidMol).filter(mol=>mol>EPS).length!==1)return;
 for(let round=0;round<4;round++){
  let moved=false;
  for(const equationText of inventory.equilibriumEquations){
   const row=knownRows.find(r=>r.row.equation===equationText&&
    r.row.environment==="aqueous"&&r.row.observation==="precipitate");
   if(!row)continue;
   const {equation}=row;
   if(equation.reactants.length!==2)continue;
   const markers=(equationText.split("→")[1]??"").split(/\s+\+\s+/).
    filter(x=>x.includes("↓"));
   if(markers.length!==1)continue;
   const precipitate=markers[0].replace(/^\s*\d+\s*/,"").
    replace(/[↓↑]/g,"").trim();
   const ksp=LAB_KSP_25C[precipitate];
   const precip=equation.products.find(t=>t.formula===precipitate);
   if(!ksp||!precip||precip.coefficient!==1)continue;
   const otherProducts=equation.products.filter(t=>t.formula!==precipitate);
   if(!otherProducts.length||otherProducts.some(t=>
    available(inventory.speciesMol,t.formula)<=EPS))continue;
   const solid=available(inventory.solidMol,precipitate);
   const capacity=Math.min(solid,...otherProducts.map(t=>
    available(inventory.speciesMol,t.formula)/t.coefficient));
   if(capacity<=EPS)continue;
   const q=(mol:number)=>equation.reactants.reduce((q,t)=>
    q*Math.pow((available(inventory.speciesMol,t.formula)+
      mol*t.coefficient)/volumeL,t.coefficient),1);
   if(q(0)>=ksp||q(capacity)<ksp){
    // If even the last particle cannot saturate the water, dissolve
    // all of the material (still constrained by conserved spectators).
    if(q(0)>=ksp)continue;
   }
   let amount=capacity;
   if(q(capacity)>ksp){
    let low=0,high=capacity;
    for(let i=0;i<65;i++){
     const mid=(low+high)/2;
     if(q(mid)<ksp)low=mid;else high=mid;
    }
    amount=low;
   }
   if(amount<=EPS)continue;
   for(const t of otherProducts)sum(inventory.speciesMol,t.formula,-amount*t.coefficient);
   for(const t of equation.reactants)sum(inventory.speciesMol,t.formula,amount*t.coefficient);
   sum(inventory.speciesMol,precipitate,-amount);
   sum(inventory.solidMol,precipitate,-amount);
   moved=true;
  }
  if(!moved)break;
 }
}
/** Simultaneous school-level Ksp for 2–4 proven precipitates.
 * Unlike independently reversing each equation, all coordinates read and
 * update the SAME conserved molecular ledger. A shared counterion stock
 * therefore cannot be spent twice. Every move is one signed, balanced
 * reaction extent and conserves every element.
 *
 * Strict scope: one known Ksp solid per vetted two-reactant equation;
 * a separate recorded equation for EVERY present solid; 25 +/- 5 C;
 * no unknown hydrate, ligand-complex, or untracked ionic species.
 * The quotient still uses neutral stocks as an IDEAL CLASSROOM proxy for
 * free ions: it is not a quantitative activity-based speciation model.
 */
function labCoupledRecordedPrecipitates(
 inventory:LabInventory,volumeL:number,equationTexts:readonly string[]
):boolean{
 const solids=Object.entries(inventory.solidMol).
  filter(([,mol])=>mol>EPS).map(([formula])=>formula);
 if(solids.length<2||solids.length>4||volumeL<=0)return false;
 type Candidate={precipitate:string;equation:NonNullable<ReturnType<typeof parseBalancedLabEquation>>;
  ksp:number};
 const candidates:Candidate[]=[];
 for(const precipitate of solids.sort()){
  let picked:Candidate|undefined;
  for(const text of equationTexts){
   const record=knownRows.find(item=>item.row.equation===text&&
    item.row.environment==="aqueous"&&item.row.observation==="precipitate");
   if(!record||record.equation.reactants.length!==2)continue;
   const products=(text.split("→")[1]??"").split(/\\s+\\+\\s+/).
    filter(item=>item.includes("↓"));
   if(products.length!==1)continue;
   const marked=products[0].replace(/^\\s*\\d+\\s*/,"").
    replace(/[↓↑]/g,"").trim();
   const coeff=record.equation.products.find(t=>t.formula===precipitate);
   const remaining=record.equation.products.filter(t=>t.formula!==precipitate);
   const ksp=LAB_KSP_25C[precipitate];
   if(marked!==precipitate||!coeff||coeff.coefficient!==1||
    !ksp||remaining.length===0||record.equation.reactants.some(t=>
     t.coefficient>3)||remaining.some(t=>t.formula==="H2O"))continue;
   picked={precipitate,equation:record.equation,ksp};
   break;
  }
  // One unidentified solid invalidates the coupled approximation.
  if(!picked)return false;
  candidates.push(picked);
 }
 for(let sweep=0;sweep<40;sweep++){
  let largest=0;
  for(const {precipitate,equation,ksp} of candidates){
   const forward=Math.min(...equation.reactants.map(t=>
    available(inventory.speciesMol,t.formula)/t.coefficient));
   const other=equation.products.filter(t=>t.formula!==precipitate);
   const reverse=Math.min(available(inventory.solidMol,precipitate),
    ...other.map(t=>available(inventory.speciesMol,t.formula)/t.coefficient));
   if(forward<EPS&&reverse<EPS)continue;
   const quotient=(extent:number)=>equation.reactants.reduce((product,t)=>{
    const remaining=Math.max(0,available(inventory.speciesMol,t.formula)-
     extent*t.coefficient);
    return product*Math.pow(remaining/volumeL,t.coefficient);
   },1);
   const present=quotient(0);
   if(Math.abs(present-ksp)/ksp<1e-7)continue;
   // At positive extent, stock ions precipitate and Q falls; negative
   // extent dissolves solid and Q rises. Clamp by every stoichiometric
   // stock and spectator, not only by the crystalline phase.
   let extent=0;
   if(present>ksp){
    if(forward<=EPS)continue;
    if(quotient(forward)>=ksp)extent=forward;
    else{
     let low=0,high=forward;
     for(let i=0;i<65;i++){
      const mid=(low+high)/2;
      if(quotient(mid)>ksp)low=mid;else high=mid;
     }
     extent=low;
    }
   }else{
    if(reverse<=EPS)continue;
    if(quotient(-reverse)<=ksp)extent=-reverse;
    else{
     let low=-reverse,high=0;
     for(let i=0;i<65;i++){
      const mid=(low+high)/2;
      if(quotient(mid)>ksp)low=mid;else high=mid;
     }
     extent=high;
    }
   }
   if(Math.abs(extent)<=EPS)continue;
   for(const t of equation.reactants)
    sum(inventory.speciesMol,t.formula,-extent*t.coefficient);
   for(const t of equation.products){
    sum(inventory.speciesMol,t.formula,extent*t.coefficient);
    if(t.formula===precipitate)
     sum(inventory.solidMol,t.formula,extent*t.coefficient);
   }
   largest=Math.max(largest,Math.abs(extent));
  }
  if(largest<1e-11)break;
 }
 return true;
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
 /** Partial progress of a measured gas-generating reaction. */
 reactionAmounts?:Pick<LabReactionAmounts,"equation"|"productsMol"|"remainingMol">&
  Partial<LabReactionAmounts>;
 /** Persisted kinetic partition for a verified single-salt water mixture. */
 binarySaltPhase?:{formula:string;solidMol:number};
 /** Separate kinetic crystal amounts of a nonreacting multi-salt solution. */
 mixedSaltPhase?:Record<string,number>;
 /** Measured total liquid volume, independent of solute molar amounts. */
 volumeMl?:number;
},maxSteps=48):LabInventory{
 const key=JSON.stringify([input.reagents,input.doses,input.environment,input.temperatureC??22,!!input.stoppered,
  input.chemicalInventory,input.reactionAmounts,input.binarySaltPhase,
  input.mixedSaltPhase,input.volumeMl,maxSteps]);
 const cached=inventoryCache.get(key);
 if(cached)return cached;
 const inventory:LabInventory={speciesMol:{},solidMol:{},releasedGasMol:{},retainedGasMol:{},
  steps:[],equilibriumEquations:[],unmeasured:[],limited:false,heatEstimateComplete:true};
 const doses=input.doses??{};
 const volumeMl=input.volumeMl??Object.entries(doses).reduce((n,[id,d])=>
  n+(d.unit==="ml"&&!["CO2","H2","O2","NH3","Cl2","NO2","SO2"].includes(id)?d.value:0),0);
 // An aqueous reaction MODE does not conjure any actual solvent.
 // Dry weighed NaCl, KNO3, or a base pellet stays SOLID until it receives
 // a measured volume of water, a solution, or another liquid medium.
 // When an existing filtrate carries liquid, volumeMl is the same
 // explicitly persisted liquid volume that the vessel quantity reports.
 const hasMeasuredLiquid=volumeMl>1e-10;
 if(input.chemicalInventory){
  Object.assign(inventory.speciesMol,input.chemicalInventory.speciesMol);
  Object.assign(inventory.solidMol,input.chemicalInventory.solidMol);
  Object.assign(inventory.retainedGasMol,input.chemicalInventory.retainedGasMol??{});
  Object.assign(inventory.releasedGasMol,input.chemicalInventory.releasedGasMol??{});
  inventory.equilibriumEquations=[...new Set(
   (input.chemicalInventory.equilibriumEquations??[]).slice(0,8))];
 }else for(const id of input.reagents){
  const dose=doses[id];
  const mol=dose?labDoseMoles(id,dose):undefined;
  if(mol===undefined||!Number.isFinite(mol)||mol<=0){
   inventory.unmeasured.push(id);continue;
  }
  sum(inventory.speciesMol,id,mol);
  if(dose?.unit==="g"&&
   (!hasMeasuredLiquid||input.environment!=="aqueous"||
    !LAB_DILUTE_WATER_SOLUBLE_STOCKS.has(id)))
   sum(inventory.solidMol,id,mol);
 }
 // Unknown quantities must not be treated as absent: suppress the entire
 // predictive stage rather than claiming a chemically complete result.
 if(inventory.unmeasured.length)return remember(key,inventory);
 // A measured, running gas reaction has a defined extent. For this
 // single validated step, never borrow the future final equilibrium.
 const progress=input.chemicalInventory?undefined:input.reactionAmounts;
 const progressCase=progress&&!progress.complete&&
  (input.environment!=="aqueous"||hasMeasuredLiquid)?
  knownRows.find(entry=>entry.row.equation===progress.equation&&
   entry.row.environment===input.environment&&
   entry.row.observation==="gas"):undefined;
 if(progressCase&&progress&&typeof progress.extentMol==="number"&&
  typeof progress.maxExtentMol==="number"&&Number.isFinite(progress.extentMol)&&
  Number.isFinite(progress.maxExtentMol)&&progress.extentMol>=0&&
  progress.extentMol<=progress.maxExtentMol+1e-9){
  const {row,equation}=progressCase;
  const extentMol=progress.extentMol;
  if(equation.reactants.every(term=>
   available(inventory.speciesMol,term.formula)+1e-9>=
    extentMol*term.coefficient)){
   for(const term of equation.reactants){
    const consumed=extentMol*term.coefficient;
    sum(inventory.speciesMol,term.formula,-consumed);
    const solid=Math.min(available(inventory.solidMol,term.formula),consumed);
    if(solid>0)sum(inventory.solidMol,term.formula,-solid);
   }
   const rawProducts=(row.equation.split("→")[1]??"").split(/\s+\+\s+/);
   for(const term of equation.products){
    const gained=extentMol*term.coefficient;
    const marker=rawProducts.find(x=>x.replace(/^\s*\d+\s*/,"").
     replace(/[↓↑]/g,"").trim()===term.formula)??"";
    if(marker.includes("↑"))sum(input.stoppered?
     inventory.retainedGasMol:inventory.releasedGasMol,term.formula,gained);
    else{
     sum(inventory.speciesMol,term.formula,gained);
     if(marker.includes("↓"))sum(inventory.solidMol,term.formula,gained);
    }
   }
   const heatKJ=row.enthalpyKJPerMol===undefined?undefined:
    row.enthalpyKJPerMol*progress.extentMol;
   inventory.heatEstimateComplete=heatKJ!==undefined;
   if(heatKJ!==undefined)inventory.knownHeatKJ=heatKJ;
   inventory.steps.push({equation:row.equation,extentMol:extentMol,
    observation:row.observation,...(heatKJ===undefined?{}:{heatKJ})});
   return remember(key,inventory);
  }
 }
 const used=new Set<string>();
 for(let iteration=0;iteration<maxSteps;iteration++){
  let winner:typeof knownRows[number]|undefined;
  let winningExtent=0,priority=-Infinity;
  for(const entry of knownRows){
   const {row,equation}=entry;
   if(used.has(row.equation+"|"+row.environment))continue;
   if(row.environment!==input.environment)continue;
   // A persisted, partially saturated solid was already equilibrated
   // using a 25 °C Ksp. At a different temperature there is no vetted
   // Ksp(T) in this model: do not manufacture a complete precipitation
   // merely because the equilibrium constant is unavailable there.
   if(input.chemicalInventory?.equilibriumEquations?.includes(row.equation)&&
    Math.abs((input.temperatureC??25)-25)>5&&
    row.equation.includes("↓")&&row.observation==="precipitate")continue;
   // A dry powder mixture cannot precipitate, neutralise or bubble merely
   // because the editor is set to "aqueous". Require actual liquid volume;
   // verified heated/ignited dry reactions keep their own environment.
   if(row.environment==="aqueous"&&!hasMeasuredLiquid)continue;
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
 // Curated PURE WATER + ONE SALT phase equilibria: the number of salt
 // molecules is invariant; only solid/dissolved partition may change.
 // No rule from these measured binary curves is imposed on mixed salts,
 // reaction mixtures, unspecified stock-solvent or unknown hydrates.
 const binary=inventory.steps.length===0&&input.environment==="aqueous"&&
  !!doses.H2O&&doses.H2O.unit==="ml"&&doses.H2O.concentrationM===undefined;
 if(binary){
  const binaryFormula=labEquilibrateSingleSaltCrystals(inventory,
   input.temperatureC??22,true,labMolarMass);
  const phase=input.binarySaltPhase;
  if(binaryFormula&&phase?.formula===binaryFormula&&
   Number.isFinite(phase.solidMol)&&phase.solidMol>=0&&
   phase.solidMol<=(inventory.speciesMol[binaryFormula]??0)+1e-9){
   // The solubility curve gives the TARGET. Actual solid mass follows
   // persisted kinetics, also for filtration and liquid sampling.
   if(phase.solidMol>EPS)inventory.solidMol[binaryFormula]=phase.solidMol;
   else delete inventory.solidMol[binaryFormula];
  }
 }
 // Mixtures of weighed salts do not have one global saturation capacity.
 // For a non-reacting school experiment, calculate EACH pure-water mass
 // ceiling against the same measured solvent. Keep the separate source
 // reference curves untouched and never replace a balanced reaction.
 if(inventory.steps.length===0&&input.environment==="aqueous"&&
  !input.chemicalInventory){
  const mixed=labSchoolMixedSaltEquilibrium({
   reagents:input.reagents,doses:input.doses,environment:input.environment
  },input.temperatureC??22);
  if(mixed){
   for(const formula of mixed.formulas){
    const target=input.mixedSaltPhase?.[formula];
    const equilibrated=target!==undefined&&Number.isFinite(target)&&target>=0?
     target:mixed.solidMol[formula]??0;
    const solid=Math.max(0,Math.min(inventory.speciesMol[formula]??0,
     equilibrated));
    if(solid>EPS)inventory.solidMol[formula]=solid;
    else delete inventory.solidMol[formula];
   }
  }
 }
 // When the last explicit drop of pure water has evaporated, a weighed
 // supported salt is dry rather than being indefinitely called dissolved.
 if(!doses.H2O&&volumeMl===0&&inventory.steps.length===0){
  const remaining=Object.keys(inventory.speciesMol).filter(id=>
   inventory.speciesMol[id]>EPS);
  const salt=remaining.length===1?remaining[0]:undefined;
  if(salt&&doses[salt]?.unit==="g"&&
   labSingleSaltSolubilityGPer100gWater(salt,25)!==undefined)
   inventory.solidMol[salt]=inventory.speciesMol[salt];
 }
 // Liquid dilution or transfer can dissolve a small measured part of an
 // EXISTING precipitate. Historical formulas provide the exact reversible
 // molecular bookkeeping; Ksp sets the dissolved limit only near 25 °C.
 // Reverse effects are intentionally excluded for unknown mineral phases.
 if(input.environment==="aqueous"&&!inventory.limited&&
  volumeMl>0&&Math.abs((input.temperatureC??25)-25)<=5){
  const verified=[...new Set([...inventory.equilibriumEquations,
   ...inventory.steps.filter(step=>step.equation.includes("↓")).
    map(step=>step.equation)])];
  if(!labCoupledRecordedPrecipitates(inventory,volumeMl/1000,verified))
   labReequilibrateRecordedPrecipitates(inventory,volumeMl/1000);
 }
 return remember(key,inventory);
}
export function labInventorySnapshot(inventory:LabInventory):LabChemicalSnapshot{
 return {speciesMol:{...inventory.speciesMol},solidMol:{...inventory.solidMol},
  retainedGasMol:{...inventory.retainedGasMol},
  releasedGasMol:{...inventory.releasedGasMol},
  equilibriumEquations:[...new Set([...inventory.equilibriumEquations,
   ...inventory.steps.filter(step=>step.equation.includes("↓")).
    map(step=>step.equation)])].slice(-8)};
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
