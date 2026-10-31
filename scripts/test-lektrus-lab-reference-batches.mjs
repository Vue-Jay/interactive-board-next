/** Continuous verification of the ONE-FILE source batch ingestion contract. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const root=path.resolve(import.meta.dirname,"..");
const cache=new Map();
function load(relative){
 const p=path.resolve(root,relative);
 if(cache.has(p))return cache.get(p).exports;
 const mod={exports:{}};cache.set(p,mod);
 const src=fs.readFileSync(p,"utf8");
 const js=ts.transpileModule(src,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
 }}).outputText;
 const requireLocal=specifier=>{
  if(!specifier.startsWith("."))throw Error("Nonlocal dependency: "+specifier);
  return load(path.relative(root,path.resolve(path.dirname(p),specifier+".ts")));
 };
 new Function("require","module","exports",js)(requireLocal,mod,mod.exports);
 return mod.exports;
}
const batch=load("src/lektrusLabReferenceBatches.ts");
const registry=load("src/lektrusLabPropertyRegistry.ts");
const material=load("src/lektrusLabMaterialConstants.ts");
const heat=load("src/lektrusLabCalorimetry.ts");
const thermal=load("src/lektrusLabPhysicalProperties.ts");
const water=load("src/lektrusLabSolubilityMeasurements.ts");
const hydrate=load("src/lektrusLabHydrateReferences.ts");
const provenance=load("src/lektrusLabPropertyProvenance.ts");
const db=load("src/lektrusReactionDatabase.ts");
const stocks=new Set(db.substances.map(x=>x.id));
const seenBatch=new Set(),seenProperties=new Set(),seenWater=new Set();
const existingProvenance=new Set(provenance.LAB_REVIEWED_PROPERTY_DATUMS
 .map(x=>x.formula+":"+x.property));
assert.equal(existingProvenance.size,provenance.LAB_REVIEWED_PROPERTY_DATUMS.length,
 "Duplicate full property identity across legacy and batch references");
for(const data of batch.LAB_REFERENCE_BATCHES){
 assert.ok(data.id&&/^20\d\d-\d\d-\d\d-/.test(data.id));
 assert.ok(!seenBatch.has(data.id),"Duplicate batch identifier "+data.id);
 seenBatch.add(data.id);
 assert.ok(Array.isArray(data.dry)&&Array.isArray(data.water)&&
  Array.isArray(data.hydrates));
 for(const x of data.dry){
  assert.ok(stocks.has(x.formula));
  assert.equal(x.phase,"anhydrous-solid");
  assert.ok(x.sourceUrl.startsWith("https://"));
  assert.ok(Number.isFinite(x.value)&&x.value>0);
  const key=x.formula+":"+x.property;
  assert.ok(!seenProperties.has(key),"Repeated dry property "+key);
  seenProperties.add(key);
  const actual=registry.labSubstanceProperties(x.formula);
  const expected=x.property==="crystalDensityGPerMl"?
   material.LAB_CRYSTAL_DENSITY_G_ML[x.formula]:
   x.property==="specificHeatJPerGK"?
    heat.LAB_CALORIMETRY_REFERENCE[x.formula]?.specificJPerGK:
   thermal.LAB_THERMAL_REFERENCE[x.formula]?.[x.property];
  assert.equal(expected,x.value,key+" source mismatch");
  if(x.property==="crystalDensityGPerMl")
   assert.equal(actual.crystalDensityGPerMl,x.value);
  if(x.property==="specificHeatJPerGK")
   assert.equal(actual.specificHeatJPerGK,x.value);
  assert.ok(provenance.LAB_REVIEWED_PROPERTY_DATUMS.some(row=>
   row.formula===x.formula&&row.property===x.property&&
   row.value===x.value&&row.sourceUrl===x.sourceUrl));
 }
 for(const x of data.water){
  assert.ok(stocks.has(x.formula)&&x.sourceUrl.startsWith("https://"));
  assert.ok(Number.isFinite(x.sourceValue)&&x.sourceValue>0);
  assert.ok(Number.isFinite(x.temperatureC)&&x.temperatureC>=0&&x.temperatureC<=100);
  const key=x.formula+":"+x.temperatureC;
  assert.ok(!seenWater.has(key),"Duplicate batch water datum "+key);
  seenWater.add(key);
  const observed=water.LAB_MEASURED_PURE_WATER_SOLUBILITIES
   .filter(row=>row.formula===x.formula&&row.temperatureC===x.temperatureC);
  assert.equal(observed.length,1,"Missing or duplicated original water sample "+key);
  const normalized=water.labMeasuredSolubilityGPer100gWater(x);
  assert.ok(Number.isFinite(normalized)&&normalized>0);
  assert.equal(material.labSingleSaltSolubilityGPer100gWater(
   x.formula,x.temperatureC),normalized);
  assert.ok(material.LAB_SOLUBILITY_REFERENCE_ONLY_BINARY_PHASES.has(x.formula),
   "Source water value must NEVER invent hydrated/anhydrous crystals");
  if(x.temperatureC===20)assert.equal(material.LAB_SALT_BINARY_SOLUBILITY_G_PER_100G_WATER
   [x.formula]?.[1],normalized);
 }
 for(const x of data.hydrates){
  assert.ok(stocks.has(x.baseFormula));
  assert.ok(x.sourceUrl.startsWith("https://"));
  assert.ok(x.waters>0&&Number.isInteger(x.waters));
  assert.equal(x.massGPer100gWater.length,6);
  assert.ok(x.massGPer100gWater.some(v=>v!==null));
  assert.ok(hydrate.LAB_HYDRATE_SOLUBILITY_REFERENCES.some(r=>
   r.hydrateFormula===x.hydrateFormula&&r.waters===x.waters));
  for(const [index,original]of x.massGPer100gWater.entries()){
   const temp=hydrate.LAB_HYDRATE_KNOT_TEMPERATURES_C[index];
   const actual=hydrate.labHydrateSolubilityAtTemperature(x.hydrateFormula,temp);
   if(original===null)assert.equal(actual,undefined);
   else{
    assert.ok(original>0&&Number.isFinite(original));
    assert.equal(actual.massGPer100gWater,original);
    assert.equal(actual.sourceUrl,x.sourceUrl);
    assert.equal(actual.waters,x.waters);
   }
  }
  assert.ok(!water.LAB_MEASURED_PURE_WATER_SOLUBILITIES.some(row=>
   row.formula===x.hydrateFormula),
   "Hydrate data cannot silently enter anhydrous solubility registry");
 }
}
for(const formula of Object.keys(batch.LAB_BATCH_SOLID_DENSITIES))
 assert.ok(stocks.has(formula));
assert.equal(material.LAB_CRYSTAL_DENSITY_G_ML.KNO2,1.915);
assert.equal(material.LAB_CRYSTAL_DENSITY_G_ML.Na3PO4,2.54);
assert.equal(material.LAB_CRYSTAL_DENSITY_G_ML.K3PO4,2.564);
assert.equal(material.LAB_CRYSTAL_DENSITY_G_ML.CH3ONa,1.3);
const calcium=hydrate.labHydrateSolubilityAtTemperature("Ca(CH3COO)2·2H2O",20);
assert.equal(calcium?.massGPer100gWater,34.7);
assert.equal(material.labSingleSaltSolubilityGPer100gWater("Ca(CH3COO)2",20),undefined);
console.log("Reviewed lab batches:",seenBatch.size,"; dry:",seenProperties.size,
 "; original water:",seenWater.size,"; hydrate phases:",
 batch.LAB_BATCH_HYDRATES.length,"; no duplicate or phase substitution");
