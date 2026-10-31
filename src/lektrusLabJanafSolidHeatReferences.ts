/** NIST-JANAF Thermochemical Tables, fourth edition (1998): seven pure
 * crystalline solids' Cp,molar at exactly 298.15 kelvin and 0.1 MPa.
 * Each original source explicitly labels its phase "(cr)" and the first
 * heat column in J/(mol K). No arbitrary Cp(T) interpolation is inferred.
 *
 * Cp,specific = original Cp,molar / CURRENT simulator molar mass (g/mol).
 * Original molar values are retained to make reference arithmetic auditable.
 * Specific Cp has six digits after the decimal point. These measurements
 * do not describe liquid solutions, a salt hydrate, humid precipitate, or
 * high-temperature nonlinear heat capacity.
 */
export type LabJanafSolidHeatReference={
 formula:string;
 phase:"solid";
 crystalForm:string;
 temperatureKelvin:298.15;
 pressureMPa:0.1;
 molarHeatJPerMolK:number;
 roomHeatJPerGK:number;
 sourceUrl:string;
};
export const LAB_JANAF_SOLID_HEAT_REFERENCES:readonly LabJanafSolidHeatReference[]=[
 // NIST tables specifically label crystalline (cr), not liquid (l)
 // or beta-Li2SO4 (a different polymorph at elevated temperature).
 // The alpha-Li2SO4 crystal is stable at room conditions.
 {formula:"Na2O",phase:"solid",
  crystalForm:"pure anhydrous crystalline sodium oxide Na2O",
  temperatureKelvin:298.15,pressureMPa:0.1,
  molarHeatJPerMolK:69.103,roomHeatJPerGK:1.114950,
  sourceUrl:"https://janaf.nist.gov/tables/Na-012.html"},
 {formula:"Li2SO4",phase:"solid",
  crystalForm:"alpha anhydrous lithium sulfate crystal Li2SO4",
  temperatureKelvin:298.15,pressureMPa:0.1,
  molarHeatJPerMolK:117.608,roomHeatJPerGK:1.069786,
  sourceUrl:"https://janaf.nist.gov/tables/Li-026.html"},
 {formula:"MgCO3",phase:"solid",
  crystalForm:"crystalline magnesite MgCO3",temperatureKelvin:298.15,pressureMPa:0.1,
  molarHeatJPerMolK:76.21,roomHeatJPerGK:0.903894,
  sourceUrl:"https://janaf.nist.gov/tables/C-079.html"},
 {formula:"CuCl2",phase:"solid",
  crystalForm:"anhydrous crystalline CuCl2",temperatureKelvin:298.15,pressureMPa:0.1,
  molarHeatJPerMolK:71.881,roomHeatJPerGK:0.534646,
  sourceUrl:"https://janaf.nist.gov/tables/Cl-079.html"},
 {formula:"FeCl2",phase:"solid",
  crystalForm:"anhydrous crystalline FeCl2",temperatureKelvin:298.15,pressureMPa:0.1,
  molarHeatJPerMolK:76.664,roomHeatJPerGK:0.604868,
  sourceUrl:"https://janaf.nist.gov/tables/Cl-081.html"},
 {formula:"FeCl3",phase:"solid",
  crystalForm:"anhydrous crystalline FeCl3",temperatureKelvin:298.15,pressureMPa:0.1,
  molarHeatJPerMolK:96.65,roomHeatJPerGK:0.595888,
  sourceUrl:"https://janaf.nist.gov/tables/Cl-134.html"},
 {formula:"Ba(OH)2",phase:"solid",
  crystalForm:"alpha crystalline anhydrous Ba(OH)2",temperatureKelvin:298.15,pressureMPa:0.1,
  molarHeatJPerMolK:101.629,roomHeatJPerGK:0.593139,
  sourceUrl:"https://janaf.nist.gov/tables/Ba-025.html"},
];
