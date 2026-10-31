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
 originalUnit:LabMeasuredSolubilityUnit;sourceUrl:string;
};
export const LAB_MEASURED_PURE_WATER_SOLUBILITIES:readonly LabMeasuredSolubility[]=[
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
