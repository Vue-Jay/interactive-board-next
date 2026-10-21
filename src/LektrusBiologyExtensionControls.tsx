import type {BiologyExtensionDiagram,TaxonomyGroup} from "./lektrusBiologyExtensionModel";
import {taxonomyExample,taxonomyRankLabels,taxonomyRanks} from "./lektrusBiologyExtensionModel";

export default function LektrusBiologyExtensionControls({diagram:d,onChange}:{
 diagram:BiologyExtensionDiagram;onChange:(value:BiologyExtensionDiagram)=>void
}){
 if(d.kind==="dna")return <>
  <label className="lektrus-school-field">Первая цепь ДНК, 5′ → 3′
   <input value={d.sequence} maxLength={24} spellCheck={false}
    aria-label="Последовательность ДНК" onChange={e=>
    onChange({...d,sequence:e.target.value.toUpperCase().replace(/[^ATGC]/g,"").slice(0,24)})}/>
  </label>
  <p className="lektrus-school-hint">Введите до 24 нуклеотидов A, T, G, C. Вторая цепь вычисляется по правилам комплементарности: A–T, G–C. Программа не предсказывает работу генов или свойства организма.</p>
  <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showComplement}
   onChange={e=>onChange({...d,showComplement:e.target.checked})}/>Показать вторую цепь (ответ)</label>
  <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showDirection}
   onChange={e=>onChange({...d,showDirection:e.target.checked})}/>Показать направления 5′ и 3′</label>
 </>;
 const changeGroup=(group:TaxonomyGroup)=>{
  const sample=taxonomyExample(group);
  onChange({...sample,title:d.title,showRanks:d.showRanks});
 };
 return <>
  <label className="lektrus-school-field">Группа организмов
   <select value={d.group} onChange={e=>changeGroup(e.target.value as TaxonomyGroup)}>
    <option value="animal">Животные</option>
    <option value="plant">Растения</option>
   </select>
  </label>
  <p className="lektrus-school-hint">При смене группы названия уровней и содержимое полей заменяются учебным примером. Можно изменить каждое название самостоятельно.</p>
  {taxonomyRanks.map((rank,i)=><label className="lektrus-school-field" key={rank}>
   {taxonomyRankLabels[d.group][rank]}
   <input maxLength={70} value={d.rows[i].name}
    onChange={e=>onChange({...d,rows:d.rows.map((row,j)=>j===i?{...row,name:e.target.value}:row)})}/>
  </label>)}
  <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showRanks}
   onChange={e=>onChange({...d,showRanks:e.target.checked})}/>Показывать названия таксономических рангов</label>
  <p className="lektrus-school-hint">Это школьная схема классификации, а не реконструкция эволюционного родства. Состав рангов в современной систематике может отличаться.</p>
 </>;
}
