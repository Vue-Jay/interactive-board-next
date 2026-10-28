/** Coordinates on the shared bench remain 10..90; display coordinates are
 * projected into the clear central work surface. Shelves and washbasin must
 * never overlap an active vessel, even in boards saved before the redesign. */
export const LAB_WORKSPACE={left:31,right:73,top:57,bottom:91} as const;
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const lerp=(min:number,max:number,t:number)=>min+(max-min)*t;
export function labDisplayPoint(point:{x:number;y:number},crowded=false){
 return {
  x:lerp(LAB_WORKSPACE.left,LAB_WORKSPACE.right,clamp((point.x-10)/80,0,1)),
  // Reserve enough room for the whole glass outline, not just its centre.
  y:clamp(lerp(LAB_WORKSPACE.top,LAB_WORKSPACE.bottom,
   clamp((point.y-10)/80,0,1)),crowded?64:74,crowded?86:82)
 };
}
export function labLogicalPoint(point:{x:number;y:number}){
 return {
  x:clamp(10+80*(point.x-LAB_WORKSPACE.left)/(LAB_WORKSPACE.right-LAB_WORKSPACE.left),10,90),
  y:clamp(10+80*(point.y-LAB_WORKSPACE.top)/(LAB_WORKSPACE.bottom-LAB_WORKSPACE.top),10,90)
 };
}
export const isLabSink=(p:{x:number;y:number})=>p.x>=79.5&&p.y>=56&&p.y<=94;
export const isLabCupboard=(p:{x:number;y:number})=>p.x>=72.5&&p.y>=10&&p.y<54;
export const isLabWorktop=(p:{x:number;y:number})=>
 p.x>=LAB_WORKSPACE.left-2&&p.x<=LAB_WORKSPACE.right+2&&
 p.y>=LAB_WORKSPACE.top-3&&p.y<=LAB_WORKSPACE.bottom+3;
