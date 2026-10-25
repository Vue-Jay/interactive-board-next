import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=read("src/App.tsx");
const editor=read("src/LektrusPhysicsGraphEditor.tsx");
const css=read("src/lektrusPhysicsGraphEditor.css");
const circuit=read("src/LektrusCircuitEditor.tsx");
const buttons=read("src/lektrusCircuitButtons2026.css");
const icon=read("src/LektrusCircuitUiIcon.tsx");
const entry=read("src/main.tsx");
const parsed=ts.transpileModule(editor,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ES2022},
  reportDiagnostics:true,fileName:"LektrusPhysicsGraphEditor.tsx"});
assert.equal(parsed.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0,
  "Physics graph editor TSX syntax");
assert.match(app,/import LektrusPhysicsGraphEditor/);
assert.match(app,/physics-motion","physics-speed","physics-accelerated-speed","physics-acceleration","physics-braking","physics-rest"/);
assert.match(app,/<LektrusPhysicsGraphEditor key=\{scienceEditorItem.id\}/);
assert.match(editor,/graphPurpose:"coordinates"/);
assert.match(editor,/graphSegments:\[\],graphPolygons:\[\]/);
assert.match(editor,/graphXMin:0,graphXMax:d.xMax/);
assert.match(editor,/graphYMin:d.yMin,graphYMax:d.yMax/);
assert.match(editor,/type Tool="select"\|"point"/);
assert.doesNotMatch(editor,/lektrus-physics-quick-actions|scienceCircuitSymbol|Добавить силу|scienceArrow/,
  "Motion graphs must not include mechanics and circuit editing controls");
for(const text of ["Вид зависимости","Сетка","Привязка 0,5","Соединять точки","Подписи точек","Время до, с","Добавить точку"])
  assert.ok(editor.includes(text),text+" must be graph-specific");
assert.match(editor,/onPointerMove=\{event=>\{/);
assert.match(editor,/onPointerUp=\{finish\} onPointerCancel=\{finish\}/);
assert.match(editor,/onSave\(makeItem\(item,draft\)\)/);
assert.match(css,/grid-template-columns:265px minmax\(0,1fr\)/);
assert.match(circuit,/LektrusCircuitUiIcon kind="select"/);
assert.match(circuit,/LektrusCircuitUiIcon kind="hand"/);
assert.match(circuit,/LektrusCircuitUiIcon kind="wire"/);
assert.match(circuit,/LektrusCircuitUiIcon kind="junction"/);
assert.match(icon,/viewBox="0 0 24 24"/);
for(const label of ["circuit-categories button","circuit-parts>button","circuit-rotate button",
  "circuit-inspector-delete","circuit-footer button","circuit-toolgroup button","circuit-zoom button"])
  assert.ok(buttons.includes(label),label+" needs consistent styling");
assert.match(entry,/import "\.\/lektrusPhysicsGraphEditor.css"/);
assert.match(entry,/import "\.\/lektrusCircuitButtons2026.css"/);
// Board toolbar icons, not the tools inside fullscreen physics editors.
const subjectIcons=read("src/LektrusSubjectToolIcons.tsx");
for(const id of ["physics-mechanics","physics-optics","physics-graphs","physics-circuits"]){
 const line=subjectIcons.split("\n").find(s=>s.includes(' "'+id+'":'));
 assert.ok(line&&line.includes("currentColor"),"Board physics icon must match Lektrus's monochrome vector language: "+id);
}
const mechanicsGlyph=read("src/LektrusMechanicsToolIcon.tsx");
const opticsGlyph=read("src/LektrusOpticsToolIcon.tsx");
assert.ok(mechanicsGlyph.includes('const blue="#4779b9"'),"Preserve original mechanics editor icons");
assert.ok(opticsGlyph.includes('const opticalStroke="#3d77b7"'),"Preserve original optics editor icons");
assert.ok(icon.includes("const path:Record<Kind,string>"),"Preserve original circuit editor icons");
assert.ok(editor.includes('>Выбор</button>')&&editor.includes('>+ Точка</button>'),
 "Fullscreen motion editor button layout must be restored");

const compactCursors=read("src/lektrusPhysicsPointers.css");
assert.ok(compactCursors.includes('width%3D%2220%22')&&
 !compactCursors.includes('width%3D%2232%22'),
 "The pointer images must use 20px size rather than oversized 32px");
const axisTs=read("src/lektrusPhysicsGraphTicks.ts");
const axisJs=ts.transpileModule(axisTs,{compilerOptions:{
 module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {motionAxisTicks,isPhysicsMotionGraph}=await import("data:text/javascript;base64,"+Buffer.from(axisJs).toString("base64"));
assert.equal(isPhysicsMotionGraph("physics-motion"),true);
assert.equal(isPhysicsMotionGraph("physics-optics"),false);
for(const [min,max,labels] of [[0,12,8],[-4,5,5],[0,9,7],[0,0.8,7],
 [1.25,14.75,8],[-16,180,7],[0,900,7]]){
 const axisTicks=motionAxisTicks(min,max,labels);
 assert.ok(axisTicks.labels.every(Number.isInteger),"Axis labels must be integers: "+min+".."+max);
 assert.ok(axisTicks.grid.length>=axisTicks.labels.length,
  "Grid cannot omit labelled positions: "+min+".."+max);
 assert.ok(axisTicks.labels.every(x=>axisTicks.grid.includes(x)),
  "Every label should sit on a visible grid line: "+min+".."+max);
}
const defaultTicks=motionAxisTicks(0,12,8);
assert.deepEqual(defaultTicks.labels,[0,2,4,6,8,10,12]);
assert.ok(defaultTicks.grid.includes(1)&&!defaultTicks.labels.includes(1),
 "Unlabelled intermediate subdivision should remain visible");
assert.ok(editor.includes('xTicks.labels.map')&&editor.includes('yTicks.labels.map'));
assert.ok(app.includes('motionXTicks?.labels??gridX')&&app.includes('motionYTicks?.labels??gridY'),
 "The board preview must use the same integer tick layout as the full editor");

console.log("Physics graphs: dedicated motion editor, no mixed forces, valid graph data and unified circuit controls.");
