import LektrusFeedbackForm from "./LektrusFeedbackForm";

const tools=[
 {href:"/tools/atlas",number:"01",category:"ГЕОГРАФИЯ · ИСТОРИЯ",title:"Интерактивный атлас",text:"Исследуйте страны, рельеф, города и исторические карты. Масштабируйте и изучайте данные самостоятельно.",icon:"atlas",action:"Открыть атлас"},
 {href:"/tools/laboratory",number:"02",category:"ХИМИЯ",title:"Химическая лаборатория",text:"Собирайте установки, выбирайте вещества и наблюдайте за ходом опыта на виртуальном лабораторном столе.",icon:"lab",action:"Начать эксперимент"}
];

function ToolIcon({name}:{name:string}){
 return name==="atlas"?<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="17"/><path d="M7 24h34M24 7c5 5 7 11 7 17s-2 12-7 17M24 7c-5 5-7 11-7 17s2 12 7 17M11 14h26M11 34h26"/></svg>
  :<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 7h12M21 7v12L10 38a3 3 0 0 0 3 4h22a3 3 0 0 0 3-4L27 19V7M15 32h18M19 26h10"/><circle cx="22" cy="34" r="1"/><circle cx="28" cy="37" r="1"/></svg>;
}

export default function LektrusPublicSite(){
 return <main className="lektrus-public-site lps-site">
  <header className="lps-header">
   <a className="lps-brand" href="/" aria-label="Lektrus — главная"><img src="/lektrus-icon-192.png" alt=""/><span><strong>Lektrus</strong><small>Пространство для обучения</small></span></a>
   <nav className="lps-nav" aria-label="Главная навигация"><a href="#tools">Инструменты</a><a href="#about">О проекте</a><a href="#feedback">Обратная связь</a></nav>
   <a className="lps-login" href="/app">Войти <span aria-hidden="true">↗</span></a>
  </header>

  <section className="lps-hero">
   <div className="lps-hero-copy">
    <span className="lps-eyebrow"><i/> ИНТЕРАКТИВНАЯ СРЕДА ДЛЯ ОБУЧЕНИЯ</span>
    <h1>Учиться — значит <em>исследовать.</em></h1>
    <p>Lektrus объединяет общую доску и учебные инструменты, которые помогают объяснять сложное наглядно и разбираться самостоятельно.</p>
    <div className="lps-actions"><a className="lps-primary" href="/app">Войти или создать аккаунт <span aria-hidden="true">↗</span></a><a className="lps-secondary" href="#tools">Познакомиться с инструментами <span aria-hidden="true">↓</span></a></div>
    <div className="lps-proof"><span><b>01</b> Для преподавателей и учеников</span><span><b>02</b> Компьютер, планшет и телефон</span></div>
   </div>
   <aside className="lps-preview" aria-label="Инструменты Lektrus">
    <div className="lps-preview-head"><span>LEKTRUS · ИНСТРУМЕНТЫ</span><span className="lps-live"><i/> РАБОТАЮТ СЕЙЧАС</span></div>
    <p>Откройте настоящий инструмент<br/>и попробуйте его сами.</p>
    {tools.map(item=><a className="lps-preview-row" href={item.href} key={item.number}><span className="lps-preview-icon"><ToolIcon name={item.icon}/></span><span><small>{item.category}</small><strong>{item.title}</strong><em>{item.action}</em></span><b aria-hidden="true">↗</b></a>)}
    <div className="lps-preview-note"><span aria-hidden="true">↳</span> Открываются отдельно, без привязки к доске</div>
   </aside>
  </section>

  <section className="lps-principles" aria-label="Принципы Lektrus"><span>Меньше объяснений на словах</span><i>·</i><span>Больше наглядной практики</span><i>·</i><span>Один понятный цифровой инструмент</span></section>

  <section className="lps-tools" id="tools">
   <div className="lps-section-intro"><div><span className="lps-eyebrow">ИНСТРУМЕНТЫ</span><h2>Открывайте и изучайте</h2></div><p>Самостоятельные рабочие пространства. Их можно использовать отдельно от досок и уроков.</p></div>
   <div className="lps-tool-grid">{tools.map(item=><a className="lps-tool-card" href={item.href} key={item.number}>
    <div className="lps-tool-card-top"><span className="lps-tool-icon"><ToolIcon name={item.icon}/></span><small>{item.category}</small><span className="lps-tool-number">{item.number}</span></div>
    <h3>{item.title}</h3><p>{item.text}</p><span className="lps-tool-open">{item.action}<b aria-hidden="true">↗</b></span>
   </a>)}</div>
  </section>

  <section className="lps-about" id="about"><span className="lps-about-mark"><img src="/lektrus-icon-192.png" alt=""/></span><div><span className="lps-eyebrow">О LEKTRUS</span><h2>Пространство, где идея становится понятной.</h2><p>Мы развиваем инструменты для обучения: интерактивную доску, предметные рабочие пространства и средства совместной работы.</p><a href="/app">Перейти в приложение <span aria-hidden="true">↗</span></a></div><div className="lps-about-index"><span>ОБЪЯСНЯТЬ</span><b>·</b><span>ИССЛЕДОВАТЬ</span><b>·</b><span>СОЗДАВАТЬ</span></div></section>

  <section className="lps-feedback" id="feedback"><div className="lps-feedback-copy"><span className="lps-eyebrow">ОБРАТНАЯ СВЯЗЬ</span><h2>Что сделать лучше?</h2><p>Поделитесь предложением, отзывом или вопросом. Сообщение попадёт команде проекта.</p><a href={import.meta.env.VITE_TELEGRAM_URL||"#feedback"} target={import.meta.env.VITE_TELEGRAM_URL?"_blank":undefined} rel={import.meta.env.VITE_TELEGRAM_URL?"noreferrer":undefined}>{import.meta.env.VITE_TELEGRAM_URL?"Telegram проекта":"Написать команде"} <span aria-hidden="true">↗</span></a></div><div className="lps-feedback-form"><LektrusFeedbackForm compact source="site"/></div></section>

  <footer className="lps-footer"><a className="lps-brand" href="/" aria-label="Lektrus — наверх"><img src="/lektrus-icon-192.png" alt=""/><span><strong>Lektrus</strong><small>Пространство для обучения</small></span></a><span>Учитесь, объясняйте и исследуйте вместе.</span><div><a href="#tools">Инструменты</a><a href="#feedback">Обратная связь</a><a href="/app">Войти <i>↗</i></a></div></footer>
 </main>;
}
