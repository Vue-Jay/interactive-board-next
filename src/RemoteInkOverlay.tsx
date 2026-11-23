import { memo, useMemo, useSyncExternalStore } from "react";
import { remoteInkRuns, type RemoteInkStore, type RemoteLiveInkPreview } from "./boardLiveInk";
import {stroke} from "./boardModel";
import {previewRemoteErasures} from "./remoteEraserPreview";
import {inkTouchesEraser} from "./inkEraser";

type Erasures=ReadonlyMap<string,RemoteLiveInkPreview>;
type EraseTargets=ReadonlyMap<string,ReadonlySet<string>>;

// Positions stay in world coordinates, so camera motion doesn't rebuild long
// polyline strings. Unchanged peer strokes retain their memoized SVG elements.
const RemoteInkStroke=memo(function RemoteInkStroke({ink,zoom,erasures,eraseTargets}:{ink:RemoteLiveInkPreview;zoom:number;erasures?:Erasures;eraseTargets?:EraseTargets}){
  const opacity=ink.kind==="marker"?0.32:1;
  const runs=useMemo(()=>remoteInkRuns(ink).map(run=>({...run,coordinates:run.points.length===1?"":run.points.map(point=>`${point.x},${point.y}`).join(" ")})),[ink]);
  const visibleRuns=useMemo(()=>{
    if(!erasures?.size||!eraseTargets||ink.kind==="eraser"||![...erasures.keys()].some(id=>eraseTargets.get(id)?.has(ink.id)))return runs;
    // Even if packet loss split a still-live pen stroke into separate runs,
    // a whole-stroke eraser touching one run removes all runs of that ID.
    if([...erasures].some(([id,erase])=>erase.eraserMode==="stroke"&&!erase.cancelled&&eraseTargets.get(id)?.has(ink.id)&&
      (erase.cutIds?.includes(ink.id)||runs.some(run=>remoteInkRuns(erase).some(path=>inkTouchesEraser(stroke(ink.id,ink.kind as "pen"|"marker",run.points,ink.color,ink.weight),path.points,erase.weight/2))))))return [];
    return runs.flatMap<{offset:number|string;points:RemoteLiveInkPreview["points"];coordinates:string}>(run=>{
      const item=stroke(ink.id,ink.kind as "pen"|"marker",run.points,ink.color,ink.weight);
      const pieces=previewRemoteErasures([item],erasures,eraseTargets);
      if(pieces.length===1&&pieces[0]===item)return [run];
      return pieces.map((part,index)=>{
        const points=(part.points??[]).map(p=>({x:p.x+part.x,y:p.y+part.y}));
        return {offset:`${run.offset}:${index}`,points,coordinates:points.map(p=>`${p.x},${p.y}`).join(" ")};
      });
    });
  },[ink,runs,erasures,eraseTargets]);
  return <g opacity={opacity}>{visibleRuns.map(run=>run.points.length===1
    ? <circle key={ink.id+":"+run.offset} cx={run.points[0].x} cy={run.points[0].y} r={Math.max(0.5/zoom,ink.weight/2)} fill={ink.color}/>
    : <polyline key={ink.id+":"+run.offset} points={run.coordinates} fill="none" stroke={ink.color} strokeWidth={ink.weight} strokeLinecap="round" strokeLinejoin="round"/>
  )}</g>;
});

export const RemoteInkOverlay=memo(function RemoteInkOverlay({store,persistedItemIds,x,y,zoom,erasures,eraseTargets}:{
  store:RemoteInkStore;persistedItemIds:ReadonlySet<string>;x:number;y:number;zoom:number;erasures?:Erasures;eraseTargets?:EraseTargets;
}){
  const inkSnapshot=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
  return <svg className="remote-live-ink-layer" width="100%" height="100%" style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
    <g transform={`translate(${x} ${y}) scale(${zoom})`}>
      {Array.from(inkSnapshot.values(),ink=>!persistedItemIds.has(ink.id)
        ? <RemoteInkStroke key={ink.id} ink={ink} zoom={zoom} erasures={erasures} eraseTargets={eraseTargets}/>:null)}
    </g>
  </svg>;
});
