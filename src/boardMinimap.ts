/** A single world-coordinate system for the board, the navigator and its pointer. */
export type MinimapRect = { x: number; y: number; width: number; height: number };
type View = { x: number; y: number; zoom: number };
type Size = { width: number; height: number };

export function minimapContentBounds(items: readonly (MinimapRect & { rotation?: number })[]): MinimapRect | null {
  if (!items.length) return null;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const item of items) {
    const angle = (item.rotation || 0) * Math.PI / 180;
    const w = Math.abs(item.width * Math.cos(angle)) + Math.abs(item.height * Math.sin(angle));
    const h = Math.abs(item.width * Math.sin(angle)) + Math.abs(item.height * Math.cos(angle));
    const cx = item.x + item.width / 2, cy = item.y + item.height / 2;
    left = Math.min(left, cx - w / 2); top = Math.min(top, cy - h / 2);
    right = Math.max(right, cx + w / 2); bottom = Math.max(bottom, cy + h / 2);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function minimapViewport(view: View, size: Size): MinimapRect | null {
  if (size.width <= 0 || size.height <= 0 || view.zoom <= 0) return null;
  return { x: -view.x / view.zoom, y: -view.y / view.zoom,
    width: size.width / view.zoom, height: size.height / view.zoom };
}

/** Always show both the content and the complete visible region, even when
 * the user has panned far away from every object. */
export function minimapExtent(content: MinimapRect | null, viewport: MinimapRect | null): MinimapRect {
  const a = content ?? viewport ?? { x: -400, y: -300, width: 800, height: 600 };
  const b = viewport ?? a;
  const left = Math.min(a.x, b.x), top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width), bottom = Math.max(a.y + a.height, b.y + b.height);
  const pad = Math.max(30, Math.max(right - left, bottom - top) * .035);
  return { x: left - pad, y: top - pad, width: Math.max(1, right - left + 2 * pad), height: Math.max(1, bottom - top + 2 * pad) };
}

export function minimapViewBox(r: MinimapRect): string {
  return `${r.x} ${r.y} ${r.width} ${r.height}`;
}

/** Invert SVG preserveAspectRatio="xMidYMid meet", including letterboxing.
 * While dragging, constrain the viewport center to the frozen map extent so
 * that the entire frame stays visible and the map cannot jump under the finger. */
export function minimapTarget(point: { x: number; y: number }, size: Size,
  extent: MinimapRect, viewport: MinimapRect): { x: number; y: number } | null {
  const scale = Math.min(size.width / extent.width, size.height / extent.height);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const offsetX = (size.width - extent.width * scale) / 2;
  const offsetY = (size.height - extent.height * scale) / 2;
  const worldX = extent.x + (point.x - offsetX) / scale;
  const worldY = extent.y + (point.y - offsetY) / scale;
  const clamp = (v: number, low: number, high: number) => low > high ? (low + high) / 2 : Math.min(high, Math.max(low, v));
  return { x: clamp(worldX, extent.x + viewport.width / 2, extent.x + extent.width - viewport.width / 2),
    y: clamp(worldY, extent.y + viewport.height / 2, extent.y + extent.height - viewport.height / 2) };
}
