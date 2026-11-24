import {useEffect,useRef,useState} from "react";
import {selfhostRequest} from "./selfhostApi";
import {formatStorage,StorageMeter,type StorageUsage} from "./StorageUsage";

type Table={schema:string;name:string;data_bytes:number;index_bytes:number;total_bytes:number;live_rows:number;dead_rows:number;last_vacuum:string|null;last_autovacuum:string|null};
type Account=StorageUsage&{id:string;name:string;email:string;plan:"free"|"pro"|"admin"};
type Report={database_bytes:number;wal_bytes:number|null;measured_at:string;tables:Table[];users:Account[];offset:number;has_more:boolean};
const names:Record<string,string>={board_history:"История изменений",board_documents:"Документы досок",board_document_items:"Объекты досок",board_visits:"Посещения",board_templates:"Шаблоны",board_assets:"Метаданные файлов досок",learning_materials:"Метаданные материалов",account_users:"Аккаунты",account_sessions:"Сессии"};
const date=(value:string|null)=>value?new Date(value).toLocaleString("ru-RU"):"Нет данных";
export default function AdminStoragePanel(){
  const [data,setData]=useState<Report|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const sequence=useRef(0);
  const load=async(offset=0)=>{
    const id=++sequence.current;setBusy(true);setError("");
    try{const result=await selfhostRequest<Report>("/api/v1/admin/storage?offset="+offset);if(id===sequence.current)setData(result)}
    catch(e){if(id===sequence.current)setError(e instanceof Error?e.message:"Не удалось получить сведения о хранилище")}
    finally{if(id===sequence.current)setBusy(false)}
  };
  useEffect(()=>{void load();return()=>{sequence.current++}},[]);
  const tables=data?.tables??[],total=tables.reduce((n,t)=>n+t.total_bytes,0),indexes=tables.reduce((n,t)=>n+t.index_bytes,0);
  return <section className="storage-admin" aria-label="Хранилище и база данных">
    <header className="storage-head"><div><h2>Хранилище и база данных</h2><p>Диагностика PostgreSQL и использование тарифных квот</p></div><button type="button" className="boards-secondary" disabled={busy} onClick={()=>void load(data?.offset??0)}>{busy?"Обновляем…":"Обновить"}</button></header>
    {error&&<p className="access-notice" role="alert">{error}</p>}
    {!data&&!error&&<p role="status">Получаем размеры хранилища…</p>}
    {data&&<>
      <div className="storage-kpis">{[["Размер базы PostgreSQL",formatStorage(data.database_bytes)],["Таблицы с индексами",formatStorage(total)],["Индексы таблиц",formatStorage(indexes)],["WAL (весь кластер)",data.wal_bytes===null?"Нет доступа":formatStorage(data.wal_bytes)]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <p className="storage-note">Измерено {date(data.measured_at)}. Индексы уже включены в размер таблиц. Размер базы не равен заполнению SSD Amvera: на томе могут быть WAL, другие базы и служебные файлы. Полная ёмкость и свободное место тома доступны в Amvera. {data.wal_bytes===null?"Провайдер не предоставил доступ к каталогу WAL.":""}</p>
      <section className="storage-section"><h3>Таблицы PostgreSQL</h3><p className="storage-note">По убыванию физического размера. Данные включают TOAST; число живых и мёртвых строк — оценка статистики PostgreSQL.</p>
      <div className="storage-table-list">{tables.map(t=><article key={t.schema+"."+t.name}><div className="storage-table-title"><div><strong>{names[t.name]??t.name}</strong><small>{t.schema}.{t.name}</small></div><strong>{formatStorage(t.total_bytes)}</strong></div><progress aria-label={"Доля таблицы "+t.name} max={Math.max(total,1)} value={t.total_bytes}/><div className="storage-breakdown"><div><span>Данные</span><strong>{formatStorage(t.data_bytes)}</strong></div><div><span>Индексы</span><strong>{formatStorage(t.index_bytes)}</strong></div><div><span>Живые / мёртвые строки</span><strong>{t.live_rows.toLocaleString("ru-RU")} / {t.dead_rows.toLocaleString("ru-RU")}</strong></div></div><small>Автоочистка: {date(t.last_autovacuum)} · Ручная: {date(t.last_vacuum)}</small></article>)}</div>
      </section>
      <section className="storage-section"><h3>Пользователи</h3><p className="storage-note">По объёму файлов, с учётом действующего тарифа. Это логический объём тарифной квоты, а не доля физического размера PostgreSQL.</p>
      {data.users.length===0?<p>Нет пользователей на этой странице.</p>:<div className="storage-account-list">{data.users.map(u=><article key={u.id}><div className="storage-table-title"><div><strong>{u.name}</strong><small>{u.email}</small></div><span>{u.plan==="admin"?"Администратор":u.plan==="pro"?"Pro":"Free"}</span></div><StorageMeter usage={u}/><div className="storage-breakdown"><div><span>Доски</span><strong>{formatStorage(u.board_bytes??0)}</strong></div><div><span>Материалы</span><strong>{formatStorage(u.material_bytes??0)}</strong></div><div><span>Шаблоны</span><strong>{formatStorage(u.template_bytes??0)}</strong></div></div></article>)}</div>}
      <div className="storage-pager"><button className="boards-secondary" disabled={busy||data.offset===0} onClick={()=>void load(Math.max(0,data.offset-50))}>Назад</button><span>Страница {Math.floor(data.offset/50)+1}</span><button className="boards-secondary" disabled={busy||!data.has_more} onClick={()=>void load(data.offset+50)}>Далее</button></div></section>
    </>}
  </section>
}
