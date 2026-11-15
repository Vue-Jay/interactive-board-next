import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {feedbackMailEnabled,listFeedbackMail,listProductFeedback,replyToFeedback,retryFeedbackMail,updateProductFeedbackStatus,type ProductFeedback,type ProductFeedbackMail,type ProductFeedbackStatus} from "./productFeedbackStore";
import type {SelfhostMailStatus} from "./selfhostApi";
import AdminTestMail from "./AdminTestMail";

const formatDate=(date:string)=>new Date(date).toLocaleString("ru-RU",{dateStyle:"short",timeStyle:"short"});
const statusLabels:Record<SelfhostMailStatus,string>={pending:"В очереди",sending:"Отправляется",sent:"Отправлено",failed:"Ошибка доставки"};
const feedbackLabels:Record<ProductFeedbackStatus,string>={new:"Новое",reviewed:"Просмотрено",closed:"Закрыто"};
const messageError=(e:unknown)=>e instanceof Error?e.message:"Не удалось выполнить действие";
function Delivery({status}:{status?:SelfhostMailStatus|null}){return status?<span className={`admin-mail-badge mail-${status}`}>{statusLabels[status]}</span>:null}

export default function AdminMailPanel({onUnread}:{onUnread:(count:number)=>void}){
 const [folder,setFolder]=useState<"inbox"|"outbox">("inbox");
 const [inbox,setInbox]=useState<ProductFeedback[]>([]),[outbox,setOutbox]=useState<ProductFeedbackMail[]>([]);
 const [selected,setSelected]=useState(""),[query,setQuery]=useState(""),[filter,setFilter]=useState("all");
 const [draft,setDraft]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[notice,setNotice]=useState("");
 const requestId=useRef<string|null>(null),loadVersion=useRef(0);
 const enabled=feedbackMailEnabled();
 const load=useCallback(async()=>{const version=++loadVersion.current;try{const [incoming,outgoing]=await Promise.all([listProductFeedback(),listFeedbackMail()]);if(version!==loadVersion.current)return;setInbox(incoming);setOutbox(outgoing);onUnread(incoming.filter(x=>x.status==="new").length)}catch(e){if(version===loadVersion.current)setNotice(messageError(e))}finally{if(version===loadVersion.current)setLoading(false)}},[onUnread]);
 useEffect(()=>{void load();return()=>{loadVersion.current++}},[load]);
 const pending=inbox.some(x=>x.notification_status==="pending"||x.notification_status==="sending")||outbox.some(x=>x.status==="pending"||x.status==="sending");
 useEffect(()=>{if(!pending)return;const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load()},12000);return()=>window.clearInterval(timer)},[pending,load]);
 const incoming=folder==="inbox";
 const rows=useMemo(()=>{const q=query.trim().toLocaleLowerCase("ru");return incoming?inbox.filter(x=>(filter==="all"||x.status===filter)&&`${x.name} ${x.email} ${x.topic} ${x.message}`.toLocaleLowerCase("ru").includes(q)):outbox.filter(x=>(filter==="all"||x.status===filter)&&`${x.recipient_name} ${x.recipient} ${x.subject} ${x.body}`.toLocaleLowerCase("ru").includes(q))},[incoming,inbox,outbox,query,filter]);
 const selectedRow=rows.find(x=>x.id===selected);
 const select=(id:string)=>{if(id===selected)return;if(draft.trim()&&!window.confirm("Сменить письмо? Неотправленный ответ будет потерян."))return;setSelected(id);setDraft("");requestId.current=null;setNotice("")};
 const switchFolder=(value:"inbox"|"outbox")=>{if(value===folder)return;if(draft.trim()&&!window.confirm("Перейти в другую папку? Неотправленный ответ будет потерян."))return;setFolder(value);setSelected("");setQuery("");setFilter("all");setDraft("");requestId.current=null;setNotice("")};
 const action=async(fn:()=>Promise<unknown>,success:string)=>{setBusy(true);setNotice("");try{await fn();setNotice(success);await load();return true}catch(e){setNotice(messageError(e));return false}finally{setBusy(false)}};
 const send=async(row:ProductFeedback)=>{if(!draft.trim()||!row.email)return;requestId.current??=crypto.randomUUID();const ok=await action(()=>replyToFeedback(row.id,requestId.current!,draft.trim()),"Ответ добавлен в очередь отправки.");if(ok){setDraft("");requestId.current=null}};
 const unread=inbox.filter(x=>x.status==="new").length;
 return <section className="admin-mail" aria-label="Почта администратора">
  <div className="admin-users-toolbar"><div><h2>Почта</h2><span>Обращения с сайта и приложения, ответы пользователям и доставка писем.</span></div><button className="boards-secondary" disabled={busy} onClick={()=>void load()}>Обновить почту</button></div>
  {enabled&&<AdminTestMail/>}
  <div className="admin-mail-toolbar"><nav className="admin-tabs" aria-label="Папки почты"><button className={incoming?"active":""} onClick={()=>switchFolder("inbox")}>Входящие <span>{unread||inbox.length}</span></button><button className={!incoming?"active":""} onClick={()=>switchFolder("outbox")}>Исходящие <span>{outbox.length}</span></button></nav><input type="search" aria-label="Поиск писем" placeholder="Поиск по письмам" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="Статус писем" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Все статусы</option>{Object.entries(incoming?feedbackLabels:statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
  {notice&&<div className="access-notice" role="status">{notice}</div>}
  {!enabled&&<div className="access-notice">Отправка писем доступна на сервере Lektrus.</div>}
  <div className="admin-mail-layout">
   <div className="admin-mail-list" aria-label={incoming?"Входящие письма":"Исходящие письма"}>
    {loading?<div className="boards-empty">Загрузка почты…</div>:rows.length===0?<div className="boards-empty"><strong>Писем нет</strong><span>{query||filter!=="all"?"Измените фильтры поиска.":incoming?"Новые обращения появятся здесь.":"Отправленные ответы появятся здесь."}</span></div>:rows.map(row=><button className={`admin-mail-row ${selected===row.id?"active":""}`} key={row.id} onClick={()=>select(row.id)} disabled={busy}><span className="admin-mail-row-top"><strong>{"topic" in row?row.name:row.recipient_name||row.recipient}</strong><time>{formatDate(row.created_at)}</time></span><span className="admin-mail-row-subject">{"topic" in row?row.topic:row.subject}</span><span className="admin-mail-row-preview">{"message" in row?row.message:row.body}</span><span className="admin-mail-badges">{"topic" in row?<><span className={`admin-mail-badge mail-${row.status}`}>{feedbackLabels[row.status]}</span><Delivery status={row.notification_status}/></>:<Delivery status={row.status}/>}</span></button>)}
   </div>
   <div className="admin-mail-detail">
    {!selectedRow?<div className="boards-empty"><strong>Выберите письмо</strong><span>Здесь откроется содержимое и доступные действия.</span></div>:"topic" in selectedRow?<><header><div><h3>{selectedRow.topic}</h3><span>{selectedRow.name} · {selectedRow.email||"Без email"}</span></div><time>{formatDate(selectedRow.created_at)}</time></header><div className="admin-mail-badges"><span className={`admin-mail-badge mail-${selectedRow.status}`}>{feedbackLabels[selectedRow.status]}</span><span className="admin-mail-badge">{selectedRow.source==="site"?"Сайт":"Приложение"}</span><Delivery status={selectedRow.notification_status}/></div><p className="admin-mail-body">{selectedRow.message}</p>
     {selectedRow.notification_error&&<p className="admin-mail-error">{selectedRow.notification_error}</p>}
     <div className="admin-mail-actions">{selectedRow.status==="new"&&<button className="boards-secondary" disabled={busy} onClick={()=>void action(()=>updateProductFeedbackStatus(selectedRow.id,"reviewed"),"Отмечено как просмотренное.")}>Отметить просмотренным</button>}<button className="boards-secondary" disabled={busy} onClick={()=>void action(()=>updateProductFeedbackStatus(selectedRow.id,selectedRow.status==="closed"?"reviewed":"closed"),"Статус изменён.")}>{selectedRow.status==="closed"?"Открыть снова":"Закрыть обращение"}</button>{selectedRow.notification_status==="failed"&&selectedRow.notification_id&&<button className="boards-secondary" disabled={busy} onClick={()=>void action(()=>retryFeedbackMail(selectedRow.notification_id!),"Уведомление поставлено в очередь.")}>Повторить доставку</button>}</div>
     {outbox.filter(x=>x.feedback_id===selectedRow.id).length>0&&<div className="admin-mail-thread"><strong>История ответов</strong>{outbox.filter(x=>x.feedback_id===selectedRow.id).map(x=><article key={x.id}><div><time>{formatDate(x.created_at)}</time><Delivery status={x.status}/></div><p>{x.body}</p></article>)}</div>}
     {enabled&&<div className="admin-mail-compose"><strong>Ответ пользователю</strong>{selectedRow.email?<><small>Кому: {selectedRow.email}</small><textarea rows={5} maxLength={4000} aria-label="Текст ответа" placeholder="Напишите ответ…" value={draft} disabled={busy} onChange={e=>{setDraft(e.target.value);requestId.current=null}}/><div><small>{draft.length}/4000</small><button className="students-primary" disabled={busy||!draft.trim()} onClick={()=>void send(selectedRow)}>Отправить ответ</button></div></>:<small>Пользователь не указал email. Ответить письмом невозможно.</small>}</div>}
    </>:<><header><div><h3>{selectedRow.subject}</h3><span>Кому: {selectedRow.recipient_name} · {selectedRow.recipient}</span></div><time>{formatDate(selectedRow.created_at)}</time></header><div className="admin-mail-badges"><Delivery status={selectedRow.status}/>{selectedRow.sent_at&&<small>Отправлено {formatDate(selectedRow.sent_at)}</small>}</div><p className="admin-mail-body">{selectedRow.body}</p>{selectedRow.last_error&&<p className="admin-mail-error">{selectedRow.last_error}</p>}{selectedRow.status==="failed"&&<button className="boards-secondary" disabled={busy} onClick={()=>void action(()=>retryFeedbackMail(selectedRow.id),"Письмо поставлено в очередь.")}>Повторить отправку</button>}</>}
   </div>
  </div>
 </section>
}
