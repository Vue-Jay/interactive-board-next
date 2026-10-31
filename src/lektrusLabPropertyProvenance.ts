/** Individually traceable, source-reviewed reference measurements curated in
 * a single import batch. Each numeric datum MUST match the actual simulator
 * registry (checked in scripts/audit-lektrus-lab-properties.mjs --verify).
 *
 * All values refer to specific PURE SOLID compounds, not stock solutions.
 * Crystal densities represent true crystal material, not precipitate powder
 * packing. Cp is the near-298 K specific mass heat capacity, not that of a
 * prepared aqueous mixture. Decomposition/sublimation is NOT boiling.
 *
 * Source policies: experimental or curated institutional tables; do not
 * resolve source conflicts by guessing, and do not infer unknown hydrates.
 */
export type LabReviewedPropertyDatum={
 formula:string;
 property:"crystalDensityGPerMl"|"specificHeatJPerGK"|
  "meltingC"|"boilingC"|"decompositionC"|"sublimationC";
 value:number;
 sourceUrl:string;
};
export const LAB_REVIEWED_PROPERTY_DATUMS:readonly LabReviewedPropertyDatum[]=[
 {formula:"Ba(OH)2",property:"crystalDensityGPerMl",value:4.495,
  sourceUrl:"https://www.ncbi.nlm.nih.gov/books/NBK598782/table/ch4.tab2/"},
 {formula:"Zn(OH)2",property:"crystalDensityGPerMl",value:3.053,
  sourceUrl:"https://www.ncbi.nlm.nih.gov/books/NBK600540/table/ch4.tab2/"},
 {formula:"Fe(OH)2",property:"crystalDensityGPerMl",value:3.4,
  sourceUrl:"https://pmc.ncbi.nlm.nih.gov/articles/PMC12982534/"},
 {formula:"Ni(OH)2",property:"crystalDensityGPerMl",value:3.65,
  sourceUrl:"https://pmc.ncbi.nlm.nih.gov/articles/PMC12982534/"},
 {formula:"CuCl2",property:"crystalDensityGPerMl",value:3.386,
  sourceUrl:"https://onlinelibrary.wiley.com/doi/10.1002/047084289X.rc214.pub3"},
 {formula:"NiCl2",property:"crystalDensityGPerMl",value:3.51,
  sourceUrl:"https://www.ncbi.nlm.nih.gov/books/NBK610343/table/ch4.tab2/"},
 {formula:"CoCl2",property:"crystalDensityGPerMl",value:3.36,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/3032536"},
 {formula:"SrCl2",property:"crystalDensityGPerMl",value:3.052,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/5362485"},
 {formula:"PbCO3",property:"crystalDensityGPerMl",value:6.582,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/11727"},
 {formula:"Ca3(PO4)2",property:"crystalDensityGPerMl",value:3.14,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/24456"},
 {formula:"LiNO3",property:"crystalDensityGPerMl",value:2.38,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/10129889"},
 {formula:"FeSO4",property:"crystalDensityGPerMl",value:3.56,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/24393"},
 {formula:"Fe2(SO4)3",property:"crystalDensityGPerMl",value:3.097,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/24826"},
 {formula:"CoS",property:"crystalDensityGPerMl",value:5.45,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/14832"},
 {formula:"KOH",property:"specificHeatJPerGK",value:1.156642,
  sourceUrl:"https://webbook.nist.gov/cgi/cbook.cgi?ID=C1310583&Mask=2"},
 {formula:"Mg(OH)2",property:"specificHeatJPerGK",value:1.323907,
  sourceUrl:"https://webbook.nist.gov/cgi/cbook.cgi?ID=C1309428&Mask=2"},
 {formula:"K2Cr2O7",property:"specificHeatJPerGK",value:0.761488,
  sourceUrl:"https://ru.djvu.online/file/FxAstfSBiPOi2"},
 {formula:"K2CO3",property:"specificHeatJPerGK",value:0.904581,
  sourceUrl:"https://ru.djvu.online/file/FxAstfSBiPOi2"},
 {formula:"AgCl",property:"specificHeatJPerGK",value:0.367355,
  sourceUrl:"https://ru.djvu.online/file/FxAstfSBiPOi2"},
 {formula:"NaNO3",property:"specificHeatJPerGK",value:1.083656,
  sourceUrl:"https://ru.djvu.online/file/FxAstfSBiPOi2"},
 {formula:"Na2S",property:"specificHeatJPerGK",value:0.380744,
  sourceUrl:"https://ru.djvu.online/file/FxAstfSBiPOi2"},
 {formula:"SrSO4",property:"specificHeatJPerGK",value:0.597475,
  sourceUrl:"https://ru.djvu.online/file/FxAstfSBiPOi2"},
 {formula:"Ba(OH)2",property:"meltingC",value:408,
  sourceUrl:"https://www.ncbi.nlm.nih.gov/books/NBK598782/table/ch4.tab2/"},
 {formula:"Zn(OH)2",property:"decompositionC",value:125,
  sourceUrl:"https://www.ncbi.nlm.nih.gov/books/NBK600540/table/ch4.tab2/"},
 {formula:"ZnCl2",property:"meltingC",value:290,
  sourceUrl:"https://www.ncbi.nlm.nih.gov/books/NBK600540/table/ch4.tab2/"},
 {formula:"NiCl2",property:"sublimationC",value:985,
  sourceUrl:"https://www.ncbi.nlm.nih.gov/books/NBK610343/table/ch4.tab2/"},
 {formula:"NiSO4",property:"decompositionC",value:840,
  sourceUrl:"https://www.ncbi.nlm.nih.gov/books/NBK610343/table/ch4.tab2/"},
 {formula:"PbCO3",property:"decompositionC",value:315,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/11727"},
 {formula:"Fe2(SO4)3",property:"decompositionC",value:480,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/24826"},
 {formula:"SrCl2",property:"meltingC",value:874,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/5362485"},
 {formula:"CoCl2",property:"meltingC",value:735,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/3032536"},
 {formula:"Ca3(PO4)2",property:"meltingC",value:1670,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/24456"},
 {formula:"CuCl2",property:"decompositionC",value:300,
  sourceUrl:"https://onlinelibrary.wiley.com/doi/10.1002/047084289X.rc214.pub3"},
 {formula:"Al(OH)3",property:"decompositionC",value:300,
  sourceUrl:"https://www.ncbi.nlm.nih.gov/books/NBK597310/table/ch4.tab2/"},
 {formula:"AgBr",property:"meltingC",value:432,
  sourceUrl:"https://calculla.com/melting_point"},
 {formula:"LiNO3",property:"meltingC",value:253,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/10129889"},
 {formula:"Al2(SO4)3",property:"decompositionC",value:770,
  sourceUrl:"https://www.ncbi.nlm.nih.gov/books/NBK597310/table/ch4.tab2/"},
 {formula:"MgO",property:"meltingC",value:2852,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/14792"},
 {formula:"CaO",property:"meltingC",value:2572,
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/14778"},
 {formula:"BaSO4",property:"meltingC",value:1580,
  sourceUrl:"https://www.ncbi.nlm.nih.gov/books/NBK598782/table/ch4.tab2/"},
 {formula:"ZnO",property:"meltingC",value:1975,
  sourceUrl:"https://www.ncbi.nlm.nih.gov/books/NBK600540/table/ch4.tab2/"}
];
