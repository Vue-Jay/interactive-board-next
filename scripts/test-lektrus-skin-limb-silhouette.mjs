import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
function load(path,mocks={}){
 const js=ts.transpileModule(fs.readFileSync(path,"utf8"),{
  fileName:path,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const exports={};
 new Function("exports","require",js)(exports,id=>{
  assert.ok(id in mocks,"Missing dependency "+id);
  return mocks[id];
 });
 return exports;
}
const evidence=load("src/lektrusSkinEvidenceModel.ts");
const edges=load("src/lektrusSkinEdgeSections.ts",{
 "./lektrusSkinEvidenceModel":evidence
});
const vector=load("src/lektrusSkinVectorSections.ts",{
 "./lektrusSkinEdgeSections":edges,
 "./lektrusSkinEvidenceModel":evidence
});
const viewport=fs.readFileSync("src/LektrusSkinSemanticViewport.tsx","utf8");

// Reproduce a palm splitting into two disjoint fingers beside a wider
// forearm. The old nearest-X-only matcher teleported across separated
// runs and drew pink bands inside interdigital gaps.
const width=180,height=112,factor=3;
const alpha=new Uint8ClampedArray(width*height);
function paint(y,x0,x1){
 for(let x=x0;x<=x1;x++)alpha[y*width+x]=255;
}
for(let y=0;y<=100;y++){
 if(y<=41)paint(y,20,53);
 else{paint(y,20,32);paint(y,40,53);}
 paint(y,115,148);
 // Two fake transparent-alpha islands should never become skin organs.
 if(y>=55&&y<=60)paint(y,75,79);
 if(y>=55&&y<=61)paint(y,85,92);
}
const contours=vector.skinSectionContours(alpha,width,height,factor);
assert.ok(contours.every(c=>c.points.length>=18),
 "Ignore very short false tracks at finger tips and antialias artefacts");
const sampleY=23;
const stripes=contours.filter(c=>c.minY<=sampleY&&c.maxY>=sampleY)
 .map(c=>({c,p:c.points.find(p=>Math.abs(p.y-sampleY)<.01)}))
 .filter(x=>!!x.p).sort((a,b)=>a.p.x-b.p.x);
assert.equal(stripes.length,6,
 "Two separate fingers and a forearm must expose exactly six flanks");
assert.ok(stripes[1].p.x<stripes[2].p.x,
 "Fingers must remain independent, never bridged by smooth alpha tracks");
assert.ok(stripes[3].p.x<stripes[4].p.x,
 "Do not confuse finger tissue with a neighbouring forearm");
assert.ok(stripes.every(({p})=>p.depth>=0&&p.depth<=vector.SKIN_SECTION_WORLD_DEPTH));
assert.ok(stripes.every(({p})=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
// An intentionally magnified tissue strip cannot substitute for intact
// fingers or toes. Narrow runs have zero side-section depth, wide runs
// preserve the same deep-zoom anatomy without sharp seams.
assert.equal(vector.skinCutawayDepthForSpan(4.4),0,
 "Thin finger must have no false colored lateral bands at any zoom");
assert.equal(vector.skinCutawayDepthForSpan(7),0);
assert.ok(vector.skinCutawayDepthForSpan(12)>0);
assert.equal(vector.skinCutawayDepthForSpan(17),Math.min(
 vector.SKIN_SECTION_WORLD_DEPTH,17*(1-vector.SKIN_SECTION_NEUTRAL_FRACTION)/2));
for(let span=0,last=0;span<=32;span+=.025){
 const d=vector.skinCutawayDepthForSpan(span);
 assert.ok(d>=last-1e-8&&d<=vector.SKIN_SECTION_WORLD_DEPTH,
  "No jumps or reappearing stripes along the finger-palm transition");
 last=d;
}
const digit=contours.filter(c=>c.minY<=18&&c.maxY>=18)
 .map(c=>c.points.find(p=>Math.abs(p.y-18)<.01))
 .filter(Boolean);
assert.ok(digit.length>0&&digit.every(p=>p.depth<=vector.SKIN_SECTION_WORLD_DEPTH),
 "Synthetic forearm plate keeps its registered contour geometry");
assert.ok(!stripes.some(({p})=>p.x>24&&p.x<29),
 "No invented centreline skin from the transparent finger gap");

// The educational three-layer cutaway is *not* appropriate over a hand
// or leg at 733%: teachers should still see an intact original organism.
assert.equal(vector.skinCutawayBlend(7.33),0);
assert.equal(vector.skinCutawayBlend(10),0);
assert.equal(vector.skinCutawayBlend(26),1);
assert.equal(vector.skinCutawayBlend(70),1);
assert.ok(vector.skinCutawayBlend(16)>0&&vector.skinCutawayBlend(16)<1);
for(let z=1,last=0;z<=80;z+=.25){
 const a=vector.skinCutawayBlend(z);
 assert.ok(a>=last&&a<=1);
 assert.ok(a-last<.05,"No hard transition during hand pinch zoom");
 last=a;
}
assert.match(viewport,/const cutawayAlpha=skinCutawayBlend\(cam\.scale\)/);
assert.match(viewport,/ctx\.drawImage\(body,0,0,WORLD_WIDTH,WORLD_HEIGHT\)/);
assert.match(viewport,/ctx\.drawImage\(neutralPlate,0,0,WORLD_WIDTH,WORLD_HEIGHT\)/,
 "A complete neutral silhouette must remain below every side cutaway");
assert.match(viewport,/neutralPlate=source/,
 "Neutral alpha plate must be built from the SAME source geometry");
assert.doesNotMatch(viewport,/globalAlpha=1-cutawayAlpha/,
 "At tissue zoom never fade the body and digits all the way to zero");
assert.match(viewport,/contours\.length&&cutawayAlpha>0/);
assert.match(viewport,/drawSkinSectionBands\(ctx,contours,visible,cutawayAlpha\)/);
assert.doesNotMatch(viewport,/globalCompositeOperation="source-atop"/,
 "Shading the alpha plate source-atop washed out the hand interior");

const fills=[];
const ctx=new Proxy({},{
 get:(state,name)=>{
  if(name==="fill")return ()=>fills.push(state.globalAlpha);
  if(name==="globalAlpha")return state.globalAlpha;
  return (...args)=>{
   for(const v of args)if(typeof v==="number")assert.ok(Number.isFinite(v));
  };
 },
 set:(state,name,val)=>{state[name]=val;return true;}
});
const bounds={minX:0,maxX:60,minY:10,maxY:27};
assert.equal(vector.drawSkinSectionBands(ctx,contours,bounds,0),0);
assert.equal(fills.length,0,"At 733% only the original hand plate is drawn");
const count=vector.drawSkinSectionBands(ctx,contours,bounds,.5);
assert.equal(count,6);
assert.equal(fills.length,18);
assert.ok(fills.every(a=>a>.45&&a<.51),
 "Skin bands fade in instead of hiding hands with opaque pink ribbons");
assert.equal(ctx.globalAlpha,1);
assert.ok(vector.clipSkinSection(ctx,contours,bounds)>=6);
console.log("Anatomy limb silhouettes PASS: distinct fingers and forearm, no tiny phantom tracks, 733% intact and 1000–2600% smooth cutaway reveal.");
