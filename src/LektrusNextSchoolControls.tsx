import type {NextSchoolDiagram,WordRole,AlgorithmNodeKind,AlgorithmNode,AlgorithmEdge} from "./lektrusNextSchoolModel";
import {grammarRoles,flowNodeNames,validPlaceDigit} from "./lektrusNextSchoolModel";
type Props={diagram:NextSchoolDiagram;onChange:(next:NextSchoolDiagram)=>void};
const key=()=>crypto.randomUUID();
const arrows=(next:NextSchoolDiagram,change:Props["onChange"])=>change(next);
export default function LektrusNextSchoolControls({diagram:d,onChange}:Props){
 if(d.kind==="syntax")return <>
  <div className="lektrus-school-controls-heading">Слова и члены предложения</div>
  <p className="lektrus-school-hint">Введите слова по порядку и самостоятельно назначьте их синтаксическую роль. Программа ничего не определяет за ученика.</p>
  {d.words.map((w,i)=><div className="lektrus-school-edit-row" key={w.id}>
   <span className="lektrus-school-number">{i+1}</span>
   <div className="lektrus-school-edit-content">
    <input aria-label={"Слово "+(i+1)} maxLength={28} value={w.text}
     onChange={e=>arrows({...d,words:d.words.map(entry=>entry.id===w.id?{...entry,text:e.target.value}:entry)},onChange)}/>
    <select value={w.role} aria-label={"Член предложения "+(i+1)}
     onChange={e=>onChange({...d,words:d.words.map(entry=>entry.id===w.id?{...entry,role:e.target.value as WordRole}:entry)})}>
     {Object.entries(grammarRoles).map(([id,name])=><option key={id} value={id}>{name}</option>)}
    </select>
   </div>
   <div className="lektrus-school-row-actions">
    <button type="button" disabled={i===0} aria-label="Переместить слово влево" onClick={()=>{
     const words=[...d.words];[words[i-1],words[i]]=[words[i],words[i-1]];onChange({...d,words})}}>↑</button>
    <button type="button" disabled={i===d.words.length-1} aria-label="Переместить слово вправо" onClick={()=>{
     const words=[...d.words];[words[i+1],words[i]]=[words[i],words[i+1]];onChange({...d,words})}}>↓</button>
    <button type="button" disabled={d.words.length<=1} title="Убрать слово"
     onClick={()=>onChange({...d,words:d.words.filter(entry=>entry.id!==w.id)})}>×</button>
   </div>
  </div>)}
  <button type="button" className="lektrus-school-add" disabled={d.words.length>=14}
   onClick={()=>onChange({...d,words:[...d.words,{id:key(),text:"Слово",role:"none"}]})}>
   + Добавить слово ({d.words.length}/14)</button>
  <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showMarks}
   onChange={e=>onChange({...d,showMarks:e.target.checked})}/> Показывать подчёркивания</label>
  <p className="lektrus-school-hint">Одна линия: подлежащее; две: сказуемое; волнистая: определение; пунктир: дополнение; штрихпунктир: обстоятельство.</p>
 </>;
 if(d.kind==="place-value"){
  const valid=validPlaceDigit(d.digits,d.base);
  return <>
   <label className="lektrus-school-field">Основание системы
    <select value={d.base} onChange={e=>{
     const base=Number(e.target.value) as 2|8|10|16;
     const digits=[...d.digits].filter(ch=>parseInt(ch,16)<base).join("")||"0";
     onChange({...d,base,digits});
    }}>
     {[2,8,10,16].map(base=><option key={base} value={base}>Основание {base}</option>)}
    </select>
   </label>
   <label className="lektrus-school-field">Запись числа (от 1 до 10 цифр)
    <input spellCheck={false} value={d.digits} maxLength={10}
     onChange={e=>onChange({...d,digits:e.target.value.toUpperCase().replace(/[^0-9A-F]/g,"").slice(0,10)})}
     aria-invalid={!valid}/>
   </label>
   {!valid&&<p className="lektrus-school-input-error" role="alert">
    Для основания {d.base} допустимы только цифры от 0 до {d.base===16?"F":d.base-1}.
   </p>}
   <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showPowers}
    onChange={e=>onChange({...d,showPowers:e.target.checked})}/> Показывать степени основания</label>
   <p className="lektrus-school-hint">Разряды расположены справа налево от нулевого. Для самостоятельного задания скройте степени основания. Автоматического перевода в другую систему нет.</p>
  </>;
 }
 const updateNode=(id:string,patch:Partial<AlgorithmNode>)=>
  onChange({...d,nodes:d.nodes.map(n=>n.id===id?{...n,...patch}:n)});
 const updateEdge=(id:string,patch:Partial<AlgorithmEdge>)=>
  onChange({...d,edges:d.edges.map(edge=>edge.id===id?{...edge,...patch}:edge)});
 return <>
  <div className="lektrus-school-controls-heading">Блоки алгоритма</div>
  <p className="lektrus-school-hint">Фигуры соответствуют школьным блок-схемам. Для ромба «Условие» нужны два исходящих пути: «да» и «нет». У блока «Конец» не должно быть исходящих стрелок.</p>
  {d.nodes.map((n,i)=><div className="lektrus-school-edit-row lektrus-next-node-row" key={n.id}>
   <span className="lektrus-school-number">{i+1}</span>
   <div className="lektrus-school-edit-content">
    <select aria-label={"Тип блока "+(i+1)} value={n.kind}
     disabled={n.kind==="start"||n.kind==="end"}
     onChange={e=>updateNode(n.id,{kind:e.target.value as AlgorithmNodeKind})}>
     {(n.kind==="start"||n.kind==="end"?[n.kind]:["process","decision","input","output"] as AlgorithmNodeKind[])
      .map(kind=><option key={kind} value={kind}>{flowNodeNames[kind]}</option>)}
    </select>
    <input aria-label={"Текст блока "+(i+1)} value={n.label} maxLength={48}
     onChange={e=>updateNode(n.id,{label:e.target.value})}/>
    <select aria-label={"Положение блока "+(i+1)} value={n.lane}
     onChange={e=>updateNode(n.id,{lane:Number(e.target.value) as -1|0|1})}>
     <option value={-1}>Слева</option><option value={0}>По центру</option><option value={1}>Справа</option>
    </select>
   </div>
   <div className="lektrus-school-row-actions">
    <button type="button" disabled={i<=1||n.kind==="end"} title="Блок выше" onClick={()=>{
     const nodes=[...d.nodes];[nodes[i-1],nodes[i]]=[nodes[i],nodes[i-1]];onChange({...d,nodes})}}>↑</button>
    <button type="button" disabled={i>=d.nodes.length-2||n.kind==="start"} title="Блок ниже" onClick={()=>{
     const nodes=[...d.nodes];[nodes[i+1],nodes[i]]=[nodes[i],nodes[i+1]];onChange({...d,nodes})}}>↓</button>
    <button type="button" disabled={n.kind==="start"||n.kind==="end"} title="Удалить блок"
     onClick={()=>onChange({...d,nodes:d.nodes.filter(v=>v.id!==n.id),
      edges:d.edges.filter(e=>e.from!==n.id&&e.to!==n.id)})}>×</button>
   </div>
  </div>)}
  <button className="lektrus-school-add" type="button" disabled={d.nodes.length>=7}
   onClick={()=>{
    const nodes=[...d.nodes],end=nodes.findIndex(n=>n.kind==="end");
    nodes.splice(end<0?nodes.length:end,0,{id:key(),kind:"process",label:"Действие",lane:0});
    onChange({...d,nodes});
   }}>+ Добавить блок ({d.nodes.length}/7)</button>
  <div className="lektrus-school-controls-heading">Стрелки между блоками</div>
  {d.edges.map((edge,i)=><div key={edge.id} className="lektrus-next-edge-row">
   <span className="lektrus-school-number">{i+1}</span>
   <select aria-label={"От блока "+(i+1)} value={edge.from} onChange={e=>updateEdge(edge.id,{from:e.target.value})}>
    {d.nodes.filter(n=>n.kind!=="end").map(n=><option key={n.id} value={n.id}>{n.label.slice(0,19)}</option>)}
   </select>
   <span>→</span>
   <select aria-label={"К блоку "+(i+1)} value={edge.to} onChange={e=>updateEdge(edge.id,{to:e.target.value})}>
    {d.nodes.filter(n=>n.id!==edge.from).map(n=><option key={n.id} value={n.id}>{n.label.slice(0,19)}</option>)}
   </select>
   <select aria-label={"Подпись стрелки "+(i+1)} value={edge.label}
    onChange={e=>updateEdge(edge.id,{label:e.target.value as ""|"да"|"нет"})}>
    <option value="">—</option><option value="да">Да</option><option value="нет">Нет</option>
   </select>
   <button type="button" title="Удалить стрелку"
    onClick={()=>onChange({...d,edges:d.edges.filter(e=>e.id!==edge.id)})}>×</button>
  </div>)}
  <button type="button" className="lektrus-school-add" disabled={d.edges.length>=18}
   onClick={()=>{
    const from=d.nodes.find(n=>n.kind==="process"||n.kind==="start")?.id??d.nodes[0].id;
    const to=d.nodes.find(n=>n.id!==from)?.id??d.nodes[0].id;
    onChange({...d,edges:[...d.edges,{id:key(),from,to,label:""}]});
   }}>+ Добавить стрелку ({d.edges.length}/18)</button>
  <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showEdgeLabels}
   onChange={e=>onChange({...d,showEdgeLabels:e.target.checked})}/> Подписи «да» / «нет»</label>
  <p className="lektrus-school-hint">Сохранение проверяет доступность каждого блока из «Начала», ветви условий и отсутствие лишних стрелок. Это конструктор схемы, а не исполнитель алгоритмов.</p>
 </>;
}
