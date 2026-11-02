import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const cache=new Map();
function load(path){
 if(cache.has(path))return cache.get(path);
 const source=fs.readFileSync(path,"utf8");
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};cache.set(path,exports);
 new Function("exports","require",js)(exports,(name)=>{
  const relative=path.slice(0,path.lastIndexOf("/")+1)+name.replace(/^\.\//,"")+".ts";
  return load(relative);
 });
 return exports;
}
const bio=load("src/lektrusBioMicroscopeModel.ts");
const zoom=load("src/lektrusBioUnifiedZoomModel.ts");
const norm=zoom.BIO_ZOOM_INITIAL;
assert.deepEqual(norm,{x:0,y:0,scale:1});
assert.equal(zoom.BIO_ZOOM_GATE,2.7);
assert.equal(zoom.BIO_ZOOM_MAX,3);
assert.deepEqual(zoom.bioZoomBound({scale:100,x:99999,y:-99999}),{scale:3,x:480,y:-330});
assert.deepEqual(zoom.bioZoomBound({scale:1,x:-15,y:15}),norm);
assert.deepEqual(zoom.bioZoomPan(norm,15,12),norm);
assert.deepEqual(zoom.bioZoomAt(norm,2,{x:240,y:165}),{scale:2,x:0,y:0});
const spot={x:130,y:90};
const parentCam=zoom.bioZoomAt(norm,2.3,spot);
const screenPoint={x:(spot.x-240)*parentCam.scale+parentCam.x+240,
 y:(spot.y-165)*parentCam.scale+parentCam.y+165};
assert.ok(Math.abs(screenPoint.x-spot.x)<1e-7);
assert.ok(Math.abs(screenPoint.y-spot.y)<1e-7);
const roundtrip=zoom.bioZoomToWorld(parentCam,screenPoint);
assert.ok(Math.abs(roundtrip.x-spot.x)<1e-7&&Math.abs(roundtrip.y-spot.y)<1e-7);
assert.ok(Number.isFinite(zoom.bioZoomBound({x:NaN,y:0,scale:NaN}).x));
let paths=0,links=0;
for(const species of Object.keys(bio.BIO_ORGANISMS)){
 const nodes=bio.bioNodes(species),byId=new Map(nodes.map(n=>[n.id,n]));
 const root=nodes[0],children=zoom.bioZoomChildCandidates(nodes,root);
 assert.ok(children.length>=2,"No real branches "+species);
 const photo=zoom.bioZoomImageFor(species,root);
 if(species!=="pine")assert.equal(photo,null,"Do not use pine samples for other species");
 for(const node of nodes){
  const kids=zoom.bioZoomChildCandidates(nodes,node);
  for(const [i,child] of kids.entries()){
   links++;
   assert.equal(child.parentId,node.id);
   const spot=zoom.bioZoomPoint(species,node,child,i,kids.length);
   assert.ok(spot.x>=5&&spot.x<=480&&spot.y>=5&&spot.y<=330,"Bad anatomical coordinate "+child.id);
   assert.equal(zoom.bioZoomClosestChild(species,node,kids,spot,2)?.child.id,child.id);
  }
  if(node.level==="cell"){
   paths++;
   const chain=zoom.bioZoomPath(nodes,node.id);
   assert.deepEqual(chain.map(n=>n.level),bio.BIO_LEVELS,"Wrong depth for "+node.id);
   assert.ok(chain.every((n,i)=>n===byId.get(n.id)&&(!i||n.parentId===chain[i-1].id)));
   assert.equal(kids.length,0,"No fabricated organelles as deeper image layers");
  }
 }
}
assert.ok(paths>=60&&links>=200,"Must cover all 20 modeled species and their existing paths");
const pine=bio.bioNodes("pine");
const tree=pine[0],shoot=pine.find(n=>n.name==="Побег"),needle=pine.find(n=>n.name==="Хвоя");
const tissue=pine.find(n=>n.name==="Мезофилл хвои"),cell=pine.find(n=>n.name==="Клетка мезофилла хвои");
for(const n of [tree,shoot,needle,tissue]){
 const photo=zoom.bioZoomImageFor("pine",n);
 assert.ok(photo, "Missing same-species photographed level "+n.level);
 assert.match(photo.file,/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath/);
 assert.match(photo.source,/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
 assert.match(photo.license,/^CC/);
 assert.ok(photo.caption.includes(n.level==="organism"?"Сосна":"Pinus sylvestris"));
}
assert.equal(zoom.bioZoomImageFor("pine",cell),null,"Do not invent an intra-cell photograph");
assert.equal(zoom.bioZoomImageFor("pine",pine.find(n=>n.name==="Молодой корень")),null);
assert.equal(zoom.bioZoomImageFor("sunflower",bio.bioNodes("sunflower")[0]),null);
const camera=fs.readFileSync("src/LektrusBioUnifiedZoom.tsx","utf8");
assert.match(camera,/bioZoomClosestChild\(organism,node,candidates,imagePoint,68\)/);
assert.match(camera,/bioZoomToWorld\(old,point\)/);
assert.match(camera,/onPointerDown=\{onDown\}/);
assert.match(camera,/onPointerMove=\{onMove\}/);
assert.match(camera,/map.size>=2/);
assert.match(camera,/el.addEventListener\("wheel",onWheel,\{passive:false\}\)/);
assert.match(camera,/el.removeEventListener\("wheel",onWheel\)/);
assert.match(camera,/bioZoomPan\(cameraRef.current/);
assert.match(camera,/data-bio-zoom-target=\{child.id\}/);
assert.match(camera,/role="button" tabIndex=\{0\}/);
assert.match(camera,/onKeyDown=\{e=>\{if\(e.key==="Enter"\|\|e.key===" "\)/);
assert.match(camera,/node.level==="cell"\?setFeature:undefined/);
assert.match(camera,/Предметный|Непрерывное исследование организма/);
assert.match(camera,/разных экземпляров и препаратов/);
const app=fs.readFileSync("src/LektrusBioMicroscope.tsx","utf8");
assert.match(app,/diagram.activity==="explore"&&<LektrusBioUnifiedZoom/);
assert.ok(!app.includes("viewerMode"),"No longer split exploration between microscope and atlas");
assert.ok(!app.includes("<LektrusBioMicroscopeStage/>"));
assert.ok(app.includes("showExercise&&<>"),"Assembly and labeling must remain unchanged");
const css=fs.readFileSync("src/lektrusBioUnifiedZoom.css","utf8");
assert.match(css,/touch-action:none/);
assert.match(css,/aspect-ratio:480\/330/);
assert.match(css,/prefers-reduced-motion:reduce/);
for(const name of ["src/LektrusBioUnifiedZoom.tsx","src/LektrusBioMicroscope.tsx"]){
 const ast=ts.createSourceFile(name,fs.readFileSync(name,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,"Malformed TSX "+name);
}
console.log("Unified microscope: all 20 species traverse real anatomy, spatial proximity and anchor-preserving zoom, pinch/pan/keyboard, sample provenance and unchanged assignments OK. "+paths+" cell paths; "+links+" links.");
