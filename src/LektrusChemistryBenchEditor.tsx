import {useState} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import LektrusChemistryBenchSurface from "./LektrusChemistryBench";
import {
 emptyLabVessel,labGlassware,labIndicatorResult,labIndicators,
 labObservation,pourLabVessel,putLabReagent,readLabBench,selectLabVessel,
 selectedLabVessel,setLabEnvironment,setLabIndicator,type LabBench,
 type LabIndicator
} from "./lektrusChemistryBenchModel";
import {reactionAppearance,reviewedReactionCases,substances,
 type ReactionEnvironment} from "./lektrusReactionDatabase";
import {LektrusChemicalEquationTypeset} from "./LektrusChemicalEquationEditor";
import {subjectEditorStyle} from "./lektrusSubjectAccent";

type Props={item:Item;onChange:(next:Item)=>void;onSave:()=>void;onCancel:()=>void};
const media:{id:ReactionEnvironment;name:string}[]=[
 {id:"aqueous",name:"Водный раствор"},{id:"dry",name:"Сухая среда"}
];
const getName=(id:string)=>labGlassware.find(v=>v.id===id)?.name??"Посуда";
export default function LektrusChemistryBenchEditor({item,onChange,onSave,onCancel}:Props){
 const bench=readLabBench(item);
 const selected=selectedLabVessel(bench);
 const status=selected?labObservation(selected):null;
 const indicatorResult=selected?labIndicatorResult(selected):null;
 const [pouringId,setPouringId]=useState<string|null>(null);
 const [notice,setNotice]=useState("");
 const patch=(updated:LabBench)=>{
  if(updated!==bench)onChange({...item,scienceLabBench:updated,
   scienceReagents:undefined,scienceExperimentStage:undefined});
 };
 const addReagent=(id:string,reagent:string,dose?:{value:number;unit:"ml"|"g"})=>{
  const updated=putLabReagent(bench,id,reagent,dose);
  if(updated===bench){setNotice("Нельзя добавить вещество: проверьте объём или содержимое");return}
  patch(updated);setNotice(reagent+" добавлен в сосуд");
 };
 const pour=(from:string,to:string)=>{
  const updated=pourLabVessel(bench,from,to);
  setPouringId(null);
  if(updated===bench){setNotice("Переливание невозможно: проверьте содержимое");return}
  patch(updated);setNotice("Содержимое перелито вместе с продуктами реакции");
 };
 return createPortal(<div className="lektrus-lab-editor-overlay" style={subjectEditorStyle("chemistry")}
  onPointerDown={e=>{if(e.target===e.currentTarget)onCancel()}}>
  <section className="lektrus-lab-editor" role="dialog" aria-modal="true"
   aria-label="Химический стол" onPointerDown={e=>e.stopPropagation()}>
   <header className="lektrus-lab-editor-head">
    <div className="lektrus-lab-editor-mark" aria-hidden="true">⚗</div>
    <div className="lektrus-lab-editor-heading"><strong>Химический стол</strong>
     <small>Виртуальная лаборатория · {substances.length} веществ · {reviewedReactionCases.length} проверенных опытов</small></div>
    <button type="button" className="lektrus-lab-icon-close" onClick={onCancel}
     aria-label="Закрыть лабораторию">×</button>
   </header>
   <div className="lektrus-lab-editor-body is-laboratory-layout">
    <main className="lektrus-lab-main">
     <div className="lektrus-lab-panel-head"><strong>Лаборатория</strong>
      <small>{bench.vessels.length} из 6 сосудов</small></div>
     <div className="lektrus-lab-editor-bench-viewport" data-board-interactive="true"
      role="region" tabIndex={0} aria-label="Прокручиваемая лаборатория"
      onWheel={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()}>
      <LektrusChemistryBenchSurface bench={bench} editable pouringId={pouringId}
       onSelect={id=>{patch(selectLabVessel(bench,id));setNotice("")}}
       onPour={pour} onChange={patch} onDropReagent={addReagent}/>
     </div>
     <div className="lektrus-lab-hint" role="status">{notice||
      "Шкаф посуды: возьмите сосуд. Шкаф реактивов: отмерьте вещество. Слив: раковина."}</div>
    </main>
    <aside className="lektrus-lab-inspector">
     <div className="lektrus-lab-panel-head"><strong>Опыт и наблюдения</strong><small>Лабораторный журнал</small></div>
     {selected?<>
      <div className="lektrus-lab-selected-name"><strong>{getName(selected.kind)}</strong>
       <small>Сосуд {bench.vessels.findIndex(v=>v.id===selected.id)+1}</small></div>
      <div className="lektrus-lab-content-chips">
       {selected.reagents.length?selected.reagents.map(id=><span key={id}>
        {id} {selected.doses?.[id]&&<small>{selected.doses[id].value} {selected.doses[id].unit==="ml"?"мл":"г"}</small>}
       </span>):<small>Чистая посуда</small>}
      </div>
      <label className="lektrus-lab-condition">Среда в сосуде
       <select value={selected.environment} onChange={e=>
        patch(setLabEnvironment(bench,selected.id,e.target.value as ReactionEnvironment))}>
        {media.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
       </select>
      </label>
      <label className="lektrus-lab-condition">Индикатор
       <select value={selected.indicator??""} disabled={!selected.reagents.length}
        onChange={e=>patch(setLabIndicator(bench,selected.id,
         (e.target.value||undefined) as LabIndicator|undefined))}>
        <option value="">Без индикатора</option>
        {labIndicators.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
       </select>
      </label>
      {indicatorResult&&<div className="lektrus-lab-indicator-reading">
       <span className="lektrus-lab-indicator-dot" style={{background:indicatorResult.color??"#b2bbb5"}}/>
       <span><strong>{indicatorResult.label}</strong><small>{indicatorResult.note}</small></span>
      </div>}
      <div className="lektrus-lab-actions">
       <button type="button" disabled={!selected.reagents.length}
        className={pouringId===selected.id?"active":""}
        onClick={()=>setPouringId(pouringId===selected.id?null:selected.id)}>
        {pouringId===selected.id?"Отменить переливание":"⇢ Перелить в другой"}</button>
       <button type="button" disabled={!selected.reagents.length}
        onClick={()=>patch(emptyLabVessel(bench,selected.id))}>Слить в раковину</button>
      </div>
      <div className={"lektrus-lab-observation is-"+(status?.status??"unknown")} aria-live="polite">
       <strong>{status?.status==="reaction"?"Наблюдаемая реакция":
        status?.status==="none"?"Реакция не идёт":"Результат не определён"}</strong>
       <p>{status?.message}</p>
       {status?.status==="reaction"&&status.caseData&&<>
        <LektrusChemicalEquationTypeset expression={status.caseData.equation}/>
        <div className="lektrus-lab-products">
         {reactionAppearance(status.caseData).products.map((v,i)=><span key={i}>{v}</span>)}
        </div>
       </>}
      </div>
     </>:<p className="lektrus-lab-empty-message">Возьмите посуду из шкафа на стене.</p>}
     <small className="lektrus-lab-educational-note">Температура меняется при работе плитки или горелки.
      Приборы под штативом взаимодействуют с опущенным зажимом. Проверяются только известные реакции;
      объём и масса сохраняются, но неизвестный химический выход не рассчитывается.</small>
    </aside>
   </div>
   <footer className="lektrus-lab-editor-footer">
    <span>Все изменения сразу видны участникам доски. Закрытие окна не отменяет опыт.</span>
    <button type="button" className="primary" onClick={onSave}>Готово</button>
   </footer>
  </section>
 </div>,document.body);
}
