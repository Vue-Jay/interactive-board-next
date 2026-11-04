/** Continuous world-space human explorer. Camera never changes between
 * specimen "pages": every depth is on the same anatomical anchor.
 * 960x640 is a normalized scene, not a distance or calibrated microscope.
 */
export const HUMAN_ATLAS_WIDTH=960;
export const HUMAN_ATLAS_HEIGHT=640;
export const HUMAN_ATLAS_MAX_DEPTH=4;
export type HumanPoint={x:number;y:number};
export type HumanCamera={depth:number;panX:number;panY:number};
export type HumanRegion="heart"|"lungs"|"brain"|"skin";
export const HUMAN_INITIAL_CAMERA:HumanCamera={depth:0,panX:0,panY:0};
export const HUMAN_ZOOM_LABELS=["Организм","Органы","Орган","Ткань","Клетка"] as const;
export const HUMAN_ORGAN_ANCHORS={
 heart:{x:483,y:194},
 lungs:{x:484,y:178},
 brain:{x:485,y:62}
} as const;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
export const humanScale=(depth:number)=>Math.pow(2.18,clamp(depth,0,HUMAN_ATLAS_MAX_DEPTH));
export const humanClampDepth=(depth:number)=>clamp(depth,0,HUMAN_ATLAS_MAX_DEPTH);
export function humanCameraBound(cam:HumanCamera):HumanCamera{
 const depth=humanClampDepth(cam.depth),scale=humanScale(depth);
 const hx=HUMAN_ATLAS_WIDTH*(scale-1)/2,hy=HUMAN_ATLAS_HEIGHT*(scale-1)/2;
 return {depth,panX:hx===0?0:clamp(cam.panX,-hx,hx),
  panY:hy===0?0:clamp(cam.panY,-hy,hy)};
}
export function humanProject(cam:HumanCamera,p:HumanPoint):HumanPoint{
 const scale=humanScale(cam.depth);
 return {x:HUMAN_ATLAS_WIDTH/2+(p.x-HUMAN_ATLAS_WIDTH/2)*scale+cam.panX,
         y:HUMAN_ATLAS_HEIGHT/2+(p.y-HUMAN_ATLAS_HEIGHT/2)*scale+cam.panY};
}
export function humanUnproject(cam:HumanCamera,p:HumanPoint):HumanPoint{
 const scale=humanScale(cam.depth);
 return {x:HUMAN_ATLAS_WIDTH/2+(p.x-HUMAN_ATLAS_WIDTH/2-cam.panX)/scale,
         y:HUMAN_ATLAS_HEIGHT/2+(p.y-HUMAN_ATLAS_HEIGHT/2-cam.panY)/scale};
}
/** The point underneath the mouse or pinch midpoint stays under it,
 * including between non-integer detail levels. */
export function humanZoomAt(cam:HumanCamera,depth:number,at:HumanPoint):HumanCamera{
 const point=humanUnproject(cam,at),s=humanScale(depth);
 return humanCameraBound({depth,
  panX:at.x-HUMAN_ATLAS_WIDTH/2-(point.x-HUMAN_ATLAS_WIDTH/2)*s,
  panY:at.y-HUMAN_ATLAS_HEIGHT/2-(point.y-HUMAN_ATLAS_HEIGHT/2)*s});
}
export function humanPan(cam:HumanCamera,dx:number,dy:number):HumanCamera{
 return humanCameraBound({...cam,panX:cam.panX+dx,panY:cam.panY+dy});
}
export function humanFocusAt(point:HumanPoint,depth=2):HumanCamera{
 const scale=humanScale(depth);
 return humanCameraBound({depth,
  panX:(HUMAN_ATLAS_WIDTH/2-point.x)*scale,
  panY:(HUMAN_ATLAS_HEIGHT/2-point.y)*scale});
}
export function humanBodyAt(p:HumanPoint):boolean{
 const x=Math.abs(p.x-482),y=p.y;
 if(y<14||y>626)return false;
 if(y<122)return x<35;
 if(y<288)return x<69||(y<370&&x<95);
 if(y<382)return x<77;
 return x<49;
}
/** The hand, scalp, shin and other unreviewed positions can still zoom:
 * they show explicitly identified generic skin, never an invented heart.
 * The three REVIEWED human organs use the existing five-step atlas paths. */
export function humanRegionAt(point:HumanPoint):HumanRegion{
 if(!humanBodyAt(point))return "skin";
 if(point.y<113)return "brain";
 if(point.y<247&&Math.abs(point.x-482)<24&&point.y>166)return "heart";
 if(point.y<253)return "lungs";
 return "skin";
}
export function humanRegionAnchor(region:HumanRegion,point:HumanPoint):HumanPoint{
 return region==="skin"?point:HUMAN_ORGAN_ANCHORS[region];
}
/** Smooth opacity for overlapping layers. Adjacent images coexist for
 * a meaningful period, rather than abruptly replacing one SVG with another.
 */
export function humanLayerOpacity(depth:number,index:number):number{
 if(index===0)return clamp((1.6-depth)/.8,0,1);
 if(index===4)return clamp((depth-3.15)/.65,0,1);
 const enter=clamp((depth-(index-.7))/.75,0,1);
 const exit=clamp(((index+1.05)-depth)/.75,0,1);
 return enter*exit;
}
export function humanVisibleField(cam:HumanCamera){
 const a=humanUnproject(cam,{x:0,y:0});
 const b=humanUnproject(cam,{x:HUMAN_ATLAS_WIDTH,y:HUMAN_ATLAS_HEIGHT});
 return {x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y};
}
