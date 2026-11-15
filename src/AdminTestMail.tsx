import {useState,type FormEvent} from "react";
import {selfhostSendTestMail,type SelfhostTestMailKind,type SelfhostTestMailResult} from "./selfhostApi";

const templates:Array<{kind:SelfhostTestMailKind;label:string;description:string}>=[
 {kind:"confirmation",label:"Подтверждение регистрации",description:"Проверка письма подтверждения email"},
 {kind:"password_reset",label:"Восстановление пароля",description:"Проверка письма со ссылкой сброса"},
 {kind:"notification",label:"Новое обращение",description:"Уведомление администратору"},
 {kind:"reply",label:"Ответ поддержки",description:"Письмо пользователю"},
];

export default function AdminTestMail(){
 const [email,setEmail]=useState("");
 const [selected,setSelected]=useState<SelfhostTestMailKind[]>(templates.map(x=>x.kind));
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[result,setResult]=useState<SelfhostTestMailResult|null>(null);
 const toggle=(kind:SelfhostTestMailKind,checked:boolean)=>setSelected(items=>checked?[...items,kind]:items.filter(x=>x!==kind));
 async function send(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(busy||!email.trim()||!selected.length)return;
  setBusy(true);setError("");setResult(null);
  try{setResult(await selfhostSendTestMail(email.trim(),selected))}
  catch(e){setError(e instanceof Error?e.message:"Не удалось подтвердить результат отправки.")}
  finally{setBusy(false)}
 }
 return <details className="admin-test-mail">
  <summary><span>Тестовые письма</span><small>Проверить оформление и доставку</small></summary>
  <form onSubmit={send}>
   <p>Отправьте выбранные шаблоны на любой указанный адрес. Тестовые письма не создают аккаунты и не меняют пароли.</p>
   <label className="admin-test-mail-address">Адрес электронной почты<input required type="email" autoComplete="off" spellCheck={false} maxLength={254} placeholder="name@example.com" value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/></label>
   <fieldset disabled={busy}>
    <legend>Выберите письма <span>{selected.length} из {templates.length}</span></legend>
    <div className="admin-test-mail-options">{templates.map(({kind,label,description})=><label key={kind} className={selected.includes(kind)?"selected":""}><input type="checkbox" checked={selected.includes(kind)} onChange={e=>toggle(kind,e.target.checked)}/><span><strong>{label}</strong><small>{description}</small></span></label>)}</div>
    <div className="admin-test-mail-selection"><button type="button" className="boards-secondary" onClick={()=>setSelected(templates.map(x=>x.kind))}>Выбрать все</button><button type="button" className="boards-secondary" onClick={()=>setSelected([])}>Снять все</button></div>
   </fieldset>
   <div className="admin-test-mail-actions"><small>Отправитель — служебная почта Lektrus. В теме будет отметка «[ТЕСТ]».</small><button className="students-primary" disabled={busy||!email.trim()||!selected.length} type="submit">{busy?"Отправляем…":"Отправить выбранные"}</button></div>
   {error&&<p className="admin-mail-error" role="alert">{error}</p>}
   {result&&<div className="admin-test-mail-result" role="status"><strong>Результат отправки на {result.email}</strong>{result.results.map(row=><div key={row.kind}><span>{templates.find(t=>t.kind===row.kind)?.label}</span><span className={`admin-mail-badge mail-${row.status}`}>{row.status==="sent"?"Принято SMTP":"Не подтверждено"}</span></div>)}<small>Если письмо не появилось, проверьте папку «Спам». Успешная отправка означает, что почтовый сервер принял сообщение.</small></div>}
  </form>
 </details>
}
