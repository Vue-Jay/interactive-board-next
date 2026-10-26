import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import LektrusOrganicCanvas from "./LektrusOrganicCanvas";
import {analyzeOrganicStructure} from "./lektrusOrganicFormula";
import {nameOrganicStructure} from "./lektrusOrganicNomenclature";
type Props={item:Item;onChange:(updater:(item:Item)=>Item)=>void;onSave:()=>void;onCancel:()=>void;canTeach?:boolean};
export default function LektrusOrganicEditorPanel({item,onChange,onSave,onCancel,canTeach=false}:Props){
 const formula=analyzeOrganicStructure(item);
 const naming=nameOrganicStructure(item);
 return createPortal(<div className="lektrus-organic-overlay" onPointerDown={e=>{if(e.target===e.currentTarget)onCancel()}}>
  <section className="lektrus-organic-panel" role="dialog" aria-modal="true" aria-label="Органический редактор"
   onPointerDown={e=>e.stopPropagation()}>
   <header><div className="lektrus-organic-panel-heading"><strong>Органический редактор</strong>
      <small>Конструктор структурных формул · все изменения на одном холсте</small></div>
    <button type="button" aria-label="Закрыть редактор без создания объекта" title="Закрыть" onClick={onCancel}>×</button></header>
   <label className="lektrus-organic-name"><span>Подпись</span>
    <input type="text" maxLength={110} value={item.text}
     placeholder="Произвольная подпись на доске"
     onChange={e=>onChange(old=>({...old,text:e.target.value}))}/>
   </label>
   <section className="lektrus-organic-nomenclature" aria-label="Номенклатура органического соединения">
    <div className="lektrus-organic-nomenclature-head">
     <strong>Название соединения</strong>
     <small>{naming.status==="reference"?"По структурному справочнику":naming.status==="calculated"?"По правилам номенклатуры":"Требуется проверка"}</small>
    </div>
    <div className="lektrus-organic-nomenclature-values">
     <div><span>Систематическое</span><strong>{naming.systematic??"Не определено"}</strong></div>
     <div><span>Тривиальное</span><strong>{naming.trivial??"Нет в проверенном справочнике"}</strong></div>
    </div>
    {canTeach&&<div className="lektrus-organic-nomenclature-controls" role="group" aria-label="Что показывать ученикам на доске">
      <label><input type="checkbox" checked={item.scienceOrganicShowSystematic===true}
       disabled={!naming.systematic}
       onChange={e=>onChange(old=>({...old,scienceOrganicShowSystematic:e.target.checked}))}/>
       Показывать систематическое</label>
      <label><input type="checkbox" checked={item.scienceOrganicShowTrivial===true}
       disabled={!naming.trivial}
       onChange={e=>onChange(old=>({...old,scienceOrganicShowTrivial:e.target.checked}))}/>
       Показывать тривиальное</label>
    </div>}
    {naming.status==="unsupported"&&<small className="lektrus-organic-nomenclature-warning">{naming.reason}. Автоматическая подпись не будет показываться, чтобы не дать ошибочное название.</small>}
   </section>
   <main><LektrusOrganicCanvas item={item} onChange={onChange}/></main>
   <footer><div className="lektrus-organic-panel-result"><span>Молекулярная формула</span>
    <strong>{formula.valid?formula.formula:"Проверьте валентности"}</strong></div>
    <button type="button" onClick={onCancel}>Отмена</button>
    <button type="button" className="primary" onClick={onSave}>Сохранить на доску</button>
   </footer>
  </section>
 </div>,document.body);
}
