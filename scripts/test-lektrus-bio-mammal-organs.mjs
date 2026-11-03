import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read=path=>fs.readFileSync(path,"utf8");
const modules=new Map();
function load(path){
 if(modules.has(path))return modules.get(path);
 const js=ts.transpileModule(read(path),{fileName:path,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};modules.set(path,exports);
 new Function("exports","require",js)(exports,name=>{
  assert.ok(name.startsWith("./"),"Only reviewed local model imports");
  return load(path.slice(0,path.lastIndexOf("/")+1)+name.slice(2)+".ts");
 });
 return exports;
}
const model=load("src/lektrusBioMicroscopeModel.ts");
const zoom=load("src/lektrusBioUnifiedZoomModel.ts");
const source=read("src/LektrusBioMammalOrganSections.tsx");
const ast=ts.createSourceFile("src/LektrusBioMammalOrganSections.tsx",source,
 ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(ast.parseDiagnostics.length,0,"Mammalian organ cross-sections must parse");
const jsx=(type,props)=>({type,props:props??{}});
const js=ts.transpileModule(source,{fileName:"src/LektrusBioMammalOrganSections.tsx",
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const art={};
new Function("exports","require",js)(art,name=>{
 if(name==="react/jsx-runtime")return {jsx,jsxs:jsx};
 if(name==="./lektrusBioMicroscopeModel")return model;
 throw Error("Unexpected organ art dependency "+name);
});
const exact={
 human:{
  "лёгкие":{kind:"lungs",tissue:"Эпителий альвеол",site:{x:380,y:203}},
  "сердце":{kind:"heart",tissue:"Сердечная мышечная ткань",site:{x:309,y:214}},
  "головной-мозг":{kind:"brain",tissue:"Нервная ткань",site:{x:374,y:183}}
 },
 cat:{
  "глаз":{kind:"eye",tissue:"Сетчатка",site:{x:388,y:185}},
  "скелетная-мышца":{kind:"muscle",tissue:"Поперечнополосатая мышечная ткань",site:{x:382,y:207}},
  "тонкая-кишка":{kind:"intestine",tissue:"Кишечный эпителий",site:{x:387,y:191}}
 }
};
function collect(element,all=[]){
 if(Array.isArray(element))for(const e of element)collect(e,all);
 else if(element&&typeof element==="object"&&"type" in element){
  if(typeof element.type==="function")collect(element.type(element.props),all);
  else {all.push(element);collect(element.props.children,all);}
 }
 return all;
}
let count=0;
for(const species of ["human","cat"]){
 const nodes=model.bioNodes(species);
 const root=nodes[0],systems=model.bioChildren(nodes,root.id);
 assert.equal(systems.length,3);
 for(const system of systems){
  const organs=model.bioChildren(nodes,system.id);
  assert.equal(organs.length,1);
  const organ=organs[0];
  const id=organ.id.split("/").at(-1),expected=exact[species][id];
  assert.ok(expected,"Unexpected mammal organ "+organ.id);
  assert.equal(art.bioMammalOrganKind(species,organ),expected.kind);
  assert.equal(art.bioMammalOrganKind(species==="cat"?"human":"cat",organ),null);
  assert.equal(art.bioMammalOrganKind(species,system),null);
  assert.equal(art.bioMammalOrganKind(species,root),null);
  const tissues=model.bioChildren(nodes,organ.id);
  assert.equal(tissues.length,1,"One tissue focus per reviewed organ");
  assert.equal(tissues[0].name,expected.tissue);
  const actual=model.bioMammalOrganTissueSpot(species,organ);
  assert.deepEqual(actual,expected.site);
  assert.deepEqual(model.bioChildSpot(species,organ,tissues[0],0,1),actual,
   "Exercises must point to the same preview as microscope mode");
  assert.deepEqual(zoom.bioZoomPoint(species,organ,tissues[0],0,1),actual,
   "Unified camera must use identical specimen coordinates");
  const cell=model.bioChildren(nodes,tissues[0].id)[0];
  assert.deepEqual(zoom.bioZoomPath(nodes,cell.id),
   [root,system,organ,tissues[0],cell],"All five levels remain connected");
  const illustration=art.default({organism:species,node:organ});
  assert.equal(illustration.props["data-bio-mammal-organ"],expected.kind);
  assert.equal(illustration.props["data-bio-mammal-organism"],species);
  assert.equal(illustration.props["data-bio-mammal-depth"],"organ");
  assert.equal(illustration.props["data-bio-mammal-tissue-x"],actual.x);
  assert.equal(illustration.props["data-bio-mammal-tissue-y"],actual.y);
  const elements=collect(illustration);
  const inset=elements.find(e=>e.props["data-bio-mammal-tissue-preview"]===expected.kind);
  assert.ok(inset,"Missing real histological target preview "+expected.kind);
  const circles=collect(inset).filter(e=>e.type==="circle");
  assert.ok(circles.some(c=>c.props.cx===actual.x&&c.props.cy===actual.y&&c.props.r===64),
   "Focus must be in middle of its actual tissue preview");
  assert.ok(elements.some(e=>e.props["data-bio-mammal-organ-drawing"]===expected.kind),
   "Missing kind-specific organ illustration");
  count++;
 }
}
assert.equal(count,6);
for(const organism of ["sparrow","frog","perch","bee","sunflower"]){
 for(const node of model.bioNodes(organism)){
  assert.equal(art.bioMammalOrganKind(organism,node),null);
  assert.equal(model.bioMammalOrganTissueSpot(organism,node),null);
 }
}
for(const name of ["Lungs","Heart","Brain","CatEye","CatMuscle","CatIntestine"])
 assert.match(source,new RegExp("function "+name+"\\(\\):ReactNode"));
assert.match(source,/Anatomical right lung appears on the viewer's left/);
assert.match(source,/LV myocardium is visibly thicker/);
assert.match(source,/Tapetum/); // capitalized name appears in the artist notes?
assert.match(source,/TissueInset x=\{point.x\} y=\{point.y\} kind=\{kind\}/);
const main=read("src/LektrusBioAnatomyScene.tsx");
const mainAST=ts.createSourceFile("src/LektrusBioAnatomyScene.tsx",main,
 ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(mainAST.parseDiagnostics.length,0);
assert.match(main,/bioMammalOrganKind\(organism,node\)\?<LektrusBioMammalOrganSections/);
assert.ok(main.indexOf("bioMammalOrganKind(organism,node)?")<
 main.indexOf('node.level==="organism"||node.level==="system"'),
 "Mammal organs must render before obsolete generic organ icons");
const app=read("src/LektrusBioMicroscope.tsx");
assert.match(app,/Сейчас прорабатываем слой 3\/5/);
assert.match(app,/className=\{i===2\?"is-current":i<2\?"is-established":""\}/);
assert.match(app,/aria-current=\{i===2\?"step":undefined\}/);
console.log("Mammalia stage 3: 6 dedicated organ cutaways, 6 true tissue-preview portals, all five saved depths and cross-species guards PASS.");
