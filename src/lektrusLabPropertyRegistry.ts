/** Unified PHYSICAL PROPERTY VIEW for cabinet reagents and every verified
 * reaction product, including compounds not offered as stock reagents.
 *
 * Existence/name/formula and molar mass are not proof of heat capacity,
 * a particular hydrate, equilibrium solubility, or a boiling point.
 * Only separately curated measurements may be used as simulation constants.
 * No property is inferred from an unrelated ionic compound or formula class.
 */
import {substances,reviewedReactionCases} from "./lektrusReactionDatabase";
import {labMolarMass,parseBalancedLabEquation} from "./lektrusLabStoichiometry";
import {LAB_CRYSTAL_DENSITY_G_ML,labSingleSaltSolubilityGPer100gWater} from "./lektrusLabMaterialConstants";
import {LAB_GAS_FORMULAS,labThermalInfo} from "./lektrusLabPhysicalProperties";
import {LAB_CALORIMETRY_REFERENCE} from "./lektrusLabCalorimetry";
import {labIsTypicallyWaterSoluble} from "./lektrusLabReactionNetwork";
import {labHydrateNearestMeasuredReferences,labHydrateCrystalDensityReferences} from "./lektrusLabHydrateReferences";
import {labSaturatedSolutionReferences} from "./lektrusLabSaturatedSolutionReferences";
type Phase="gas"|"precipitate"|"other";
export type LabProductIdentity={
 formula:string;name:string;coeff:number;reactionPhase:Phase;
};
const registry=new Map(substances.map(s=>[s.id,s]));
const reviewedProducts=new Map<string,LabProductIdentity>();
for(const reaction of reviewedReactionCases){
 if(reaction.status!=="reaction")continue;
 const balanced=parseBalancedLabEquation(reaction.equation);
 if(!balanced)continue;
 const rhs=(reaction.equation.split("→")[1]??"").split(/\s+\+\s+/);
 for(const term of balanced.products){
  const raw=rhs.find(t=>t.replace(/^\s*\d+\s*/,"").
   replace(/[↑↓]/g,"").trim()===term.formula)??"";
  reviewedProducts.set(term.formula,{
   formula:term.formula,name:registry.get(term.formula)?.name??term.formula,
   coeff:term.coefficient,
   reactionPhase:raw.includes("↑")?"gas":
    raw.includes("↓")?"precipitate":"other"
  });
 }
}
/** Every RHS formula remains accessible, even when no cabinet stock exists. */
export const LAB_REVIEWED_PRODUCT_IDENTITIES:ReadonlyMap<string,LabProductIdentity>=reviewedProducts;
export function labProductIdentities(equation:string):LabProductIdentity[]{
 const balanced=parseBalancedLabEquation(equation);
 if(!balanced)return [];
 const rhs=(equation.split("→")[1]??"").split(/\s+\+\s+/);
 return balanced.products.map(term=>{
  const raw=rhs.find(t=>t.replace(/^\s*\d+\s*/,"").
   replace(/[↑↓]/g,"").trim()===term.formula)??"";
  return {formula:term.formula,
   name:registry.get(term.formula)?.name??term.formula,
   coeff:term.coefficient,
   reactionPhase:raw.includes("↑")?"gas":
    raw.includes("↓")?"precipitate":"other"};
 });
}
export function labSubstanceProperties(formula:string,temperatureC=22){
 const stock=registry.get(formula);
 const molarMassGPerMol=labMolarMass(formula);
 const crystalDensityGPerMl=LAB_CRYSTAL_DENSITY_G_ML[formula];
 const liquid=LAB_CALORIMETRY_REFERENCE[formula];
 const neatLiquid=liquid?.phase==="liquid"?liquid:undefined;
 // Only verified neat liquid density, not an arbitrary 0.1 M stock.
 const liquidDensityGPerMl=neatLiquid?.densityGPerMl;
 const specificHeatJPerGK=liquid?.specificJPerGK;
 const thermal=labThermalInfo(formula,stock?.kind==="газ"||LAB_GAS_FORMULAS.has(formula)?"ml":"g");
 const solubilityGPer100gWater=
  labSingleSaltSolubilityGPer100gWater(formula,temperatureC);
 // These are distinct formulae with waters of crystallization and remain
 // REFERENCE-ONLY. Their mass values never enter anhydrous Ksp or dosing.
 const hydratedSolubilityReferences=
  labHydrateNearestMeasuredReferences(formula,temperatureC);
 const hydratedCrystalDensityReferences=labHydrateCrystalDensityReferences(formula);
 // This is an independently measured SATURATED mixture only. Prepared
 // stocks (0.1 mol/L) never borrow a saturated solution's mass density.
 const saturatedSolutionReferences=labSaturatedSolutionReferences(formula);
 return {formula,name:stock?.name??formula,stockKind:stock?.kind,
  inCabinet:!!stock,
  knownProduct:reviewedProducts.has(formula),
  molarMassGPerMol,
  crystalDensityGPerMl,
  liquidDensityGPerMl,
  specificHeatJPerGK,
  meltingC:thermal.known?thermal.meltingC:undefined,
  boilingC:thermal.known?thermal.boilingC:undefined,
  decompositionC:thermal.known?thermal.decompositionC:undefined,
  sublimationC:thermal.known?thermal.sublimationC:undefined,
  physicalForm:thermal.form,
  solubilityGPer100gWater,
  hydratedSolubilityReferences,
  hydratedCrystalDensityReferences,
  saturatedSolutionReferences,
  /** An absent value is genuinely missing, not a predicted constant. */
  densityKnown:crystalDensityGPerMl!==undefined||
   liquidDensityGPerMl!==undefined,
  thermalKnown:thermal.known,
  solubilityKnown:solubilityGPer100gWater!==undefined,
  /** Qualitative classroom rule, NOT proof of complete dissolution at
   * arbitrary masses or a numerical solubility. */
  typicallySolubleInDiluteWater:labIsTypicallyWaterSoluble(formula)
 };
}
