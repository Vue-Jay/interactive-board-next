import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=fs.readFileSync("src/lektrusBioMicroscopeSlides.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};new Function("exports",js)(exports);
const {BIO_MICROSCOPE_SLIDES,bioStageBound,bioStageZoomAt,bioStageMove}=exports;
assert.equal(BIO_MICROSCOPE_SLIDES.length,5,"At least five genuine microscopy slides");
const ids=new Set();
for(const slide of BIO_MICROSCOPE_SLIDES){
 assert.ok(!ids.has(slide.id));ids.add(slide.id);
 assert.ok(slide.name.length>14&&slide.subject.length>4);
 assert.match(slide.image,/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//);
 assert.match(slide.source,/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
 assert.match(slide.license,/^CC/);
 assert.ok(slide.author.length>=7);
 assert.ok(slide.detail.length>58);
}
assert.equal(BIO_MICROSCOPE_SLIDES[0].subject,"Pinus sylvestris");
assert.equal(BIO_MICROSCOPE_SLIDES.find(s=>s.id==="epidermis").subject,"Allium cepa");
assert.ok(BIO_MICROSCOPE_SLIDES.some(s=>s.id==="stomata"));
const zero={x:0,y:0,zoom:1};
assert.deepEqual(bioStageBound(zero,600,400),zero);
assert.deepEqual(bioStageMove(zero,100,100,600,400),zero,"Cannot pan beyond image when zoom=1");
assert.deepEqual(bioStageZoomAt(zero,2,0,0,600,400),{x:0,y:0,zoom:2});
assert.deepEqual(bioStageMove({x:0,y:0,zoom:2},400,-230,600,400),{x:300,y:-200,zoom:2});
assert.deepEqual(bioStageZoomAt(zero,2,120,45,600,400),{x:-120,y:-45,zoom:2});
assert.deepEqual(bioStageZoomAt({x:-120,y:-45,zoom:2},1,120,45,600,400),zero);
assert.equal(bioStageBound({x:999999,y:-999999,zoom:99},400,250).zoom,12);
assert.equal(bioStageBound({x:NaN,y:0,zoom:1},600,400).y,0);
const stage=fs.readFileSync("src/LektrusBioMicroscopeStage.tsx","utf8");
for(const control of ["onPointerDown={down}","onPointerMove={move}","onPointerUp={end}",
 "onPointerCancel={end}","onKeyDown={keyboard}","type=\"file\"",
 "URL.createObjectURL","URL.revokeObjectURL","setFocus(0)","aria-label=\"Яркость осветителя\"",
 "aria-label=\"Фокусировочный винт\"","role=\"region\"","aria-pressed={i===objective}"])
 assert.ok(stage.includes(control),"Microscope missing functional control: "+control);
assert.match(stage,/element.addEventListener\("wheel",handleWheel,\{passive:false\}\)/);
assert.match(stage,/element.removeEventListener\("wheel",handleWheel\)/);
assert.match(stage,/event.preventDefault\(\)/);
assert.match(stage,/bioStageZoomAt\(v,v.zoom\*Math\.exp/);
assert.match(stage,/map.size>=2/);
assert.match(stage,/if\(!file\|\|!file.type.startsWith\("image\/"\)\|\|file.size>24\*1024\*1024\)return/);
assert.match(stage,/!broken&&!loaded/);
assert.match(stage,/Масштабная линейка не используется без калибровки/);
const app=fs.readFileSync("src/LektrusBioMicroscope.tsx","utf8");
assert.match(app,/viewerMode==="microscope"&&<LektrusBioMicroscopeStage\/>/);
assert.match(app,/diagram.activity!=="explore"\|\|viewerMode==="atlas"/);
assert.match(app,/aria-pressed=\{viewerMode==="atlas"\}/);
assert.match(app,/setViewerMode\("microscope"\)/);
const css=fs.readFileSync("src/lektrusBioMicroscopeStage.css","utf8");
assert.match(css,/touch-action:none/);
assert.match(css,/\.lektrus-bio-photo-image/);
assert.match(css,/\.lektrus-bio-photo-vignette/);
for(const name of ["src/LektrusBioMicroscopeStage.tsx","src/LektrusBioMicroscope.tsx"]){
 const ast=ts.createSourceFile(name,fs.readFileSync(name,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,name+" has malformed TSX");
}
console.log("Bio photo microscope: 5 licensed actual images, bounded XY stage, centered zoom, focus/light control, wheel and multitouch, local upload, separate atlas and assignment safety passed.");
