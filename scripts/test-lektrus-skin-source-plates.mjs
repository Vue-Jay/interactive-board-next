import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import ts from "typescript";
const folder="src/assets/bio-atlas/specimens";
const fixtures=[
 ["skin-thin-bhavya-akula-cc-by-sa4.jpg","5f74f84105b13bdc7dc880d3bc38ef2bc2404d07"],
 ["skin-thick-bhavya-akula-cc-by-sa4.jpg","9eba91a3b2060e7d626a301ef1e278fa9897ebb6"]
];
for(const [filename,sha1] of fixtures){
 const bytes=fs.readFileSync(folder+"/"+filename);
 assert.ok(bytes.length>=200000&&bytes.length<350000);
 assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);
 assert.equal(bytes.at(-2),0xff);assert.equal(bytes.at(-1),0xd9);
 assert.equal(crypto.createHash("sha1").update(bytes).digest("hex"),sha1,
  "Original creative-commons microscopy slide changed unexpectedly");
}
const catalog=fs.readFileSync("src/lektrusSkinSpecimenCatalog.ts","utf8");
const src=ts.createSourceFile("catalog.ts",catalog,ts.ScriptTarget.Latest,true);
assert.equal(src.parseDiagnostics.length,0);
for(const [filename,sha1] of fixtures){
 assert.ok(catalog.includes(filename));
 assert.ok(catalog.includes(sha1));
}
assert.match(catalog,/kind:"independent-reference-specimen"/);
assert.match(catalog,/CC BY-SA 4\.0/g);
assert.match(catalog,/sampleOrigin:/);
assert.match(catalog,/stratumLucidumExpected:true/);
assert.match(catalog,/hairFolliclesExpected:false/);
const component=fs.readFileSync("src/LektrusSkinSpecimens.tsx","utf8");
const jsx=ts.createSourceFile("LektrusSkinSpecimens.tsx",component,
 ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(jsx.parseDiagnostics.length,0);
assert.match(component,/\<details/);
assert.match(component,/не кадры увеличения выбранного тела/);
assert.match(component,/loading="lazy"/);
assert.match(component,/item\.licenseUrl/);
assert.match(component,/item\.originalUrl/);
const main=fs.readFileSync("src/LektrusHumanAnatomy.tsx","utf8");
assert.match(main,/\<LektrusSkinSpecimens\//);
assert.match(main,/system==="integumentary"/);
const ci=fs.readFileSync(".github/workflows/lectris-check.yml","utf8");
assert.match(ci,/test-lektrus-skin-source-plates\.mjs/);
console.log("Real skin plates PASS: original offline H&E JPEGs, provenance, attribution, no false world-space registration.");
