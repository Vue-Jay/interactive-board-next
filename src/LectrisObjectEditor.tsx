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
const palette = ["#1f2937","#365fd0","#7c3aed","#0f766e","#d97706","#dc2626","#ec4899","#ffffff"];
const inkPalette = ["#1f2937","#365fd0","#7c3aed","#0f766e","#eab308","#ea580c","#dc2626","#ffffff"];
const sizeOptions: Record<"pen"|"marker"|"eraser", number[]> = {
  pen: [1,2,3,5,8,12],
  marker: [8,12,18,24,32,44],
  eraser: [8,16,24,40,64,96],
};

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
  const [expanded,setExpanded]=useState(false);
  const [presetsOpen,setPresetsOpen]=useState(false);
  useEffect(()=>{setExpanded(false);setPresetsOpen(false)},[tool,item?.id]);
  const drawing=tool==="pen"||tool==="marker";
  const erasing=tool==="eraser";
  if(!selectionCount&&!drawing&&!erasing)return null;
  return <section className={`lectris-quick-properties ${expanded?"is-expanded":""}`} aria-label="Быстрые настройки">
    <span className="lectris-quick-title">
      {selectionCount>0 ? item?itemNames[item.kind]:"Выбрано: "+selectionCount : erasing?"Ластик":tool==="marker"?"Маркер":"Карандаш"}
    </span>
    <button className="lectris-quick-expand" type="button" aria-expanded={expanded}
      onClick={()=>{setExpanded(v=>!v);setPresetsOpen(false)}}>{expanded?"Свернуть ▲":"Настройки ▼"}</button>
    <div className="lectris-quick-details">
      {selectionCount>0?<>
        {item&&colorKinds.has(item.kind)&&canModify&&<label className="lectris-inline-color">Цвет
          <input type="color" aria-label="Цвет выбранного объекта"
            value={/^#[0-9a-fA-F]{6}$/.test(item.color||"")?item.color:"#365fd0"}
            onChange={e=>props.onPatch({color:e.target.value})}/>
        </label>}
        {item&&<span className="lectris-quick-metric">{Math.round(item.width)} × {Math.round(item.height)}</span>}
        {item&&item.kind!=="pen"&&item.kind!=="marker"&&<button type="button" onClick={props.onInspectorOpen} aria-pressed={props.inspectorOpen}>Свойства</button>}
        {item&&canModify&&advancedKinds.has(item.kind)&&<button type="button" onClick={props.onEdit}>Редактировать</button>}
        {canModify&&<button type="button" onClick={props.onDuplicate}>Копия</button>}
        {canModify&&<button type="button" className="lectris-danger" onClick={props.onDelete}>Удалить</button>}
        <button type="button" onClick={props.onDeselect} aria-label="Снять выделение">×</button>
      </>:<>
        {drawing&&<label className="lectris-inline-color">Цвет
          <input type="color" aria-label="Цвет рисования" value={color} onChange={e=>props.onColor(e.target.value)}/>
        </label>}
        <label className="lectris-quick-slider">{erasing?"Размер":"Толщина"}
          <input type="range" min={erasing?8:tool==="marker"?8:1} max={erasing?96:tool==="marker"?48:16}
            step={erasing?2:1} value={erasing?eraserSize:tool==="marker"?markerWeight:weight}
            onChange={e=>{const n=Number(e.target.value);if(erasing)props.onEraserSize(n);else if(tool==="marker")props.onMarkerWeight(n);else props.onWeight(n);}}/>
          <span>{erasing?eraserSize:tool==="marker"?markerWeight:weight} px</span>
        </label>
        <button type="button" className="lektrus-presets-trigger" aria-expanded={presetsOpen}
          aria-controls="lektrus-brush-presets" onClick={()=>setPresetsOpen(value=>!value)}>
          {presetsOpen?"Скрыть":"Быстрый выбор"} <span aria-hidden="true">⌄</span>
        </button>
      </>}
    </div>
    {!selectionCount&&(drawing||erasing)&&presetsOpen&&
      <div className="lektrus-brush-presets" id="lektrus-brush-presets" role="group"
        aria-label={erasing?"Быстрый выбор размера ластика":"Быстрый выбор цвета и толщины"}>
        {drawing&&<div className="lektrus-brush-presets-row">
          <span>Цвет</span>
          <div className="lektrus-brush-colors" role="group" aria-label="Готовые цвета">
            {inkPalette.map(value=><button type="button" key={value}
              className={color.toLowerCase()===value?"selected":""} style={{backgroundColor:value}}
              aria-label={"Цвет "+value} title={value} aria-pressed={color.toLowerCase()===value}
              onClick={()=>props.onColor(value)}/>)}
          </div>
        </div>}
        <div className="lektrus-brush-presets-row">
          <span>{erasing?"Размер":"Толщина"}</span>
          <div className="lektrus-brush-sizes" role="group" aria-label="Готовые размеры">
            {sizeOptions[erasing?"eraser":tool==="marker"?"marker":"pen"].map(value=>{
              const current=erasing?eraserSize:tool==="marker"?markerWeight:weight;
              return <button type="button" key={value} className={current===value?"selected":""}
                aria-pressed={current===value}
                onClick={()=>{if(erasing)props.onEraserSize(value);else if(tool==="marker")props.onMarkerWeight(value);else props.onWeight(value)}}>
                {value}
              </button>;
            })}
          </div>
        </div>
      </div>}
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
  const [locationOpen,setLocationOpen]=useState(false);
  const [textDraft,setTextDraft]=useState(item.text);
  useEffect(()=>setTextDraft(item.text),[item.id,item.text]);
  const textEditable=["text","sticky","frame","comment"].includes(item.kind);
  const saveText=()=>{if(!canModify||textDraft===item.text)return;onPatch({text:item.kind==="frame"?textDraft.replace(/\s*\n+\s*/g," ").trim().slice(0,120):textDraft});};
  const currentColor = /^#[0-9a-fA-F]{6}$/.test(item.color||"") ? item.color : "#365fd0";
  const rotation=item.rotation??0;
  const rotateBy=(degrees:number)=>onPatch({rotation:((rotation+degrees)%360+360)%360});
  return <aside className="lectris-object-inspector" aria-label="Свойства объекта"
    onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}
    onKeyDown={e=>{if(e.key==="Escape"&&!advancedOpen){e.stopPropagation();onClose()}}}>
    <header className="lectris-inspector-head">
      <div><small>СВОЙСТВА ОБЪЕКТА</small><strong>{itemNames[item.kind]}</strong>
        <span className="lectris-inspector-state">{item.locked?"Объект заблокирован":canModify?"Можно редактировать":"Только просмотр"} · {Math.round(item.width)} × {Math.round(item.height)}</span></div>
      <button type="button" onClick={onClose} aria-label="Закрыть свойства">×</button>
    </header>
    <div className="lectris-inspector-scroll">
      <section className="lectris-inspector-section lektrus-inspector-position">
        <button className="lektrus-inspector-section-toggle" type="button" aria-expanded={locationOpen}
          onClick={()=>setLocationOpen(value=>!value)}>
          <span>Расположение и размеры</span><span aria-hidden="true">{locationOpen?"−":"+"}</span>
        </button>
        {locationOpen&&<div className="lektrus-inspector-position-content">
        <div className="lectris-inspector-grid">
          <NumberField label="X" value={item.x} disabled={!canModify} onCommit={x=>onPatch({x})}/>
          <NumberField label="Y" value={item.y} disabled={!canModify} onCommit={y=>onPatch({y})}/>
          <NumberField label="Ширина" value={item.width} minimum={8} disabled={!canModify} onCommit={width=>onPatch({width})}/>
          <NumberField label="Высота" value={item.height} minimum={8} disabled={!canModify} onCommit={height=>onPatch({height})}/>
          <NumberField label="Угол, °" value={rotation} minimum={-360} maximum={360} disabled={!canModify} onCommit={rotation=>onPatch({rotation})}/>
        </div>
        <div className="lectris-inspector-rotation" role="group" aria-label="Быстрый поворот">
          <button type="button" disabled={!canModify} onClick={()=>rotateBy(-90)} title="Повернуть на 90 градусов влево">↶ −90°</button>
          <button type="button" disabled={!canModify} onClick={()=>onPatch({rotation:0})} title="Убрать поворот">0°</button>
          <button type="button" disabled={!canModify} onClick={()=>rotateBy(90)} title="Повернуть на 90 градусов вправо">+90° ↷</button>
        </div>
        </div>}
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
          <input type="color" value={currentColor} disabled={!canModify} aria-label="Выбрать произвольный цвет"
            onChange={e=>onPatch({color:e.target.value})}/>
        </label>
        <div className="lectris-inspector-palette" role="group" aria-label="Готовые цвета">
          {palette.map(swatch=><button key={swatch} type="button" disabled={!canModify}
            className={swatch.toLowerCase()===currentColor?.toLowerCase()?"selected":""}
            aria-label={`Цвет ${swatch}`} aria-pressed={swatch.toLowerCase()===currentColor?.toLowerCase()}
            style={{backgroundColor:swatch}} title={swatch}
            onClick={()=>onPatch({color:swatch})}/>)}
        </div>
        {typeof item.fontSize==="number" && <NumberField label="Размер текста" value={item.fontSize} minimum={8} maximum={144} disabled={!canModify} onCommit={fontSize=>onPatch({fontSize})}/>}
      </section>}
      <section className="lectris-inspector-section">
        <h3>Действия</h3>
        {editable && <button type="button" className="lectris-inspector-primary" disabled={!canModify} onClick={onEdit}>Редактировать содержимое</button>}
        <div className="lectris-inspector-actions">
          <button type="button" disabled={!canModify} onClick={onDuplicate}>Создать копию</button>
          <button type="button" disabled={!canToggleLock} onClick={()=>onPatch({locked:!item.locked})}>{item.locked?"Разблокировать":"Заблокировать"}</button>
        </div>
        <button type="button" onClick={()=>setAdvancedOpen(true)}>Дополнительные параметры…</button>
      </section>
    </div>
    {advancedOpen&&<div className="lectris-advanced-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)setAdvancedOpen(false)}}>
      <section role="dialog" aria-modal="true" aria-label="Дополнительные параметры объекта" className="lectris-advanced-modal"
        onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();setAdvancedOpen(false)}}}>
        <header><div><small>LEKTRUS · ДОПОЛНИТЕЛЬНО</small><strong>{itemNames[item.kind]}</strong></div>
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
  </aside>;
}
