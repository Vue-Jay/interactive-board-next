/** Coordinate contracts for continuous human anatomy.
 * One world, one camera. Magnification never selects an unrelated frame.
 *
 * Body-local dimensions are always 360 x 600; detail resources register
 * their geometry to this world instead of resetting the camera.
 */
export type AnatomyWorldPoint={x:number;y:number};
export type AnatomyWorldRect={x:number;y:number;width:number;height:number};

/** Coordinate source: registered warm, gender-neutral skin figure (360x600).
 * The former {250,163} focus was on the wrong plate and often missed the arm.
 * These landmarks were verified on the actual figure alpha mask rather
 * than guessed from a different (blue-gray) atlas plate.
 */
export const SKIN_BODY_SIZE={width:360,height:600} as const;
/** The drawing is a 3× native-resolution plate in the SAME world; pixels
 * are samples of the same body, not another organism or independent stage.
 * In particular, a mouse focus at world (x,y) stays at (3x,3y) in the
 * high-res image at EVERY zoom level and for every selected system.
 */
export const SKIN_BODY_RASTER_SIZE={width:1080,height:1800} as const;
export const SKIN_BODY_RASTER_FACTOR=SKIN_BODY_RASTER_SIZE.width/SKIN_BODY_SIZE.width;
export function skinWorldToRaster(point:AnatomyWorldPoint):AnatomyWorldPoint{
 return {x:point.x*SKIN_BODY_RASTER_FACTOR,
  y:point.y*SKIN_BODY_RASTER_FACTOR};
}
export function skinRasterToWorld(point:AnatomyWorldPoint):AnatomyWorldPoint{
 return {x:point.x/SKIN_BODY_RASTER_FACTOR,
  y:point.y/SKIN_BODY_RASTER_FACTOR};
}
export const SKIN_SHOULDER:AnatomyWorldRect={
 x:226,y:148,width:56,height:68
};
export const SKIN_SHOULDER_CENTER:AnatomyWorldPoint={
 x:SKIN_SHOULDER.x+SKIN_SHOULDER.width/2,
 y:SKIN_SHOULDER.y+SKIN_SHOULDER.height/2
};
export const SKIN_BODY_LANDMARKS={
 headTop:{x:180,y:29},rightShoulder:SKIN_SHOULDER_CENTER,
 pelvis:{x:180,y:323},rightAnkle:{x:224,y:549}
} as const;
/** Digital camera ratio; microstructures are rendered only when visible. */
export const SKIN_MAX_SCALE=360;

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
/** Only this confirmed region has microtexture data at present. */
export function skinAvailableAt(p:AnatomyWorldPoint):boolean{
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;
 const r=SKIN_SHOULDER;
 const u=(p.x-(r.x+r.width/2))/(r.width/2);
 const v=(p.y-(r.y+r.height/2))/(r.height/2);
 // The deep-zoom activation region follows the deltoid/upper arm, not
 // the rectangular empty background beside the shoulder.
 return u*u+v*v<=1;
}
/** A *surface* zoom never claims to reveal a cutaway automatically. */
export function skinDetailStage(scale:number):string{
 if(scale<1.8)return "Организм";
 if(scale<12)return "Кожа · крупный план";
 if(scale<38)return "Мелкий рельеф поверхности";
 if(scale<170)return "Поры, волосяные фолликулы и гребни ладоней";
 return "Модель рогового слоя · цифровой масштаб";
}
