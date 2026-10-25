import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const transpile=path=>{
 const source=read(path);
 const parsed=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,
  path.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(parsed.parseDiagnostics.length,0,path+" parses");
 return ts.transpileModule(source,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX
 }}).outputText;
};
const load=(code)=>{
 const exports={};
 new Function("exports","require",code)(exports,()=>({}));
 return exports;
};

const {resizedRect,preserveRotatedAnchor}=load(transpile("src/lektrusRotateResize.ts"));
const model=load(transpile("src/boardModel.ts"));
const app=read("src/App.tsx");
const geometry=read("src/GeometryInstruments.tsx");
transpile("src/GeometryInstruments.tsx");
transpile("src/App.tsx");

const base={x:100,y:120,width:200,height:100};
const outward={
 nw:[-30,-20],n:[0,-20],ne:[30,-20],e:[30,0],
 se:[30,20],s:[0,20],sw:[-30,20],w:[-30,0]
};
for(const [handle,[dx,dy]] of Object.entries(outward)){
 const result=resizedRect(base,handle,dx,dy,30,25,false);
 assert.ok(result.width>=base.width-(handle==="n"||handle==="s"?0:0));
 assert.ok(result.height>=base.height);
 if(handle.includes("e")||handle.includes("w"))assert.equal(result.width,230);
 if(handle.includes("n")||handle.includes("s"))assert.equal(result.height,120);
}
assert.deepEqual(resizedRect(base,"nw",30,20,30,25,false),
 {x:130,y:140,width:170,height:80},"top-left drag shrinks diagonally");
assert.deepEqual(resizedRect(base,"se",30,20,30,25,false),
 {x:100,y:120,width:230,height:120},"bottom-right drag grows diagonally");
assert.deepEqual(resizedRect(base,"w",-30,0,30,25,false),
 {x:70,y:120,width:230,height:100},"left handle follows finger without mirroring");
const proportional=resizedRect(base,"nw",30,10,30,25,true);
assert.ok(Math.abs(proportional.width/proportional.height-2)<1e-9,
 "Shift keeps proportions during diagonal resizing");

for(const rotation of [0,45,90,135,180,270]){
 const theta=rotation*Math.PI/180,c=Math.cos(theta),s=Math.sin(theta);
 const center=b=>({x:b.x+b.width/2,y:b.y+b.height/2});
 const anchor=(b,handle)=>{
  const bx=handle.includes("w")?b.width/2:handle.includes("e")?-b.width/2:0;
  const by=handle.includes("n")?b.height/2:handle.includes("s")?-b.height/2:0;
  const p=center(b);
  return {x:p.x+c*bx-s*by,y:p.y+s*bx+c*by};
 };
 for(const handle of ["nw","ne","se","sw","n","e","s","w"]){
  const local=resizedRect(base,handle,handle.includes("w")?-30:30,
    handle.includes("n")?-20:20,30,25,false);
  const next=preserveRotatedAnchor(base,local,rotation);
  const p=anchor(base,handle),q=anchor(next,handle);
  assert.ok(Math.hypot(p.x-q.x,p.y-q.y)<1e-7,
   "opposite anchor does not drift for "+rotation+" "+handle);
 }
}
assert.match(app,/preserveRotatedAnchor\(base,localRect,base.rotation\?\?0\)/,
 "universal object transform uses fixed rotated anchor");

const instrument={
 id:"ruler-a",kind:"instrument",x:100,y:200,width:410,height:88,text:"",
 instrumentType:"ruler",instrumentScale:1.25,rotation:25
};
const doc={version:1,title:"Общая доска",subject:"математика",
 view:{x:0,y:0,zoom:1},items:[instrument]};
const parsed=model.parseDocument(JSON.stringify(doc));
assert.deepEqual(parsed.items[0],instrument,
 "shared measuring tools survive document export/import intact");
for(const broken of [{...instrument,instrumentScale:-2},
 {...instrument,instrumentType:"laser"},{...instrument,instrumentScale:Infinity}]){
 assert.throws(()=>model.parseDocument(JSON.stringify({...doc,items:[broken]})),
  "invalid measuring tools must not enter synced board state");
}
assert.match(app,/items.filter\(item => item.kind === "instrument"\)/,
 "all viewers render instruments from the shared board items");
assert.match(app,/commit\(\[\.\.\.itemsRef.current,instrument\]\)/,
 "adding a ruler creates a new shared item instead of replacing the previous one");
assert.match(app,/commit\(itemsRef.current.map\(item=>item.id===id&&item.kind==="instrument"/,
 "moving or rotating one ruler updates only that instrument");
assert.match(app,/renderOverlays=\{false\}/,
 "the mobile trigger does not duplicate instrument portals");
assert.match(geometry,/renderOverlays&&instruments.filter\(i=>!i.hidden\).map/,
 "one shared overlay is drawn for each ruler, set square, or protractor");
assert.match(geometry,/onRemove\(item.id\)/,
 "each measuring tool has its own removal action");
console.log("Shared rulers and fixed-anchor diagonal object resizing: checks passed.");
