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
 extra?:readonly {temperatureC:number;massGPer100gWater:number;sourceUrl?:string}[];
 /** Reference for THIS hydrate; default Merck for legacy rows. */
 sourceUrl?:string;
};
export type LabHydrateSolubilitySample={
 baseFormula:string;hydrateFormula:string;waters:number;
 temperatureC:number;massGPer100gWater:number;sourceUrl:string;
};
/** Independent hydrate formulas; not interchangeable with dry stocks. */
export const LAB_HYDRATE_SOLUBILITY_REFERENCES:readonly LabHydrateSolubilityRow[]=[
 // ILO/WHO ICSC 0914 reports the LiOH MONOHYDRATE explicitly,
 // not the anhydrous LiOH solid. 19.1 g of LiOH·H2O per 100 mL of
 // pure H2O at 20°C = 19.1/0.9982 g per 100 g initial water.
 // The hydrate's water of crystallisation remains bound to the solid;
 // no hydrated precipitation is inferred from this isolated reference.
 {baseFormula:"LiOH",waters:1,hydrateFormula:"LiOH·H2O",
  massGPer100gWater:[null,19.1/.9982,null,null,null,null],
  sourceUrl:"https://inchem.org/documents/icsc/icsc/eics0914.htm"},
 // Independent phase-identified crystal-water measurements, never
 // merged into pure anhydrous salt saturation.
 // Wired Chemist Kaye/Laby table: 293 K = 19.85 C (NOT 20 C).
 // Zinc nitrate hexahydrate: CRC 184.3 g/100 mL WATER at 20 C;
 // converted explicitly by rho_pure_water(20 C)=0.9982 g/mL.
 // Zinc acetate dihydrate: CRC reports 20 C 30 g/100g, 25 C 40 g/100g,
 // 100 C 67 g/100g. The large 20->25 change is left as discrete
 // source points; never interpolate across a phase-identity uncertainty.
 {baseFormula:"Fe(NO3)2",waters:6,hydrateFormula:"Fe(NO3)2·6H2O",
  massGPer100gWater:[null,null,null,null,null,null],
  extra:[{temperatureC:19.85,massGPer100gWater:140}],
  sourceUrl:"https://www.wiredchemist.com/chemistry/data/solubilities_inorganic.html"},
 {baseFormula:"Fe(NO3)3",waters:9,hydrateFormula:"Fe(NO3)3·9H2O",
  massGPer100gWater:[null,null,null,null,null,null],
  extra:[{temperatureC:19.85,massGPer100gWater:138}],
  sourceUrl:"https://www.wiredchemist.com/chemistry/data/solubilities_inorganic.html"},
 {baseFormula:"Zn(NO3)2",waters:6,hydrateFormula:"Zn(NO3)2·6H2O",
  massGPer100gWater:[null,184.3/.9982,null,null,null,null],
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/24518"},
 {baseFormula:"Zn(CH3COO)2",waters:2,hydrateFormula:"Zn(CH3COO)2·2H2O",
  massGPer100gWater:[null,30,null,null,null,67],
  extra:[{temperatureC:25,massGPer100gWater:40}],
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/11192"},
 {baseFormula:"AlCl3",waters:6,hydrateFormula:"AlCl3·6H2O",
  massGPer100gWater:[44.9,45.6,46.3,47,47.7,null]},
 {baseFormula:"Al(NO3)3",waters:9,hydrateFormula:"Al(NO3)3·9H2O",
  massGPer100gWater:[61,75.44,89,108,null,null]},
 {baseFormula:"Al2(SO4)3",waters:18,hydrateFormula:"Al2(SO4)3·18H2O",
  massGPer100gWater:[31.2,36.44,45.6,58,73,89]},
 {baseFormula:"BaCl2",waters:2,hydrateFormula:"BaCl2·2H2O",
  massGPer100gWater:[30.7,35.7,40.8,46.4,52.5,58.7],
  extra:[{temperatureC:19.85,massGPer100gWater:35.8,
   sourceUrl:"https://www.wiredchemist.com/chemistry/data/solubilities_inorganic.html"}]},
 {baseFormula:"Ba(OH)2",waters:8,hydrateFormula:"Ba(OH)2·8H2O",
  massGPer100gWater:[1.5,3.48,8.2,21,null,null]},
 {baseFormula:"CaCl2",waters:2,hydrateFormula:"CaCl2·2H2O",
  massGPer100gWater:[null,null,128.1,136.8,147,159]},
 {baseFormula:"Ca(NO3)2",waters:4,hydrateFormula:"Ca(NO3)2·4H2O",
  massGPer100gWater:[101,129.39,196,null,null,null],
  extra:[{temperatureC:19.85,massGPer100gWater:129,
   sourceUrl:"https://www.wiredchemist.com/chemistry/data/solubilities_inorganic.html"}]},
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
  massGPer100gWater:[74.5,91.94,null,null,null,null],
  extra:[{temperatureC:19.85,massGPer100gWater:91.8,
   sourceUrl:"https://www.wiredchemist.com/chemistry/data/solubilities_inorganic.html"}],
  sourceUrl:LAB_HYDRATE_REFERENCE_SOURCE},
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
  massGPer100gWater:[null,null,null,76.5,66.7,60.5]},
 // Additional exact Merck tabulations. Both hydrated and unhydrated phases
 // can be listed for one salt; never substitute crystal-water quantities.
 {baseFormula:"KOH",waters:1,hydrateFormula:"KOH·H2O",
  massGPer100gWater:[null,null,136.4,147,160,178]},
 {baseFormula:"NaOH",waters:1,hydrateFormula:"NaOH·H2O",
  massGPer100gWater:[null,109.22,126,178,null,null]},
 {baseFormula:"Na3PO4",waters:12,hydrateFormula:"Na3PO4·12H2O",
  massGPer100gWater:[1.5,12.11,31,55,81,108]},
 {baseFormula:"Na2CO3",waters:10,hydrateFormula:"Na2CO3·10H2O",
  massGPer100gWater:[6.86,21.66,null,null,null,null]},
 {baseFormula:"Na2CO3",waters:1,hydrateFormula:"Na2CO3·H2O",
  massGPer100gWater:[null,null,48.9,46.2,44.5,44.5]},
 {baseFormula:"Na2SO4",waters:10,hydrateFormula:"Na2SO4·10H2O",
  massGPer100gWater:[4.56,19.19,null,null,null,null]},
 {baseFormula:"NaH2PO4",waters:2,hydrateFormula:"NaH2PO4·2H2O",
  massGPer100gWater:[57.7,85.2,138.2,null,null,null]},
 {baseFormula:"CH3COONa",waters:3,hydrateFormula:"CH3COONa·3H2O",
  massGPer100gWater:[36.3,46.42,65.4,null,null,null],
  extra:[{temperatureC:58,massGPer100gWater:138}]},
 // FeSO4 monohydrate entry is unambiguous only at 80 °C;
 // the source renders a negative 100 °C datum (-31.6), so omit it.
 {baseFormula:"FeSO4",waters:1,hydrateFormula:"FeSO4·H2O",
  massGPer100gWater:[null,null,null,null,43.8,null]},
 // Reference-only chemical base, not present in cabinet at this revision.
 {baseFormula:"Sr(OH)2",waters:8,hydrateFormula:"Sr(OH)2·8H2O",
  massGPer100gWater:[0.35,0.7,1.5,3.13,7.02,24.2]}
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
 const nonGridSample=i<0?entry.extra?.find(x=>x.temperatureC===temperatureC):undefined;
 const measurement=i<0?nonGridSample?.massGPer100gWater:
  entry.massGPer100gWater[i];
 if(typeof measurement!=="number"||!Number.isFinite(measurement))return;
 return {baseFormula:entry.baseFormula,hydrateFormula:entry.hydrateFormula,
  waters:entry.waters,temperatureC,
  massGPer100gWater:measurement,
  sourceUrl:nonGridSample?.sourceUrl??entry.sourceUrl??LAB_HYDRATE_REFERENCE_SOURCE};
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
 // Independent named hydrate crystal true densities, not ANY of the
 // corresponding ANHYDROUS salts or loose powder packing densities.
 // LiOH·H2O: ILO/WHO ICSC 0914, 1.51 g/cm3.
 // Zn(CH3COO)2·2H2O: Seidell/Lange chemistry database,
 // specifically dihydrate monoclinic crystals, 1.735 g/cm3 at 20 C.
 // https://chemister.ru/Databases/Chemdatabase/properties-en.php?dbid=1&id=2737
 // BaCl2·2H2O: ILO/WHO ICSC 0615, 3.86 g/cm3.
 // MnSO4·H2O: ILO/WHO ICSC 0290, 2.95 g/cm3.
 // Zn(NO3)2·6H2O: NCBI PubChem/Hazardous Substances Data Bank
 //   2.065 g/cm3 at 14 C, hexahydrate specifically.
 // CoCl2·6H2O: NCBI PubChem US DOE PAC, 1.924 g/cm3 at 25 C.
 {baseFormula:"Zn(CH3COO)2",hydrateFormula:"Zn(CH3COO)2·2H2O",densityGPerMl:1.735,
  sourceUrl:"https://chemister.ru/Databases/Chemdatabase/properties-en.php?dbid=1&id=2737"},
 {baseFormula:"LiOH",hydrateFormula:"LiOH·H2O",densityGPerMl:1.51,
  sourceUrl:"https://inchem.org/documents/icsc/icsc/eics0914.htm"},
 {baseFormula:"BaCl2",hydrateFormula:"BaCl2·2H2O",densityGPerMl:3.86,
  sourceUrl:"https://www.inchem.org/documents/icsc/icsc/eics0615.htm"},
 {baseFormula:"MnSO4",hydrateFormula:"MnSO4·H2O",densityGPerMl:2.95,
  sourceUrl:"https://www.inchem.org/documents/icsc/icsc/eics0290.htm"},
 {baseFormula:"Zn(NO3)2",hydrateFormula:"Zn(NO3)2·6H2O",densityGPerMl:2.065,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/Zinc-Nitrate"},
 {baseFormula:"CoCl2",hydrateFormula:"CoCl2·6H2O",densityGPerMl:1.924,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/Cobalt-chloride-hexahydrate"},
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
