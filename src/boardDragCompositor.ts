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

export function canCompositeBoardDrag<T extends DragItemGeometry>(
  items:readonly T[], ids:ReadonlySet<string>,
):boolean{
  if(ids.size===0||ids.size>64)return false;
  for(const item of items){
    if(ids.has(item.id)&&item.kind==="connector")return false;
    if(item.kind==="connector"&&(
      item.connectorStartBinding&&ids.has(item.connectorStartBinding.itemId)||
      item.connectorEndBinding&&ids.has(item.connectorEndBinding.itemId)
    ))return false;
  }
  return true;
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
