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
const rawTotals={
 stock:db.substances.length,
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
const report={schemaVersion:2,rawTotals,
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
 console.log("Measured solubility knots: "+rawTotals.binarySolubilityMeasuredPoints+
  ", curves with any data: "+rawTotals.binarySolubilityAnyTemperature+
  ", complete 6-knot curves: "+rawTotals.binarySolubilityFullSixPoints);
 console.log("Product-only molecular masses: "+
  report.productOnly.molarMassKnown+"/"+report.productOnly.total);
 if(process.argv.includes("--verify"))
  console.log("Coverage minima and product mass audit: PASS");
}
