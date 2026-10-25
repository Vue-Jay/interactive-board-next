import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const source=read("src/lektrusSvgPointer.ts");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {svgClientPoint,clampCanvasPoint}=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const transformed={
 getScreenCTM:()=>({inverse:()=>({})}),
 createSVGPoint:()=>({x:0,y:0,matrixTransform(){
  return {x:(this.x-410)/1.4,y:(this.y-198)/1.4};
 }}),
 viewBox:{baseVal:{x:0,y:0,width:960,height:560}},
 getBoundingClientRect:()=>({left:400,top:195,width:1400,height:790})
};
const click={x:844,y:410};const p=svgClientPoint(transformed,click.x,click.y);
assert.ok(Math.abs(p.x-310)<1e-9&&Math.abs(p.y-151.42857142857142)<1e-9,
 "CTM must determine exact user-space position, even when CSS/letterboxing differs");
assert.deepEqual(svgClientPoint(transformed,410,198),{x:0,y:0});
const resized={
 viewBox:{baseVal:{x:0,y:0,width:960,height:560}},
 getScreenCTM:()=>null,
 getBoundingClientRect:()=>({left:200,top:100,width:1400,height:560})
};
const center=svgClientPoint(resized,900,380);
assert.equal(center.x,480,"Fallback accounts for extra blank area around centered sheet");
assert.equal(center.y,280);
assert.deepEqual(clampCanvasPoint({x:-10,y:900},960,560),{x:0,y:560});
for(const file of ["src/LektrusOpticsView.tsx","src/LektrusMechanicsView.tsx",
 "src/LektrusCircuitView.tsx","src/LektrusPhysicsGraphEditor.tsx"]){
 const src=read(file);
 assert.ok(src.includes("svgClientPoint("),file+" should use screen matrix for placement");
}
const graph=read("src/LektrusPhysicsGraphEditor.tsx");
assert.ok(graph.includes("inPlot(event,"),"Points must not jump to the left edge after off-grid click");
const svgOpts=read("src/lektrusOpticsEditor.css");
const svgMech=read("src/lektrusMechanicsEditor.css");
assert.ok(svgOpts.includes("container-type:size")&&svgMech.includes("container-type:size"),
 "The visible drawing page must match the actual SVG hit area");
const glyph=read("src/LektrusSubjectToolIcons.tsx");
assert.ok(glyph.includes('"physics-optics":<><path d="M11 3c-2.8 4.6-2.8 13.4 0 18'),
 "Subject optics icon must use the user-approved converging lens and rays");
console.log("Physical editors: real SVG coordinate mapping, visible sheet, accurate cursor, and new optics icon OK");
