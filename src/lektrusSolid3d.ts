import type {Item} from "./boardModel";

export const solidFigureIds = [
  "cube","rectangular-prism","prism","pyramid","triangular-pyramid","cylinder","cone","sphere"
] as const;
export type SolidFigureId = typeof solidFigureIds[number];

export function isSolidFigure(id:unknown):id is SolidFigureId {
  return typeof id==="string"&&(solidFigureIds as readonly string[]).includes(id);
}

export type SolidPoint = {x:number;y:number;z:number};
export type ProjectedPoint={x:number;y:number;label:string;color?:string};

function positive(value:string|undefined,fallback:number):number {
  const number=Number((value??"").replace(",",".").trim());
  return Number.isFinite(number)&&number>0?Math.min(10000,number):fallback;
}
function dimensions(item:Item):[number,number,number] {
  const sides=item.graphGivenSides??[];
  if(item.graphFigureId==="cube"){const size=positive(sides[0],5);return [size,size,size]}
  if(item.graphFigureId==="cylinder"||item.graphFigureId==="cone"){
    const radius=positive(sides[0],3.2),height=positive(sides[1],6);
    return [radius*2,radius*2,height];
  }
  const x=positive(sides[0],5),y=positive(sides[1],4),z=positive(sides[2],5);
  return [x,y,z];
}
export function solidWorldPoints(item:Item):SolidPoint[] {
  const id=item.graphFigureId;
  if(!isSolidFigure(id))return [];
  const [length,depth,height]=dimensions(item);
  const w=length/2,d=depth/2,h=height/2;
  const rectangle:[number,number,number][]=[
    [-w,-d,-h],[w,-d,-h],[w,d,-h],[-w,d,-h],
    [-w,-d,h],[w,-d,h],[w,d,h],[-w,d,h]
  ];
  if(id==="cube"||id==="rectangular-prism")return rectangle.map(([x,y,z])=>({x,y,z}));
  if(id==="prism"){
    return [
      {x:-w,y:-d,z:-h},{x:w,y:-d,z:-h},{x:0,y:d,z:-h},
      {x:-w,y:-d,z:h},{x:w,y:-d,z:h},{x:0,y:d,z:h}
    ];
  }
  if(id==="pyramid")return [...rectangle.slice(0,4).map(([x,y,z])=>({x,y,z})),{x:0,y:0,z:h}];
  if(id==="triangular-pyramid")return [
    {x:-w,y:-d,z:-h},{x:w,y:-d,z:-h},{x:0,y:d,z:-h},{x:0,y:0,z:h}
  ];
  if(id==="cone"||id==="cylinder"){
    const radius=length/2;
    const ring=(z:number)=>Array.from({length:17},(_,i)=>{
      const angle=2*Math.PI*i/16;
      return {x:radius*Math.cos(angle),y:radius*Math.sin(angle),z};
    });
    return [...ring(-h),...(id==="cylinder"?ring(h):[{x:0,y:0,z:h}])];
  }
  return [];
}

export function projectSolid(item:Item,rotationX:number,rotationY:number):ProjectedPoint[] {
  const points=solidWorldPoints(item);
  if(!points.length)return item.graphPoints??[];
  const [w,d,h]=dimensions(item);
  // Fixed normalization avoids jumps when orbiting and keeps all points inside the diagram.
  const extent=Math.max(1,Math.hypot(w,d,h));
  const zoom=8.0/extent;
  const yaw=rotationY*Math.PI/180,pitch=rotationX*Math.PI/180;
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);
  return points.map((point,i)=>{
    const u=point.x*cy-point.y*sy,v=point.x*sy+point.y*cy;
    return {
      x:Number((zoom*u).toFixed(5)),
      y:Number((zoom*(point.z*cx+v*sx)).toFixed(5)),
      label:item.graphPoints?.[i]?.label??"",
      color:item.graphPoints?.[i]?.color
    };
  });
}

export function projectSolidAxis(x:number,y:number,z:number,rotationX:number,rotationY:number):{x:number;y:number} {
  const yaw=rotationY*Math.PI/180,pitch=rotationX*Math.PI/180;
  const u=x*Math.cos(yaw)-y*Math.sin(yaw),v=x*Math.sin(yaw)+y*Math.cos(yaw);
  return {x:u,y:z*Math.cos(pitch)+v*Math.sin(pitch)};
}
