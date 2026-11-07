import type { LiveInkMessage } from "./boardBroadcast";

// The peer gets a sliding window from the sender, not the entire stroke on
// each network packet. Rebuild a continuous, bounded visual preview by point
// index. The actual saved board document remains authoritative.
export const MAX_REMOTE_LIVE_INK_POINTS=4000;

export function mergeRemoteLiveInk(
  previous:LiveInkMessage|undefined,
  incoming:LiveInkMessage
):LiveInkMessage {
  // Older clients do not send indices. Preserve their original behavior
  // instead of guessing an overlap and drawing a false connecting segment.
  if(incoming.offset===undefined || !Number.isSafeInteger(incoming.offset) ||
     incoming.offset<0 || !previous || previous.offset===undefined ||
     !Number.isSafeInteger(previous.offset)) return incoming;
  if(previous.finished && !incoming.finished) return previous;
  const oldStart=previous.offset;
  const oldEnd=oldStart+previous.points.length;
  const nextStart=incoming.offset;
  const nextEnd=nextStart+incoming.points.length;
  if(nextEnd<oldEnd)return previous; // An older packet must not pull the stroke backwards.
  if(nextStart>oldEnd){
    // A dropped window must not be bridged with a fabricated diagonal line.
    // The authenticated final document will restore any missing segment.
    return incoming;
  }
  if(nextStart<oldStart){
    const retained=incoming.points.slice(-MAX_REMOTE_LIVE_INK_POINTS);
    return {...incoming,points:retained,offset:nextEnd-retained.length};
  }
  const preceding=previous.points.slice(0,nextStart-oldStart);
  const combined=preceding.concat(incoming.points);
  const trim=Math.max(0,combined.length-MAX_REMOTE_LIVE_INK_POINTS);
  return {...incoming,points:trim?combined.slice(trim):combined,offset:oldStart+trim};
}
