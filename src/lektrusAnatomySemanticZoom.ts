/** Spatial, reusable anatomy LOD primitives.
 *
 * Coordinates below are on the original 360x600 anatomical body plate.
 * A node is an educational rendering of a registered region, not a claim
 * that histological/cutaway imagery is a literal optical enlargement.
 * Only the skin/shoulder route is populated in this first pilot.
 */
export type AnatomyWorldPoint={x:number;y:number};
export type AnatomyWorldRect={x:number;y:number;width:number;height:number};
export type AnatomySourceKind="regional-image"|"virtual-section"|"tissue-image"|"procedural-surface";

export type AnatomyDetailNode={
 id:string;
 parentId:string;
 systemId:"integumentary";
 source:AnatomySourceKind;
 /** Atlas cell for raster sources, null for reusable procedural details. */
 sourceIndex:number|null;
 anchor:AnatomyWorldPoint;
 width:number;
 height:number;
 /** Smooth visibility [appear, opaque, begin fade-out, disappear]. */
 scaleWindow:readonly [number,number,number,number];
 provenance:"atlas-reconstruction";
};
/** An index of content nodes, not a list of individual zoom frames. */
export const SKIN_SHOULDER:AnatomyWorldRect={x:202,y:101,width:96,height:124};
export const SKIN_SHOULDER_CENTER:AnatomyWorldPoint={x:250,y:163};
export const SKIN_MAX_SCALE=52;
export const SKIN_DETAIL_ATLAS={columns:3,tileWidth:900,tileHeight:900} as const;
export const SKIN_DETAIL_NODES:readonly AnatomyDetailNode[]=[
 {id:"human.skin.shoulder.region",parentId:"human.skin.shoulder",
  systemId:"integumentary",source:"regional-image",sourceIndex:0,
  anchor:SKIN_SHOULDER_CENTER,width:188,height:188,
  scaleWindow:[1.45,2.8,6.8,11.6],provenance:"atlas-reconstruction"},
 {id:"human.skin.shoulder.pores",parentId:"human.skin.shoulder.region",
  systemId:"integumentary",source:"procedural-surface",sourceIndex:null,
  anchor:SKIN_SHOULDER_CENTER,width:105,height:105,
  scaleWindow:[3.5,5.8,9.5,14],provenance:"atlas-reconstruction"},
 {id:"human.skin.shoulder.section",parentId:"human.skin.shoulder.region",
  systemId:"integumentary",source:"virtual-section",sourceIndex:1,
  anchor:SKIN_SHOULDER_CENTER,width:59,height:59,
  scaleWindow:[9.2,13.2,22.5,31],provenance:"atlas-reconstruction"},
 {id:"human.skin.shoulder.tissue",parentId:"human.skin.shoulder.section",
  systemId:"integumentary",source:"tissue-image",sourceIndex:2,
  anchor:SKIN_SHOULDER_CENTER,width:26,height:26,
  scaleWindow:[24,34,SKIN_MAX_SCALE,SKIN_MAX_SCALE],provenance:"atlas-reconstruction"}
] as const;

export const finiteClamp=(n:number,min:number,max:number)=>
 Math.min(max,Math.max(min,Number.isFinite(n)?n:min));
const smooth=(a:number,b:number,x:number)=>{
 if(a===b)return x>=a?1:0;
 const t=finiteClamp((x-a)/(b-a),0,1);
 return t*t*(3-2*t);
};
export function anatomyDetailOpacity(scale:number,window:readonly [number,number,number,number]):number{
 const [appear,full,fade,hidden]=window;
 const enter=smooth(appear,full,scale);
 return hidden===fade?enter:enter*(1-smooth(fade,hidden,scale));
}
export function skinAvailableAt(p:AnatomyWorldPoint):boolean{
 return Number.isFinite(p.x)&&Number.isFinite(p.y)&&
  p.x>=SKIN_SHOULDER.x&&p.x<=SKIN_SHOULDER.x+SKIN_SHOULDER.width&&
  p.y>=SKIN_SHOULDER.y&&p.y<=SKIN_SHOULDER.y+SKIN_SHOULDER.height;
}
export function anatomyBodyFit(stageWidth:number,stageHeight:number){
 const width=Math.max(1,stageWidth),height=Math.max(1,stageHeight);
 const fittedHeight=Math.min(height*.96,560,width*.90*600/360);
 return {width:fittedHeight*360/600,height:fittedHeight,
  pixelPerWorld:fittedHeight/600};
}
export function anatomyBodyToScreen(
 camera:{scale:number;panX:number;panY:number},point:AnatomyWorldPoint,
 stageWidth:number,stageHeight:number):AnatomyWorldPoint{
 const fit=anatomyBodyFit(stageWidth,stageHeight);
 return {x:stageWidth/2+camera.panX+(point.x-180)*fit.pixelPerWorld*camera.scale,
  y:stageHeight/2+camera.panY+(point.y-300)*fit.pixelPerWorld*camera.scale};
}
export function anatomyScreenToBody(
 camera:{scale:number;panX:number;panY:number},point:AnatomyWorldPoint,
 stageWidth:number,stageHeight:number):AnatomyWorldPoint{
 const fit=anatomyBodyFit(stageWidth,stageHeight);
 const factor=Math.max(1e-7,fit.pixelPerWorld*camera.scale);
 return {x:180+(point.x-stageWidth/2-camera.panX)/factor,
  y:300+(point.y-stageHeight/2-camera.panY)/factor};
}
export function anatomyCameraAtBody(
 point:AnatomyWorldPoint,scale:number,stageWidth:number,stageHeight:number){
 const fit=anatomyBodyFit(stageWidth,stageHeight);
 return {scale,panX:-(point.x-180)*fit.pixelPerWorld*scale,
  panY:-(point.y-300)*fit.pixelPerWorld*scale};
}
/** The parent body fades only when the registered child occupies the field
 * of view. Elsewhere the original body plate remains visible rather than
 * replacing an abdomen with a shoulder cross-section. */
export function skinNodeVisibleInViewport(
 node:AnatomyDetailNode,camera:{scale:number;panX:number;panY:number},
 width:number,height:number):boolean{
 const p=anatomyBodyToScreen(camera,node.anchor,width,height);
 const pixels=anatomyBodyFit(width,height).pixelPerWorld*camera.scale;
 const halfW=node.width*pixels/2,halfH=node.height*pixels/2;
 return p.x+halfW>=0&&p.x-halfW<=width&&
  p.y+halfH>=0&&p.y-halfH<=height;
}
export function skinDetailStage(scale:number):string{
 if(scale<1.8)return "Организм";
 if(scale<5.5)return "Кожа плеча";
 if(scale<11)return "Микрорельеф поверхности";
 if(scale<26)return "Поры и волосяные фолликулы";
 return "Роговые чешуйки эпидермиса · модель";
}
/** Deterministic reusable micro-surface locations, independent of
 * number of zoom events. The template can be shared by other regions. */
export function skinSurfacePores(seed=1049,count=240){
 let state=seed>>>0;
 const random=()=>{
  state=(Math.imul(1664525,state)+1013904223)>>>0;
  return state/4294967296;
 };
 return Array.from({length:count},()=>({
  x:random(),y:random(),radius:.3+random()*.55,
  intensity:.12+random()*.23
 }));
}
