import {elementFacts} from "./lektrusElementFacts";
import {periodicElements,periodicFamilies} from "./lektrusPeriodicElements";
type Props={number:number;isSelected?:boolean;onToggle?:()=>void;onClose?:()=>void;compact?:boolean};
const show=(value:unknown)=>value==null||value===""?"—":String(value);
const phases:Record<string,string>={solid:"Твёрдое",liquid:"Жидкое",gas:"Газ",Solid:"Твёрдое",Liquid:"Жидкое",Gas:"Газ"};
export default function LektrusElementInfo({number,isSelected=false,onToggle,onClose,compact=false}:Props){
 const el=periodicElements[number-1],fact=elementFacts[number-1];
 if(!el||!fact)return null;
 const family=periodicFamilies.find(f=>f.id===el.family);
 const fields:[string,string][]=[
  ["Атомный номер Z",String(el.number)],
  ["Относительная атомная масса Ar",show(fact.atomicMass)],
  ["Период",String(el.period)],
  ["Группа",el.family==="lanthanoid"||el.family==="actinoid"?"f-блок":String(el.group)],
  ["Семейство",family?.name??"—"],
  ["Электронная конфигурация",show(fact.electronConfiguration)],
  ["Электроотрицательность (Полинг)",show(fact.electronegativity)],
  ["Степени окисления",show(fact.oxidationStates)],
  ["Агрегатное состояние",phases[fact.standardState??""]??"Не установлено"],
  ["Энергия ионизации, кДж/моль",show(fact.ionizationEnergy)],
  ["Температура плавления, K",show(fact.meltingPoint)],
  ["Температура кипения, K",show(fact.boilingPoint)],
  ["Плотность*, г/см³",show(fact.density)]
 ];
 return <div className={"lektrus-element-info"+(compact?" compact":"")} role="region" aria-label={"Свойства: "+el.name}>
  <div className="lektrus-element-info-header">
   <span className="lektrus-element-info-symbol" style={{background:family?.color??"#e9f0fb"}}>
    <small>{el.number}</small><strong>{el.symbol}</strong>
   </span>
   <div className="lektrus-element-info-title"><b>{el.name}</b><small>{family?.name}</small></div>
   {onClose&&<button type="button" className="lektrus-element-info-close" onClick={onClose} aria-label="Закрыть">×</button>}
  </div>
  <div className="lektrus-element-info-fields">
   {fields.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}
  </div>
  <small className="lektrus-element-disclaimer">* Плотность приведена из справочника, единицы для газов могут отличаться. Данные справочные; неизвестные величины обозначены «—».</small>
  {onToggle&&<button className="lektrus-element-info-toggle" type="button" onClick={onToggle}>
   {isSelected?"Снять выделение":"Выделить на таблице"}</button>}
 </div>;
}
