import { useEffect, useState } from "react";
import { defaultLectrisPanelLayout, type LectrisPanelLayout } from "./lectrisPanelLayout";

type Props={value:LectrisPanelLayout;onChange:(next:LectrisPanelLayout)=>void;onClose:()=>void};
type SideKey="toolbarSide"|"inspectorSide";
const sideOptions:{value:"left"|"right";label:string}[]=[{value:"left",label:"Слева"},{value:"right",label:"Справа"}];

export default function LectrisPanelSettings({value,onChange,onClose}:Props){
  const [draft,setDraft]=useState<LectrisPanelLayout>(value);
  useEffect(()=>setDraft(value),[value]);
  const set=<K extends keyof LectrisPanelLayout,>(key:K,next:LectrisPanelLayout[K])=>setDraft(current=>({...current,[key]:next}));
  const side=(key:SideKey,label:string)=><fieldset className="lectris-panel-settings-field">
    <legend>{label}</legend>
    <div className="lectris-panel-settings-segments">
      {sideOptions.map(option=><label key={option.value} className={draft[key]===option.value?"active":""}>
        <input type="radio" name={key} checked={draft[key]===option.value} onChange={()=>set(key,option.value)}/>
        {option.label}
      </label>)}
    </div>
  </fieldset>;
  return <div className="lectris-panel-settings-overlay" onPointerDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className="lectris-panel-settings-dialog" role="dialog" aria-modal="true" aria-label="Расположение панелей"
      onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();onClose()}}}>
      <header><div><small>LECTRIS · РАБОЧАЯ РАСКЛАДКА</small><h2>Расположение панелей</h2></div>
        <button type="button" onClick={onClose} aria-label="Закрыть">×</button></header>
      <p>Закрепите панели там, где ими удобно пользоваться. Это не изменяет масштаб и расположение объектов на доске.</p>
      <div className="lectris-panel-settings-form">
        {side("toolbarSide","Инструменты")}
        <fieldset className="lectris-panel-settings-field">
          <legend>Быстрые настройки</legend>
          <div className="lectris-panel-settings-segments">
            <label className={draft.quickPosition==="bottom"?"active":""}><input type="radio" name="quickPosition" checked={draft.quickPosition==="bottom"} onChange={()=>set("quickPosition","bottom")}/>Снизу</label>
            <label className={draft.quickPosition==="top"?"active":""}><input type="radio" name="quickPosition" checked={draft.quickPosition==="top"} onChange={()=>set("quickPosition","top")}/>Сверху</label>
          </div>
        </fieldset>
        {side("inspectorSide","Панель редактора")}
        <label className="lectris-panel-settings-range">Ширина редактора
          <div><input type="range" min={280} max={460} step={10} value={draft.inspectorWidth}
            onChange={e=>set("inspectorWidth",Number(e.target.value))}/><strong>{draft.inspectorWidth} px</strong></div>
        </label>
      </div>
      <div className="lectris-panel-settings-hint">На телефоне ориентация панелей сохраняет безопасное стандартное расположение: инструменты слева, быстрые настройки снизу.</div>
      <footer>
        <button type="button" onClick={()=>setDraft({...defaultLectrisPanelLayout})}>Сбросить настройки</button>
        <div><button type="button" onClick={onClose}>Отмена</button>
          <button type="button" className="lectris-panel-settings-primary" onClick={()=>{onChange(draft);onClose()}}>Применить</button></div>
      </footer>
    </section>
  </div>;
}
