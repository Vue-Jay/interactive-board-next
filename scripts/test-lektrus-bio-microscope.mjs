import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const src=fs.readFileSync("src/lektrusBioMicroscopeModel.ts","utf8");
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
new Function("exports",js)(exports);
const {BIO_LEVELS,BIO_ORGANISMS,bioNodes,bioAncestors,newBioMicroscope,withBioOrganism,validBioMicroscope}=exports;
assert.deepEqual(BIO_LEVELS,["organism","system","organ","tissue","cell"]);
for(const id of Object.keys(BIO_ORGANISMS)){
 const nodes=bioNodes(id);
 assert.ok(nodes.length>=12,id+": too few biological structures");
 assert.equal(nodes[0].id,id);
 assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length,"Unique paths");
 for(const node of nodes){
  assert.ok(node.name&&node.description,id+": missing details for "+node.id);
  const a=bioAncestors(nodes,node.id);
  assert.equal(a.at(-1),node);
  assert.equal(a.length,BIO_LEVELS.indexOf(node.level)+1,"Every layer must have its own ancestor");
 }
 const doc=withBioOrganism(newBioMicroscope(),id);
 assert.ok(validBioMicroscope(doc),id+" should be saveable on a board");
 assert.equal(doc.assignmentPath.length,5);
 for(const activity of ["explore","label","assemble"])
  assert.ok(validBioMicroscope({...doc,activity}));
 assert.equal(validBioMicroscope({...doc,assignmentPath:[id]}),false,
  "Invalid answer chain cannot be persisted");
}
assert.ok(bioNodes("human").some(n=>n.name==="Кардиомиоцит"));
assert.ok(bioNodes("cat").some(n=>n.name==="Палочка"));
assert.ok(bioNodes("sunflower").some(n=>n.name==="Клетка ризодермы с корневым волоском"));
assert.ok(bioNodes("sunflower").some(n=>n.name==="Соцветие-корзинка"));
assert.ok(bioNodes("oak").some(n=>n.name==="Клетка ризодермы с корневым волоском"));
assert.ok(bioNodes("oak").some(n=>n.name==="Сосудистый элемент"));
const panel=fs.readFileSync("src/LektrusSubjectToolsPanel.tsx","utf8");
assert.match(panel,/"биология":\[\{title:"Биологический микроскоп",ids:\["bio-microscope"\]/);
const old=fs.readFileSync("src/lektrusSchoolDiagramModel.ts","utf8");
assert.match(old,/case "bio-microscope":return validBioMicroscope/);
assert.match(old,/case "bio-cell"/,"Legacy biology boards still validate");
const view=fs.readFileSync("src/LektrusSchoolDiagramView.tsx","utf8");
assert.match(view,/case "bio-microscope":return <LektrusBioMicroscope/);
// Spatial navigation must use valid children and clear, organism-specific
// illustration coordinates. Each level uses its real saved biological ID.
const {bioChildren,bioVisualKey,bioChildSpot}=exports;
for(const species of Object.keys(BIO_ORGANISMS)){
 const nodes=bioNodes(species);
 for(const parent of nodes){
  const children=bioChildren(nodes,parent.id);
  for(let i=0;i<children.length;i++){
   assert.equal(children[i].parentId,parent.id);
   const p=bioChildSpot(species,parent,children[i],i,children.length);
   assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=20&&p.x<=460&&p.y>=20&&p.y<=315,
    species+": off-image hotspot "+children[i].id);
  }
  if(children.length>1){
   const spots=children.map((child,i)=>bioChildSpot(species,parent,child,i,children.length));
   assert.equal(new Set(spots.map(p=>p.x+":"+p.y)).size,spots.length,
    parent.id+": two parts must not share a hotspot");
  }
 }
}
const human=bioNodes("human"),cat=bioNodes("cat"),sun=bioNodes("sunflower"),oak=bioNodes("oak");
const key=(nodes,name)=>bioVisualKey(nodes.find(n=>n.name===name));
assert.equal(key(human,"Сердце"),"heart");
assert.equal(key(human,"Лёгкие"),"lungs");
assert.equal(key(human,"Нейрон"),"brain");
assert.equal(key(cat,"Палочка"),"eye");
assert.equal(key(cat,"Энтероцит"),"gut");
assert.equal(key(sun,"Клетка ризодермы с корневым волоском"),"root");
assert.equal(key(sun,"Фотосинтезирующая клетка"),"leaf");
assert.equal(key(oak,"Сосудистый элемент"),"wood");
const scene=fs.readFileSync("src/LektrusBioAnatomyScene.tsx","utf8");
const viewSource=fs.readFileSync("src/LektrusBioMicroscope.tsx","utf8");
for(const [name,source] of [["bio scene",scene],["bio viewer",viewSource]]){
 const parsed=ts.createSourceFile(name+".tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,name+" must parse as TSX");
}
assert.match(scene,/data-bio-node=\{child\.id\}/,"Click targets map to real anatomy IDs");
assert.match(scene,/onKeyDown=\{e=>/,"Keyboard users can open structures");
assert.match(scene,/role="button" tabIndex=\{0\}/,"SVG targets are focusable");
for(const marker of ['keyName==="eye"','keyName==="lungs"','keyName==="heart"',
 'keyName==="gut"','keyName==="wood"']){
 assert.ok(scene.includes(marker),"Missing specialized cell illustration: "+marker);
}
assert.match(viewSource,/const lower=Math\.floor\(zoom\),upper=Math\.min\(4,lower\+1\),blend=zoom-lower/,
 "Fractional zoom must blend consecutive anatomical levels");
assert.match(viewSource,/onSelect=\{diagram\.activity==="label"\?check:next\}/,
 "Label exercises must ask the pupil to select parts on the image");
const styles=fs.readFileSync("src/lektrusBioMicroscope.css","utf8");
assert.match(styles,/\.lektrus-bio-hotspot:focus-visible/,"Visible keyboard focus");
assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/,
 "Animation must respect reduced motion");

const {bioTaskChoices,bioLevelName,BIO_REFERENCES}=exports;
for(const species of Object.keys(BIO_ORGANISMS)){
 const nodes=bioNodes(species);
 for(const node of nodes){
  if(node.level==="organism")continue;
  const choices=bioTaskChoices(nodes,node);
  assert.ok(choices.some(c=>c.id===node.id),"Correct answer missing: "+node.id);
  assert.equal(new Set(choices.map(c=>c.id)).size,choices.length,"Duplicated quiz option: "+node.id);
  assert.ok(choices.every(c=>c.level===node.level),"Quiz options must share an organizational level");
  if(nodes.filter(n=>n.level===node.level).length>1)
   assert.ok(choices.length>1,"Single-choice exercise is not a real exercise: "+node.id);
  assert.ok(choices.length<=4,"Avoid endless answers on mobile");
  if(node.source){
   assert.ok(/^https:\/\/(openstax.org|www.ncbi.nlm.nih.gov|www.helsinki.fi|www.bgs.ac.uk)\//.test(node.source.url),
    "Only reviewed education / scientific sources");
   assert.ok(node.source.title);
  }
 }
}
const sunflowerNodes=bioNodes("sunflower"),oakNodes=bioNodes("oak"),humanNodes=bioNodes("human");
const preserved=(nodes,suffix)=>nodes.find(n=>n.id.endsWith("/"+suffix));
const rootHair=preserved(sunflowerNodes,"корневой-волосок");
assert.ok(rootHair?.description.includes("вырост одной клетки"));
assert.equal(rootHair?.source?.url,BIO_REFERENCES.roots.url);
const sunflowerHead=preserved(sunflowerNodes,"цветок");
assert.equal(sunflowerHead?.name,"Соцветие-корзинка");
assert.equal(bioLevelName(sunflowerHead),"Соцветие");
assert.ok(sunflowerHead?.description.includes("не один цветок"));
assert.equal(sunflowerHead?.source?.url,BIO_REFERENCES.sunflower.url);
assert.equal(preserved(sunflowerNodes,"клетка-эпидермиса")?.source?.url,BIO_REFERENCES.sunflower.url);
const xylem=preserved(oakNodes,"сосудистый-элемент");
assert.ok(xylem?.description.includes("не имеет ядра"));
assert.equal(xylem?.source?.url,BIO_REFERENCES.stem.url);
assert.equal(preserved(humanNodes,"пневмоцит-i-типа")?.source?.url,BIO_REFERENCES.alveoli.url);
assert.equal(preserved(sunflowerNodes,"корневой-волосок")?.id,
 "sunflower/корневая-система/корень/ризодерма/корневой-волосок",
 "Existing saved IDs must remain valid and stable");
assert.ok(bioTaskChoices(oakNodes,preserved(oakNodes,"клетка-мезофилла"))
 .some(n=>n.id===preserved(oakNodes,"клетка-мезофилла")?.id),
 "Farther branches must always keep the correct choice");
const biologyView=fs.readFileSync("src/LektrusBioMicroscope.tsx","utf8");
assert.match(biologyView,/const hotspotQuestion=diagram\.activity==="label"/,
 "Only multi-child diagram levels should rely on hotspots");
assert.match(biologyView,/!hotspotQuestion&&<div className="lektrus-bio-task-answers">/,
 "Single-child labeling levels must retain meaningful answer alternatives");
assert.match(biologyView,/diagram\.activity==="assemble"\?\s*<LektrusBioAssemblyBoard/,
 "Assembly must use the new graphical task rather than the old choice-only sequence");
assert.match(biologyView,/Источник: \{selected\.source\.title\}/,
 "Scientific sources must be accessible from the actual structure");
assert.match(biologyView,/без реального оптического масштаба/,
 "A smooth level transition is not falsely called optical magnification");

console.log("Biology anatomy: clickable landmarks, distinct tissue paths, animated zoom, on-image labeling OK");

console.log("Biology microscope: animal/plant hierarchies, 5 layers, tasks, saved legacy compatibility OK");
