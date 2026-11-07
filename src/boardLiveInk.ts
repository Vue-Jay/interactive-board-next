import type { LiveInkMessage } from "./boardBroadcast";

// The RLS-protected saved board stays authoritative. Preview windows from
// Realtime may be duplicated, reordered or missing on an unstable connection.
export const MAX_REMOTE_LIVE_INK_POINTS=4000;

export type RemoteInkRun={
  offset:number;
  points:LiveInkMessage["points"];
};
export type RemoteLiveInkPreview=LiveInkMessage&{
  // Earlier disjoint fragments stay visible when a network packet is lost.
  // Never draw a synthetic line across a gap between independent runs.
  priorRuns?:RemoteInkRun[];
};

export function remoteInkRuns(preview:RemoteLiveInkPreview):RemoteInkRun[]{
  const current={offset:preview.offset??0,points:preview.points};
  return preview.priorRuns?.length?[...preview.priorRuns,current]:[current];
}

/** Merge visible point ranges by absolute stroke index.
 * Adjacent and overlapping packets are joined; genuinely missing ranges stay
 * separate until an out-of-order packet or final window fills the gap. The
 * total retained points remain bounded, including disconnected fragments.
 */
export function mergeRemoteLiveInk(
  previous:RemoteLiveInkPreview|undefined,
  incoming:LiveInkMessage,
):RemoteLiveInkPreview {
  // Older clients do not transmit indices. Preserve their original
  // replacement semantics rather than guessing the position of a window.
  if(incoming.offset===undefined||!Number.isSafeInteger(incoming.offset)||
     incoming.offset<0||!incoming.points.length||!previous||
     previous.offset===undefined||!Number.isSafeInteger(previous.offset)||
     previous.clientId!==incoming.clientId)return incoming;
  if(previous.finished)return previous;

  const nextStart=incoming.offset,nextEnd=nextStart+incoming.points.length;
  const previousRuns=remoteInkRuns(previous);
  const oldEnd=previous.offset+previous.points.length;
  // All points from this packet are already present, so a delayed or
  // duplicate preview must not schedule a React repaint.
  if(previousRuns.some(run=>run.offset<=nextStart&&
      run.offset+run.points.length>=nextEnd)){
    return incoming.finished&&nextEnd>=oldEnd
      ? {...previous,finished:true} : previous;
  }

  const ranges=[...previousRuns,{offset:nextStart,points:incoming.points}]
    .sort((a,b)=>a.offset-b.offset);
  const joined:RemoteInkRun[]=[];
  for(const range of ranges){
    const last=joined[joined.length-1];
    if(!last||range.offset>last.offset+last.points.length){
      joined.push({offset:range.offset,points:range.points});
      continue;
    }
    const overlap=last.offset+last.points.length-range.offset;
    if(overlap<range.points.length){
      joined[joined.length-1]={
        offset:last.offset,points:last.points.concat(range.points.slice(overlap))
      };
    }
  }

  // Trim the oldest preview points, not the newest ones. Full history belongs
  // to the durable document, while visual previews must not exhaust RAM.
  let count=joined.reduce((total,run)=>total+run.points.length,0);
  while(count>MAX_REMOTE_LIVE_INK_POINTS){
    const first=joined[0],excess=count-MAX_REMOTE_LIVE_INK_POINTS;
    if(first.points.length<=excess){count-=first.points.length;joined.shift()}
    else{
      joined[0]={offset:first.offset+excess,points:first.points.slice(excess)};
      count-=excess;
    }
  }
  const latest=joined[joined.length-1];
  return {...previous,offset:latest.offset,points:latest.points,
    priorRuns:joined.length>1?joined.slice(0,-1):undefined,
    finished:incoming.finished&&nextEnd>=oldEnd};
}
