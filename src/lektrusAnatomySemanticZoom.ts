/** Coordinate contracts for continuous human anatomy.
 * One world, one camera. Magnification never selects an unrelated frame.
 *
 * Body-local dimensions are always 360 x 600; detail resources register
 * their geometry to this world instead of resetting the camera.
 */
export type AnatomyWorldPoint={x:number;y:number};
export type AnatomyWorldRect={x:number;y:number;width:number;height:number};

export const SKIN_SHOULDER:AnatomyWorldRect={
 x:202,y:101,width:96,height:124
};
export const SKIN_SHOULDER_CENTER:AnatomyWorldPoint={x:250,y:163};
export const SKIN_MAX_SCALE=52;

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
 return Number.isFinite(p.x)&&Number.isFinite(p.y)&&
  p.x>=SKIN_SHOULDER.x&&p.x<=SKIN_SHOULDER.x+SKIN_SHOULDER.width&&
  p.y>=SKIN_SHOULDER.y&&p.y<=SKIN_SHOULDER.y+SKIN_SHOULDER.height;
}
/** A *surface* zoom never claims to reveal a cutaway automatically. */
export function skinDetailStage(scale:number):string{
 if(scale<1.8)return "Организм";
 if(scale<5.5)return "Кожа плеча";
 if(scale<11)return "Микрорельеф поверхности";
 if(scale<26)return "Поры и волосяные фолликулы";
 return "Роговые чешуйки эпидермиса · модель";
}
