import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const load=path=>{
 const source=fs.readFileSync(path,"utf8");
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function("exports",output)(exports);return exports;
};
const alt=load("src/lektrusBioAlternativeAtlas.ts");
const plates=load("src/lektrusBioHistologyModel.ts");
const {BIO_HISTOLOGY_PLATES,bioHistologyFor,bioHistologyChildSpot}=plates;
const entries=Object.entries(BIO_HISTOLOGY_PLATES);
assert.equal(entries.length,11,"Expect eleven anatomically distinct zoom plates");
assert.equal(new Set(entries.map(([,v])=>v.id)).size,entries.length);
assert.deepEqual(Object.keys(alt.BIO_ALTERNATIVE_SPECIES),["sponge","hydra","moss","chlamydomonas","spirogyra"]);
for(const [nodeId,plate] of entries){
 const speciesId=nodeId.split("/")[0];
 const species=alt.BIO_ALTERNATIVE_SPECIES[speciesId];
 assert.ok(species,"Unknown species "+nodeId);
 const node=species.nodes.find(n=>n.id===nodeId);
 assert.ok(node,"Missing real atlas node for plate "+nodeId);
 assert.equal(bioHistologyFor(nodeId),plate);
 assert.equal(plate.title.length>6,true);
 assert.ok(plate.subtitle.length>30,"A plate needs scientifically meaningful annotation: "+nodeId);
 assert.ok(/^https:\/\//.test(plate.source),"Missing scientific source: "+nodeId);
 const kids=alt.bioAltChildren(species,nodeId);
 assert.deepEqual(Object.keys(plate.children).sort(),kids.map(k=>k.id).sort(),
  "All direct children need their own verified anatomy hotspot: "+nodeId);
 for(const child of kids){
  const spot=bioHistologyChildSpot(nodeId,child.id);
  assert.ok(spot);
  assert.ok(spot.x>=50&&spot.x<=430&&spot.y>=45&&spot.y<=295,"Landmark off artwork: "+child.id);
  assert.deepEqual(spot,plate.children[child.id]);
  assert.equal(species.nodes.some(n=>n.id===child.id),true);
 }
 assert.equal(new Set(kids.map(k=>JSON.stringify(bioHistologyChildSpot(nodeId,k.id)))).size,kids.length,
  "Child landmark positions overlap: "+nodeId);
}
assert.equal(bioHistologyFor("sponge"),null,"Do not masquerade silhouette as microscopy");
assert.equal(bioHistologyFor("frog"),null,"No anatomy for an unspecified organism");
assert.equal(bioHistologyChildSpot("hydra","moss/gametophyte"),null,"Prevent cross-species hotspots");
assert.equal(bioHistologyChildSpot("spirogyra/filament/cell","spirogyra/filament"),null,"Child must be direct");
const visual=fs.readFileSync("src/LektrusBioHistologyPlate.tsx","utf8");
for(const id of entries.map(([,info])=>info.id))
 assert.ok(visual.includes('"'+id+'"'),"Missing rendered plate "+id);
assert.ok(visual.includes("<Callout"),"Microscopic structures need labelled callouts");
assert.ok(visual.includes("data-bio-histology-plate={info.id}"));
assert.equal(visual.includes("<image"),false,"Diagrams must be offline and original");
for(const f of ["src/LektrusBioAlternativeView.tsx","src/LektrusBioHistologyPlate.tsx"]){
 const code=fs.readFileSync(f,"utf8");
 const parsed=ts.createSourceFile(f,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,f+" has TSX parse errors");
}
const view=fs.readFileSync("src/LektrusBioAlternativeView.tsx","utf8");
assert.match(view,/bioHistologyChildSpot\(node\.id,child\.id\)\?\?child\.spot/,
 "Selected microscopy plate must override inherited child hotspots");
assert.match(view,/bioHistologyFor\(node\.id\)/);
assert.match(view,/<LektrusBioHistologyPlate nodeId=\{node\.id\}/);
assert.match(view,/setZoom\(v=>Math\.min\(2,/);
assert.match(view,/setZoom\(v=>Math\.max\(1,/);
assert.match(view,/setZoom\(1\)/,"Zoom must reset after navigation");
assert.match(view,/href=\{microPlate\.source\}/,"User must be able to access a plate's source");
const css=fs.readFileSync("src/lektrusBioMicroscope.css","utf8");
assert.match(css,/\.lektrus-bio-alt-zoom-control/);
assert.match(css,/\.lektrus-bio-histology-label text/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
console.log("Biology histology atlas:",entries.length,
 "species-specific vector plates; all child hotspots, scientific links, keyboard-safe zoom and existing graph compatibility verified");
