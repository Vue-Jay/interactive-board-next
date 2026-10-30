/** Reference material constants for the school laboratory.
 * Density is CRYSTAL true density in g/cm³ at ~20–25°C, NOT bulk/packing
 * density, and is valid only for the indicated chemical formula/hydration.
 * Values with uncertain hydrated phases must not be guessed.
 *
 * Sources:
 * NaCl crystal and saturated mass fractions: EN 14805:2022 §4.3 (CEN)
 *   https://standards.iteh.ai/catalog/standards/sist/15e8dc0b-cb2d-4139-b47a-b7e4cd02ad7c/sist-en-14805-2022
 * 100–125°C brine: Potter, Babcock & Brown (1977), U.S. Geological Survey,
 * measured fit for saturated NaCl:
 *   https://pubs.usgs.gov/publication/70233561
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
 * AgI, PbI2: NIH PubChem experimental crystal densities
 *   https://pubchem.ncbi.nlm.nih.gov/compound/Silver-iodide
 *   https://pubchem.ncbi.nlm.nih.gov/compound/Lead-iodide
 * CaCO3: NIST SRM 915c calcite phase density 2.71 (NOT aragonite)
 *   https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.260-223.pdf
 */
export const LAB_CRYSTAL_DENSITY_G_ML:Readonly<Record<string,number>>={
 NaCl:2.16,KCl:1.984,KNO3:2.109,NaNO3:2.261,NaHCO3:2.20,
 KBr:2.75,CuSO4:3.6,AgNO3:4.35,
 AgCl:5.56,AgBr:6.47,BaSO4:4.50,
 CaCO3:2.71,AgI:5.67,PbI2:6.16
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
 if(!Number.isFinite(tempC)||tempC<0||tempC>125)return;
 if(tempC>100){
  // USGS 1977 mass-% regression (NaCl–H2O at liquid-vapor equilibrium).
  // This empirical fit was checked against elevated-temperature data,
  // unlike an invented linear extrapolation from 20–100°C.
  const weightPercent=26.218+.0072*tempC+.000106*tempC**2;
  const fraction=weightPercent/100;
  return 100*fraction/(1-fraction);
 }
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
/** Single-salt binary water saturation, grams of ANHYDROUS solute / 100 g
 * of pure water. These are measured/reference tabulations for 0–100°C, not
 * precipitation reaction Ksp values or constants for ionic mixtures.
 * KNO3: Australian Council for Educational Research chemistry test bank
 *   https://files.eric.ed.gov/fulltext/ED224819.pdf (p. 96)
 * KCl and NaNO3: Merck/Millipore water solubility compilation
 *   https://www.merckmillipore.com/KE/en/support/calculators-and-apps/solubility-table-compounds-water-temperature
 * KCl, NaNO3: independent reference tabulation
 *   https://tools.moldchem.com/solubility
 * No extrapolation above 100°C, and no hydration assumptions.
 */
export const LAB_SALT_BINARY_SOLUBILITY_G_PER_100G_WATER:Readonly<
 Record<string,readonly number[]>>=Object.freeze({
 KNO3:[13.3,31.6,63.9,110,169,246],
 KCl:[28,34,40,45.5,51.1,56.7],
 NaNO3:[73,88,104,124,148,180]
});
export const LAB_SALT_SOLUBILITY_TEMPERATURES_C=[0,20,40,60,80,100] as const;
export function labSingleSaltSolubilityGPer100gWater(
 formula:string,tempC:number):number|undefined{
 if(formula==="NaCl")return labNaClSolubilityGPer100gWater(tempC);
 const data=LAB_SALT_BINARY_SOLUBILITY_G_PER_100G_WATER[formula];
 if(!data||!Number.isFinite(tempC)||tempC<0||tempC>100)return;
 if(tempC===100)return data[data.length-1];
 for(let i=1;i<LAB_SALT_SOLUBILITY_TEMPERATURES_C.length;i++){
  const low=LAB_SALT_SOLUBILITY_TEMPERATURES_C[i-1];
  const high=LAB_SALT_SOLUBILITY_TEMPERATURES_C[i];
  if(tempC<=high)return data[i-1]+(data[i]-data[i-1])*(tempC-low)/(high-low);
 }
}
/** Phase fractions for EXACTLY one supported anhydrous crystalline salt
 * and pure explicitly measured H2O. Aqueous mixed salts, prepared stocks
 * with unspecified solvent, and hydrates require a different equilibrium
 * system. Total salt molecule count is never changed by crystallisation. */
export function labEquilibrateSingleSaltCrystals(
 inventory:{speciesMol:Record<string,number>;solidMol:Record<string,number>},
 temperatureC:number,hasPureWaterStock:boolean
):string|undefined{
 if(!hasPureWaterStock)return;
 const keys=Object.entries(inventory.speciesMol).filter(([,n])=>n>1e-12)
  .map(([id])=>id);
 const nonWater=keys.filter(id=>id!=="H2O");
 if(nonWater.length!==1||keys.some(id=>id!=="H2O"&&id!==nonWater[0]))return;
 const salt=nonWater[0],mol=inventory.speciesMol[salt];
 const solubility=labSingleSaltSolubilityGPer100gWater(salt,temperatureC);
 if(solubility===undefined)return;
 const waterMass=(inventory.speciesMol.H2O??0)*18.01528;
 const molarMass:Record<string,number>={
  NaCl:58.44277,KNO3:101.1032,KCl:74.5513,NaNO3:84.9947
 };
 const capacityMol=waterMass*solubility/100/molarMass[salt];
 const crystals=Math.max(0,mol-Math.max(0,capacityMol));
 if(crystals>1e-12)inventory.solidMol[salt]=crystals;
 else delete inventory.solidMol[salt];
 return salt;
}

/** Only binary NaCl + explicitly present pure H2O can be crystallised
 * using these data. All original molecules remain in speciesMol; solidMol
 * records only the portion in the separate crystalline phase.
 * Returns whether the phase calculation is supported. */
export function labEquilibrateNaClCrystals(
 inventory:{speciesMol:Record<string,number>;solidMol:Record<string,number>},
 temperatureC:number,hasPureWaterStock:boolean
):boolean{
 return labEquilibrateSingleSaltCrystals(inventory,
  temperatureC,hasPureWaterStock)==="NaCl";
}
