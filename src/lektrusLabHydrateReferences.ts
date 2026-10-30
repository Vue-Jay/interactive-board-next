/** Phase-aware, source-tabulated solubility for HYDRATED salts in water.
 *
 * All numerical entries are GRAMS OF THE HYDRATE AS PRINTED in the source
 * per 100 g of starting water at the recorded temperature. They are NOT
 * grams of the anhydrous formula, a solubility product, or a quantitative
 * prediction of a multi-ion solution. Crystal water is chemically bound and
 * must be accounted for before hydrate precipitation can be simulated.
 *
 * Source: Merck / Millipore "Solubility Table for Water at Temperature"
 * https://www.merckmillipore.com/KE/en/support/calculators-and-apps/solubility-table-compounds-water-temperature
 *
 * Null = the source gives NO VALUE at this exact temperature; it is NOT zero.
 * Non-grid measured entries (10, 50 and 56 °C) stay at their real temperatures.
 * We intentionally do not interpolate between measurements across hydrate
 * phase transitions or extrapolate beyond experimentally reported points.
 */
export const LAB_HYDRATE_REFERENCE_SOURCE=
 "https://www.merckmillipore.com/KE/en/support/calculators-and-apps/solubility-table-compounds-water-temperature";

export const LAB_HYDRATE_KNOT_TEMPERATURES_C=[0,20,40,60,80,100] as const;
export type LabHydrateSolubilityRow={
 baseFormula:string;waters:number;hydrateFormula:string;
 massGPer100gWater:readonly (number|null)[];
 extra?:readonly {temperatureC:number;massGPer100gWater:number}[];
};
export type LabHydrateSolubilitySample={
 baseFormula:string;hydrateFormula:string;waters:number;
 temperatureC:number;massGPer100gWater:number;sourceUrl:string;
};
/** Independent hydrate formulas; not interchangeable with dry stocks. */
export const LAB_HYDRATE_SOLUBILITY_REFERENCES:readonly LabHydrateSolubilityRow[]=[
 {baseFormula:"AlCl3",waters:6,hydrateFormula:"AlCl3·6H2O",
  massGPer100gWater:[44.9,45.6,46.3,47,47.7,null]},
 {baseFormula:"Al(NO3)3",waters:9,hydrateFormula:"Al(NO3)3·9H2O",
  massGPer100gWater:[61,75.44,89,108,null,null]},
 {baseFormula:"Al2(SO4)3",waters:18,hydrateFormula:"Al2(SO4)3·18H2O",
  massGPer100gWater:[31.2,36.44,45.6,58,73,89]},
 {baseFormula:"BaCl2",waters:2,hydrateFormula:"BaCl2·2H2O",
  massGPer100gWater:[30.7,35.7,40.8,46.4,52.5,58.7]},
 {baseFormula:"Ba(OH)2",waters:8,hydrateFormula:"Ba(OH)2·8H2O",
  massGPer100gWater:[1.5,3.48,8.2,21,null,null]},
 {baseFormula:"CaCl2",waters:2,hydrateFormula:"CaCl2·2H2O",
  massGPer100gWater:[null,null,128.1,136.8,147,159]},
 {baseFormula:"Ca(NO3)2",waters:4,hydrateFormula:"Ca(NO3)2·4H2O",
  massGPer100gWater:[101,129.39,196,null,null,null]},
 {baseFormula:"CaSO4",waters:2,hydrateFormula:"CaSO4·2H2O",
  massGPer100gWater:[0.176,0.36,0.2122,0.2047,0.1966,0.1619]},
 {baseFormula:"CoCl2",waters:6,hydrateFormula:"CoCl2·6H2O",
  massGPer100gWater:[83.5,100,126,null,null,null],
  extra:[{temperatureC:56,massGPer100gWater:169.5}]},
 {baseFormula:"CuCl2",waters:2,hydrateFormula:"CuCl2·2H2O",
  massGPer100gWater:[70.65,77,83.8,91.2,99.2,107.9]},
 {baseFormula:"Cu(NO3)2",waters:3,hydrateFormula:"Cu(NO3)2·3H2O",
  massGPer100gWater:[null,null,160,179,208,null]},
 {baseFormula:"CuSO4",waters:5,hydrateFormula:"CuSO4·5H2O",
  massGPer100gWater:[14.8,20.77,29,39.1,53.6,73.6]},
 {baseFormula:"FeCl3",waters:6,hydrateFormula:"FeCl3·6H2O",
  massGPer100gWater:[74.5,91.94,null,null,null,null]},
 {baseFormula:"FeCl2",waters:4,hydrateFormula:"FeCl2·4H2O",
  massGPer100gWater:[null,62.35,68.6,78.3,null,null]},
 {baseFormula:"FeSO4",waters:7,hydrateFormula:"FeSO4·7H2O",
  massGPer100gWater:[15.65,26.58,40.3,null,null,null],
  extra:[{temperatureC:50,massGPer100gWater:47.6}]},
 {baseFormula:"LiCl",waters:1,hydrateFormula:"LiCl·H2O",
  massGPer100gWater:[null,82.82,90.4,100,113,null]},
 {baseFormula:"MgCl2",waters:6,hydrateFormula:"MgCl2·6H2O",
  massGPer100gWater:[52.8,54.57,57.5,60.7,65.87,72.7]},
 {baseFormula:"Mg(NO3)2",waters:6,hydrateFormula:"Mg(NO3)2·6H2O",
  massGPer100gWater:[63.9,70.07,81.8,93.7,null,null]},
 {baseFormula:"MgSO4",waters:7,hydrateFormula:"MgSO4·7H2O",
  massGPer100gWater:[null,35.6,45.4,null,null,null],
  extra:[{temperatureC:10,massGPer100gWater:30.05}]},
 {baseFormula:"MnSO4",waters:1,hydrateFormula:"MnSO4·H2O",
  massGPer100gWater:[null,null,60,58.6,45.5,35.5]},
 {baseFormula:"NiCl2",waters:6,hydrateFormula:"NiCl2·6H2O",
  massGPer100gWater:[51.7,55.3,null,null,null,null]},
 {baseFormula:"Ni(NO3)2",waters:6,hydrateFormula:"Ni(NO3)2·6H2O",
  massGPer100gWater:[79.2,94.1,118.8,null,null,null]},
 {baseFormula:"SrCl2",waters:6,hydrateFormula:"SrCl2·6H2O",
  massGPer100gWater:[44.1,53.85,66.6,85.2,null,null]},
 {baseFormula:"Zn(NO3)2",waters:4,hydrateFormula:"Zn(NO3)2·4H2O",
  massGPer100gWater:[null,null,211.5,null,null,null]},
 {baseFormula:"ZnSO4",waters:7,hydrateFormula:"ZnSO4·7H2O",
  massGPer100gWater:[41.6,53.8,null,null,null,null]},
 {baseFormula:"ZnSO4",waters:1,hydrateFormula:"ZnSO4·H2O",
  massGPer100gWater:[null,null,null,76.5,66.7,60.5]}
];

/** Fetch an ACTUALLY measured point of a specific crystal-water formula. */
export function labHydrateSolubilityAtTemperature(
 hydrateFormula:string,temperatureC:number):LabHydrateSolubilitySample|undefined{
 if(!Number.isFinite(temperatureC))return;
 const entry=LAB_HYDRATE_SOLUBILITY_REFERENCES.find(
  r=>r.hydrateFormula===hydrateFormula);
 if(!entry)return;
 const i=LAB_HYDRATE_KNOT_TEMPERATURES_C.indexOf(
  temperatureC as (typeof LAB_HYDRATE_KNOT_TEMPERATURES_C)[number]);
 const measurement=i<0?entry.extra?.find(x=>x.temperatureC===temperatureC)?.massGPer100gWater:
  entry.massGPer100gWater[i];
 if(typeof measurement!=="number"||!Number.isFinite(measurement))return;
 return {baseFormula:entry.baseFormula,hydrateFormula:entry.hydrateFormula,
  waters:entry.waters,temperatureC,
  massGPer100gWater:measurement,sourceUrl:LAB_HYDRATE_REFERENCE_SOURCE};
}

/** One nearest published temperature per *distinct* hydrate formula.
 * The returned measured temperature is never silently relabelled as current.
 */
export function labHydrateNearestMeasuredReferences(
 baseFormula:string,desiredTemperatureC=20):LabHydrateSolubilitySample[]{
 if(!Number.isFinite(desiredTemperatureC))return [];
 return LAB_HYDRATE_SOLUBILITY_REFERENCES
  .filter(r=>r.baseFormula===baseFormula)
  .flatMap(r=>{
   const temperatures:number[]=[...LAB_HYDRATE_KNOT_TEMPERATURES_C.filter(
    (_t,i)=>r.massGPer100gWater[i]!==null)];
   for(const x of r.extra??[])temperatures.push(x.temperatureC);
   temperatures.sort((a,b)=>
    Math.abs(a-desiredTemperatureC)-Math.abs(b-desiredTemperatureC)||a-b);
   const measured=temperatures[0];
   const sample=measured===undefined?undefined:
    labHydrateSolubilityAtTemperature(r.hydrateFormula,measured);
   return sample?[sample]:[];
  });
}


/** Five independently measured TRUE DENSITIES for hydrated crystal phases
 * at 20 °C, not loose powder or the corresponding dry salt.
 * VŠCHT Prague, Density of solids: https://uchi.vscht.cz/e-tables/density-solids?jazyk=en&lang=en
 * Source values in kg/m³ have been divided by 1000 to give g/mL.
 */
export const LAB_HYDRATE_CRYSTAL_DENSITIES:readonly {
 baseFormula:string;hydrateFormula:string;densityGPerMl:number;sourceUrl:string;
}[]=[
 {baseFormula:"CuSO4",hydrateFormula:"CuSO4·5H2O",densityGPerMl:2.29,
  sourceUrl:"https://uchi.vscht.cz/e-tables/density-solids?jazyk=en&lang=en"},
 {baseFormula:"Na2CO3",hydrateFormula:"Na2CO3·10H2O",densityGPerMl:1.46,
  sourceUrl:"https://uchi.vscht.cz/e-tables/density-solids?jazyk=en&lang=en"},
 {baseFormula:"Na2SO4",hydrateFormula:"Na2SO4·10H2O",densityGPerMl:1.46,
  sourceUrl:"https://uchi.vscht.cz/e-tables/density-solids?jazyk=en&lang=en"},
 {baseFormula:"K2CO3",hydrateFormula:"K2CO3·2H2O",densityGPerMl:2.04,
  sourceUrl:"https://uchi.vscht.cz/e-tables/density-solids?jazyk=en&lang=en"},
 {baseFormula:"K2CO3",hydrateFormula:"2K2CO3·3H2O",densityGPerMl:2.13,
  sourceUrl:"https://uchi.vscht.cz/e-tables/density-solids?jazyk=en&lang=en"}
];
export const labHydrateCrystalDensityReferences=(baseFormula:string)=>
 LAB_HYDRATE_CRYSTAL_DENSITIES.filter(row=>row.baseFormula===baseFormula);
