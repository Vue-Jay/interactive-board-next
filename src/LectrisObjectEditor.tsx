import { useEffect, useState } from "react";
import type { Item } from "./boardModel";

const itemNames: Record<Item["kind"], string> = {
  pen:"Карандаш", marker:"Маркер", shape:"Фигура", text:"Текст",
  sticky:"Стикер", image:"Изображение", pdf:"PDF", frame:"Фрейм",
  connector:"Линия", comment:"Комментарий", table:"Таблица",
  formula:"Формула", graph:"График", checklist:"Чек-лист",
  quiz:"Тест", flashcard:"Карточка", cover:"Шторка", linkmedia:"Медиа",
};
const colorKinds = new Set<Item["kind"]>(["pen","marker","shape","text","sticky","connector","comment","formula","graph","checklist","quiz","flashcard","frame"]);
const advancedKinds = new Set<Item["kind"]>(["text","sticky","frame","comment","graph","formula","table","checklist","quiz","flashcard","linkmedia"]);

type QuickProps = {
  item: Item | null;
  selectionCount: number;
  tool: string;
  color: string;
  weight: number;
  markerWeight: number;
  eraserSize: number;
  canModify: boolean;
  inspectorOpen: boolean;
  onInspectorOpen: () => void;
  onDeselect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPatch: (patch: Partial<Item>) => void;
  onColor: (color: string) => void;
  onWeight: (value: number) => void;
  onMarkerWeight: (value: number) => void;
  onEraserSize: (value: number) => void;
};

export function LectrisQuickProperties(props: QuickProps) {
  const { item, selectionCount, tool, color, weight, markerWeight, eraserSize, canModify } = props;
  const drawing = tool === "pen" || tool === "marker";
  const erasing = tool === "eraser";
  if (!selectionCount && !drawing && !erasing) return null;
  return <section className="lectris-quick-properties" aria-label="Быстрые настройки">
    {selectionCount > 0 ? <>
      <span className="lectris-quick-title">{item ? itemNames[item.kind] : "Выбрано: " + selectionCount}</span>
      {item && colorKinds.has(item.kind) && canModify && <label className="lectris-inline-color">Цвет
        <input type="color" aria-label="Цвет выбранного объекта" value={/^#[0-9a-fA-F]{6}$/.test(item.color||"") ? item.color : "#365fd0"} onChange={e=>props.onPatch({color:e.target.value})}/>
      </label>}
      {item && <span className="lectris-quick-metric">{Math.round(item.width)} × {Math.round(item.height)}</span>}
      {item && item.kind!=="pen" && item.kind!=="marker" && <button type="button" onClick={props.onInspectorOpen} aria-pressed={props.inspectorOpen}>Свойства</button>}
      {item && canModify && advancedKinds.has(item.kind) && <button type="button" onClick={props.onEdit}>Редактировать</button>}
      {canModify && <button type="button" onClick={props.onDuplicate}>Копия</button>}
      {canModify && <button type="button" className="lectris-danger" onClick={props.onDelete}>Удалить</button>}
      <button type="button" onClick={props.onDeselect} aria-label="Снять выделение">×</button>
    </> : <>
      <span className="lectris-quick-title">{erasing ? "Ластик" : tool==="marker" ? "Маркер" : "Карандаш"}</span>
      {drawing && <label className="lectris-inline-color">Цвет
        <input type="color" aria-label="Цвет рисования" value={color} onChange={e=>props.onColor(e.target.value)} />
      </label>}
      <label className="lectris-quick-slider">{erasing ? "Размер" : "Толщина"}
        <input type="range" min={erasing?8:tool==="marker"?8:1} max={erasing?96:tool==="marker"?48:16}
          step={erasing?2:1} value={erasing?eraserSize:tool==="marker"?markerWeight:weight}
          onChange={e=>{const n=Number(e.target.value); if(erasing)props.onEraserSize(n);else if(tool==="marker")props.onMarkerWeight(n);else props.onWeight(n);}} />
        <span>{erasing?eraserSize:tool==="marker"?markerWeight:weight} px</span>
      </label>
    </>}
  </section>;
}

type InspectorProps = {
  item: Item;
  canModify: boolean;
  canToggleLock: boolean;
  onClose: () => void;
  onPatch: (patch: Partial<Item>) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

function NumberField({label,value,minimum=-100000,maximum=100000,disabled,onCommit}:{
  label:string;value:number;minimum?:number;maximum?:number;disabled:boolean;onCommit:(value:number)=>void;
}) {
  const save = (raw: string) => {
    if (disabled || !raw.trim()) return;
    const number=Number(raw);
    if (!Number.isFinite(number)) return;
    const adjusted=Math.max(minimum,Math.min(maximum,number));
    if (Math.abs(adjusted-value) > 0.001) onCommit(adjusted);
  };
  return <label className="lectris-inspector-field"><span>{label}</span>
    <input key={label+":"+value} type="number" step="1" defaultValue={Math.round(value*100)/100}
      disabled={disabled} min={minimum} max={maximum} onBlur={e=>save(e.target.value)}
      onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}/>
  </label>;
}

export function LectrisObjectInspector({item,canModify,canToggleLock,onClose,onPatch,onEdit,onDuplicate,onDelete}:InspectorProps) {
  const editable=advancedKinds.has(item.kind);
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const [textDraft,setTextDraft]=useState(item.text);
  useEffect(()=>setTextDraft(item.text),[item.id,item.text]);
  const textEditable=["text","sticky","frame","comment"].includes(item.kind);
  const saveText=()=>{if(!canModify||textDraft===item.text)return;onPatch({text:item.kind==="frame"?textDraft.replace(/\s*\n+\s*/g," ").trim().slice(0,120):textDraft});};
  return <aside className="lectris-object-inspector" aria-label="Свойства объекта" onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
    <header className="lectris-inspector-head">
      <div><small>СВОЙСТВА ОБЪЕКТА</small><strong>{itemNames[item.kind]}</strong></div>
      <button type="button" onClick={onClose} aria-label="Закрыть свойства">×</button>
    </header>
    <div className="lectris-inspector-scroll">
      <section className="lectris-inspector-section">
        <h3>Расположение</h3>
        <div className="lectris-inspector-grid">
          <NumberField label="X" value={item.x} disabled={!canModify} onCommit={x=>onPatch({x})}/>
          <NumberField label="Y" value={item.y} disabled={!canModify} onCommit={y=>onPatch({y})}/>
          <NumberField label="Ширина" value={item.width} minimum={8} disabled={!canModify} onCommit={width=>onPatch({width})}/>
          <NumberField label="Высота" value={item.height} minimum={8} disabled={!canModify} onCommit={height=>onPatch({height})}/>
          <NumberField label="Угол, °" value={item.rotation??0} minimum={-360} maximum={360} disabled={!canModify} onCommit={rotation=>onPatch({rotation})}/>
        </div>
      </section>
      {textEditable && <section className="lectris-inspector-section">
        <h3>{item.kind==="frame"?"Название фрейма":"Содержимое"}</h3>
        <textarea className="lectris-inspector-text" rows={item.kind==="frame"?2:6}
          value={textDraft} disabled={!canModify} maxLength={item.kind==="frame"?120:10000}
          onChange={e=>setTextDraft(e.target.value)} aria-label="Содержимое выбранного объекта"/>
        <button type="button" className="lectris-inspector-primary" disabled={!canModify||textDraft===item.text} onClick={saveText}>Сохранить текст</button>
      </section>}
      {colorKinds.has(item.kind) && <section className="lectris-inspector-section">
        <h3>Оформление</h3>
        <label className="lectris-inspector-color"><span>Цвет объекта</span>
          <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(item.color||"")?item.color:"#365fd0"} disabled={!canModify}
            onChange={e=>onPatch({color:e.target.value})}/>
        </label>
        {typeof item.fontSize==="number" && <NumberField label="Размер текста" value={item.fontSize} minimum={8} maximum={144} disabled={!canModify} onCommit={fontSize=>onPatch({fontSize})}/>}
      </section>}
      <section className="lectris-inspector-section">
        <h3>Действия</h3>
        {editable && <button type="button" className="lectris-inspector-primary" disabled={!canModify} onClick={onEdit}>Редактировать содержимое</button>}
        <button type="button" onClick={()=>setAdvancedOpen(true)}>Дополнительные параметры…</button>
      </section>
    </div>
    {advancedOpen&&<div className="lectris-advanced-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)setAdvancedOpen(false)}}>
      <section role="dialog" aria-modal="true" aria-label="Дополнительные параметры объекта" className="lectris-advanced-modal"
        onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();setAdvancedOpen(false)}}}>
        <header><div><small>LECTRIS · ДОПОЛНИТЕЛЬНО</small><strong>{itemNames[item.kind]}</strong></div>
          <button type="button" onClick={()=>setAdvancedOpen(false)} aria-label="Закрыть дополнительные настройки">×</button></header>
        <div className="lectris-advanced-body">
          <p>Дополнительные операции с выбранным объектом.</p>
          <button type="button" disabled={!canModify} onClick={()=>{onDuplicate();setAdvancedOpen(false)}}>Создать копию</button>
          <button type="button" disabled={!canToggleLock} onClick={()=>{onPatch({locked:!item.locked});setAdvancedOpen(false)}}>{item.locked?"Разблокировать":"Заблокировать"}</button>
          <button type="button" disabled={!canModify||!item.rotation} onClick={()=>{onPatch({rotation:0});setAdvancedOpen(false)}}>Сбросить поворот</button>
          <button className="lectris-danger" type="button" disabled={!canModify} onClick={()=>{onDelete();setAdvancedOpen(false)}}>Удалить объект</button>
        </div>
        <footer><button type="button" onClick={()=>setAdvancedOpen(false)}>Готово</button></footer>
      </section>
    </div>}
    </div>
  </aside>;
}
