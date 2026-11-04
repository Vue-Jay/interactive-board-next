import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Render the real JSX tree in Node, without snapshotting screenshots.
// A selection must have EXACTLY one anatomical raster, never an unrelated
// SVG organ or another system accidentally visible beneath it.
const read=path=>fs.readFileSync(path,"utf8");
const jsx=(type,props)=>({type,props:props??{}});
const react={memo:fn=>fn};
const load=(file,mocks={})=>{
 const source=read(file);
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,"Cannot parse "+file);
 const code=ts.transpileModule(source,{fileName:file,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};
 new Function("exports","require",code)(exports,name=>{
  if(name==="react/jsx-runtime")return {jsx,jsxs:jsx};
  if(name==="react")return react;
  assert.ok(name in mocks,"Unexpected dependency "+name+" from "+file);
  return mocks[name];
 });
 return exports;
};
function traverse(element,all=[]){
 if(Array.isArray(element)){for(const child of element)traverse(child,all);return all;}
 if(!element||typeof element!=="object"||!("type" in element))return all;
 if(typeof element.type==="function")traverse(element.type(element.props),all);
 else {all.push(element);traverse(element.props.children,all);}
 return all;
}
const registry=load("src/lektrusBioHumanBodySystems.ts");
const systems=registry.HUMAN_BODY_SYSTEMS.map(x=>x.id);
assert.deepEqual(systems,[
 "nervous","respiratory","circulatory","digestive",
 "urinary","musculoskeletal","integumentary"]);
const mannequin=load("src/LektrusBioMannequin.tsx",{
 "./assets/bio-atlas/human-biomodel.webp":{__esModule:true,default:"/human-biomodel.webp"},
 "./assets/bio-atlas/human-seven-systems.webp":{__esModule:true,default:"/human-seven-systems.webp"},
 "./lektrusBioHumanBodySystems":registry
});
const all=traverse(mannequin.default({system:"all"}));
assert.equal(all.filter(x=>x.type==="img").length,1,
 "General organism overview keeps the original approved image");
assert.equal(all.filter(x=>x.props["data-anatomy"]!==undefined).length,0);
const seen=new Set();
for(const system of systems){
 const elements=traverse(mannequin.default({system}));
 const active=elements.filter(x=>x.props["data-anatomy"]!==undefined);
 assert.equal(active.length,1,"A system must render exactly one medical raster plate: "+system);
 const art=active[0];
 assert.equal(art.props["data-anatomy"],system);
 assert.equal(art.props["data-image-kind"],"medical-raster");
 assert.equal(art.props.style.backgroundSize,"700% 100%");
 assert.match(art.props.style.backgroundImage,/human-seven-systems\.webp/);
 assert.equal(elements.filter(x=>x.type==="img").length,0,
  "A focused system must not paint the flattened multi-organ overview");
 assert.equal(elements.filter(x=>x.type==="svg").length,0,
  "Old vector-based organ drawings must not render on this layer");
 assert.equal(registry.humanSystemVisibility(system,system),1);
 assert.equal(registry.humanSystemVisibility("all",system),1);
 for(const other of systems)if(other!==system){
  assert.equal(registry.humanSystemVisibility(system,other),0);
 }
 assert.ok(!seen.has(system));seen.add(system);
}
assert.equal(seen.size,7);
const viewer=read("src/LektrusBioContinuousHuman.tsx");
assert.match(viewer,/rasterSelected=system!=="all"/);
assert.match(viewer,/opacity:rasterSelected\?1:layer\[0\]/);
for(let i=1;i<=4;i++){
 assert.ok(viewer.includes("opacity={rasterSelected?0:layer["+i+"]}"),
  "Selected raster must not switch to a schematic drawing when zooming");
}
assert.match(viewer,/HUMAN_BODY_SYSTEMS.map\(entry=>/);
assert.match(viewer,/data-human-active-system=\{system\}/);
assert.match(viewer,/chooseSystem\("all"\)/);
const css=read("src/lektrusBioContinuousHuman.css");
assert.match(css,/\.lektrus-human-raster-plate\{/);
assert.match(css,/\.lektrus-human-body\.is-raster-focus\{/);
assert.match(css,/\.lektrus-human-minimap \.lektrus-human-biomodel\.is-raster-focused\{/);
console.log("Seven independent human raster systems PASS: exact selections, offline illustrations, no vector anatomy or other-system bleed, continuous zoom.");
