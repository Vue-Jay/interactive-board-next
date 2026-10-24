import type {Item} from "./boardModel";
import type {GraphDraft} from "./LektrusGraphEditor";
import {nextGeometryPointLabel,repairGeometryPointLabels,availableGeometryLabel} from "./lektrusGeometryPointNames";
import {linkExistingPoints,type ExistingPointTool} from "./lektrusGeometryExistingPoints";
import {adjustGeometryPoints,type PrecisionMode} from "./lektrusGeometryPrecision";
import {lockGeometryConstraint,forgetGeometryConstraint,moveGeometryVertex} from "./lektrusGeometryConstraints";
import {buildSchoolConstruction,type SchoolConstruction} from "./lektrusSchoolConstructions";
import {removeConstruction,removeSchoolConstructionGroup,type ConstructionKind} from "./lektrusConstructionCleanup";

type Geometry=Pick<GraphDraft,"points"|"segments"|"circles"|"angles"|"polygons"|"midpoints"|"constraints">;
export type BoardGeometryResult={item:Item;error?:string};

/** The canvas and the full editor operate on the same geometry data.
 * All links refer to original vertex indices. No detached duplicate points. */
export const boardGeometry=(item:Item):Geometry=>({
  points:repairGeometryPointLabels(item.graphPoints??[]),
  segments:item.graphSegments??[],
  circles:item.graphCircles??[],
  angles:item.graphAngles??[],
  polygons:item.graphPolygons??[],
  midpoints:item.graphMidpoints??[],
  constraints:item.graphConstraints??[]
});
export const writeBoardGeometry=(item:Item,g:Geometry):Item=>({
  ...item,graphPoints:g.points,graphSegments:g.segments,graphCircles:g.circles,
  graphAngles:g.angles,graphPolygons:g.polygons,graphMidpoints:g.midpoints,graphConstraints:g.constraints
});
export function addBoardGeometryPoint(item:Item,x:number,y:number):BoardGeometryResult{
  const g=boardGeometry(item);
  if(g.points.length>=40)return {item,error:"На чертеже может быть не более 40 точек."};
  if(!Number.isFinite(x)||!Number.isFinite(y))return {item,error:"Некорректные координаты точки."};
  return {item:writeBoardGeometry(item,{...g,points:[...g.points,{x,y,label:nextGeometryPointLabel(g.points),color:"#111111"}]})};
}
export function linkBoardGeometry(item:Item,kind:ExistingPointTool,indices:readonly number[]):BoardGeometryResult{
  const g=boardGeometry(item);
  const result=linkExistingPoints(g,kind,indices);
  return {item:result.error?item:writeBoardGeometry(item,result.draft),error:result.error};
}
export function adjustBoardGeometry(item:Item,indices:readonly number[],mode:PrecisionMode,target?:number):BoardGeometryResult{
  const g=boardGeometry(item);
  const result=adjustGeometryPoints({
    ...g,xMin:item.graphXMin??-10,xMax:item.graphXMax??10,
    yMin:item.graphYMin??-10,yMax:item.graphYMax??10
  },indices,mode,target);
  if(result.error)return {item,error:result.error};
  const changed=result.draft.points.findIndex((p,i)=>p.x!==g.points[i]?.x||p.y!==g.points[i]?.y);
  if(changed<0)return {item};
  const p=result.draft.points[changed];
  const moved=moveGeometryVertex(g,changed,p.x,p.y);
  return {item:writeBoardGeometry(item,moved)};
}
export function constrainBoardGeometry(item:Item,indices:readonly number[],mode:"horizontal"|"vertical"|"distance",value?:number):BoardGeometryResult{
  const g=boardGeometry(item);
  const result=lockGeometryConstraint(g,indices,mode,value);
  return {item:result.error?item:writeBoardGeometry(item,result.draft),error:result.error};
}
export function releaseBoardGeometryConstraint(item:Item,index:number):Item{
  return writeBoardGeometry(item,forgetGeometryConstraint(boardGeometry(item),index));
}
export function schoolBoardGeometry(item:Item,kind:SchoolConstruction):BoardGeometryResult{
  const g=boardGeometry(item);
  // The school construction engine only reads the geometrical draft fields.
  const draft={...g,figureId:item.graphFigureId??"free"} as GraphDraft;
  const result=buildSchoolConstruction(draft,{kind});
  return {item:result.error?item:writeBoardGeometry(item,result.draft),error:result.error};
}
export function removeBoardGeometryElement(item:Item,kind:ConstructionKind,index:number):Item{
  return writeBoardGeometry(item,removeConstruction(boardGeometry(item),kind,index));
}
export function removeBoardGeometrySchoolGroup(item:Item,group:string):Item{
  return writeBoardGeometry(item,removeSchoolConstructionGroup(boardGeometry(item),group));
}
export function editBoardGeometryPoint(item:Item,index:number,change:{x?:number;y?:number;label?:string}):BoardGeometryResult{
  const g=boardGeometry(item),p=g.points[index];
  if(!p)return {item,error:"Точка больше не существует."};
  if(change.label!==undefined){
    const wanted=change.label.trim().slice(0,16);
    const unique=availableGeometryLabel(g.points.filter((_,i)=>i!==index),wanted);
    if(wanted!==unique)return {item,error:"Подпись занята другой точкой. Выберите другую букву."};
    return {item:writeBoardGeometry(item,{...g,points:g.points.map((v,i)=>i===index?{...v,label:wanted}:v)})};
  }
  const x=change.x??p.x,y=change.y??p.y;
  if(!Number.isFinite(x)||!Number.isFinite(y))return {item,error:"Введите числовые координаты."};
  return {item:writeBoardGeometry(item,moveGeometryVertex(g,index,x,y))};
}
