/** Resize previews for ordinary board objects.
 * Child widgets that compute internal geometry from React props stay on the
 * existing render path. Only CSS-layout-driven objects are eligible.
 */
export type ResizePreviewItem={
 id:string;kind:string;x:number;y:number;width:number;height:number;
 rotation?:number;points?:readonly unknown[];hidden?:boolean;commentTargetId?:string;
 connectorStartBinding?:{itemId:string}|null;
 connectorEndBinding?:{itemId:string}|null;
};
export type ResizePreviewView={x:number;y:number;zoom:number};
export type ResizePreviewStyle={left:string;top:string;width:string;height:string};
export type ResizePreviewTarget<T extends ResizePreviewItem>={
 base:T;element:{style:ResizePreviewStyle};
};
const resizeLayoutKinds=new Set([
 "text","sticky","shape","frame","comment","image"
]);

/** O(board size) once at gesture start. If a selected object requires
 * model-driven layout, or a connector depends on it, the original precise
 * rendering and anchor recalculation remain in charge.
 */
export function canCompositeBoardResize<T extends ResizePreviewItem>(
 items:readonly T[],ids:ReadonlySet<string>,
):boolean{
 if(ids.size===0||ids.size>64)return false;
 let found=0;
 for(const item of items){
  if(ids.has(item.id)){
   found++;
   if(item.points||item.hidden||!resizeLayoutKinds.has(item.kind))return false;
  }
  if(item.kind==="connector"&&(
   item.connectorStartBinding&&ids.has(item.connectorStartBinding.itemId)||
   item.connectorEndBinding&&ids.has(item.connectorEndBinding.itemId)))return false;
  // This separate SVG leader would remain at the old coordinates during a
  // DOM-only preview. Keep those cases on the geometry-driven React path.
  if(item.commentTargetId&&(ids.has(item.id)||ids.has(item.commentTargetId)))return false;
 }
 return found===ids.size;
}

export function resizePreviewBounds<T extends ResizePreviewItem>(
 items:readonly T[],
):{x:number;y:number;width:number;height:number}{
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const item of items){
  if(item.x<minX)minX=item.x;
  if(item.y<minY)minY=item.y;
  if(item.x+item.width>maxX)maxX=item.x+item.width;
  if(item.y+item.height>maxY)maxY=item.y+item.height;
 }
 return {x:minX,y:minY,width:maxX-minX,height:maxY-minY};
}

/** Keep the original CSS rotate and children intact. Width and height must
 * change as layout dimensions, not GPU scale, so text retains font size and
 * PDFs/images keep their normal responsive content sizing.
 */
export function paintBoardResizePreview<T extends ResizePreviewItem>(
 targets:readonly ResizePreviewTarget<T>[],poses:readonly T[],
 frame:{style:ResizePreviewStyle},view:ResizePreviewView,
):void{
 for(let i=0;i<targets.length;i++){
  const element=targets[i].element,pose=poses[i];
  element.style.left=`${pose.x}px`;
  element.style.top=`${pose.y}px`;
  element.style.width=`${pose.width}px`;
  element.style.height=`${pose.height}px`;
 }
 const b=resizePreviewBounds(poses);
 frame.style.left=`${b.x*view.zoom+view.x}px`;
 frame.style.top=`${b.y*view.zoom+view.y}px`;
 frame.style.width=`${b.width*view.zoom}px`;
 frame.style.height=`${b.height*view.zoom}px`;
}
