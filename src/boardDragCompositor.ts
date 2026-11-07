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

// A connector follows a rigid translation only when BOTH attached ends move
// together. If just one endpoint follows, its line must be recomputed instead
// of translating the whole SVG (otherwise it detaches from the fixed endpoint).
export function compositeLinkedConnectorIds<T extends DragItemGeometry>(
  items:readonly T[],ids:ReadonlySet<string>,
):Set<string>|null{
  if(ids.size===0||ids.size>64)return null;
  const linked=new Set<string>();
  for(const item of items){
    // Ink may be rasterized; rulers use a separate screen-space portal.
    if(ids.has(item.id)&&["connector","pen","marker","instrument"].includes(item.kind))return null;
    if(item.kind!=="connector")continue;
    const movingStart=!!item.connectorStartBinding&&ids.has(item.connectorStartBinding.itemId);
    const movingEnd=!!item.connectorEndBinding&&ids.has(item.connectorEndBinding.itemId);
    if(movingStart!==movingEnd)return null;
    if(movingStart&&movingEnd)linked.add(item.id);
  }
  return ids.size+linked.size<=64?linked:null;
}

export function canCompositeBoardDrag<T extends DragItemGeometry>(
  items:readonly T[], ids:ReadonlySet<string>,
):boolean{
  return compositeLinkedConnectorIds(items,ids)!==null;
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
