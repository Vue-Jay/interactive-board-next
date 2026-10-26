import assert from "node:assert/strict";
import {inflateSync} from "node:zlib";
import {readFileSync} from "node:fs";
// Inspect actual RGBA pixels rather than relying only on the atlas dimensions.
// This catches clipping, adjacent-tile spill and the stray generator dots.
const png=readFileSync(new URL("../public/lektrus-subject-illustrations.png",import.meta.url));
assert.equal(png[24],8,"Subject atlas must have eight-bit PNG channels");
assert.equal(png[25],6,"Subject atlas must keep RGBA to verify transparent margins");
const chunks=[];let pos=8;
while(pos<png.length){
 const n=png.readUInt32BE(pos),tag=png.toString("ascii",pos+4,pos+8);
 if(tag==="IDAT")chunks.push(png.subarray(pos+8,pos+8+n));
 pos+=n+12;
 if(tag==="IEND")break;
}
const inflated=inflateSync(Buffer.concat(chunks));
const width=png.readUInt32BE(16),height=png.readUInt32BE(20),stride=width*4;
assert.equal(width,672);
assert.equal(height,672);
let prev=Buffer.alloc(stride),at=0;
const bboxes=Array.from({length:43},()=>({left:96,right:-1,top:96,bottom:-1,pixels:0}));
const foodPyramidRightEdge=new Set();
for(let y=0;y<height;y++){
 const filter=inflated[at++],cur=Buffer.alloc(stride);
 for(let i=0;i<stride;i++){
  const left=i>=4?cur[i-4]:0,above=prev[i],upperLeft=i>=4?prev[i-4]:0;
  let predictor=0;
  if(filter===1)predictor=left;
  else if(filter===2)predictor=above;
  else if(filter===3)predictor=(left+above)>>1;
  else if(filter===4){
   const p=left+above-upperLeft,da=Math.abs(p-left),db=Math.abs(p-above),dc=Math.abs(p-upperLeft);
   predictor=da<=db&&da<=dc?left:db<=dc?above:upperLeft;
  }else assert.equal(filter,0,"Unsupported subject-atlas PNG row filter");
  cur[i]=(inflated[at++]+predictor)&255;
 }
 for(let x=0;x<width;x++){
  if(cur[x*4+3]<=24)continue;
  const col=Math.floor(x/96),row=Math.floor(y/96),index=row*7+col;
  assert.ok(index<43,"Unexpected artwork outside the 43 registered subject tiles");
  const b=bboxes[index],lx=x%96,ly=y%96;
  b.left=Math.min(b.left,lx);b.right=Math.max(b.right,lx);
  // The approved food-chain icon is a three-tier pyramid. Both sides must reach the base.
  if(index===18&&ly>=60&&ly<=79&&cur[x*4+3]>110&&
     Math.abs(lx-(48+(ly-12)*0.53))<2.5)foodPyramidRightEdge.add(ly);
  b.top=Math.min(b.top,ly);b.bottom=Math.max(b.bottom,ly);b.pixels++;
 }
 prev=cur;
}
for(const [index,b] of bboxes.entries()){
 assert.ok(b.pixels>75,"Subject image "+index+" must have readable ink");
 assert.ok(b.left>=8&&b.top>=8&&b.right<=87&&b.bottom<=87,
  "Subject image "+index+" must stay entirely within its square tile: "+JSON.stringify(b));
}
for(const [id,lo,hi] of [[4,72,95],[16,0,12],[16,84,95],[21,84,95]]){
 const b=bboxes[id];
 assert.ok(b.top>hi||b.bottom<lo,"Source stray dots remain in subject artwork "+id);
}
for(let y=60;y<=79;y++){
 assert.ok(foodPyramidRightEdge.has(y),
  "Food-chain pyramid right border is cropped at row "+y);
}
console.log("Subject illustration layout: 43 tiles centered and safely inset, no stray edge dots: OK");
