import type {LanguageSocialDiagram,StateNode,StateEdge} from "./lektrusLanguageSocialModel";
import {civicsTemplates,sentencePatterns,tokenizeSentence,stateEdgeNames,validateLanguageSocialDiagram} from "./lektrusLanguageSocialModel";
type Props={diagram:LanguageSocialDiagram;onChange:(value:LanguageSocialDiagram)=>void};
const newId=()=>crypto.randomUUID();
export default function LektrusLanguageSocialControls({diagram:d,onChange}:Props){
 if(d.kind==="sentence-builder"){
  const update=(id:string,text:string)=>onChange({...d,
   parts:d.parts.map(p=>p.id===id?{...p,text}:p)});
  const groups=[...new Set(sentencePatterns.map(p=>p.group))];
  const selected=sentencePatterns.find(p=>p.id===d.patternId);
  return <>
   <label className="lektrus-school-field">Инструкция ученику
    <textarea rows={2} maxLength={180} value={d.instructions}
     onChange={e=>onChange({...d,instructions:e.target.value})}/></label>
   <div className="lektrus-school-controls-heading">Справочник синтаксических конструкций</div>
   <label className="lektrus-school-field">Выберите учебный пример
    <select value={d.patternId} onChange={e=>onChange({...d,patternId:e.target.value})}>
     {groups.map(group=><optgroup key={group} label={group}>
      {sentencePatterns.filter(v=>v.group===group).map(v=>
       <option key={v.id} value={v.id}>{v.label}</option>)}
     </optgroup>)}
    </select>
   </label>
   {selected&&<p className="lektrus-school-hint"><b>{selected.sample}</b> {selected.tip}</p>}
   <button type="button" className="lektrus-school-add" onClick={()=>{
    if(!selected)return;
    const parts=tokenizeSentence(selected.sample);
    onChange({...d,parts,patternId:selected.id,showKey:false});
   }}>Загрузить пример в конструктор</button>
   <p className="lektrus-school-hint">Вы можете ввести любое своё предложение. Справочник содержит примеры пунктуационных конструкций, но не оценивает грамматику введённого текста. Знаки препинания можно прикреплять к словам или делать отдельными элементами.</p>
   <div className="lektrus-school-controls-heading">Элементы в правильном порядке (ключ ответа)</div>
   {d.parts.map((part,i)=><div className="lektrus-school-edit-row" key={part.id}>
    <span className="lektrus-school-number">{i+1}</span>
    <input aria-label={"Элемент "+(i+1)} className="lektrus-social-token-input"
     maxLength={65} value={part.text} onChange={e=>update(part.id,e.target.value)}/>
    <div className="lektrus-school-row-actions">
     <button type="button" title="Влево" disabled={i===0} onClick={()=>{
      const parts=[...d.parts];[parts[i-1],parts[i]]=[parts[i],parts[i-1]];
      onChange({...d,parts})}}>↑</button>
     <button type="button" title="Вправо" disabled={i===d.parts.length-1} onClick={()=>{
      const parts=[...d.parts];[parts[i+1],parts[i]]=[parts[i],parts[i+1]];
      onChange({...d,parts})}}>↓</button>
     <button type="button" title="Удалить" disabled={d.parts.length<=2}
      onClick={()=>onChange({...d,parts:d.parts.filter(p=>p.id!==part.id)})}>×</button>
    </div>
   </div>)}
   <button type="button" className="lektrus-school-add" disabled={d.parts.length>=24}
    onClick={()=>onChange({...d,parts:[...d.parts,{id:newId(),text:"слово"}]})}>
    + Добавить элемент ({d.parts.length}/24)</button>
   <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showHint}
    onChange={e=>onChange({...d,showHint:e.target.checked})}/> Показывать подсказку о конструкции</label>
   <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showKey}
    onChange={e=>onChange({...d,showKey:e.target.checked})}/> Показать правильный порядок на доске</label>
   <p className="lektrus-school-hint">На доске элементы перемешиваются. Ученик меняет местами две выбранные карточки и проверяет порядок. Правильный ответ по умолчанию скрыт. Это проверка последовательности, а не автоматический лингвистический разбор.</p>
  </>;
 }
 const updateNode=(id:string,change:Partial<StateNode>)=>
  onChange({...d,nodes:d.nodes.map(n=>n.id===id?{...n,...change}:n)});
 const updateEdge=(id:string,change:Partial<StateEdge>)=>
  onChange({...d,edges:d.edges.map(e=>e.id===id?{...e,...change}:e)});
 const occupied=new Set(d.nodes.map(n=>n.column+":"+n.row)).size!==d.nodes.length;
 const updateTemplate=(id:keyof typeof civicsTemplates)=>{
  const template=civicsTemplates[id];
  const nodes=structuredClone(template.nodes).map(n=>({...n,kind:n.kind as StateNode["kind"]}));
  const edges=structuredClone(template.edges).map(e=>({...e,kind:e.kind as StateEdge["kind"]}));
  onChange({...d,title:template.label,subtitle:template.subtitle,nodes,edges,templateId:id});
 };
 return <>
  <div className="lektrus-school-controls-heading">Готовые понятия обществознания</div>
  <label className="lektrus-school-field">Основа схемы
   <select value={d.templateId in civicsTemplates?d.templateId:"separation"}
    onChange={e=>onChange({...d,templateId:e.target.value})}>
    {Object.entries(civicsTemplates).map(([id,template])=>
     <option key={id} value={id}>{template.label}</option>)}
   </select></label>
  <button type="button" className="lektrus-school-add"
   onClick={()=>updateTemplate((d.templateId in civicsTemplates?d.templateId:"separation") as keyof typeof civicsTemplates)}>
   Загрузить учебную схему</button>
  <label className="lektrus-school-field">Пояснение к схеме
   <textarea rows={2} value={d.subtitle} maxLength={160}
    onChange={e=>onChange({...d,subtitle:e.target.value})}/></label>
  <p className="lektrus-school-hint">В базе находятся общие школьные понятия, а не официальные организационные схемы конкретного государства. Разделение ветвей власти означает независимость их функций, не подчинение одной ветви другой. Полномочия и структура органов зависят от страны и периода.</p>
  <div className="lektrus-school-controls-heading">Блоки схемы ({d.nodes.length}/15)</div>
  {d.nodes.map((n,i)=><div className="lektrus-social-node-editor" key={n.id}>
   <div className="lektrus-russian-edit-header"><span className="lektrus-school-number">{i+1}</span>
    <input aria-label={"Название блока "+(i+1)} maxLength={62} value={n.text}
     onChange={e=>updateNode(n.id,{text:e.target.value})}/>
    <button type="button" disabled={d.nodes.length<=1} title="Удалить блок"
     onClick={()=>onChange({...d,nodes:d.nodes.filter(v=>v.id!==n.id),
      edges:d.edges.filter(e=>e.from!==n.id&&e.to!==n.id)})}>×</button>
   </div>
   <div className="lektrus-social-position-row">
    <label>Столбец <select value={n.column} onChange={e=>updateNode(n.id,{column:Number(e.target.value) as StateNode["column"]})}>
     {[1,2,3,4].map((v,i)=><option key={v} value={i}>{v}</option>)}
    </select></label>
    <label>Строка <select value={n.row} onChange={e=>updateNode(n.id,{row:Number(e.target.value) as StateNode["row"]})}>
     {[1,2,3,4,5].map((v,i)=><option key={v} value={i}>{v}</option>)}
    </select></label>
    <label>Тип <select value={n.kind} onChange={e=>updateNode(n.id,{kind:e.target.value as StateNode["kind"]})}>
     <option value="concept">Понятие</option><option value="institution">Орган</option>
     <option value="example">Пример</option>
    </select></label>
   </div>
  </div>)}
  {occupied&&<p role="alert" className="lektrus-school-input-error">
   Два блока заняли одну клетку схемы. Выберите разные строки или столбцы перед сохранением.
  </p>}
  <button type="button" className="lektrus-school-add" disabled={d.nodes.length>=15}
   onClick={()=>{
    const taken=new Set(d.nodes.map(n=>n.row+":"+n.column));
    const index=Array.from({length:20},(_,i)=>i).find(i=>!taken.has(Math.floor(i/4)+":"+(i%4)));
    if(index===undefined)return;
    onChange({...d,nodes:[...d.nodes,{
     id:newId(),text:"Новый блок",row:Math.floor(index/4) as StateNode["row"],
     column:index%4 as StateNode["column"],kind:"concept"
    }]});
   }}>+ Добавить блок</button>
  <div className="lektrus-school-controls-heading">Связи между блоками ({d.edges.length}/26)</div>
  {d.edges.map((edge,i)=><div key={edge.id} className="lektrus-social-edge-editor">
   <span className="lektrus-school-number">{i+1}</span>
   <select aria-label={"Откуда "+(i+1)} value={edge.from}
    onChange={e=>updateEdge(edge.id,{from:e.target.value})}>
    {d.nodes.map(n=><option key={n.id} value={n.id}>{n.text}</option>)}</select>
   <select aria-label={"Куда "+(i+1)} value={edge.to}
    onChange={e=>updateEdge(edge.id,{to:e.target.value})}>
    {d.nodes.map(n=><option key={n.id} value={n.id}>{n.text}</option>)}</select>
   <select aria-label={"Тип связи "+(i+1)} value={edge.kind}
    onChange={e=>updateEdge(edge.id,{kind:e.target.value as StateEdge["kind"]})}>
    {Object.entries(stateEdgeNames).map(([kind,name])=><option key={kind} value={kind}>{name}</option>)}
   </select>
   <button type="button" title="Удалить связь" onClick={()=>
    onChange({...d,edges:d.edges.filter(v=>v.id!==edge.id)})}>×</button>
  </div>)}
  <button type="button" className="lektrus-school-add" disabled={d.nodes.length<2||d.edges.length>=26}
   onClick={()=>{
    const first=d.nodes[0],second=d.nodes[1];
    const candidate={id:newId(),from:first.id,to:second.id,kind:"part" as const};
    onChange({...d,edges:[...d.edges,candidate]});
   }}>+ Добавить связь</button>
  <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showRelationships}
   onChange={e=>onChange({...d,showRelationships:e.target.checked})}/> Подписи связей</label>
  <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showLabels}
   onChange={e=>onChange({...d,showLabels:e.target.checked})}/> Подписи блоков (отключить для задания)</label>
  {!validateLanguageSocialDiagram(d)&&<p role="alert" className="lektrus-school-input-error">
   Проверьте блоки и связи: повторов, связей с самим собой и пересечений ячеек быть не должно.
  </p>}
 </>;
}
