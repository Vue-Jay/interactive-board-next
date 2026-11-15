import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=(file)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
// Resolve local TS imports explicitly: data: module URLs cannot resolve ./ paths.
const tsCache=new Map();
async function loadTs(file){
  if(tsCache.has(file))return tsCache.get(file);
  const javascript=ts.transpileModule(read(file),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  const exports={};
  const dirname=file.slice(0,file.lastIndexOf("/")+1);
  const require=(specifier)=>{
    const local=dirname+specifier.replace(/^\.\//,"");
    if(!specifier.startsWith("./"))throw Error("Unexpected module "+specifier);
    if(tsCache.has(local+".ts"))return tsCache.get(local+".ts");
    throw Error("Load dependency first: "+local);
  };
  new Function("exports","require",javascript)(exports,require);
  tsCache.set(file,exports);
  return exports;
}
await loadTs("src/lektrusGeometryPointNames.ts");

const {mathPresets,makeMathPresetItem}=await loadTs("src/lektrusMathPresets.ts");
const {isSolidFigure,solidWorldPoints,projectSolid,projectSolidSurfaces,projectSolidEdges}=await loadTs("src/lektrusSolid3d.ts");
const {geometryLabelLayout}=await loadTs("src/lektrusGeometryLabelLayout.ts");
const {compileGraphExpression}=await loadTs("src/lektrusGraphExpression.ts");
const {fractionHitPart}=await loadTs("src/lektrusFractionHit.ts");
const app=read("src/BoardApp.tsx");
const editor=read("src/LektrusGraphEditor.tsx");

// Educational correctness: standard notation, precedence and strict syntax.
for(const [expression,x,expected] of [
 ["-x^2",3,-9],["(-x)^2",3,9],["2^-3",0,.125],["2^3^2",0,512],
 ["2x+1",3,7],["y = 2x + 1",-2,-3],["2(x+1)",3,8],
 ["(x+1)(x-1)",3,8],["2sin(x)",Math.PI/2,2],["−x^2",3,-9],
 ["sqrt(x)",9,3],[".5x+1,5",3,3],["2*pi",0,2*Math.PI]
]) assert.ok(Math.abs(compileGraphExpression(expression)(x)-expected)<1e-10,expression);
for(const expression of ["sin(","x+","1..2","x@+1","sinx","unknown(x)","2 3","", "x;"])
 assert.equal(compileGraphExpression(expression),null,expression+" must be rejected");
assert.ok(!Number.isFinite(compileGraphExpression("1/x")(0)));
assert.ok(Number.isNaN(compileGraphExpression("sqrt(x)")(-1)),"domain error is not a syntax error");
assert.match(app,/clipPath=\{`url\(#\$\{curveClipId\}\)`\}/,"curve must be clipped to the plot");
assert.match(editor,/disabled=\{expressionInvalid\}/,"invalid graph cannot be saved");
assert.match(editor,/if\(compileGraphExpression\(expression\)\)patch\(\{expression\}\)/,"unfinished expression must not be published");

// Fractions: invert the actual SVG 'meet' transform for tall, wide and exact layouts.
for(const rect of [{left:12,top:34,width:344,height:351},{left:5,top:20,width:720,height:220},{left:0,top:0,width:360,height:250}]){
 const scale=Math.min(rect.width/360,rect.height/250);
 const client=(x,y)=>[rect.left+(rect.width-360*scale)/2+x*scale,rect.top+(rect.height-250*scale)/2+y*scale];
 const hit=(mode,x,y)=>fractionHitPart(mode,12,...client(x,y),rect);
 for(let i=0;i<12;i++){
  const angle=-Math.PI/2+(i+.5)*Math.PI/6;
  assert.equal(hit("circle",180+85*Math.cos(angle),125+85*Math.sin(angle)),i);
  assert.equal(hit("bar",22+(i+.5)*316/12,126),i);
 }
 assert.equal(hit("bar",280,20),null,"click above strip must not change numerator");
 assert.equal(hit("bar",5,126),null,"click left of strip must not change numerator");
 assert.equal(hit("circle",180,10),null,"click outside circle must not change numerator");
 assert.equal(hit("circle",180+78*Math.sin(.47),125-78*Math.cos(.47)),0,"angle just below sector boundary");
}

// A label's entire estimated text box must sit clear of edges, faces and other labels.
for(const preset of mathPresets){
 const item=makeMathPresetItem(preset.id,0,0,preset.id);
 if(item.graphPurpose!=="geometry")continue;
 const solid=isSolidFigure(preset.id);
 for(const [rx,ry] of solid?[[25,-35],[30,70],[-40,155],[0,0]]:[[25,-35]]){
  const xMin=item.graphXMin??-10,xMax=item.graphXMax??10,yMin=item.graphYMin??-10,yMax=item.graphYMax??10;
  const scale=Math.min(600/(xMax-xMin),360/(yMax-yMin));
  const screen=p=>({x:300+(p.x-(xMin+xMax)/2)*scale,y:180-(p.y-(yMin+yMax)/2)*scale});
  const raw=solid?projectSolid(item,rx,ry):item.graphPoints??[];
  const points=raw.map(p=>({...screen(p),label:p.label}));
  const polygons=solid?projectSolidSurfaces(item,rx,ry).map(f=>f.points.map(screen)):
   (item.graphPolygons??[]).map(p=>p.points.map(i=>screen(raw[i])));
  const edges=solid?projectSolidEdges(item,rx,ry).map(e=>[screen(e.start),screen(e.end)]):
   (item.graphSegments??[]).map(e=>[screen(raw[e.a]),screen(raw[e.b])]);
  const labels=geometryLabelLayout(points,polygons,edges,600,360,[{left:510,right:590,top:7,bottom:solid?137:40}]);
  for(let i=0;i<labels.length;i++){
   const l=labels[i];if(!l)continue;
   assert.ok(l.x>=7&&l.x<=593&&l.y>=10&&l.y<=350,preset.id+" label inside view");
   assert.ok(Math.hypot(l.x-points[i].x,l.y-points[i].y)>=17,preset.id+" label clear of vertex");
   for(let j=0;j<i;j++)if(labels[j])assert.ok(Math.abs(l.x-labels[j].x)>=14||Math.abs(l.y-labels[j].y)>=20,preset.id+" labels do not overlap");
  }
 }
}
assert.match(app,/lektrus-orbit-control" transform="translate\(0 48\)"/);

assert.equal(mathPresets.some(p=>p.id==="triangle-obtuse"),false,"no obtuse triangle button");
assert.equal(mathPresets.some(p=>p.id==="parallel"),true);
assert.equal(mathPresets.some(p=>p.id==="ray"),true);

const ray=makeMathPresetItem("ray",0,0,"test");
assert.equal(ray.graphSegments?.[0]?.kind,"ray");
assert.equal(ray.graphSnap,false,"direction is not snapped to integer degrees");
assert.equal(ray.graphPoints?.[0]?.label,"A");
assert.match(app,/if\(rayFigure&&i!==0\)return null/,"only one ray origin must be visible");
assert.match(app,/onRayChange=/,"line direction drag must be editable on board");
assert.match(editor,/Направление луча/);

const parallel=makeMathPresetItem("parallel",0,0,"parallel");
assert.equal(parallel.graphSegments?.length,2);
for(const kind of ["corresponding","alternate-interior","alternate-exterior","same-side-interior","vertical","adjacent"]){
  assert.ok(app.includes(kind),kind+" angle pair must render");
  assert.ok(editor.includes(kind),kind+" must be selectable");
}
assert.match(editor,/Добавить секущую/);
assert.match(editor,/Перпендикуляр между прямыми/);
assert.match(editor,/Биссектриса угла при секущей/);

for(const id of ["cube","rectangular-prism","prism","pyramid","triangular-pyramid","cylinder","cone"]){
  const figure=makeMathPresetItem(id,0,0,id);
  assert.ok(isSolidFigure(id));
  const before=projectSolid(figure,25,-35),after=projectSolid(figure,30,70);
  assert.equal(before.length,solidWorldPoints(figure).length,id+" point count");
  assert.ok(before.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),id+" finite view");
  assert.ok(after.some((p,i)=>Math.abs(p.x-before[i].x)>0.01||Math.abs(p.y-before[i].y)>0.01),id+" rotates");
  const measured={...figure,graphGivenSides:["8","5","6"]};
  assert.ok(projectSolid(measured,40,-10).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),id+" measured projection");
}
assert.match(app,/className="lektrus-orbit-control"/);
assert.match(app,/onRotate=/);
assert.match(app,/projectSolidAxis/,"sphere meridians must follow orientation");

const {removeConstruction}=await loadTs("src/lektrusConstructionCleanup.ts");
const point=(x,y,label="")=>({x,y,label});
const seed={
  points:[point(0,0,"A"),point(1,0,"B"),point(0,1,"C"),point(5,5,"D")],
  segments:[],circles:[],polygons:[{points:[0,1,2],label:"",measure:true}],
  angles:[],midpoints:[]
};
const first=removeConstruction(seed,"polygon",0);
assert.deepEqual(first.points,[seed.points[3]],"polygon deletion discards its 3 vertices, retaining independent free points");
assert.deepEqual(first.polygons,[]);
const shared={
  ...seed,
  segments:[{a:2,b:3,kind:"segment",label:"",measure:false}]
};
const sharedNext=removeConstruction(shared,"polygon",0);
assert.deepEqual(sharedNext.points,[seed.points[2],seed.points[3]],"shared endpoint survives polygon deletion");
assert.deepEqual(sharedNext.segments.map(s=>[s.a,s.b]),[[0,1]],"segment links are reindexed after deleting orphan vertices");
const angleShape={
  points:[point(2,0,"A"),point(0,0,"O"),point(0,2,"B")],
  segments:[
    {a:1,b:0,kind:"ray",label:"",measure:false},
    {a:1,b:2,kind:"ray",label:"",measure:false}
  ],circles:[],polygons:[],angles:[{a:0,vertex:1,b:2,label:"45°"}],midpoints:[]
};
const angleNext=removeConstruction(angleShape,"angle",0);
assert.equal(angleNext.angles.length,0);
assert.equal(angleNext.segments.length,0,"angle removal also removes dependent rays");
assert.equal(angleNext.points.length,0,"angle and ray support vertices are removed");
const fullCircle={
  points:[point(1,1,"O"),point(4,1,"R")],segments:[],
  circles:[{center:0,edge:1,label:"",measure:false}],polygons:[],angles:[],midpoints:[]
};
assert.equal(removeConstruction(fullCircle,"circle",0).points.length,0,"deleted circle takes center and radius point");
const rightRectangle={
  points:[point(0,0,"A"),point(4,0,"B"),point(4,3,"C"),point(0,3,"D")],
  polygons:[{points:[0,1,2,3],label:"ABCD",measure:true}],
  angles:[{a:3,vertex:0,b:1,label:"90°"}],
  segments:[],circles:[],midpoints:[]
};
const withoutRectangle=removeConstruction(rightRectangle,"polygon",0);
assert.equal(withoutRectangle.points.length,0,"right-angle vertex annotations must be removed with their rectangle");
assert.equal(withoutRectangle.angles.length,0,"right-angle mark belongs to deleted rectangle");
const circleWithRadius={...fullCircle,segments:[{a:0,b:1,kind:"segment",label:"r",measure:false}]};
const withoutCircle=removeConstruction(circleWithRadius,"circle",0);
assert.equal(withoutCircle.segments.length,0,"radius line belongs to deleted circle");
assert.equal(withoutCircle.points.length,0,"circle deletion must not leave radius endpoints");
for(const id of ["cube","rectangular-prism","prism","pyramid","triangular-pyramid","cylinder","cone"]){
  const item=makeMathPresetItem(id,0,0,"mesh-"+id);
  for(const [x,y] of [[25,-35],[0,0],[45,65],[-75,170]]){
    const faces=projectSolidSurfaces(item,x,y);
    assert.ok(faces.length>3,id+" must have filled faces");
    assert.ok(faces.every(f=>f.points.length>=3&&f.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))),id+" finite mesh");
    assert.ok(faces.every(f=>Number.isFinite(f.depth)&&f.fill.length>0),id+" shaded depth");
    assert.ok(faces.every((f,i)=>i===0||faces[i-1].depth>=f.depth),id+" painter depth order");
    if(id==="cone"||id==="cylinder")assert.ok(faces.length>=60,id+" smooth curve");
  }
}
assert.equal(projectSolidSurfaces(makeMathPresetItem("sphere",0,0,"sphere"),25,30).length,0,"sphere keeps its existing good rendering");
assert.match(editor,/lektrus-school-element-row/,"compact dimension rows");
assert.doesNotMatch(editor,/pointOptions\(/,"no coordinate chooser in element cards");


// Semi-transparent shaded solids must expose both visible and hidden outlines.
for(const id of ["cube","rectangular-prism","prism","pyramid","triangular-pyramid","cylinder","cone"]){
  const item=makeMathPresetItem(id,0,0,"translucent-"+id);
  const edgeList=projectSolidEdges(item,25,-35);
  assert.ok(edgeList.some(edge=>edge.hidden),id+" has visible back edges");
  assert.ok(edgeList.some(edge=>!edge.hidden),id+" has visible front edges");
  assert.ok(edgeList.every(edge=>[edge.start.x,edge.start.y,edge.end.x,edge.end.y].every(Number.isFinite)),id+" stable projected outlines");
  if(id==="cylinder")assert.ok(edgeList.length>120,"cylinder has smooth base rings");
  if(id==="cone")assert.ok(edgeList.length>=64,"cone has smooth base ring");
}
assert.match(app,/className="lektrus-solid-translucent-fill"/,"all non-spherical solids render translucent faces");
assert.match(app,/fillOpacity=\{item\.graphFigureId/,"solid opacity is explicitly controlled");
assert.match(app,/className="lektrus-solid-hidden-edges"/,"hidden edges must be drawn separately");
assert.match(app,/strokeDasharray="5 5"/,"hidden edges must be dashed");
assert.match(app,/className="lektrus-solid-front-edges"/,"front contours stay solid");


const {solidStructuralEdgePairs,isStructuralSolidSegment,solidDimensionEdgePairs}=await loadTs("src/lektrusSolid3d.ts");
for(const id of ["cube","rectangular-prism","prism","pyramid","triangular-pyramid"]){
  const model=makeMathPresetItem(id,0,0,"dimensions-"+id);
  const structural=solidStructuralEdgePairs(id);
  assert.ok(structural.length>=6,id+" structural school edges");
  assert.ok(model.graphSegments.every(edge=>isStructuralSolidSegment(id,edge)),id+" shape segments belong in Sizes");
  assert.ok(solidDimensionEdgePairs(id).every(([a,b])=>structural.some(([x,y])=>
    x===a&&y===b||x===b&&y===a)),id+" dimensions match real solid edges");
  const edge=projectSolidEdges(model,40,-20).find(e=>e.a!==undefined&&e.b!==undefined);
  assert.ok(edge,id+" projected edge carries original endpoint identities");
  assert.ok(model.graphSegments.some(segment=>segment.a===edge.a&&segment.b===edge.b||
    segment.a===edge.b&&segment.b===edge.a),id+" edge annotations can be matched after rotation");
}
for(const id of ["cone","cylinder"]){
  const model=makeMathPresetItem(id,0,0,"round-edges-"+id);
  assert.ok(model.graphSegments.every(edge=>isStructuralSolidSegment(id,edge)),id+" technical ring segments remain out of Elements");
}
assert.match(editor,/className="lektrus-geometry-givens lektrus-solid-edge-dimensions"/,"solid dimensions are in Sizes");
assert.match(editor,/if\(isSolid&&isStructuralSolidSegment\(draft.figureId,segment\)\)return null/,"core solid edges are excluded from extra Elements");
assert.match(editor,/extraElementCount/,"Element count excludes structural solid edges");
assert.match(editor,/if\(draft.figureId==="sphere"&&i===0\)return null/,"sphere base circle stays out of Elements");
assert.match(app,/className="lektrus-solid-edge-labels"/,"solid edge labels shown in preview and board");
assert.match(app,/solidDimensionEdgePairs\(item.graphFigureId\)/,"main dimensions appear along corresponding solid edges");


const {buildSchoolConstruction,polygonCircle}=await loadTs("src/lektrusSchoolConstructions.ts");
const toDraft=id=>{
  const item=makeMathPresetItem(id,0,0,"school-"+id);
  return {figureId:id,points:item.graphPoints??[],segments:item.graphSegments??[],
    circles:item.graphCircles??[],polygons:item.graphPolygons??[],
    angles:item.graphAngles??[],midpoints:item.graphMidpoints??[]};
};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const perpendicularDistance=(p,a,b)=>{
  const vx=b.x-a.x,vy=b.y-a.y;
  return Math.abs(vx*(a.y-p.y)-(a.x-p.x)*vy)/Math.hypot(vx,vy);
};
for(const figure of ["triangle","triangle-right","square","triangle-equilateral","pentagon","hexagon","octagon"]){
  for(const kind of ["incircle","circumcircle"]){
    const draft=toDraft(figure);
    const result=buildSchoolConstruction(draft,{kind});
    assert.equal(result.error,undefined,figure+" "+kind+" is geometrically valid");
    const newest=result.draft.circles.at(-1),c=result.draft.points[newest.center];
    const pointOnCircle=result.draft.points[newest.edge];
    const radius=distance(c,pointOnCircle);
    const vertices=draft.polygons[0].points.map(i=>draft.points[i]);
    const measured=kind==="circumcircle"?
      vertices.map(point=>distance(c,point)):
      vertices.map((p,i)=>perpendicularDistance(c,p,vertices[(i+1)%vertices.length]));
    assert.ok(measured.every(v=>Math.abs(v-radius)<.02),figure+" "+kind+" must touch every vertex/edge");
    assert.equal(draft.circles.length,0,"construction must be immutable");
  }
}
for(const kind of ["incircle","circumcircle"]){
  const draft=toDraft("parallelogram");
  const result=buildSchoolConstruction(draft,{kind});
  assert.equal(typeof result.error,"string","non-cyclic, non-tangential parallelogram cannot have "+kind);
  assert.equal(result.draft,draft,"impossible school construction does not mutate the editor");
}
const rectCirc=buildSchoolConstruction(toDraft("rectangle"),{kind:"circumcircle"});
assert.equal(rectCirc.error,undefined,"every rectangle admits a circumcircle");
const rectInc=buildSchoolConstruction(toDraft("rectangle"),{kind:"incircle"});
assert.equal(typeof rectInc.error,"string","a non-square rectangle has no incircle tangent to all four sides");
const rhombusInc=buildSchoolConstruction(toDraft("rhombus"),{kind:"incircle"});
assert.equal(rhombusInc.error,undefined,"every nondegenerate rhombus admits an incircle");
const cyclic=buildSchoolConstruction(toDraft("trapezoid-isosceles"),{kind:"circumcircle"});
assert.equal(cyclic.error,undefined,"isosceles trapezoid admits circumcircle");
for(const n of [3,4,5,6,8]){
  for(const kind of ["inscribed-polygon","circumscribed-polygon"]){
    const d=toDraft("circle"),r=buildSchoolConstruction(d,{kind,sides:n});
    assert.equal(r.error,undefined,kind+" with "+n+" sides");
    const shape=r.draft.polygons.at(-1);
    assert.equal(shape.points.length,n);
    const center=d.points[d.circles[0].center],radius=distance(center,d.points[d.circles[0].edge]);
    const pts=shape.points.map(i=>r.draft.points[i]);
    if(kind==="inscribed-polygon"){
      assert.ok(pts.every(p=>Math.abs(distance(center,p)-radius)<1e-5),"inscribed polygon vertices lie on circle");
    }else{
      assert.ok(pts.every((p,i)=>Math.abs(perpendicularDistance(center,p,pts[(i+1)%pts.length])-radius)<1e-5),
        "circumscribed polygon sides touch the circle");
    }
  }
}
for(const kind of ["radius","diameter","chord","secant","tangent","two-tangents","central-angle","inscribed-angle"]){
  const result=buildSchoolConstruction(toDraft("circle"),{kind});
  assert.equal(result.error,undefined,kind+" produces valid school geometry");
  assert.ok(result.draft.segments.length>0,kind+" produces supporting line(s)");
}
const external=buildSchoolConstruction(toDraft("circle"),{kind:"two-tangents"}).draft;
const circleCenter=external.points[0],outer=external.points.at(-3),tangentA=external.points.at(-2),tangentB=external.points.at(-1);
for(const tangent of [tangentA,tangentB]){
  const radial={x:tangent.x-circleCenter.x,y:tangent.y-circleCenter.y};
  const line={x:outer.x-tangent.x,y:outer.y-tangent.y};
  assert.ok(Math.abs(radial.x*line.x+radial.y*line.y)<1e-6,"two external tangents touch at right angle to radius");
}
assert.equal(buildSchoolConstruction(toDraft("circle"),{kind:"incircle"}).draft.circles.length,1,"polygon-only constructions reject circle target");
assert.match(editor,/Вписанная окружность/);
assert.match(editor,/Описанная окружность/);
assert.match(editor,/Вписанный многоугольник/);
assert.match(editor,/Описанный многоугольник/);
assert.match(editor,/Две касательные из точки/);
assert.match(editor,/Центральный угол/);
assert.match(editor,/Вписанный угол/);

const radiusEditorBlock=editor.slice(editor.indexOf("Радиусы окружностей"),editor.indexOf("Радиусы окружностей")+2200);
assert.ok(radiusEditorBlock.includes('circles:draft.circles.map'),"circle radius belongs to a circle annotation");
assert.ok(!radiusEditorBlock.includes('givenSides:Array.from'),"circle edits must not overwrite triangle sides");
assert.match(app,/\["circle","sphere"\]\.includes\(item\.graphFigureId/,"circle radius does not read other figures' side labels");


const {removeSchoolConstructionGroup}=await loadTs("src/lektrusConstructionCleanup.ts");
const schoolBase=toDraft("triangle");
const schoolBuilt=buildSchoolConstruction(schoolBase,{kind:"triangle-medians"});
assert.equal(schoolBuilt.error,undefined,"three school medians should build");
const added=schoolBuilt.draft.segments.slice(schoolBase.segments.length);
assert.equal(added.length,3);
const groupId=added[0].schoolGroupId;
assert.ok(groupId&&added.every(segment=>segment.schoolGroupId===groupId),"all medians share one removable ID");
assert.ok(schoolBuilt.draft.points.slice(schoolBase.points.length).every(p=>p.schoolGroupId===groupId));
const withoutSchool=removeSchoolConstructionGroup(schoolBuilt.draft,groupId);
assert.deepEqual(withoutSchool.points,schoolBase.points,"deleting all medians preserves original triangle points");
assert.deepEqual(withoutSchool.segments,schoolBase.segments,"all medians removed as a group");
const schoolCircle=buildSchoolConstruction(schoolBase,{kind:"incircle"}).draft;
const circleId=schoolCircle.circles.at(-1).schoolGroupId;
assert.deepEqual(removeSchoolConstructionGroup(schoolCircle,circleId).polygons,schoolBase.polygons);
assert.equal(removeSchoolConstructionGroup(schoolCircle,circleId).circles.length,0,"removes a whole added circle and its points");
const freePreset=makeMathPresetItem("free",0,0,"free");
assert.equal(freePreset.graphPurpose,"geometry");
assert.equal(freePreset.graphPoints.length,0);
assert.equal(freePreset.graphGrid,true,"construction grid is visible by default");
assert.equal(freePreset.graphSnap,false,"grid snapping is optional and initially off");
assert.match(app,/onSnapChange=\{enabled=>changeLiveGraphDraft/,"preview snap toggle is connected");
assert.match(editor,/export function appendFreeSketchPoint/,"free sketch algorithm is exported");
assert.match(editor,/closeFreeSketch\(draft\)/,"point contour can be closed");
assert.match(app,/onGridChange=\{enabled=>changeLiveGraphDraft/,"preview grid toggle is connected");
assert.match(app,/onGridChange=\{!item.locked&&canEdit/,"board grid toggle is connected");
assert.match(app,/className="lektrus-diagram-grid-toggle"/,"the grid toggle appears on the diagram");
assert.match(app,/className="lektrus-free-drawing-surface"/,"point placement uses the background directly");
assert.match(app,/candidate.graphFigureId==="free"/,"board updates segment chain in free point mode");
assert.match(app,/appendFreeSketchBoard\(candidate,x,y\)/,"board and editor share the same new-contour rules after closing");
assert.match(editor,/schoolGroups\.map\(group=>/,"each grouped school construction has its own delete control");
assert.match(editor,/deleteSchoolGroup\(group.id\)/,"group deletion is wired to the actual removal helper");
const styles=read("src/App.css");
assert.match(app,/className="graph-grid"/,"the grid remains rendered for school diagrams");
assert.match(app,/graph-grid-major/,"a stronger guide line is drawn every five cells");
assert.doesNotMatch(app,/style=\{\{opacity:purpose==="geometry"\?\.42:1\}\}/,"grid is not washed out on geometry diagrams");
assert.match(styles,/\.graph-view\.graph-purpose-geometry \.graph-grid line/,"stronger school notebook grid style is present");
assert.match(styles,/\.graph-view \.graph-grid line\.graph-grid-major/,"major grid guide styling is present");
assert.match(editor,/className="lektrus-school-side-count"/,"side count appears in one compact row");
assert.match(editor,/\{\[3,4,5,6,8\]\.map\(n=><option key=\{n\} value=\{n\}>\{n\}<\/option>\)\}/,"side selector shows numbers only");
assert.match(styles,/\.lektrus-school-regular-controls>\.lektrus-school-side-count>select/,"side count selector width and height are constrained");



console.log("School geometry: ray, transversal angles, solid rotation and dimension projections OK.");
