/** Published densities of SATURATED aqueous solutions at 20 °C.
 * This is an independent REFERENCE LIBRARY, not a concentration-independent
 * density formula for a titration solution or a prepared stock at 0.1 mol/L.
 * The source states concentration in TOTAL MASS % of the saturated solution,
 * not weight of a dry residue. The formula identifies the saturation solid
 * (hydrate or anhydrous), which can affect phase equilibrium.
 *
 * Original measurements: Merck/Millipore, "Solubility Table for Water
 * at Temperature", column "Content ... at 20 °C (%)" and
 * "Density of the total solution at 20 °C" (despite its printed % header,
 * the numeric density unit is g/cm³).
 * https://www.merckmillipore.com/KE/en/support/calculators-and-apps/solubility-table-compounds-water-temperature
 *
 * Do NOT use these numbers to derive volume for arbitrary concentrations:
 * saturation density and dilute-solution density are different properties.
 */
export const LAB_SATURATED_SOLUTION_SOURCE =
 "https://www.merckmillipore.com/KE/en/support/calculators-and-apps/solubility-table-compounds-water-temperature";
export type LabSaturatedSolutionReference={
 baseFormula:string;
 saturationSolidFormula:string;
 temperatureC:20;
 concentrationMassPercent:number;
 solutionDensityGPerMl:number;
 sourceUrl:string;
};
/** One independently published row per relevant stable saturation solid. */
export const LAB_SATURATED_SOLUTION_REFERENCES:readonly LabSaturatedSolutionReference[]=[
 {baseFormula:"NH4Cl",saturationSolidFormula:"NH4Cl",
  temperatureC:20,concentrationMassPercent:27.3,
  solutionDensityGPerMl:1.075,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"NH4NO3",saturationSolidFormula:"NH4NO3",
  temperatureC:20,concentrationMassPercent:65,
  solutionDensityGPerMl:1.308,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"(NH4)2SO4",saturationSolidFormula:"(NH4)2SO4",
  temperatureC:20,concentrationMassPercent:43,
  solutionDensityGPerMl:1.247,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"Ba(NO3)2",saturationSolidFormula:"Ba(NO3)2",
  temperatureC:20,concentrationMassPercent:8.3,
  solutionDensityGPerMl:1.0691,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"KBr",saturationSolidFormula:"KBr",
  temperatureC:20,concentrationMassPercent:39.7,
  solutionDensityGPerMl:1.37,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"K2CO3",saturationSolidFormula:"K2CO3",
  temperatureC:20,concentrationMassPercent:52.8,
  solutionDensityGPerMl:1.58,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"KCl",saturationSolidFormula:"KCl",
  temperatureC:20,concentrationMassPercent:25.5,
  solutionDensityGPerMl:1.174,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"K2Cr2O7",saturationSolidFormula:"K2Cr2O7",
  temperatureC:20,concentrationMassPercent:11.1,
  solutionDensityGPerMl:1.077,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"KI",saturationSolidFormula:"KI",
  temperatureC:20,concentrationMassPercent:59.1,
  solutionDensityGPerMl:1.71,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"KNO3",saturationSolidFormula:"KNO3",
  temperatureC:20,concentrationMassPercent:24.1,
  solutionDensityGPerMl:1.16,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"KMnO4",saturationSolidFormula:"KMnO4",
  temperatureC:20,concentrationMassPercent:6,
  solutionDensityGPerMl:1.04,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"K2SO4",saturationSolidFormula:"K2SO4",
  temperatureC:20,concentrationMassPercent:10,
  solutionDensityGPerMl:1.0807,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"AgNO3",saturationSolidFormula:"AgNO3",
  temperatureC:20,concentrationMassPercent:68.6,
  solutionDensityGPerMl:2.18,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"NaCl",saturationSolidFormula:"NaCl",
  temperatureC:20,concentrationMassPercent:26.4,
  solutionDensityGPerMl:1.201,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"NaNO3",saturationSolidFormula:"NaNO3",
  temperatureC:20,concentrationMassPercent:46.8,
  solutionDensityGPerMl:1.38,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"NaNO2",saturationSolidFormula:"NaNO2",
  temperatureC:20,concentrationMassPercent:45.8,
  solutionDensityGPerMl:1.33,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"NaHCO3",saturationSolidFormula:"NaHCO3",
  temperatureC:20,concentrationMassPercent:8.76,
  solutionDensityGPerMl:1.08,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"NaF",saturationSolidFormula:"NaF",
  temperatureC:20,concentrationMassPercent:3.94,
  solutionDensityGPerMl:1.04,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"PbCl2",saturationSolidFormula:"PbCl2",
  temperatureC:20,concentrationMassPercent:0.98,
  solutionDensityGPerMl:1.007,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"Pb(NO3)2",saturationSolidFormula:"Pb(NO3)2",
  temperatureC:20,concentrationMassPercent:34.3,
  solutionDensityGPerMl:1.4,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"CuSO4",saturationSolidFormula:"CuSO4·5H2O",
  temperatureC:20,concentrationMassPercent:17.2,
  solutionDensityGPerMl:1.1965,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"ZnSO4",saturationSolidFormula:"ZnSO4·7H2O",
  temperatureC:20,concentrationMassPercent:35,
  solutionDensityGPerMl:1.47,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"NiCl2",saturationSolidFormula:"NiCl2·6H2O",
  temperatureC:20,concentrationMassPercent:35.6,
  solutionDensityGPerMl:1.46,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"SrCl2",saturationSolidFormula:"SrCl2·6H2O",
  temperatureC:20,concentrationMassPercent:35,
  solutionDensityGPerMl:1.39,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"MgCl2",saturationSolidFormula:"MgCl2·6H2O",
  temperatureC:20,concentrationMassPercent:35.3,
  solutionDensityGPerMl:1.331,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"MgSO4",saturationSolidFormula:"MgSO4·7H2O",
  temperatureC:20,concentrationMassPercent:26.25,
  solutionDensityGPerMl:1.31,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"FeCl3",saturationSolidFormula:"FeCl3·6H2O",
  temperatureC:20,concentrationMassPercent:47.9,
  solutionDensityGPerMl:1.52,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"FeCl2",saturationSolidFormula:"FeCl2·4H2O",
  temperatureC:20,concentrationMassPercent:38.4,
  solutionDensityGPerMl:1.49,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"FeSO4",saturationSolidFormula:"FeSO4·7H2O",
  temperatureC:20,concentrationMassPercent:21,
  solutionDensityGPerMl:1.225,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"Al2(SO4)3",saturationSolidFormula:"Al2(SO4)3·18H2O",
  temperatureC:20,concentrationMassPercent:26.7,
  solutionDensityGPerMl:1.308,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 // Gypsum is OMITTED: source lists 0.36 g/100g H2O at 20°C,
 // but a conflicting 0.204 wt% concentration (0.36 g implies 0.359 wt%).
 // Publishing that row as a single internally consistent solution would
 // create a fictional density/concentration pairing.
  {baseFormula:"BaCl2",saturationSolidFormula:"BaCl2·2H2O",
  temperatureC:20,concentrationMassPercent:26.3,
  solutionDensityGPerMl:1.28,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"Ba(OH)2",saturationSolidFormula:"Ba(OH)2·8H2O",
  temperatureC:20,concentrationMassPercent:3.36,
  solutionDensityGPerMl:1.04,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"CH3COONa",saturationSolidFormula:"CH3COONa·3H2O",
  temperatureC:20,concentrationMassPercent:31.7,
  solutionDensityGPerMl:1.17,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"Na2CO3",saturationSolidFormula:"Na2CO3·10H2O",
  temperatureC:20,concentrationMassPercent:17.8,
  solutionDensityGPerMl:1.1941,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"Na2SO4",saturationSolidFormula:"Na2SO4·10H2O",
  temperatureC:20,concentrationMassPercent:16.1,
  solutionDensityGPerMl:1.15,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"Na3PO4",saturationSolidFormula:"Na3PO4·12H2O",
  temperatureC:20,concentrationMassPercent:10.8,
  solutionDensityGPerMl:1.106,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE},
 {baseFormula:"NaOH",saturationSolidFormula:"NaOH·H2O",
  temperatureC:20,concentrationMassPercent:52.2,
  solutionDensityGPerMl:1.55,sourceUrl:LAB_SATURATED_SOLUTION_SOURCE}
];
/** All saturated-reference phases of this chemical family. */
export const labSaturatedSolutionReferences=(baseFormula:string)=>
 LAB_SATURATED_SOLUTION_REFERENCES.filter(row=>row.baseFormula===baseFormula);
