/** Source-reviewed numerical science batches for the EXISTING Lektrus lab.
 *
 * To extend the lab, append ONE review batch below. The adapters at the foot
 * of this module feed the ACTUAL heat, density, phase, water and hydrate
 * registries; no repeated hand edits to five unrelated source files.
 *
 * Data policy:
 * - One source URL per original observation, original source units preserved.
 * - Dry phase, hydrated phase, liquid stock and products are NOT interchangeable.
 * - Null = unmeasured; never extrapolate, silently average, or assume zero.
 * - Solubility is grams of named solute per initial PURE WATER, not saturated
 *   solution mass. A source in solution mass % is NOT g/100g water.
 * - When a source specifies a hydrate, use "hydrates", NOT "water".
 * - Old data corrections require removing their wrong original rows and
 *   explicitly reviewing any lowering of monotone coverage floors.
 *
 * A single batch is one reviewed science/source unit. Run:
 *   npm run lab:batch-check
 *   npm run lab:coverage-sync
 * Future source rows may include dry Cp and phase transitions as well as
 * density and original water measurements. See scripts/test-lektrus-lab-reference-batches.mjs.
 */
export type LabBatchDryDatum={
 formula:string;
 property:"crystalDensityGPerMl"|"specificHeatJPerGK"|
 "meltingC"|"boilingC"|"decompositionC"|"sublimationC";
 value:number;
 sourceUrl:string;
 phase:"anhydrous-solid";
 /** For phase transitions, a source-specific behavior and explanatory note. */
 note?:string;
};
export type LabBatchWaterDatum={
 formula:string;temperatureC:number;sourceValue:number;
 originalUnit:"g/100g-water"|"g/100ml-water"|"g/l-water"|
 "g/kg-water"|"mg/l-water"|"mg/100g-water";
 sourceUrl:string;
 /** Optional exact Kelvin condition, not rounded to 20 C. */
 sourceTemperatureKelvin?:number;
};
export type LabBatchHydrate={
 baseFormula:string;hydrateFormula:string;waters:number;
 massGPer100gWater:readonly(number|null)[];
 extra?:readonly {temperatureC:number;massGPer100gWater:number;sourceUrl?:string}[];
 sourceUrl:string;
};
export type LabReferenceBatch={
 id:string;date:string;note:string;
 dry:readonly LabBatchDryDatum[];
 water:readonly LabBatchWaterDatum[];
 hydrates:readonly LabBatchHydrate[];
};
/**
 * ADD NEW VERIFIED BATCHES HERE. No other runtime registry edits are
 * needed for new formula identities. Tests reject duplicates/phase errors.
 */
export const LAB_REFERENCE_BATCHES:readonly LabReferenceBatch[]=[
 {
  id:"2026-10-31-density-hydrate-correction-01",
  date:"2026-10-31",
  note:"Pure-solid source densities and correction of Ca acetate dihydrate.",
  dry:[
   {formula:"KNO2",property:"crystalDensityGPerMl",value:1.915,
    phase:"anhydrous-solid",
    sourceUrl:"https://www.inchem.org/documents/iarc/iarcmono/v94iarc.pdf"},
   {formula:"Na3PO4",property:"crystalDensityGPerMl",value:2.54,
    phase:"anhydrous-solid",
    sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/24243"},
   {formula:"K3PO4",property:"crystalDensityGPerMl",value:2.564,
    phase:"anhydrous-solid",
    sourceUrl:"https://www.sigmaaldrich.com/NU/en/product/sigma/rdd019"},
   {formula:"CH3ONa",property:"crystalDensityGPerMl",value:1.3,
    phase:"anhydrous-solid",
    sourceUrl:"https://www.inchem.org/documents/icsc/icsc/eics0771.htm"}
  ],
  water:[],
  hydrates:[
   {baseFormula:"Ca(CH3COO)2",hydrateFormula:"Ca(CH3COO)2·2H2O",
    waters:2,
    // Perry, Handbook of Inorganic Compounds, 2nd ed. entry 610,
    // cites Lange 2005. Original unit: grams of actual DIHYDRATE
    // per 100 g pure H2O (not 100mL or anhydrous acetate).
    massGPer100gWater:[37.4,34.7,null,null,null,29.7],
    sourceUrl:"https://ndl.ethernet.edu.et/bitstream/123456789/76396/1/20.pdf"}
  ]
 }
];
export const LAB_BATCH_DRY_PROPERTY_DATUMS=LAB_REFERENCE_BATCHES.flatMap(
 batch=>batch.dry.map(({formula,property,value,sourceUrl})=>({
  formula,property,value,sourceUrl
 })));
export const LAB_BATCH_WATER_MEASUREMENTS=LAB_REFERENCE_BATCHES.flatMap(
 batch=>batch.water);
export const LAB_BATCH_HYDRATES=LAB_REFERENCE_BATCHES.flatMap(
 batch=>batch.hydrates);
export const LAB_BATCH_SOLID_DENSITIES:Readonly<Record<string,number>>=
 Object.freeze(Object.fromEntries(LAB_BATCH_DRY_PROPERTY_DATUMS
  .filter(row=>row.property==="crystalDensityGPerMl")
  .map(row=>[row.formula,row.value])));
export const LAB_BATCH_SOLID_HEATS:Readonly<Record<string,{
 specificJPerGK:number;phase:"solid"}>>=
 Object.freeze(Object.fromEntries(LAB_BATCH_DRY_PROPERTY_DATUMS
  .filter(row=>row.property==="specificHeatJPerGK")
  .map(row=>[row.formula,{specificJPerGK:row.value,phase:"solid" as const}])));
export const LAB_BATCH_THERMAL_REFERENCES:Readonly<Record<string,{
 meltingC?:number;boilingC?:number;decompositionC?:number;
 sublimationC?:number;behavior?:"decomposes";note?:string}>>=
 Object.freeze(Object.fromEntries(
  LAB_REFERENCE_BATCHES.flatMap(batch=>batch.dry)
   .filter(row=>["meltingC","boilingC","decompositionC","sublimationC"]
    .includes(row.property)).map(row=>[row.formula,{
     [row.property]:row.value,
     ...(row.property==="decompositionC"?{behavior:"decomposes" as const}:{}),
     ...(row.note?{note:row.note}:{})
    }])));
/** Only new EXACT 20C water stock entries receive a grid cell. */
export const LAB_BATCH_20C_SOLUBILITY_FORMULAS=[...new Set(
 LAB_BATCH_WATER_MEASUREMENTS.filter(row=>row.temperatureC===20)
  .map(row=>row.formula))];
/** Never predict pure dry crystalline precipitation from a source row. */
export const LAB_BATCH_REFERENCE_ONLY_SOLUTES=[...new Set(
 LAB_BATCH_WATER_MEASUREMENTS.map(row=>row.formula))];
