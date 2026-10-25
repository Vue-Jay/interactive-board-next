import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const model=read("src/lektrusOpticsModel.ts");
const js=ts.transpileModule(model,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const optics=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const blank=optics.emptyOptics();
assert.equal(blank.elements.length,0,"new optics must have no elements");
assert.equal(blank.rays.length,0,"new optics must have no example rays");
assert.equal(optics.validOptics(blank),true);
const src={...optics.makeOpticalElement("source",100,280),id:"src"};
const mirror={...optics.makeOpticalElement("mirror",500,280),id:"mirror"};
const ray={id:"ray",sourceId:"src",angle:0,color:"#ffad3e"};
const reflective={...blank,elements:[src,mirror],rays:[ray]};
assert.equal(optics.validOptics(reflective),true);
const reflected=optics.traceOpticalRay(reflective,ray);
assert.equal(reflected.kind,"reflected");
assert.ok(reflected.points[2].x<reflected.points[1].x,"mirror reflects to the source side");
const lens={...optics.makeOpticalElement("converging-lens",500,280),id:"lens"};
const lensDocument={...blank,elements:[src,lens],rays:[{...ray,angle:10}]};
assert.equal(optics.traceOpticalRay(lensDocument,lensDocument.rays[0]).kind,"lens");
const boundary={...optics.makeOpticalElement("interface",500,280),id:"interface",n1:1,n2:1.5};
const nearSource={...src,x:465};
const refracting={...blank,elements:[nearSource,boundary],rays:[{...ray,angle:20}]};
const refracted=optics.traceOpticalRay(refracting,refracting.rays[0]);
assert.equal(refracted.kind,"refracted");
// A light ray must not stop after its first optical component.
const firstLens={...optics.makeOpticalElement("converging-lens",300,280),id:"first-lens"};
const secondLens={...optics.makeOpticalElement("diverging-lens",600,280),id:"second-lens"};
const multiLens={...blank,elements:[src,firstLens,secondLens],rays:[ray]};
const multiLensTrace=optics.traceOpticalRay(multiLens,ray);
assert.ok(multiLensTrace.points.length>=4,"ray must continue through both lenses and to the edge");
assert.ok(multiLensTrace.points.some(p=>Math.abs(p.x-300)<1),"ray must hit first lens");
assert.ok(multiLensTrace.points.some(p=>Math.abs(p.x-600)<1),"ray must hit second lens");
assert.ok(multiLensTrace.points.at(-1).x>900,"ray must emerge beyond second lens");
const mirrorAfterLens={...blank,elements:[src,firstLens,mirror],rays:[ray]};
const bounced=optics.traceOpticalRay(mirrorAfterLens,ray);
assert.ok(bounced.points.some(p=>Math.abs(p.x-300)<1)&&bounced.points.some(p=>Math.abs(p.x-500)<1),
 "mirror interaction must still work after a lens");
assert.ok(bounced.points.length>=5,"reflected ray must travel back through the lens");
const reverseScreen={...optics.makeOpticalElement("screen",70,280),id:"rear-screen"};
const captured={...blank,elements:[src,firstLens,mirror,reverseScreen],rays:[ray]};
const capturedTrace=optics.traceOpticalRay(captured,ray);
assert.ok(capturedTrace.points.length>=5);
assert.ok(capturedTrace.note.includes("экран"),"reflected ray should stop at screen after several elements");
const initial=Math.abs((refracted.points[1].y-refracted.points[0].y)/(refracted.points[1].x-refracted.points[0].x));
const transmitted=Math.abs((refracted.points[2].y-refracted.points[1].y)/(refracted.points[2].x-refracted.points[1].x));
assert.ok(transmitted<initial,"refraction into denser medium bends toward normal");
const prism={...optics.makeOpticalElement("prism",500,280),id:"prism"};
const prismDocument={...blank,elements:[src,prism],rays:[ray]};
const prismRay=optics.traceOpticalRay(prismDocument,ray);
assert.equal(prismRay?.kind,"prism","prism ray must interact with both surfaces");
assert.ok(prismRay.points.length>=3,"prism ray must have at least entry and exit");
const reflectedTotal={...blank,elements:[nearSource,{...boundary,n1:1.6,n2:1}],rays:[{...ray,angle:70}]};
assert.equal(optics.traceOpticalRay(reflectedTotal,reflectedTotal.rays[0]).kind,"reflected");

// Prism rays must keep travelling after total internal reflection.
// Previously this branch returned immediately at the second face.
const glassPrism={...prism,n1:1,n2:1.5};
const tirPath=optics.traceOpticalRay({...blank,elements:[src,glassPrism],rays:[ray]},ray);
assert.ok(tirPath.points.length>=4,"A ray must continue after its first internal prism reflection");
assert.ok(!tirPath.note.includes("предел 96"),"Normal triangular prism must not exhaust its interaction budget");
const tirEnd=tirPath.points.at(-1);
assert.ok([0,960].some(x=>Math.abs(tirEnd.x-x)<0.01)||
  [0,560].some(y=>Math.abs(tirEnd.y-y)<0.01),
  "A ray must emerge from the prism and reach a canvas edge");

// Exactly aligned prism, mirror and prism again: the return ray must hit
// both prism faces on the way back, instead of stopping inside the glass.
const neutralPrism={...prism,n1:1,n2:1};
const farMirror={...mirror,x:810,id:"far-mirror"};
const returnScene={...blank,elements:[src,neutralPrism,farMirror],rays:[ray]};
const returned=optics.traceOpticalRay(returnScene,ray);
assert.ok(returned.points.length>=7,"Light must traverse prism, reflect and traverse it again");
assert.ok(returned.points.at(-1).x<1,"Return ray must continue past the prism to the left edge");
assert.ok(returned.points.filter(p=>Math.abs(p.x-500)<75).length>=4,
  "Both triangular surfaces must be crossed in both directions");

// Composition matrix: none of the school component combinations should
// leave a non-finite coordinate or throw during multiple interactions.
const types=["mirror","converging-lens","diverging-lens","interface","screen","prism"];
for(const firstType of types)for(const secondType of types){
 const first={...optics.makeOpticalElement(firstType,330,280),id:"first"};
 const second={...optics.makeOpticalElement(secondType,650,280),id:"second"};
 const scene={...blank,elements:[src,first,second],rays:[ray]};
 const result=optics.traceOpticalRay(scene,ray);
 assert.ok(result&&result.points.length>=2,"Ray must be traced: "+firstType+" + "+secondType);
 assert.ok(result.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&
   p.x>=-0.01&&p.x<=960.01&&p.y>=-0.01&&p.y<=560.01),
   "Ray path must stay inside drawing: "+firstType+" + "+secondType);
 assert.ok(result.points.length<=99,"Ray tracing interaction budget must be finite");
}
assert.equal(optics.validOptics({...blank,elements:[{...src,n1:Infinity}]}),false,"invalid values rejected");
const factory=read("src/lektrusSubjectToolRegistry.ts");
for(const id of ["physics-mechanics","physics-optics","physics-graphs","physics-circuits"])
 assert.ok(factory.includes('id==="'+id+'"'),"blank-start factory for "+id);
const app=read("src/App.tsx"),icon=read("src/LektrusSubjectToolIcons.tsx");
const editor=read("src/LektrusOpticsEditor.tsx"),view=read("src/LektrusOpticsView.tsx");
assert.match(app,/scienceOptics\|\|\["physics-optics"/,"optics opens dedicated editor");
assert.match(app,/<LektrusOpticsView doc=\{item.scienceOptics\}/,"optics renders on board");
assert.match(editor,/role="dialog" aria-modal="true" aria-label="Редактор оптики"/);
assert.match(editor,/onSave\(saveValue\(\)\)/,"optics saves persisted schema");
assert.match(view,/traceOptics\(doc\)/);
assert.match(icon,/"physics-optics":/);
assert.doesNotMatch(editor,/makeSciencePresetItem|selectVariant|готовый шаблон/i,
 "optics must be its own blank-first workspace");
const toolIcon=read("src/LektrusOpticsToolIcon.tsx");
const palette=read("src/lektrusOpticsEditor.css");
assert.match(editor,/LektrusOpticsToolIcon type=\{t.id\}/,"Editor must use optical-specific icon set");
for(const type of ['"source"','"mirror"','"converging-lens"','"diverging-lens"','"interface"','"screen"','"prism"'])
 assert.ok(toolIcon.includes(type),"Missing optical glyph "+type);
assert.match(palette,/grid-template-columns:minmax\(0,1fr\)/,"Optical buttons must use one column");
assert.match(palette,/white-space:nowrap/,"Optical button names must stay on one line");
console.log("Physics optics: blank tools, persisted optical elements, reflection, Snell refraction, lens and board view OK");
