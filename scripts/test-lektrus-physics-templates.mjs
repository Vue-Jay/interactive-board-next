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
const editor=read("src/LektrusScienceEditor.tsx");
const app=read("src/App.tsx");
assert.match(editor,/layoutScienceLabels\(points,segments,canvasPoint,520,370\)/);
assert.match(app,/layoutScienceLabels\(item\.graphPoints/);
const circuit=read("src/LektrusCircuitEditor.tsx");
assert.doesNotMatch(circuit,/window\.confirm\(/);
assert.match(circuit,/role="alertdialog"/);
console.log("School physics: "+total+" templates, valid topology, caption placement and in-app confirmations.");
