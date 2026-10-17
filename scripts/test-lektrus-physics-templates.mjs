import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const stripImports=src=>src.replace(/^import .*?;\s*$/gm,"")
 .replace(/\bexport\s+(?=(?:type|interface|const|let|function|class)\b)/g,"");
const compile=src=>ts.transpileModule(stripImports(src),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}
}).outputText;
const preset=compile(read("src/lektrusSciencePresets.ts"));
const catalog=compile(read("src/lektrusScienceCatalog.ts"));
const layout=compile(read("src/lektrusScienceLabelLayout.ts"));
const moduleCode="const makeMathPresetItem=(_name,x,y,id)=>({id,kind:'graph',x,y,width:500,height:360,text:''});\n"+
 preset+"\n"+catalog+"\n"+layout+
 "\nreturn {makeSciencePresetItem,scienceToolGroups,layoutScienceLabels};";
const {makeSciencePresetItem,scienceToolGroups,layoutScienceLabels}=new Function(moduleCode)();
const groupNames=["physics-mechanics","physics-graphs","physics-optics"];
const allIds=new Set();
let total=0;
for(const group of scienceToolGroups.filter(x=>groupNames.includes(x.id))){
 assert.ok(group.templates.length>=5,group.id+" needs a useful school-program selection");
 for(const template of group.templates){
  assert.ok(!allIds.has(template.id),"duplicate preset: "+template.id);
  allIds.add(template.id);total++;
  const item=makeSciencePresetItem(template.id,0,0,()=>template.id);
  const points=item.graphPoints??[],segments=item.graphSegments??[];
  assert.ok(points.length>0&&points.length<=40,template.id+" point count");
  assert.ok(segments.length<=64,template.id+" line count");
  assert.ok(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&
    p.x>=-7&&p.x<=12&&p.y>=-5&&p.y<=10),template.id+" out-of-bounds point");
  assert.ok(segments.every(s=>Number.isInteger(s.a)&&Number.isInteger(s.b)&&
    s.a>=0&&s.b>=0&&s.a<points.length&&s.b<points.length&&s.a!==s.b),
    template.id+" invalid segment");
  const motion=group.id==="physics-graphs";
  const project=p=>motion?{x:56+p.x/12*440,y:330-p.y/10*290}:
    {x:260+p.x*31,y:185-p.y*31};
  const labels=layoutScienceLabels(points,segments,project,520,370);
  assert.equal(labels.points.length,points.length);
  assert.equal(labels.lines.length,segments.length);
  assert.ok([...labels.points,...labels.lines].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),
    template.id+" non-finite caption position");
  const captions=[
    ...points.map((p,i)=>({label:p.label,pos:labels.points[i]})),
    ...segments.map((s,i)=>({label:s.label,pos:labels.lines[i]}))
  ].filter(c=>Boolean(c.label));
  const box=c=>{
    const w=Math.min(195,Math.max(19,Array.from(c.label).length*6.3+11));
    return {left:c.pos.x-w/2,right:c.pos.x+w/2,top:c.pos.y-14,bottom:c.pos.y+5};
  };
  for(const caption of captions){
    const b=box(caption);
    assert.ok(b.left>=-10&&b.right<=530&&b.top>=10&&b.bottom<=380,
      template.id+" label outside canvas: "+caption.label);
  }
 }
}
assert.equal(total,19,"school template coverage: 6 mechanics, 6 motion, 7 optics");

// Physical directions and incidence laws: do not regress school diagrams.
const build=id=>makeSciencePresetItem(id,0,0,()=>id);
const vector=(doc,n)=>{
 const seg=doc.graphSegments[n],a=doc.graphPoints[seg.a],b=doc.graphPoints[seg.b];
 return {dx:b.x-a.x,dy:b.y-a.y};
};
const approximate=(a,b,tolerance=.04)=>Math.abs(a-b)<=tolerance;
{
 const d=build("physics-forces"),up=vector(d,0),weight=vector(d,1),
   applied=vector(d,2),friction=vector(d,3);
 assert.ok(up.dy>0&&Math.abs(up.dx)<.01,"normal points upward");
 assert.ok(weight.dy<0&&Math.abs(weight.dx)<.01,"weight points downward");
 assert.ok(applied.dx>0&&Math.abs(applied.dy)<.01,"applied force points right");
 assert.ok(friction.dx<0&&Math.abs(friction.dy)<.01,"friction opposes motion");
}
{
 const d=build("physics-friction"),applied=vector(d,3),friction=vector(d,4);
 assert.ok(approximate(applied.dy,0)&&applied.dx>0,"horizontal pull must remain horizontal");
 assert.ok(approximate(friction.dy,0)&&friction.dx<0,"sliding friction must oppose pull");
}
{
 const d=build("physics-incline"),normal=vector(d,3),gravity=vector(d,4),pull=vector(d,5);
 const incline=vector(d,2); // diagonal side goes from top to bottom; normalized sign irrelevant.
 assert.ok(normal.dx<0&&normal.dy>0,"normal must point outside incline");
 assert.ok(gravity.dy<0&&approximate(gravity.dx,0),"gravity vertical down");
 assert.ok(pull.dx>0&&pull.dy>0,"pull up the slope");
 assert.ok(Math.abs(incline.dx*normal.dx+incline.dy*normal.dy)<5,
   "normal approximately perpendicular to inclined plane");
}
{
 const d=build("physics-lever");
 assert.ok(approximate(vector(d,1).dx,0)&&vector(d,1).dy<0,
   "left lever force must be vertical");
 assert.ok(approximate(vector(d,2).dx,0)&&vector(d,2).dy<0,
   "right lever force must be vertical");
}
{
 const d=build("physics-optics"),incident=vector(d,0),reflection=vector(d,1);
 assert.ok(incident.dy<0&&reflection.dy>0,"ray must approach and then leave mirror");
 assert.ok(approximate(Math.abs(incident.dx/incident.dy),Math.abs(reflection.dx/reflection.dy)),
   "angle of incidence must equal reflection");
}
{
 const d=build("physics-refraction"),incident=vector(d,0),refracted=vector(d,1);
 assert.ok(incident.dy<0&&refracted.dy<0,"light passes from upper to lower medium");
 assert.ok(incident.dx>0&&refracted.dx>0,"ray direction remains forward");
}
{
 const d=build("physics-total-reflection");
 assert.ok(vector(d,2).dy>0&&vector(d,3).dy<0,"total reflection stays in incident medium");
}
{
 const d=build("physics-diverging-lens");
 const focus=d.graphPoints[4],through=d.graphPoints[7],out=d.graphPoints[8];
 const a=(through.y-focus.y)/(through.x-focus.x),b=(out.y-through.y)/(out.x-through.x);
 assert.ok(approximate(a,b,.04),"diverging lens outgoing ray backward extension passes through near focus");
}
{
 const d=build("physics-braking"),p=d.graphPoints;
 const changes=p.slice(1).map((pt,i)=>(pt.y-p[i].y)/(pt.x-p[i].x));
 assert.ok(changes.every(v=>approximate(v,changes[0])),"uniform braking should be linear");
}

const editor=read("src/LektrusScienceEditor.tsx");
const app=read("src/App.tsx");
assert.match(editor,/layoutScienceLabels\(points,segments,canvasPoint,520,370\)/);
assert.match(app,/layoutScienceLabels\(item\.graphPoints/);
const circuit=read("src/LektrusCircuitEditor.tsx");
assert.doesNotMatch(circuit,/window\.confirm\(/);
assert.match(circuit,/role="alertdialog"/);
console.log("School physics: "+total+" templates, valid topology, caption placement and in-app confirmations.");
