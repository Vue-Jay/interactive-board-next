/** Conserved solid/dissolved fraction for a measured single salt + pure water.
 * Equilibrium: curated binary solubility tables in lektrusLabMaterialConstants.
 * Time-dependent approach: explicitly EDUCATIONAL first-order mass transfer.
 * Real rates also depend on crystal surface, hydrodynamics and grain sizes:
 * rate coefficients below must not be presented as measured material data.
 */
import {labSchoolSolubilityGPer100gWater} from "./lektrusLabMaterialConstants";
import {labMolarMass} from "./lektrusLabStoichiometry";
type Dose={value:number;unit:"g"|"ml";concentrationM?:number};
export type LabBinarySaltState={formula:string;solidMol:number};
export type LabBinarySaltInput={
 reagents:readonly string[];environment:string;doses?:Record<string,Dose>;
 uncertain?:boolean;chemicalInventory?:unknown;completedReaction?:unknown;
 reactionAmounts?:unknown;filteredSolution?:unknown;filteredResidue?:unknown;
};
export function labBinarySaltEquilibrium(v:LabBinarySaltInput,tempC:number){
 if(v.environment!=="aqueous"||v.uncertain||v.chemicalInventory||
  v.completedReaction||v.reactionAmounts||v.filteredSolution||v.filteredResidue||
  !v.doses||!Number.isFinite(tempC))return;
 const water=v.doses.H2O;
 const parts=Object.entries(v.doses).filter(([,d])=>d.value>0);
 if(!water||water.unit!=="ml"||water.concentrationM!==undefined||
  !Number.isFinite(water.value)||water.value<=0||parts.length!==2)return;
 const other=parts.find(([id])=>id!=="H2O");
 if(!other)return;
 const [formula,dose]=other;
 if(dose.unit!=="g"||dose.concentrationM!==undefined||
  !Number.isFinite(dose.value)||dose.value<=0||
  !v.reagents.includes(formula)||v.reagents.some(id=>id!=="H2O"&&id!==formula))return;
 const solubility=labSchoolSolubilityGPer100gWater(formula,tempC)?.value;
 const molarMass=labMolarMass(formula);
 if(solubility===undefined||molarMass===undefined||molarMass<=0)return;
 const totalMol=dose.value/molarMass;
 const maxDissolvedMol=water.value*.997*solubility/100/molarMass;
 return {formula,molarMass,totalMol,waterMl:water.value,
  equilibriumSolidMol:Math.max(0,totalMol-maxDissolvedMol)};
}
export function labAdvanceBinarySaltPhase(
 v:LabBinarySaltInput,tempC:number,seconds:number,stirring:boolean,
 previous?:LabBinarySaltState,startingDry=false
){
 const eq=labBinarySaltEquilibrium(v,tempC);
 if(!eq)return;
 const {formula,totalMol,equilibriumSolidMol}=eq;
 const old=previous?.formula===formula?
  Math.max(0,Math.min(totalMol,previous.solidMol)):
  startingDry?totalMol:equilibriumSolidMol;
 const dt=Math.max(0,Math.min(10,seconds));
 // Area/flow coefficients chosen for an interactive classroom experiment.
 const temperatureFactor=Math.max(.5,Math.min(2.5,Math.exp((tempC-22)/95)));
 const rate=(stirring?.16:.055)*temperatureFactor;
 const solidMol=Math.max(0,Math.min(totalMol,equilibriumSolidMol+
  (old-equilibriumSolidMol)*Math.exp(-dt*rate)));
 const active=Math.abs(solidMol-equilibriumSolidMol)>
  Math.max(1e-10,totalMol*.0005);
 return {state:{formula,solidMol},totalMol,equilibriumSolidMol,active,
  direction:solidMol<old?"dissolving":solidMol>old?"crystallizing":"stable"};
}
export function labVisibleBinarySaltSolid(
 v:LabBinarySaltInput,phase:LabBinarySaltState|undefined,tempC:number
){
 const eq=labBinarySaltEquilibrium(v,tempC);
 if(!eq||phase?.formula!==eq.formula||!Number.isFinite(phase.solidMol)||
   phase.solidMol<0||phase.solidMol>eq.totalMol+1e-7)return;
 return {formula:eq.formula,solidMol:Math.min(eq.totalMol,phase.solidMol),
  totalMol:eq.totalMol,equilibriumSolidMol:eq.equilibriumSolidMol};
}

/** School approximation for TWO OR MORE weighed salts in measured pure
 * water. Each salt's binary-water saturation capacity is calculated from
 * the SAME finite solvent mass. There is no false global solubility number
 * for the mixture, and no material is destroyed. A BOUNDED classroom
 * common-ion trend applies only to explicitly listed 1:1 electrolyte
 * formulas. This is not a measured multicomponent activity model.
 * Hydrates and mixed double salts are not solved.
 *
 * This must NOT run on prepared stocks, inherited reaction inventories,
 * gas-producing reactions, precipitates from balanced reactions, or a
 * mixture with an unsupported solid. It returns separate target solid
 * fractions, distinctly labelled as classroom estimates.
 */
/** Formulas with unambiguous 1:1 ionic dissociation. These are the only
 * school mixtures where a common-ion correction is justified here.
 * For concentrated salts, ionic activity prevents a naive Ksp product:
 * the bounded 35% decrease is a VISUAL TEACHING approximation, never a
 * claimed thermodynamic prediction or a replacement for source curves. */
const classroomSimpleIons:Readonly<Record<string,readonly [string,string]>>={
 NaCl:["Na+","Cl-"],KCl:["K+","Cl-"],LiCl:["Li+","Cl-"],
 NaBr:["Na+","Br-"],KBr:["K+","Br-"],
 NaNO3:["Na+","NO3-"],KNO3:["K+","NO3-"],LiNO3:["Li+","NO3-"],
 NaNO2:["Na+","NO2-"],KNO2:["K+","NO2-"],
 KI:["K+","I-"]
};
export function labSchoolMixedSaltEquilibrium(v:LabBinarySaltInput,tempC:number){
 if(v.environment!=="aqueous"||v.uncertain||v.chemicalInventory||
  v.completedReaction||v.reactionAmounts||v.filteredSolution||
  v.filteredResidue||!v.doses||!Number.isFinite(tempC))return;
 const measured=Object.entries(v.doses).filter(([,d])=>d.value>0);
 const water=v.doses.H2O;
 if(!water||water.unit!=="ml"||water.concentrationM!==undefined||
  !Number.isFinite(water.value)||water.value<=0)return;
 const salts=measured.filter(([id])=>id!=="H2O");
 if(salts.length<2||measured.length!==salts.length+1)return;
 const waterMassG=water.value*.997;
 const solids:Record<string,number>={};
 const capacities:Record<string,number>={};
 const totals:Record<string,number>={};
 for(const [id,dose] of salts){
  if(dose.unit!=="g"||dose.concentrationM!==undefined||
   !Number.isFinite(dose.value)||dose.value<=0||
   !v.reagents.includes(id))return;
  const sol=labSchoolSolubilityGPer100gWater(id,tempC);
  const mass=labMolarMass(id);
  if(!sol||!Number.isFinite(sol.value)||!mass||mass<=0)return;
  totals[id]=dose.value/mass;
  capacities[id]=Math.max(0,waterMassG*sol.value/100/mass);
 }
 // Simultaneously update solute fractions from the previous iteration,
 // so object order cannot alter the predicted phase partition.
 const formulas=salts.map(([id])=>id);
 let dissolved=Object.fromEntries(formulas.map(id=>
  [id,Math.min(totals[id],capacities[id])]));
 for(let iteration=0;iteration<10;iteration++){
  const next:Record<string,number>={};
  for(const id of formulas){
   const ions=classroomSimpleIons[id];
   const shared=ions?formulas.reduce((mol,other)=>{
    if(other===id)return mol;
    const otherIons=classroomSimpleIons[other];
    return mol+(otherIons&&ions.some(ion=>otherIons.includes(ion))?
     dissolved[other]:0);
   },0):0;
   const reduction=ions&&shared>0?
    1-.35*shared/(Math.max(1e-12,capacities[id])+shared):1;
   next[id]=Math.min(totals[id],capacities[id]*reduction);
  }
  dissolved=next;
 }
 for(const id of formulas){
  const solidMol=Math.max(0,totals[id]-dissolved[id]);
  if(solidMol>1e-12)solids[id]=solidMol;
 }
 return {solidMol:solids,waterMl:water.value,estimated:true as const,
  formulas};
}
/** Smooth first-order transport for EACH salt. Incoming dry mass remains
 * crystalline initially; shaking/stirring accelerates the approach.
 * A cooling/evaporating saturated mixture can also grow new crystals.
 * n_total is invariant: only solidMol changes, never speciesMol. */
export function labAdvanceSchoolMixedSaltPhase(
 v:LabBinarySaltInput,tempC:number,seconds:number,stirring:boolean,
 previous?:Record<string,number>,startingDry=false
){
 const eq=labSchoolMixedSaltEquilibrium(v,tempC);
 if(!eq||!v.doses)return;
 const totals=Object.fromEntries(eq.formulas.map(id=>
  [id,v.doses![id].value/(labMolarMass(id)??Infinity)]));
 const old=Object.fromEntries(eq.formulas.map(id=>
  [id,Math.max(0,Math.min(totals[id],previous?.[id]??
   (startingDry?totals[id]:eq.solidMol[id]??0)))]));
 const dt=Math.max(0,Math.min(10,seconds));
 const temperatureFactor=Math.max(.5,Math.min(2.5,Math.exp((tempC-22)/95)));
 const rate=(stirring?.16:.055)*temperatureFactor;
 const solidMol:Record<string,number>={};
 let direction:"dissolving"|"crystallizing"|"stable"="stable";
 let active=false;
 for(const id of eq.formulas){
  const goal=eq.solidMol[id]??0;
  const next=Math.max(0,Math.min(totals[id],
   goal+(old[id]-goal)*Math.exp(-dt*rate)));
  solidMol[id]=next;
  if(Math.abs(next-goal)>Math.max(1e-10,totals[id]*.0005))active=true;
  if(next<old[id]-1e-10)direction="dissolving";
  else if(next>old[id]+1e-10&&direction==="stable")direction="crystallizing";
 }
 return {state:solidMol,totalMol:totals,equilibriumSolidMol:eq.solidMol,
  active,direction,estimated:true as const};
}
