import {useState,type FormEvent} from "react";
import {submitProductFeedback,type ProductFeedbackTopic} from "./productFeedbackStore";

type Props={compact?:boolean;source:"site"|"app"};
const topics=["Предложение","Отзыв о сервисе","Сообщить о проблеме","Другое"] as const;

export default function LektrusFeedbackForm({compact=false,source}:Props){
 const [name,setName]=useState("");
 const [email,setEmail]=useState("");
 const [topic,setTopic]=useState<(typeof topics)[number]>(topics[0]);
 const [message,setMessage]=useState("");
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 const [sending,setSending]=useState(false);
 const submit=(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();setNotice("");setError("");setSending(true);
  void submitProductFeedback({name,email,topic:topic as ProductFeedbackTopic,message,source})
   .then(()=>{setName("");setEmail("");setTopic(topics[0]);setMessage("");setNotice("Спасибо! Сообщение отправлено в команду Lektrus.")})
   .catch(failure=>setError(failure instanceof Error?failure.message:"Не удалось отправить сообщение. Попробуйте ещё раз."))
   .finally(()=>setSending(false));
 };
 return <form className={`lektrus-feedback-form${compact?" is-compact":""}`} onSubmit={submit}>
  {!compact&&<div className="lektrus-feedback-form-heading"><span>ОБРАТНАЯ СВЯЗЬ</span><h2>Есть идея или отзыв?</h2><p>Расскажите, что поможет сделать Lektrus удобнее. Мы ценим конкретные предложения и замечания.</p></div>}
  <div className="lektrus-feedback-fields">
   <label><span>Ваше имя</span><input value={name} onChange={event=>setName(event.target.value)} maxLength={100} placeholder="Как к вам обращаться" autoComplete="name"/></label>
   <label><span>Email для ответа</span><input type="email" value={email} onChange={event=>setEmail(event.target.value)} maxLength={254} placeholder="you@example.com" autoComplete="email"/></label>
   <label className="wide"><span>Тема</span><select value={topic} onChange={event=>setTopic(event.target.value as (typeof topics)[number])}>{topics.map(value=><option key={value}>{value}</option>)}</select></label>
   <label className="wide"><span>Сообщение</span><textarea required value={message} onChange={event=>setMessage(event.target.value)} minLength={8} maxLength={4000} rows={compact?4:5} placeholder="Что понравилось, что стоит изменить или добавить?"/></label>
  </div>
  <div className="lektrus-feedback-submit-row"><button type="submit" disabled={sending||message.trim().length<8}>{sending?"Отправляем…":"Отправить сообщение"} <span aria-hidden="true">↗</span></button><small>Email нужен только если хотите получить ответ.</small></div>
  {notice&&<p className="lektrus-feedback-notice" role="status">{notice}</p>}{error&&<p className="lektrus-feedback-error" role="alert">{error}</p>}
  {(source==="site"||import.meta.env.VITE_TELEGRAM_URL)&&<a className="lektrus-feedback-telegram" href={source==="site"?"https://t.me/lektrus":import.meta.env.VITE_TELEGRAM_URL} target="_blank" rel="noopener noreferrer">Написать в Telegram: @lektrus <span aria-hidden="true">↗</span></a>}
 </form>;
}
