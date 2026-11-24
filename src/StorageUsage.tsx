import "./StorageUsage.css";

export type StorageUsage={used_bytes:number;limit_bytes:number|null;remaining_bytes:number|null;board_bytes?:number;material_bytes?:number;template_bytes?:number};
export function formatStorage(bytes:number){
  if(!Number.isFinite(bytes)||bytes<0)return "Нет данных";
  const units=["Б","КБ","МБ","ГБ","ТБ"];let value=bytes,index=0;
  while(value>=1024&&index<units.length-1){value/=1024;index++}
  return new Intl.NumberFormat("ru-RU",{maximumFractionDigits:index===0?0:2}).format(value)+" "+units[index];
}
export function StorageMeter({usage}:{usage:StorageUsage}){
  const limit=usage.limit_bytes, percent=limit===null?null:usage.used_bytes/limit*100;
  return <div className="storage-meter"><div className="storage-meter-line"><strong>{formatStorage(usage.used_bytes)}</strong><span>{limit===null?"Без лимита":"из "+formatStorage(limit)}</span></div>{limit!==null&&<><progress aria-label="Использование хранилища" max={limit} value={Math.min(limit,usage.used_bytes)} className={percent!==null&&percent>=85?"storage-near-limit":""}/><small>{usage.used_bytes>=limit?(usage.used_bytes>limit?"Лимит превышен. Освободите место.":"Лимит исчерпан"):`Свободно ${formatStorage(usage.remaining_bytes??Math.max(0,limit-usage.used_bytes))}`} · {new Intl.NumberFormat("ru-RU",{maximumFractionDigits:1}).format(percent??0)}%</small></>}</div>
}
export function StorageUsageCard({usage}:{usage:StorageUsage}){
  return <section className="billing-usage storage-usage-card" aria-label="Моё хранилище"><h2>Моё хранилище</h2><StorageMeter usage={usage}/>{usage.board_bytes!==undefined&&<div className="storage-breakdown">{[["Файлы на досках",usage.board_bytes],["Учебные материалы",usage.material_bytes],["Файлы шаблонов",usage.template_bytes]].map(([label,value])=><div key={label}><span>{label}</span><strong>{formatStorage(Number(value))}</strong></div>)}</div>}<p className="storage-note">Объём считается по файлам ваших досок, материалов и шаблонов, включая сохранённые файлы архивных досок. Служебные данные и история изменений не входят в тарифную квоту. Общие доски учитываются у владельца.</p></section>
}
