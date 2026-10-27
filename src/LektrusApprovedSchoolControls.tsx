import type {ApprovedSchoolDiagram,MorphemeRole} from "./lektrusApprovedSchoolModel";
import {morphemeNames} from "./lektrusApprovedSchoolModel";
const sortMorphemeRoles=(segments:Extract<ApprovedSchoolDiagram,{kind:"morphemes"}>["segments"])=>
 [...segments].sort((a,b)=>["prefix","root","suffix","ending","postfix"].indexOf(a.role)-
  ["prefix","root","suffix","ending","postfix"].indexOf(b.role));
type Props={diagram:ApprovedSchoolDiagram;onChange:(diagram:ApprovedSchoolDiagram)=>void};
const createId=()=>crypto.randomUUID();
export default function LektrusApprovedSchoolControls({diagram:d,onChange}:Props){
 if(d.kind==="morphemes"){
  return <>
   <div className="lektrus-school-controls-heading">Части слова слева направо</div>
   <p className="lektrus-school-hint">Введите части слова по порядку. Значки появятся на схеме автоматически; приложение не угадывает морфемы за преподавателя.</p>
   {d.segments.map((segment,i)=><div className="lektrus-school-edit-row" key={segment.id}>
    <span className="lektrus-school-number">{i+1}</span>
    <div className="lektrus-school-edit-content">
     <input value={segment.text} maxLength={24} aria-label={"Морфема "+(i+1)}
      onChange={e=>onChange({...d,segments:d.segments.map(m=>m.id===segment.id?{...m,text:e.target.value}:m)})}/>
     <select aria-label={"Тип морфемы "+(i+1)} value={segment.role}
      onChange={e=>{
       const role=e.target.value as MorphemeRole;
       if(role==="root"&&d.segments.filter(m=>m.role==="root"&&m.id!==segment.id).length>=2)return;
       if(role==="ending"&&d.segments.some(m=>m.role==="ending"&&m.id!==segment.id))return;
       if(role==="postfix"&&d.segments.some(m=>m.role==="postfix"&&m.id!==segment.id))return;
       if(segment.role==="root"&&role!=="root"&&d.segments.filter(m=>m.role==="root").length<=1)return;
       onChange({...d,zeroEnding:role==="ending"?false:d.zeroEnding,
         segments:sortMorphemeRoles(d.segments.map(m=>m.id===segment.id?{...m,role}:m))});
      }}>
      {Object.entries(morphemeNames).map(([id,title])=><option key={id} value={id}>{title}</option>)}
     </select>
    </div>
    <div className="lektrus-school-row-actions">
     <button type="button" title="Раньше" disabled={i===0||d.segments[i-1].role!==segment.role} onClick={()=>{
      const segments=[...d.segments];[segments[i-1],segments[i]]=[segments[i],segments[i-1]];
      onChange({...d,segments})}}>↑</button>
     <button type="button" title="Позже" disabled={i===d.segments.length-1||d.segments[i+1].role!==segment.role} onClick={()=>{
      const segments=[...d.segments];[segments[i+1],segments[i]]=[segments[i],segments[i+1]];
      onChange({...d,segments})}}>↓</button>
     <button type="button" title="Удалить" disabled={d.segments.length<=1||(segment.role==="root"&&d.segments.filter(m=>m.role==="root").length<=1)}
      onClick={()=>onChange({...d,segments:d.segments.filter(m=>m.id!==segment.id)})}>×</button>
    </div>
   </div>)}
   <div className="lektrus-morpheme-add-roles" role="group" aria-label="Добавить часть слова">
    {(["prefix","root","suffix","ending","postfix"] as MorphemeRole[]).map(role=>
     <button type="button" key={role} className="lektrus-school-add"
      disabled={d.segments.length>=10||
       (d.segments.length===0&&role!=="root")||
       (role==="root"&&d.segments.filter(m=>m.role==="root").length>=2)||
       (role==="ending"&&d.segments.some(m=>m.role==="ending"))||
       (role==="postfix"&&d.segments.some(m=>m.role==="postfix"))}
      onClick={()=>onChange({...d,zeroEnding:role==="ending"?false:d.zeroEnding,
       segments:sortMorphemeRoles([...d.segments,{id:createId(),text:"",role}])})}>
      + {morphemeNames[role]}</button>)}
   </div>
   <label className="lektrus-school-toggle"><input type="checkbox" checked={d.zeroEnding}
    disabled={d.segments.some(m=>m.role==="ending")}
    onChange={e=>onChange({...d,zeroEnding:e.target.checked})}/>
    Нулевое окончание (∅)</label>
   <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showMarks}
    onChange={e=>onChange({...d,showMarks:e.target.checked})}/> Обозначения морфем</label>
   <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showBase}
    onChange={e=>onChange({...d,showBase:e.target.checked})}/> Показывать основу слова</label>
   <p className="lektrus-school-hint">Для демонстрации можно скрыть обозначения. При добавлении окончания нулевое окончание отключается автоматически. Пустые части предназначены для редактирования, а не для готового ответа.</p>
  </>;
 }
 if(d.kind==="family-tree"){
  const person=(id:string,patch:{name?:string;parents?:string[]})=>
   onChange({...d,people:d.people.map(v=>v.id===id?{...v,...patch}:v)});
  return <>
   <div className="lektrus-school-controls-heading">Участники и родительские связи</div>
   <p className="lektrus-school-hint">Добавляйте участников и выбирайте до двух родителей для каждого. Связи не определяются автоматически. Программа не разрешает циклы и ссылки на удалённого участника.</p>
   {d.people.map((p,i)=><div key={p.id} className="lektrus-approved-person">
    <div className="lektrus-approved-person-heading"><span className="lektrus-school-number">{i+1}</span>
     <input value={p.name} maxLength={35} aria-label={"Имя участника "+(i+1)}
      onChange={e=>person(p.id,{name:e.target.value})}/>
     <button type="button" disabled={d.people.length===1} title="Удалить участника"
      onClick={()=>onChange({...d,people:d.people.filter(v=>v.id!==p.id).map(v=>({
       ...v,parents:v.parents.filter(id=>id!==p.id)}))})}>×</button>
    </div>
    <div className="lektrus-approved-parents">
     {[0,1].map(slot=><label key={slot}>Родитель {slot+1}
      <select value={p.parents[slot]??""} onChange={e=>{
       const parents=[...p.parents];parents[slot]=e.target.value;
       person(p.id,{parents:parents.filter(Boolean)});
      }}>
       <option value="">Не указан</option>
       {d.people.filter(candidate=>candidate.id!==p.id).map(candidate=>
        <option value={candidate.id} key={candidate.id}>{candidate.name}</option>)}
      </select>
     </label>)}
    </div>
   </div>)}
   <button className="lektrus-school-add" type="button" disabled={d.people.length>=12}
    onClick={()=>onChange({...d,people:[...d.people,{id:createId(),name:"Участник",parents:[]}]})}>
    + Добавить участника ({d.people.length}/12)</button>
   <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showGenerations}
    onChange={e=>onChange({...d,showGenerations:e.target.checked})}/> Подписывать поколения</label>
   <p className="lektrus-school-hint">Связи отображаются сверху вниз от родителей к детям. Родство и поколение выводятся из заданных вами связей, а не из фамилий. Можно использовать вымышленных персонажей.</p>
  </>;
 }
 const setCard=(id:string,patch:Partial<(typeof d.cards)[number]>)=>
  onChange({...d,cards:d.cards.map(card=>card.id===id?{...card,...patch}:card)});
 return <>
  <label className="lektrus-school-field">Лицевая сторона
   <select value={d.direction} onChange={e=>onChange({...d,direction:e.target.value as "foreign-first"|"russian-first"})}>
    <option value="foreign-first">Иностранное слово</option>
    <option value="russian-first">Перевод</option>
   </select>
  </label>
  <div className="lektrus-school-controls-heading">Карточки слов и выражений</div>
  {d.cards.map((card,i)=><div className="lektrus-approved-card-editor" key={card.id}>
   <div className="lektrus-approved-card-heading">
    <span className="lektrus-school-number">{i+1}</span><strong>Карточка {i+1}</strong>
    <div className="lektrus-school-row-actions">
     <button type="button" title="Выше" disabled={i===0} onClick={()=>{
      const cards=[...d.cards];[cards[i-1],cards[i]]=[cards[i],cards[i-1]];onChange({...d,cards})}}>↑</button>
     <button type="button" title="Ниже" disabled={i===d.cards.length-1} onClick={()=>{
      const cards=[...d.cards];[cards[i+1],cards[i]]=[cards[i],cards[i+1]];onChange({...d,cards})}}>↓</button>
     <button type="button" title="Удалить" disabled={d.cards.length===1}
      onClick={()=>onChange({...d,cards:d.cards.filter(v=>v.id!==card.id)})}>×</button>
    </div>
   </div>
   <label>Иностранное слово или выражение
    <input value={card.term} maxLength={65} onChange={e=>setCard(card.id,{term:e.target.value})}/></label>
   <label>Перевод
    <input value={card.translation} maxLength={80} onChange={e=>setCard(card.id,{translation:e.target.value})}/></label>
   <label>Транскрипция (необязательно)
    <input value={card.transcription} maxLength={75} onChange={e=>setCard(card.id,{transcription:e.target.value})}/></label>
  </div>)}
  <button type="button" className="lektrus-school-add" disabled={d.cards.length>=30}
   onClick={()=>onChange({...d,cards:[...d.cards,{id:createId(),term:"new word",translation:"перевод",transcription:""}]})}>
   + Добавить карточку ({d.cards.length}/30)</button>
  <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showTranslation}
   onChange={e=>onChange({...d,showTranslation:e.target.checked})}/> Сразу показывать подсказку с переводом</label>
  <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showTranscription}
   onChange={e=>onChange({...d,showTranscription:e.target.checked})}/> Показывать транскрипцию</label>
  <p className="lektrus-school-hint">На доске карточку можно перевернуть нажатием и перейти к следующей. Ответ скрыт по умолчанию. Переводы и транскрипцию вводит преподаватель, аудиопроизношение пока не включено.</p>
 </>;
}
