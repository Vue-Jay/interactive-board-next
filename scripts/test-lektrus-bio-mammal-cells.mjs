import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read=path=>fs.readFileSync(path,"utf8");
const cache=new Map();
function loadModel(file){
 if(cache.has(file))return cache.get(file);
 const js=ts.transpileModule(read(file),{fileName:file,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};cache.set(file,module.exports);
 new Function("exports","require",js)(module.exports,name=>{
  assert.ok(name.startsWith("./"),"Only local model imports");
  return loadModel(file.slice(0,file.lastIndexOf("/")+1)+name.slice(2)+".ts");
 });
 return module.exports;
}
const jsx=(type,props)=>({type,props:props??{}});
function loadArt(file,requireMap){
 const source=read(file);
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,"Invalid TSX syntax: "+file);
 const js=ts.transpileModule(source,{fileName:file,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};
 new Function("exports","require",js)(exports,name=>{
  if(name==="react/jsx-runtime")return {jsx,jsxs:jsx};
  assert.ok(name in requireMap,"Unexpected runtime art import "+name);
  return requireMap[name];
 });
 return exports;
}
function flatten(element,all=[]){
 if(Array.isArray(element))for(const child of element)flatten(child,all);
 else if(element&&typeof element==="object"&&"type" in element){
  if(typeof element.type==="function")flatten(element.type(element.props),all);
  else {all.push(element);flatten(element.props.children,all);}
 }
 return all;
}
const model=loadModel("src/lektrusBioMicroscopeModel.ts");
const zoom=loadModel("src/lektrusBioUnifiedZoomModel.ts");
const coreArt=loadArt("src/LektrusBioCoreMicroscopyArt.tsx",{});
const cell=loadArt("src/LektrusBioMammalCellDetail.tsx",{
 "./lektrusBioMicroscopeModel":model,
 "./LektrusBioCoreMicroscopyArt":coreArt
});
const expected={
 human:[
  ["Пневмоцит I типа","pneumocyte","alveoli",
   ["Тонкая цитоплазма","Плотные соединения","Ядро"]],
  ["Кардиомиоцит","cardiomyocyte","cardiac",
   ["Миофибриллы","Вставочные диски","Митохондрии"]],
  ["Нейрон","neuron","neural",
   ["Дендриты","Аксон","Синаптические окончания"]]
 ],
 cat:[
  ["Палочка","rod","retina",
   ["Наружный сегмент","Внутренний сегмент","Синаптическое окончание"]],
  ["Мышечное волокно","myofiber","skeletal",
   ["Сарколемма","Миофибриллы","Периферические ядра"]],
  ["Энтероцит","enterocyte","intestinal",
   ["Микроворсинки","Плотные контакты","Митохондрии"]]
 ]
};
const expectedSites={
 alveoli:[[98,170],[340,183],[242,152]],
 cardiac:[[182,149],[353,168],[236,198]],
 neural:[[147,110],[348,184],[418,239]],
 retina:[[240,96],[239,171],[239,266]],
 skeletal:[[110,102],[245,173],[370,206]],
 intestinal:[[232,79],[354,125],[215,227]]
};
const allIds=new Set();
let verified=0;
for(const organism of ["human","cat"]){
 const nodes=model.bioNodes(organism);
 assert.equal(model.bioChildren(nodes,organism).length,3);
 const systems=model.bioChildren(nodes,organism);
 for(const [i,system] of systems.entries()){
  const organ=model.bioChildren(nodes,system.id)[0];
  const tissue=model.bioChildren(nodes,organ.id)[0];
  const actual=model.bioChildren(nodes,tissue.id);
  assert.equal(actual.length,1);
  const node=actual[0],row=expected[organism][i];
  const [name,kind,coreKind,featureNames]=row;
  assert.equal(node.name,name);
  assert.equal(cell.bioMammalCellKind(organism,node),kind);
  assert.equal(cell.BIO_MAMMAL_CELL_NODES[node.id],kind);
  assert.equal(cell.bioMammalCellKind(organism==="cat"?"human":"cat",node),null);
  assert.equal(cell.bioMammalCellKind(organism,organ),null);
  assert.equal(cell.bioMammalCellKind(organism,tissue),null);
  const features=model.bioCellFeatures(node);
  assert.deepEqual(features.map(feature=>feature.name),featureNames);
  const path=zoom.bioZoomPath(nodes,node.id);
  assert.equal(path.length,5);
  assert.deepEqual(path.map(part=>part.level),model.BIO_LEVELS);
  const corePlate=loadModel("src/lektrusBioCoreMicroscopyPlates.ts")
   .bioCoreMicroscopyPlateFor(organism,node);
  assert.ok(corePlate&&corePlate.kind===coreKind,"Must retain authoritative marker coordinates");
  const clicked=[];
  const illustration=cell.default({organism,node,
   selectedFeature:featureNames[1],onFeatureSelect:name=>clicked.push(name)});
  assert.equal(illustration.props["data-bio-mammal-cell"],kind);
  assert.equal(illustration.props["data-bio-mammal-organism"],organism);
  assert.equal(illustration.props["data-bio-mammal-level"],"cell");
  const elements=flatten(illustration);
  assert.ok(elements.some(e=>e.props["data-bio-mammal-cell-art"]===kind));
  const pins=elements.filter(e=>e.props["data-bio-mammal-cell-feature"]!==undefined);
  assert.equal(pins.length,3,"Exactly three clickable reviewed features for "+name);
  for(const [featureIndex,pin] of pins.entries()){
   const feature=featureNames[featureIndex];
   assert.equal(pin.type,"g");
   assert.equal(pin.props.role,"button");
   assert.equal(pin.props.tabIndex,0);
   assert.equal(pin.props["data-bio-mammal-cell-feature"],feature);
   assert.equal(pin.props["data-bio-mammal-feature-number"],featureIndex+1);
   assert.equal(pin.props["aria-pressed"],featureIndex===1);
   const corePos=coreArt.bioCoreMicroscopySpot(coreKind,featureIndex);
   const spot=cell.bioMammalCellSpot(kind,featureIndex);
   assert.deepEqual(spot,corePos);
   assert.deepEqual(spot,{x:expectedSites[coreKind][featureIndex][0],
    y:expectedSites[coreKind][featureIndex][1]});
   assert.equal(pin.props.transform,`translate(${spot.x} ${spot.y})`);
   pin.props.onClick();
   let prevented=false,stopped=false;
   pin.props.onKeyDown({key:"Enter",
    preventDefault(){prevented=true},stopPropagation(){stopped=true}});
   assert.ok(prevented&&stopped,"Keyboard feature selection must stay interactive");
  }
  assert.deepEqual(clicked,featureNames.flatMap(x=>[x,x]));
  assert.equal(allIds.has(node.id),false);
  allIds.add(node.id);
  verified++;
 }
}
assert.equal(verified,6);
assert.equal(allIds.size,6);
for(const species of ["sunflower","oak","sparrow","frog","perch","bee"]){
 for(const node of model.bioNodes(species)){
  assert.equal(cell.bioMammalCellKind(species,node),null);
  assert.equal(cell.default({organism:species,node}),null);
 }
}
for(const name of ["Pneumocyte","Cardiomyocyte","Neuron","Rod","Myofiber","Enterocyte"]){
 assert.match(read("src/LektrusBioMammalCellDetail.tsx"),
  new RegExp("function "+name+"\\(\\):ReactNode"),name+" requires specific art");
}
const source=read("src/LektrusBioMammalCellDetail.tsx");
assert.match(source,/Tight junction and adherens contact/);
assert.match(source,/Nucleus x=\{242\} y=\{151\}/);
assert.match(source,/Intercalated disc only at an end-to-end cell boundary/);
assert.match(source,/NO nucleus in the outer segment/);
assert.match(source,/Multiple nuclei/);
assert.match(source,/Brush border is NOT a whole villus/);
assert.match(source,/className="lektrus-bio-mammal-neuron-signal"/);
const css=read("src/lektrusBioMicroscope.css");
assert.match(css,/lektrus-bio-mammal-neuron-signal/);
assert.match(css,/prefers-reduced-motion:reduce/);
const scene=read("src/LektrusBioAnatomyScene.tsx");
assert.match(scene,/bioMammalCellKind\(organism,node\)/);
assert.match(scene,/<LektrusBioMammalCellDetail organism=\{organism\} node=\{node\}/);
assert.match(scene,/selectedFeature=\{activeFeatureName\} onFeatureSelect=\{onFeatureSelect\}/);
assert.match(scene,/<LektrusBioCoreMicroscopyArt plate=\{corePlate\}/);
assert.match(scene,/cellDetail\?\?detail\?\?coreDetail/);
const focusSource=read("src/lektrusBioFeatureFocus.ts");
assert.match(focusSource,/bioCoreMicroscopySpot\(core.kind,index\)/);
const main=read("src/LektrusBioMicroscope.tsx");
assert.match(main,/Человек теперь исследуется на непрерывном поле/);
assert.match(main,/className=\{i===4\?"is-current":i<4\?"is-established":""\}/);
console.log("Mammalia stage 5: six scientific cell reconstructions, 18 exact reviewed feature pins, touch+keyboard access, focus compatibility, non-mammal isolation and all 5 atlas levels PASS.");
