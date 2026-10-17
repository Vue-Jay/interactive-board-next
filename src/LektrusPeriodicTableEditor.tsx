import {useRef,useState} from "react";
import LektrusPeriodicFloatingInfo from "./LektrusPeriodicFloatingInfo";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import {periodicElements,periodicFamilies,type ElementFamily} from "./lektrusPeriodicElements";
import LektrusPeriodicTableView from "./LektrusPeriodicTableView";

type Props={item:Item;onSave:(item:Item)=>void;onCancel:()=>void;onClose?:(item:Item)=>void};
export default function LektrusPeriodicTableEditor({item,onSave,onCancel,onClose}:Props){
  const previewAnchor=useRef<HTMLDivElement>(null);
  const [selected,setSelected]=useState<number[]>(()=>[...(item.sciencePeriodicHighlights??[])]);
  const [opened,setOpened]=useState<number[]>([]);
  const [multi,setMulti]=useState(false);
  const active=opened.at(-1)??null;
  const [query,setQuery]=useState("");
  const [family,setFamily]=useState<ElementFamily|"all">("all");
  const [layout,setLayout]=useState<"school"|"long">(()=>item.sciencePeriodicLayout==="long"?"long":"school");
  const [showNames,setShowNames]=useState(item.sciencePeriodicShowNames!==false);
  const [title,setTitle]=useState(item.text||"Периодическая система элементов");
  const [notice,setNotice]=useState("");
  const results=query.trim()?periodicElements.filter(el=>
    (el.name+" "+el.symbol+" "+el.number).toLocaleLowerCase("ru-RU")
      .includes(query.trim().toLocaleLowerCase("ru-RU"))).slice(0,10):[];
  const updateItem=():Item=>({...item,text:title.trim().slice(0,100)||"Периодическая система элементов",
    graphFigureId:"chem-periodic",sciencePeriodicHighlights:selected,
    sciencePeriodicLayout:layout,sciencePeriodicShowNames:showNames});
  const pick=(number:number,event?:{ctrlKey:boolean;shiftKey:boolean})=>{
    setOpened(current=>current.includes(number)?current.filter(n=>n!==number):(multi||event?.ctrlKey||event?.shiftKey)?[...current,number]:[number]);
    setSelected(current=>{
      if(current.includes(number)){setNotice("");return current.filter(n=>n!==number)}
      if(current.length>=24){setNotice("Для наглядности можно выделить до 24 элементов.");return current}
      setNotice("");
      return [...current,number].sort((a,b)=>a-b);
    });
  };
  const focusElement=(number:number)=>{setOpened([number]);setQuery("")};
  return createPortal(
    <div className="lektrus-periodic-backdrop" onPointerDown={e=>{if(e.currentTarget===e.target)(onClose??onCancel)(updateItem())}}>
      <section className="lektrus-periodic-dialog" role="dialog" aria-modal="true" aria-label="Редактор периодической таблицы"
        onPointerDown={e=>e.stopPropagation()}>
        <header className="lektrus-periodic-header">
          <div className="lektrus-periodic-header-mark">118</div>
          <div><small>ХИМИЯ · ПРЕДМЕТНЫЙ ИНСТРУМЕНТ</small>
            <h2>Периодическая таблица</h2>
            <p>Выберите элементы для урока. Таблица сохранится вместе с доской.</p>
          </div>
          <button type="button" aria-label="Закрыть редактор" onClick={()=>(onClose??onCancel)(updateItem())}>×</button>
        </header>
        <div className="lektrus-periodic-content">
          <aside className="lektrus-periodic-panel">
            <label>Название схемы
              <input value={title} maxLength={100} onChange={e=>setTitle(e.target.value)}/>
            </label>
            <label>Найти элемент
              <input value={query} placeholder="Название, символ или номер…" onChange={e=>setQuery(e.target.value)}/>
            </label>
            {results.length>0&&<div className="lektrus-periodic-search-results">
              {results.map(el=><button type="button" key={el.number}
                onClick={()=>focusElement(el.number)}><b>{el.symbol}</b><span>{el.name}</span><small>№ {el.number}</small></button>)}
            </div>}
            {query.trim()&&!results.length&&<span className="lektrus-periodic-notfound">Не найдено</span>}
            <div className="lektrus-periodic-layout-switch" role="group" aria-label="Форма периодической таблицы" style={{display:"grid",gap:5}}>
              <strong style={{fontSize:12}}>Форма таблицы</strong>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                <button type="button" aria-pressed={layout==="school"}
                  onClick={()=>setLayout("school")} style={{minWidth:0,padding:"8px 4px",fontSize:11,fontWeight:layout==="school"?700:500,
                    border:"1px solid "+(layout==="school"?"#356bd5":"#d2dce9"),background:layout==="school"?"#e9f1ff":"#fff",
                    borderRadius:7,cursor:"pointer"}}>Российская</button>
                <button type="button" aria-pressed={layout==="long"}
                  onClick={()=>setLayout("long")} style={{minWidth:0,padding:"8px 4px",fontSize:11,fontWeight:layout==="long"?700:500,
                    border:"1px solid "+(layout==="long"?"#356bd5":"#d2dce9"),background:layout==="long"?"#e9f1ff":"#fff",
                    borderRadius:7,cursor:"pointer"}}>Современная</button>
              </div>
            </div>
            <label>Подсветить семейство
              <select value={family} onChange={e=>setFamily(e.target.value as ElementFamily|"all")}>
                <option value="all">Все семейства</option>
                {periodicFamilies.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
            <label className="lektrus-periodic-checkbox"><input type="checkbox" checked={showNames}
              onChange={e=>setShowNames(e.target.checked)}/> Показывать названия в ячейках</label>
            <div className="lektrus-periodic-selected-title">
              <strong>Выделено для урока</strong><span>{selected.length} / 24</span>
            </div>
            <div className="lektrus-periodic-selected-list">
              {selected.map(number=>{
                const el=periodicElements[number-1];
                return <button type="button" key={number} title={"Убрать "+el.name}
                  onClick={()=>pick(number)}><b>{el.symbol}</b><span>{el.name}</span><span aria-hidden="true">×</span></button>;
              })}
              {!selected.length&&<p>Нажмите на элемент таблицы, чтобы просмотреть и выделить его.</p>}
            </div>
            <button className="lektrus-periodic-reset" type="button" disabled={!selected.length} onClick={()=>{setSelected([]);setNotice("")}}>Сбросить выделение</button>
          </aside>
          <div className="lektrus-periodic-preview">
            <div className="lektrus-periodic-preview-header"><strong>Периодическая система</strong>
              <span>Щелчок выделяет элемент · повторный щелчок отменяет</span></div>
            <div className="lektrus-periodic-table-scroll" ref={previewAnchor}>
              <LektrusPeriodicTableView selected={selected} active={active}
                showNames={showNames} familyFilter={family} onPick={pick} onDoublePick={number=>setSelected(v=>v.includes(number)?v.filter(n=>n!==number):[...v,number].sort((a,b)=>a-b))} layout={layout} showInfo={active!==null} onCloseInfo={()=>setOpened([])} onToggleInfo={()=>{if(active!==null)pick(active)}}/>
              {opened.map((number,i)=><LektrusPeriodicFloatingInfo key={number} number={number} slot={i} fixed layout={layout} anchor={previewAnchor.current}
                selected={selected.includes(number)} onClose={()=>setOpened(v=>v.filter(n=>n!==number))}
                onToggle={()=>setSelected(current=>current.includes(number)?current.filter(n=>n!==number):[...current,number].sort((a,b)=>a-b))}/>)}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",padding:"3px 8px"}}><button type="button" aria-pressed={multi} onClick={()=>setMulti(v=>!v)}>Несколько окон: {multi?"вкл":"выкл"}</button></div>
            <div className="lektrus-periodic-legend">
              {periodicFamilies.map(group=><span key={group.id}><i style={{background:group.color}}/>{group.name}</span>)}
            </div>
          </div>
        </div>
        <footer>
          <span role="status">{notice||"Никаких автоматических решений, только наглядная таблица."}</span>
          <button type="button" onClick={onCancel}>Отмена</button>
          <button className="primary" type="button" onClick={()=>onSave(updateItem())}>Сохранить на доску</button>
        </footer>
      </section>
    </div>,document.body
  );
}
