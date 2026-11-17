import {isInkItem,type Item} from "./boardModel";
import {remoteInkRuns,type RemoteLiveInkPreview} from "./boardLiveInk";
import {eraseInkAlongPath} from "./inkEraser";

/** Visual-only cut fragments. Never commit these to the document or history.
 * Only cut original stroke IDs present when the remote gesture first arrived;
 * server-confirmed replacement fragments must not be erased a second time. */
export function previewRemoteErasures(items:Item[],previews:ReadonlyMap<string,RemoteLiveInkPreview>,targets:ReadonlyMap<string,ReadonlySet<string>>):Item[]{
  if(!previews.size)return items;
  const cuts=Array.from(previews,([id,preview])=>({preview,targets:targets.get(id),runs:remoteInkRuns(preview).map(run=>{
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const p of run.points){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
    const padding=preview.weight/2+50;
    return {...run,minX:minX-padding,minY:minY-padding,maxX:maxX+padding,maxY:maxY+padding};
  })})).filter(cut=>cut.preview.kind==="eraser"&&!cut.preview.cancelled&&cut.targets?.size);
  if(!cuts.length)return items;
  return items.flatMap(item=>{
    if(!isInkItem(item))return [item];
    let fragments=[item];
    for(const cut of cuts){
      if(!cut.targets?.has(item.id))continue;
      for(const run of cut.runs){
        if(item.x>run.maxX||item.x+item.width<run.minX||item.y>run.maxY||item.y+item.height<run.minY)continue;
        fragments=eraseInkAlongPath(fragments,run.points,cut.preview.weight/2);
      }
    }
    return fragments.length===1&&fragments[0]===item?[item]:fragments.map((part,index)=>({...part,id:`${item.id}:remote-erase:${index}`}));
  });
}
