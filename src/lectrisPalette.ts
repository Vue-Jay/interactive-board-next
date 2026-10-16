export type LectrisPalette = "sapphire" | "jade" | "violet" | "sunset";
const key = "lectris.visual-palette.v1";
const options:ReadonlyArray<LectrisPalette> = ["sapphire","jade","violet","sunset"];

export function readLectrisPalette():LectrisPalette {
  try {
    const saved = window.localStorage.getItem(key);
    return options.find(value=>value===saved) ?? "sapphire";
  } catch {
    return "sapphire";
  }
}
export function applyLectrisPalette(palette:LectrisPalette):void {
  document.documentElement.dataset.lectrisPalette=palette;
  window.dispatchEvent(new CustomEvent("lektrus:palette-change",{detail:palette}));
  try{window.localStorage.setItem(key,palette)}catch{/* Storage might be blocked. */}
}
export function initLectrisPalette():void {
  applyLectrisPalette(readLectrisPalette());
}
