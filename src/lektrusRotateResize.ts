/** Resize geometry shared by every board object and grouped selections.
 * Drag directions are in local axes. Rotated objects keep the opposite
 * handle fixed in WORLD coordinates instead of moving backwards or mirroring.
 */
export type ResizeBounds={x:number;y:number;width:number;height:number};

/** Fit source pixels into the initial board frame using one scale, regardless
 * of file format, orientation or the dimensions of a very narrow image. */
export function initialImageSize(width:number,height:number){
 const scale=Math.min(420/width,320/height,Math.max(1,120/width,80/height));
 return {width:width*scale,height:height*scale};
}

/** Images always scale proportionally. Side grips preserve the opposite edge
 * midpoint; corner grips preserve the diagonally opposite corner. */
export function resizedImageRect(base:ResizeBounds,handle:string,dx:number,dy:number,ratio=base.width/base.height):ResizeBounds{
 const east=handle.includes("e"),west=handle.includes("w"),north=handle.includes("n"),south=handle.includes("s");
 const horizontal=east||west,vertical=north||south;
 const w=base.width+(east?dx:west?-dx:0),h=base.height+(south?dy:north?-dy:0);
 const useWidth=horizontal&&(!vertical||Math.abs(dx)>=Math.abs(dy)*ratio);
 // The longer side must remain usable without squashing very tall/wide files.
 const width=Math.max(24*Math.min(1,ratio),useWidth?w:h*ratio),height=width/ratio;
 return {x:west?base.x+base.width-width:east?base.x:base.x+(base.width-width)/2,
  y:north?base.y+base.height-height:south?base.y:base.y+(base.height-height)/2,width,height};
}

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
