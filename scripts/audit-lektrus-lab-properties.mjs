/** Auditable coverage for real lab reagents and balanced reaction products.
 * Reads the actual TS registries. Reports missing information separately from
 * inapplicable properties (e.g. no crystal density for a gas or solution).
 * Usage:
 *   node scripts/audit-lektrus-lab-properties.mjs
 *   node scripts/audit-lektrus-lab-properties.mjs --json
 *   node scripts/audit-lektrus-lab-properties.mjs --markdown
 *   node scripts/audit-lektrus-lab-properties.mjs --verify
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const project=path.resolve(import.meta.dirname,"..");
const cache=new Map();
function load(relative){
 const filename=path.resolve(project,relative);
 if(cache.has(filename))return cache.get(filename).exports;
 const mod={exports:{}};cache.set(filename,mod);
 const source=fs.readFileSync(filename,"utf8");
 const js=ts.transpileModule(source,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
 }}).outputText;
 const local=(specifier)=>{
  if(!specifier.startsWith("."))throw Error("Unexpected import: "+specifier);
  return load(path.relative(project,
   path.resolve(path.dirname(filename),specifier+".ts")));
 };
 new Function("require","module","exports",js)(local,mod,mod.exports);
 return mod.exports;
}
const db=load("src/lektrusReactionDatabase.ts");
const catalog=load("src/lektrusLabCatalog.ts");
const registry=load("src/lektrusLabPropertyRegistry.ts");
const material=load("src/lektrusLabMaterialConstants.ts");
const thermal=load("src/lektrusLabPhysicalProperties.ts");
const heat=load("src/lektrusLabCalorimetry.ts");
const hydrate=load("src/lektrusLabHydrateReferences.ts");
const measured=load("src/lektrusLabSolubilityMeasurements.ts");
const provenance=load("src/lektrusLabPropertyProvenance.ts");
const perry=load("src/lektrusLabPerryHeatReferences.ts");
const nist=load("src/lektrusLabNistHeatReferences.ts");
const janaf=load("src/lektrusLabJanafSolidHeatReferences.ts");
const saturated=load("src/lektrusLabSaturatedSolutionReferences.ts");

const has=(value)=>typeof value==="number"&&Number.isFinite(value);
const stockRows=db.substances.map(s=>{
 const forms=catalog.labReagentForms(s);
 const gas=catalog.cabinetPhase(s)==="gas";
 const pureLiquid=catalog.LAB_NEAT_STOCK.has(s.id);
 const dry=forms.includes("g")&&!gas;
 const p=registry.labSubstanceProperties(s.id,20);
 const physical=gas?thermal.labThermalInfo(s.id,"ml"):
  pureLiquid?thermal.labThermalInfo(s.id,"ml"):
  dry?thermal.labThermalInfo(s.id,"g"):undefined;
 // This audit deliberately DOES NOT score aqueous acid stock against
 // a pure acid's boiling point or the density of a solid crystal.
 const relevant={
  solidDensity:dry,neatLiquidDensity:pureLiquid,
  thermal:dry||gas||pureLiquid,
  specificHeat:dry||pureLiquid,
  binaryWaterSolubility:dry&&s.kind==="соль"
 };
 const known={
  solidDensity:has(p.crystalDensityGPerMl),
  neatLiquidDensity:has(p.liquidDensityGPerMl),
  thermal:!!physical?.known,
  specificHeat:has(heat.LAB_CALORIMETRY_REFERENCE[s.id]?.specificJPerGK)&&
   (dry&&heat.LAB_CALORIMETRY_REFERENCE[s.id]?.phase==="solid"||
    pureLiquid&&heat.LAB_CALORIMETRY_REFERENCE[s.id]?.phase==="liquid"),
  binaryWaterSolubility:has(material.labSingleSaltSolubilityGPer100gWater(s.id,20))
 };
 const missing=Object.keys(relevant).filter(key=>relevant[key]&&!known[key]);
 return {formula:s.id,name:s.name,kind:s.kind,relevant,known,missing};
});
const allProducts=[...registry.LAB_REVIEWED_PRODUCT_IDENTITIES.values()];
const stockIds=new Set(db.substances.map(x=>x.id));
const productOnly=[...new Set(allProducts.map(x=>x.formula))]
 .filter(id=>!stockIds.has(id)).sort((a,b)=>a.localeCompare(b));
const producedOnly=productOnly.map(formula=>{
 const p=registry.labSubstanceProperties(formula,20);
 return {formula,
  molarMassKnown:has(p.molarMassGPerMol),
  solidDensityKnown:has(p.crystalDensityGPerMl),
  heatKnown:has(p.specificHeatJPerGK),
  thermalKnown:p.thermalKnown,
  binarySolubilityKnown:p.solubilityKnown};
});
const counted={};
for(const key of ["solidDensity","neatLiquidDensity","thermal","specificHeat","binaryWaterSolubility"]){
 const eligible=stockRows.filter(r=>r.relevant[key]);
 const filled=eligible.filter(r=>r.known[key]);
 counted[key]={eligible:eligible.length,filled:filled.length,
  remaining:eligible.length-filled.length,
  firstMissing:eligible.filter(r=>!r.known[key]).map(r=>r.formula)};
}
// Curated temperature knots, not fictional interpolations over gaps.
const solubilityCells=Object.entries(material.LAB_SALT_BINARY_SOLUBILITY_G_PER_100G_WATER)
 .map(([formula,values])=>({formula,
  measurements:values.filter(has).length,
  has20C:has(values[1]),
  complete:values.every(has)
 }));
const hydrateRows=hydrate.LAB_HYDRATE_SOLUBILITY_REFERENCES;
const saturationRows=saturated.LAB_SATURATED_SOLUTION_REFERENCES;
const hydrateDensities=hydrate.LAB_HYDRATE_CRYSTAL_DENSITIES;
const hydrateBases=new Set(hydrateRows.map(row=>row.baseFormula));
const cabinetBaseSet=new Set(db.substances.map(s=>s.id));
const hydrateKnownCells=hydrateRows.reduce((count,row)=>
 count+row.massGPer100gWater.filter(has).length+(row.extra?.length??0),0);
const measuredRows=measured.LAB_MEASURED_PURE_WATER_SOLUBILITIES;
const gridTemps=new Set(material.LAB_SALT_SOLUBILITY_TEMPERATURES_C);
const rawTotals={
 stock:db.substances.length,
 measuredPureWaterSourcePoints:measuredRows.length,
 measuredPureWaterStockBases:new Set(measuredRows.map(x=>x.formula)
  .filter(x=>cabinetBaseSet.has(x))).size,
 measuredPureWaterOffGridPoints:measuredRows.filter(x=>
  !gridTemps.has(x.temperatureC)).length,
 curatedSourceCheckedProperties:provenance.LAB_REVIEWED_PROPERTY_DATUMS.length,
 perryRoomTemperatureCrystalHeats:perry.LAB_PERRY_SOLID_HEAT_REFERENCES.length,
 nistRoomTemperatureSolidHeats:nist.LAB_NIST_ROOM_HEAT_REFERENCES.length,
 janafRoomTemperatureCrystalHeats:janaf.LAB_JANAF_SOLID_HEAT_REFERENCES.length,
 hydrateReferenceVariants:hydrateRows.length,
 hydrateCrystalDensityRecords:hydrateDensities.length,
 hydrateReferenceAllBases:hydrateBases.size,
 hydrateReferenceCabinetBases:[...hydrateBases].filter(x=>cabinetBaseSet.has(x)).length,
 hydrateReferenceMeasuredPoints:hydrateKnownCells,
 saturatedSolutionDensityRecords:saturationRows.length,
 saturatedSolutionDensityCabinetBases:new Set(saturationRows.map(r=>r.baseFormula)
  .filter(formula=>cabinetBaseSet.has(formula))).size,
 binarySolubilityAnyTemperature:
  solubilityCells.length+3, // NaCl and independent PbCl2/PbBr2
 binarySolubilityMeasuredPoints:
  solubilityCells.reduce((sum,x)=>sum+x.measurements,0)+12,
 binarySolubilityFullSixPoints:
  solubilityCells.filter(x=>x.complete).length+1,
 crystalDensity:db.substances.filter(s=>has(material.LAB_CRYSTAL_DENSITY_G_ML[s.id])).length,
 thermal:db.substances.filter(s=>Object.hasOwn(thermal.LAB_THERMAL_REFERENCE,s.id)).length,
 specificHeat:db.substances.filter(s=>Object.hasOwn(heat.LAB_CALORIMETRY_REFERENCE,s.id)).length,
 binarySolubility:db.substances.filter(s=>
  has(material.labSingleSaltSolubilityGPer100gWater(s.id,20))).length,
 productOnly:producedOnly.length
};
const byKind={};
for(const row of stockRows){
 const bucket=byKind[row.kind]??={total:0,rowsWithGaps:0};
 bucket.total++;
 if(row.missing.length)bucket.rowsWithGaps++;
}
const report={schemaVersion:7,rawTotals,
 measuredPureWaterSourceRows:measuredRows,
 perryRoomTemperatureCrystalHeatRows:perry.LAB_PERRY_SOLID_HEAT_REFERENCES,
 nistRoomTemperatureSolidHeatRows:nist.LAB_NIST_ROOM_HEAT_REFERENCES,
 janafRoomTemperatureCrystalHeatRows:janaf.LAB_JANAF_SOLID_HEAT_REFERENCES,
 sourceCheckedPropertyDatums:provenance.LAB_REVIEWED_PROPERTY_DATUMS,
 hydratedReferenceRows:hydrateRows,
 saturatedSolutionDensityRows:saturationRows,
 solubilityCurveDetail:solubilityCells,
 hydratesNotSimulated:[...material.LAB_HYDRATE_PHASE_REQUIRES_SPECIAL_MODEL].sort(),
 applicable:counted,byKind,
 stockWithOutstandingProperties:stockRows.filter(r=>r.missing.length).length,
 productOnly:{
  total:producedOnly.length,
  molarMassKnown:producedOnly.filter(r=>r.molarMassKnown).length,
  solidDensityKnown:producedOnly.filter(r=>r.solidDensityKnown).length,
  thermalKnown:producedOnly.filter(r=>r.thermalKnown).length,
  specificHeatKnown:producedOnly.filter(r=>r.heatKnown).length,
  formulas:producedOnly
 },
 rows:stockRows
};
if(process.argv.includes("--verify")){
 const minima=JSON.parse(fs.readFileSync(path.join(project,
  "scripts/lektrus-lab-property-minima.json"),"utf8"));
 assert.ok(rawTotals.stock>=minima.minimum.stock,
  "Stock catalog unexpectedly shrank");
 for(const [name,minimum] of Object.entries(minima.minimum)){
  if(name==="stock")continue;
  assert.ok(rawTotals[name]>=minimum,
   name+" regressed: "+rawTotals[name]+" < "+minimum);
 }
 for(const [name,value] of Object.entries(counted)){
  assert.equal(value.eligible,value.filled+value.remaining);
  assert.equal(value.remaining,value.firstMissing.length);
 }
 assert.equal(new Set(stockRows.map(r=>r.formula)).size,rawTotals.stock);
 const stockNames=new Set(db.substances.map(s=>s.id));
 const variants=new Set();
 for(const row of hydrateRows){
  // One independently measured salt can live in the source reference
  // library before becoming a selectable cabinet reagent.
  assert.ok(has(registry.labSubstanceProperties(row.baseFormula).molarMassGPerMol),
   "Hydrate references must refer to an actual valid chemical formula");
  assert.ok(!variants.has(row.hydrateFormula),
   "Duplicate hydrate crystal phase "+row.hydrateFormula);
  variants.add(row.hydrateFormula);
  assert.ok(Number.isInteger(row.waters)&&row.waters>0);
  assert.equal(row.massGPer100gWater.length,6);
  assert.ok(row.massGPer100gWater.every(x=>x===null||has(x)&&x>0));
  if(row.sourceUrl)assert.ok(row.sourceUrl.startsWith("https://"),
   "New hydrate variant must be individually sourced: "+row.hydrateFormula);
  for(const extra of row.extra??[]){
   assert.ok(has(extra.temperatureC)&&has(extra.massGPer100gWater));
   assert.ok(!hydrate.LAB_HYDRATE_KNOT_TEMPERATURES_C.includes(extra.temperatureC));
   if(extra.sourceUrl)assert.ok(extra.sourceUrl.startsWith("https://"));
   const actual=hydrate.labHydrateSolubilityAtTemperature(
    row.hydrateFormula,extra.temperatureC);
   assert.equal(actual?.massGPer100gWater,extra.massGPer100gWater);
   assert.equal(actual?.sourceUrl,
    extra.sourceUrl??row.sourceUrl??hydrate.LAB_HYDRATE_REFERENCE_SOURCE);
  }
 }
 for(const crystal of hydrateDensities){
  assert.ok(stockNames.has(crystal.baseFormula));
  assert.ok(has(crystal.densityGPerMl)&&crystal.densityGPerMl>0);
  assert.ok(crystal.sourceUrl.startsWith("https://"));
  assert.ok(!material.LAB_CRYSTAL_DENSITY_G_ML[crystal.hydrateFormula],
   "A hydrated density must not be registered as anhydrous");
 }
 // A saturated solution is a distinct 20°C aqueous material. Verify
 // the published % mass data against the independent saturation source's
 // g/100g water knots, without treating hydrate mass as dry salt mass.
 const saturationPairs=new Set();
 for(const row of saturationRows){
  assert.ok(cabinetBaseSet.has(row.baseFormula),
   "Saturation density must belong to an existing cabinet substance");
  const identity=row.baseFormula+"|"+row.saturationSolidFormula;
  assert.ok(!saturationPairs.has(identity),"Repeated saturated mixture "+identity);
  saturationPairs.add(identity);
  assert.equal(row.temperatureC,20);
  assert.ok(row.concentrationMassPercent>0&&row.concentrationMassPercent<100);
  assert.ok(row.solutionDensityGPerMl>0.9&&row.solutionDensityGPerMl<3);
  assert.ok(row.sourceUrl.startsWith("https://"));
  const hydrateSample=hydrate.labHydrateSolubilityAtTemperature(
   row.saturationSolidFormula,20);
  const solubility=hydrateSample?.massGPer100gWater??
   (row.saturationSolidFormula===row.baseFormula?
    material.labSingleSaltSolubilityGPer100gWater(row.baseFormula,20):undefined);
  if(has(solubility)){
   const expectedMassPercent=100*solubility/(100+solubility);
   assert.ok(Math.abs(expectedMassPercent-row.concentrationMassPercent)<
     Math.max(0.05,0.02*row.concentrationMassPercent),
    "Reference sources disagree on saturated mass fraction: "+identity+
    ", "+expectedMassPercent+" vs "+row.concentrationMassPercent);
  }
 }
 // Every newly imported measurement is verified against the ACTUAL
 // physical property map used by the simulator, not a duplicate test table.
 const reviewed=new Set();
 for(const entry of provenance.LAB_REVIEWED_PROPERTY_DATUMS){
  const id=entry.formula+"|"+entry.property;
  assert.ok(!reviewed.has(id),"Duplicate reviewed property: "+id);
  reviewed.add(id);
  assert.ok(stockNames.has(entry.formula),
   "Source-reviewed property must belong to the active reagent cabinet: "+id);
  assert.ok(entry.sourceUrl.startsWith("https://"),"Missing source: "+id);
  assert.ok(has(entry.value),"Non-numeric measurement: "+id);
  const actual=entry.property==="crystalDensityGPerMl"?
   material.LAB_CRYSTAL_DENSITY_G_ML[entry.formula]:
   entry.property==="specificHeatJPerGK"?
    heat.LAB_CALORIMETRY_REFERENCE[entry.formula]?.specificJPerGK:
    thermal.LAB_THERMAL_REFERENCE[entry.formula]?.[entry.property];
  assert.ok(has(actual)&&Math.abs(actual-entry.value)<.000001,
   "Measurement differs from actual lab property registry: "+id);
  if(entry.property==="specificHeatJPerGK")
   assert.equal(heat.LAB_CALORIMETRY_REFERENCE[entry.formula]?.phase,"solid");
  if(["decompositionC","sublimationC"].includes(entry.property))
   assert.equal(thermal.LAB_THERMAL_REFERENCE[entry.formula]?.behavior,
    entry.property==="decompositionC"?"decomposes":"sublimes",
    "Must explicitly distinguish chemical change from fusion/boiling: "+id);
 }
 // NIST SRD 69 records are measured for the actual pure crystal phases;
 // check exact 298.15 K Shomate conversions and published molar Cp data
 // against the simulator's REAL formula parser (not duplicated molar masses).
 const nistIds=new Set();
 for(const row of nist.LAB_NIST_ROOM_HEAT_REFERENCES){
  assert.ok(stockNames.has(row.formula),
   "NIST solid Cp formula not in the active cabinet: "+row.formula);
  assert.ok(!nistIds.has(row.formula),"Duplicate NIST heat "+row.formula);
  nistIds.add(row.formula);
  assert.equal(row.phase,"solid");
  assert.ok(row.form&&row.form.length>=9,"Missing exact solid form");
  assert.ok(row.minKelvin<=298.15&&row.maxKelvin>=298.15,
   "NIST Cp not measured/fit at ambient: "+row.formula);
  assert.ok(row.sourceUrl.startsWith("https://webbook.nist.gov/"));
  assert.notEqual(Boolean(row.shomate),row.molarHeatJPerMolK!==undefined,
   "Choose exactly one molar Cp source format: "+row.formula);
  const molarMass=registry.labSubstanceProperties(row.formula).molarMassGPerMol;
  assert.ok(has(molarMass)&&molarMass>0);
  const molarHeat=nist.labNistMolarHeatAt298K(row);
  assert.ok(has(molarHeat)&&molarHeat>0);
  assert.ok(Math.abs(molarHeat/molarMass-row.roomHeatJPerGK)<.000001,
   "NIST source molar-to-specific Cp mismatch: "+row.formula);
  const real=heat.LAB_CALORIMETRY_REFERENCE[row.formula];
  assert.equal(real?.phase,"solid","NIST source must not heat an aqueous solution");
  assert.equal(real?.specificJPerGK,row.roomHeatJPerGK,
   "NIST room Cp not wired to simulator: "+row.formula);
  assert.ok(provenance.LAB_REVIEWED_PROPERTY_DATUMS.some(p=>
   p.formula===row.formula&&p.property==="specificHeatJPerGK"&&
   p.value===row.roomHeatJPerGK&&p.sourceUrl===row.sourceUrl),
   "NIST calorimetry lacks matching traceable provenance: "+row.formula);
 }
 // Direct NIST-JANAF tables publish 298.15 K molar heat of the
 // specified DRY crystalline form, NOT solution or hydrated solid heat.
 const janafIds=new Set();
 for(const row of janaf.LAB_JANAF_SOLID_HEAT_REFERENCES){
  assert.ok(stockNames.has(row.formula),
   "JANAF source compound absent from cabinet: "+row.formula);
  assert.ok(!janafIds.has(row.formula),"Duplicate JANAF Cp "+row.formula);
  janafIds.add(row.formula);
  assert.equal(row.phase,"solid");
  assert.equal(row.temperatureKelvin,298.15);
  assert.equal(row.pressureMPa,.1);
  assert.ok(row.crystalForm.length>=10);
  assert.ok(row.sourceUrl.startsWith("https://janaf.nist.gov/tables/"));
  const mm=registry.labSubstanceProperties(row.formula).molarMassGPerMol;
  assert.ok(has(mm)&&mm>0);
  assert.ok(has(row.molarHeatJPerMolK)&&row.molarHeatJPerMolK>0);
  assert.ok(Math.abs(row.molarHeatJPerMolK/mm-row.roomHeatJPerGK)<.000001,
   "JANAF molar-to-mass Cp conversion mismatch for "+row.formula);
  const real=heat.LAB_CALORIMETRY_REFERENCE[row.formula];
  assert.equal(real?.phase,"solid");
  assert.equal(real?.specificJPerGK,row.roomHeatJPerGK);
  assert.ok(provenance.LAB_REVIEWED_PROPERTY_DATUMS.some(item=>
   item.formula===row.formula&&item.property==="specificHeatJPerGK"&&
   item.value===row.roomHeatJPerGK&&item.sourceUrl===row.sourceUrl),
   "Missing JANAF source provenance "+row.formula);
 }
 // The handbook reports crystalline molar Cp, not dry mass Cp or Cp
 // of a salt solution. Recalculate against the ACTUAL lab formula parser
 // to verify that every conversion, temperature range and identity matches.
 const perryIds=new Set();
 const temperatureK=298.15;
 for(const row of perry.LAB_PERRY_SOLID_HEAT_REFERENCES){
  assert.ok(stockNames.has(row.formula),
   "Handbook Cp formula must belong to current cabinet: "+row.formula);
  assert.ok(!perryIds.has(row.formula),"Duplicate handbook Cp: "+row.formula);
  perryIds.add(row.formula);
  assert.equal(row.phase,"solid");
  assert.ok(row.minKelvin<=temperatureK&&temperatureK<=row.maxKelvin,
   "Experimental Cp fit not valid near room temperature: "+row.formula);
  assert.equal(row.sourceUrl,perry.LAB_PERRY_HANDBOOK_SOURCE);
  const molarMass=registry.labSubstanceProperties(row.formula).molarMassGPerMol;
  assert.ok(has(molarMass)&&molarMass>0);
  const molarHeat=perry.labPerryMolarHeatCalPerMolK(row,temperatureK);
  assert.ok(has(molarHeat)&&molarHeat>0);
  const converted=molarHeat*4.184/molarMass;
  assert.ok(Math.abs(converted-row.roomHeatJPerGK)<.000001,
   "Incorrect handbook cal/mol to J/g conversion: "+row.formula);
  const actual=heat.LAB_CALORIMETRY_REFERENCE[row.formula];
  assert.equal(actual?.phase,"solid");
  assert.equal(actual?.specificJPerGK,row.roomHeatJPerGK,
   "Cp did not reach simulator calorimetry: "+row.formula);
 }
 // Every literature measurement is verified against the very same
 // helper used by the chemistry model, including 18/25/48/50°C data.
 const sourcePairs=new Set();
 for(const item of measuredRows){
  const identity=item.formula+"|"+item.temperatureC;
  assert.ok(!sourcePairs.has(identity),"Duplicate water measurement "+identity);
  sourcePairs.add(identity);
  assert.ok(cabinetBaseSet.has(item.formula),
   "Source formula is absent from cabinet "+item.formula);
  assert.ok(item.sourceUrl.startsWith("https://"),"No source "+identity);
  // A literature table at 293 K is 19.85 C, not exactly 20 C.
  // Keep the source's originally quoted Kelvin condition auditable.
  if(item.sourceTemperatureKelvin!==undefined){
   assert.equal(item.sourceTemperatureKelvin,293);
   assert.ok(Math.abs(item.temperatureC+273.15-
    item.sourceTemperatureKelvin)<1e-10,
    "Kelvin and Celsius source conditions disagree: "+identity);
   assert.ok(!gridTemps.has(item.temperatureC),
    "A 293 K source cannot silently fill the 20 C grid: "+identity);
  }
  assert.ok(has(item.temperatureC)&&has(item.sourceValue)&&item.sourceValue>=0);
  const normalized=measured.labMeasuredSolubilityGPer100gWater(item);
  assert.ok(has(normalized)&&normalized>0,
   "Source conversion to g/100 g water failed for "+identity);
  const actual=material.labSingleSaltSolubilityGPer100gWater(
   item.formula,item.temperatureC);
  assert.ok(has(actual)&&Math.abs(actual-normalized)<1e-10,
   "Measured source value does not reach simulator "+identity);
  assert.ok(material.LAB_SOLUBILITY_REFERENCE_ONLY_BINARY_PHASES.has(item.formula),
   "Phase chemistry must not be inferred from reference solubility "+identity);
 }
 assert.ok(hydrateKnownCells>0);
 assert.ok(producedOnly.every(x=>x.molarMassKnown),
  "Every existing reviewed product must have a calculable formula mass");
}
if(process.argv.includes("--json")){
 console.log(JSON.stringify(report,null,2));
}else if(process.argv.includes("--markdown")){
 const labels={
  solidDensity:"Плотность кристаллов / сухих веществ",
  neatLiquidDensity:"Плотность чистых жидкостей",
  thermal:"Фазовые переходы / разложение (подходящие формы)",
  specificHeat:"Теплоёмкость чистых твёрдых веществ и жидкостей",
  binaryWaterSolubility:"Растворимость соли в чистой воде (числовая кривая)"
 };
 const lines=[
  "### Покрытие свойств химической лаборатории",
  "",
  "Реагентов: **"+rawTotals.stock+
   "**. Формул продуктов вне шкафа: **"+rawTotals.productOnly+
   "**. Считаются только применимые свойства, не предполагаемые константы.",
  "",
  "| Справочное свойство | Заполнено | Осталось | Применимо к |",
  "|---|---:|---:|---:|"
 ];
 for(const [key,v] of Object.entries(counted))
  lines.push("| "+labels[key]+" | "+v.filled+" | "+v.remaining+" | "+v.eligible+" |");
 lines.push("",
  "Из таблиц NIST-JANAF: "+
  rawTotals.janafRoomTemperatureCrystalHeats+
  " теплоёмкостей кристаллов с исходными молярными значениями при 298,15 K.",
  "",
  "Из NIST Chemistry WebBook SRD 69: "+
  rawTotals.nistRoomTemperatureSolidHeats+
  " проверенных теплоёмкостей чистых кристаллов при 298,15 K.",
  "",
  "Из инженерного справочника Perry: "+
  rawTotals.perryRoomTemperatureCrystalHeats+
  " теплоёмкости кристаллов с измеренными диапазонами и коэффициентами.",
  "",
  "Проверенных записей с индивидуальным источником (текущая партия): "+
  rawTotals.curatedSourceCheckedProperties+".",
  "",
  "Новые измерения растворимости в чистой воде: "+
  rawTotals.measuredPureWaterSourcePoints+
  " точек у "+rawTotals.measuredPureWaterStockBases+
  " веществ, из них "+rawTotals.measuredPureWaterOffGridPoints+
  " точек при температурах вне стандартной сетки.",
  "",
  "Кристаллогидраты: "+rawTotals.hydrateReferenceVariants+
  " отдельных форм у "+rawTotals.hydrateReferenceCabinetBases+
  " веществ в шкафу (всего формул-оснований "+
  rawTotals.hydrateReferenceAllBases+"), "+rawTotals.hydrateReferenceMeasuredPoints+
  " измеренных температурных точек; плотностей гидратов: "+
  rawTotals.hydrateCrystalDensityRecords+
  ". Плотностей насыщенных растворов при 20 °C: "+
  rawTotals.saturatedSolutionDensityRecords+
  " (формул в шкафу: "+rawTotals.saturatedSolutionDensityCabinetBases+")."+
  " Эти данные не являются расчётом "+
  "насыщения безводного вещества.",
  "",
  "Кривых с измерениями: "+rawTotals.binarySolubilityAnyTemperature+
  "; измеренных узлов: "+rawTotals.binarySolubilityMeasuredPoints+
  "; полных 6-точечных рядов: "+rawTotals.binarySolubilityFullSixPoints+
  ". Кристаллизация кристаллогидратов не имитируется без учета воды.",
  "",
  "Продукты вне шкафа: молярная масса "+report.productOnly.molarMassKnown+
  "/"+producedOnly.length+", плотность твёрдой фазы "+
  report.productOnly.solidDensityKnown+"/"+producedOnly.length+
  " (не все продукты являются твёрдыми).");
 console.log(lines.join("\n"));
}else{
 console.log("Lektrus chemistry property coverage: "+rawTotals.stock+
  " cabinet entries; "+rawTotals.productOnly+" additional product formulas");
 for(const [key,v] of Object.entries(counted))
  console.log(key+": "+v.filled+"/"+v.eligible+
   " known; "+v.remaining+" remaining (first: "+
   v.firstMissing.slice(0,14).join(", ")+")");
 console.log("Unique stock formulas with applicable gaps: "+
  report.stockWithOutstandingProperties);
 console.log("NIST-JANAF verified direct crystalline Cp at 298.15 K: "+
  rawTotals.janafRoomTemperatureCrystalHeats);
 console.log("NIST SRD 69 verified solid Cp at 298.15 K: "+
  rawTotals.nistRoomTemperatureSolidHeats);
 console.log("Perry's handbook crystalline Cp at 298.15 K: "+
  rawTotals.perryRoomTemperatureCrystalHeats+
  " checked empirical molar-to-mass conversions");
 console.log("Source-checked individual property records: "+
  rawTotals.curatedSourceCheckedProperties);
 console.log("Source-traced pure-water solubility: "+
  rawTotals.measuredPureWaterSourcePoints+" exact measured points, "+
  rawTotals.measuredPureWaterStockBases+" stock compounds, "+
  rawTotals.measuredPureWaterOffGridPoints+" off-grid temperatures");
 console.log("Hydrate reference: "+
  rawTotals.hydrateReferenceVariants+" distinct hydrate phases, "+
  rawTotals.hydrateReferenceCabinetBases+" cabinet formulas out of "+
  rawTotals.hydrateReferenceAllBases+" reference formulas, "+
  rawTotals.hydrateReferenceMeasuredPoints+" measured exact temperature points, "+
  rawTotals.hydrateCrystalDensityRecords+" hydrate crystal densities");
 console.log("Saturated water solution: "+
  rawTotals.saturatedSolutionDensityRecords+
  " verified density/mass fraction pairs at 20 °C, "+
  rawTotals.saturatedSolutionDensityCabinetBases+" stock compounds");
 console.log("Measured solubility knots: "+rawTotals.binarySolubilityMeasuredPoints+
  ", curves with any data: "+rawTotals.binarySolubilityAnyTemperature+
  ", complete 6-knot curves: "+rawTotals.binarySolubilityFullSixPoints);
 console.log("Product-only molecular masses: "+
  report.productOnly.molarMassKnown+"/"+report.productOnly.total);
 if(process.argv.includes("--verify"))
  console.log("Coverage minima and product mass audit: PASS");
}
