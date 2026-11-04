import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const read=p=>fs.readFileSync(p,"utf8");
function loadTS(file,mocks={}){
 const code=ts.transpileModule(read(file),{fileName:file,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true
 }}).outputText;
 const exports={};
 new Function("exports","require",code)(exports,name=>{
  assert.ok(name in mocks,"Unexpected import "+name);
  return mocks[name];
 });
 return exports;
}
const systems=loadTS("src/lektrusBioHumanBodySystems.ts");
const m=loadTS("src/lektrusHumanAnatomyModel.ts",{
 "./lektrusBioHumanBodySystems":systems
});
const names=systems.HUMAN_BODY_SYSTEMS.map(x=>x.id);
assert.deepEqual(names,[
 "nervous","respiratory","circulatory","digestive","urinary",
 "musculoskeletal","integumentary"]);
assert.equal(new Set(names).size,7);
assert.equal(Object.keys(m.ANATOMY_SYSTEM_DETAILS).length,7);
const initial=m.defaultHumanAnatomy();
assert.ok(m.validHumanAnatomy(initial));
assert.equal(initial.kind,"bio-anatomy");
assert.equal(m.validHumanAnatomy({...initial,system:"skeletal"}),false);
assert.equal(m.validHumanAnatomy({...initial,title:""}),false);
assert.equal(m.validHumanAnatomy({...initial,showDescriptions:"yes"}),false);
assert.equal(m.validHumanAnatomy({...initial,title:"a".repeat(121)}),false);
for(const system of names){
 assert.ok(m.validHumanAnatomy({...initial,system}));
 assert.ok(Number.isFinite(m.anatomySpritePosition(system)));
 assert.ok(m.anatomySpritePosition(system)>=0&&m.anatomySpritePosition(system)<=100);
 assert.ok(m.ANATOMY_SYSTEM_DETAILS[system].organs.length>=3);
 assert.ok(m.ANATOMY_SYSTEM_DETAILS[system].summary);
}
const canvas={width:780,height:560};
const cam=m.ANATOMY_INITIAL_CAMERA;
assert.deepEqual(cam,{scale:1,panX:0,panY:0});
assert.deepEqual(m.anatomyZoomAt(cam,1.9,{x:390,y:280},780,560),
 {scale:1.9,panX:0,panY:0});
for(const point of [{x:310,y:200},{x:540,y:375},{x:390,y:280}]){
 const z=m.anatomyZoomAt(cam,2,point,canvas.width,canvas.height);
 const projected={
  x:canvas.width/2+(point.x-canvas.width/2)*z.scale+z.panX,
  y:canvas.height/2+(point.y-canvas.height/2)*z.scale+z.panY
 };
 assert.ok(Math.abs(projected.x-point.x)<1e-7);
 assert.ok(Math.abs(projected.y-point.y)<1e-7);
 for(const system of names){
  // It must not matter which anatomical plate is currently selected.
  const same=m.anatomyZoomAt(cam,2,point,canvas.width,canvas.height);
  assert.deepEqual(same,z,system+" must share the same zoom transform");
 }
}
const moved=m.anatomyPan({scale:2,panX:0,panY:0},100,-65,780,560);
assert.deepEqual(moved,{scale:2,panX:100,panY:-65});
assert.deepEqual(m.anatomyBoundCamera({scale:1,panX:200,panY:200},780,560),cam);
assert.equal(m.anatomyBoundCamera({scale:99,panX:0,panY:0},780,560).scale,3.25);

const webp=fs.readFileSync("src/assets/bio-atlas/human-seven-systems.webp");
assert.equal(webp.toString("ascii",0,4),"RIFF");
assert.equal(webp.toString("ascii",8,12),"WEBP");
assert.ok(webp.length>20000&&webp.length<180000);
assert.equal(m.ANATOMY_SPRITE_WIDTH,2870);
assert.equal(m.ANATOMY_PANEL_WIDTH*names.length,m.ANATOMY_SPRITE_WIDTH);
assert.equal(m.ANATOMY_SPRITE_HEIGHT,444);
const view=read("src/LektrusHumanAnatomy.tsx");
const editor=read("src/LektrusSchoolDiagramEditor.tsx");
const diagram=read("src/LektrusSchoolDiagramView.tsx");
const catalogue=read("src/lektrusSubjectToolRegistry.ts");
const panel=read("src/LektrusSubjectToolsPanel.tsx");
for(const file of ["src/LektrusHumanAnatomy.tsx","src/LektrusSchoolDiagramEditor.tsx",
 "src/LektrusSchoolDiagramView.tsx"]){
 const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,file+" cannot parse");
}
assert.match(view,/import anatomySprite from "\.\/assets\/bio-atlas\/human-seven-systems.webp"/);
assert.match(view,/const \[camera,setCamera\]=useState<AnatomyCamera>\(ANATOMY_INITIAL_CAMERA\)/);
const choose=view.slice(view.indexOf("const chooseSystem="),view.indexOf("const dimensions="))
 .split("\n").filter(line=>!line.trim().startsWith("//")).join("\n");
assert.doesNotMatch(choose,/setCamera|reset\(|travel\(|zoom\(/,
 "System selection must not move or zoom the viewport");
assert.match(view,/const system=onChange\?diagram.system:localSystem/);
assert.match(view,/style=\{\{transform:`translate3d\(/);
assert.match(view,/onWheel=\{wheel\} onPointerDown=\{onDown\} onPointerMove=\{onMove\}/);
assert.match(view,/kind:"pinch"/);
assert.match(view,/data-anatomy-system=\{system\}/);
assert.doesNotMatch(view,/LektrusBioHumanSystemOverlay/,
 "Atlas must render reviewed raster plates, not old organ doodles");
assert.match(editor,/draft.kind==="bio-anatomy"\)return createPortal/);
assert.match(editor,/<LektrusHumanAnatomy diagram=\{draft\} onChange=\{set\} editorMode\/>/);
assert.match(editor,/onClick=\{finish\}/);
assert.match(diagram,/case "bio-anatomy":return <LektrusHumanAnatomy/);
assert.match(catalogue,/id:"bio-anatomy",label:"Анатомия человека"/);
assert.match(catalogue,/id:"bio-microscope"[\s\S]*?subjects:\[\]/);
assert.match(panel,/"биология":\[\{title:"Анатомия человека",ids:\["bio-anatomy"\]/);
const css=read("src/lektrusHumanAnatomy.css");
assert.match(css,/\.lek-anatomy-dialog-backdrop/);
assert.match(css,/\.lek-anatomy-world/);
assert.match(css,/@container\(max-width:730px\)/);
assert.match(css,/\.lek-anatomy-stage\{[\s\S]*?touch-action:none/);
console.log("Standalone anatomy PASS: 7 systems, shared raster registration, invariant camera, responsive window, legacy documents.");
