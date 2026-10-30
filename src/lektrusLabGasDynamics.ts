/** Measured gas output of a REVIEWED balanced reaction.
 * Moles are computed from the persistent stoichiometric extent, never
 * independently guessed for animation, headspace, or readouts.
 * Rate is an educational interpolation between the vetted reactants'
 * measured initial quantities and the already-existing reaction duration.
 * PV=nRT uses the ideal-gas approximation; gas solubility, foam stability,
 * surface area and gas escape kinetics are not quantified without data.
 */
import {parseBalancedLabEquation,type LabReactionAmounts} from "./lektrusLabStoichiometry";
export type LabGasProgress={
 producedMol:Record<string,number>;
 totalMol:number;
 completeYieldMol:number;
 rateMolPerSecond:number;
 /** Ideal gas volume at specified external temperature and pressure. */
 volumeMl:number;
};
const GAS_CONSTANT_J_MOL_K=8.314462618;
export function labIdealGasVolumeMl(mol:number,tempC:number,pressureKPa=101.325){
 if(!Number.isFinite(mol)||mol<0||!Number.isFinite(tempC)||
    tempC<=-273.15||!Number.isFinite(pressureKPa)||pressureKPa<=0)return;
 return mol*GAS_CONSTANT_J_MOL_K*(tempC+273.15)/pressureKPa*1000;
}
export function labReactionGasProgress(
 amounts:LabReactionAmounts|undefined,
 tempC=25,pressureKPa=101.325
):LabGasProgress|undefined{
 if(!amounts||!Number.isFinite(amounts.extentMol)||
   !Number.isFinite(amounts.maxExtentMol)||amounts.extentMol<0||
   amounts.maxExtentMol<=0||amounts.extentMol>amounts.maxExtentMol+1e-9||
   !Number.isFinite(amounts.durationSeconds)||amounts.durationSeconds<=0)return;
 const balanced=parseBalancedLabEquation(amounts.equation);
 if(!balanced)return;
 const rhs=amounts.equation.split("→")[1]??"";
 const gasProducts=new Set(rhs.split(/\s*\+\s*/).filter(t=>t.includes("↑"))
  .map(t=>t.replace(/^\s*\d+\s*/,"").replace(/[↑↓]/g,"").trim()));
 if(!gasProducts.size)return;
 const producedMol:Record<string,number>={};
 let totalMol=0,completeYieldMol=0;
 for(const term of balanced.products){
  if(!gasProducts.has(term.formula))continue;
  // Read the measured extent directly, not the final chemical inventory,
  // which may already contain products from another completed reaction.
  const amount=amounts.extentMol*term.coefficient;
  if(amount<0||!Number.isFinite(amount))return;
  producedMol[term.formula]=amount;
  totalMol+=amount;
  completeYieldMol+=amounts.maxExtentMol*term.coefficient;
 }
 const volumeMl=labIdealGasVolumeMl(totalMol,tempC,pressureKPa);
 if(volumeMl===undefined)return;
 return {producedMol,totalMol,completeYieldMol,volumeMl,
  rateMolPerSecond:amounts.complete?0:
   completeYieldMol/amounts.durationSeconds};
}
