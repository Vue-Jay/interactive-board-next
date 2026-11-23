import {useEffect,useState} from "react";
import type {AdminUser} from "./accountRoleStore";
import {selfhostMaintenanceAdmin,selfhostSaveMaintenance,type MaintenanceConfig} from "./selfhostApi";
import {maintenanceTime} from "./MaintenanceGate";
import "./lektrusMaintenance.css";

function localDate(value:string|null){
  if(!value)return "";
  const d=new Date(value),pad=(n:number)=>String(n).padStart(2,"0");
  return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes());
}
const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
export default function AdminMaintenancePanel({users}:{users:AdminUser[]}){
  const [config,setConfig]=useState<MaintenanceConfig|null>(null);
  const [start,setStart]=useState(""),[end,setEnd]=useState(""),[notice,setNotice]=useState("");
  const [accounts,setAccounts]=useState<string[]>([]),[query,setQuery]=useState("");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  const install=(value:MaintenanceConfig)=>{
    setConfig(value);setStart(value.state==="off"?"":localDate(value.starts_at));setEnd(value.state==="off"?"":localDate(value.ends_at));
    setNotice(value.notice);setAccounts(value.allowed_accounts);
  };
  const load=()=>{setError("");setBusy(true);void selfhostMaintenanceAdmin().then(install).catch(e=>setError(e instanceof Error?e.message:"Не удалось загрузить режим.")).finally(()=>setBusy(false))};
  useEffect(()=>{load();const timer=window.setInterval(()=>{void selfhostMaintenanceAdmin().then(setConfig).catch(()=>{})},30000);return ()=>window.clearInterval(timer)},[]);
  const save=async(mode:"schedule"|"now"|"stop")=>{
    setError("");setMessage("");
    if((start&&!Number.isFinite(Date.parse(start)))||(end&&!Number.isFinite(Date.parse(end)))){setError("Проверьте дату и время.");return;}
    const a=mode==="stop"?null:mode==="now"?new Date().toISOString():start?new Date(start).toISOString():null;
    const b=mode==="stop"||!end?null:new Date(end).toISOString();
    if(mode==="schedule"&&!a){setError("Укажите дату и время начала.");return;}
    if(mode==="schedule"&&a&&new Date(a).getTime()<=Date.now()&&config?.state!=="active"){
      setError("Для запланированных работ выберите время в будущем. Для немедленного запуска используйте отдельную кнопку.");return;
    }
    if(b&&(!a||new Date(b)<=new Date(a)||new Date(b).getTime()<=Date.now())){setError("Окончание должно быть позже начала и текущего времени.");return;}
    if(mode==="now"&&!window.confirm("Начать технические работы прямо сейчас? Пользователи без специального доступа не смогут работать в Lektrus."))return;
    if(mode==="schedule"&&config?.state==="active"&&a&&new Date(a).getTime()>Date.now()&&!window.confirm("Перенести текущие работы на будущее? Доступ пользователей будет восстановлен до нового начала."))return;
    setBusy(true);
    try{
      const value=await selfhostSaveMaintenance({starts_at:a,ends_at:b,notice,allowed_accounts:accounts,start_now:mode==="now"});
      install(value);setMessage(mode==="stop"?"Технические работы отключены.":mode==="now"?"Технические работы начались.":"Настройки сохранены.");
      window.dispatchEvent(new Event("lektrus:maintenance-changed"));
    }catch(e){setError(e instanceof Error?e.message:"Не удалось сохранить настройки.")}finally{setBusy(false)}
  };
  const filtered=users.filter(u=>!u.isAdmin&&(!query.trim()||((u.name+" "+u.email).toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru")))));
  return <section className="admin-maintenance">
    <h2>Технические работы</h2>
    <p>Запланируйте обслуживание заранее или включите его сразу. Администраторы и выбранные аккаунты сохраняют обычный доступ к сервису.</p>
    {config&&<div className="maintenance-admin-state"><strong>{config.state==="active"?"Сейчас ведутся технические работы":config.state==="scheduled"?"Работы запланированы":"Сервис работает в обычном режиме"}</strong>{config.state!=="off"&&<p>{maintenanceTime(config)}</p>}</div>}
    {error&&<p role="alert" style={{color:"#b95038"}}>{error}</p>}
    {message&&<p role="status">{message}</p>}
    {!config?<button type="button" className="boards-secondary" disabled={busy} onClick={load}>{busy?"Загрузка…":"Повторить загрузку"}</button>:<>
      <div className="admin-maintenance-fields">
        <label>Начало<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} disabled={busy}/></label>
        <label>Окончание (необязательно)<input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} disabled={busy}/></label>
      </div>
      <small>Часовой пояс: {timezone}. Предупреждение появится сразу после сохранения расписания. В указанное время режим включится и выключится автоматически.</small>
      <label>Сообщение для пользователей<textarea value={notice} onChange={e=>setNotice(e.target.value)} maxLength={500} rows={3} placeholder="Например: обновляем серверы и систему совместных досок" disabled={busy}/></label>
      <h3 style={{margin:0}}>Аккаунты с доступом ({accounts.length})</h3>
      <p>Администраторы имеют доступ всегда. Укажите остальных пользователей, которым разрешена работа во время обслуживания.</p>
      <input type="search" placeholder="Имя или email" aria-label="Поиск аккаунтов для доступа" value={query} onChange={e=>setQuery(e.target.value)}/>
      <div className="admin-maintenance-accounts">{filtered.map(u=><label key={u.userId}><input type="checkbox" checked={accounts.includes(u.userId)} disabled={busy} onChange={e=>setAccounts(previous=>e.target.checked?[...previous,u.userId]:previous.filter(id=>id!==u.userId))}/><span>{u.name||u.email}<small>{u.email}</small></span></label>)}{accounts.filter(id=>!users.some(u=>u.userId===id)).map(id=><label key={id}><input type="checkbox" checked disabled={busy} onChange={()=>setAccounts(previous=>previous.filter(x=>x!==id))}/><span>Недоступный аккаунт<small>{id}</small></span></label>)}{!filtered.length&&!accounts.length&&<p>Аккаунты не найдены.</p>}</div>
      <div className="admin-maintenance-actions">
        <button className="students-primary" type="button" disabled={busy} onClick={()=>void save("schedule")}>{config.state==="active"?"Сохранить изменения":"Сохранить расписание"}</button>
        <button className="boards-secondary" type="button" disabled={busy} onClick={()=>void save("now")}>Начать сейчас</button>
        <button className="boards-secondary" type="button" disabled={busy||config.state==="off"} onClick={()=>void save("stop")}>{config.state==="scheduled"?"Отменить расписание":"Завершить работы"}</button>
      </div>
    </>}
  </section>;
}
