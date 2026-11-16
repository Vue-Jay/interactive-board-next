/** Conserved solid/dissolved fraction for a measured single salt + pure water.
 * Equilibrium: curated binary solubility tables in lektrusLabMaterialConstants.
 * Time-dependent approach: explicitly EDUCATIONAL first-order mass transfer.
 * Real rates also depend on crystal surface, hydrodynamics and grain sizes:
 * rate coefficients below must not be presented as measured material data.
 */
import {labSchoolSolubilityGPer100gWater} from "./lektrusLabMaterialConstants";
import {labIsGasDose,labMolarMass} from "./lektrusLabStoichiometry";
type Dose={value:number;unit:"g"|"ml";concentrationM?:number;phase?:"gas"};
export type LabBinarySaltState={formula:string;solidMol:number};
export type LabBinarySaltInput={
 reagents:readonly string[];environment:string;doses?:Record<string,Dose>;
 uncertain?:boolean;chemicalInventory?:{speciesMol:Record<string,number>;solidMol:Record<string,number>;settled?:boolean};completedReaction?:unknown;
 reactionAmounts?:unknown;filteredSolution?:{sourceEquation:string;volumeMl?:number};filteredResidue?:unknown;
};
/** One salt in a measured aqueous stock carrier. Use the same clearly
 * illustrative water-volume approximation as the other classroom models;
 * the molecular ledger, unlike the carrier estimate, stays exact. */
export function labMeasuredStockSaltEquilibrium(v:LabBinarySaltInput,tempC:number){
 if(!["aqueous","dry"].includes(v.environment)||!v.chemicalInventory||
  v.filteredSolution&&v.filteredSolution.sourceEquation!==""||v.uncertain||v.completedReaction||v.reactionAmounts||v.filteredResidue)return;
 const solutes=Object.entries(v.chemicalInventory.speciesMol).filter(([id,mol])=>id!=="H2O"&&mol>1e-12);
 if(solutes.length!==1)return;
 const [formula,totalMol]=solutes[0];
 const parts=Object.entries(v.doses??{});
 if(parts.some(([id,d])=>id!==formula&&id!=="H2O"||labIsGasDose(id,d)||
  d.unit==="ml"&&id!=="H2O"&&d.concentrationM===undefined))return;
 const waterMl=(v.filteredSolution?.volumeMl??0)+parts.reduce((sum,[,d])=>sum+(d.unit==="ml"?d.value:0),0);
 if(!v.filteredSolution&&!v.doses?.H2O&&v.environment!=="dry")return;
 if(v.environment==="dry"&&waterMl>1e-9)return;
 const solubility=labSchoolSolubilityGPer100gWater(formula,tempC)?.value;
 const molarMass=labMolarMass(formula);
 if(waterMl<0||solubility===undefined||!molarMass||!Number.isFinite(totalMol))return;
 return {formula,molarMass,totalMol,waterMl,
  equilibriumSolidMol:Math.max(0,totalMol-waterMl*.997*solubility/100/molarMass)};
}
export function labBinarySaltEquilibrium(v:LabBinarySaltInput,tempC:number){
 if(v.chemicalInventory?.settled)return labMeasuredStockSaltEquilibrium(v,tempC);
 if(v.environment!=="aqueous"||v.uncertain||v.chemicalInventory||
  v.completedReaction||v.reactionAmounts||v.filteredSolution||v.filteredResidue||
  !v.doses||!Number.isFinite(tempC))return;
 const water=v.doses.H2O;
 const parts=Object.entries(v.doses).filter(([,d])=>d.value>0);
 if(!water||water.unit!=="ml"||labIsGasDose("H2O",water)||water.concentrationM!==undefined||
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
 if(eq.waterMl<=1e-9)return {state:{formula,solidMol:totalMol},totalMol,equilibriumSolidMol,
  active:false,direction:"stable"};
 const old=previous?.formula===formula?
  Math.max(0,Math.min(totalMol,previous.solidMol)):
  startingDry?totalMol:equilibriumSolidMol;
 const dt=Math.max(0,Math.min(10,seconds));
 // Area/flow coefficients chosen for an interactive classroom experiment.
 const temperatureFactor=Math.max(.5,Math.min(2.5,Math.exp((tempC-22)/95)));
 const rate=(stirring?.16:.055)*temperatureFactor;
 const approaching=Math.max(0,Math.min(totalMol,equilibriumSolidMol+
  (old-equilibriumSolidMol)*Math.exp(-dt*rate)));
 const active=Math.abs(approaching-equilibriumSolidMol)>
  Math.max(1e-10,totalMol*.0005);
 const solidMol=active?approaching:equilibriumSolidMol;
 return {state:{formula,solidMol},totalMol,equilibriumSolidMol,active,
  direction:solidMol<old?"dissolving":solidMol>old?"crystallizing":"stable"};
}
export function labVisibleBinarySaltSolid(
 v:LabBinarySaltInput,phase:LabBinarySaltState|undefined,tempC:number
){
 const eq=labBinarySaltEquilibrium(v,tempC);
 if(!eq||phase?.formula!==eq.formula||!Number.isFinite(phase.solidMol)||
   phase.solidMol<0||phase.solidMol>eq.totalMol+1e-7)return;
 return {formula:eq.formula,solidMol:eq.waterMl<=1e-9?eq.totalMol:Math.min(eq.totalMol,phase.solidMol),
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
 if(v.environment!=="aqueous"||v.uncertain||v.completedReaction||v.reactionAmounts||
  v.filteredResidue||!Number.isFinite(tempC))return;
 // Sampling a previously nonreacting weighed mixture creates a molecular
 // snapshot. Its remaining dissolved and solid moles must still approach
 // the same classroom equilibrium, rather than freezing the phase in time.
 const snapshot=v.chemicalInventory?.settled?v.chemicalInventory:undefined;
 if(v.chemicalInventory&&!snapshot||v.filteredSolution)return;
 const measured=Object.entries(v.doses??{}).filter(([,d])=>d.value>0);
 const water=v.doses?.H2O;
 if(!water||water.unit!=="ml"||labIsGasDose("H2O",water)||water.concentrationM!==undefined||
  !Number.isFinite(water.value)||water.value<=0)return;
 if(measured.some(([id,d])=>id!=="H2O"&&(d.unit!=="g"||d.concentrationM!==undefined)))return;
 const salts=snapshot?Object.entries(snapshot.speciesMol).filter(([id,n])=>id!=="H2O"&&n>1e-12):
  measured.filter(([id])=>id!=="H2O").map(([id,d])=>[id,d.value/(labMolarMass(id)??Infinity)] as const);
 if(salts.length<2)return;
 const waterMassG=water.value*.997;
 const solids:Record<string,number>={};
 const capacities:Record<string,number>={};
 const totals:Record<string,number>={};
 for(const [id,total] of salts){
  if(!Number.isFinite(total)||total<=0||
   !v.reagents.includes(id))return;
  const sol=labSchoolSolubilityGPer100gWater(id,tempC);
  const mass=labMolarMass(id);
  if(!sol||!Number.isFinite(sol.value)||!mass||mass<=0)return;
  totals[id]=total;
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
  formulas,totals};
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
 if(!eq)return;
 const totals=eq.totals;
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
  const approaching=Math.max(0,Math.min(totals[id],
   goal+(old[id]-goal)*Math.exp(-dt*rate)));
  const changing=Math.abs(approaching-goal)>Math.max(1e-10,totals[id]*.0005);
  const next=changing?approaching:goal;
  solidMol[id]=next;
  if(changing)active=true;
  if(next<old[id]-1e-10)direction="dissolving";
  else if(next>old[id]+1e-10&&direction==="stable")direction="crystallizing";
 }
 return {state:solidMol,totalMol:totals,equilibriumSolidMol:eq.solidMol,
  active,direction,estimated:true as const};
}
