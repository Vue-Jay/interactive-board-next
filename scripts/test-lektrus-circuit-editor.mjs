import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const circuitSource=read("src/lektrusCircuitModel.ts");
const code=ts.transpileModule(circuitSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const model=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));

const templates=["physics-circuit-series","physics-circuit-parallel","physics-circuit-meters","physics-circuit-free"];
for(const name of templates){
  const doc=model.circuitTemplate(name);
  assert.equal(model.circuitIsDocument(doc),true,name+" must contain valid connections");
  assert.ok(doc.components.length>=0,name+" components");
  assert.ok(doc.wires.every(w=>model.circuitPolyline(doc,w).length>=2),name+" routed wires");
}

const series=model.circuitTemplate("physics-circuit-series");
assert.ok(series.components.some(c=>c.type==="battery"));
assert.ok(series.components.some(c=>c.type==="lamp"));
assert.ok(series.components.some(c=>c.type==="switch"));
assert.ok(series.wires.length>2);

const parallel=model.circuitTemplate("physics-circuit-parallel");
// A source must NOT be shunted by a plain direct wire connection on both terminals.
const source=parallel.components.find(c=>c.type==="battery");
assert.ok(source);
const anchorKey=a=>a.kind==="junction"?"j:"+a.junctionId:"c:"+a.componentId+":"+a.side;
const wireNet=new Map();
function link(a,b){
  const aKey=anchorKey(a),bKey=anchorKey(b);
  if(!wireNet.has(aKey))wireNet.set(aKey,new Set());
  if(!wireNet.has(bKey))wireNet.set(bKey,new Set());
  wireNet.get(aKey).add(bKey);wireNet.get(bKey).add(aKey);
}
parallel.wires.forEach(w=>link(w.from,w.to));
const from="c:"+source.id+":a",to="c:"+source.id+":b";
const visited=new Set([from]),queue=[from];
while(queue.length){
  const current=queue.shift();
  for(const connected of wireNet.get(current)??[]){
    if(!visited.has(connected)){visited.add(connected);queue.push(connected)}
  }
}
assert.equal(visited.has(to),false,"parallel template must not short the battery with wires");

const resistor=series.components.find(c=>c.type==="resistor");
assert.ok(resistor);
const terminal=model.circuitTerminal(resistor,"a");
assert.equal(typeof terminal.x,"number");
const translated={...series,components:series.components.map(c=>c.id===resistor.id?{...c,x:c.x+20}:c)};
const connection=series.wires.find(w=>[w.from,w.to].some(a=>a.kind==="terminal"&&a.componentId===resistor.id));
assert.ok(connection);
assert.notDeepEqual(model.circuitPolyline(series,connection),model.circuitPolyline(translated,connection),
  "wires must follow the moved terminal");

const without=model.circuitRemoveComponent(series,resistor.id);
assert.ok(without.wires.length<series.wires.length,"removing a component disconnects its wires");
assert.equal(model.circuitIsDocument(without),true);

const empty=model.createCircuitDocument();
const a={kind:"junction",junctionId:"left"},b={kind:"junction",junctionId:"right"};
const blank={...empty,junctions:[{id:"left",x:100,y:100},{id:"right",x:300,y:100}]};
const once=model.circuitDocumentWithWire(blank,a,b);
assert.equal(once.wires.length,1);
assert.equal(model.circuitDocumentWithWire(once,a,b),once,"duplicate wires must be rejected");
assert.equal(model.circuitDocumentWithWire(once,a,a),once,"zero-length wires must be rejected");
assert.equal(model.circuitIsDocument(once),true);
assert.equal(model.circuitIsDocument({...once,wires:[{...once.wires[0],to:{kind:"junction",junctionId:"unknown"}}]}),false);

const editor=read("src/LektrusCircuitEditor.tsx");
const view=read("src/LektrusCircuitView.tsx");
const glyph=read("src/ScienceCircuitGlyph.tsx");
const app=read("src/App.tsx");
assert.match(editor,/Конструктор электрических цепей/);
assert.match(editor,/Undo|history|Ctrl\+Z/);
assert.match(editor,/onComponentDown=\{downComponent\}/);
assert.match(editor,/onDragStart/);
assert.match(editor,/onAnchor=\{clickAnchor\}/);
assert.match(view,/circuitPolyline\(doc,wire\)/);
assert.match(view,/circuitTerminal\(component,"a"\)/);
assert.match(app,/circuitFromLegacyItem\(item\)/);
for(const id of ["voltmeter","ammeter","resistor","variable-resistor","photoresistor",
  "lamp","switch","push-button","battery","cell","diode","led",
  "capacitor","capacitor-polarized","galvanometer","motor","fuse","inductor","ground"])
  assert.ok(glyph.includes('id:"'+id+'"'),id+" must be available in the school palette");
// The schematic stays in its stable saved coordinate system while the editor
// provides large-screen navigation, compact settings, and touch gestures.
const circuitStyles=read("src/lektrusCircuitEditor.css");
const physicsStyles=read("src/lektrusScienceEditor.css");
const physicsEditor=read("src/LektrusScienceEditor.tsx");
assert.match(circuitStyles,/width:100vw!important/,"Circuit editor should fill the viewport");
assert.match(circuitStyles,/height:100dvh!important/,"Circuit editor should fill viewport height");
assert.match(circuitStyles,/palette-collapsed/,"Circuit component catalog must collapse");
assert.match(circuitStyles,/inspector-expanded/,"Selection settings must be contextual");
assert.match(editor,/onClick=\{\(\)=>changeTool\("hand"\)\}/,"Hand tool must be usable");
assert.match(editor,/pinchRef\.current/,"Touch pinch must control the editor");
assert.match(view,/onPointerDownCapture=\{onBackgroundDown\}/,"Capture pinch before dragging components");
assert.match(view,/vb\.width>0\?vb\.width:900/,"Touch placement must account for zoomed SVG");
assert.match(physicsStyles,/physics-workspace/,"Physics editor must have a separate large workspace");
assert.match(physicsStyles,/settings-collapsed/,"Physics settings must collapse");
assert.match(physicsEditor,/lektrus-physics-quick-actions/,"Forces and geometry need on-canvas quick actions");
assert.match(physicsEditor,/const pickPoint=\(index:number\)=>/,"Clicking physical points should select vector endpoints");
assert.match(physicsEditor,/addMechanicsForce\("F",2\.5,0\)/,"Mechanics force tool must create an explicit vector");
assert.match(physicsEditor,/scienceArrow:true/,"Mechanics vectors must carry arrow metadata");
assert.match(physicsEditor,/addLink\(false\)/,"Add line must create an unarrowed construction");
console.log("Electrical circuits: validated templates, electrical topology, wiring, deletion, 22-part palette and editor integration.");
