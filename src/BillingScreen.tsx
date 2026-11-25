import {useEffect,useRef,useState} from "react";
import {plans} from "./billingStore";
import {isSelfhostBackendEnabled,selfhostRequest} from "./selfhostApi";
import {StorageMeter,formatStorage,type StorageUsage} from "./StorageUsage";
import "./BillingScreen.css";

type Billing={plan:"free"|"pro";is_admin:boolean;unlimited:boolean;until:string|null;usage:{boards:number;students:number;groups:number;templates:number;storage_bytes:number};boards:{id:string;title:string;active:boolean}[];storage?:StorageUsage};
type IconName="back"|"refresh"|"shield"|"spark"|"board"|"users"|"group"|"template"|"storage"|"folder"|"book"|"info"|"check"|"chevron"|"chart";
const paths:Record<IconName,string>={
 back:"M19 12H5m7-7-7 7 7 7",refresh:"M20 11a8 8 0 1 0-2 6M20 4v7h-7",
 shield:"M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11ZM9 12l2 2 4-4",
 spark:"m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
 board:"M4 4h16v13H4zM8 21l4-4 4 4M8 8h8m-8 4h5",
 users:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.9M16 3a4 4 0 0 1 0 8",
 group:"M3 5h18v14H3zM7 9h4m2 0h4M7 13h4m2 0h4",
 template:"M8 3h13v13H8zM3 8v13h13",
 storage:"M4 5h16l2 9H2l2-9ZM2 14v5h20v-5M6 17h.01M10 17h.01",
 folder:"M3 5h7l2 3h9v11H3z",book:"M12 6c-3-3-7-3-10-2v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2Zm0 0v15",
 info:"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-11v6m0-10h.01",
 check:"m5 12 4 4L19 6",chevron:"m9 18 6-6-6-6",chart:"M4 20h16M7 16V9m5 7V4m5 12v-5"
};
function BillingIcon({name}:{name:IconName}){return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>}
const limits=[["boards","Собственные доски",5,"board"],["students","Ученики в базе",5,"users"],["groups","Группы и классы",1,"group"],["templates","Личные шаблоны",3,"template"]] as const;
function SectionTitle({icon,title,description}:{icon:IconName;title:string;description?:string}){return <div className="billing-section-title"><span className="billing-icon"><BillingIcon name={icon}/></span><div><h2>{title}</h2>{description&&<p>{description}</p>}</div></div>}
export default function BillingScreen({onBack}:{onBack:()=>void}){
  const [data,setData]=useState<Billing|null>(null),[selected,setSelected]=useState<string[]>([]),[notice,setNotice]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false);
  const plansRef=useRef<HTMLElement>(null);
  const remote=isSelfhostBackendEnabled();
  const sync=async()=>{try{const next=await selfhostRequest<Billing>("/api/v1/billing");setData(next);setError("");return next}catch(e){setError(e instanceof Error?e.message:"Не удалось получить тариф")}};
  useEffect(()=>{if(!remote)return;void sync().then(x=>x&&setSelected(x.boards.filter(b=>b.active).map(b=>b.id)));const focus=()=>void sync();window.addEventListener("focus",focus);window.addEventListener("onlinerepetitor:account-access",focus);const timer=setInterval(focus,30000);return()=>{window.removeEventListener("focus",focus);window.removeEventListener("onlinerepetitor:account-access",focus);clearInterval(timer)}},[remote]);
  const refresh=async()=>{setRefreshing(true);try{const next=await sync();if(next&&!data)setSelected(next.boards.filter(b=>b.active).map(b=>b.id))}finally{setRefreshing(false)}};
  const save=async()=>{setBusy(true);setNotice("");try{await selfhostRequest("/api/v1/billing/active-boards",{method:"PUT",body:JSON.stringify({board_ids:selected})});await sync();setNotice("Активные доски обновлены.")}catch(e){setNotice(e instanceof Error?e.message:"Не удалось сохранить выбор")}finally{setBusy(false)}};
  const plan=data?.plan??"free";
  const storage:StorageUsage|undefined=data&&(data.storage??{used_bytes:data.usage.storage_bytes,limit_bytes:data.is_admin?null:(plan==="pro"?5120:250)*1048576,remaining_bytes:data.is_admin?null:Math.max(0,(plan==="pro"?5120:250)*1048576-data.usage.storage_bytes)})||undefined;
  const planName=data?.is_admin?"Администратор":plan==="pro"?"Pro":"Free";
  const planDescription=data?.is_admin?"Полный доступ к возможностям Lektrus":plan==="pro"&&data?.until?`Активен до ${new Date(data.until).toLocaleDateString("ru-RU")}`:plan==="pro"?"Расширенные возможности":"Бесплатный доступ без ограничения по времени";
  const currentSelection=data?.boards.filter(b=>b.active).map(b=>b.id)??[];
  const dirty=currentSelection.length!==selected.length||currentSelection.some(id=>!selected.includes(id));
  return <main className="billing-page">
    <header className="billing-head">
      <div className="billing-head-actions"><button type="button" className="billing-back" onClick={onBack}><BillingIcon name="back"/>Назад</button>{remote&&<button type="button" className="billing-refresh" onClick={()=>void refresh()} disabled={refreshing} aria-label="Обновить данные" title="Обновить данные"><BillingIcon name="refresh"/><span>{refreshing?"Обновление…":"Обновить"}</span></button>}</div>
      <div className="billing-heading"><h1>Тарифы и использование</h1><p>Подписка, доступные возможности и остаток ресурсов.</p></div>
    </header>
    {error&&<div className="billing-status billing-error" role="alert"><BillingIcon name="info"/><span>{error}</span><button type="button" onClick={()=>void refresh()} disabled={refreshing}>Повторить</button></div>}
    {!data&&remote&&!error&&<div className="billing-status" role="status">Загружаем тариф и использование…</div>}
    {!remote&&<div className="billing-status" role="status">Данные подписки доступны при подключении к серверу Lektrus.</div>}
    {data&&<div className="billing-overview">
      <section className="billing-current" aria-label="Текущий тариф"><div className="billing-plan-intro"><span className="billing-plan-icon"><BillingIcon name={data.is_admin?"shield":"spark"}/></span><div><span className="billing-eyebrow">Текущий тариф</span><h2>{planName}</h2><p>{planDescription}</p></div></div><div className="billing-current-actions"><span className="billing-badge active">{data.is_admin?"Без тарифных лимитов":"Активен"}</span>{!data.is_admin&&<button className="billing-link" type="button" onClick={()=>{plansRef.current?.scrollIntoView({block:"start",behavior:"auto"});plansRef.current?.focus({preventScroll:true})}}>Сравнить тарифы <BillingIcon name="chevron"/></button>}</div></section>
      {storage&&<section className="billing-usage storage-usage-card" aria-label="Моё хранилище"><SectionTitle icon="storage" title="Моё хранилище" description="Место, занятое вашими файлами"/><StorageMeter usage={storage}/>{storage.board_bytes!==undefined&&<div className="storage-breakdown billing-storage-breakdown">{([["Файлы на досках",storage.board_bytes,"folder"],["Учебные материалы",storage.material_bytes,"book"],["Файлы шаблонов",storage.template_bytes,"template"]] as const).map(([label,value,icon])=><div key={label}><span className="billing-storage-label"><BillingIcon name={icon}/>{label}</span><strong>{value===undefined?"Нет данных":formatStorage(value)}</strong></div>)}</div>}<details className="billing-info"><summary><BillingIcon name="info"/><span>Что входит в объём хранилища?</span><BillingIcon name="chevron"/></summary><p>Файлы ваших досок (включая архивные), учебных материалов и шаблонов. Служебные данные и история изменений не входят в тарифную квоту. Общие доски учитываются у владельца.</p></details></section>}
      <section className="billing-usage" aria-label="Использование"><SectionTitle icon="chart" title="Использование" description="Текущие ресурсы и лимиты тарифа"/><div className="billing-usage-grid">{limits.map(([key,label,max,icon])=>{const n=data.usage[key];const limited=!data.unlimited;return <article key={key}><div className="billing-usage-row"><span className="billing-usage-label"><BillingIcon name={icon}/>{label}</span><strong>{n} <small>{limited?"/ "+max:"/ ∞"}</small></strong></div>{limited?<><progress aria-label={label} value={Math.min(n,max)} max={max} className={n>=max?"full":""}/><small className={n>=max?"billing-limit-reached":""}>{n>=max?"Лимит достигнут":`Доступно ещё ${Math.max(0,max-n)}`}</small></>:<small>Без тарифного лимита</small>}</article>})}</div></section>
    </div>}
    {data&&!data.unlimited&&data.boards.length>5&&<section className="billing-usage billing-board-section"><SectionTitle icon="board" title="Активные доски" description="Выберите 5 досок для редактирования. Остальные доступны для просмотра."/><div className="billing-board-counter"><strong>{selected.length} из 5 выбрано</strong><progress aria-label="Выбранные доски" value={selected.length} max={5}/></div><div className="billing-board-picker">{data.boards.map(b=><label key={b.id}><input type="checkbox" checked={selected.includes(b.id)} disabled={busy||(!selected.includes(b.id)&&selected.length>=5)} onChange={e=>setSelected(old=>e.target.checked?[...old,b.id]:old.filter(id=>id!==b.id))}/><span>{b.title}</span>{selected.includes(b.id)&&<BillingIcon name="check"/>}</label>)}</div><div className="billing-board-actions"><button type="button" className="billing-secondary" disabled={busy||!dirty} onClick={()=>setSelected(currentSelection)}>Сбросить</button><button type="button" className="billing-save" disabled={busy||!dirty||selected.length!==5} onClick={()=>void save()}>{busy?"Сохранение…":"Сохранить выбор"}</button></div>{notice&&<p className="billing-board-notice" role="status">{notice}</p>}</section>}
    <section className="billing-plans" ref={plansRef} tabIndex={-1} aria-label="Сравнение тарифов"><SectionTitle icon="spark" title="Сравнение тарифов" description={data?.is_admin?"Тарифы для зарегистрированных пользователей":"Выберите подходящий набор возможностей"}/><div className="billing-grid">{plans.map(p=>{const current=!!data&&!data.is_admin&&p.id===plan;return <article key={p.id} className={`billing-card ${current?"current":""}`}><div className="billing-card-top"><span className="billing-plan-mini"><BillingIcon name={p.id==="pro"?"spark":"board"}/></span><h2>{p.name}</h2><span className={`billing-badge ${current?"active":""}`}>{current?"Ваш тариф":p.id==="pro"?"Скоро":"Бесплатно"}</span></div><p>{p.description}</p><strong className="billing-price">{p.priceLabel}</strong><ul>{p.features.map(x=><li key={x}><BillingIcon name="check"/><span>{x}</span></li>)}</ul><div className="billing-plan-state">{current?<><BillingIcon name="check"/>Текущий тариф</>:p.id==="pro"?"Подключение скоро":"Бесплатный тариф"}</div></article>})}</div><details className="billing-info billing-payment-info"><summary><BillingIcon name="info"/><span>Как подключить Pro?</span><BillingIcon name="chevron"/></summary><p>Платежи пока отключены. Pro может выдать администратор вручную, без оплаты. Доступ участников общей доски определяется правами и тарифом её владельца.</p></details></section>
  </main>
}
