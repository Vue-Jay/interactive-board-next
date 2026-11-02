import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const compile=(file)=>{
 const source=fs.readFileSync(file,"utf8");
 const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const exports={};new Function("exports",result.outputText)(exports);return exports;
};
const bio=compile("src/lektrusBioAlternativeAtlas.ts");
const motion=compile("src/lektrusBioAtlasMotion.ts");
const {BIO_MOTIONS,bioMotionFor}=motion;
const ids=["water-current","choanocyte-beat","tentacle-sway","nematocyst-discharge",
 "moss-sway","spore-release","flagellar-swim","light-sensing","spiral-chloroplast","conjugation"];
assert.deepEqual(Object.keys(BIO_MOTIONS),ids);
const fetchMotion=(organism,nodeId)=>{
 const species=bio.BIO_ALTERNATIVE_SPECIES[organism];
 const node=species.nodes.find(item=>item.id===nodeId);
 assert.ok(node,"unknown test node: "+nodeId);
 return bioMotionFor(organism,node);
};
for(const [species,nodeId,motionId] of [
 ["sponge","sponge","water-current"],
 ["sponge","sponge/water","water-current"],
 ["sponge","sponge/water/chamber/choanocyte","choanocyte-beat"],
 ["hydra","hydra","tentacle-sway"],
 ["hydra","hydra/tentacle","tentacle-sway"],
 ["hydra","hydra/tentacle/epidermis/cnidocyte","nematocyst-discharge"],
 ["hydra","hydra/tentacle/epidermis/cnidocyte/nematocyst","nematocyst-discharge"],
 ["moss","moss","moss-sway"],
 ["moss","moss/gametophyte","moss-sway"],
 ["moss","moss/sporophyte/capsule","spore-release"],
 ["moss","moss/spore","spore-release"],
 ["chlamydomonas","chlamydomonas","flagellar-swim"],
 ["chlamydomonas","chlamydomonas/flagella","flagellar-swim"],
 ["chlamydomonas","chlamydomonas/eyespot","light-sensing"],
 ["spirogyra","spirogyra","spiral-chloroplast"],
 ["spirogyra","spirogyra/filament/cell","spiral-chloroplast"],
 ["spirogyra","spirogyra/conjugation","conjugation"],
 ["spirogyra","spirogyra/zygospore","conjugation"]
])assert.equal(fetchMotion(species,nodeId)?.id,motionId,"Incorrect lesson selected: "+nodeId);
for(const [species,id] of [
 ["sponge","sponge/mesohyl"],["hydra","hydra/basal"],["moss","moss/sporophyte/seta"],
 ["chlamydomonas","chlamydomonas/nucleus"],["spirogyra","spirogyra/filament/cell/nucleus"]
])assert.equal(fetchMotion(species,id),null,"Unknown cells must not inherit invented animation");
for(const info of Object.values(BIO_MOTIONS)){
 assert.ok(info.name.length>5&&info.description.length>40);
 assert.ok(info.sourceUrl.startsWith("https://"));
 assert.ok(["loop","once"].includes(info.mode));
 assert.ok(!/universal|generic/i.test(info.description));
}
for(const id of ["nematocyst-discharge","spore-release","conjugation"])
 assert.equal(BIO_MOTIONS[id].mode,"once","Irreversible event must never auto-loop: "+id);
for(const id of ["water-current","choanocyte-beat","flagellar-swim"])
 assert.equal(BIO_MOTIONS[id].mode,"loop");
for(const file of ["src/LektrusBioMotionLayer.tsx","src/LektrusBioAlternativeView.tsx"]){
 const source=fs.readFileSync(file,"utf8");
 const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,file+" malformed TSX");
}
const view=fs.readFileSync("src/LektrusBioAlternativeView.tsx","utf8");
assert.match(view,/bioMotionFor\(species\.id,node\)/);
assert.match(view,/<LektrusBioMotionLayer motion=\{motion\} playing=\{playing\} replay=\{replay\}\/>/);
assert.match(view,/onClick=\{\(\)=>setReplay\(n=>n\+1\)\}/,"One-shot replay must be explicit");
assert.match(view,/onClick=\{\(\)=>setPlaying\(p=>!p\)\}/,"Pause must control real motion");
assert.match(view,/className="lektrus-bio-alt-plate" key=\{node\.id\}/,"Diagram stage transitions must follow selected node");
assert.match(view,/Источник процесса: /);
const layer=fs.readFileSync("src/LektrusBioMotionLayer.tsx","utf8");
assert.match(layer,/pointerEvents="none"/,"Animation overlays must not block hotspots");
assert.match(layer,/oneShot\?motion\.id\+"-"\+replay:motion\.id/,"One-shot must restart by React key");
assert.match(layer,/const active=motion\.mode==="loop"\?playing:replay>0/);
for(const id of ids)assert.ok(layer.includes('motion.id==="'+id+'"'),"Missing vector overlay "+id);
const css=fs.readFileSync("src/lektrusBioMicroscope.css","utf8");
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(css,/\.lektrus-bio-motion\.is-paused \*\{animation-play-state:paused!important\}/);
for(const keyframe of ["lektrus-bio-inflow","lektrus-bio-outflow","lektrus-bio-sting",
 "lektrus-bio-spore-fly","lektrus-bio-cilium","lektrus-bio-gamete-flow","lektrus-bio-plate-arrive"])
 assert.ok(css.includes("@keyframes "+keyframe),"Missing motion CSS "+keyframe);
console.log("Biology animated atlas:",ids.length,"individually documented processes; manual event controls, accessible hotspots, reduced motion and stage crossfades OK");
