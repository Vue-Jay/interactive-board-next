import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const transpile=path=>ts.transpileModule(read(path),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
}).outputText;
function load(moduleCode,dependencies={}){
 const exports={};
 new Function("exports","require",moduleCode)(exports,name=>{
  if(name in dependencies)return dependencies[name];
  return {};
 });
 return exports;
}
const names=load(transpile("src/lektrusGeometryPointNames.ts"));
const constraints=load(transpile("src/lektrusGeometryConstraints.ts"));
const precise=load(transpile("src/lektrusGeometryPrecision.ts"));
const math=load(transpile("src/LektrusGraphEditor.tsx"),{
 "./lektrusGeometryPointNames":names,
 "./lektrusGeometryConstraints":constraints,
 "./lektrusGeometryPrecision":precise
});
const linking=load(transpile("src/lektrusGeometryExistingPoints.ts"),{
 "./lektrusGeometryPointNames":names
});
const {nextGeometryPointLabel,availableGeometryLabel,isGeometryLabelInUse,repairGeometryPointLabels}=names;
const {lockGeometryConstraint,moveGeometryVertex,forgetGeometryConstraint,removeVertexConstraints,magneticGeometrySnap}=constraints;
const forest=()=>({
 points:[{x:0,y:0,label:"A"},{x:4,y:3,label:"B"},{x:4,y:5,label:"C"}],
 constraints:[],xMin:-10,xMax:10,yMin:-10,yMax:10
});
const h=lockGeometryConstraint(forest(),[0,1],"horizontal");
assert.equal(h.error,undefined);
assert.equal(h.draft.points[1].y,0);
assert.equal(h.draft.constraints.length,1);
const movedAnchor=moveGeometryVertex(h.draft,0,1,2);
assert.equal(movedAnchor.points[1].y,2,"dependent vertex follows a moving parent");
const draggedChild=moveGeometryVertex(movedAnchor,1,7,9);
assert.equal(draggedChild.points[1].y,2,"direct child drag stays horizontal");
const v=lockGeometryConstraint(forest(),[0,1],"vertical");
assert.equal(v.draft.points[1].x,0);
assert.equal(moveGeometryVertex(v.draft,1,9,6).points[1].x,0);
const lengthLock=lockGeometryConstraint(forest(),[0,1],"distance",5);
assert.equal(lengthLock.error,undefined);
const shiftedLength=moveGeometryVertex(lengthLock.draft,0,1,2);
assert.ok(Math.abs(Math.hypot(
 shiftedLength.points[1].x-shiftedLength.points[0].x,
 shiftedLength.points[1].y-shiftedLength.points[0].y)-5)<1e-5);
const circleDrag=moveGeometryVertex(shiftedLength,1,5,10);
assert.ok(Math.abs(Math.hypot(
 circleDrag.points[1].x-circleDrag.points[0].x,
 circleDrag.points[1].y-circleDrag.points[0].y)-5)<1e-5);
const chained=lockGeometryConstraint(h.draft,[1,2],"vertical");
assert.equal(chained.error,undefined);
assert.equal(moveGeometryVertex(chained.draft,1,2,0).points[2].x,2,
 "constraints follow descendants transitively");
assert.ok(lockGeometryConstraint(chained.draft,[2,0],"horizontal").error,
 "circular vertex dependencies are rejected");
assert.ok(lockGeometryConstraint(chained.draft,[0,2],"distance",4).error,
 "a child accepts at most one controlling parent");
assert.equal(forgetGeometryConstraint(chained.draft,0).constraints.length,1);
assert.deepEqual(removeVertexConstraints(chained.draft.constraints,1),[],
 "deleting the shared vertex drops both adjacent constraints");
assert.deepEqual(magneticGeometrySnap(forest().points,-1,4.08,2.6,.1),
 {x:4,y:2.6,axis:"x"},"magnet aligns one coordinate without merging vertices");
assert.deepEqual(magneticGeometrySnap([{x:4,y:3}],0,4.08,3.04,.1),
 {x:4.08,y:3.04,axis:null},"magnet never aligns with itself");
const boundedForest={...forest(),xMax:4};
assert.ok(lockGeometryConstraint(boundedForest,[0,1],"distance",9).error,
 "invalid persistent links cannot move a vertex out of view");
const {appendFreeSketchPoint,appendFreeSketchBoard,closeFreeSketch,freeSketchClosingIndex,removeGraphPoint,closeFreeSketchBoard,removeGraphBoardPoint}=math;

assert.equal(nextGeometryPointLabel([]),"A");
const legacy=repairGeometryPointLabels([{label:"A"},{label:"C"},{label:"C"},{label:"C"},{label:"D"}]);
assert.deepEqual(legacy.map(p=>p.label),["A","C","B","E","D"],
 "fix preexisting duplicate labels without changing valid first instances");
assert.equal(new Set(legacy.map(p=>p.label)).size,legacy.length);

assert.equal(nextGeometryPointLabel([{label:"A"},{label:"C"},{label:"c"}]),"B");
assert.equal(nextGeometryPointLabel([{label:"А"},{label:"В"},{label:"С"}]),"D",
 "visually identical Cyrillic vertices reserve their Latin counterparts");
assert.equal(availableGeometryLabel([{label:"C"}],"С"),"A",
 "C and Cyrillic С must not appear twice in a single diagram");
assert.equal(isGeometryLabelInUse([{label:"С"}],"C"),true);
assert.deepEqual(
 repairGeometryPointLabels([{label:"C"},{label:"С"},{label:"А"},{label:"A"}]).map(p=>p.label),
 ["C","B","А","D"],"legacy mixed-script duplicates are repaired once");
assert.equal(nextGeometryPointLabel(Array.from({length:26},(_,i)=>({label:String.fromCharCode(65+i)}))),"AA");
assert.equal(availableGeometryLabel([{label:"A"},{label:"B"}],"A"),"C");
assert.equal(availableGeometryLabel([{label:"A"}],"O"),"O");
assert.equal(isGeometryLabelInUse([{label:"A"},{label:"B"}],"a",0),false);
assert.equal(isGeometryLabelInUse([{label:"A"},{label:"B"}],"A",1),true);
const draft=()=>({
 figureId:"free",purpose:"geometry",points:[],segments:[],polygons:[],
 circles:[],angles:[],midpoints:[],showLabels:true
});
let free=draft();
for(const [x,y] of [[0,0],[4,0],[4,4]])free=appendFreeSketchPoint(free,x,y);
assert.deepEqual(free.points.map(p=>p.label),["A","B","C"]);
assert.deepEqual(free.segments.map(s=>[s.a,s.b]),[[0,1],[1,2]]);
assert.equal(freeSketchClosingIndex(free),0,"first vertex closes initial path");
const closed=closeFreeSketch(free);
assert.notEqual(closed,free);
assert.equal(closed.polygons.length,1);
assert.deepEqual(closed.polygons[0].points,[0,1,2]);
assert.equal(closed.segments.length,0,"polygon replaces temporary edges");
assert.equal(freeSketchClosingIndex(closed),null);
free=closed;
for(const [x,y] of [[7,1],[9,1],[8,3]])free=appendFreeSketchPoint(free,x,y);
assert.deepEqual(free.points.map(p=>p.label),["A","B","C","D","E","F"]);
assert.deepEqual(free.segments.map(s=>[s.a,s.b]),[[3,4],[4,5]],
 "new figure must not connect to previous polygon");
assert.equal(freeSketchClosingIndex(free),3,"click new polygon's first vertex rather than first point of whole document");
const closedTwo=closeFreeSketch(free);
assert.deepEqual(closedTwo.polygons.map(p=>p.points),[[0,1,2],[3,4,5]]);
assert.equal(closeFreeSketch(closedTwo),closedTwo,"do not create duplicates when already closed");
let separate=draft();
for(const [x,y] of [[0,0],[2,0],[3,1]])separate=appendFreeSketchPoint(separate,x,y);
const split={...separate,freePathStart:separate.points.length};
const independentFirst=appendFreeSketchPoint(split,6,2);
assert.deepEqual(independentFirst.segments.map(s=>[s.a,s.b]),[[0,1],[1,2]],
 "starting a new line must never join it to the previous figure");
const independentSecond=appendFreeSketchPoint(independentFirst,7,3);
assert.deepEqual(independentSecond.segments.map(s=>[s.a,s.b]),[[0,1],[1,2],[3,4]]);
assert.equal(freeSketchClosingIndex(independentSecond),null,
 "only new contour vertices count toward closing");
const independentThird=appendFreeSketchPoint(independentSecond,6,4);
assert.equal(freeSketchClosingIndex(independentThird),3);
const separatedClosed=closeFreeSketch(independentThird);
assert.deepEqual(separatedClosed.polygons[0].points,[3,4,5],
 "closing the new contour never merges an older polyline");
assert.deepEqual(separatedClosed.segments.map(s=>[s.a,s.b]),[[0,1],[1,2]],
 "separate open lines remain untouched after polygon closure");
const splitBoard={
 kind:"graph",graphFigureId:"free",graphPoints:separate.points,graphSegments:separate.segments,
 graphPolygons:[],graphCircles:[],graphFreePathStart:separate.points.length
};
const boardFirst=appendFreeSketchBoard(splitBoard,8,1);
assert.equal(boardFirst.graphSegments.length,2,
 "new independent line on saved board must not join older points");
assert.equal(removeGraphBoardPoint(boardFirst,0).graphFreePathStart,2,
 "deleting an earlier vertex shifts the saved free-path start");

let edited=draft();
for(const [x,y] of [[0,0],[4,0],[4,4],[0,4]])edited=appendFreeSketchPoint(edited,x,y);
const removedMiddle=removeGraphPoint(edited,1);
assert.deepEqual(removedMiddle.points.map(p=>p.label),["A","C","D"]);
assert.deepEqual(removedMiddle.segments.map(s=>[s.a,s.b]),[[1,2],[0,1]],
 "deleting one vertex reconnects the remaining unfinished polyline");
assert.equal(freeSketchClosingIndex(removedMiddle),0);
assert.equal(closeFreeSketch(removedMiddle).polygons.length,1);
const addedAfterDelete=appendFreeSketchPoint(removedMiddle,-1,3);
assert.deepEqual(addedAfterDelete.points.map(p=>p.label),["A","C","D","B"],
 "new vertices get a unique letter even when earlier indices have changed");
assert.equal(new Set(addedAfterDelete.points.map(p=>p.label)).size,4);
let bowTie=draft();
for(const [x,y] of [[0,0],[4,4],[0,4],[4,0]])bowTie=appendFreeSketchPoint(bowTie,x,y);
assert.equal(closeFreeSketch(bowTie),bowTie,
 "self-crossing free outline must not be saved as a polygon");
const boardItem={
 kind:"graph",graphFigureId:"free",graphPoints:edited.points,graphSegments:edited.segments,
 graphPolygons:[],graphCircles:[],graphAngles:[],graphMidpoints:[]
};
const boardRemove=removeGraphBoardPoint(boardItem,1);
assert.equal(freeSketchClosingIndex({
 figureId:boardRemove.graphFigureId,points:boardRemove.graphPoints,
 segments:boardRemove.graphSegments,polygons:boardRemove.graphPolygons,circles:boardRemove.graphCircles
}),0,"board should allow closure even after an intermediate point is removed");
const boardClosed=closeFreeSketchBoard(boardRemove);
assert.deepEqual(boardClosed.graphPolygons[0].points,[0,1,2]);
assert.equal(boardClosed.graphSegments.length,0);
assert.deepEqual(boardRemove.graphPolygons,[],"closing on board never mutates previous state");
const boardAfterNewVertex=appendFreeSketchBoard(boardClosed,8,8);
assert.deepEqual(boardAfterNewVertex.graphPolygons.map(p=>p.points),[[0,1,2]]);
assert.equal(boardAfterNewVertex.graphSegments.length,0,
 "a new path on the saved board must not attach to an already closed polygon");
assert.equal(boardAfterNewVertex.graphPoints.at(-1).label,"B",
 "a new board vertex reuses only a genuinely available name");
const twoBoardPoints=appendFreeSketchBoard(boardAfterNewVertex,9,9);
assert.deepEqual(twoBoardPoints.graphSegments.map(s=>[s.a,s.b]),[[3,4]],
 "the second new vertex connects only to the new open contour");
const protectedSchoolPoint={...boardClosed,
 graphPoints:[{x:1,y:1,label:"A",schoolGroupId:"build-1"}],
 graphSegments:[],graphPolygons:[]};
const independent=appendFreeSketchBoard(protectedSchoolPoint,3,3);
assert.equal(independent.graphSegments.length,0,
 "new sketch must not extend another construction's protected point");
assert.deepEqual(independent.graphPoints.map(p=>p.label),["A","B"]);

const {linkExistingPoints}=linking;
const {removeConstruction}=load(transpile("src/lektrusConstructionCleanup.ts"));
const {geometryDistance,geometryAngle,geometryPolygonMetrics,adjustGeometryPoints,formatGeometryMetric}=precise;
assert.equal(geometryDistance({x:0,y:0},{x:3,y:4}),5);
assert.equal(geometryAngle({x:0,y:1},{x:0,y:0},{x:1,y:0}),90);
assert.equal(geometryAngle({x:-1,y:0},{x:0,y:0},{x:1,y:0}),180);
assert.equal(geometryAngle({x:0,y:0},{x:0,y:0},{x:1,y:0}),null);
assert.deepEqual(geometryPolygonMetrics([{x:0,y:0},{x:4,y:0},{x:4,y:3},{x:0,y:3}]),{perimeter:14,area:12});
assert.equal(geometryPolygonMetrics([{x:0,y:0},{x:4,y:4},{x:0,y:4},{x:4,y:0}]),null,
 "bow-tie polygon must not display a misleading area");
assert.equal(geometryPolygonMetrics([{x:0,y:0},{x:1,y:1},{x:2,y:2}]),null,
 "collinear triple has no valid interior area");
assert.equal(formatGeometryMetric(4.49999999),"4,5");
const geometry={
 points:[{x:0,y:0,label:"A"},{x:4,y:0,label:"B"},{x:4,y:3,label:"C"},{x:0,y:3,label:"D"}],
 segments:[],polygons:[],angles:[],circles:[],midpoints:[]
};
const horizontal=adjustGeometryPoints(geometry,[0,2],"horizontal");
assert.equal(horizontal.draft.points[2].y,0);
assert.deepEqual(horizontal.draft.points[0],geometry.points[0],"fixed reference point does not move");
assert.deepEqual(geometry.points[2],{x:4,y:3,label:"C"},"precision never mutates its source");
const vertical=adjustGeometryPoints(geometry,[0,2],"vertical");
assert.equal(vertical.draft.points[2].x,0);
const lengthAdjusted=adjustGeometryPoints(geometry,[0,2],"distance",5);
assert.equal(geometryDistance(lengthAdjusted.draft.points[0],lengthAdjusted.draft.points[2]),5);
const right=adjustGeometryPoints(geometry,[0,1,2],"angle",90);
assert.equal(Math.round(geometryAngle(right.draft.points[0],right.draft.points[1],right.draft.points[2])),90);
assert.equal(geometryDistance(right.draft.points[1],right.draft.points[2]),3,
 "changing an angle preserves its other ray length");
assert.equal(adjustGeometryPoints(geometry,[0,1],"distance",-4).draft,geometry);
assert.equal(adjustGeometryPoints(geometry,[0,1],"distance",1e5).draft,geometry);
assert.equal(adjustGeometryPoints(geometry,[0,1],"distance",NaN).draft,geometry);
assert.equal(adjustGeometryPoints(geometry,[0,1,2],"angle",181).draft,geometry);
const bounded={...geometry,xMin:-5,xMax:5,yMin:-5,yMax:5};
assert.equal(adjustGeometryPoints(bounded,[0,1],"distance",10).draft,bounded,
 "precision cannot silently move a vertex outside the diagram");
assert.equal(adjustGeometryPoints(geometry,[0,1],"angle",90).draft,geometry,
 "angle requires three selected points");
const straight=linkExistingPoints(geometry,"segment",[0,1]);
assert.equal(straight.draft.points,geometry.points,"reuse shared vertices by reference");
assert.deepEqual(straight.draft.segments.map(s=>[s.a,s.b,s.kind]),[[0,1,"segment"]]);
assert.equal(linkExistingPoints(straight.draft,"segment",[1,0]).draft,straight.draft,
 "duplicate reversed segment must not mutate the draft");
assert.equal(linkExistingPoints(straight.draft,"ray",[1,0]).draft.segments.length,2,
 "a directed ray may reuse an existing segment in reverse");
const rectangle=linkExistingPoints(geometry,"polygon",[0,1,2,3]);
assert.deepEqual(rectangle.draft.polygons[0].points,[0,1,2,3]);
assert.equal(rectangle.draft.points.length,4,"polygon reuses existing points");
assert.equal(linkExistingPoints(rectangle.draft,"polygon",[2,1,0,3]).draft,rectangle.draft,
 "rotated or reversed duplicate polygon rejected");
assert.equal(linkExistingPoints(geometry,"polygon",[0,2,1,3]).draft,geometry,
 "self-intersecting polygon cannot corrupt the diagram");
assert.equal(linkExistingPoints(geometry,"polygon",[0,1,1]).draft,geometry,
 "repeated vertices are not accepted");
assert.equal(linkExistingPoints(geometry,"polygon",[0,1,10]).draft,geometry,
 "out-of-range indices are rejected");
const circle=linkExistingPoints(geometry,"circle",[0,1]);
assert.equal(circle.draft.circles[0].center,0);
assert.equal(circle.draft.circles[0].edge,1);
assert.equal(circle.draft.points.length,4);
const angle=linkExistingPoints(geometry,"angle",[0,1,2]);
assert.deepEqual(angle.draft.angles.map(a=>[a.a,a.vertex,a.b]),[[0,1,2]],
 "the second selected point must be the angle vertex");
const midpoint=linkExistingPoints(geometry,"midpoint",[0,2]);
assert.deepEqual(midpoint.draft.midpoints.map(m=>[m.a,m.b,m.label]),[[0,2,"M"]]);
assert.equal(linkExistingPoints(midpoint.draft,"midpoint",[2,0]).draft,midpoint.draft);
assert.equal(linkExistingPoints(geometry,"segment",[0,0]).draft,geometry,
 "zero-length construction does not change the drawing");
const linkWithExistingLine=linkExistingPoints(straight.draft,"polygon",[0,1,2,3]);
const afterLinkDelete=removeConstruction(linkWithExistingLine.draft,"polygon",0);
assert.equal(afterLinkDelete.polygons.length,0);
assert.equal(afterLinkDelete.points.length,4,
 "removing a reused-vertex polygon preserves all original points");
assert.deepEqual(afterLinkDelete.segments,straight.draft.segments,
 "removing a reused-vertex polygon preserves earlier supporting segments");
assert.equal(removeConstruction(straight.draft,"segment",0).points.length,4,
 "removing a linked segment preserves free-standing original points");
assert.equal(removeConstruction(circle.draft,"circle",0).points.length,4,
 "removing a linked circle preserves its original center and radius point");
assert.equal(removeConstruction(angle.draft,"angle",0).points.length,4,
 "removing a linked angle preserves its original vertices");
const straightAngle={
 ...geometry,points:[{x:-1,y:0,label:"A"},{x:0,y:0,label:"B"},{x:1,y:0,label:"C"}]
};
assert.equal(linkExistingPoints(straightAngle,"angle",[0,1,2]).draft.angles.length,1,
 "a straight 180 degree angle is valid");
assert.equal(linkExistingPoints(straightAngle,"angle",[0,1,0]).draft,straightAngle,
 "the same point cannot be chosen twice");
const app=read("src/App.tsx"),editor=read("src/LektrusGraphEditor.tsx");
const css=read("src/lektrusMathTouchPolish.css"),main=read("src/main.tsx");
assert.match(app,/onCloseFreePolygon=\{\(\)=>setGraphDraft\(/,"preview closes polygon at first point");
assert.match(app,/onCloseFreePolygon=\{graphPointEditId===item\.id&&selectedIds\.has\(item\.id\)/,"saved board can close free geometry");
assert.match(app,/Math\.hypot\(ev\.clientX-startX,ev\.clientY-startY\)>\(ev\.pointerType==="touch"\?14:7\)/,
 "tap does not instantly drag the vertex");
assert.match(app,/freeContacts\.current\.size>1/,
 "touch-down involving multiple fingers cannot create a random point");
assert.match(app,/onPointerCancel=\{event=>\{/,"cancelled touch never creates a point");
assert.doesNotMatch(app,/candidate\.graphFigureId==="free"\?String\.fromCharCode/,
 "saved board names must never depend on point index");
assert.match(editor,/↶ Отменить точку/);
assert.match(editor,/lektrus-free-build-status/);
assert.match(css,/\.lektrus-free-close-target/);
assert.match(css,/@media\(pointer:coarse\)/);
assert.match(main,/import "\.\/lektrusMathTouchPolish\.css"/);
assert.match(app,/repairGeometryPointLabels\(Array\.isArray\(item\.graphPoints\)/);
assert.match(app,/event\.pointerType==="touch"\?14:9/,
 "touch placement tolerates the small motion caused by a finger tap");
assert.match(app,/onPointerDownCapture=/,
 "SVG must track all fingers even when touching existing vertices");
assert.match(app,/freePointGesture/,
 "second finger cancels an existing point gesture");
assert.match(app,/appendFreeSketchBoard\(candidate,x,y\)/,
 "saved board uses the same geometry path builder");
assert.match(editor,/adjustGeometryPoints\(draft,linkPoints,kind,value\)/,
 "geometry editor delegates exact alignments to the validated model");
assert.match(editor,/geometryPolygonMetrics\(linkPoints\.map/,
 "measurements update from referenced vertex positions");
assert.match(editor,/linkKind==="measure"/,
 "measurement mode keeps the selection rather than adding a construction");
assert.match(editor,/lektrus-precision-target/,
 "mobile editor exposes an exact measurement field");
assert.match(editor,/polygon\.showMetrics===true/,
 "polygon has an optional computed area and perimeter overlay");
assert.match(editor,/segment\.measure===true/,
 "segment length readout is user-switchable");
assert.match(editor,/angle\.autoMeasure===true/,
 "angle readout is user-switchable");
assert.match(app,/geometryPolygonMetrics\(pts\)/,
 "saved board and preview compute polygon area from actual positions");
assert.match(app,/formatGeometryMetric\(geometryDistance\(a,b\)\)/,
 "segment length labels follow changing endpoints");
assert.match(app,/formatGeometryMetric\(geometryAngle\(a,v,b\)\?\?NaN\)/,
 "angle labels follow actual geometry rather than stale values");
assert.match(css,/lektrus-live-geometry-metrics/,
 "computed measurement labels are styled for white backgrounds");
assert.match(editor,/lockGeometryConstraint\(draft,linkPoints,kind,value\)/,
 "persistent links use validated directed dependency model");
assert.match(editor,/Точки <span>/,
 "points are accessible through the compact inspector tab");
assert.match(editor,/<span>2D<\/span>/,
 "the 2D catalog is always accessible in the compact header");
assert.match(editor,/<span>3D<\/span>/,
 "the 3D catalog is always accessible in the compact header");
assert.match(editor,/LektrusGeometryPresetGlyph id=\{p.id\}/,
 "each figure preset has a recognisable preview drawing");
assert.match(editor,/showFigureCatalog\("Объёмные фигуры"\)/,
 "3D library navigation opens the catalog directly");
assert.doesNotMatch(editor,/lektrus-geometry-rail-library/,
 "2D/3D switch is not duplicated in the tool rail");
assert.match(boardPanel,/lektrus-board-geometry-display/,
 "secondary display settings stay collapsed by default");
assert.match(app,/boardGeometryMode\?\.id!==singleSelected\.id\)\&\&<button/,
 "selection toolbar hides duplicate editor button when the construction panel is open");
assert.doesNotMatch(editor,/className=\{tab==="connect"\?"active"/,
 "connecting points is part of the existing points section, not a fifth tab");
assert.match(editor,/className="lektrus-link-kind-picker"/,
 "a compact selector replaces eight competing buttons");
assert.match(editor,/Закрепить расположение/,
 "advanced constraints appear only in an optional disclosure");
assert.match(app,/magneticGeometrySnap\(item\.graphPoints/,
 "geometry drag snaps gently to neighboring coordinate axes");
assert.match(app,/moveGeometryVertex\(current,i,xx,yy\)/,
 "drags preserve live vertex dependencies");
assert.match(app,/graphConstraints:d\.constraints/,
 "persistent links survive save");
assert.match(app,/graphMagneticSnap:d\.magneticSnap/,
 "snap preference survives save");
const boardModel=read("src/boardModel.ts");
assert.match(boardModel,/"graphConstraints","graphMagneticSnap"/,
 "new geometry settings are included in board import/export allowlist");
assert.match(math.removeGraphBoardPoint.toString(),/graphConstraints/,
 "deleting a vertex in a saved board removes dangling constraints");
const fourTabs=(editor.match(/tab==="presets"\?"active"|tab==="givens"\?"active"|tab==="geometry"\?"active"|tab==="points"\|\|tab==="connect"\?"active"/g)||[]);
assert.equal(fourTabs.length,4,"only four top-level editor tabs");
assert.match(editor,/linkExistingPoints\(source,linkKind,selected\)/,
 "editor invokes pure existing-vertex geometry builder");
assert.match(editor,/onPickPoint:pickLinkPoint,onCreateAndPickPoint:createAndSelectPoint,pickedPoints:linkPoints/,
 "preview forwards touch vertex selection and highlights picks");
assert.match(app,/if\(tap\.index!==null\)\{/,
 "one SVG capture processes each selected vertex once");
assert.match(app,/onPickPoint\(tap\.index\)/,
 "single tap forwards the selected point");
assert.match(app,/onRemovePoint\(tap\.index\)/,
 "touch double tap removes the point without reopening the editor");
assert.match(css,/lektrus-link-vertex-list/,
 "the same vertex selection is possible through accessible large buttons");

assert.match(editor,/Построение фигур/,
 "full screen figure editor uses a consistent title");
assert.match(app,/lektrus-graph-open-editor/,
 "selected figure exposes an obvious primary editor action");
assert.match(app,/lektrus-graph-inline-draw/,
 "in-board drawing is a secondary mode");
assert.match(app,/<span>Построение<\/span>/,
 "on-board mode no longer uses the misleading points-only label");
assert.match(editor,/LektrusGeometryToolIcon name="close"/,
 "workspace has a consistent vector close icon");
assert.match(editor,/lektrus-start-free-drawing/,
 "an obvious build-by-points entry exists on the first geometry screen");
assert.match(editor,/onCreateAndPickPoint:createAndSelectPoint/,
 "new vertices are created and selected by a single touch without tab switching");
assert.match(app,/lektrus-connect-drawing-surface/,
 "an actual SVG hit area must receive taps on blank construction canvas");
assert.match(app,/let nearest:number\|null=null,best=radius\*radius/,
 "nearest real vertex wins when large mobile touch areas overlap");
assert.match(app,/selectionContacts\.current\.size>1/,
 "two-finger navigation cancels point selection");
assert.match(app,/onPointMoveEnd=\{boardGeometryMode\?\.id===item\.id&&selectedIds\.has\(item\.id\)/,
 "vertex dragging is opt-in so ordinary object dragging remains available");
assert.match(app,/if\(onPointMoveEnd\)setLiveVertex/,
 "local drag preview does not write remote history at every pointer step");
assert.match(app,/onPointMoveEnd\(i,lastPosition\.x,lastPosition\.y\)/,
 "vertex position commits once on pointer release");
assert.match(app,/onClose=\{closeGraphEditor\}/,
 "closing or cancelling editor does not persist unfinished construction");
assert.match(editor,/const undoLinkPoint=\(\)=>/,
 "undo handles vertices created during unfinished constructions");
assert.match(editor,/const resetLinkSelection=\(\)=>/,
 "cancel clears unfinished vertices, not just their selection");
assert.match(css,/lektrus-connect-drawing-surface/,
 "geometry tap surface is accessible on touch devices");
const parsedApp=ts.createSourceFile("src/App.tsx",app,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TSX);
const parsedEditor=ts.createSourceFile("src/LektrusGraphEditor.tsx",editor,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TSX);
assert.equal(parsedApp.parseDiagnostics.length,0,
 "board JSX with nested graph action buttons must parse successfully");
assert.equal(parsedEditor.parseDiagnostics.length,0,
 "geometry editor JSX must parse successfully");
assert.match(app,/onDoubleClick=\{e=>\{if\(purpose==="geometry"\)/,
 "double-clicking the graph surface cannot open settings or add stray geometry");
assert.match(app,/onOpenEditor=\{\(\)=>openGraphEditor\(singleSelected\)\}/,
 "full editor opens only from the explicit panel button");
assert.match(app,/\.selection-toolbar-screen,button,input,select,textarea/,
 "board selection capture leaves toolbar clicks intact");
assert.doesNotMatch(app,/className="lektrus-graph-board-actions"/,
 "redundant on-canvas settings toolbar was removed");
assert.match(app,/aria-label=\{singleSelected\.graphPurpose==="geometry"\?"Открыть полный редактор фигур"/,
 "the bottom toolbar explicitly labels its editor action");
assert.match(app,/changeBoardGeometryMode\(singleSelected,"move"\)/,
 "the selection toolbar opens on-board construction mode");
assert.match(app,/onAddPoint=\{graphPointEditId===item\.id/,
 "a normal graph drag no longer adds accidental vertices");
assert.match(app,/onCloseFreePolygon=\{graphPointEditId===item\.id/,
 "a normal graph drag no longer closes a free polygon accidentally");
assert.match(app,/activeBoardGeometryMode\(item\)==="move"/,
 "vertex manipulation is separated from geometry construction modes");
assert.match(app,/if\(touchControl && !boardHandle\)return/,
 "board capture never treats the settings toolbar as an ink or eraser gesture");
assert.match(app,/if\(tool==="eraser"&&!\(/,
 "eraser click capture respects interactive diagram buttons");
assert.match(app,/className="graph-selection-controls"/,
 "settings and point mode are together in a single toolbar");
assert.match(app,/const editBlankTap=useRef/,
 "board has its own cancellable background point-tap gesture");
assert.match(app,/if\(onPointMoveEnd&&onAddPoint&&item\.graphFigureId!=="free"/,
 "one-tap vertex creation is enabled only in explicit edit mode");
assert.match(app,/if\(editBlankTap\.current\?\.id===event\.pointerId\)/,
 "point is added only on release of its original finger");
assert.match(app,/if\(editBlankTap\.current\)editBlankTap\.current\.cancelled=true/,
 "pinch cancels provisional vertex placement");
assert.match(app,/onDoubleClick=\{onRemovePoint&&purpose==="geometry"/,
 "double-click on a vertex removes it only in point editing mode");
assert.match(css,/\.board-object\.object-graph \.lektrus-connect-drawing-surface/,
 "the board has a dedicated touch-safe blank drawing surface");
assert.match(app,/ignoreNativeDoubleClickUntil/,
 "mobile double-tap cannot delete two vertices accidentally");
assert.match(app,/boardGestureHandle=target\.closest/,
 "board handles control clicks before any selection mutation");
assert.match(app,/window\.addEventListener\("pointerup",up,true\)/,
 "vertex release is captured even when the board consumes bubble events");
assert.match(app,/window\.addEventListener\("pointerdown",secondaryPointer,true\)/,
 "a second finger cancels ongoing vertex drag");
assert.match(app,/graphFreePathStart:d\.freePathStart/,
 "independent line boundary is saved with the graph");
assert.match(app,/freePathStart:item\.graphFreePathStart\?\?0/,
 "saved independent paths are restored when editor opens");
assert.match(app,/graphFreePathStart:item\.graphPoints\?\.length\?\?0/,
 "new line action starts after existing points");
assert.match(editor,/Новая линия/,
 "the same new line action is available in editor");
assert.match(boardModel,/"graphFreePathStart"/,
 "free path start is included in board import and export allowlist");
const boardPanel=read("src/LektrusBoardGeometryPanel.tsx");
assert.match(boardPanel,/<strong>Построение<\/strong>/,
 "board construction panel and selection toolbar share their title");
assert.match(boardPanel,/onOpenEditor/,
 "board drawing panel can launch the full editor without hiding and reselecting");
const boardActions=read("src/lektrusBoardGeometry.ts");
assert.match(app,/onPickPoint=\{item\.graphPurpose==="geometry"/,
 "clicking an existing point enters the active board construction");
assert.match(app,/onCreateAndPickPoint=\{item\.graphPurpose==="geometry"/,
 "tapping empty graph space creates and selects a vertex");
assert.match(app,/linkBoardGeometry\(original,mode,next\)/,
 "two or three taps complete line, circle and angle on the saved object");
assert.match(boardPanel,/onConstraint\("distance",length\?\?undefined\)/,
 "precise constraints are accessible without opening a dialog");
assert.match(boardPanel,/schoolActions\.map\(/,
 "school constructions are accessible directly on the board");
assert.match(boardActions,/removeBoardGeometryElement/,
 "construction element removal is available on the board");
const geometryWorkspaceCss=read("src/lektrusGeometryWorkspace.css");
assert.match(editor,/lektrus-geometry-workspace/,
 "geometry uses an independently styled fullscreen studio");
assert.match(editor,/lektrus-geometry-tool-rail/,
 "geometry tools are always accessible to the left of the canvas");
assert.match(editor,/canvasTool==="point"/,
 "single touch point creation is distinct from vertex movement");
assert.match(geometryWorkspaceCss,/grid-template-columns:58px minmax\(0,1fr\) minmax\(290px,312px\)/,
 "one compact rail and inspector leave the large central canvas accessible");
assert.match(app,/setPendingMathItem\(item\);\s*setSelected\(\[\]\);setTool\("select"\);\s*openGraphEditor\(item\)/,
 "new geometry remains pending until the large editor is saved");
assert.match(app,/boardGeometryMode\?\.id===singleSelected\.id&&/,
 "quick geometry panel does not appear when merely selecting a drawing");
console.log("Geometry construction regression checks: fullscreen workspace, creation, edit gestures and cancellation.");
