import { useEffect, useState } from "react";
import type { Item } from "./boardModel";
import LektrusColorPicker from "./LektrusColorPicker";

/** Five genuinely distinct BOARD-pixel widths. */
export const INK_WIDTHS={
 pen:[1,3,6,12,22],
 marker:[2,7,14,28,48],
 eraser:[6,16,32,55,90]
} as const;
export type InkTool="pen"|"marker"|"eraser";
/** Scale wider tools uniformly so the whole five-sample set fits, and always
 * show the REAL board-pixel width below each proportionate preview. */
export function InkWidthSample({tool,size,color}:{tool:InkTool;size:number;color:string}){
 const scale=Math.min(1,22/INK_WIDTHS[tool][4]);
 return <span className="lektrus-ink-swatch">
   <span className="lektrus-ink-swatch-field">
     <span className="lektrus-ink-swatch-stroke" style={{
       height:Math.max(1,size*scale)+"px",
       background:tool==="eraser"?"#64748b":color,
       opacity:tool==="marker"?.32:1
     }}/>
   </span>
   <span className="lektrus-ink-swatch-value">{String(size).replace(".",",")} px</span>
 </span>;
}
const inkWidthIndex=(tool:"pen"|"marker"|"eraser",width:number)=>{
 const values=INK_WIDTHS[tool];
 return values.reduce((best,v,i)=>Math.abs(v-width)<Math.abs(values[best]-width)?i:best,0);
};
const itemNames: Record<Item["kind"], string> = {
  pen:"Карандаш", marker:"Маркер", shape:"Фигура", text:"Текст",
  sticky:"Стикер", image:"Изображение", pdf:"PDF", frame:"Фрейм",
  connector:"Линия", comment:"Комментарий", table:"Таблица",
  formula:"Формула", graph:"График", fraction:"Дробь", checklist:"Чек-лист",
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
  userId: string;
};

export function LectrisQuickProperties(props: QuickProps) {
  const { item, selectionCount, tool, color, weight, markerWeight, eraserSize, canModify } = props;
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>setExpanded(false),[tool,item?.id]);
  const drawing=tool==="pen"||tool==="marker";
  const erasing=tool==="eraser";
  if(item?.kind==="graph"&&item.graphFigureId==="chem-periodic"&&!drawing&&!erasing)return null;
  if(!selectionCount&&!drawing&&!erasing)return null;
  const inkTool=erasing?"eraser":tool==="marker"?"marker":"pen";
  const inkSizes=INK_WIDTHS[inkTool];
  const currentWidth=erasing?eraserSize:tool==="marker"?markerWeight:weight;
  const updateWidth=(n:number)=>{
    if(erasing)props.onEraserSize(n);
    else if(tool==="marker")props.onMarkerWeight(n);
    else props.onWeight(n);
  };
  return <section className={`lectris-quick-properties ${drawing||erasing?"is-ink-properties":""} ${expanded?"is-expanded":""}`}
    aria-label={drawing||erasing?"Параметры инструмента":"Быстрые настройки"}
    onPointerDown={e=>e.stopPropagation()} onPointerMove={e=>e.stopPropagation()}
    onPointerUp={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
    <span className="lectris-quick-title">
      {selectionCount>0&&!drawing&&!erasing ? item?itemNames[item.kind]:"Выбрано: "+selectionCount : erasing?"Ластик":tool==="marker"?"Маркер":"Карандаш"}
    </span>
    {!(drawing||erasing)&&<button className="lectris-quick-expand" type="button" aria-expanded={expanded}
      onClick={()=>setExpanded(v=>!v)}>{expanded?"Свернуть ▲":"Настройки ▼"}</button>}
    <div className="lectris-quick-details">
      {selectionCount>0&&!drawing&&!erasing?<>
        {item&&colorKinds.has(item.kind)&&canModify&&
          <LektrusColorPicker compact userId={props.userId} label="Цвет"
            value={item.color||"#365fd0"} onChange={value=>props.onPatch({color:value})}/>}
        {item&&<span className="lectris-quick-metric">{Math.round(item.width)} × {Math.round(item.height)}</span>}
        {item&&item.kind!=="pen"&&item.kind!=="marker"&&<button type="button" onClick={props.onInspectorOpen} aria-pressed={props.inspectorOpen}>Свойства</button>}
        {item&&canModify&&advancedKinds.has(item.kind)&&<button type="button" onClick={props.onEdit}>Редактировать</button>}
        {canModify&&<button type="button" onClick={props.onDuplicate}>Копия</button>}
        {canModify&&<button type="button" className="lectris-danger" onClick={props.onDelete}>Удалить</button>}
        <button type="button" onClick={props.onDeselect} aria-label="Снять выделение">×</button>
      </>:<>
        {drawing&&<LektrusColorPicker compact userId={props.userId} label="Цвет"
          value={color} onChange={props.onColor}/>}
        <div className="lektrus-ink-five-widths" role="group"
          aria-label={"Толщина: "+(erasing?"ластик":tool==="marker"?"маркер":"карандаш")}>
          {inkSizes.map((size,i)=><button key={size} type="button"
            className="lektrus-ink-width-button" aria-pressed={inkWidthIndex(inkTool,currentWidth)===i}
            aria-label={["Очень тонко","Тонко","Средняя толщина","Толсто","Очень толсто"][i]+": "+size+" пикселей"}
            title={size+" px"} onClick={()=>updateWidth(size)}>
            <InkWidthSample tool={inkTool} size={size} color={color}/>
          </button>)}
        </div>
      </>}
    </div>
  </section>;
}

type InspectorProps = {
  item: Item;
  canModify: boolean;
  userId: string;
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

export function LectrisObjectInspector({item,canModify,userId,canToggleLock,onClose,onPatch,onEdit,onDuplicate,onDelete}:InspectorProps) {
  const editable=advancedKinds.has(item.kind);
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const [locationOpen,setLocationOpen]=useState(false);
  const [textDraft,setTextDraft]=useState(item.text);
  useEffect(()=>setTextDraft(item.text),[item.id,item.text]);
  const textEditable=["text","sticky","frame","comment"].includes(item.kind);
  const saveText=()=>{if(!canModify||textDraft===item.text)return;onPatch({text:item.kind==="frame"?textDraft.replace(/\s*\n+\s*/g," ").trim().slice(0,120):textDraft});};
  const currentColor = /^#[0-9a-fA-F]{6}$/.test(item.color||"") ? (item.color ?? "#365fd0") : "#365fd0";
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
        <LektrusColorPicker userId={userId} label="Цвет объекта" value={currentColor}
          disabled={!canModify} onChange={color=>onPatch({color})}/>
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
