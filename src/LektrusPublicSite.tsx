import LektrusFeedbackForm from "./LektrusFeedbackForm";

const features=[
 {number:"01",title:"Один урок — в одном пространстве",text:"Объясняйте на доске, собирайте идеи вместе и возвращайтесь к материалам после занятия."},
 {number:"02",title:"Инструменты работают рядом",text:"Схемы, карты, графики, формулы и химическая лаборатория становятся частью доски."},
 {number:"03",title:"Подстраивается под ваш урок",text:"Создайте чистый холст или начните с шаблона, а потом меняйте его прямо во время занятия."},
];

export default function LektrusPublicSite(){
 return <main className="lektrus-public-site">
  <header className="lektrus-site-header">
   <a className="lektrus-site-brand" href="/" aria-label="Lektrus — главная страница"><img src="/lektrus-icon-192.png" alt=""/><span><strong>Lektrus</strong><small>Пространство для обучения</small></span></a>
   <nav className="lektrus-site-nav" aria-label="Навигация по сайту"><a href="#possibilities">Возможности</a><a href="#tools">Инструменты</a><a href="#about">О проекте</a></nav>
   <a className="lektrus-site-login" href="/app">Войти в аккаунт <span aria-hidden="true">↗</span></a>
  </header>

  <section className="lektrus-site-hero">
   <div className="lektrus-site-hero-copy">
    <span className="lektrus-site-kicker"><i/> ИНТЕРАКТИВНОЕ ПРОСТРАНСТВО ДЛЯ ОБУЧЕНИЯ</span>
    <h1>Урок, в котором хочется <em>участвовать</em></h1>
    <p>Lektrus соединяет интерактивную доску, учебные инструменты и совместную работу — чтобы сложные темы становились наглядными.</p>
    <div className="lektrus-site-hero-actions"><a className="lektrus-site-primary" href="/app">Войти или создать аккаунт <span aria-hidden="true">↗</span></a><a className="lektrus-site-text-link" href="#tools">Посмотреть инструменты <span aria-hidden="true">↓</span></a></div>
    <div className="lektrus-site-proof"><span><b>✦</b> Для преподавателей и учеников</span><span><b>◉</b> Работает на компьютере, планшете и телефоне</span></div>
   </div>
   <div className="lektrus-ad-scene" aria-label="Анимированная демонстрация интерактивной доски Lektrus">
    <div className="lektrus-ad-orbit lektrus-ad-orbit-a"/><div className="lektrus-ad-orbit lektrus-ad-orbit-b"/>
    <div className="lektrus-ad-window">
     <div className="lektrus-ad-window-top"><div className="lektrus-ad-dots"><i/><i/><i/></div><span>Урок · Движение и энергия</span><b>● 2</b></div>
     <div className="lektrus-ad-board">
      <div className="lektrus-ad-board-label">ФИЗИКА · 8 КЛАСС</div>
      <div className="lektrus-ad-formula">s = v · t</div>
      <div className="lektrus-ad-formula-caption">Путь равен скорости, умноженной на время</div>
      <svg className="lektrus-ad-graph" viewBox="0 0 280 92" role="presentation"><path className="lektrus-ad-gridline" d="M16 8v72M66 8v72M116 8v72M166 8v72M216 8v72M266 8v72M8 18h264M8 42h264M8 66h264"/><path className="lektrus-ad-axis" d="M16 80V10M16 80h253"/><path className="lektrus-ad-draw-path" d="M24 71 C76 61 111 48 145 39 S218 18 258 12"/></svg>
      <div className="lektrus-ad-note"><span>Проверим на примере</span><strong>v = 4 м/с · t = 6 с</strong><b>s = 24 м</b></div>
      <div className="lektrus-ad-cursor"><i/></div>
     </div>
     <div className="lektrus-ad-toolbar"><i>↖</i><i>✎</i><i>▱</i><i>⌕</i><span>Масштаб 100%</span><b>✦ Lektrus</b></div>
    </div>
    <div className="lektrus-ad-float lektrus-ad-float-lab"><span>⚗</span><div><b>Химическая лаборатория</b><small>Экспериментируйте на доске</small></div></div>
    <div className="lektrus-ad-float lektrus-ad-float-atlas"><span>⌖</span><div><b>Атласы и карты</b><small>Исследуйте вместе</small></div></div>
    <div className="lektrus-ad-caption"><span className="lektrus-ad-play">▶</span><span><b>Посмотрите, как оживает урок</b><small>Короткая анимированная демонстрация</small></span><i>01 / 03</i></div>
   </div>
  </section>

  <div className="lektrus-site-ribbon" aria-label="Основные возможности"><span>ОБЪЯСНЯТЬ НАГЛЯДНО</span><i>✳</i><span>ИССЛЕДОВАТЬ</span><i>✳</i><span>СОЗДАВАТЬ ВМЕСТЕ</span><i>✳</i><span>УЧИТЬСЯ С ИНТЕРЕСОМ</span></div>

  <section className="lektrus-site-section lektrus-site-possibilities" id="possibilities">
   <div className="lektrus-site-section-heading"><div><span className="lektrus-site-section-kicker">ЗАДУМАН ДЛЯ НАСТОЯЩЕГО УРОКА</span><h2>Не просто доска.<br/><em>Пространство для открытий.</em></h2></div><p>Когда объяснение, практика и обратная связь рядом, ученику проще включиться, а преподавателю — вести урок своим способом.</p></div>
   <div className="lektrus-site-feature-grid">{features.map(item=><article className="lektrus-site-feature" key={item.number}><span>{item.number}</span><div><h3>{item.title}</h3><p>{item.text}</p></div><b aria-hidden="true">↗</b></article>)}</div>
  </section>

  <section className="lektrus-site-tools" id="tools">
   <div className="lektrus-site-tools-heading"><span className="lektrus-site-section-kicker">ИНСТРУМЕНТЫ LEKTRUS</span><h2>Покажите идею.<br/><em>Дайте её исследовать.</em></h2><p>Выбирайте подходящий инструмент и открывайте его прямо на рабочей доске.</p></div>
   <div className="lektrus-site-tool-grid">
    <a className="lektrus-site-tool-card lektrus-site-tool-board" href="/app"><span className="lektrus-site-tool-symbol">↗</span><small>ОБЩАЯ ДОСКА</small><h3>Объясняйте и создавайте вместе</h3><p>Рисуйте, добавляйте объекты и работайте с учениками в общем пространстве.</p><b>Открыть приложение <i>↗</i></b><div className="lektrus-tool-mini-board"><span>∑</span><i/><i/><i/></div></a>
    <a className="lektrus-site-tool-card lektrus-site-tool-atlas" href="/app?section=subjects"><span className="lektrus-site-tool-symbol">⌖</span><small>АТЛАСЫ</small><h3>Исследуйте мир и его устройство</h3><p>Открывайте карты и учебные атласы, изучайте объекты в удобном масштабе.</p><b>Перейти к предметам <i>↗</i></b><div className="lektrus-tool-mini-map"><span>◌</span><i/><i/></div></a>
    <a className="lektrus-site-tool-card lektrus-site-tool-chemistry" href="/app?section=boards"><span className="lektrus-site-tool-symbol">⚗</span><small>ХИМИЧЕСКАЯ ЛАБОРАТОРИЯ</small><h3>Проверяйте гипотезы безопасно</h3><p>Собирайте лабораторную установку и наблюдайте за реакцией прямо на доске.</p><b>Создать доску <i>↗</i></b><div className="lektrus-tool-mini-flask"><i/><span/></div></a>
   </div>
  </section>

  <section className="lektrus-site-about" id="about"><div className="lektrus-site-about-mark">L</div><div><span className="lektrus-site-section-kicker">ЗНАКОМЬТЕСЬ — LEKTRUS</span><h2>Каждому уроку —<br/><em>своё пространство.</em></h2><p>Мы создаём инструменты, которые помогают объяснять сложное, поддерживают любопытство и дают преподавателю свободу строить урок по-своему.</p><a href="/app">Начать работу <span>↗</span></a></div><div className="lektrus-site-about-stamp"><span>ИДЕИ</span><b>→</b><span>ОТКРЫТИЯ</span><i>LEKTRUS</i></div></section>

  <section className="lektrus-site-contact" id="feedback"><div className="lektrus-site-contact-copy"><span className="lektrus-site-section-kicker">ДАВАЙТЕ СОЗДАВАТЬ ВМЕСТЕ</span><h2>Что добавить<br/>в Lektrus дальше?</h2><p>Поделитесь предложением, отзывом или вопросом. Сообщение попадёт команде проекта.</p><div className="lektrus-site-contact-note"><span>↗</span><span><b>Мы на связи</b><small>Ответим, если вы оставите email.</small></span></div></div><div className="lektrus-site-contact-form"><LektrusFeedbackForm compact source="site"/></div></section>

  <footer className="lektrus-site-footer"><a className="lektrus-site-brand" href="/" aria-label="Lektrus — наверх"><img src="/lektrus-icon-192.png" alt=""/><span><strong>Lektrus</strong><small>Пространство для обучения</small></span></a><span>Учитесь, объясняйте и исследуйте вместе.</span><div><a href="#feedback">Обратная связь</a><a href={import.meta.env.VITE_TELEGRAM_URL||"#feedback"} target={import.meta.env.VITE_TELEGRAM_URL?"_blank":undefined} rel={import.meta.env.VITE_TELEGRAM_URL?"noreferrer":undefined}>{import.meta.env.VITE_TELEGRAM_URL?"Telegram":"Предложения"} <i>↗</i></a><a href="/app">Войти в аккаунт <i>↗</i></a></div></footer>
 </main>;
}
