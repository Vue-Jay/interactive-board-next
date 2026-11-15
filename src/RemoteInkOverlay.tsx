import { memo, useMemo, useSyncExternalStore } from "react";
import { remoteInkRuns, type RemoteInkStore, type RemoteLiveInkPreview } from "./boardLiveInk";

// Positions stay in world coordinates, so camera motion doesn't rebuild long
// polyline strings. Unchanged peer strokes retain their memoized SVG elements.
const RemoteInkStroke=memo(function RemoteInkStroke({ink,zoom}:{ink:RemoteLiveInkPreview;zoom:number}){
  const opacity=ink.kind==="marker"?0.32:1;
  const runs=useMemo(()=>remoteInkRuns(ink).map(run=>({...run,coordinates:run.points.length===1?"":run.points.map(point=>`${point.x},${point.y}`).join(" ")})),[ink]);
  return <>{runs.map(run=>run.points.length===1
    ? <circle key={ink.id+":"+run.offset} cx={run.points[0].x} cy={run.points[0].y} r={Math.max(0.5/zoom,ink.weight/2)} fill={ink.color} opacity={opacity}/>
    : <polyline key={ink.id+":"+run.offset} points={run.coordinates} fill="none" stroke={ink.color} strokeWidth={ink.weight} strokeLinecap="round" strokeLinejoin="round" opacity={opacity}/>
  )}</>;
});

export const RemoteInkOverlay=memo(function RemoteInkOverlay({store,persistedItemIds,x,y,zoom}:{
  store:RemoteInkStore;persistedItemIds:ReadonlySet<string>;x:number;y:number;zoom:number;
}){
  const inkSnapshot=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
  return <svg className="remote-live-ink-layer" width="100%" height="100%" style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
    <g transform={`translate(${x} ${y}) scale(${zoom})`}>
      {Array.from(inkSnapshot.values(),ink=>!persistedItemIds.has(ink.id)
        ? <RemoteInkStroke key={ink.id} ink={ink} zoom={zoom}/>:null)}
    </g>
  </svg>;
});
