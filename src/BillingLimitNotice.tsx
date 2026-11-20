import {useEffect,useState} from "react";
import "./BillingScreen.css";
export default function BillingLimitNotice(){
  const [notice,setNotice]=useState<{resource?:string;message?:string}|null>(null);
  useEffect(()=>{const onLimit=(event:Event)=>setNotice((event as CustomEvent).detail);const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setNotice(null)};window.addEventListener("lektrus:plan-limit",onLimit);window.addEventListener("keydown",onKey);return()=>{window.removeEventListener("lektrus:plan-limit",onLimit);window.removeEventListener("keydown",onKey)}},[]);
  if(!notice)return null;
  return <div className="billing-limit-modal" onClick={()=>setNotice(null)}><section role="alertdialog" aria-modal="true" aria-labelledby="billing-limit-title" onClick={e=>e.stopPropagation()}><div className="billing-limit-icon" aria-hidden="true">!</div><h2 id="billing-limit-title">{notice.resource==="readonly"?"Доска в режиме просмотра":notice.resource==="storage_pro"?"Хранилище Pro заполнено":"Достигнут лимит Free"}</h2><p>{notice.message||"На бесплатном тарифе действие ограничено."}</p><aside>{notice.resource==="storage_pro"?"Освободите место, удалив ненужные файлы. Ваши данные не удаляются автоматически.":"Pro увеличивает лимиты. Подключение скоро; пока доступ может выдать администратор."}</aside><button autoFocus onClick={()=>setNotice(null)}>Понятно</button></section></div>
}
