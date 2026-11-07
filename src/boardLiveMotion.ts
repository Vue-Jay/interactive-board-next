import type { Item, Point } from "./boardModel";

// Ephemeral geometry is display-only. Only the board-document RPC may persist it.
export const LIVE_MOTION_LIMIT = 64;
export type LiveBoardGeometry = Pick<Item, "id" | "x" | "y" | "width" | "height"> & {
 rotation: number;
 connectorStart?: Point;
 connectorEnd?: Point;
};
export type BoardTransformPhase = "move" | "finish" | "cancel";
export type BoardTransformMessage = {
 clientId: string; userId: string; sequence: number;
 phase: BoardTransformPhase; items: LiveBoardGeometry[];
};
export type RemoteLiveGeometry = LiveBoardGeometry & {
 clientId: string; sequence: number; updatedAt: number; final: boolean;
};

const bounded = (value: unknown, limit = 1_000_000) =>
 typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;
const pointValid = (point: unknown): point is Point =>
 !!point && typeof point === "object" &&
 bounded((point as Point).x) && bounded((point as Point).y);

export function validLiveGeometry(geometry: unknown): geometry is LiveBoardGeometry {
 if (!geometry || typeof geometry !== "object") return false;
 const value = geometry as LiveBoardGeometry;
 return typeof value.id === "string" && value.id.length > 0 && value.id.length <= 128 &&
  bounded(value.x) && bounded(value.y) &&
  bounded(value.width) && value.width > 0 &&
  bounded(value.height) && value.height > 0 &&
  bounded(value.rotation, 36_000) &&
  (value.connectorStart === undefined || pointValid(value.connectorStart)) &&
  (value.connectorEnd === undefined || pointValid(value.connectorEnd));
}

export function captureLiveGeometry(items: readonly Item[], ids: readonly string[]): LiveBoardGeometry[] {
 if (!ids.length || ids.length > LIVE_MOTION_LIMIT) return [];
 const selected = new Set(ids);
 const geometry: LiveBoardGeometry[] = [];
 for (const item of items) {
  if (!selected.has(item.id)) continue;
  const entry: LiveBoardGeometry = {
   id: item.id, x: item.x, y: item.y, width: item.width,
   height: item.height, rotation: item.rotation ?? 0,
   ...(item.kind === "connector" ? {
    connectorStart: item.connectorStart,
    connectorEnd: item.connectorEnd,
   } : {}),
  };
  if (!validLiveGeometry(entry)) return [];
  geometry.push(entry);
 }
 return geometry.length === selected.size ? geometry : [];
}

export function sameLiveGeometry(item: Item | undefined, preview: LiveBoardGeometry): boolean {
 if (!item) return false;
 const near = (a: number, b: number) => Math.abs(a-b) < 0.15;
 const pointMatches = (a?: Point,b?: Point) => a === undefined && b === undefined ||
  !!a && !!b && near(a.x,b.x) && near(a.y,b.y);
 return near(item.x,preview.x) && near(item.y,preview.y) &&
  near(item.width,preview.width) && near(item.height,preview.height) &&
  near((((item.rotation ?? 0)-preview.rotation)%360+540)%360,180) &&
  pointMatches(item.connectorStart,preview.connectorStart) &&
  pointMatches(item.connectorEnd,preview.connectorEnd);
}

// Later packets contain only a bounded trailing window of one continuous stroke.
// Stitch overlapping windows by their original point index so long handwriting
// never loses its beginning before the authoritative document is saved.
export function mergeLiveInkPreview<T extends {
 id: string; clientId: string; points: Point[]; startIndex?: number; finished: boolean
}>(previous: T | undefined, incoming: T): T {
 const start = incoming.startIndex;
 if (!previous || previous.clientId !== incoming.clientId ||
     !Number.isSafeInteger(start) || start! < 0) return incoming;
 if (start === 0) return incoming.points.length >= previous.points.length ? incoming : previous;
 if (start! > previous.points.length) return previous; // Missing network window; do not invent a line.
 const overlap = Math.min(previous.points.length-start!,incoming.points.length);
 for (let i=0;i<overlap;i++) {
  const old=previous.points[start!+i], next=incoming.points[i];
  if (!old || old.x !== next.x || old.y !== next.y) return previous;
 }
 if(start!+incoming.points.length<previous.points.length)return previous;
 const points = previous.points.slice(0,start!).concat(incoming.points);
 return { ...incoming, points };
}
