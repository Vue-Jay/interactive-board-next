/** Keep the stored rectangle center compatible with existing boards, but
 * rotate protractors around the engraved midpoint of their baseline. */
type Pose={x:number;y:number;rotation:number};
export function instrumentPivot(pose:Pose,type:string,scale:number){
  const offset=type==="protractor"?(191-205/2)*scale:0;
  const radians=pose.rotation*Math.PI/180;
  return {x:pose.x-offset*Math.sin(radians),y:pose.y+offset*Math.cos(radians)};
}
export function rotateInstrumentAboutPivot(pose:Pose,type:string,scale:number,rotation:number):Pose{
  const fixed=instrumentPivot(pose,type,scale);
  const offset=instrumentPivot({x:0,y:0,rotation},type,scale);
  return {x:fixed.x-offset.x,y:fixed.y-offset.y,rotation};
}
