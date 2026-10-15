import { useEffect, useState } from "react";

type ToolOption={id:string;label:string;available:boolean};
type Props={
  tools:ToolOption[];
  pinned:string[];
  defaults:string[];
  onChange:(next:string[])=>void;
  onClose:()=>void;
};
export default function LectrisToolbarSettings({tools,pinned,defaults,onChange,onClose}:Props){
  const [draft,setDraft]=useState<string[]>(pinned);
  useEffect(()=>setDraft(pinned),[pinned]);
  const optionById=new Map(tools.map(t=>[t.id,t]));
  const all=new Set(tools.map(t=>t.id));
  const normalized=draft.filter((v,i)=>all.has(v)&&draft.indexOf(v)===i);
  const extra=tools.filter(t=>!normalized.includes(t.id));
  const move=(id:string,step:number)=>{
    const next=[...normalized],idx=next.indexOf(id),target=idx+step;
    if(idx<0||target<0||target>=next.length)return;
    [next[idx],next[target]]=[next[target],next[idx]];
    setDraft(next);
  };
  const toggle=(id:string)=>setDraft(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
  return <div className="lectris-tools-customize-backdrop" onPointerDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className="lectris-tools-customize" role="dialog" aria-modal="true" aria-label="Настройка панели инструментов" onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();onClose()}}}>
      <header><div><small>LEKTRUS · РАБОЧЕЕ МЕСТО</small><h2>Настройка инструментов</h2></div><button type="button" onClick={onClose} aria-label="Закрыть">×</button></header>
      <p>Основные инструменты доступны сразу. Остальные остаются в меню «Ещё». Навигация, рука и петля всегда доступны отдельно.</p>
      <div className="lectris-tools-customize-sections">
        <div className="lectris-tools-customize-section">
          <h3>Основные <span>{normalized.length}</span></h3>
          <div className="lectris-tools-customize-list">{normalized.length?normalized.map((id,i)=>{
            const item=optionById.get(id);if(!item)return null;
            return <div className="lectris-tools-customize-row" key={id}>
              <span>{item.label}</span><div>
                <button type="button" title="Выше" aria-label={item.label+": выше"} disabled={i===0} onClick={()=>move(id,-1)}>↑</button>
                <button type="button" title="Ниже" aria-label={item.label+": ниже"} disabled={i===normalized.length-1} onClick={()=>move(id,1)}>↓</button>
                <button type="button" title="Убрать в дополнительные" aria-label={item.label+": убрать в дополнительные"} onClick={()=>toggle(id)}>−</button>
              </div>
            </div>;
          }):<p className="lectris-tools-customize-empty">Все инструменты перемещены в дополнительные.</p>}</div>
        </div>
        <div className="lectris-tools-customize-section">
          <h3>Дополнительные <span>{extra.length}</span></h3>
          <div className="lectris-tools-customize-list">{extra.map(item=><div className="lectris-tools-customize-row" key={item.id}>
            <span>{item.label}{!item.available&&<small> · ограничено ролью</small>}</span>
            <button type="button" title="Закрепить в основных" aria-label={item.label+": закрепить"} disabled={!item.available} onClick={()=>toggle(item.id)}>+</button>
          </div>)}</div>
        </div>
      </div>
      <footer>
        <button type="button" className="lectris-toolbar-reset" onClick={()=>setDraft(defaults)}>По умолчанию</button>
        <div><button type="button" onClick={onClose}>Отмена</button>
          <button type="button" className="lectris-toolbar-save" onClick={()=>{onChange(normalized.filter(id=>optionById.get(id)?.available));onClose()}}>Сохранить</button></div>
      </footer>
    </section>
  </div>;
}
