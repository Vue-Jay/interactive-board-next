import { Capacitor } from "@capacitor/core";

/** Native and touch web surfaces cannot rely on browser PDF plugins or popups. */
export function usesEmbeddedPdf(): boolean {
  return Capacitor.isNativePlatform() || window.matchMedia('(max-width: 1100px), (any-pointer: coarse)').matches;
}
