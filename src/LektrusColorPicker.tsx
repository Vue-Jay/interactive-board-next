import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { DEFAULT_COLORS, MAX_SAVED_COLORS, validHexColor, colorLibraryKey,
  sanitizeSavedColors, decodeSavedColors, addSavedColor, removeSavedColor } from "./lektrusSavedColors";

const EVENT = "lektrus-saved-colors-updated";
const notify = () => window.dispatchEvent(new Event(EVENT));
function subscribe(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
function readRaw(userId: string): string {
  try { return localStorage.getItem(colorLibraryKey(userId)) ?? ""; } catch { return ""; }
}
function store(userId: string, colors: string[]): void {
  try {
    localStorage.setItem(colorLibraryKey(userId), JSON.stringify(sanitizeSavedColors(colors)));
    notify();
  } catch { /* If storage is unavailable, painting and saving must still work. */ }
}
type Props = {
  value: string;
  onChange: (color: string) => void;
  userId: string;
  label?: string;
  disabled?: boolean;
  compact?: boolean;
  paletteInside?: boolean;
};

/** Two controls everywhere: current-color square opens saved swatches,
 * multicolor wheel uses the browser's precise color dialog.
 * Swatch popup is portaled so editor scroll containers cannot clip it.
 */
export default function LektrusColorPicker({
  value, onChange, userId, label="Цвет", disabled=false, compact=false, paletteInside=false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, above: false });
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const raw = useSyncExternalStore(subscribe, () => readRaw(userId), () => "");
  const custom = useMemo(() => decodeSavedColors(raw), [raw]);
  const current = validHexColor(value) ? value.toLowerCase() : "#365fd0";
  const colors = [...DEFAULT_COLORS, ...custom];

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const box = trigger.current?.getBoundingClientRect();
      if (!box) return;
      const width = Math.min(302, Math.max(200, window.innerWidth - 20));
      const height = popup.current?.offsetHeight ?? 220;
      const left = Math.max(10, Math.min(window.innerWidth - width - 10, box.left));
      const above = window.innerHeight - box.bottom < height + 14 && box.top >= height + 14;
      const top = above
        ? Math.max(8, box.top - height - 7)
        : Math.min(window.innerHeight - height - 8, box.bottom + 7);
      setPosition({left,top,above});
    };
    measure();
    window.addEventListener("resize",measure);
    window.addEventListener("scroll",measure,true);
    return () => {
      window.removeEventListener("resize",measure);
      window.removeEventListener("scroll",measure,true);
    };
  }, [open, custom.length]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const node = event.target as Node;
      if (!popup.current?.contains(node) && !trigger.current?.contains(node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown",outside,true);
    document.addEventListener("keydown",escape,true);
    return () => {
      document.removeEventListener("pointerdown",outside,true);
      document.removeEventListener("keydown",escape,true);
    };
  }, [open]);

  const choose = (color: string) => { onChange(color); setOpen(false); };
  return <div className={`lektrus-color-picker ${compact?"is-compact":""}`} onPointerDown={e=>e.stopPropagation()}>
    {label&&<span className="lektrus-color-caption">{label}</span>}
    <div className="lektrus-color-controls">
      <button ref={trigger} type="button" className="lektrus-color-current"
        style={{"--selected-color":current} as React.CSSProperties}
        aria-label="Избранные цвета" title="Быстрый выбор цвета" aria-haspopup="dialog"
        aria-expanded={open} disabled={disabled} onClick={()=>setOpen(!open)}>
        <span aria-hidden="true"/>
      </button>
      {!paletteInside&&<label className={`lektrus-color-wheel ${disabled?"is-disabled":""}`}
        title="Смешанная палитра: выбрать любой цвет">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21">
          <path d="M12 2a10 10 0 0 1 10 10c0 5.4-4 9-8.4 9a2.5 2.5 0 0 1-2.1-4c.5-.8-.2-1.8-1.2-1.8H8.5A6.5 6.5 0 0 1 2 8.7C2 5 6.3 2 12 2Z" fill="#fff" stroke="#7485a2" strokeWidth="1.1"/>
          <circle cx="8" cy="6.8" r="2.1" fill="#e84f5e"/>
          <circle cx="14.1" cy="6.2" r="2.1" fill="#eab738"/>
          <circle cx="18.2" cy="10.8" r="2.1" fill="#36a66a"/>
          <circle cx="7.1" cy="12" r="2.1" fill="#3e87dc"/>
          <circle cx="13.1" cy="12" r="1.7" fill="#9667d4"/>
        </svg>
        <input type="color" aria-label="Смешанная палитра: выбрать произвольный цвет"
          value={current} disabled={disabled} onChange={e=>onChange(e.target.value)}/>
      </label>}
    </div>
    {open&&!disabled&&createPortal(
      <div ref={popup} role="dialog" aria-label="Избранные цвета" className="lektrus-colors-popup"
        style={{left:position.left,top:position.top,width:Math.min(302,Math.max(200,window.innerWidth-20))}}
        data-placement={position.above?"above":"below"}
        onPointerDown={e=>e.stopPropagation()}>
        <header><strong>Быстрый выбор</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Закрыть палитру">×</button></header>
        <div className="lektrus-colors-grid">
          {colors.map(color=><div className="lektrus-color-cell" key={color}>
            <button type="button" className={color===current?"is-selected":""}
              style={{backgroundColor:color}} title={color} aria-label={"Выбрать "+color}
              aria-pressed={color===current} onClick={()=>choose(color)}/>
            {custom.includes(color)&&<button type="button" className="lektrus-color-remove"
              title={"Удалить "+color+" из избранного"} aria-label={"Удалить "+color+" из избранного"}
              onClick={()=>store(userId,removeSavedColor(custom,color))}>×</button>}
          </div>)}
        </div>
        {paletteInside&&<label className="lektrus-color-popup-wheel"><span className="lektrus-color-popup-wheel-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 2a10 10 0 0 1 10 10c0 5-3.5 9-8 9-2 0-3-1.5-2-3.3.8-1.3-.1-2.7-1.5-2.7H8a6 6 0 0 1-6-6c0-4 4.5-7 10-7Z"/><circle cx="7.5" cy="9" r="1" fill="#ef4444" stroke="none"/><circle cx="11" cy="6" r="1" fill="#f59e0b" stroke="none"/><circle cx="16" cy="8" r="1" fill="#22c55e" stroke="none"/><circle cx="17.5" cy="12" r="1" fill="#3b82f6" stroke="none"/></svg></span><span className="lektrus-color-popup-wheel-text"><strong>Свой цвет</strong><small>Выбрать любой оттенок</small></span><span className="lektrus-color-popup-wheel-arrow" aria-hidden="true">›</span><input type="color" aria-label="Выбрать произвольный цвет" value={current} onChange={e=>onChange(e.target.value)}/></label>}
        <div className="lektrus-color-add-row">
          <button type="button" disabled={custom.includes(current)||custom.length>=MAX_SAVED_COLORS||DEFAULT_COLORS.some(value=>value===current)}
            onClick={()=>store(userId,addSavedColor(custom,current))}>☆ Сохранить текущий</button>
          <label title="Выбрать новый цвет и добавить в избранное">
            + Добавить цвет
            <input type="color" aria-label="Новый цвет для избранного"
              value={current} disabled={custom.length>=MAX_SAVED_COLORS}
              onChange={e=>{onChange(e.target.value);store(userId,addSavedColor(custom,e.target.value))}}/>
          </label>
        </div>
        {custom.length>=MAX_SAVED_COLORS&&<small className="lektrus-color-limit">Максимум {MAX_SAVED_COLORS} своих цветов. Чтобы добавить ещё, удалите один из сохранённых.</small>}
      </div>,
      document.body
    )}
  </div>;
}
