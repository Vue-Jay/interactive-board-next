/** Independently sourced measured solubility of specific dry salts or
 * crystalline minerals in PURE water at an EXACT documented temperature.
 *
 * Source: PubChem, which cites CRC Handbook, ICSC, Ullmann, Merck Index
 * and peer-reviewed experimental measurements on each compound's page.
 *
 * The measurement source and ORIGINAL units stay in the row. In particular
 * 18 °C and 25 °C are not relabelled as 20 °C. Weak-acid salts, sulfides
 * and hydrated phases have pH, gas-pressure and polymorph dependencies,
 * so these values are REFERENCE-ONLY, not a universal Ksp solver.
 *
 * One g/100 ml WATER is divided by the mass of 100 ml pure water
 * (density in g/ml, measured at its original temperature), never by
 * the density of the final *saturated solution*.
 */
export type LabMeasuredSolubilityUnit=
 "g/100g-water"|"g/100ml-water"|"g/l-water"|"g/kg-water"|"mg/l-water"|"mg/100g-water";
export type LabMeasuredSolubility={
 formula:string;temperatureC:number;sourceValue:number;
 /** Original source in kelvin (where specified); 293 K means 19.85 °C,
  * not an independently measured 20.00 °C point. */
 sourceTemperatureKelvin?:number;
 originalUnit:LabMeasuredSolubilityUnit;sourceUrl:string;
};
export const LAB_MEASURED_PURE_WATER_SOLUBILITIES:readonly LabMeasuredSolubility[]=[
 // ILO/WHO ICSC 0913 for PURE anhydrous LiOH, 12.8 g/100 mL
 // starting WATER at exactly 20°C. Distinct from LiOH·H2O: 19.1
 // g/100 mL of water reported separately by ICSC 0914. The hydrated
 // measurement is stored in the hydrate-specific source registry.
 {formula:"LiOH",temperatureC:20,sourceValue:12.8,
  originalUnit:"g/100ml-water",
  sourceUrl:"https://inchem.org/documents/icsc/icsc/eics0913.htm"},
 // Additional independent EXACT-temperature readings. Manufacturer
 // SDS lithium sulfate and potassium sulfite values are expressed per L
 // of pure WATER, not per L of final solution.
 // CuS (CRC 18 C) and celestite SrSO4 (distilled H2O 20 C) must never
 // be rounded to zero or transformed into universal Ksp constants.
 // Ammonium carbonate 15 C is a nominal composition that decomposes in
 // air and water: reference only, NOT stable dry-crystal equilibrium.
 {formula:"K2SO3",temperatureC:25,sourceValue:1060,
  originalUnit:"g/l-water",sourceUrl:"https://www.cdhfinechemical.com/images/product/msds/92_1413110475_PotassiumSulphite-CASNO-10117-38-1-MSDS.pdf"},
 {formula:"Li2SO4",temperatureC:25,sourceValue:342,
  originalUnit:"g/l-water",sourceUrl:"https://www.albemarle.com/us/en/product/lithium-sulfate-pure-anhydrous-min-990"},
 {formula:"CuS",temperatureC:18,sourceValue:0.000033,
  originalUnit:"g/100ml-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/165914"},
 {formula:"SrSO4",temperatureC:20,sourceValue:0.0138,
  originalUnit:"g/100ml-water",sourceUrl:"https://www.mdpi.com/2227-9717/14/1/172"},
 {formula:"(NH4)2CO3",temperatureC:15,sourceValue:100,
  originalUnit:"g/100g-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/517111"},
 // Individually verified pure-water reference measurements, with exact
 // ORIGINAL units, not mass percentage of the final saturated solution.
 // Nickel sulfate: CRC 0/100 C and ILO/WHO ICSC 20 C. Values at 0 and
 // 20 both happen to round to 29.3 g/100mL, but do not imply a flat curve.
 // Hydrate stability and ionic activities are NOT solved here.
 // Lithium acetate (CAS 546-89-4): Nama supplier specifies anhydrous
 // crystalline product, water solubility in g/100g H2O at 20/40/50 C.
 // Ferrous sulfate: Seidell primary measurements via chemister.ru,
 // measured at EXACT 20.13/70.04/90.13 C, not rounded to grid knots.
 // GESTIS IFA Mg(NO3)2: its 20 C 420 g/L and 25 C 71.2 g/100g H2O
 // use different original units and likely different stable hydrate
 // equilibria, so they are kept isolated with NO interpolation.
 // AgI: HSDB/Haz-Map 28 * 10^-7 g/L at 25 C = 0.0028 mg/L,
 // NOT zero or 0.0028 g/L. No precipitation Ksp is inferred.
 {formula:"NiSO4",temperatureC:0,sourceValue:29.3,
  originalUnit:"g/100ml-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/24586"},
 {formula:"NiSO4",temperatureC:20,sourceValue:29.3,
  originalUnit:"g/100ml-water",sourceUrl:"https://www.inchem.org/documents/icsc/icsc/eics0063.htm"},
 {formula:"NiSO4",temperatureC:100,sourceValue:83.7,
  originalUnit:"g/100ml-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/24586"},
 {formula:"CH3COOLi",temperatureC:20,sourceValue:40.8,
  originalUnit:"g/100g-water",sourceUrl:"https://nama-group.com/portfolio-items/lithium-acetate/"},
 {formula:"CH3COOLi",temperatureC:40,sourceValue:66.7,
  originalUnit:"g/100g-water",sourceUrl:"https://nama-group.com/portfolio-items/lithium-acetate/"},
 {formula:"CH3COOLi",temperatureC:50,sourceValue:93.8,
  originalUnit:"g/100g-water",sourceUrl:"https://nama-group.com/portfolio-items/lithium-acetate/"},
 {formula:"FeSO4",temperatureC:0,sourceValue:15.65,
  originalUnit:"g/100g-water",sourceUrl:"https://www.chemister.ru/Databases/Chemdatabase/properties-en.php?id=4387"},
 {formula:"FeSO4",temperatureC:20.13,sourceValue:26.56,
  originalUnit:"g/100g-water",sourceUrl:"https://www.chemister.ru/Databases/Chemdatabase/properties-en.php?id=4387"},
 {formula:"FeSO4",temperatureC:70.04,sourceValue:56.08,
  originalUnit:"g/100g-water",sourceUrl:"https://www.chemister.ru/Databases/Chemdatabase/properties-en.php?id=4387"},
 {formula:"FeSO4",temperatureC:90.13,sourceValue:37.27,
  originalUnit:"g/100g-water",sourceUrl:"https://www.chemister.ru/Databases/Chemdatabase/properties-en.php?id=4387"},
 {formula:"Mg(NO3)2",temperatureC:20,sourceValue:420,
  originalUnit:"g/l-water",sourceUrl:"https://haber.archive.fhi.mpg.de/send/8IKpJO3bKSzf"},
 {formula:"Mg(NO3)2",temperatureC:25,sourceValue:71.2,
  originalUnit:"g/100g-water",sourceUrl:"https://haber.archive.fhi.mpg.de/send/8IKpJO3bKSzf"},
 {formula:"AgI",temperatureC:25,sourceValue:0.0028,
  originalUnit:"mg/l-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/24563"},
 // Exact-temperature binary-water measurements, preserved in
 // ORIGINAL source units. These values describe pure-water saturation,
 // not the density of the final saturated solution or a general Ksp model.
 // ILO-WHO ICSC: anhydrous CaCl2 and Na3PO4 at 20 C, ZnCl2 at 25 C.
 // Colorado DOT report CDOT-2009-1 Table 15(B), p.242: magnesium acetate
 // 53.4 g per 100 g of water at exactly 20 C, from cited MSDS.
 // Health Canada barium table: BaCl2 37 g/100 g water at exactly 25 C.
 // Chemlin Al(NO3)3 water table: exact source g per KG of solvent at
 // each published temperature, INCLUDING 10/25/30/50/70 C (off-grid).
 // The equilibrium changes hydrate solid phases: this is REFERENCE-ONLY.
 {formula:"CaCl2",temperatureC:20,sourceValue:74.5,
  originalUnit:"g/100ml-water",sourceUrl:"https://inchem.org/documents/icsc/icsc/eics1184.htm"},
 {formula:"Na3PO4",temperatureC:20,sourceValue:121,
  originalUnit:"g/l-water",sourceUrl:"https://www.inchem.org/documents/icsc/icsc/eics1178.htm"},
 {formula:"Mg(CH3COO)2",temperatureC:20,sourceValue:53.4,
  originalUnit:"g/100g-water",sourceUrl:"https://rosap.ntl.bts.gov/view/dot/36465/dot_36465_DS1.pdf"},
 {formula:"ZnCl2",temperatureC:25,sourceValue:432,
  originalUnit:"g/100ml-water",sourceUrl:"https://www.inchem.org/documents/icsc/icsc/eics1064.htm"},
 {formula:"BaCl2",temperatureC:25,sourceValue:37,
  originalUnit:"g/100g-water",sourceUrl:"https://www.canada.ca/en/health-canada/services/publications/healthy-living/guidelines-canadian-drinking-water-quality-guideline-technical-document-barium.html"},
 {formula:"Al(NO3)3",temperatureC:0,sourceValue:587.3,
  originalUnit:"g/kg-water",sourceUrl:"https://chemlin.org/chemical-compound/Aluminium%20nitrate.php"},
 {formula:"Al(NO3)3",temperatureC:10,sourceValue:618.1,
  originalUnit:"g/kg-water",sourceUrl:"https://chemlin.org/chemical-compound/Aluminium%20nitrate.php"},
 {formula:"Al(NO3)3",temperatureC:20,sourceValue:663.9,
  originalUnit:"g/kg-water",sourceUrl:"https://chemlin.org/chemical-compound/Aluminium%20nitrate.php"},
 {formula:"Al(NO3)3",temperatureC:25,sourceValue:689.2,
  originalUnit:"g/kg-water",sourceUrl:"https://chemlin.org/chemical-compound/Aluminium%20nitrate.php"},
 {formula:"Al(NO3)3",temperatureC:30,sourceValue:724.1,
  originalUnit:"g/kg-water",sourceUrl:"https://chemlin.org/chemical-compound/Aluminium%20nitrate.php"},
 {formula:"Al(NO3)3",temperatureC:40,sourceValue:801.8,
  originalUnit:"g/kg-water",sourceUrl:"https://chemlin.org/chemical-compound/Aluminium%20nitrate.php"},
 {formula:"Al(NO3)3",temperatureC:50,sourceValue:897.5,
  originalUnit:"g/kg-water",sourceUrl:"https://chemlin.org/chemical-compound/Aluminium%20nitrate.php"},
 {formula:"Al(NO3)3",temperatureC:60,sourceValue:1016.1,
  originalUnit:"g/kg-water",sourceUrl:"https://chemlin.org/chemical-compound/Aluminium%20nitrate.php"},
 {formula:"Al(NO3)3",temperatureC:70,sourceValue:1164.5,
  originalUnit:"g/kg-water",sourceUrl:"https://chemlin.org/chemical-compound/Aluminium%20nitrate.php"},
 {formula:"Al(NO3)3",temperatureC:100,sourceValue:1597.4,
  originalUnit:"g/kg-water",sourceUrl:"https://chemlin.org/chemical-compound/Aluminium%20nitrate.php"},
 // Individually traceable exact-temperature aqueous solubility in PURE
 // water, not density or mass of the final saturated SOLUTION. AgCl/AgBr
 // are in mg per L solvent and must remain very small positive values.
 // Ca acetate has source points at 0 and 100 °C ONLY: do NOT fill 20 °C.
 // K3PO4 is source tabulated at 20 °C as 51 g/100 g pure water;
 // it hydrolyses, so this is a reference, not a predicted crystal phase.
 {formula:"CH3COONa",temperatureC:20,sourceValue:46.5,
  originalUnit:"g/100ml-water",sourceUrl:"https://www.inchem.org/documents/icsc/icsc/eics0565.htm"},
 {formula:"CH3COOK",temperatureC:20,sourceValue:256,
  originalUnit:"g/100ml-water",sourceUrl:"https://inchem.org/documents/icsc/icsc/eics0547.htm"},
 {formula:"AgCl",temperatureC:20,sourceValue:1.93,
  originalUnit:"mg/l-water",sourceUrl:"https://www.canada.ca/en/environment-climate-change/services/evaluating-existing-substances/screening-assessment-silver-compounds.html"},
 {formula:"AgBr",temperatureC:20,sourceValue:0.14,
  originalUnit:"mg/l-water",sourceUrl:"https://www.canada.ca/en/environment-climate-change/services/evaluating-existing-substances/screening-assessment-silver-compounds.html"},
 {formula:"SrCl2",temperatureC:20,sourceValue:538,
  originalUnit:"g/l-water",sourceUrl:"https://www.inchem.org/documents/cicads/cicads/cicad77.pdf"},
 {formula:"K3PO4",temperatureC:20,sourceValue:51,
  originalUnit:"g/100g-water",sourceUrl:"https://www.specialisednutritioneurope.eu/wp-content/uploads/2019/07/SNE-Literature-Review-December-2018.pdf"},
 {formula:"Ca(CH3COO)2",temperatureC:0,sourceValue:37.4,
  originalUnit:"g/100ml-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/6116"},
 {formula:"Ca(CH3COO)2",temperatureC:100,sourceValue:29.7,
  originalUnit:"g/100ml-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/6116"},
 // ILO/WHO ICSC cards + Nickel Institute. Measured at exactly 20 °C,
 // originally g per 100 mL of PURE WATER, not g per 100 g solvent
 // and not per 100 mL of the final saturated SOLUTION.
 // NiCl2 is specifically ANHYDROUS: Institute reports separately a
 // vastly different 254 g/100 mL for its hexahydrate. Never mix them.
 {formula:"FeCl2",temperatureC:20,sourceValue:62.5,
  originalUnit:"g/100ml-water",sourceUrl:"https://www.inchem.org/documents/icsc/icsc/eics1715.htm"},
 {formula:"CoCl2",temperatureC:20,sourceValue:53,
  originalUnit:"g/100ml-water",sourceUrl:"https://www.inchem.org/documents/icsc/icsc/eics0783.htm"},
 {formula:"MgCl2",temperatureC:20,sourceValue:54.3,
  originalUnit:"g/100ml-water",sourceUrl:"https://inchem.org/documents/icsc/icsc/eics0764.htm"},
 {formula:"MgSO4",temperatureC:20,sourceValue:30,
  originalUnit:"g/100ml-water",sourceUrl:"https://www.inchem.org/documents/icsc/icsc/eics1197.htm"},
 {formula:"NiCl2",temperatureC:20,sourceValue:64.2,
  originalUnit:"g/100ml-water",sourceUrl:"https://nickelinstitute.org/media/2834/vol26-02dec2011.pdf"},
 // 293 K (19.85 °C) tabulated from Kaye & Laby / Lange, reproduced by
 // Wired Chemist. Temperature is kept as source reports it, NOT rounded
 // to the six-point 20 °C grid. These are isolated BINARY-water
 // references, not permission to crystallise anhydrous salts from water.
 // Species that hydrolyse, form hydrates or complexes remain reference-only.
 {formula:"AlCl3",temperatureC:19.85,sourceTemperatureKelvin:293,
  sourceValue:45.8,originalUnit:"g/100g-water",
  sourceUrl:"https://www.wiredchemist.com/chemistry/data/solubilities_inorganic.html"},
 {formula:"CuCl2",temperatureC:19.85,sourceTemperatureKelvin:293,
  sourceValue:73,originalUnit:"g/100g-water",
  sourceUrl:"https://www.wiredchemist.com/chemistry/data/solubilities_inorganic.html"},
 {formula:"LiNO3",temperatureC:19.85,sourceTemperatureKelvin:293,
  sourceValue:70.1,originalUnit:"g/100g-water",
  sourceUrl:"https://www.wiredchemist.com/chemistry/data/solubilities_inorganic.html"},
 {formula:"Cu(NO3)2",temperatureC:19.85,sourceTemperatureKelvin:293,
  sourceValue:125,originalUnit:"g/100g-water",
  sourceUrl:"https://www.wiredchemist.com/chemistry/data/solubilities_inorganic.html"},
 {formula:"Al2(SO4)3",temperatureC:19.85,sourceTemperatureKelvin:293,
  sourceValue:36.4,originalUnit:"g/100g-water",
  sourceUrl:"https://www.wiredchemist.com/chemistry/data/solubilities_inorganic.html"},
 {formula:"Li2SO4",temperatureC:19.85,sourceTemperatureKelvin:293,
  sourceValue:34.8,originalUnit:"g/100g-water",
  sourceUrl:"https://www.wiredchemist.com/chemistry/data/solubilities_inorganic.html"},
 {formula:"ZnSO4",temperatureC:19.85,sourceTemperatureKelvin:293,
  sourceValue:53.8,originalUnit:"g/100g-water",
  sourceUrl:"https://www.wiredchemist.com/chemistry/data/solubilities_inorganic.html"},
 {formula:"LiCl",temperatureC:20,sourceValue:83.2,
  originalUnit:"g/100g-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/433294"},
 {formula:"LiCl",temperatureC:40,sourceValue:89.8,
  originalUnit:"g/100g-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/433294"},
 {formula:"LiCl",temperatureC:60,sourceValue:98.4,
  originalUnit:"g/100g-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/433294"},
 {formula:"LiCl",temperatureC:80,sourceValue:111.9,
  originalUnit:"g/100g-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/433294"},
 {formula:"LiCl",temperatureC:100,sourceValue:128.3,
  originalUnit:"g/100g-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/433294"},
 {formula:"Na2S",temperatureC:0,sourceValue:12.4,
  originalUnit:"g/100g-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/14804"},
 {formula:"Na2S",temperatureC:20,sourceValue:18.6,
  originalUnit:"g/100g-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/14804"},
 {formula:"Na2S",temperatureC:40,sourceValue:29,
  originalUnit:"g/100g-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/14804"},
 {formula:"Na2S",temperatureC:48,sourceValue:35.7,
  originalUnit:"g/100g-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/14804"},
 {formula:"Na2S",temperatureC:50,sourceValue:39,
  originalUnit:"g/100g-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/14804"},
 {formula:"KNO2",temperatureC:0,sourceValue:281,
  originalUnit:"g/100ml-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/516910"},
 {formula:"KNO2",temperatureC:20,sourceValue:306,
  originalUnit:"g/100g-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/516910"},
 {formula:"KNO2",temperatureC:25,sourceValue:312,
  originalUnit:"g/100g-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/516910"},
 {formula:"KNO2",temperatureC:100,sourceValue:413,
  originalUnit:"g/100ml-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/516910"},
 {formula:"BaSO4",temperatureC:20,sourceValue:0.00031,
  originalUnit:"g/100g-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/24414"},
 {formula:"CaCO3",temperatureC:20,sourceValue:0.00066,
  originalUnit:"g/100g-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/10112"},
 {formula:"BaCO3",temperatureC:20,sourceValue:0.0014,
  originalUnit:"g/100g-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/10563"},
 {formula:"MgCO3",temperatureC:20,sourceValue:0.01,
  originalUnit:"g/100ml-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/11029"},
 {formula:"CaSO4",temperatureC:20,sourceValue:0.2,
  originalUnit:"g/100ml-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/24497"},
 {formula:"PbI2",temperatureC:20,sourceValue:0.076,
  originalUnit:"g/100ml-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/24931"},
 {formula:"PbCO3",temperatureC:20,sourceValue:0.00011,
  originalUnit:"g/100ml-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/11727"},
 {formula:"PbSO4",temperatureC:25,sourceValue:0.0404,
  originalUnit:"g/100ml-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/24008"},
 {formula:"SrCO3",temperatureC:18,sourceValue:11,
  originalUnit:"mg/l-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/15407"},
 {formula:"ZnS",temperatureC:18,sourceValue:0.00069,
  originalUnit:"g/100ml-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/9833931"},
 {formula:"FeS",temperatureC:18,sourceValue:0.00062,
  originalUnit:"g/100ml-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/14828"},
 {formula:"Ca3(PO4)2",temperatureC:25,sourceValue:2.5,
  originalUnit:"mg/100g-water",sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/24456"}
];
/** Density of pure WATER only at specifically sourced reference points.
 * This must not be confused with solution density.
 * 0 / 18 / 20 / 25 / 100 °C, g/ml, CRC water tables rounded. */
export const LAB_PURE_WATER_DENSITY_FOR_SOLUBILITY:Readonly<Record<number,number>>={
 0:.99984,18:.9986,20:.9982,25:.997,100:.9584
};
export function labMeasuredSolubilityGPer100gWater(
 sample:LabMeasuredSolubility):number|undefined{
 const {sourceValue,temperatureC,originalUnit}=sample;
 if(!Number.isFinite(sourceValue)||sourceValue<0)return;
 if(originalUnit==="g/100g-water")return sourceValue;
 if(originalUnit==="g/kg-water")return sourceValue/10;
 if(originalUnit==="mg/100g-water")return sourceValue/1000;
 const waterDensity=LAB_PURE_WATER_DENSITY_FOR_SOLUBILITY[temperatureC];
 if(!waterDensity)return;
 if(originalUnit==="g/100ml-water")return sourceValue/waterDensity;
 if(originalUnit==="g/l-water")return sourceValue/10/waterDensity;
 if(originalUnit==="mg/l-water")return sourceValue/10000/waterDensity;
 return;
}
/** Only exact literature temperatures; no approximation at nearby T. */
export function labExactMeasuredSolubility(
 formula:string,temperatureC:number):number|undefined{
 const row=LAB_MEASURED_PURE_WATER_SOLUBILITIES.find(
  item=>item.formula===formula&&item.temperatureC===temperatureC);
 return row?labMeasuredSolubilityGPer100gWater(row):undefined;
}

/** Nearest *actual* literature measurement for the inspector. The returned
 * temperature is the published one, never relabelled as the target.
 * An unmeasured temperature never gets a made-up reference point. */
export function labNearestMeasuredSolubilityReference(
 formula:string,temperatureC:number):{
  temperatureC:number;gPer100gWater:number;sourceUrl:string
 }|undefined{
 if(!Number.isFinite(temperatureC))return;
 const row=LAB_MEASURED_PURE_WATER_SOLUBILITIES
  .filter(r=>r.formula===formula)
  .sort((a,b)=>Math.abs(a.temperatureC-temperatureC)-
   Math.abs(b.temperatureC-temperatureC)||a.temperatureC-b.temperatureC)[0];
 if(!row)return;
 const gPer100gWater=labMeasuredSolubilityGPer100gWater(row);
 return gPer100gWater===undefined?undefined:{
  temperatureC:row.temperatureC,gPer100gWater,sourceUrl:row.sourceUrl
 };
}
