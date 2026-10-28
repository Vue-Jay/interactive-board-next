import {useMemo,useState} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import LektrusChemistryBenchSurface from "./LektrusChemistryBench";
import {
 addLabVessel,emptyLabVessel,removeLabVessel,putLabReagent,pourLabVessel,
 readLabBench,selectLabVessel,selectedLabVessel,setLabEnvironment,activateLabVessel,
 labIndicators,labIndicatorResult,setLabIndicator,
 type LabBench,type LabGlassware,type LabIndicator
} from "./lektrusChemistryBenchModel";
import {identifyReaction,reactionAppearance,reviewedReactionCases,substances,
 type Observation,type ReactionEnvironment} from "./lektrusReactionDatabase";
import {LektrusChemicalEquationTypeset} from "./LektrusChemicalEquationEditor";
import {subjectEditorStyle} from "./lektrusSubjectAccent";

type Props={item:Item;onChange:(next:Item)=>void;onSave:()=>void;onCancel:()=>void};
const labels:Record<LabGlassware,string>={beaker:"Стакан",tube:"Пробирка",flask:"Колба",cylinder:"Мерный цилиндр",dish:"Чашка"};
const media:{id:ReactionEnvironment;name:string;description:string}[]=[
 {id:"aqueous",name:"Водный раствор",description:"Смешивание растворов"},
 {id:"dry",name:"Сухие вещества",description:"Без растворителя"},
 {id:"heated",name:"Нагревание",description:"Тепловое воздействие"},
 {id:"ignited",name:"Горение",description:"При наличии окислителя"}
];
const observations:{id:"all"|Observation;label:string}[]=[
 {id:"all",label:"Все реакции"},{id:"precipitate",label:"Осадок"},
 {id:"gas",label:"Газ"},{id:"color",label:"Изменение цвета"},
 {id:"dissolution",label:"Растворение"},{id:"heat",label:"Тепловой эффект"}
];
const getName=(id:string)=>substances.find(x=>x.id===id)?.name??id;
export default function LektrusChemistryBenchEditor({item,onChange,onSave,onCancel}:Props){
 const bench=readLabBench(item);
 const selected=selectedLabVessel(bench);
 const observed=selected?identifyReaction(selected.reagents,selected.environment):null;
 const status=selected?(
  selected.uncertain?{status:"unknown" as const,message:"После уже прошедшей реакции следующий этап не вычисляется автоматически.",caseData:undefined}:
  selected.observed?observed:{status:"unknown" as const,message:"Добавьте реагенты или примените условия.",caseData:undefined}
 ):null;
 const [tab,setTab]=useState<"chemicals"|"examples">("chemicals");
 const [query,setQuery]=useState("");
 const [group,setGroup]=useState("Все классы");
 const [effect,setEffect]=useState<"all"|Observation>("all");
 const [pouringId,setPouringId]=useState<string|null>(null);
 const [notice,setNotice]=useState("");
 const [showInfo,setShowInfo]=useState(true);
 const indicatorResult=selected?labIndicatorResult(selected):null;
 const kinds=useMemo(()=>["Все классы",...new Set(substances.map(x=>x.kind))],[]);
 const chemicals=useMemo(()=>substances.filter(s=>(group==="Все классы"||s.kind===group)&&
  (s.formula+" "+s.name).toLocaleLowerCase("ru-RU").includes(query.toLocaleLowerCase("ru-RU"))),[query,group]);
 const examples=useMemo(()=>reviewedReactionCases.filter(r=>r.status==="reaction"&&
  r.reactants.length<=2&&(effect==="all"||effect===r.observation)&&
  (r.equation+" "+r.description+" "+r.reactants.map(getName).join(" ")).toLocaleLowerCase("ru-RU")
  .includes(query.toLocaleLowerCase("ru-RU"))),[query,effect]);
 const patch=(updated:LabBench)=>{onChange({...item,scienceLabBench:updated,
  scienceReagents:undefined,scienceExperimentStage:undefined});};
 const add=(kind:LabGlassware)=>{
  const updated=addLabVessel(bench,kind);
  if(updated===bench)setNotice("На столе может находиться не более шести сосудов.");
  else{patch(updated);setNotice(labels[kind]+" добавлен на стол.");setPouringId(null)}
 };
 const addReagent=(id:string,vesselId=selected?.id)=>{
  if(!vesselId)return;
  const next=putLabReagent(bench,vesselId,id);
  if(next.vessels.find(v=>v.id===vesselId)?.reagents.length===
     bench.vessels.find(v=>v.id===vesselId)?.reagents.length)
   setNotice("В сосуде уже есть это вещество или достигнут предел шести реагентов.");
  else{patch(next);setNotice(getName(id)+" добавлен в сосуд.")}
 };
 const pour=(sourceId:string,targetId:string)=>{
  const updated=pourLabVessel(bench,sourceId,targetId);
  setPouringId(null);
  if(updated===bench){setNotice("Переливание невозможно: проверьте содержимое и вместимость.");return}
  patch(updated);
  const result=updated.vessels.find(v=>v.id===targetId);
  const reaction=result&&!result.uncertain?identifyReaction(result.reagents,result.environment):null;
  setNotice(reaction?.status==="reaction"?"Реакция началась: наблюдайте за изменениями.":
   reaction?.status==="none"?"В выбранных условиях наблюдаемого превращения нет.":
   "Смесь получена. Для её состава в базе нет проверенного результата.");
 };
 const loadExample=(r:(typeof reviewedReactionCases)[number])=>{
  const vessels=r.reactants.map((id,i)=>({id:"v"+(i+1),
   kind:(i===0?"beaker":"tube") as LabGlassware,x:i===0?37:65,y:61,
   reagents:[id],environment:r.environment,observed:false}));
  patch({vessels,selectedId:vessels[0].id,event:bench.event+1});
  setTab("chemicals");setPouringId(null);
  setNotice(r.reactants.length===2?"Вещества разлиты отдельно. Перелейте одно в другое, чтобы провести опыт.":
    "Вещество подготовлено. Примените условия для наблюдения.");
 };
 return createPortal(<div className="lektrus-lab-editor-overlay" style={subjectEditorStyle("chemistry")}
  onPointerDown={e=>{if(e.target===e.currentTarget)onCancel()}}>
  <section className="lektrus-lab-editor" role="dialog" aria-modal="true"
   aria-label="Химический стол" onPointerDown={e=>e.stopPropagation()}>
   <header className="lektrus-lab-editor-head">
    <div className="lektrus-lab-editor-mark" aria-hidden="true">⚗</div>
    <div className="lektrus-lab-editor-heading"><strong>Химический стол</strong>
     <small>Виртуальная лаборатория · {substances.length} веществ · {reviewedReactionCases.length} сценариев</small></div>
    <button type="button" className="lektrus-lab-icon-close" onClick={onCancel}
     aria-label="Закрыть лабораторию">×</button>
   </header>
   <div className="lektrus-lab-editor-body">
    <aside className="lektrus-lab-cabinet">
     <div className="lektrus-lab-panel-head"><strong>Шкаф реактивов</strong><small>01</small></div>
     <div className="lektrus-lab-cabinet-tabs" role="group" aria-label="Режим каталога">
      <button type="button" className={tab==="chemicals"?"active":""}
       aria-pressed={tab==="chemicals"} onClick={()=>setTab("chemicals")}>Вещества</button>
      <button type="button" className={tab==="examples"?"active":""}
       aria-pressed={tab==="examples"} onClick={()=>setTab("examples")}>Опыты</button>
     </div>
     <input value={query} type="search" placeholder={tab==="chemicals"?"Название или формула":"Поиск по реакции"}
      onChange={e=>setQuery(e.target.value)} aria-label="Поиск в каталоге"/>
     {tab==="chemicals"?
      <select aria-label="Класс вещества" value={group} onChange={e=>setGroup(e.target.value)}>
       {kinds.map(v=><option key={v}>{v}</option>)}</select>:
      <select aria-label="Признак реакции" value={effect}
       onChange={e=>setEffect(e.target.value as "all"|Observation)}>
       {observations.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select>}
     <div className="lektrus-lab-catalog" role="group"
      aria-label={tab==="chemicals"?"Реагенты":"Проверенные опыты"}>
      {tab==="chemicals"?chemicals.map(v=><button key={v.id} type="button"
       draggable onDragStart={e=>e.dataTransfer.setData("application/x-lektrus-reagent",v.id)}
       onClick={()=>addReagent(v.id)} title="Добавить в выбранный сосуд или перетащить на стол">
       <b>{v.formula}</b><span>{v.name}</span><small>+</small>
      </button>):examples.map((r,i)=><button key={r.environment+"-"+r.reactants.join(",")+i}
       type="button" className="lektrus-lab-experiment-choice" onClick={()=>loadExample(r)}>
       <b>{r.reactants.join(" + ")}</b><span>{r.description}</span>
       <small>{media.find(m=>m.id===r.environment)?.name} · {observations.find(o=>o.id===r.observation)?.label}</small>
      </button>)}
      {(tab==="chemicals"?chemicals.length:examples.length)===0&&
       <div className="lektrus-lab-no-results">Совпадений в проверенной базе нет.</div>}
     </div>
     <small className="lektrus-lab-cabinet-help">Выберите сосуд, затем нажмите на вещество. Также можно перетащить реагент в сосуд. Чтобы перелить, перетащите один заполненный сосуд на другой либо нажмите «Перелить».</small>
    </aside>
    <main className="lektrus-lab-main">
     <div className="lektrus-lab-panel-head"><strong>Рабочий стол</strong>
      <small>{bench.vessels.length} из 6 сосудов</small></div>
     <div className="lektrus-lab-glassware-toolbar" aria-label="Добавить посуду">
      <button type="button" onClick={()=>add("beaker")}>＋ Стакан</button>
      <button type="button" onClick={()=>add("tube")}>＋ Пробирка</button>
      <button type="button" onClick={()=>add("flask")}>＋ Колба</button>
     </div>
     <LektrusChemistryBenchSurface bench={bench} editable pouringId={pouringId}
      onSelect={id=>{patch(selectLabVessel(bench,id));setNotice("")}}
      onPour={pour} onChange={patch} onDropReagent={addReagent}/>
     <div className="lektrus-lab-hint" role="status">{notice||(
      pouringId?"Выберите сосуд назначения. Нажмите «Отмена», чтобы прекратить переливание.":
      "Нажмите на сосуд для выбора. Перетащите его на другой, чтобы перелить содержимое.")}</div>
    </main>
    <aside className="lektrus-lab-inspector">
     <div className="lektrus-lab-panel-head"><strong>Свойства сосуда</strong><small>02</small></div>
     {selected&&<>
      <div className="lektrus-lab-selected-name"><strong>{labels[selected.kind]}</strong>
       <small>Сосуд {bench.vessels.findIndex(v=>v.id===selected.id)+1}</small></div>
      <div className="lektrus-lab-content-chips">
       {selected.reagents.length?selected.reagents.map((reagent,i)=><span key={i}
        title={getName(reagent)}>{reagent}</span>):<small>Пустой сосуд</small>}
      </div>
      <div className="lektrus-lab-indicators">
       <div className="lektrus-lab-indicator-heading"><strong>Индикаторы</strong>
        <small>Качественная оценка среды</small></div>
       <label className="lektrus-lab-condition">Добавить индикатор
        <select value={selected.indicator??""} disabled={!selected.reagents.length}
         onChange={e=>{patch(setLabIndicator(bench,selected.id,(e.target.value||undefined) as LabIndicator|undefined));
          setNotice(e.target.value?"Индикатор добавлен. Цвет зависит от состава среды.":"Индикатор убран.");}}>
         <option value="">Без индикатора</option>
         {labIndicators.map(ind=><option key={ind.id} value={ind.id}>{ind.name}</option>)}
        </select>
       </label>
       {indicatorResult&&<div className="lektrus-lab-indicator-reading" role="status">
        <span className="lektrus-lab-indicator-dot" style={{background:indicatorResult.color??"#a2a9a4"}}/>
        <span><strong>{indicatorResult.label}</strong><small>{indicatorResult.note}</small></span>
       </div>}
      </div>
      <label className="lektrus-lab-condition">Условия проведения
       <select value={selected.environment}
        onChange={e=>{patch(setLabEnvironment(bench,selected.id,e.target.value as ReactionEnvironment));setNotice("Условия изменены.")}}>
        {media.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
       </select></label>
      <div className="lektrus-lab-actions">
       <button type="button" disabled={!selected.reagents.length}
        className={pouringId===selected.id?"active":""}
        onClick={()=>{setPouringId(pouringId===selected.id?null:selected.id);setNotice("")}}>
        {pouringId===selected.id?"Отменить переливание":"↗ Перелить в…"}</button>
       <button type="button" disabled={!selected.reagents.length}
        onClick={()=>{patch(activateLabVessel(bench,selected.id));setNotice("Условия применены.")}}>
        Применить условия</button>
       <button type="button" disabled={!selected.reagents.length}
        onClick={()=>{patch(emptyLabVessel(bench,selected.id));setPouringId(null);setNotice("Сосуд очищен.")}}>
        Очистить</button>
       <button type="button" disabled={bench.vessels.length===1} className="danger"
        onClick={()=>{patch(removeLabVessel(bench,selected.id));setPouringId(null)}}>
        Убрать сосуд</button>
      </div>
      <div className={"lektrus-lab-observation is-"+(status?.status??"unknown")} aria-live="polite">
       <strong>{status?.status==="reaction"?"Реакция идёт":
        status?.status==="none"?"Реакция не идёт":"Наблюдение"}</strong>
       <p>{status?.message??"Выберите сосуд."}</p>
       {status?.status==="reaction"&&status.caseData&&<details open={showInfo}
        onToggle={e=>setShowInfo((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>Уравнение и продукты</summary>
        <LektrusChemicalEquationTypeset expression={status.caseData.equation}/>
        <div className="lektrus-lab-products">
         {reactionAppearance(status.caseData).products.map((v,i)=><span key={i}>{v}</span>)}
        </div>
        {status.caseData.safety&&<small className="lektrus-lab-safety">{status.caseData.safety}</small>}
       </details>}
      </div>
     </>}
     <small className="lektrus-lab-educational-note">Индикаторы: лакмус, фенолфталеин, метилоранж и универсальный. Цвет надёжно определяется только для однозначно кислой, щелочной или нейтральной среды.</small>
     <small className="lektrus-lab-educational-note">Модель показывает качественные признаки только проверенных реакций. Не рассчитывает скорость, концентрации или многостадийные смеси. Не является инструкцией для лабораторных опытов.</small>
    </aside>
   </div>
   <footer className="lektrus-lab-editor-footer">
    <span>Положение посуды и результаты сохраняются вместе с доской.</span>
    <button type="button" onClick={onCancel}>Закрыть</button>
    <button type="button" className="primary" onClick={onSave}>Сохранить стол на доске</button>
   </footer>
  </section>
 </div>,document.body);
}
