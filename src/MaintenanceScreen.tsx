import type {MaintenanceStatus} from "./selfhostApi";

/** A planned service pause is information, not a connection error or dialog. */
export function MaintenanceScreen({status,time}:{status:MaintenanceStatus;time:string}){
  return <main className="maintenance-screen" aria-labelledby="maintenance-screen-title">
    <div className="maintenance-screen-brand"><img src="/lektrus-icon-192.png" width="38" height="38" alt=""/><span>Lektrus</span></div>
    <section className="maintenance-screen-content" role="status" aria-live="polite">
      <div className="maintenance-screen-symbol" aria-hidden="true">
        <svg viewBox="0 0 96 96" fill="none">
          <circle cx="48" cy="48" r="37" stroke="currentColor" strokeOpacity=".18" strokeWidth="1.5" strokeDasharray="3 6"/>
          <path d="M57 24a19 19 0 0 0-24 24L18 63a9 9 0 0 0 13 13l15-15a19 19 0 0 0 24-24l-11 11-11-11 9-13Z" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="m67 67 9 9m-5-13v17m-8-8h17M22 22v12m-6-6h12" stroke="currentColor" strokeOpacity=".55" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="maintenance-screen-eyebrow">Технические работы</p>
      <h1 id="maintenance-screen-title">Скоро вернёмся</h1>
      <p className="maintenance-screen-message">{status.notice||"Проводим техническое обслуживание Lektrus. Платформа временно недоступна."}</p>
      <p className="maintenance-screen-time">{time}</p>
      <p className="maintenance-screen-note"><span aria-hidden="true"/>Доступ восстановится автоматически после окончания работ.</p>
    </section>
    <div className="maintenance-screen-footer">Пространство для обучения</div>
  </main>;
}
