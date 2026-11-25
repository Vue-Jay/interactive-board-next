import {useEffect,useRef,useState} from "react";
import {selfhostRequest} from "./selfhostApi";
import {formatStorage,StorageMeter,type StorageUsage} from "./StorageUsage";

type Table={schema:string;name:string;data_bytes:number;index_bytes:number;total_bytes:number;live_rows:number;dead_rows:number;last_vacuum:string|null;last_autovacuum:string|null};
type Account=StorageUsage&{id:string;name:string;email:string;plan:"free"|"pro"|"admin"};
type GuestStats={active:number;expired:number;pending:number;historical:number;access_hours:number;cleanup_interval_seconds:number;grace_minutes:number;batch_size:number};
type Report={database_bytes:number;wal_bytes:number|null;measured_at:string;tables:Table[];users:Account[];offset:number;has_more:boolean;databases?:{name:string;current:boolean;bytes:number|null}[];guests?:GuestStats};
const names:Record<string,string>={board_history:"История изменений",board_documents:"Документы досок",board_document_items:"Объекты досок",board_visits:"Посещения",board_templates:"Шаблоны",board_assets:"Метаданные файлов досок",learning_materials:"Метаданные материалов",account_users:"Аккаунты",account_sessions:"Сессии"};
const date=(value:string|null)=>value?new Date(value).toLocaleString("ru-RU"):"Нет данных";
const number=(n:number)=>n.toLocaleString("ru-RU");
export default function AdminStoragePanel(){
  const [data,setData]=useState<Report|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
  const [tab,setTab]=useState<"tables"|"users"|"guests">("tables"),[filter,setFilter]=useState("");
  const sequence=useRef(0);
  const load=async(offset=0)=>{
    const id=++sequence.current;setBusy(true);setError("");
    try{const result=await selfhostRequest<Report>("/api/v1/admin/storage?offset="+offset);if(id===sequence.current)setData(result)}
    catch(e){if(id===sequence.current)setError(e instanceof Error?e.message:"Не удалось получить сведения о хранилище")}
    finally{if(id===sequence.current)setBusy(false)}
  };
  const clean=async()=>{
    setBusy(true);setError("");setNotice("");
    try{const result=await selfhostRequest<{processed:number;deleted:number;retained:number}>("/api/v1/admin/storage/cleanup-guests",{method:"POST"});setNotice(`Обработано: ${result.processed}. Удалено: ${result.deleted}. Сохранено для истории: ${result.retained}.`);await load(data?.offset??0)}
    catch(e){setError(e instanceof Error?e.message:"Не удалось очистить гостей");setBusy(false)}
  };
  useEffect(()=>{void load();return()=>{sequence.current++}},[]);
  const tables=data?.tables??[],total=tables.reduce((n,t)=>n+t.total_bytes,0),indexes=tables.reduce((n,t)=>n+t.index_bytes,0);
  const query=filter.trim().toLowerCase(),filtered=tables.filter(t=>!query||[t.name,t.schema,names[t.name]].some(s=>s?.toLowerCase().includes(query)));
  return <section className="storage-admin" aria-label="Хранилище и база данных">
    <header className="storage-head"><div><h2>Хранилище</h2><p>Размер базы, файлы пользователей и гостевые аккаунты</p></div><button type="button" className="boards-secondary" disabled={busy} onClick={()=>void load(data?.offset??0)}>{busy?"Обновляем…":"Обновить"}</button></header>
    {error&&<p className="access-notice" role="alert">{error}</p>}
    {!data&&!error&&<p role="status">Получаем размеры хранилища…</p>}
    {data&&<>
      <div className="storage-kpis storage-compact-kpis">{[["Размер базы PostgreSQL",formatStorage(data.database_bytes)],["Таблицы с индексами",formatStorage(total)],["Из них индексы",formatStorage(indexes)],["WAL (весь кластер)",data.wal_bytes===null?"Нет доступа":formatStorage(data.wal_bytes)]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <details className="storage-disk-note"><summary>Почему размер базы отличается от заполнения SSD Amvera?</summary><p>Здесь измеряется база Lektrus, а не весь диск. Данные других баз, WAL, служебные файлы и пространство файловой системы могут занимать оставшееся место. Ёмкость и заполнение SSD доступны в Amvera. {data.wal_bytes===null?"Права на измерение WAL не предоставлены.":""} Индексы уже входят в размеры таблиц.</p>{data.databases&&<div className="storage-db-list">{data.databases.map(d=><div key={d.name}><span>{d.name}{d.current?" (Lektrus)":""}</span><strong>{d.bytes===null?"Нет доступа":formatStorage(d.bytes)}</strong></div>)}</div>}</details>
      <div className="storage-subnav" role="group" aria-label="Разделы хранилища">{([["tables","Таблицы"],["users","Пользователи"],["guests","Гости"]] as const).map(([key,label])=><button type="button" key={key} className={tab===key?"active":""} aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}{key==="guests"&&data.guests? ` · ${data.guests.active}`:""}</button>)}<small>Обновлено {date(data.measured_at)}</small></div>
      {tab==="tables"&&<section className="storage-section storage-compact-section"><div className="storage-head"><div><h3>Таблицы PostgreSQL</h3><p>Размер с индексами · нажмите строку для подробностей</p></div><input type="search" aria-label="Поиск таблиц" placeholder="Найти таблицу" value={filter} onChange={e=>setFilter(e.target.value)}/></div>
      <div className="storage-compact-list"><div className="storage-list-header"><span>Таблица</span><span>Размер</span><span>Доля</span></div>{filtered.map(t=><details key={t.schema+"."+t.name}><summary><div className="storage-table-name"><strong>{names[t.name]??t.name}</strong><small>{t.schema}.{t.name}</small></div><strong>{formatStorage(t.total_bytes)}</strong><div className="storage-share"><progress aria-label={"Доля таблицы "+t.name} max={Math.max(total,1)} value={t.total_bytes}/><small>{total?(t.total_bytes/total*100).toFixed(1):"0"}%</small></div></summary><div className="storage-expanded"><div className="storage-breakdown"><div><span>Данные (включая TOAST)</span><strong>{formatStorage(t.data_bytes)}</strong></div><div><span>Индексы</span><strong>{formatStorage(t.index_bytes)}</strong></div><div><span>Живые / мёртвые строки</span><strong>{number(t.live_rows)} / {number(t.dead_rows)}</strong></div></div><small>Автоочистка: {date(t.last_autovacuum)} · Ручная: {date(t.last_vacuum)}. Число строк приблизительное.</small></div></details>)}{!filtered.length&&<p>Таблицы не найдены.</p>}</div></section>}
      {tab==="users"&&<section className="storage-section storage-compact-section"><h3>Пользователи</h3><p className="storage-note">Тарифная квота файлов, не физический размер PostgreSQL. Гости учитываются отдельно.</p>
      {data.users.length===0?<p>Нет пользователей на этой странице.</p>:<div className="storage-compact-list storage-users-compact">{data.users.map(u=><details key={u.id}><summary><div className="storage-table-name"><strong>{u.name}</strong><small>{u.email}</small></div><span>{u.plan==="admin"?"Администратор":u.plan==="pro"?"Pro":"Free"}</span><strong>{formatStorage(u.used_bytes)}</strong></summary><div className="storage-expanded"><StorageMeter usage={u}/><div className="storage-breakdown"><div><span>Доски</span><strong>{formatStorage(u.board_bytes??0)}</strong></div><div><span>Материалы</span><strong>{formatStorage(u.material_bytes??0)}</strong></div><div><span>Шаблоны</span><strong>{formatStorage(u.template_bytes??0)}</strong></div></div></div></details>)}</div>}
      <div className="storage-pager"><button className="boards-secondary" disabled={busy||data.offset===0} onClick={()=>void load(Math.max(0,data.offset-50))}>Назад</button><span>Страница {Math.floor(data.offset/50)+1}</span><button className="boards-secondary" disabled={busy||!data.has_more} onClick={()=>void load(data.offset+50)}>Далее</button></div></section>}
      {tab==="guests"&&<section className="storage-section storage-compact-section"><div className="storage-head"><div><h3>Гостевые аккаунты</h3><p>Сессии с ограниченным сроком действия</p></div>{data.guests&&<button type="button" className="boards-secondary" disabled={busy||!data.guests.pending} onClick={()=>void clean()}>Очистить просроченных</button>}</div>{data.guests?<><div className="storage-kpis storage-compact-kpis">{[["Активные",data.guests.active],["Истёкшие",data.guests.expired],["Ожидают очистки",data.guests.pending],["Защищённые записи",data.guests.historical]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><p className="storage-note">Доступ действует {data.guests.access_hours} ч. Очистка выполняется каждый час, начиная через {data.guests.grace_minutes} минут после окончания доступа. За один проход обрабатывается до {data.guests.batch_size} аккаунтов. Сессии, членство и уведомления удаляются; рисунки и файлы доски сохраняются. Гостевые аккаунты удаляются, а комментарии и история посещений сохраняются независимо. Защищённые записи требуют проверки администратора.</p></>:<p>Данные о гостях появятся после обновления сервера.</p>}{notice&&<p role="status" className="storage-note">{notice}</p>}</section>}
    </>}
  </section>
}
