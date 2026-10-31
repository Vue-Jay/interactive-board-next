/** Independently re-evaluate published room-temperature molar Cp against
 * the *real* simulator registries. This is not a duplicate property table:
 * values below are ORIGINAL molar measurements and original molar masses,
 * so a wrong unit, phase, formula, or wiring breaks CI.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root=path.resolve(import.meta.dirname,"..");
const cache=new Map();
function load(relative){
 const filename=path.resolve(root,relative);
 if(cache.has(filename))return cache.get(filename).exports;
 const mod={exports:{}};cache.set(filename,mod);
 const js=ts.transpileModule(fs.readFileSync(filename,"utf8"),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 }).outputText;
 const local=specifier=>{
  assert.ok(specifier.startsWith("."),"Unexpected external import "+specifier);
  return load(path.relative(root,
   path.resolve(path.dirname(filename),specifier+".ts")));
 };
 new Function("require","module","exports",js)(local,mod,mod.exports);
 return mod.exports;
}
const batch=load("src/lektrusLabCuratedPropertyBatch.ts");
const heat=load("src/lektrusLabCalorimetry.ts");
const registry=load("src/lektrusLabPropertyRegistry.ts");
const provenance=load("src/lektrusLabPropertyProvenance.ts");

// [formula, source molar Cp J/(mol K), original formula weight g/mol,
//  URL, exact source crystal form]. No hydration/solution substitution.
const cases=[
 ["C",8.53,12.011,"https://pubs.usgs.gov/bul/1452/report.pdf","graphite"],
 ["Ca(NO3)2",149.37,164.090,"https://pubs.usgs.gov/bul/1452/report.pdf","anhydrous"],
 ["Mg(NO3)2",141.92,148.315,"https://pubs.usgs.gov/bul/1452/report.pdf","anhydrous"],
 ["Ca3(PO4)2",(48.24+39.68e-3*298.15-5e5/(298.15**2))*4.184,
  310.19,"https://digital.library.unt.edu/ark:/67531/metadc12739/m1/59/","alpha-crystals"],
 ["Ni(OH)2",82.01,92.708,
  "https://www.oecd-nea.org/upload/docs/application/pdf/2020-09/chemical_thermodynamics_of_nickel_volume_6.pdf",
  "beta-Ni(OH)2"],
 ["Zn(OH)2",72.27,99.39,
  "https://www.chemister.ru/Databases/Chemdatabase/properties-en.php?id=4200",
  "rhombic"]
];
for(const [formula,sourceMolarCp,sourceMolarMass,sourceUrl,form] of cases){
 const entry=batch.LAB_CURATED_PROPERTY_BATCH.filter(row=>
  row.formula===formula&&row.property==="specificHeatJPerGK");
 assert.equal(entry.length,1,"Missing or duplicate reviewed solid Cp "+formula);
 const row=entry[0];
 assert.equal(row.phase,"anhydrous-solid");
 assert.equal(row.sourceUrl,sourceUrl);
 assert.ok(row.sourceCondition.includes(form),"Wrong solid form "+formula);
 assert.ok(row.sourceCondition.includes("298.15 K"),"Missing temperature "+formula);
 const expected=sourceMolarCp/sourceMolarMass;
 assert.ok(Math.abs(row.value-expected)<0.000001,
  "Incorrect molar-to-mass Cp conversion for "+formula);
 const actual=heat.LAB_CALORIMETRY_REFERENCE[formula];
 assert.equal(actual?.phase,"solid");
 assert.equal(actual.specificJPerGK,row.value,
  "Actual simulator calorimetry missing "+formula);
 assert.equal(registry.labSubstanceProperties(formula,20).specificHeatJPerGK,
  row.value,"Physical property inspector not connected "+formula);
 assert.ok(provenance.LAB_REVIEWED_PROPERTY_DATUMS.some(p=>
  p.formula===formula&&p.property===row.property&&p.value===row.value&&
  p.sourceUrl===sourceUrl),"Source provenance missing "+formula);
}
assert.equal(cases.length,6);
console.log("Six original-form 298.15 K molar Cp sources, exact unit conversions, live simulator wiring: PASS");
