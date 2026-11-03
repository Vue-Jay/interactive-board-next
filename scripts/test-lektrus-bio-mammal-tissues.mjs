import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read=path=>fs.readFileSync(path,"utf8"),cache=new Map();
function load(path){
 if(cache.has(path))return cache.get(path);
 const js=ts.transpileModule(read(path),{fileName:path,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};cache.set(path,exports);
 new Function("exports","require",js)(exports,name=>{
  assert.ok(name.startsWith("./"),"Offline model dependency expected");
  return load(path.slice(0,path.lastIndexOf("/")+1)+name.slice(2)+".ts");
 });
 return exports;
}
const bio=load("src/lektrusBioMicroscopeModel.ts");
const zoom=load("src/lektrusBioUnifiedZoomModel.ts");
const core=load("src/lektrusBioCoreMicroscopyPlates.ts");
const source=read("src/LektrusBioMammalTissueSections.tsx");
const jsx=(type,props)=>({type,props:props??{}});
const ast=ts.createSourceFile("src/LektrusBioMammalTissueSections.tsx",source,
 ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(ast.parseDiagnostics.length,0,"Mammalian tissue TSX must parse");
const js=ts.transpileModule(source,{fileName:"src/LektrusBioMammalTissueSections.tsx",
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
 jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const art={};
new Function("exports","require",js)(art,name=>{
 if(name==="react/jsx-runtime")return {jsx,jsxs:jsx};
 if(name==="./lektrusBioMicroscopeModel")return bio;
 throw Error("Unexpected tissue import "+name);
});
const expected={
 human:[
  ["Эпителий альвеол","alveolar",{x:246,y:182},"Пневмоцит I типа"],
  ["Сердечная мышечная ткань","cardiac",{x:210,y:159},"Кардиомиоцит"],
  ["Нервная ткань","nervous",{x:211,y:161},"Нейрон"]
 ],
 cat:[
  ["Сетчатка","retina",{x:277,y:229},"Палочка"],
  ["Поперечнополосатая мышечная ткань","skeletal",{x:224,y:162},"Мышечное волокно"],
  ["Кишечный эпителий","intestinal",{x:202,y:147},"Энтероцит"]
 ]
};
function flatten(node,items=[]){
 if(Array.isArray(node))for(const child of node)flatten(child,items);
 else if(node&&typeof node==="object"&&"type" in node){
  if(typeof node.type==="function")flatten(node.type(node.props),items);
  else {items.push(node);flatten(node.props.children,items);}
 }
 return items;
}
let checked=0;
const allIds=[];
for(const organism of ["human","cat"]){
 const nodes=bio.bioNodes(organism);
 const systems=bio.bioChildren(nodes,organism);
 assert.equal(systems.length,3);
 for(const [i,system] of systems.entries()){
  const organ=bio.bioChildren(nodes,system.id)[0];
  const tissues=bio.bioChildren(nodes,organ.id);
  assert.equal(tissues.length,1);
  const tissue=tissues[0];
  const [tissueName,kind,spot,cellName]=expected[organism][i];
  assert.equal(tissue.name,tissueName,"Tissue identity must match its system");
  assert.equal(art.bioMammalTissueKind(organism,tissue),kind);
  assert.equal(art.BIO_MAMMAL_TISSUE_KINDS[tissue.id],kind);
  const cells=bio.bioChildren(nodes,tissue.id);
  assert.equal(cells.length,1);
  const cell=cells[0];
  assert.equal(cell.name,cellName);
  assert.deepEqual(bio.bioMammalTissueCellSpot(organism,tissue),spot);
  assert.deepEqual(bio.bioChildSpot(organism,tissue,cell,0,1),spot);
  assert.deepEqual(zoom.bioZoomPoint(organism,tissue,cell,0,1),spot);
  assert.equal(zoom.bioZoomPath(nodes,cell.id).length,5);
  const coreTissue=core.bioCoreMicroscopyPlateFor(organism,tissue);
  const coreCell=core.bioCoreMicroscopyPlateFor(organism,cell);
  assert.ok(coreTissue&&coreCell&&coreTissue.kind===coreCell.kind,
   "Keep original cell drawing at level 5");
  assert.equal(art.bioMammalTissueKind(organism,organ),null);
  assert.equal(art.bioMammalTissueKind(organism,cell),null);
  assert.equal(art.bioMammalTissueKind(organism==="cat"?"human":"cat",tissue),null);
  assert.equal(bio.bioMammalTissueCellSpot(organism==="cat"?"human":"cat",tissue),null);
  const svg=art.default({organism,node:tissue});
  assert.ok(svg);
  assert.equal(svg.props["data-bio-mammal-tissue"],kind);
  assert.equal(svg.props["data-bio-mammal-organism"],organism);
  assert.equal(svg.props["data-bio-mammal-depth"],"tissue");
  assert.equal(svg.props["data-bio-mammal-cell-x"],spot.x);
  assert.equal(svg.props["data-bio-mammal-cell-y"],spot.y);
  const elements=flatten(svg);
  assert.ok(elements.some(e=>e.props["data-bio-mammal-tissue-art"]===kind),
   "Every kind needs its own actual tissue drawing "+kind);
  const markers=elements.filter(e=>e.props["data-bio-mammal-cell-spot"]==="true");
  assert.equal(markers.length,1,"Only one actual entry point, not invented neighbours");
  assert.equal(markers[0].props.cx,spot.x);
  assert.equal(markers[0].props.cy,spot.y);
  assert.ok(spot.x>40&&spot.x<440&&spot.y>40&&spot.y<290,"Spot must be visible");
  allIds.push(tissue.id);
  checked++;
 }
}
assert.equal(checked,6);
assert.equal(new Set(allIds).size,6);
for(const organism of ["perch","frog","sparrow","bee","sunflower","oak"]){
 const nodes=bio.bioNodes(organism);
 for(const node of nodes){
  assert.equal(art.bioMammalTissueKind(organism,node),null);
  assert.equal(bio.bioMammalTissueCellSpot(organism,node),null);
 }
}
for(const [fn,labels] of [
 ["Alveolar",["Пневмоцит II","Капилляр","Макрофаг","Воздушное пространство"]],
 ["Cardiac",["Вставочный диск","Центральное ядро","Капилляр"]],
 ["Nervous",["Дендриты","Глия","Аксон"]],
 ["Retina",["Палочки","Тапетум","Пигментный","Биполярные"]],
 ["Skeletal",["Эндомизий","Периферическое ядро","исчерченность"]],
 ["Intestinal",["Бокаловидная клетка","Просвет кишки","Крипты","Капилляры"]]
 ]){
 assert.match(source,new RegExp("function "+fn+"\\(\\):ReactNode"));
 for(const label of labels)assert.ok(source.includes(label),fn+" missing real feature "+label);
}
assert.match(source,/Tapetum is NOT part of the retina/);
assert.match(source,/central lymphatic capillary/);
assert.match(source,/sarcolemmal PERIPHERY/);
assert.match(source,/Alveolar macrophage is NOT a pneumocyte/);
const scene=read("src/LektrusBioAnatomyScene.tsx");
const sceneAst=ts.createSourceFile("src/LektrusBioAnatomyScene.tsx",scene,
 ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(sceneAst.parseDiagnostics.length,0);
assert.match(scene,/bioMammalTissueKind\(organism,node\)/);
assert.match(scene,/<LektrusBioMammalTissueSections organism=\{organism\} node=\{node\}/);
assert.match(scene,/<LektrusBioCoreMicroscopyArt plate=\{corePlate\}/);
assert.match(scene,/cellDetail\?\?detail\?\?coreDetail/);
const app=read("src/LektrusBioMicroscope.tsx");
assert.match(app,/Сейчас прорабатываем слой 4\/5/);
assert.match(app,/className=\{i===3\?"is-current":i<3\?"is-established":""\}/);
assert.match(app,/aria-current=\{i===3\?"step":undefined\}/);
console.log("Mammalia tissue stage 4: 6 distinct tissue sections, 6 exact cell locations, 6 five-depth pathways; prior cell art and non-mammals untouched.");
