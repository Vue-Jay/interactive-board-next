/** A cheap, translation-only drag path for ordinary board widgets.
 * Heavy school worksheets may contain hundreds of DOM nodes, but moving
 * their outer board-object wrapper is a compositor operation.
 * Linked arrows need geometry recomputation, so they take the normal path.
 */
export type DragItemGeometry={
  id:string;kind:string;x:number;y:number;
  connectorStartBinding?:{itemId:string}|null;
  connectorEndBinding?:{itemId:string}|null;
};
type TranslateStyle={translate:string};
export type DragPreviewElement={style:TranslateStyle};
export type ConnectorDragPoint={x:number;y:number};
export type ConnectorDragGeometry=DragItemGeometry&{
 width:number;height:number;
 connectorStart?:ConnectorDragPoint|null;
 connectorEnd?:ConnectorDragPoint|null;
 connectorRouting?:string;
};
export type ConnectorDragShape={setAttribute(name:string,value:string):void};
export type ConnectorDragTarget<T extends ConnectorDragGeometry=ConnectorDragGeometry>={
 item:T;line?:ConnectorDragShape|null;path?:ConnectorDragShape|null;
 label?:ConnectorDragShape|null;
};
export type CompositeDragPlan={linked:Set<string>;deformed:Set<string>};

// One bound endpoint can move independently: update only that connector's
// SVG coordinates during the gesture. No full React board render is needed.
export function planCompositeBoardDrag<T extends DragItemGeometry>(
  items:readonly T[],ids:ReadonlySet<string>,
):CompositeDragPlan|null{
  if(ids.size===0||ids.size>64)return null;
  const linked=new Set<string>(),deformed=new Set<string>();
  for(const item of items){
    // Ink uses a raster layer; geometry instruments use a separate portal.
    if(ids.has(item.id)&&
      (item.kind==="connector"||item.kind==="pen"||
       item.kind==="marker"||item.kind==="instrument"))return null;
    if(item.kind!=="connector")continue;
    const movingStart=!!item.connectorStartBinding&&ids.has(item.connectorStartBinding.itemId);
    const movingEnd=!!item.connectorEndBinding&&ids.has(item.connectorEndBinding.itemId);
    if(movingStart&&movingEnd)linked.add(item.id);
    else if(movingStart!==movingEnd)deformed.add(item.id);
    if(ids.size+linked.size+deformed.size>64)return null;
  }
  return {linked,deformed};
}

// Retained for users that only support rigid connector translation.
export function compositeLinkedConnectorIds<T extends DragItemGeometry>(
  items:readonly T[],ids:ReadonlySet<string>,
):Set<string>|null{
  const plan=planCompositeBoardDrag(items,ids);
  return plan&&!plan.deformed.size?plan.linked:null;
}

export function canCompositeBoardDrag<T extends DragItemGeometry>(
  items:readonly T[],ids:ReadonlySet<string>,
):boolean{
  return planCompositeBoardDrag(items,ids)!==null;
}

/** Local coordinates remain relative to the original SVG viewport. The
 * connector's CSS overflow is visible, so both moving and fixed endpoints
 * remain exact, including when a drag crosses the original viewport edge.
 * The released document is still normalized by syncBoundConnectors().
 */
export function connectorDragEndpoints<T extends ConnectorDragGeometry>(
  item:T,ids:ReadonlySet<string>,dx:number,dy:number,
):{start:ConnectorDragPoint;end:ConnectorDragPoint}{
  const start={
    x:item.connectorStart?.x??12,
    y:item.connectorStart?.y??item.height/2,
  };
  const end={
    x:item.connectorEnd?.x??item.width-12,
    y:item.connectorEnd?.y??item.height/2,
  };
  if(item.connectorStartBinding&&ids.has(item.connectorStartBinding.itemId)){
    start.x+=dx;start.y+=dy;
  }
  if(item.connectorEndBinding&&ids.has(item.connectorEndBinding.itemId)){
    end.x+=dx;end.y+=dy;
  }
  return {start,end};
}

/** Change only line/path geometry and label. Marker defs, styling and wrapper
 * position are stable; reverting with (0,0) is safe even after cancellation.
 */
export function paintBoardDeformedConnector<T extends ConnectorDragGeometry>(
  target:ConnectorDragTarget<T>,ids:ReadonlySet<string>,dx:number,dy:number,
):void{
  const {start,end}=connectorDragEndpoints(target.item,ids,dx,dy);
  if(target.path){
    target.path.setAttribute("d",
      `M ${start.x} ${start.y} H ${(start.x+end.x)/2} V ${end.y} H ${end.x}`);
  }else if(target.line){
    target.line.setAttribute("x1",String(start.x));
    target.line.setAttribute("y1",String(start.y));
    target.line.setAttribute("x2",String(end.x));
    target.line.setAttribute("y2",String(end.y));
  }
  target.label?.setAttribute("transform",
    `translate(${(start.x+end.x)/2} ${(start.y+end.y)/2})`);
}

/** Rigid single-object rotation can be drawn without reconstructing its
 * potentially complex React subtree. A bound arrow uses the normal path:
 * rotating its anchor should never leave a detached visual preview.
 */
export function canCompositeBoardRotation<T extends DragItemGeometry>(
  items:readonly T[],id:string,
):boolean{
  if(!id)return false;
  let target=false;
  for(const item of items){
    if(item.id===id){
      if(["connector","pen","marker","instrument"].includes(item.kind))return false;
      target=true;
    }
    if(item.kind==="connector"&&
      (item.connectorStartBinding?.itemId===id||
       item.connectorEndBinding?.itemId===id))return false;
  }
  return target;
}

export function paintBoardRotationPreview(
  element:{style:{rotate:string}},outline:{style:{rotate:string}}|null,
  delta:number,
):void{
  const rotation=`${delta}deg`;
  element.style.rotate=rotation;
  if(outline)outline.style.rotate=rotation;
}
export function clearBoardRotationPreview(
  element:{style:{rotate:string}},outline:{style:{rotate:string}}|null,
):void{
  element.style.rotate="";
  if(outline)outline.style.rotate="";
}

export function translatedBoardDragItems<T extends DragItemGeometry>(
  items:readonly T[],ids:ReadonlySet<string>,dx:number,dy:number,
):T[]{
  return items.map(item=>ids.has(item.id)
    ? {...item,x:item.x+dx,y:item.y+dy}:item);
}

export function paintBoardDragTranslation(
  elements:readonly DragPreviewElement[],selection:DragPreviewElement|null,
  dx:number,dy:number,zoom:number,
):void{
  const world=`${dx}px ${dy}px`;
  for(const element of elements)element.style.translate=world;
  if(selection)selection.style.translate=`${dx*zoom}px ${dy*zoom}px`;
}

export function clearBoardDragTranslation(
  elements:readonly DragPreviewElement[],selection:DragPreviewElement|null,
):void{
  for(const element of elements)element.style.translate="";
  if(selection)selection.style.translate="";
}
