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
 "g/100g-water"|"g/100ml-water"|"mg/l-water"|"mg/100g-water";
export type LabMeasuredSolubility={
 formula:string;temperatureC:number;sourceValue:number;
 /** Original source in kelvin (where specified); 293 K means 19.85 °C,
  * not an independently measured 20.00 °C point. */
 sourceTemperatureKelvin?:number;
 originalUnit:LabMeasuredSolubilityUnit;sourceUrl:string;
};
export const LAB_MEASURED_PURE_WATER_SOLUBILITIES:readonly LabMeasuredSolubility[]=[
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
 if(originalUnit==="mg/100g-water")return sourceValue/1000;
 const waterDensity=LAB_PURE_WATER_DENSITY_FOR_SOLUBILITY[temperatureC];
 if(!waterDensity)return;
 if(originalUnit==="g/100ml-water")return sourceValue/waterDensity;
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
