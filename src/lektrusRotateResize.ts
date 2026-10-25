/** Resize geometry shared by every board object and grouped selections.
 * Drag directions are in local axes. Rotated objects keep the opposite
 * handle fixed in WORLD coordinates instead of moving backwards or mirroring.
 */
export type ResizeBounds={x:number;y:number;width:number;height:number};

export function resizedRect(
 base:ResizeBounds,handle:string,dx:number,dy:number,
 minW:number,minH:number,keepRatio:boolean
):ResizeBounds{
 const east=handle.includes("e"),west=handle.includes("w");
 const north=handle.includes("n"),south=handle.includes("s");
 const fixedRight=base.x+base.width,fixedBottom=base.y+base.height;
 let width=base.width,height=base.height;
 if(east)width=Math.max(minW,base.width+dx);
 if(west)width=Math.max(minW,base.width-dx);
 if(south)height=Math.max(minH,base.height+dy);
 if(north)height=Math.max(minH,base.height-dy);
 if(keepRatio&&(north||south)&&(east||west)){
  const ratio=base.width/Math.max(1,base.height);
  // Follow whichever component of the diagonal moved farther, measured
  // in normalized coordinates. Both dimensions remain positive.
  if(Math.abs(width-base.width)>=Math.abs(height-base.height)*ratio)
   height=Math.max(minH,width/ratio);
  else width=Math.max(minW,height*ratio);
 }
 return {
  x:west?fixedRight-width:base.x,
  y:north?fixedBottom-height:base.y,
  width,height
 };
}

export function preserveRotatedAnchor(
 base:ResizeBounds,next:ResizeBounds,rotationDegrees:number
):ResizeBounds{
 if(!rotationDegrees)return next;
 const angle=rotationDegrees*Math.PI/180;
 const cosine=Math.cos(angle),sine=Math.sin(angle);
 // The unrotated resizer's center moves in local axes. Rotate that shift
 // around the existing object's center, keeping its opposite grip fixed.
 const localX=next.x+next.width/2-(base.x+base.width/2);
 const localY=next.y+next.height/2-(base.y+base.height/2);
 const cx=base.x+base.width/2+localX*cosine-localY*sine;
 const cy=base.y+base.height/2+localX*sine+localY*cosine;
 return {x:cx-next.width/2,y:cy-next.height/2,width:next.width,height:next.height};
}
