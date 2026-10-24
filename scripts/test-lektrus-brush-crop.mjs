import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const load=(file)=>{
 const source=fs.readFileSync(new URL("../src/"+file,import.meta.url),"utf8");
 const exports={};
 new Function("exports",ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
 }}).outputText)(exports);
 return exports;
};
const model=load("boardModel.ts");
const {placeImageCrop}=load("imageCropGeometry.ts");
const full={x:100,y:200,width:400,height:200,rotation:0};
const firstCrop={x:.25,y:.25,width:.5,height:.5};
const first=placeImageCrop(full,firstCrop);
assert.deepEqual(first,{x:200,y:250,width:200,height:100,imageCrop:firstCrop});
const restored=placeImageCrop({...first,rotation:0},{x:0,y:0,width:1,height:1});
assert.deepEqual(restored,{x:100,y:200,width:400,height:200,
 imageCrop:{x:0,y:0,width:1,height:1}});
const moved=placeImageCrop({...first,rotation:0},{x:.5,y:.25,width:.5,height:.5});
assert.deepEqual(moved,{x:300,y:250,width:200,height:100,
 imageCrop:{x:.5,y:.25,width:.5,height:.5}});
const rotated=placeImageCrop({...full,rotation:90},firstCrop);
assert.ok(Math.abs(rotated.x-200)<1e-8&&Math.abs(rotated.y-250)<1e-8);
const image={id:"image-1",kind:"image",x:first.x,y:first.y,
 width:first.width,height:first.height,text:"",
 assetId:"original-image",name:"test.png",mime:"image/png",imageCrop:firstCrop};
const document={version:1,title:"Тест обрезки",
 view:{x:0,y:0,zoom:1},items:[image]};
const saved=model.parseDocument(JSON.stringify(document));
assert.deepEqual(saved.items[0].imageCrop,firstCrop,
 "Crop geometry must survive save/load and Realtime serialization");
assert.equal(saved.items[0].assetId,"original-image",
 "The original asset ID must survive non-destructive cropping");
assert.equal(model.validImageCrop({x:.25,y:.25,width:.5,height:.5}),true);
for(const invalid of [
 {x:-.1,y:0,width:.5,height:1},
 {x:.8,y:0,width:.5,height:1},
 {x:0,y:0,width:0,height:1},
 {x:0,y:0,width:1,height:Infinity}
]){
 assert.equal(model.validImageCrop(invalid),false);
 assert.throws(()=>model.parseDocument(JSON.stringify({
  ...document,items:[{...image,imageCrop:invalid}]})));
}
const app=fs.readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
assert.ok(app.includes("placeImageCrop(current,crop)"));
assert.ok(app.includes('className="inline-image-crop" style={originalBounds}'));
assert.ok(app.includes("placeImageCrop(current,crop)"));
assert.ok(app.includes("crop.x*img.naturalWidth"),
 "PNG export must honor the persisted crop without losing source pixels");
const preview=fs.readFileSync(new URL("../src/boardPreview.ts",import.meta.url),"utf8");
assert.ok(preview.includes("c.x*bitmap.width")&&preview.includes("c.width*bitmap.width"),
 "Gallery thumbnails must also show the selected crop");
assert.ok(!app.includes("await putAsset(assetId,blob,boardSummary.id)"),
 "Applying an image crop must never upload a destructive clipped image");
assert.ok(app.includes("previous.item.imageCrop?.width === next.item.imageCrop?.width"),
 "Image renderer must rerender when crop changes");
const widthsSource=fs.readFileSync(new URL("../src/LectrisObjectEditor.tsx",import.meta.url),"utf8");
for(const [tool,sizes] of [["pen",[1,3,6,12,22]],["marker",[2,7,14,28,48]],["eraser",[6,16,32,55,90]]]){
 assert.ok(widthsSource.includes(tool+":["+sizes.join(",")+"]"));
 assert.ok(sizes.every((n,i)=>i===0||n>sizes[i-1]*1.65),
  "Visually distinct presets for "+tool);
}
assert.ok(app.includes("<InkWidthSample tool={tool} size={size}"),
 "Bottom toolbar must show a real-size proportional stroke and numeric label");
console.log("Lektrus brush presets + editable non-destructive image crops: OK");
