import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=fs.readFileSync(new URL("../src/lektrusHistoricalReferences.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const lib={};new Function("exports",js)(lib);
const {historicalReferences,findHistoricalReference}=lib;
assert.ok(historicalReferences.length>=20);
assert.equal(new Set(historicalReferences.map(r=>r.id)).size,historicalReferences.length);
for(const r of historicalReferences){
 assert.ok(r.aliases.includes(r.title)||r.aliases.length>0);
 assert.ok(r.from<=r.to&&r.description.length>30&&r.change.length>20);
 assert.ok(r.sourceUrl.startsWith("https://"));
 assert.equal(findHistoricalReference(r.aliases[0],r.from)?.id,r.id);
 assert.equal(findHistoricalReference(r.aliases[0],2026),undefined);
}
assert.equal(findHistoricalReference("СССР",1945)?.id,"ussr");
assert.equal(findHistoricalReference("USSR",1945)?.id,"ussr");
assert.equal(findHistoricalReference("Римская империя",1300),undefined);
assert.equal(findHistoricalReference("неизвестная империя",1914),undefined);
const atlas=fs.readFileSync(new URL("../src/LektrusMapAtlas.tsx",import.meta.url),"utf8");
assert.match(atlas,/findHistoricalReference/);
assert.match(atlas,/reference\.sourceUrl/);
console.log("Historical reference: verified entries, exact name matching, period restrictions and links.");
