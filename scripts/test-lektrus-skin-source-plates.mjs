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
const humanFile=folder+"/skin-human-cdc-phil14586.jpg";
const human=fs.readFileSync(humanFile);
assert.ok(human.length>100000&&human.length<400000);
assert.equal(human[0],0xff);assert.equal(human[1],0xd8);
assert.equal(human.at(-2),0xff);assert.equal(human.at(-1),0xd9);
assert.equal(crypto.createHash("sha256").update(human).digest("hex"),
 "179fba0d9ef1929b2aba7f193a212c896a28f3a2dd82f4198298066fa3355393");
const provenance=fs.readFileSync(folder+"/cdc-phil14586-provenance.txt","utf8");
assert.match(provenance,/CDC PHIL 14586/);
assert.match(provenance,/50x/);
assert.match(provenance,/micrometre-per-pixel calibration are NOT specified/);
assert.match(provenance,/www\.cdc\.gov\/phil\/Details\.aspx\?pid=14586/);
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
assert.match(catalog,/speciesVerified:"human"/);
assert.match(catalog,/micronsPerPixel:null/);
assert.match(catalog,/sourcePhotoMagnification:50/);
assert.match(catalog,/skin-human-cdc-phil14586.jpg/);
assert.match(catalog,/sourceUrl:"https:\/\/histologyguide\.org\/slideview\/MH-091bhr-thick-skin/);
assert.match(catalog,/micronsPerPixel:\.3171/);
assert.match(catalog,/usage:"external-viewer-only"/);
assert.match(catalog,/hairFolliclesExpected:false/);
const component=fs.readFileSync("src/LektrusSkinSpecimens.tsx","utf8");
const jsx=ts.createSourceFile("LektrusSkinSpecimens.tsx",component,
 ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(jsx.parseDiagnostics.length,0);
assert.match(component,/\<details/);
assert.match(component,/не кадры увеличения выбранного тела/);
assert.match(component,/loading="lazy"/);
assert.match(component,/useState<SkinReferenceType>\("human"\)/);
assert.match(component,/role="group"/);
assert.match(component,/aria-pressed=\{selectedId===sample\.id\}/);
assert.match(component,/SKIN_CALIBRATED_EXTERNAL_REFERENCES\.map/);
assert.match(catalog,/MH-090-thin-skin/);
assert.match(catalog,/MH-086b-scalp/);
assert.match(catalog,/MH-091bhr-thick-skin/);
assert.match(catalog,/siteVerified:true/g);
assert.match(component,/0,3171 мкм/);
assert.match(component,/Их копии не входят в офлайн-пакет/);
assert.match(component,/не к картинке Lektrus/);
assert.match(component,/item\.licenseUrl/);
assert.match(component,/item\.originalUrl/);
const main=fs.readFileSync("src/LektrusHumanAnatomy.tsx","utf8");
assert.match(main,/\<LektrusSkinSpecimens\//);
assert.match(main,/system==="integumentary"/);
const ci=fs.readFileSync(".github/workflows/lectris-check.yml","utf8");
assert.match(ci,/test-lektrus-skin-source-plates\.mjs/);
console.log("Verified human skin: CDC 50x public domain original, thumb scale as external-only resource.\nReal skin plates PASS: original offline H&E JPEGs, provenance, attribution, no false world-space registration.");
