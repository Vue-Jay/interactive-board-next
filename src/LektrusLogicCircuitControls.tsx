import type {LogicCircuitDiagram,LogicBit,LogicSignals,LogicGate,LogicSecondGate} from "./lektrusLogicCircuitModel";
import {logicGateNames,logicSecondNames,logicGateOptions,logicSecondOptions,circuitUsesThirdInput} from "./lektrusLogicCircuitModel";

export default function LektrusLogicCircuitControls({diagram:d,onChange}:{
 diagram:LogicCircuitDiagram;onChange:(value:LogicCircuitDiagram)=>void
}){
 const updateInput=(key:keyof LogicSignals,value:LogicBit)=>
  onChange({...d,initialSignals:{...d.initialSignals,[key]:value}});
 return <>
  <div className="lektrus-school-controls-heading">Логические элементы</div>
  <label className="lektrus-school-field">Первый элемент: A и B
   <select value={d.firstGate} onChange={e=>onChange({...d,firstGate:e.target.value as LogicGate})}>
    {logicGateOptions.map(g=><option value={g} key={g}>{logicGateNames[g]}</option>)}
   </select>
  </label>
  <label className="lektrus-school-field">Второй элемент
   <select value={d.secondGate} onChange={e=>onChange({...d,secondGate:e.target.value as LogicSecondGate})}>
    {logicSecondOptions.map(g=><option value={g} key={g}>{logicSecondNames[g]}</option>)}
   </select>
  </label>
  <p className="lektrus-school-hint">Сигналы A и B поступают на первый элемент. Второй обрабатывает его выход: «НЕ» инвертирует сигнал, остальные элементы используют дополнительный вход C. Для одного элемента выберите «Без второго элемента».</p>
  <div className="lektrus-school-controls-heading">Начальные сигналы</div>
  {(["a","b","c"] as const).filter(key=>key!=="c"||circuitUsesThirdInput(d)).map(key=>
   <label className="lektrus-school-field" key={key}>{key.toUpperCase()}
    <select value={d.initialSignals[key]}
     onChange={e=>updateInput(key,Number(e.target.value) as LogicBit)}>
     <option value={0}>0 · ложь</option>
     <option value={1}>1 · истина</option>
    </select>
   </label>
  )}
  <p className="lektrus-school-hint">После вывода схемы на доску ученики смогут переключать входы самостоятельно, не изменяя сохранённые настройки объекта.</p>
  <div className="lektrus-school-controls-heading">Оформление задания</div>
  <label className="lektrus-school-toggle">
   <input type="checkbox" checked={d.showTruthTable}
    onChange={e=>onChange({...d,showTruthTable:e.target.checked})}/>
   Показывать таблицу истинности
  </label>
  <label className="lektrus-school-toggle">
   <input type="checkbox" checked={d.showResults}
    onChange={e=>onChange({...d,showResults:e.target.checked})}/>
   Показывать результаты (снять для задания)
  </label>
 </>;
}
