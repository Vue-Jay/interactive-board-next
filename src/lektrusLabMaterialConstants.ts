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
 CaCO3:2.71,AgI:5.67,PbI2:6.16,
 // Additional individually verified ANHYDROUS solid/crystal densities at
 // 20-25 °C (g/cm³). Not loose powder density, and NOT hydrated salts.
 // Each compound has an independent PubChem experimental entry:
 // Na2CO3 https://pubchem.ncbi.nlm.nih.gov/compound/10340
 // CaO https://pubchem.ncbi.nlm.nih.gov/compound/14778
 // MgO https://pubchem.ncbi.nlm.nih.gov/compound/14792
 // MgCO3 https://pubchem.ncbi.nlm.nih.gov/compound/11029 (magnesite)
 // CaSO4 https://pubchem.ncbi.nlm.nih.gov/compound/24497 (anhydrite)
 // BaCO3 https://pubchem.ncbi.nlm.nih.gov/compound/10563 (witherite)
 // PbCl2 https://pubchem.ncbi.nlm.nih.gov/compound/24459
 // PbBr2 https://pubchem.ncbi.nlm.nih.gov/compound/24458
 // Cu(OH)2 https://pubchem.ncbi.nlm.nih.gov/compound/164826
 // Al(OH)3 https://pubchem.ncbi.nlm.nih.gov/compound/10176082
 // ZnO https://pubchem.ncbi.nlm.nih.gov/compound/3007857
 Na2CO3:2.54,CaO:3.34,MgO:3.58,MgCO3:3.05,
 CaSO4:2.96,BaCO3:4.275,PbCl2:5.85,PbBr2:6.66,
 "Cu(OH)2":3.37,"Al(OH)3":2.42,ZnO:5.61,
 // ELEMENTAL solids at ~20°C from the Royal Society of Chemistry
 // Periodic Table, individual element fact boxes:
 // https://periodic-table.rsc.org/element/3/lithium
 // https://periodic-table.rsc.org/element/11/sodium
 // https://periodic-table.rsc.org/element/19/potassium
 // https://periodic-table.rsc.org/element/20/calcium
 // https://periodic-table.rsc.org/element/12/magnesium
 // https://periodic-table.rsc.org/element/13/aluminium
 // https://periodic-table.rsc.org/element/30/zinc
 // https://periodic-table.rsc.org/element/26/iron
 // https://periodic-table.rsc.org/element/29/copper
 // https://periodic-table.rsc.org/element/47/silver
 // https://periodic-table.rsc.org/element/79/gold
 // https://periodic-table.rsc.org/element/82/lead
 // NOT a powder's bulk packing density or density of a molten sample.
 Li:.534,Na:.97,K:.89,Ca:1.54,Mg:1.74,Al:2.70,
 Zn:7.134,Fe:7.87,Cu:8.96,Ag:10.5,Au:19.3,Pb:11.3,
 // Chemistry & Technology University Prague, 20°C solid-density table
 // (VŠCHT, kilograms/m³ converted explicitly to grams/cm³):
 // https://uchi.vscht.cz/e-tables/density-solids?jazyk=en&lang=en
 // Values apply to ANHYDROUS crystal phases, never solvated stocks:
 NH4Cl:1.53,"(NH4)2SO4":1.77,CaCl2:2.10,K2CO3:2.29,
 K2SO4:2.66,Na2SO4:2.70,Na2SO3:2.66,Al2O3:4.00,
 // OTC Inorganic Hydroxides literature survey, FDA; NaOH 20°C,
 // KOH 2.044, crystalline Mg(OH)2 2.36:
 // https://www.accessdata.fda.gov/drugsatfda_docs/omuf/order/supportDoc/OTC000039/3.3_Literature_References/rev_cir-2015-sodium-hydroxide_090026f88e12645d.pdf
 NaOH:2.13,KOH:2.044,"Mg(OH)2":2.36,
 // ATSDR Toxicological Profile for Lead, table of lead compounds:
 // https://www.ncbi.nlm.nih.gov/books/NBK589540/
 PbSO4:6.20,
 // PubChem substance-specific measured anhydrous solids:
 // https://pubchem.ncbi.nlm.nih.gov/compound/164827
 // https://pubchem.ncbi.nlm.nih.gov/compound/25204
 CuO:6.315,BaCl2:3.856,
 // Additional current cabinet substances and reviewed products. The numbers
 // are true densities of the SPECIFIED solid modifications at ~20-25 °C:
 // Si (crystalline), S (orthorhombic), I2 (molecular crystal):
 // https://pubchem.ncbi.nlm.nih.gov/periodic-table/density/
 // https://pubchem.ncbi.nlm.nih.gov/compound/Sulfur
 // https://pubchem.ncbi.nlm.nih.gov/compound/Iodine
 Si:2.3296,S:2.067,I2:4.93,
 // Hematite (alpha-Fe2O3), magnetite, quartz (alpha-SiO2):
 // https://pubchem.ncbi.nlm.nih.gov/compound/518696
 // https://www.science.smith.edu/~jbrady/petrology/intro-topics/comp-axis/axis-page05.php
 Fe2O3:5.24,Fe3O4:5.175,SiO2:2.65,
 // ZnS sphalerite, PbS galena. Different polymorphs vary in density:
 // https://pubchem.ncbi.nlm.nih.gov/compound/9833931
 // https://pubchem.ncbi.nlm.nih.gov/compound/9794739
 ZnS:4.04,PbS:7.60
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
 * No extrapolation above 100°C. Each entry is the stated anhydrous
 * formula, never a hydrate substituted silently. Curves valid only for
 * ONE salt in pure measured water, not prepared stock or mixed electrolytes.
 * Independent additional six-temperature rows from Merck:
 * https://www.merckmillipore.com/KE/en/support/calculators-and-apps/solubility-table-compounds-water-temperature
 * NaHCO3 and KMnO4 have verified measurements only through 60°C here.
 * NaHCO3 progressively decomposes when heated, so higher temperatures are
 * deliberately not modelled by a pure-compound equilibrium curve.
 */
/** Null means there is NO individually measured point, not zero solubility.
 * Endpoints never extrapolate across an unavailable temperature boundary. */
export const LAB_SALT_BINARY_SOLUBILITY_G_PER_100G_WATER:Readonly<
 Record<string,readonly (number|null)[]>>=Object.freeze({
 // Preserve previously validated reference curves and existing tests.
 KNO3:[13.3,31.6,63.9,110,169,246],
 KCl:[28,34,40,45.5,51.1,56.7],
 NaNO3:[73,88,104,124,148,180],
 // Merck laboratory reference: anhydrous formulas, g/100 g pure water.
 NH4Cl:[29.7,37.56,46,55.3,65.6,77.3],
 NH4NO3:[118.5,187.7,283,415,610,1000],
 "(NH4)2SO4":[70.4,75.44,81.2,87.4,94.1,102],
 "Ba(NO3)2":[4.95,9.06,14.4,20.3,27.2,34.2],
 "Pb(NO3)2":[36.4,52.22,69.4,88,107.5,127.3],
 KBr:[54,65.85,76.1,85.9,95.3,104.9],
 KI:[127.8,144.51,161,176.2,191.5,208],
 K2SO4:[7.33,11.11,14.79,18.2,21.29,24.1],
 AgNO3:[115,219.2,334.8,471,652,1024],
 NaNO2:[73,84.52,95.7,112.3,135.5,163],
 NaHCO3:[6.89,9.6,12.7,16,null,null],
 KMnO4:[2.83,6.43,12.56,22.4,null,null]
});
export const LAB_SALT_SOLUBILITY_TEMPERATURES_C=[0,20,40,60,80,100] as const;
export function labSingleSaltSolubilityGPer100gWater(
 formula:string,tempC:number):number|undefined{
 if(formula==="NaCl")return labNaClSolubilityGPer100gWater(tempC);
 if(formula==="PbCl2"||formula==="PbBr2"){
  // Binary solubility of the ANHYDROUS lead halide in PURE WATER.
  // PbCl2, PubChem 24459 (Kirk-Othmer): 0.673,0.99,3.34 g/100 mL
  // water at 0/20/100°C.
  // PbBr2, Patnaik Handbook of Inorganic Chemicals, p.461:
  // 4.55,8.44,44.1 g/L of water at 0/20/100°C.
  // https://rushim.ru/books/spravochniki/handbook-of-inorganic-chemicals.pdf
  // Divide by published pure-water densities to convert to
  // g per 100g of solvent; no extrapolation above 100°C.
  if(!Number.isFinite(tempC)||tempC<0||tempC>100)return;
  const gramPer100Ml=formula==="PbCl2"?
   [.673,.99,3.34]:[.455,.844,4.41];
  const waterDensity=[.99984,.9982,.9584];
  const temperatures=[0,20,100];
  for(let i=1;i<temperatures.length;i++){
   if(tempC<=temperatures[i]){
    const before=gramPer100Ml[i-1]/waterDensity[i-1];
    const after=gramPer100Ml[i]/waterDensity[i];
    return before+(after-before)*(tempC-temperatures[i-1])/
     (temperatures[i]-temperatures[i-1]);
   }
  }
  return;
 }
 const data=LAB_SALT_BINARY_SOLUBILITY_G_PER_100G_WATER[formula];
 if(!data||!Number.isFinite(tempC)||tempC<0||tempC>100)return;
 if(tempC===100)return data[data.length-1]??undefined;
 for(let i=1;i<LAB_SALT_SOLUBILITY_TEMPERATURES_C.length;i++){
  const low=LAB_SALT_SOLUBILITY_TEMPERATURES_C[i-1];
  const high=LAB_SALT_SOLUBILITY_TEMPERATURES_C[i];
  if(tempC<=high){
   const before=data[i-1],after=data[i];
   if(before===null||after===null||before===undefined||after===undefined)return;
   return before+(after-before)*(tempC-low)/(high-low);
  }
 }
}
/** Phase fractions for EXACTLY one supported anhydrous crystalline salt
 * and pure explicitly measured H2O. Aqueous mixed salts, prepared stocks
 * with unspecified solvent, and hydrates require a different equilibrium
 * system. Total salt molecule count is never changed by crystallisation. */
export function labEquilibrateSingleSaltCrystals(
 inventory:{speciesMol:Record<string,number>;solidMol:Record<string,number>},
 temperatureC:number,hasPureWaterStock:boolean,
 molarMassForSalt?:(formula:string)=>number|undefined
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
  NaCl:58.44277,KNO3:101.1032,KCl:74.5513,NaNO3:84.9947,
  PbCl2:278.106,PbBr2:367.008
 };
 // First six curated binary salts had explicit molar masses. All newer
 // measurements use the SAME validated stoichiometric formula parser as
 // the reaction engine; never silently assign an unrelated salt's mass.
 const mass=molarMassForSalt?.(salt)??molarMass[salt];
 if(!Number.isFinite(mass)||!mass||mass<=0)return;
 const capacityMol=waterMass*solubility/100/mass;
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
