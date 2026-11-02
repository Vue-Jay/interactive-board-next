/** Single spatial camera for organism -> system -> organ -> tissue -> cell.
 * Coordinates belong to the actual saved node graph. Photographs are carefully
 * labelled as a cross-specimen educational series, NOT as one physical object
 * viewed at impossible optical magnifications.
 */
import type {BioNode,BioOrganism,BioImageSpot} from "./lektrusBioMicroscopeModel";
import {bioChildSpot,bioChildren} from "./lektrusBioMicroscopeModel";
import {bioSpecimenChildSpot} from "./lektrusBioSpecimenPlates";

export type BioZoomCamera={x:number;y:number;scale:number};
export type BioZoomImage={file:string;caption:string;author:string;license:string;source:string;mode:"photograph"|"micrograph"};
export const BIO_ZOOM_BASE={width:480,height:330} as const;
export const BIO_ZOOM_MAX=3;
export const BIO_ZOOM_GATE=2.7;
export const BIO_ZOOM_INITIAL:BioZoomCamera={x:0,y:0,scale:1};
const file=(f:string)=>"https://commons.wikimedia.org/wiki/Special:FilePath/"+encodeURIComponent(f)+"?width=1600";
const source=(f:string)=>"https://commons.wikimedia.org/wiki/File:"+encodeURIComponent(f);
/** Only one reviewed, same-species educational photo sequence so far. */
const PINE_IMAGES:Record<string,BioZoomImage>={
 organism:{file:file("Pinus sylvestris.1.jpg"),caption:"Сосна обыкновенная целиком, фотография взрослого дерева",author:"Ateragramm",license:"CC0",source:source("Pinus sylvestris.1.jpg"),mode:"photograph"},
 system:{file:file("Pinus sylvestris 2026 G2.jpg"),caption:"Ветвь Pinus sylvestris с хвоей, другой экземпляр того же вида",author:"George Chernilevsky",license:"CC BY 4.0",source:source("Pinus sylvestris 2026 G2.jpg"),mode:"photograph"},
 organ:{file:file("Pinus sylvestris 2026 G3.jpg"),caption:"Крупный план хвои Pinus sylvestris, отдельный снимок",author:"George Chernilevsky",license:"CC BY 4.0",source:source("Pinus sylvestris 2026 G3.jpg"),mode:"photograph"},
 tissue:{file:file("PineNeedleCross.png"),caption:"Настоящий поперечный срез хвои Pinus sylvestris, другой микропрепарат",author:"Lord of Konrad",license:"CC0",source:source("PineNeedleCross.png"),mode:"micrograph"}
};
/** Different photographs of Helianthus annuus, linked only by valid morphology.
 * The epidermal imprint is the same micrograph at tissue and guard-cell depths.
 * It is not a cross-section of mesophyll and shows no actual intracellular Z-stack.
 */
const SUNFLOWER_IMAGES:Record<string,BioZoomImage>={
 organism:{file:file("Helianthus annuus plant-9-16-04.jpg"),caption:"Подсолнечник Helianthus annuus целиком, отдельное растение",author:"Thayne Tuason",license:"CC BY-SA 4.0",source:source("Helianthus annuus plant-9-16-04.jpg"),mode:"photograph"},
 system:{file:file("Close-up of a Common Sunflower.jpg"),caption:"Побег Helianthus annuus, соцветие и листья на другом экземпляре",author:"Rifat R",license:"CC BY 4.0",source:source("Close-up of a Common Sunflower.jpg"),mode:"photograph"},
 organ:{file:file("Helianthus annuus leaf-9-16-04.jpg"),caption:"Лист Helianthus annuus, фотография",author:"Thayne Tuason",license:"CC BY-SA 4.0",source:source("Helianthus annuus leaf-9-16-04.jpg"),mode:"photograph"},
 tissue:{file:file("Helianthus annuus Leaf epidermis print and stomata 400x.jpg"),caption:"Реальный отпечаток эпидермиса листа Helianthus annuus с устьицами, световая микроскопия 400×, стек фокуса",author:"ChrisInMilton",license:"CC BY-SA 4.0",source:source("Helianthus annuus Leaf epidermis print and stomata 400x.jpg"),mode:"micrograph"}
};
export function bioZoomImageFor(organism:BioOrganism,node:BioNode):BioZoomImage|null{
 if(organism==="sunflower"){
  if(node.level==="organism")return SUNFLOWER_IMAGES.organism;
  if(node.id==="sunflower/побег")return SUNFLOWER_IMAGES.system;
  if(node.id==="sunflower/побег/лист")return SUNFLOWER_IMAGES.organ;
  if(node.id==="sunflower/побег/лист/эпидермис-листа"||
     node.id==="sunflower/побег/лист/эпидермис-листа/замыкающая-клетка-устьица")
   return SUNFLOWER_IMAGES.tissue;
  return null;
 }
 if(organism!=="pine")return null;
 if(node.level==="organism")return PINE_IMAGES.organism;
 // A photograph of a shoot must NOT be silently used for roots or pollen.
 if(!node.id.startsWith("pine/побег"))return null;
 if(node.level==="system")return PINE_IMAGES.system;
 if(node.level==="organ"&&node.name==="Хвоя")return PINE_IMAGES.organ;
 if(node.level==="tissue"&&node.name==="Мезофилл хвои")return PINE_IMAGES.tissue;
 return null;
}
/** Returns true only if two consecutive levels share exactly the same
 * original photographed field. Used to prevent faux fading to a new sample. */
export function bioZoomSharedFrame(organism:BioOrganism,a:BioNode,b:BioNode):boolean{
 const p=bioZoomImageFor(organism,a),q=bioZoomImageFor(organism,b);
 return !!p&&!!q&&p.mode==="micrograph"&&p.file===q.file;
}
export function bioZoomPoint(organism:BioOrganism,parent:BioNode,child:BioNode,index:number,total:number):BioImageSpot{
 const exact=bioSpecimenChildSpot(organism,parent,child);
 if(exact)return exact;
 if(organism==="sunflower"){
  if(parent.level==="organism"&&child.name==="Побег")return {x:226,y:165};
  if(parent.id==="sunflower/побег"&&child.name==="Лист")return {x:324,y:241};
  if(parent.id==="sunflower/побег/лист"){
   if(child.name==="Эпидермис листа")return {x:323,y:167};
   if(child.name==="Столбчатая паренхима")return {x:170,y:165};
  }
  if(parent.id==="sunflower/побег/лист/эпидермис-листа")
   return {x:240,y:165};
 }
 if(organism==="pine"&&parent.level==="organism"){
  // Visible crown; root and male shoot remain labelled inferred regions.
  const pos:Record<string,BioImageSpot>={
   "Побег":{x:263,y:133},"Корневая система":{x:242,y:292},
   "Мужские репродуктивные побеги":{x:310,y:178}
  };
  return pos[child.name]??bioChildSpot(organism,parent,child,index,total);
 }
 if(organism==="pine"&&parent.id==="pine/побег")return {x:264,y:178};
 if(organism==="pine"&&parent.level==="organ"&&parent.name==="Хвоя")return {x:244,y:172};
 if(organism==="pine"&&parent.level==="tissue"&&parent.name==="Мезофилл хвои")return {x:215,y:180};
 return bioChildSpot(organism,parent,child,index,total);
}
export function bioZoomClamp(value:number,min:number,max:number):number{
 return Math.min(max,Math.max(min,Number.isFinite(value)?value:min));
}
export function bioZoomBound(camera:BioZoomCamera):BioZoomCamera{
 const scale=bioZoomClamp(camera.scale,1,BIO_ZOOM_MAX);
 if(scale===1)return {scale:1,x:0,y:0};
 return {scale,
  x:bioZoomClamp(camera.x,-240*(scale-1),240*(scale-1)),
  y:bioZoomClamp(camera.y,-165*(scale-1),165*(scale-1))};
}
export function bioZoomAt(camera:BioZoomCamera,scale:number,anchor:BioImageSpot):BioZoomCamera{
 const target=bioZoomClamp(scale,1,BIO_ZOOM_MAX),ratio=target/camera.scale;
 const ax=anchor.x-240,ay=anchor.y-165;
 return bioZoomBound({scale:target,
  x:ax-(ax-camera.x)*ratio,
  y:ay-(ay-camera.y)*ratio});
}
export function bioZoomPan(camera:BioZoomCamera,dx:number,dy:number):BioZoomCamera{
 return bioZoomBound({...camera,x:camera.x+dx,y:camera.y+dy});
}
/** Screen point is in the canonical 480x330 zoom viewport. */
export function bioZoomToWorld(camera:BioZoomCamera,point:BioImageSpot):BioImageSpot{
 return {x:240+(point.x-240-camera.x)/camera.scale,
         y:165+(point.y-165-camera.y)/camera.scale};
}
export function bioZoomClosestChild(
 organism:BioOrganism,parent:BioNode,children:BioNode[],world:BioImageSpot,radius=62
):{child:BioNode;spot:BioImageSpot}|null{
 let choice:{child:BioNode;spot:BioImageSpot}|null=null;
 let best=radius*radius;
 children.forEach((child,i)=>{
  const spot=bioZoomPoint(organism,parent,child,i,children.length);
  const squared=(spot.x-world.x)**2+(spot.y-world.y)**2;
  if(squared<=best){best=squared;choice={child,spot};}
 });
 return choice;
}
export function bioZoomPath(nodes:BioNode[],id:string):BioNode[]{
 const byId=new Map(nodes.map(n=>[n.id,n]));
 const result:BioNode[]=[];
 let current=byId.get(id);
 while(current){result.unshift(current);current=current.parentId?byId.get(current.parentId):undefined;}
 return result;
}
export function bioZoomChildCandidates(nodes:BioNode[],node:BioNode):BioNode[]{
 return bioChildren(nodes,node.id);
}
