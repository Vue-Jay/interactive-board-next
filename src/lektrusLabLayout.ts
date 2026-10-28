/** Protected tabletop zones in percent of the shared laboratory object.
 * Saved logical coordinates remain stable when the scene art is redesigned. */
export const LAB_WORKSPACE={left:26,right:76,top:43,bottom:85} as const;
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const lerp=(min:number,max:number,t:number)=>min+(max-min)*t;
export function labDisplayPoint(point:{x:number;y:number},crowded=false){
 return {
  x:lerp(LAB_WORKSPACE.left,LAB_WORKSPACE.right,clamp((point.x-10)/80,0,1)),
  y:clamp(lerp(LAB_WORKSPACE.top,LAB_WORKSPACE.bottom,
   clamp((point.y-10)/80,0,1)),crowded?54:60,crowded?84:80)
 };
}
export function labLogicalPoint(point:{x:number;y:number}){
 return {
  x:clamp(10+80*(point.x-LAB_WORKSPACE.left)/(LAB_WORKSPACE.right-LAB_WORKSPACE.left),10,90),
  y:clamp(10+80*(point.y-LAB_WORKSPACE.top)/(LAB_WORKSPACE.bottom-LAB_WORKSPACE.top),10,90)
 };
}
export const isLabSink=(p:{x:number;y:number})=>p.x>=83&&p.y>=45&&p.y<=94;
export const isLabCupboard=(p:{x:number;y:number})=>p.x>=55&&p.x<80&&p.y>=8&&p.y<=41;
export const isLabWorktop=(p:{x:number;y:number})=>
 p.x>=LAB_WORKSPACE.left-5&&p.x<=LAB_WORKSPACE.right+5&&
 p.y>=LAB_WORKSPACE.top&&p.y<=LAB_WORKSPACE.bottom+6;
