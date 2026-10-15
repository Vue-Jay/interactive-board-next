/** Per-account local drawing defaults shared by all boards in Lectris.
 * These preferences are UI-only. They never modify saved strokes or Supabase.
 */
export type InkTool = "pen" | "marker";
export type InkToolSettings = { color: string; size: number };
export type InkPreferences = { pen: InkToolSettings; marker: InkToolSettings };

const PREFIX = "lectris.ink-preferences.v1.";
export const DEFAULT_INK_PREFERENCES: InkPreferences = {
  pen: { color: "#5355c9", size: 3 },
  marker: { color: "#5355c9", size: 22 },
};
const colorValid = (color: unknown): color is string =>
  typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color);
const normalizeTool = (value: unknown, kind: InkTool): InkToolSettings => {
  const fallback = DEFAULT_INK_PREFERENCES[kind];
  if (!value || typeof value !== "object") return { ...fallback };
  const candidate = value as Partial<InkToolSettings>;
  const min = kind === "marker" ? 8 : 1;
  const max = kind === "marker" ? 48 : 16;
  return {
    color: colorValid(candidate.color) ? candidate.color : fallback.color,
    size: typeof candidate.size === "number" && Number.isFinite(candidate.size)
      ? Math.max(min, Math.min(max, Math.round(candidate.size))) : fallback.size,
  };
};

export function normalizeInkPreferences(value: unknown): InkPreferences {
  if (!value || typeof value !== "object") return {
    pen: { ...DEFAULT_INK_PREFERENCES.pen },
    marker: { ...DEFAULT_INK_PREFERENCES.marker },
  };
  const candidate = value as Partial<InkPreferences>;
  return {
    pen: normalizeTool(candidate.pen, "pen"),
    marker: normalizeTool(candidate.marker, "marker"),
  };
}
export function inkPreferencesKey(userId: string): string {
  return PREFIX + encodeURIComponent(userId);
}
export function readInkPreferences(userId: string): InkPreferences {
  try {
    const raw = localStorage.getItem(inkPreferencesKey(userId));
    return raw ? normalizeInkPreferences(JSON.parse(raw)) : normalizeInkPreferences(null);
  } catch {
    return normalizeInkPreferences(null);
  }
}
export function writeInkPreferences(userId: string, value: InkPreferences): void {
  try {
    localStorage.setItem(inkPreferencesKey(userId), JSON.stringify(normalizeInkPreferences(value)));
  } catch {
    // Full storage, private mode or restricted third-party context:
    // drawing must remain usable even when settings cannot be persisted.
  }
}
export function withInkSetting(
  current: InkPreferences, kind: InkTool, patch: Partial<InkToolSettings>,
): InkPreferences {
  return { ...current, [kind]: normalizeTool({ ...current[kind], ...patch }, kind) };
}
