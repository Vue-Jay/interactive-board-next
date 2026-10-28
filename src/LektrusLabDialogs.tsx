import {useMemo,useState} from "react";
import {createPortal} from "react-dom";
import type {LabBench,LabDose} from "./lektrusChemistryBenchModel";
import {labBenchSettings,labGlassware} from "./lektrusChemistryBenchModel";
import {substances} from "./lektrusReactionDatabase";

type DoseProps={
 bench:LabBench;onClose:()=>void;onAdd:(id:string,dose:LabDose)=>void;
};
export function LektrusLabReagentCabinet({bench,onClose,onAdd}:DoseProps){
 const [query,setQuery]=useState("");
 const [kind,setKind]=useState("Все вещества");
 const [selected,setSelected]=useState(substances.find(v=>v.id==="H2O")?.id??substances[0]?.id??"");
 const [unit,setUnit]=useState<LabDose["unit"]>("ml");
 const [rawAmount,setRawAmount]=useState("10");
 const [notice,setNotice]=useState("");
 const substance=substances.find(s=>s.id===selected);
 const kinds=useMemo(()=>["Все вещества",...new Set(substances.map(s=>s.kind))],[]);
 const found=useMemo(()=>substances.filter(s=>
  (kind==="Все вещества"||kind===s.kind)&&
  (s.name+" "+s.formula).toLocaleLowerCase("ru-RU").includes(query.trim().toLocaleLowerCase("ru-RU"))
 ).slice(0,120),[kind,query]);
 const target=bench.vessels.find(v=>v.id===bench.selectedId)??bench.vessels[0];
 const amount=Number(rawAmount.replace(",","."));
 const valid=Number.isFinite(amount)&&amount>0&&amount<=10000&&Math.round(amount*100)===amount*100;
 const add=()=>{
  if(!substance||!target||!valid)return;
  onAdd(substance.id,{value:amount,unit});
  setNotice(`${substance.formula}: порция ${amount.toLocaleString("ru-RU")} ${unit==="ml"?"мл":"г"} передана в ${labGlassware.find(x=>x.id===target.kind)?.name.toLowerCase()??"сосуд"}.`);
 };
 return createPortal(<div className="lektrus-lab-dialog-backdrop" style={{zIndex:2147482800}}
   onPointerDown={e=>{e.stopPropagation();if(e.target===e.currentTarget)onClose()}}>
  <section className="lektrus-lab-dialog lektrus-lab-reagent-dialog" role="dialog" aria-modal="true"
   aria-label="Шкаф с реактивами" onPointerDown={e=>e.stopPropagation()}>
   <header><div><small>ЛАБОРАТОРИЯ · ШКАФ 01</small><h2>Шкаф реактивов</h2>
    <p>Выберите вещество и отмерьте виртуальную порцию</p></div>
    <button type="button" className="lektrus-lab-dialog-close" onClick={onClose} aria-label="Закрыть шкаф">×</button>
   </header>
   <div className="lektrus-lab-dialog-content">
    <section className="lektrus-lab-reagent-list">
     <label className="lektrus-lab-dialog-field">Поиск вещества
      <input type="search" autoFocus value={query} placeholder="Название или формула"
       onChange={e=>setQuery(e.target.value)}/></label>
     <select aria-label="Класс вещества" value={kind} onChange={e=>setKind(e.target.value)}>
      {kinds.map(v=><option key={v}>{v}</option>)}
     </select>
     <div className="lektrus-lab-reagent-grid" role="group" aria-label="Каталог реактивов">
      {found.map(s=><button type="button" key={s.id} className={selected===s.id?"active":""}
       aria-pressed={selected===s.id} onClick={()=>{setSelected(s.id);setNotice("");}}>
       <strong>{s.formula}</strong><span>{s.name}</span>
      </button>)}
      {!found.length&&<span className="lektrus-lab-no-results">Ничего не найдено</span>}
     </div>
    </section>
    <section className="lektrus-lab-dose-panel">
     <div className="lektrus-lab-dose-bottle" aria-hidden="true">
      <svg viewBox="0 0 88 116" width="88" height="116">
       <rect x="27" y="8" width="34" height="16" rx="5" fill="#3d7264"/>
       <rect x="22" y="22" width="44" height="79" rx="10" fill="#d8ece4" stroke="#7baa98" strokeWidth="2"/>
       <rect x="26" y="46" width="36" height="44" rx="5" fill="#8bbdab" opacity=".7"/>
       <rect x="24" y="48" width="40" height="29" rx="4" fill="#f9fbef"/>
       <text x="44" y="65" fill="#356b56" fontSize="10" textAnchor="middle" fontWeight="700">{(substance?.formula??"").slice(0,9)}</text>
      </svg>
     </div>
     <strong className="lektrus-lab-dose-name">{substance?.name??"Выберите реактив"}</strong>
     <span className="lektrus-lab-dose-formula">{substance?.formula}</span>
     <div className="lektrus-lab-dose-mode" role="group" aria-label="Единицы порции">
      <button type="button" aria-pressed={unit==="ml"} onClick={()=>{setUnit("ml");setRawAmount("10");}}>Объём · мл</button>
      <button type="button" aria-pressed={unit==="g"} onClick={()=>{setUnit("g");setRawAmount("1");}}>Масса · г</button>
     </div>
     <label className="lektrus-lab-dialog-field">Количество
      <div className="lektrus-lab-amount-field">
       <input type="number" inputMode="decimal" min="0.01" max="10000" step="0.01"
        value={rawAmount} onChange={e=>setRawAmount(e.target.value)}/>
       <strong>{unit==="ml"?"мл":"г"}</strong>
      </div>
     </label>
     <div className="lektrus-lab-dose-presets">
      {(unit==="ml"?[1,5,10,25,50]:[.1,.5,1,5,10]).map(n=>
       <button type="button" key={n} onClick={()=>setRawAmount(String(n))}>{n}</button>)}
     </div>
     <div className="lektrus-lab-dose-target">
      <small>СОСУД НАЗНАЧЕНИЯ</small>
      <strong>{target?labGlassware.find(v=>v.id===target.kind)?.name:"Нет посуды на столе"}</strong>
      {!target&&<span>Сначала возьмите посуду из шкафа справа.</span>}
     </div>
     <button type="button" className="lektrus-lab-dose-add" disabled={!target||!substance||!valid} onClick={add}>
      Отлить / отмерить в сосуд
     </button>
     {notice&&<p className="lektrus-lab-dose-notice" role="status">{notice}</p>}
     {!valid&&rawAmount&&<small className="lektrus-lab-dose-warning">Допустимо от 0,01 до 10 000 с точностью 0,01.</small>}
     <small className="lektrus-lab-dose-disclaimer">Количество сохраняется для наглядности. Без концентрации и состава многокомпонентной смеси расчёт выхода продуктов не выполняется.</small>
    </section>
   </div>
  </section>
 </div>,document.body);
}
type SettingsProps={bench:LabBench;onChange:(bench:LabBench)=>void;onClose:()=>void};
export function LektrusLabTableSettings({bench,onChange,onClose}:SettingsProps){
 const settings=labBenchSettings(bench);
 const toggle=(key:keyof typeof settings)=>
  onChange({...bench,settings:{...settings,[key]:!settings[key]},event:bench.event+1});
 return createPortal(<div className="lektrus-lab-dialog-backdrop" style={{zIndex:2147482800}}
   onPointerDown={e=>{e.stopPropagation();if(e.target===e.currentTarget)onClose()}}>
   <section className="lektrus-lab-dialog lektrus-lab-settings-dialog" role="dialog"
    aria-modal="true" aria-label="Настройки химического стола"
    onPointerDown={e=>e.stopPropagation()}>
    <header><div><small>ЛАБОРАТОРИЯ · ПАРАМЕТРЫ СЦЕНЫ</small><h2>Настройки стола</h2>
     <p>Только оформление и поведение химической лаборатории</p></div>
     <button type="button" className="lektrus-lab-dialog-close" onClick={onClose} aria-label="Закрыть настройки">×</button>
    </header>
    <div className="lektrus-lab-setting-list">
     {([
      {key:"showEquationBoard",title:"Доска с уравнениями",desc:"Показывать на стене реакцию выбранного сосуда. Если данных нет, выводить честное пояснение"},
      {key:"showVesselLabels",title:"Подписи под посудой",desc:"Названия сосудов и состав под стеклом"},
      {key:"animateEffects",title:"Анимации опытов",desc:"Переливание, пузырьки газа, выпадение осадка и движение жидкости"}
     ] as const).map(option=><label className="lektrus-lab-setting-row" key={option.key}>
      <span><strong>{option.title}</strong><small>{option.desc}</small></span>
      <input type="checkbox" checked={settings[option.key]} onChange={()=>toggle(option.key)}/>
     </label>)}
    </div>
    <footer><small>Настройки сохраняются вместе с химическим столом и доступны другим участникам доски.</small>
     <button type="button" onClick={onClose}>Готово</button></footer>
   </section>
  </div>,document.body);
}
