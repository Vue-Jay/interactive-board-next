import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Runtime verification, not just checking for CSS class strings: render the
// actual React element tree without a browser and inspect what is painted.
const read=path=>fs.readFileSync(path,"utf8");
const jsx=(type,props)=>({type,props:props??{}});
const react={memo:fn=>fn,useId:()=>":exclusive:"};
const load=(file,mocks={})=>{
 const source=read(file);
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,"Cannot parse "+file);
 const code=ts.transpileModule(source,{fileName:file,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const result={};
 new Function("exports","require",code)(result,name=>{
  if(name==="react/jsx-runtime")return {jsx,jsxs:jsx};
  if(name==="react")return react;
  assert.ok(name in mocks,"Unexpected dependency "+name+" for "+file);
  return mocks[name];
 });
 return result;
};
function traverse(element,all=[]){
 if(Array.isArray(element)){for(const child of element)traverse(child,all);return all;}
 if(!element||typeof element!=="object"||!("type" in element))return all;
 if(typeof element.type==="function")traverse(element.type(element.props),all);
 else{all.push(element);traverse(element.props.children,all);}
 return all;
}
const systemModule=load("src/lektrusBioHumanBodySystems.ts");
const systems=systemModule.HUMAN_BODY_SYSTEMS.map(x=>x.id);
assert.deepEqual(systems,["all","nervous","respiratory","circulatory","digestive","musculoskeletal"]);
const overlayFile="src/LektrusBioHumanSystemOverlay.tsx";
const overlays=load(overlayFile);
const mannequinFile="src/LektrusBioMannequin.tsx";
const mannequin=load(mannequinFile,{
 "./assets/bio-atlas/human-biomodel.webp":{default:"/approved-human.webp"},
 "./LektrusBioHumanSystemOverlay":{default:overlays.default},
 "./lektrusBioHumanBodySystems":systemModule
});
const all=traverse(mannequin.default({system:"all"}));
assert.equal(all.filter(x=>x.type==="img").length,1,
 "All-systems overview may show the approved original figure");
assert.equal(all.filter(x=>x.props["data-anatomy"]!==undefined).length,0);
const seen=new Set();
for(const chosen of systems.slice(1)){
 const elements=traverse(mannequin.default({system:chosen}));
 const rendered=elements.filter(x=>x.props["data-anatomy"]!==undefined);
 assert.equal(rendered.length,1,"Exactly ONE internal system should render");
 assert.equal(rendered[0].props["data-anatomy"],chosen);
 assert.equal(elements.filter(x=>x.type==="img").length,0,
  "Flattened biomodel must not paint other organs beneath selection");
 const shell=elements.find(x=>x.props.className==="lektrus-human-biomodel-shell");
 assert.ok(shell,"No translucent external body shell");
 assert.equal(shell.props.style.maskMode,"alpha");
 assert.match(shell.props.style.maskImage,/url\(\/approved-human\.webp\)/);
 assert.equal(systemModule.humanSystemVisibility(chosen,chosen),1);
 for(const other of systems.slice(1)){
  if(other!==chosen)assert.equal(systemModule.humanSystemVisibility(chosen,other),0);
 }
 assert.ok(!seen.has(rendered[0].props["data-anatomy"]));
 seen.add(rendered[0].props["data-anatomy"]);
}
assert.equal(seen.size,5);
const viewer=read("src/LektrusBioContinuousHuman.tsx");
assert.doesNotMatch(viewer,/import (?:organsImage|heartImage|tissueImage|cellImage)/,
 "Inaccurate mixed-design image collage must never reappear at zoom depth");
assert.match(viewer,/const choose=useCallback\(\(point:HumanPoint\)=>\{[\s\S]*?if\(system!=="all"\)/,
 "Pinching may not silently change a manually selected body system");
assert.match(viewer,/const sys=root\?nodes.find/);
assert.match(viewer,/node=\{isSkin\?undefined:sys\}/);
assert.match(viewer,/node=\{isSkin\?undefined:organ\}/);
assert.match(viewer,/node=\{isSkin\?undefined:tissue\}/);
assert.match(viewer,/node=\{isSkin\?undefined:cell\}/);
assert.match(viewer,/labelAt\(4,cell\)/);
const study=read("src/LektrusBioHumanSystemStudy.tsx");
assert.match(study,/data-bio-human-organ="small-intestine"/);
assert.match(study,/function IntestinalVilli/);
assert.match(study,/function Enterocyte/);
assert.doesNotMatch(study,/fontWeight="800" fill="#805856">Желудок/,
 "Do not zoom from stomach into small-intestine villus and call it the same organ");
const css=read("src/lektrusBioContinuousHuman.css");
assert.match(css,/\.lektrus-human-system-overlay\{/);
assert.match(css,/\.lektrus-human-biomodel-shell\{/);
console.log("Exclusive human systems PASS: one system drawn, other four absent; no flattened anatomy bleed; matched organ, tissue and cell views.");
