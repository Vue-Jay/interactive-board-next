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
// Cross-layer focus is an actual camera flight, not an instant jump that
// destroys the previous camera state. Screen-space hit radius stays physical.
const portal=zoom.bioZoomPortalCamera(norm,{x:132,y:115});
assert.equal(portal.scale,zoom.BIO_ZOOM_GATE);
assert.deepEqual(zoom.bioZoomScreenPoint(portal,{x:132,y:115}),{x:240,y:165});
const portalRoundTrip=zoom.bioZoomToWorld(portal,{x:240,y:165});
assert.ok(Math.abs(portalRoundTrip.x-132)<1e-8&&Math.abs(portalRoundTrip.y-115)<1e-8);
assert.deepEqual(zoom.bioZoomPortalCamera({x:0,y:0,scale:3},{x:240,y:165}),{x:0,y:0,scale:3});
assert.deepEqual(zoom.bioZoomPortalCamera(norm,{x:0,y:0}),
 {scale:2.7,x:240*(2.7-1),y:165*(2.7-1)},"Focus near edge must never show void past the photograph");
assert.equal(zoom.bioZoomHitRadius(norm),52);
assert.ok(Math.abs(zoom.bioZoomHitRadius({x:0,y:0,scale:3})-52/3)<1e-8);
for(const scale of [1,1.2,1.7,2.2,2.7,3]){
 const cam=zoom.bioZoomBound({scale,x:0,y:0});
 assert.ok(Math.abs(zoom.bioZoomHitRadius(cam)*scale-52)<1e-7);
 for(const x of [80,156,240,355]){
  const point={x,y:151},screen=zoom.bioZoomScreenPoint(cam,point);
  const world=zoom.bioZoomToWorld(cam,screen);
  assert.ok(Math.abs(point.x-world.x)<1e-7&&Math.abs(point.y-world.y)<1e-7);
 }
}

let paths=0,links=0;
for(const species of Object.keys(bio.BIO_ORGANISMS)){
 const nodes=bio.bioNodes(species),byId=new Map(nodes.map(n=>[n.id,n]));
 const root=nodes[0],children=zoom.bioZoomChildCandidates(nodes,root);
 assert.ok(children.length>=2,"No real branches "+species);
 const photo=zoom.bioZoomImageFor(species,root);
 if(species!=="pine"&&species!=="sunflower")assert.equal(photo,null,"Do not substitute other species photos");
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
// The location inset must be backed by exactly the parent atlas node and the
// same canonical spot used by the microscope's clickable child hotspot.
let mapped=0;
for(const species of Object.keys(bio.BIO_ORGANISMS)){
 const nodes=bio.bioNodes(species);
 assert.equal(zoom.bioZoomParentContext(species,nodes,nodes[0]),null);
 for(const node of nodes.slice(1)){
  const context=zoom.bioZoomParentContext(species,nodes,node);
  assert.ok(context,"Missing parent overview context "+node.id);
  assert.equal(context.child.id,node.id);
  assert.equal(context.parent.id,node.parentId);
  const siblings=zoom.bioZoomChildCandidates(nodes,context.parent);
  const index=siblings.findIndex(n=>n.id===node.id);
  assert.ok(index>=0);
  assert.deepEqual(context.spot,
   zoom.bioZoomPoint(species,context.parent,node,index,siblings.length));
  assert.equal(context.parentLevel,zoom.bioZoomPath(nodes,context.parent.id).length);
  mapped++;
 }
}
assert.equal(mapped,links,"Context mini-map covers every legitimate anatomical edge");
assert.equal(zoom.bioZoomParentContext("human",bio.bioNodes("human"),{
 id:"missing/path",parentId:"missing",name:"no node",description:"",level:"cell"
}),null,"Unknown anatomy path must never produce a false position");
assert.deepEqual(zoom.bioZoomVisibleField(norm),{x:0,y:0,width:480,height:330});
const small=zoom.bioZoomVisibleField({x:0,y:0,scale:2});
assert.deepEqual(small,{x:120,y:82.5,width:240,height:165});
for(const scale of [1,1.2,1.5,2,2.7,3]){
 const cameras=[zoom.bioZoomBound({x:400,y:300,scale}),
  zoom.bioZoomBound({x:-400,y:-300,scale}),zoom.bioZoomBound({x:0,y:0,scale})];
 for(const camera of cameras){
  const rect=zoom.bioZoomVisibleField(camera);
  assert.ok(rect.x>=-1e-8&&rect.y>=-1e-8);
  assert.ok(rect.x+rect.width<=480+1e-8&&rect.y+rect.height<=330+1e-8);
  assert.ok(Math.abs(rect.width-480/camera.scale)<1e-8);
  assert.ok(Math.abs(rect.height-330/camera.scale)<1e-8);
 }
}

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
assert.ok(zoom.bioZoomImageFor("sunflower",bio.bioNodes("sunflower")[0]),"New whole-plant photo must exist");
const camera=fs.readFileSync("src/LektrusBioUnifiedZoom.tsx","utf8");
assert.match(camera,/bioZoomClosestChild\(organism,node,candidates,imagePoint,bioZoomHitRadius\(old\)\)/);
assert.match(camera,/bioZoomToWorld\(old,point\)/);
assert.match(camera,/onPointerDown=\{onDown\}/);
assert.match(camera,/onPointerMove=\{onMove\}/);
assert.match(camera,/map.size>=2/);
assert.match(camera,/const departingCamera=cameraRef.current/,"Transitions must preserve live parent camera before animation");
assert.match(camera,/visits.current.set\(old.id,departingCamera\)/,"Do not store already-snapped zoom");
assert.match(camera,/bioZoomPortalCamera\(departingCamera,spot\)/,"Portal must fly toward chosen anatomical region");
assert.doesNotMatch(camera,/setCam\(zoomed\)/,"Do not instantly teleport parent before transition");
assert.match(camera,/ghost\.from,false,ghost\.to/);
assert.match(camera,/const parentContext=bioZoomParentContext\(organism,nodes,current\)/);
assert.match(camera,/parentContext&&<LektrusBioParentOverview/);
assert.match(camera,/parentCamera=\{visits.current.get\(parentContext.parent.id\)\?\?BIO_ZOOM_INITIAL\}/);
assert.match(camera,/onBack=\{ascend\}/,"Context map must restore the actual parent camera");
assert.match(camera,/spot:descending\?spot:undefined/,"Portal ring must identify real target");
assert.match(camera,/data-bio-portal-focus="true"/);
assert.match(camera,/portalSpot&&<svg className="lektrus-bio-portal-mark"/);

assert.match(camera,/cameraTransform\(portalTo\)/);
assert.match(camera,/pointerType!=="touch"/,"Mobile zoom uses deliberate touch gestures");
assert.match(camera,/start.moved/,"Never interpret a drag as mobile double tap");
assert.match(camera,/lastTap.current=null;zoom\(1.75,point\)/,"Double tap magnifies its own point");

assert.match(camera,/el.addEventListener\("wheel",onWheel,\{passive:false\}\)/);
assert.match(camera,/el.removeEventListener\("wheel",onWheel\)/);
assert.match(camera,/bioZoomPan\(cameraRef.current/);
assert.match(camera,/data-bio-zoom-target=\{child.id\}/);
assert.match(camera,/role="button" tabIndex=\{0\}/);
assert.match(camera,/onKeyDown=\{e=>\{if\(e.key==="Enter"\|\|e.key===" "\)/);
assert.match(camera,/node.level==="cell"\?focusFeature:undefined/);
assert.match(camera,/Предметный|Непрерывное исследование организма/);
assert.match(camera,/разных экземпляров и препаратов/);
const app=fs.readFileSync("src/LektrusBioMicroscope.tsx","utf8");
assert.match(app,/diagram.activity==="explore"&&activeOrganism==="human"&&<LektrusBioContinuousHuman\/>/,
 "Human now uses the spatial canvas, not a page-swapping zoom portal");
assert.match(app,/diagram.activity==="explore"&&activeOrganism!=="human"&&<LektrusBioUnifiedZoom/,
 "Other organisms keep their existing interactive atlas");
assert.ok(!app.includes("viewerMode"),"No longer split exploration between microscope and atlas");
assert.ok(!app.includes("<LektrusBioMicroscopeStage/>"));
assert.ok(app.includes("showExercise&&<>"),"Assembly and labeling must remain unchanged");
const css=fs.readFileSync("src/lektrusBioUnifiedZoom.css","utf8");
assert.match(css,/touch-action:none/);
assert.match(css,/aspect-ratio:480\/330/);
assert.match(css,/width:min\(100%,915px\)/,"Viewport must constrain both axes together");
assert.doesNotMatch(css,/min-height:280px|max-height:630px/,"Clamping one axis would misalign hotspots");
assert.match(css,/prefers-reduced-motion:reduce/);
const contextUi=fs.readFileSync("src/LektrusBioParentOverview.tsx","utf8");
const contextAst=ts.createSourceFile("src/LektrusBioParentOverview.tsx",contextUi,
 ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(contextAst.parseDiagnostics.length,0,"Parent overview JSX must parse");
assert.match(contextUi,/data-bio-parent-id=\{parent.id\}/);
assert.match(contextUi,/data-bio-context-spot="true"/);
assert.match(contextUi,/data-bio-context-field="true"/);
assert.match(contextUi,/const field=bioZoomVisibleField\(parentCamera\)/);
assert.match(contextUi,/bioZoomImageFor\(organism,parent\)/);
assert.match(contextUi,/<LektrusBioAnatomyScene organism=\{organism\} node=\{parent\}/);
assert.match(contextUi,/onClick=\{onBack\}/);
assert.match(contextUi,/onPointerDown=\{e=>e.stopPropagation\(\)\}/);
assert.match(contextUi,/export default memo\(ParentOverview/,"Avoid expensive parent SVG redraw on pan");
assert.match(css,/\.lektrus-bio-location\{position:absolute;z-index:5/);
assert.match(css,/\.lektrus-bio-location-preview>/);
assert.match(css,/\.lektrus-bio-portal-mark/);
assert.match(css,/lektrus-bio-portal-mark circle:first-child\{animation:none\}/);

assert.match(css,/lektrus-bio-portal-flight/,"Focus transition must animate image geometry");
assert.match(css,/--bio-ghost-start/);
assert.match(css,/--bio-ghost-end/);
assert.match(css,/lektrus-bio-layer-reveal/);
assert.match(css,/lektrus-bio-unified-arriving\.is-transitioning/);

for(const name of ["src/LektrusBioUnifiedZoom.tsx","src/LektrusBioMicroscope.tsx"]){
 const ast=ts.createSourceFile(name,fs.readFileSync(name,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,"Malformed TSX "+name);
}

const detailed=fs.readFileSync("src/LektrusBioDetailedOrganisms.tsx","utf8");
const detailedAst=ts.createSourceFile("src/LektrusBioDetailedOrganisms.tsx",detailed,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(detailedAst.parseDiagnostics.length,0,"Malformed offline detailed specimen artwork");
for(const kind of ["human","cat","oak","sunflower"]){
 assert.match(detailed,new RegExp('data-bio-illustration="'+kind+'"'),"Missing distinct realistic vector specimen "+kind);
 assert.match(detailed,new RegExp('case "'+kind+'":return'),"Missing correct species mapping "+kind);
}
assert.match(detailed,/length:220/,"Sunflower should have a botanically recognizable packed disk of florets");
assert.match(detailed,/length:27/,"Sunflower should have abundant ray florets around the disk");
assert.match(detailed,/rx="1\.7" ry="2\.5"/,"Disk florets need distinct rendered geometry");
assert.match(detailed,/Lizard|Human|Cat|Oak|Sunflower/);
const anatomy=fs.readFileSync("src/LektrusBioAnatomyScene.tsx","utf8");
assert.match(anatomy,/return <LektrusBioDetailedOrganisms organism=\{organism\}\/>/,"All original species should share improved specimen art");
assert.doesNotMatch(anatomy,/if\(organism==="human"\)return <g>/,"Remove primitive human circle silhouette");
for(const species of ["human","cat","oak","sunflower"]){
 const root=bio.bioNodes(species)[0],kids=zoom.bioZoomChildCandidates(bio.bioNodes(species),root);
 assert.ok(kids.length>=2);
 for(const [index,child] of kids.entries()){
  const p=zoom.bioZoomPoint(species,root,child,index,kids.length);
  assert.ok(p.x>=70&&p.x<=410&&p.y>=30&&p.y<=317, "Illustration hotspot out of bounds: "+child.id);
 }
}


const extraArt=fs.readFileSync("src/LektrusBioDetailedExtraSpecies.tsx","utf8");
const extraAst=ts.createSourceFile("src/LektrusBioDetailedExtraSpecies.tsx",extraArt,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(extraAst.parseDiagnostics.length,0,"Malformed detailed extra species SVG artwork");
for(const species of ["sparrow","perch","frog","bee","snail","pine","fern","wheat"]){
 assert.match(extraArt,new RegExp('data-bio-illustration="'+species+'"'),"Missing unique vector specimen "+species);
 assert.match(extraArt,new RegExp('case "'+species+'":return'),"Wrong species illustration dispatcher "+species);
}
const extraScene=fs.readFileSync("src/LektrusBioSpeciesArt.tsx","utf8");
assert.match(extraScene,/return <LektrusBioDetailedExtraSpecies organism=\{organism\}\/>/);
assert.doesNotMatch(extraScene,/case "sparrow":return <g>/,"Primitive bird silhouette must be replaced");
for(const species of ["sparrow","perch","frog","bee","snail","pine","fern","wheat"]){
 const root=bio.bioNodes(species)[0],kids=zoom.bioZoomChildCandidates(bio.bioNodes(species),root);
 for(const [index,child] of kids.entries()){
  const p=zoom.bioZoomPoint(species,root,child,index,kids.length);
  assert.ok(p.x>=50&&p.x<=455&&p.y>=15&&p.y<=325,"Invalid illustration region for "+child.id);
 }
}


const lineageArt=fs.readFileSync("src/LektrusBioDetailedLineageSpecimens.tsx","utf8");
const lineageAst=ts.createSourceFile("src/LektrusBioDetailedLineageSpecimens.tsx",lineageArt,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(lineageAst.parseDiagnostics.length,0,"Malformed detailed lineage SVG");
for(const species of ["earthworm","seastar","crayfish","horsetail","lizard","spider","clubmoss","magnolia"]){
 assert.match(lineageArt,new RegExp('data-bio-illustration="'+species+'"'),"Missing realistic vector specimen: "+species);
 assert.match(lineageArt,new RegExp('case "'+species+'":return'),"Wrong lineages mapped to renderers: "+species);
}
assert.match(lineageArt,/пять пар ходильных конечностей/,"Crayfish should have decapod appendages");
assert.match(lineageArt,/восемью членистыми ногами/,"Spider needs four pairs of legs");
assert.match(lineageArt,/спороносный весенний побег/,"Horsetail sterile and fertile shoots must differ");
for(const file of ["src/LektrusBioNewSpeciesArt.tsx","src/LektrusBioFurtherSpeciesArt.tsx"]){
 const src=fs.readFileSync(file,"utf8");
 assert.match(src,/LektrusBioDetailedLineageSpecimens/,"Detailed figures must be wired into all atlas modes");
}


const coreOrganArt=fs.readFileSync("src/LektrusBioDetailedCoreOrgans.tsx","utf8");
const coreOrganAst=ts.createSourceFile("src/LektrusBioDetailedCoreOrgans.tsx",coreOrganArt,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(coreOrganAst.parseDiagnostics.length,0,"Malformed detailed organ illustrations");
for(const organ of ["heart","lungs","brain","eye","muscle","gut","flower","root","leaf","wood"]){
 assert.match(coreOrganArt,new RegExp('data-bio-organ-illustration="'+organ+'"'),"Missing visual reconstruction "+organ);
 assert.match(coreOrganArt,new RegExp('case "'+organ+'":return'),"Missing anatomical organ route "+organ);
}
assert.match(coreOrganArt,/Анатомический рисунок сердца/,"The heart must be actual cardiac anatomy instead of a heart icon");
assert.match(coreOrganArt,/с предсердиями, желудочками и крупными сосудами/);
assert.match(anatomy,/LektrusBioDetailedCoreOrgans organism=\{organism\} keyName=\{keyName\}/);
assert.doesNotMatch(anatomy,/C200 239 134 211/,"Remove primitive Valentine's heart shape");

console.log("Unified microscope: all 20 species traverse real anatomy, spatial proximity and anchor-preserving zoom, pinch/pan/keyboard, sample provenance and unchanged assignments OK. "+paths+" cell paths; "+links+" links.");
