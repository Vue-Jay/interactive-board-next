/** Canonical batch importer for source-reviewed PURE material constants.
 *
 * To extend the scientific catalogue, add ONE phase-qualified, original-
 * unit entry to LAB_CURATED_PROPERTY_BATCH. The density, dry-state phase
 * transition and individual provenance maps are derived from these rows:
 * DO NOT also duplicate the number in three separate runtime registries.
 *
 * A source for a SOLUTION, HYDRATE or "reaction in water" must NOT enter
 * this batch. Those belong in their own phase-specific reference tables.
 * Where a source gives a range or threshold, do NOT invent an exact value.
 *
 * Verified automatically by scripts/audit-lektrus-lab-properties.mjs and
 * scripts/test-lektrus-lab-reaction-network.mjs against the actual app.
 */
export type LabCuratedPropertyBatchRow={
 formula:string;
 property:"crystalDensityGPerMl"|"specificHeatJPerGK"|
  "meltingC"|"decompositionC"|"sublimationC"|"boilingC";
 value:number;
 /** The physical phase IN THE SOURCE, never a solution or hydrate. */
 phase:"anhydrous-solid";
 /** The original institutional/handbook page containing THIS number. */
 sourceUrl:string;
 /** Free text capturing crystal form, measurement temperature and context. */
 sourceCondition:string;
 /** Optional user-facing physical phase note in Russian. */
 note?:string;
};

export const LAB_CURATED_PROPERTY_BATCH:readonly LabCuratedPropertyBatchRow[]=[
 // ILO/WHO ICSC 0771: *pure* sodium methoxide (CAS 124-41-4), dry
 // hygroscopic crystalline powder; 1.3 g/cm3. Water REACTS violently.
 // Never substitute a methanolic sodium methoxide solution's density.
 {formula:"CH3ONa",property:"crystalDensityGPerMl",value:1.3,
  phase:"anhydrous-solid",sourceCondition:"dry sodium methylate, ICSC 0771",
  sourceUrl:"https://www.inchem.org/documents/icsc/icsc/eics0771.htm"},
 // Merck Sigma product 8.20871 is explicitly sodium ETHOXIDE POWDER.
 // "density 0.87 g/cm3 at 20C" is distinct from separately reported
 // 300 kg/m3 BULK density; neither is the 21% ethanol SOLUTION.
 {formula:"C2H5ONa",property:"crystalDensityGPerMl",value:0.87,
  phase:"anhydrous-solid",sourceCondition:"dry ethoxide powder, true material density at 20 C",
  sourceUrl:"https://www.sigmaaldrich.com/US/en/product/mm/820871"},
 // Chemister / Greenwood & Earnshaw / Seidell: specifically Fe(OH)2
 // trigonal crystal (not FeOOH/Fe(OH)3), decomposition at 150 C.
 {formula:"Fe(OH)2",property:"decompositionC",value:150,
  phase:"anhydrous-solid",sourceCondition:"crystalline iron(II) hydroxide",
  sourceUrl:"https://chemister.ru/Databases/Chemdatabase/properties-en.php?dbid=1&id=449",
  note:"Кристаллический Fe(OH)₂ разлагается при 150 °C; не кипит и не плавится как стабильная жидкость."},
 // CRC 79th ed. p.4-73, via NCBI PubChem CID 61534, explicitly
 // decomposition at 230 C of pure crystalline nickel hydroxide.
 {formula:"Ni(OH)2",property:"decompositionC",value:230,
  phase:"anhydrous-solid",sourceCondition:"dry green crystalline nickel(II) hydroxide",
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/61534",
  note:"Гидроксид никеля(II) разлагается около 230 °C до NiO и H₂O; это не плавление."},
 // WHO/IPCS Environmental Health Criteria 165 lead table: Pb(NO3)2
 // 470 C DECOMPOSES, not melts into a stable liquid or boils.
 {formula:"Pb(NO3)2",property:"decompositionC",value:470,
  phase:"anhydrous-solid",sourceCondition:"pure solid lead(II) nitrate, WHO EHC 165",
  sourceUrl:"https://www.inchem.org/documents/ehc/ehc/ehc165.htm",
  note:"Нитрат свинца(II) разлагается при 470 °C; нельзя интерпретировать это как кипение."},
 // CRC 81st ed. p.4-66 (via NIH PubChem CID 24380) reports 304 C
 // as melting of ANHYDROUS FeCl3. The ICSC 37 C figure denotes an
 // APPARENT hydrated sample that loses water. Do not mix those phases.
 {formula:"FeCl3",property:"meltingC",value:304,
  phase:"anhydrous-solid",sourceCondition:"pure anhydrous FeCl3 CRC solid 304 C, NOT hydrate 37 C",
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/24380",
  note:"Безводный FeCl₃: справочное плавление 304 °C; значение 37 °C относится к образцу с кристаллизационной водой. При контакте с водой FeCl₃ гидролизуется."}
];

/** Generated dry crystal density map (single source of truth). */
export const LAB_BATCH_CRYSTAL_DENSITIES:Readonly<Record<string,number>>=
 Object.freeze(Object.fromEntries(LAB_CURATED_PROPERTY_BATCH
  .filter(row=>row.property==="crystalDensityGPerMl")
  .map(row=>[row.formula,row.value])));

/** Generated original-phase thermal records, never aqueous solution data. */
export const LAB_BATCH_THERMAL_PROPERTIES:Readonly<Record<string,{
 meltingC?:number;boilingC?:number;decompositionC?:number;sublimationC?:number;
 behavior?:"decomposes"|"sublimes";note?:string;
}>>=Object.freeze(LAB_CURATED_PROPERTY_BATCH.reduce((out,row)=>{
 if(!["meltingC","boilingC","decompositionC","sublimationC"]
  .includes(row.property))return out;
 const entry=out[row.formula]??={};
 (entry as Record<string,number|string>)[row.property]=row.value;
 if(row.property==="decompositionC")entry.behavior="decomposes";
 if(row.property==="sublimationC")entry.behavior="sublimes";
 if(row.note)entry.note=row.note;
 return out;
},{} as Record<string,{
 meltingC?:number;boilingC?:number;decompositionC?:number;sublimationC?:number;
 behavior?:"decomposes"|"sublimes";note?:string;
}>));

/** Provenance is generated from identical rows as the runtime registry. */
export const LAB_BATCH_PROPERTY_PROVENANCE=LAB_CURATED_PROPERTY_BATCH
 .map(({formula,property,value,sourceUrl})=>
  ({formula,property,value,sourceUrl}));
