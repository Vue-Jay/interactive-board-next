import {useState} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import {atomShells,atomViews,defaultAtomModel,type AtomViewMode,type AtomModel} from "./lektrusAtomModel";
import {periodicElements} from "./lektrusPeriodicElements";
import LektrusAtomView from "./LektrusAtomView";
import LektrusElementInfo from "./LektrusElementInfo";

type Props={item:Item;onSave:(next:Item)=>void;onCancel:()=>void;onClose?:(next:Item)=>void};
export default function LektrusAtomEditor({item,onSave,onCancel,onClose}:Props){
 const [model,setModel]=useState<AtomModel>(()=>({...defaultAtomModel,...item.scienceAtomModel}));
 const [name,setName]=useState(item.text||"Строение атома");
 const [query,setQuery]=useState("");
 const [showList,setShowList]=useState(false);
 const [details,setDetails]=useState(false);
 const element=periodicElements[model.atomicNumber-1]??periodicElements[7];
 const filtered=periodicElements.filter(e=>
  (e.symbol+" "+e.number+" "+e.name).toLocaleLowerCase("ru-RU")
  .includes(query.trim().toLocaleLowerCase("ru-RU"))).slice(0,118);
 const result=():Item=>({
  ...item,scienceAtomModel:model,
  graphFigureId:"chem-atom",graphPurpose:"geometry",graphAxisMode:"none",
  graphPoints:[],graphSegments:[],graphCircles:[],graphGrid:false,
  width:item.scienceAtomModel?item.width:540,height:item.scienceAtomModel?item.height:365,
  text:name.trim().slice(0,100)||"Строение атома"
 });
 const change=(patch:Partial<AtomModel>)=>setModel(cur=>({...cur,...patch}));
 const close=()=>onClose?onClose(result()):onCancel();
 return createPortal(<div className="lektrus-atom-backdrop"
   onPointerDown={e=>{if(e.target===e.currentTarget)close()}}>
  <section className="lektrus-atom-dialog" role="dialog" aria-modal="true"
   aria-label="Редактор строения атома" onPointerDown={e=>e.stopPropagation()}>
   <header><div className="lektrus-atom-icon" aria-hidden="true">
    <svg viewBox="0 0 40 40" width="34" height="34"><circle cx="20" cy="20" r="4" fill="#247c86"/>
      <ellipse cx="20" cy="20" rx="16" ry="7" stroke="#247c86" strokeWidth="1.7" fill="none" transform="rotate(-35 20 20)"/>
      <ellipse cx="20" cy="20" rx="16" ry="7" stroke="#247c86" strokeWidth="1.7" fill="none" transform="rotate(35 20 20)"/></svg>
   </div><div><small>ХИМИЯ · АТОМ</small><h2>Строение атома</h2></div>
   <button type="button" onClick={close} title="Закрыть">×</button></header>
   <div className={"lektrus-atom-content"+(showList?" choosing-element":"")}>
    <aside className="lektrus-atom-controls">
     <label>Название на доске
       <input value={name} onChange={e=>setName(e.target.value)} maxLength={100}/>
     </label>
     <label>Химический элемент
      <button type="button" className="lektrus-atom-choice" onClick={()=>setShowList(s=>!s)}>
       <b>{element.symbol}</b> {element.name} · Z = {element.number} <span>⌄</span>
      </button>
     </label>
     {showList&&<div className="lektrus-atom-element-list">
      <input autoFocus placeholder="Название, обозначение, номер…" value={query}
        onChange={e=>setQuery(e.target.value)}/>
      <div role="listbox" aria-label="Выбор элемента">
      {filtered.map(e=><button key={e.number} type="button"
        aria-selected={model.atomicNumber===e.number} onClick={()=>{
        change({atomicNumber:e.number});setShowList(false);setQuery("");
       }}><b>{e.symbol}</b><span>{e.name}</span><small>{e.number}</small></button>)}
      </div>
     </div>}
     <div className="lektrus-atom-section-title">Способ изображения</div>
     <div className="lektrus-atom-modes">
      {atomViews.map(v=><button key={v.id} type="button"
        className={model.mode===v.id?"active":""}
        onClick={()=>change({mode:v.id as AtomViewMode})}>
        <strong>{v.name}</strong><small>{v.description}</small>
       </button>)}
     </div>
     <label className="lektrus-atom-checkbox"><input type="checkbox"
       checked={model.showElectronConfiguration}
       onChange={e=>change({showElectronConfiguration:e.target.checked})}/> Подпись с электронной конфигурацией
     </label>
     <div className="lektrus-atom-meta">
      <strong>{element.name}</strong>
      <span>Протонов: {element.number}</span>
      <span>Электронов: {element.number}</span>
      <span>Оболочки: {atomShells(element.number).join(" · ")}</span>
      <button type="button" onClick={()=>setDetails(d=>!d)}>{details?"Скрыть характеристики":"Характеристики элемента"}</button>
     </div>
     {details&&<LektrusElementInfo number={element.number} compact/>}
    </aside>
    <div className="lektrus-atom-preview">
      <div className="lektrus-atom-preview-head"><b>{atomViews.find(v=>v.id===model.mode)?.name}</b>
        <span>Подпись можно перемещать мышью</span></div>
      <div className="lektrus-atom-stage"><LektrusAtomView model={model} onLabelMove={(x,y)=>change({labelX:x,labelY:y})}/></div>
      <p>{model.mode==="orbital"||model.mode==="lewis"?
        "Орбитальные ячейки построены по электронной конфигурации. Стрелки отображают противоположные направления спинов; расчёты не выполняются.":
        "Упрощённая школьная модель. Пространственные орбиты и размеры частиц условны, вычисления не выполняются."}</p>
    </div>
   </div>
   <footer><span>Один инструмент · четыре модели · 118 элементов</span>
    <button type="button" onClick={onCancel}>Отмена</button>
    <button type="button" className="primary" onClick={()=>onSave(result())}>Сохранить на доску</button>
   </footer>
  </section>
 </div>,document.body);
}
