/** Device-local, per-account palette. No board revisions or Supabase requests. */
export const DEFAULT_COLORS = ["#1f2937","#365fd0","#7c3aed","#0f766e","#eab308","#ea580c","#dc2626","#ffffff"] as const;
export const MAX_SAVED_COLORS = 24;
const PREFIX = "lektrus.saved-colors.v1.";
const HEX = /^#[0-9a-fA-F]{6}$/;
const isDefault = (color: string): boolean => DEFAULT_COLORS.some(value=>value===color);
export function validHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}
export function colorLibraryKey(userId: string): string {
  return PREFIX + encodeURIComponent(userId);
}
export function sanitizeSavedColors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const clean: string[] = [];
  for (const item of value) {
    if (!validHexColor(item)) continue;
    const color = item.toLowerCase();
    if (!isDefault(color) && !clean.includes(color)) clean.push(color);
    if (clean.length >= MAX_SAVED_COLORS) break;
  }
  return clean;
}
export function decodeSavedColors(value: string | null): string[] {
  if (!value) return [];
  try { return sanitizeSavedColors(JSON.parse(value)); } catch { return []; }
}
export function addSavedColor(existing: string[], raw: string): string[] {
  if (!validHexColor(raw)) return existing;
  const color = raw.toLowerCase();
  if (isDefault(color) || existing.includes(color) || existing.length >= MAX_SAVED_COLORS) return existing;
  return [...existing,color];
}
export function removeSavedColor(existing: string[], raw: string): string[] {
  return existing.filter(color => color !== raw.toLowerCase());
}
