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
 /** Original molar Cp at source temperature (J/mol/K), if published. */
 sourceMolarHeatJPerMolK?:number;
 /** Exact temperature of the molar Cp observation (K), if published. */
 sourceTemperatureKelvin?:number;
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
  note:"Безводный FeCl₃: справочное плавление 304 °C; значение 37 °C относится к образцу с кристаллизационной водой. При контакте с водой FeCl₃ гидролизуется."},
 // Four pure-phase properties in one source-qualified batch.
 {formula:"Ba3(PO4)2",property:"crystalDensityGPerMl",value:5.25,
  phase:"anhydrous-solid",sourceCondition:"anhydrous rhombohedral Ba3(PO4)2, XRD calculated solid density",
  sourceUrl:"https://doi.org/10.1107/S0365110X48000697",
  note:"Расчётная плотность кристаллического Ba₃(PO₄)₂, не насыпная плотность порошка."},
 {formula:"Ba3(PO4)2",property:"meltingC",value:1605,
  phase:"anhydrous-solid",sourceCondition:"dry barium phosphate congruent fusion 1605 ± 2 C, other reported >1620 C",
  sourceUrl:"https://link.springer.com/article/10.1007/s10973-010-0962-y",
  note:"Плавление безводного Ba₃(PO₄)₂: 1605 ± 2 °C, в других исследованиях более 1620 °C."},
 {formula:"Mg(CH3COO)2",property:"crystalDensityGPerMl",value:1.42,
  phase:"anhydrous-solid",sourceCondition:"anhydrous magnesium acetate crystal at 20 C, CRC 95th edition; not tetrahydrate",
  sourceUrl:"https://chemister.ru/Databases/Chemdatabase/properties-en.php?dbid=1&id=3897",
  note:"Безводный ацетат магния, 1,42 г/см³, не тетрагидрат с плотностью 1,45 г/см³."},
 {formula:"Mg(CH3COO)2",property:"decompositionC",value:323,
  phase:"anhydrous-solid",sourceCondition:"anhydrous magnesium acetate 323 C listed for both melting and decomposition",
  sourceUrl:"https://chemister.ru/Databases/Chemdatabase/properties-en.php?dbid=1&id=3897",
  note:"Безводный ацетат магния разлагается около 323 °C, без устойчивого кипения."},
 // Source-reviewed pure crystal data: USGS / GESTIS / ATSDR / CRC.
 {formula:"Mg(NO3)2",property:"decompositionC",value:330,
  phase:"anhydrous-solid",sourceCondition:"anhydrous crystalline Mg(NO3)2, IFA GESTIS decomposition temperature; hexahydrate dehydrates separately at 89 C",
  sourceUrl:"https://haber.archive.fhi.mpg.de/send/8IKpJO3bKSzf",
  note:"Безводный Mg(NO₃)₂ разлагается при 330 °C, не путать с потерей воды гидратами."},
 {formula:"PbS",property:"meltingC",value:1114,
  phase:"anhydrous-solid",sourceCondition:"crystalline cubic lead(II) sulfide PbS, ATSDR US Public Health Service table of pure lead compounds",
  sourceUrl:"https://www.ncbi.nlm.nih.gov/books/NBK589540/table/ch4.tab2/",
  note:"Плавление кристаллического PbS при 1114 °C; возгонка описана отдельно."},
 {formula:"CoS",property:"meltingC",value:1117,
  phase:"anhydrous-solid",sourceCondition:"dry cobalt(II) monosulfide CoS, CRC Handbook 95th edition; not cobalt trisulfide",
  sourceUrl:"https://pubchem.ncbi.nlm.nih.gov/compound/14832",
  note:"Кристаллический моносульфид кобальта CoS: справочная температура плавления 1117 °C."},
 {formula:"Al(OH)3",property:"specificHeatJPerGK",value:1.175968,
  phase:"anhydrous-solid",sourceCondition:"USGS 1979 monoclinic gibbsite Al(OH)3, 298.15 K Cp,mol=91.729 J/(mol K) / 78.003 g/mol; not bayerite",
  sourceUrl:"https://pubs.usgs.gov/of/1980/0908/report.pdf",
  note:"Удельная теплоёмкость чистого гиббсита при 25 °C из экспериментальной таблицы USGS."},

 // U.S. Geological Survey Bulletin 1452 (Robie, Hemingway & Fisher,
 // 1978, corrected 1979), tables at 298.15 K and 0.1 MPa.
 // Original values are Cp,mol in J/(mol K), divided by the stated
 // mass in g/mol. Never use solution/hydrate or diamond values.
 {formula:"C",property:"specificHeatJPerGK",value:0.710182,
  phase:"anhydrous-solid",
  sourceCondition:"graphite C (not diamond or charcoal); 298.15 K, 0.1 MPa; USGS Cp,mol 8.53 J/(mol K) / 12.011 g/mol",
  sourceUrl:"https://pubs.usgs.gov/bul/1452/report.pdf",
  note:"Теплоёмкость графита при 25 °C; для алмаза и аморфного углерода нужны отдельные данные."},
 {formula:"Ca(NO3)2",property:"specificHeatJPerGK",value:0.910293,
  phase:"anhydrous-solid",
  sourceCondition:"anhydrous Ca(NO3)2 crystals; 298.15 K, 0.1 MPa; USGS Cp,mol 149.37 J/(mol K) / 164.090 g/mol; not tetrahydrate",
  sourceUrl:"https://pubs.usgs.gov/bul/1452/report.pdf",
  note:"Теплоёмкость безводного нитрата кальция при 25 °C, не кристаллогидрата."},
 {formula:"Mg(NO3)2",property:"specificHeatJPerGK",value:0.956882,
  phase:"anhydrous-solid",
  sourceCondition:"anhydrous Mg(NO3)2 crystals; 298.15 K, 0.1 MPa; USGS Cp,mol 141.92 J/(mol K) / 148.315 g/mol; not hexahydrate",
  sourceUrl:"https://pubs.usgs.gov/bul/1452/report.pdf",
  note:"Теплоёмкость безводного нитрата магния при 25 °C, не гексагидрата."},
 // US Bureau of Mines Bulletin 584 (1960), p.43, Table 160:
 // Ca3(PO4)2 alpha-crystal fit 298-1373 K, Cp,mol in cal/(mol K).
 // Cp(298.15)=48.24+39.68e-3*T-5.00e5/T^2, multiply by 4.184.
 {formula:"Ca3(PO4)2",property:"specificHeatJPerGK",value:0.734394,
  phase:"anhydrous-solid",
  sourceCondition:"Ca3(PO4)2 alpha-crystals, 298.15 K, US Bureau of Mines 584 p.43; Cp,mol=(48.24+39.68e-3*T-5.00e5/T^2) cal/(mol K), T in K, /310.19 g/mol",
  sourceUrl:"https://digital.library.unt.edu/ark:/67531/metadc12739/m1/59/",
  note:"Теплоёмкость фосфата кальция в кристаллической форме, указанной в исходном экспериментальном справочнике, при 25 °C."},
 // OECD Nuclear Energy Agency, Chemical Thermodynamics of Nickel, vol.6,
 // Section V.3.2.2.2, experimentally reviewed beta-Ni(OH)2, not
 // hydrated alpha-Ni(OH)2; Cp,mol=(82.01 +/- 0.30) J/(mol K).
 {formula:"Ni(OH)2",property:"specificHeatJPerGK",value:0.884605,
  phase:"anhydrous-solid",
  sourceCondition:"beta-Ni(OH)2 crystalline phase; 298.15 K, 0.1 MPa; OECD NEA Cp,mol 82.01 +/- 0.30 J/(mol K) / 92.708 g/mol",
  sourceUrl:"https://www.oecd-nea.org/upload/docs/application/pdf/2020-09/chemical_thermodynamics_of_nickel_volume_6.pdf",
  note:"Теплоёмкость β-Ni(OH)₂ при 25 °C, не гидратированной α-фазы."},
 // Rabinovich & Khavin 1977 p.113, via Chemister: rhombic Zn(OH)2
 // Cp,mol=72.27 J/(mol K) at 298.15 K. Distinct from ZnO.
 {formula:"Zn(OH)2",property:"specificHeatJPerGK",value:0.727136,
  phase:"anhydrous-solid",
  sourceCondition:"rhombic Zn(OH)2 crystals; 298.15 K; Rabinovich & Khavin 1977 p.113, Cp,mol 72.27 J/(mol K) / 99.39 g/mol",
  sourceUrl:"https://www.chemister.ru/Databases/Chemdatabase/properties-en.php?id=4200",
  note:"Теплоёмкость кристаллического Zn(OH)₂ при 25 °C, не ZnO и не водной суспензии."}
 // Source-transcribed room-temperature crystalline Cp values. Molar
 // originals are retained so the audit can verify the real formula mass.
 // Chemister cites Rabinovich & Khavin / CRC and labels these SOLID forms.
 {formula:"KNO2",property:"specificHeatJPerGK",value:1.261996,
  phase:"anhydrous-solid",sourceMolarHeatJPerMolK:107.4,
  sourceTemperatureKelvin:298.15,
  sourceCondition:"monoclinic dry KNO2 crystal, 298.15 K, Cp,mol 107.4 J/(mol K) / 85.1033 g/mol; not aqueous nitrite",
  sourceUrl:"https://chemister.ru/Databases/Chemdatabase/properties-en.php?dbid=1&id=514"},
 {formula:"K3PO4",property:"specificHeatJPerGK",value:0.777331,
  phase:"anhydrous-solid",sourceMolarHeatJPerMolK:165,
  sourceTemperatureKelvin:298.15,
  sourceCondition:"anhydrous rhombic K3PO4 crystals, 298.15 K, Cp,mol 165 J/(mol K) / 212.264662 g/mol; not hydrated phosphate",
  sourceUrl:"https://chemister.ru/Databases/Chemdatabase/properties-en.php?dbid=1&id=527"},
 {formula:"NaH2PO4",property:"specificHeatJPerGK",value:0.975199,
  phase:"anhydrous-solid",sourceMolarHeatJPerMolK:117,
  sourceTemperatureKelvin:298,
  sourceCondition:"dry NaH2PO4 solid, 298 K, Cp,mol 117 J/(mol K) / 119.975531 g/mol; not monohydrate or aqueous stock",
  sourceUrl:"https://chemister.ru/Databases/Chemdatabase/properties-en.php?dbid=1&id=5709"},
 // US DOE Pacific Northwest Laboratory Waste Tank Safety Program, Table A.1:
 // NBS/NIST selected thermodynamic crystalline-solid data at 298.15 K.
 {formula:"Na3PO4",property:"specificHeatJPerGK",value:0.936140,
  phase:"anhydrous-solid",sourceMolarHeatJPerMolK:153.47,
  sourceTemperatureKelvin:298.15,
  sourceCondition:"anhydrous crystalline Na3PO4, 298.15 K, 1 bar, NBS Cp,mol 153.47 J/(mol K) / 163.939069 g/mol; NOT Na3PO4.12H2O",
  sourceUrl:"https://www.osti.gov/servlets/purl/6934908"},
 {formula:"K2MnO4",property:"specificHeatJPerGK",value:0.745698,
  phase:"anhydrous-solid",sourceMolarHeatJPerMolK:147,
  sourceTemperatureKelvin:298.15,
  sourceCondition:"dry green rhombic K2MnO4 crystal, 298.15 K, Cp,mol 147 J/(mol K) / 197.130644 g/mol; not KMnO4",
  sourceUrl:"https://chemister.ru/Databases/Chemdatabase/properties-en.php?dbid=1&id=512"},
 {formula:"Ag2CO3",property:"specificHeatJPerGK",value:0.407987,
  phase:"anhydrous-solid",sourceMolarHeatJPerMolK:112.5,
  sourceTemperatureKelvin:298.15,
  sourceCondition:"dry pale-yellow monoclinic Ag2CO3 crystals, 298.15 K, Cp,mol 112.5 J/(mol K) / 275.7444 g/mol; not a suspension",
  sourceUrl:"https://chemister.ru/Databases/Chemdatabase/properties-en.php?dbid=1&id=2374"},
 // Decomposition is a chemical transition, not congruent fusion.
 {formula:"K2MnO4",property:"decompositionC",value:500,
  phase:"anhydrous-solid",
  sourceCondition:"dry crystalline potassium manganate(VI), reference decomposition 500 C; hydrolysis in water is a different process",
  sourceUrl:"https://chemister.ru/Databases/Chemdatabase/properties-en.php?dbid=1&id=512",
  note:"Сухой K₂MnO₄ разлагается около 500 °C; не плавление и не переход KMnO₄."},
 {formula:"Ag2CO3",property:"decompositionC",value:120,
  phase:"anhydrous-solid",
  sourceCondition:"dry monoclinic Ag2CO3 crystals, reference decomposition at 120 C, not a stable melting point",
  sourceUrl:"https://chemister.ru/Databases/Chemdatabase/properties-en.php?dbid=1&id=2374",
  note:"Сухой Ag₂CO₃ разлагается около 120 °C; не плавится в устойчивую жидкость."},
 {formula:"Fe(CH3COO)2",property:"decompositionC",value:190,
  phase:"anhydrous-solid",
  sourceCondition:"anhydrous Fe(CH3COO)2 white crystals, CRC Handbook 90th ed. p.4-68: decomposition coincides with reported 190 C fusion",
  sourceUrl:"https://chemister.ru/Databases/Chemdatabase/properties-en.php?dbid=1&id=12170",
  note:"Безводный ацетат железа(II) разлагается около 190 °C; справочник также отмечает плавление при этой температуре, поэтому устойчивую жидкую фазу не предполагаем."}

];

/** Generated dry crystal density map (single source of truth). */
export const LAB_BATCH_CRYSTAL_DENSITIES:Readonly<Record<string,number>>=
 Object.freeze(Object.fromEntries(LAB_CURATED_PROPERTY_BATCH
  .filter(row=>row.property==="crystalDensityGPerMl")
  .map(row=>[row.formula,row.value])));

/** Solid-specific Cp imported from same scientific row as its provenance. */
export const LAB_BATCH_SOLID_SPECIFIC_HEAT:Readonly<Record<string,{
 specificJPerGK:number;phase:"solid"
}>>=Object.freeze(Object.fromEntries(LAB_CURATED_PROPERTY_BATCH
 .filter(row=>row.property==="specificHeatJPerGK")
 .map(row=>[row.formula,{specificJPerGK:row.value,phase:"solid" as const}])));

/** Generated original-phase thermal records, never aqueous solution data. */
export const LAB_BATCH_THERMAL_PROPERTIES:Readonly<Record<string,{
 meltingC?:number;boilingC?:number;decompositionC?:number;sublimationC?:number;
 behavior?:"decomposes"|"sublimes";note?:string;
}>>=Object.freeze(LAB_CURATED_PROPERTY_BATCH.reduce((out,row)=>{
 if(!["meltingC","boilingC","decompositionC","sublimationC"]
  .includes(row.property))return out;
 const entry=out[row.formula]??(out[row.formula]={});
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
