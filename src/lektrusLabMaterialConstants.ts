import {labExactMeasuredSolubility} from "./lektrusLabSolubilityMeasurements";
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
 // Phase-identified dry-crystal densities, g/cm³ at ambient conditions.
 // Co(OH)2 rose-red rhombohedral crystals (not aqueous hydroxide suspension):
 // https://cameo.mfa.org/wiki/Cobaltous_hydroxide
 "Co(OH)2":3.597,
 // Cubic yellow silver(I) orthophosphate:
 // https://www.sshade.eu/data/solid/SOLID_Ag3PO4
 Ag3PO4:6.37,
 // Anhydrous calcium nitrate, ILO/WHO ICSC 1037; NOT tetrahydrate:
 // https://www.inchem.org/documents/icsc/icsc/eics1037.htm
 "Ca(NO3)2":2.50,
 // Anhydrous copper(II) nitrate, CAS 3251-23-8, NOT blue trihydrate:
 // https://www.americanelements.com/print/view/pdf/product_datasheet/block_1?view_args%5B%5D=36554
 "Cu(NO3)2":3.05,
 // Millerite trigonal NiS crystal, Ohio Geological Survey (specific gravity 5.5).
 // Other NiS polymorphs and freshly precipitated NiS are not this reference.
 // https://ohiodnr.gov/discover-and-learn/rock-minerals-fossils/minerals/Millerite
 NiS:5.5,
 // Potassium manganate(VI), solid dry K2MnO4 (not KMnO4, not aqueous);
 // UNODC table of physical densities corroborates 2.78 g/cm3:
 // https://www.elementschina.com/potassium-manganate.html
 K2MnO4:2.78,

 // Solid density sources: each formula is anhydrous (17–25 °C), not a powder bulk density.
 // FeS2 refers specifically to cubic pyrite; marcasite has a different density.
 CH3COONa:1.528,
 CH3COOK:1.57,
 CH3COOLi:1.28,
 NaH2PO4:2.36,
 MnSO4:3.25,
 FeS2:5,
 LiOH:1.46,
 "Al2(SO4)3":2.71,
 "Ca(CH3COO)2":1.5,
 "Zn(CH3COO)2":1.735,

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
 ZnS:4.04,PbS:7.60,
 // Individually cited single-phase crystal densities. These are not
 // loose-powder (bulk) densities, solutions or substituted hydrates:
 // https://pubchem.ncbi.nlm.nih.gov/compound/24502  K2Cr2O7 25°C
 // https://pubchem.ncbi.nlm.nih.gov/compound/516875 KMnO4
 // https://pubchem.ncbi.nlm.nih.gov/compound/4875   KI
 // https://pubchem.ncbi.nlm.nih.gov/compound/253881 NaBr
 // https://pubchem.ncbi.nlm.nih.gov/compound/3084026 SrSO4
 K2Cr2O7:2.676,KMnO4:2.70,KI:3.13,NaBr:3.21,SrSO4:3.96,
 // https://pubchem.ncbi.nlm.nih.gov/compound/24798 Ba(NO3)2
 // https://pubchem.ncbi.nlm.nih.gov/compound/24924 Pb(NO3)2
 // https://pubchem.ncbi.nlm.nih.gov/compound/516910 KNO2
 // https://pubchem.ncbi.nlm.nih.gov/compound/22985 NH4NO3
 "Ba(NO3)2":3.24,"Pb(NO3)2":4.53,KNO2:1.915,NH4NO3:1.72,
 // Crystalline sucrose (not a loose sugar heap): VŠCHT, 20°C.
 // https://uchi.vscht.cz/e-tables/density-solids?jazyk=en&lang=en
 C12H22O11:1.59,
 // Anhydrous D-glucose crystal (not the monohydrate):
 // https://pubchem.ncbi.nlm.nih.gov/compound/5793
 C6H12O6:1.562,
 // Anhydrous solids and SPECIFIC crystal phases, ~20–25°C.
 // Numeric density is the true material density, not bulk powder packing.
 // Ca(OH)2: PubChem CID 6093208 (CAMEO 2.24 g/cm3).
 // https://pubchem.ncbi.nlm.nih.gov/compound/6093208
 "Ca(OH)2":2.24,
 // MgCl2: PubChem CID 5360315 (DOE PAC 2.325 @25C).
 // https://pubchem.ncbi.nlm.nih.gov/compound/5360315
 MgCl2:2.325,
 // NaF: PubChem CID 5235 (DOE PAC 2.78 @25C).
 // https://pubchem.ncbi.nlm.nih.gov/compound/5235
 NaF:2.78,
 // Ag2CO3: PubChem CID 92796 (DOE PAC 6.077 @25C).
 // https://pubchem.ncbi.nlm.nih.gov/compound/92796
 Ag2CO3:6.077,
 // AlCl3 ANHYDROUS: ILO-WHO ICSC 1125, 2.44 g/cm3.
 // https://pubchem.ncbi.nlm.nih.gov/compound/24012
 AlCl3:2.44,
 // FeS reference troilite-like iron monosulfide, NOT hydrated FeS slurry:
 // PubChem CID 14828, Hawley's Dictionary 4.75 g/cm3.
 // https://pubchem.ncbi.nlm.nih.gov/compound/14828
 FeS:4.75,
 // Strontianite SrCO3: CRC / PubChem CID 15407, 3.5 g/cm3.
 // https://pubchem.ncbi.nlm.nih.gov/compound/15407
 SrCO3:3.50,
 // alpha-PbO (litharge): Kirk-Othmer / PubChem CID 14827.
 // beta-PbO is a distinct polymorph and has a different density.
 // https://pubchem.ncbi.nlm.nih.gov/compound/14827
 PbO:9.53,
 // MnO2 pyrolusite reference: ILO-WHO ICSC 0175, 5.0 g/cm3.
 // https://pubchem.ncbi.nlm.nih.gov/compound/14801
 MnO2:5.0,
 // Solid anhydrous NaNO2: PubChem CID 23668193 (2.17 g/cm3).
 // An aqueous sodium nitrite stock has a DIFFERENT density.
 // https://pubchem.ncbi.nlm.nih.gov/compound/23668193
 NaNO2:2.17,
 // Anhydrous magnesium sulfate, not MgSO4.7H2O (1.67 g/cm3):
 // PubChem CID 24083, ILO-WHO ICSC 2.66 g/cm3.
 // https://pubchem.ncbi.nlm.nih.gov/compound/24083
 MgSO4:2.66,
 // Five further pure, ANHYDROUS salt crystals, NOT their hydrates or
 // concentrated stock solutions (PubChem experimental/ICSC references).
 // FeCl3: https://pubchem.ncbi.nlm.nih.gov/compound/24380 (2.90 @25C)
 // FeCl2: https://pubchem.ncbi.nlm.nih.gov/compound/24458 (3.16 @25C)
 // ZnCl2: https://pubchem.ncbi.nlm.nih.gov/compound/5727 (2.907 @25C)
 // LiCl:  https://pubchem.ncbi.nlm.nih.gov/compound/433294 (2.07 @25C)
 // Na2S:  https://pubchem.ncbi.nlm.nih.gov/compound/14804 (1.856 @25C)
 FeCl3:2.90,FeCl2:3.16,ZnCl2:2.907,LiCl:2.07,Na2S:1.856,
 // Room-temperature true crystal densities. These deliberately distinguish
 // anhydrous NiSO4 from NiSO4·6H2O and FeO from Fe2O3/Fe3O4.
 // FeO CRC vs ICSC 6.0/5.7: adopt CRC cubic wuestite 6.0 g/cm3.
 // https://pubchem.ncbi.nlm.nih.gov/compound/449809
 FeO:6.0,
 // Covellite crystalline CuS CRC Handbook 4.76 g/cm3.
 // https://pubchem.ncbi.nlm.nih.gov/compound/165914
 CuS:4.76,
 // Pure Na2O, DOE PAC 25°C 2.27 g/cm3, reacts on contact with water.
 // https://pubchem.ncbi.nlm.nih.gov/compound/73971
 Na2O:2.27,
 // Anhydrous NiSO4 4.01 g/cm3 (NOT hexahydrate 2.03 g/cm3).
 // https://pubchem.ncbi.nlm.nih.gov/compound/24586
 NiSO4:4.01,
 // Independent ANHYDROUS solid density measurements, g/cm3 at ~20-25 C.
 // Do not substitute tetra-/hepta-hydrate, saturated solution, or bulk powder.
 // CRC / DOE PAC experiments via NIH PubChem:
 // https://pubchem.ncbi.nlm.nih.gov/compound/24424  ZnSO4: 3.8
 // https://pubchem.ncbi.nlm.nih.gov/compound/11125  Li2CO3: 2.11
 // https://pubchem.ncbi.nlm.nih.gov/compound/24243  Na3PO4: 2.54
 // https://pubchem.ncbi.nlm.nih.gov/compound/25212  Mg(NO3)2: ~2.3
 ZnSO4:3.8,Li2CO3:2.11,Na3PO4:2.54,"Mg(NO3)2":2.3,
 // Manufacturer datasheet: Li2SO4 pure anhydrous, 2.2 g/cm3 at 20 C.
 // https://www.albemarle.com/sites/default/files/2025-03/lithium-sulfate-pure-anhydrous-min-990-00000167.pdf
 Li2SO4:2.2,
 // Sigma Aldrich: K3PO4, anhydrous 2.564 g/mL at 25 C.
 // https://www.sigmaaldrich.com/NU/en/product/sigma/rdd019
 K3PO4:2.564,
 // New independent pure-solid crystal density records, ~20–25°C.
 // Zinc hydroxide: ATSDR zinc compounds, tab 4-2 (3.053 g/cm3).
 // https://www.ncbi.nlm.nih.gov/books/NBK600540/table/ch4.tab2/
 "Zn(OH)2":3.053,
 // Barium hydroxide ANHYDROUS specific gravity 4.495. The mono- and
 // octahydrate are 3.743 and 2.18 and must NOT replace this value.
 // https://www.ncbi.nlm.nih.gov/books/NBK598782/table/ch4.tab2/
 "Ba(OH)2":4.495,
 // Solid-phase Fe(OH)2 (3.40) and Ni(OH)2 (3.65), not loose fluffy
 // precipitate apparent densities. Distinct from bulk settled suspension.
 // https://pmc.ncbi.nlm.nih.gov/articles/PMC12982534/
 "Fe(OH)2":3.40,"Ni(OH)2":3.65,
 // Anhydrous CuCl2 3.386 g/cm3 (CuCl2·2H2O has ~2.51);
 // anhydrous NiCl2 3.51 and CoCl2 3.36.
 // https://onlinelibrary.wiley.com/doi/10.1002/047084289X.rc214.pub3
 // https://www.ncbi.nlm.nih.gov/books/NBK610343/table/ch4.tab2/
 // https://pubchem.ncbi.nlm.nih.gov/compound/3032536
 CuCl2:3.386,NiCl2:3.51,CoCl2:3.36,
 // SrCl2 anhydrous DOE PAC experimental data 3.052 g/cm3.
 // https://pubchem.ncbi.nlm.nih.gov/compound/5362485
 SrCl2:3.052,
 // Cerussite (pure PbCO3), 6.582 g/cm3 CRC (not white lead mixture).
 // https://pubchem.ncbi.nlm.nih.gov/compound/11727
 PbCO3:6.582,
 // Tricalcium phosphate 3.14 g/cm3 crystalline, not granular packing.
 // https://pubchem.ncbi.nlm.nih.gov/compound/24456
 "Ca3(PO4)2":3.14,
 // Dry LiNO3 @ 25 C 2.38 g/cm3, not lithium nitrate trihydrate.
 // https://pubchem.ncbi.nlm.nih.gov/compound/10129889
 LiNO3:2.38,
 // Pure anhydrous iron sulfates: FeSO4 3.56 (CRC) and Fe2(SO4)3
 // 3.097 g/cm3 (Merck). Hydrated forms have different densities.
 // https://pubchem.ncbi.nlm.nih.gov/compound/24393
 // https://pubchem.ncbi.nlm.nih.gov/compound/24826
 FeSO4:3.56,"Fe2(SO4)3":3.097,
 // beta-CoS crystalline 5.45 (CRC). Amorphous alpha-CoS is not equivalent.
 // https://pubchem.ncbi.nlm.nih.gov/compound/14832
 CoS:5.45
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
 KMnO4:[2.83,6.43,12.56,22.4,null,null],
 // Bulk curated from Merck/Millipore solubility table (0,20,40,60,80,100°C).
 // Source: https://www.merckmillipore.com/CR/en/support/calculators-and-apps/solubility-table-compounds-water-temperature
 // Measured water/salt data, g anhydrous formula-equivalent per 100g H2O.
 // NOTE: Na2CO3, CuSO4, Na2SO4 and some other salts can form hydrates!
 // Their numerical solubility data can be DISPLAYED, but the current dry-
 // crystal equilibrium must NOT silently create anhydrous precipitates.
 K2CO3:[105.5,111.5,117,127,140,156],
 K2Cr2O7:[4.68,12.49,26.3,45.6,73,103],
 CuSO4:[25.5,36.2,48,60,70,83],
 Na2CO3:[7.1,21.4,48.5,46.5,45.8,45.5],
 // At isolated reference knots only. Null is UNKNOWN, NOT insoluble.
 // A knot is usable alone but no interpolating over gaps.
 // Li2CO3: independent Kirk-Othmer experimental MASS PERCENT in the
 // final solution at 0/20/40/60/80/100 °C (1.52/1.31/1.16/1/.84/.71).
 // Convert wt% to grams dry salt / 100 g WATER as 100*w/(100-w),
 // rounded to 3 decimals. Existing 20 C 1.33 knot retained, within
 // source precision. Its retrograde temperature-dependence is real.
 // https://pubchem.ncbi.nlm.nih.gov/compound/11125
 Li2CO3:[1.543,1.33,1.174,1.010,.847,.715],
 NaF:[null,4.1,null,null,null,null],
 NaBr:[null,null,null,118,118.3,121.2],
 Na2SO3:[null,null,37,33.2,29,26.6],
 Na2SO4:[null,null,48.1,45.26,43.09,42.3],
 ZnCl2:[null,null,453,488,541,614],
 NaH2PO4:[null,null,null,179.3,207.3,284.4],
 // Source-verified EXACT 20 °C binary water-solubility points.
 // Original ICSC / Nickel Institute measurements are g/100 ml WATER.
 // Measured conversion uses the independently sourced pure-water density.
 // All five names remain REFERENCE-ONLY: aqueous hydrolysis/hydrates
 // and crystal water are not currently solved by the simulator.
 FeCl2:[null,labExactMeasuredSolubility("FeCl2",20)??null,null,null,null,null],
 CoCl2:[null,labExactMeasuredSolubility("CoCl2",20)??null,null,null,null,null],
 MgCl2:[null,labExactMeasuredSolubility("MgCl2",20)??null,null,null,null,null],
 MgSO4:[null,labExactMeasuredSolubility("MgSO4",20)??null,null,null,null,null],
 NiCl2:[null,labExactMeasuredSolubility("NiCl2",20)??null,null,null,null,null],
 // Seven additional Kaye/Laby-Lange values are measured at 293 K
 // (=19.85 °C) in the EXACT-temperature dataset. Do not inject them
 // into this 20 °C grid, and do not interpolate across unknown cells.
 // PubChem individually published measurements with original units and
 // exact temperatures preserved in lektrusLabSolubilityMeasurements.ts.
 // Unknown grid cells MUST remain null, never fabricated by interpolation.
 // These salts are reference-only for crystal equilibria: weak acid/base,
 // gas pressure, crystal hydrates and mixed ionic solutions are not solved.
 LiCl:[null,83.2,89.8,98.4,111.9,128.3],
 Na2S:[12.4,18.6,29,null,null,null],
 KNO2:[labExactMeasuredSolubility("KNO2",0)??null,306,null,null,null,
  labExactMeasuredSolubility("KNO2",100)??null],
 BaSO4:[null,.00031,null,null,null,null],
 CaCO3:[null,.00066,null,null,null,null],
 BaCO3:[null,.0014,null,null,null,null],
 MgCO3:[null,labExactMeasuredSolubility("MgCO3",20)??null,null,null,null,null],
 CaSO4:[null,labExactMeasuredSolubility("CaSO4",20)??null,null,null,null,null],
 PbI2:[null,labExactMeasuredSolubility("PbI2",20)??null,null,null,null,null],
 PbCO3:[null,labExactMeasuredSolubility("PbCO3",20)??null,null,null,null,null]
});
export const LAB_SALT_SOLUBILITY_TEMPERATURES_C=[0,20,40,60,80,100] as const;
export function labSingleSaltSolubilityGPer100gWater(
 formula:string,tempC:number):number|undefined{
 // Exact non-grid data (18, 25, 48, 50 °C) take precedence over
 // interpolation. Never use nearby sources to invent a 20 °C measurement.
 const direct=labExactMeasuredSolubility(formula,tempC);
 if(direct!==undefined)return direct;
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
 // Exact measured knots remain available even when adjacent knots are absent.
 // Never assume interpolation is possible from a single measurement.
 const exact=LAB_SALT_SOLUBILITY_TEMPERATURES_C.indexOf(
  tempC as (typeof LAB_SALT_SOLUBILITY_TEMPERATURES_C)[number]);
 if(exact!==-1)return data[exact]??undefined;
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
/** Formulas for which measured binary solubility DOES NOT authorize
 * a simulated anhydrous crystal. Hydrate stoichiometry and water binding
 * must be modelled before their precipitation/evaporation equilibrium.
 * This list is a conservative guard, not a claim of universal hydration. */
export const LAB_HYDRATE_PHASE_REQUIRES_SPECIAL_MODEL:ReadonlySet<string>=new Set([
 "CuSO4","Na2CO3","Na2SO4","K2CO3","NaBr","Na2SO3","ZnCl2",
 "NaH2PO4"
]);
/** These measurements describe the amount dissolved in isolated pure water,
 * NOT a validated standalone solid-liquid phase calculation. Carbonates,
 * sulfides and phosphates may change aqueous speciation or depend on pCO2,
 * hydration and polymorph. Publishing a saturation reference does not
 * permit creating/destroying a fictitious dry crystal.
 */
export const LAB_SOLUBILITY_REFERENCE_ONLY_BINARY_PHASES:ReadonlySet<string>=new Set([
 "LiCl","Na2S","KNO2","BaSO4","CaCO3","BaCO3","MgCO3","CaSO4",
 "PbI2","PbCO3","PbSO4","SrCO3","FeS","ZnS","Ca3(PO4)2",
 // Measured binary-water ceilings do not validate a dry crystal phase:
 // chloride/nitrate hydrolysis, hydrated sulfate/chloride phase boundaries,
 // water binding and mixed salt activities all require separate models.
 "FeCl2","CoCl2","MgCl2","MgSO4","NiCl2","AlCl3","CuCl2",
 "LiNO3","Cu(NO3)2","Al2(SO4)3","Li2SO4","ZnSO4"
]);
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
 // Salt identity alone is insufficient to predict the crystalline PHASE.
 // Na2CO3 decahydrate/monohydrate, CuSO4 pentahydrate and several salts
 // interchange their hydrates with water and temperature. The simulator
 // currently does not track crystallization water in the solid inventory.
 // Disable solid-liquid rebalancing for these salts until hydrate-specific
 // formula and enthalpy accounting is implemented. Do still expose their
 // independently measured binary solubility in reference UI.
 if(LAB_HYDRATE_PHASE_REQUIRES_SPECIAL_MODEL.has(salt)||
  LAB_SOLUBILITY_REFERENCE_ONLY_BINARY_PHASES.has(salt))return;
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
