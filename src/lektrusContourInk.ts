import type {Item,Point} from "./boardModel";
import type {ContourStroke} from "./lektrusAtlasModel";
import {eraseInkAlongPath} from "./inkEraser";

const geoToWorld=([lon,lat]:[number,number]):Point=>({x:(lon+180)*2.5,y:(90-lat)*2.5});
const worldToGeo=(point:Point):[number,number]=>[
 Math.max(-180,Math.min(180,point.x/2.5-180)),
 Math.max(-90,Math.min(90,90-point.y/2.5))
];
function asInkItem(stroke:ContourStroke,pixelsPerWorld:number):Item{
 const points=stroke.points.map(geoToWorld);
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const x=Math.min(...xs),y=Math.min(...ys);
 return {id:stroke.id,kind:"pen",x,y,width:Math.max(1,Math.max(...xs)-x),
  height:Math.max(1,Math.max(...ys)-y),text:"",color:stroke.color,weight:(stroke.width??2)/pixelsPerWorld,
  points:points.map(p=>({x:p.x-x,y:p.y-y}))};
}
function asContourStroke(item:Item,pixelsPerWorld:number):ContourStroke[]{
 const points=(item.points??[]).map(p=>worldToGeo({x:item.x+p.x,y:item.y+p.y}));
 if(points.length<2)return [];
 const result:ContourStroke[]=[];
 // The saved atlas format bounds each polyline to 250 points.
 for(let offset=0;offset<points.length-1;offset+=249){
  const segment=points.slice(offset,offset+250);
  if(segment.length>=2)result.push({id:result.length?crypto.randomUUID():item.id,
   color:item.color??"#000000",width:(item.weight??2)*pixelsPerWorld,points:segment});
 }
 return result;
}
/** The exact board ink eraser, adapted to school-atlas geographic coordinates.
 * It cuts only brushed stroke segments, preserving both sides of a line. */
export function eraseContourInkAlongPath(strokes:ContourStroke[],brush:Point[],radiusWorld:number,pixelsPerWorld=1):ContourStroke[]{
 if(!brush.length||!strokes.length||radiusWorld<=0)return strokes;
 const units=Math.max(.000001,pixelsPerWorld);
 const source=strokes.map(stroke=>asInkItem(stroke,units));
 const erased=eraseInkAlongPath(source,brush,radiusWorld);
 if(erased===source)return strokes;
 const next=erased.flatMap(item=>asContourStroke(item,units));
 // Never silently truncate unrelated student work if a wildly fragmented
 // stroke would exceed the atlas persistence limit.
 return next.length<=140?next:strokes;
}
