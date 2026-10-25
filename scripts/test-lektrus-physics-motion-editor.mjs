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
console.log("Physics graphs: dedicated motion editor, no mixed forces, valid graph data and unified circuit controls.");
