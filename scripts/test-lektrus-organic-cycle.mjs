import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const src=readFileSync(new URL("../src/lektrusOrganicCycle.ts",import.meta.url),"utf8");
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText.replace(/\bexport\s+/g,"");
const regularize=new Function(js+";return regularizeOrganicCycle;")();
for(const n of [3,4,5,6,7,8,10,12]){
 const points=Array.from({length:n},(_,i)=>({x:i*2.15,y:i%2===0?0:.6,label:"C"}));
 const links=Array.from({length:n-1},(_,i)=>({a:i,b:i+1}));
 const out=regularize(points,links,0,n-1);
 assert.ok(out&&out.length===n,"Closure must produce "+n+" vertices");
 for(let i=0;i<n;i++){
  const a=out[i],b=out[(i+1)%n];
  assert.ok(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-2.15)<1e-8,"Regular ring edges must be equal");
 }
 assert.equal(out[0].label,"C");
}
assert.equal(regularize([{x:0,y:0},{x:1,y:0}], [{a:0,b:1}],0,1),null);
const branched=[{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:1,y:1}];
assert.equal(regularize(branched,[{a:0,b:1},{a:1,b:2},{a:1,b:3}],0,2),null,
 "Never distort branches to regularise a ring");
const editor=readFileSync(new URL("../src/LektrusOrganicCanvas.tsx",import.meta.url),"utf8");
assert.ok(editor.includes('name:"Замкнуть"')&&editor.includes('regularizeOrganicCycle('));
assert.ok(editor.includes('setClosingStart(index)')&&editor.includes('addConnection(from,points[to],to)'));
assert.equal(ts.createSourceFile("canvas.tsx",editor,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0);
console.log("Organic cycle closure: polygon regularisation, branches, endpoint selection: OK");
