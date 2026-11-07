import type { LiveInkMessage } from "./boardBroadcast";

export type InkPreviewRun = {
  // Absolute point index in the author's stroke. Separate runs never draw a
  // line across a missing network window.
  start: number;
  points: LiveInkMessage["points"];
};
export type LiveInkPreview = Omit<LiveInkMessage, "points"> & {
  runs: InkPreviewRun[];
  lastIndex: number;
};

const RUN_POINT_LIMIT = 500;
const MAX_PREVIEW_POINTS = 32000;

const fromPacket = (packet: LiveInkMessage, offset: number): LiveInkPreview => ({
  clientId: packet.clientId, userId: packet.userId, id: packet.id,
  kind: packet.kind, color: packet.color, weight: packet.weight,
  finished: packet.finished, offset,
  lastIndex: offset + packet.points.length - 1,
  runs: [{ start: offset, points: packet.points }],
});

/**
 * Reassemble short, overlapping broadcast windows without losing the start
 * of a long stroke. Network packets may be duplicated or arrive out of order.
 * A missing window creates a separate visible run, not a diagonal artefact.
 * The saved RLS-protected board document supersedes the preview.
 */
export function mergeLiveInkPreview(
  previous: LiveInkPreview | undefined, packet: LiveInkMessage,
): LiveInkPreview {
  // Old senders send complete snapshots (without an absolute point index).
  // Keep their established behavior rather than guessing how to join them.
  if (packet.offset === undefined) {
    if (previous?.finished && previous.clientId === packet.clientId) return previous;
    return fromPacket(packet, 0);
  }
  const offset = packet.offset;
  if (!Number.isSafeInteger(offset) || offset < 0 || !packet.points.length) {
    return previous ?? fromPacket({ ...packet, points: [], finished: false }, 0);
  }
  if (!previous || previous.clientId !== packet.clientId) return fromPacket(packet, offset);
  if (previous.finished) return previous;

  const end = offset + packet.points.length - 1;
  // Old packets are not allowed to regress the displayed stroke or mark an
  // incomplete version of it final.
  if (end < previous.lastIndex) return previous;
  if (end === previous.lastIndex) {
    return packet.finished ? { ...previous, finished: true } : previous;
  }

  const runs = previous.runs.slice();
  const last = runs[runs.length - 1];
  if (offset > previous.lastIndex) {
    // No shared point: never draw a fake line across the dropped packets.
    runs.push({ start: offset, points: packet.points });
  } else {
    // Keep the last already displayed point as the join anchor. The redundant
    // overlapping window is not drawn a second time.
    const continuation = packet.points.slice(previous.lastIndex - offset);
    if (last && last.start + last.points.length - 1 === previous.lastIndex &&
        last.points.length + continuation.length - 1 <= RUN_POINT_LIMIT) {
      runs[runs.length - 1] = {
        start: last.start,
        points: last.points.concat(continuation.slice(1)),
      };
    } else {
      runs.push({ start: previous.lastIndex, points: continuation });
    }
  }
  // Bound transient memory on pathological multi-minute strokes. Durable ink
  // still contains the whole path and is never trimmed by this preview cache.
  while (runs.length > 1 && end - runs[0].start > MAX_PREVIEW_POINTS) runs.shift();
  return { ...previous, finished: packet.finished, lastIndex: end, runs };
}
