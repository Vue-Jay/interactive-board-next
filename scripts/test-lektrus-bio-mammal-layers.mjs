import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const get=path=>fs.readFileSync(path,"utf8");
const cache=new Map();
function loadModel(path){
 if(cache.has(path))return cache.get(path);
 const js=ts.transpileModule(get(path),{fileName:path,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};cache.set(path,exports);
 new Function("exports","require",js)(exports,(name)=>{
  assert.match(name,/^\.\//,"Only local model dependencies allowed");
  return loadModel(path.slice(0,path.lastIndexOf("/")+1)+name.slice(2)+".ts");
 });
 return exports;
}
const model=loadModel("src/lektrusBioMicroscopeModel.ts");
const zoom=loadModel("src/lektrusBioUnifiedZoomModel.ts");
// Runtime import stubs keep this a pure verification of the existing art
// structure: no browser or DOM required.
const mammalSource=get("src/LektrusBioMammalSystems.tsx");
const ast=ts.createSourceFile("src/LektrusBioMammalSystems.tsx",mammalSource,
 ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(ast.parseDiagnostics.length,0,"The mammal system renderer must parse");
const mammalJs=ts.transpileModule(mammalSource,{fileName:"src/LektrusBioMammalSystems.tsx",
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const art={};
new Function("exports","require",mammalJs)(art,()=>({__esModule:true,default:()=>null,
 jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}));
const ids=["human","cat"];
const expected={
 human:["respiratory","circulatory","nervous"],
 cat:["visual","musculoskeletal","digestive"]
};
const coordinates={
 "human/дыхательная-система":{x:259,y:150},
 "human/кровеносная-система":{x:232,y:157},
 "human/нервная-система":{x:240,y:52},
 "cat/сенсорная-система":{x:190,y:158},
 "cat/опорно-двигательная-система":{x:302,y:205},
 "cat/пищеварительная-система":{x:281,y:213}
};
assert.deepEqual(Object.keys(art.BIO_MAMMAL_SYSTEMS),ids);
let verified=0;
for(const species of ids){
 const nodes=model.bioNodes(species),root=nodes[0];
 const systems=model.bioChildren(nodes,root.id);
 assert.equal(systems.length,3,"Three individually drawn model systems");
 assert.deepEqual(art.BIO_MAMMAL_SYSTEMS[species],expected[species]);
 for(const [i,system] of systems.entries()){
  assert.equal(system.level,"system");
  assert.equal(art.bioMammalSystemKind(species,system),expected[species][i]);
  const organ=model.bioChildren(nodes,system.id)[0];
  assert.ok(organ&&organ.level==="organ");
  assert.equal(model.bioChildren(nodes,system.id).length,1);
  const point=model.bioChildSpot(species,system,organ,0,1);
  assert.deepEqual(point,coordinates[system.id],"The organ hotspot must be on the drawn system");
  assert.deepEqual(zoom.bioZoomPoint(species,system,organ,0,1),point,
   "The unified camera must navigate to precisely that same area");
  const tissue=model.bioChildren(nodes,organ.id)[0];
  const cell=model.bioChildren(nodes,tissue.id)[0];
  assert.deepEqual([root.level,system.level,organ.level,tissue.level,cell.level],
   model.BIO_LEVELS);
  assert.deepEqual(zoom.bioZoomPath(nodes,cell.id),
   [root,system,organ,tissue,cell],"Saved full path must remain intact");
  assert.equal(art.bioMammalSystemKind(species,root),null);
  assert.equal(art.bioMammalSystemKind(species,organ),null);
  assert.equal(art.bioMammalSystemKind(species,tissue),null);
  assert.equal(art.bioMammalSystemKind(species,cell),null);
  assert.equal(art.bioMammalSystemKind(species==="human"?"cat":"human",system),null,
   "Do not borrow another mammal's system drawing");
  const scene=art.default({organism:species,node:system});
  assert.equal(scene.props["data-bio-mammal-system"],expected[species][i]);
  assert.equal(scene.props["data-bio-mammal-species"],species);
  assert.equal(scene.props["data-bio-mammal-level"],"system");
  verified++;
 }
}
assert.equal(verified,6);
const other=model.bioNodes("sparrow");
for(const n of other)assert.equal(art.bioMammalSystemKind("sparrow",n),null);
assert.equal(art.default({organism:"sparrow",node:other[0]}),null);
for(const name of ["HumanRespiration","HumanCirculation","HumanNervous",
 "CatVision","CatMovement","CatDigestion"]){
 assert.match(mammalSource,new RegExp("function "+name+"\\(\\):ReactNode"));
}
assert.match(mammalSource,/data-bio-mammal-anatomy="respiratory"/);
assert.match(mammalSource,/data-bio-mammal-anatomy="visual"/);
assert.match(mammalSource,/Трахея/);
assert.match(mammalSource,/Диафрагма/);
assert.match(mammalSource,/Артерии/);
assert.match(mammalSource,/Спинной мозг/);
assert.match(mammalSource,/Сетчатка и тапетум/);
assert.match(mammalSource,/Скелетные мышцы/);
assert.match(mammalSource,/Тонкая кишка/);
assert.match(mammalSource,/Лёгкое/);
assert.match(mammalSource,/same 480×330 space/);
const main=get("src/LektrusBioAnatomyScene.tsx");
const mainAst=ts.createSourceFile("src/LektrusBioAnatomyScene.tsx",main,
 ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(mainAst.parseDiagnostics.length,0,"Anatomy scene must parse");
assert.match(main,/bioMammalSystemKind\(organism,node\)\?<LektrusBioMammalSystems/);
assert.ok(main.indexOf("bioMammalSystemKind(organism,node)?")<
 main.indexOf('node.level==="organism"||node.level==="system"'),
 "Specialized Mammalia renderer must override previous generic system icon");
const ui=get("src/LektrusBioMicroscope.tsx");
const uiAst=ts.createSourceFile("src/LektrusBioMicroscope.tsx",ui,
 ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(uiAst.parseDiagnostics.length,0,"The biology class selector must parse");
assert.match(ui,/Млекопитающие · Mammalia/);
assert.match(ui,/Сейчас прорабатываем слой 2\/5/);
assert.match(ui,/exploreCatalogOrganism\("human"\)/);
assert.match(ui,/exploreCatalogOrganism\("cat"\)/);
assert.match(ui,/aria-pressed=\{activeOrganism==="human"\}/);
assert.match(ui,/aria-pressed=\{activeOrganism==="cat"\}/);
assert.match(ui,/BIO_LEVELS.map\(\(level,i\)=>/);
assert.match(ui,/diagram.activity==="explore"&&\(activeOrganism==="human"\|\|activeOrganism==="cat"\)/);
const css=get("src/lektrusBioMicroscope.css");
assert.match(css,/\.lektrus-bio-class-depth span.is-current/);
assert.match(css,/\.lektrus-bio-class-species button:focus-visible/);
console.log("Mammalia vertical milestone: 2 species, 6 distinct organism/system plates, 6 aligned organ hotspots and 6 complete 5-depth paths. Others untouched.");
