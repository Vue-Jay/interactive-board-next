/** Reference material constants for the school laboratory.
 * Density is CRYSTAL true density in g/cm³ at ~20–25°C, NOT bulk/packing
 * density, and is valid only for the indicated chemical formula/hydration.
 * Values with uncertain hydrated phases must not be guessed.
 *
 * Sources:
 * NaCl crystal and saturated mass fractions: EN 14805:2022 §4.3 (CEN)
 *   https://standards.iteh.ai/catalog/standards/sist/15e8dc0b-cb2d-4139-b47a-b7e4cd02ad7c/sist-en-14805-2022
 * AgCl/AgBr/AgNO3: Environment and Climate Change Canada, Silver Group:
 *   https://www.canada.ca/en/environment-climate-change/services/evaluating-existing-substances/draft-screening-assessment-silver-compounds.html
 * KCl, KNO3, NaNO3, NaHCO3, KBr: US NIH PubChem experimental density
 *   https://pubchem.ncbi.nlm.nih.gov/compound/Potassium-chloride
 *   https://pubchem.ncbi.nlm.nih.gov/compound/Potassium-nitrate
 *   https://pubchem.ncbi.nlm.nih.gov/compound/Sodium-nitrate
 *   https://pubchem.ncbi.nlm.nih.gov/compound/Sodium-bicarbonate
 *   https://pubchem.ncbi.nlm.nih.gov/compound/Potassium-Bromide
 * CuSO4 ANHYDROUS, not CuSO4·5H2O: ILO-WHO ICSC 0751
 *   https://www.inchem.org/documents/icsc/icsc/eics0751.htm
 * BaSO4: ILO-WHO ICSC / CRC through PubChem
 *   https://pubchem.ncbi.nlm.nih.gov/compound/Barium-sulfate
 */
export const LAB_CRYSTAL_DENSITY_G_ML:Readonly<Record<string,number>>={
 NaCl:2.16,KCl:1.984,KNO3:2.109,NaNO3:2.261,NaHCO3:2.20,
 KBr:2.75,CuSO4:3.6,AgNO3:4.35,
 AgCl:5.56,AgBr:6.47,BaSO4:4.50,
 CaCO3:2.71,AgI:5.68,PbI2:6.16
};
export const labCrystalDensityGml=(formula:string):number|undefined=>
 LAB_CRYSTAL_DENSITY_G_ML[formula];

/** EN 14805:2022 §4.3.3 gives saturated NaCl MASS fraction, not grams
 * per 100g solvent. Convert explicitly to avoid 25–30% mass errors.
 * No other ions are allowed in this binary water/NaCl equilibrium model. */
export const LAB_NACL_SATURATION_MASS_FRACTION=[
 {temperatureC:0,massFraction:.2634},
 {temperatureC:20,massFraction:.2643},
 {temperatureC:40,massFraction:.2671},
 {temperatureC:60,massFraction:.2709},
 {temperatureC:80,massFraction:.2753},
 {temperatureC:100,massFraction:.2812}
] as const;
export function labNaClSolubilityGPer100gWater(tempC:number):number|undefined{
 if(!Number.isFinite(tempC)||tempC<0||tempC>100)return;
 const pts=LAB_NACL_SATURATION_MASS_FRACTION;
 let w:number=pts[pts.length-1].massFraction;
 for(let i=1;i<pts.length;i++){
  if(tempC<=pts[i].temperatureC){
   const a=pts[i-1],b=pts[i];
   w=a.massFraction+(b.massFraction-a.massFraction)*
    (tempC-a.temperatureC)/(b.temperatureC-a.temperatureC);
   break;
  }
 }
 return 100*w/(1-w);
}
/** Only binary NaCl + explicitly present pure H2O can be crystallised
 * using these data. All original molecules remain in speciesMol; solidMol
 * records only the portion in the separate crystalline phase.
 * Returns whether the phase calculation is supported. */
export function labEquilibrateNaClCrystals(
 inventory:{speciesMol:Record<string,number>;solidMol:Record<string,number>},
 temperatureC:number,hasPureWaterStock:boolean
):boolean{
 if(!hasPureWaterStock)return false;
 const keys=Object.entries(inventory.speciesMol).filter(([,n])=>n>1e-12)
  .map(([id])=>id);
 if(keys.some(id=>id!=="NaCl"&&id!=="H2O"))return false;
 const saltMol=inventory.speciesMol.NaCl??0;
 if(saltMol<=0)return false;
 const dissolvedCapacity=labNaClSolubilityGPer100gWater(temperatureC);
 if(dissolvedCapacity===undefined)return false;
 const waterMol=inventory.speciesMol.H2O??0;
 const waterMassG=waterMol*18.01528;
 const saltCapacityMol=waterMassG*dissolvedCapacity/100/58.44277;
 const crystalMol=Math.max(0,saltMol-Math.max(0,saltCapacityMol));
 if(crystalMol>1e-12)inventory.solidMol.NaCl=crystalMol;
 else delete inventory.solidMol.NaCl;
 return true;
}
