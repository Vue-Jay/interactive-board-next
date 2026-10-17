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

/** Painter-sorted opaque surfaces for school solids.
 * Faces are regenerated from physical dimensions instead of reusing the sparse
 * editable wireframe vertices, so a cone/cylinder stays smooth while orbiting.
 */
export type SolidSurface={
  points:{x:number;y:number}[];
  depth:number; fill:string; outline:boolean;
};
export function projectSolidSurfaces(item:Item,rotationX:number,rotationY:number):SolidSurface[] {
  const id=item.graphFigureId;
  if(!isSolidFigure(id)||id==="sphere")return [];
  const [length,depth,height]=dimensions(item);
  const half=height/2;
  const faces:{vertices:SolidPoint[];outline:boolean}[]=[];
  const vertices=solidWorldPoints(item);
  const face=(indices:number[])=>faces.push({vertices:indices.map(i=>vertices[i]),outline:true});
  if(id==="cube"||id==="rectangular-prism"){
    [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].forEach(face);
  }else if(id==="prism"){
    [[0,2,1],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]].forEach(face);
  }else if(id==="pyramid"){
    [[0,3,2,1],[0,1,4],[1,2,4],[2,3,4],[3,0,4]].forEach(face);
  }else if(id==="triangular-pyramid"){
    [[0,2,1],[0,1,3],[1,2,3],[2,0,3]].forEach(face);
  }else if(id==="cylinder"||id==="cone"){
    const count=64,radius=length/2;
    const ring=(z:number)=>Array.from({length:count},(_,i)=>{
      const angle=i*2*Math.PI/count;
      return {x:radius*Math.cos(angle),y:radius*Math.sin(angle),z};
    });
    const bottom=ring(-half),top=id==="cylinder"?ring(half):[];
    // The outlines of the caps also describe the visible ellipse accurately.
    faces.push({vertices:[...bottom].reverse(),outline:true});
    if(id==="cylinder")faces.push({vertices:top,outline:true});
    for(let i=0;i<count;i++){
      const j=(i+1)%count;
      faces.push({vertices:id==="cylinder"?
        [bottom[i],bottom[j],top[j],top[i]]:
        [bottom[i],bottom[j],{x:0,y:0,z:half}],outline:false});
    }
  }
  const yaw=rotationY*Math.PI/180,pitch=rotationX*Math.PI/180;
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const extent=Math.max(1,Math.hypot(length,depth,height)),zoom=8/extent;
  const transform=(v:SolidPoint)=>{
    const x=v.x*cy-v.y*sy,t=v.x*sy+v.y*cy;
    return {x:x*zoom,y:(v.z*cp+t*sp)*zoom,depth:t*cp-v.z*sp};
  };
  const light={x:-.5,y:-.6,z:.85};
  const surfaces=faces.map((surface)=>{
    const vertices=surface.vertices;
    const a=vertices[0],b=vertices[1],c=vertices[2];
    const u={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z};
    const v={x:c.x-a.x,y:c.y-a.y,z:c.z-a.z};
    const n={x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x};
    const magnitude=Math.hypot(n.x,n.y,n.z)||1;
    const lambert=(n.x*light.x+n.y*light.y+n.z*light.z)/magnitude;
    const tone=Math.round(57+19*Math.max(0,lambert));
    const projection=vertices.map(transform);
    return {
      points:projection.map(p=>({x:p.x,y:p.y})),
      depth:projection.reduce((sum,p)=>sum+p.depth,0)/projection.length,
      fill:`hsl(211 58% ${tone}%)`,outline:surface.outline
    };
  });
  // Greater camera depth is farther away. Opaque near faces cover hidden edges.
  return surfaces.sort((a,b)=>b.depth-a.depth);
}
