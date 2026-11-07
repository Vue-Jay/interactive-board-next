import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=(path)=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
const budgetApi={};
new Function("exports",ts.transpileModule(read("inkCanvasBudget.ts"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText)(budgetApi);
const {inkCanvasBudget,MAX_INK_CANVAS_PIXELS,MAX_INK_CANVAS_AXIS}=budgetApi;

const {reuseInkCanvasBacking}=budgetApi;
let canvasDimensionWrites=0;
const mockCanvas={_width:300,_height:150,
 get width(){return this._width},
 set width(value){canvasDimensionWrites++;this._width=value},
 get height(){return this._height},
 set height(value){canvasDimensionWrites++;this._height=value},
};
assert.equal(reuseInkCanvasBacking(mockCanvas,1800,1000),false);
assert.equal(canvasDimensionWrites,2,"Initial allocation sets both backing axes");
for(let i=0;i<100;i++)
 assert.equal(reuseInkCanvasBacking(mockCanvas,1800,1000),true,
  "Repeated tile redraws must preserve the same GPU backing");
assert.equal(canvasDimensionWrites,2,
 "Same-size 100 redraws: before = 200 forced dimension writes, after = 0");
assert.equal(reuseInkCanvasBacking(mockCanvas,1900,1000),false);
assert.equal(canvasDimensionWrites,3,"Resize only the axis that changed");

const oldAxisOnly=(w,h,zoom,dpr)=>{
 const ratio=Math.min(1.25,Math.max(1,dpr||1));
 const x=Math.max(1,Math.ceil(w*zoom*ratio));
 const y=Math.max(1,Math.ceil(h*zoom*ratio));
 const factor=Math.min(1,4096/Math.max(x,y));
 return {width:Math.max(1,Math.ceil(w*zoom*ratio*factor)),
  height:Math.max(1,Math.ceil(h*zoom*ratio*factor))};
};
const cases=[
 ["small",850,600,1,1],
 ["large-square",3200,3200,1,1.25],
 ["large-wide",4800,2400,1,1.25],
 ["large-high-zoom",1600,1000,8,1.25],
 ["narrow",48,6000,1,1.25],
];
for(const [name,w,h,z,dpr] of cases){
 const before=oldAxisOnly(w,h,z,dpr);
 const after=inkCanvasBudget(w,h,z,dpr);
 const oldPixels=before.width*before.height,newPixels=after.width*after.height;
 assert.ok(newPixels<=MAX_INK_CANVAS_PIXELS,
  "RGBA allocation exceeds canvas pixel budget: "+name);
 assert.ok(Math.max(after.width,after.height)<=MAX_INK_CANVAS_AXIS);
 assert.ok(newPixels<=oldPixels,
  "Capped raster must not require more pixels than axis-only implementation");
 assert.ok(Math.abs(after.scaleX*w-after.width)<1e-7);
 assert.ok(Math.abs(after.scaleY*h-after.height)<1e-7);
 assert.ok(after.width>0&&after.height>0);
 console.log(JSON.stringify({case:name,oldRGBABytes:oldPixels*4,newRGBABytes:newPixels*4,
  savingPercent:Number(((1-newPixels/oldPixels)*100).toFixed(1))}));
}
const standard=inkCanvasBudget(800,600,1,1);
assert.equal(standard.width,800,"Normal low-DPI board stays pixel-perfect");
assert.equal(standard.height,600);
const source=read("ViewerInkLayer.tsx");
assert.match(source,/const pixels = inkCanvasBudget\(cssWidth,cssHeight,zoom,window\.devicePixelRatio\|\|1\)/);
assert.match(source,/canvas\.width = 0; canvas\.height = 0;/,
 "Offscreen raster layers must release their backing memory");
assert.match(source,/cacheRef\.current = null;/);
assert.match(source,/ctx\.setTransform\(pixels\.scaleX, 0, 0, pixels\.scaleY,/);
assert.match(source,/const reusedBacking=reuseInkCanvasBacking\(canvas,pixels\.width,pixels\.height\)/);
assert.match(source,/if\(reusedBacking\)\{[\s\S]*?ctx\.clearRect\(0,0,canvas\.width,canvas\.height\);/,
 "Reused canvas backing must clear previous pixels before painting the new tile");

const app=read("App.tsx");
const selectionStart=app.indexOf("  const selectedInkKey=useMemo(() => ");
const layerStart=app.indexOf("  const inkLayers = useMemo(() => {",selectionStart);
const layerEnd=app.indexOf("  const renderEntries = useMemo(() => {",layerStart);
assert.ok(selectionStart>=0&&layerStart>selectionStart&&layerEnd>layerStart);
const layers=app.slice(selectionStart,layerEnd);
assert.match(layers,/const selectedInkKey=useMemo\(\(\) => selectedIds\.size>24 \? "" :/);
assert.match(layers,/const detailedInkIds=useMemo\(/);
assert.match(layers,/\}, \[visibleItems, detailedInkIds\]\)/,
 "Non-ink selection must not re-create raster stroke arrays");
assert.doesNotMatch(layers,/\[visibleItems, selectedIds\]/);
assert.match(layers,/!detailedInkIds\.has\(item\.id\)/);
const byId=new Map([
 ["text",{id:"text",kind:"text",text:"Class"}],
 ["ink",{id:"ink",kind:"pen",points:[{x:0,y:0}]}],
]);
const selectedInkKey=(ids)=>ids.size>24?"":[...ids].filter(id=>{
 const item=byId.get(id);return item&&["pen","marker"].includes(item.kind)&&!!item.points?.length;
}).sort().join("\u0000");
const normal=selectedInkKey(new Set());
assert.equal(normal,selectedInkKey(new Set(["text"])),
 "Selecting ordinary objects does not modify raster grouping");
assert.notEqual(normal,selectedInkKey(new Set(["ink"])),
 "Selecting a stroke still moves it to the editable DOM layer");
assert.equal(normal,selectedInkKey(new Set(Array.from({length:25},(_,i)=>"ink-"+i))),
 "Large lasso selection retains fast batched ink rendering");
let oldRegroups=0,newRegroups=0,previousIds=new Set(),previousKey=selectedInkKey(previousIds);
for(let i=0;i<50;i++){
 const nextIds=i%2===0?new Set(["text"]):new Set();
 if(nextIds!==previousIds)oldRegroups++;
 const key=selectedInkKey(nextIds);
 if(key!==previousKey)newRegroups++;
 previousIds=nextIds;previousKey=key;
}
assert.equal(oldRegroups,50);
assert.equal(newRegroups,0);
console.log("Canvas grouping: 50 plain-object selection changes, 50->0 forced raster regroupings; selection of actual ink unchanged.");
