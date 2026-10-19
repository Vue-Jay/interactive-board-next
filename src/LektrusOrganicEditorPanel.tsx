import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import LektrusOrganicCanvas from "./LektrusOrganicCanvas";
import {analyzeOrganicStructure} from "./lektrusOrganicFormula";
type Props={item:Item;onChange:(updater:(item:Item)=>Item)=>void;onSave:()=>void;onCancel:()=>void};
export default function LektrusOrganicEditorPanel({item,onChange,onSave,onCancel}:Props){
 const formula=analyzeOrganicStructure(item);
 return createPortal(<div className="lektrus-organic-overlay" onPointerDown={e=>{if(e.target===e.currentTarget)onCancel()}}>
  <section className="lektrus-organic-panel" role="dialog" aria-modal="true" aria-label="Органический редактор"
   onPointerDown={e=>e.stopPropagation()}>
   <header><div><strong>Органический редактор</strong><small>Атомы · связи · циклы · функциональные группы</small></div>
    <button type="button" aria-label="Закрыть" onClick={onCancel}>×</button></header>
   <label className="lektrus-organic-name">Название структуры
    <input type="text" maxLength={110} value={item.text}
     onChange={e=>onChange(old=>({...old,text:e.target.value}))}/>
   </label>
   <main><LektrusOrganicCanvas item={item} onChange={onChange}/></main>
   <footer><span>{formula.valid?formula.formula:"Требуется проверка валентностей"}</span>
    <button type="button" onClick={onCancel}>Отмена</button>
    <button type="button" className="primary" onClick={onSave}>Вывести на доску</button>
   </footer>
  </section>
 </div>,document.body);
}
