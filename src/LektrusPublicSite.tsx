import {useState} from "react";
import LektrusFeedbackForm from "./LektrusFeedbackForm";

type Section="overview"|"board"|"tools"|"about"|"feedback";
const sections:[Section,string,string][]=[["overview","Обзор","⌂"],["board","Интерактивная доска","▧"],["tools","Инструменты","✣"],["about","О проекте","◉"],["feedback","Связаться","↗"]];
const toolData=[
 {href:"/tools/atlas",index:"01",label:"ГЕОГРАФИЯ И ИСТОРИЯ",name:"Интерактивный атлас",description:"Изучайте страны, рельеф и исторические карты в отдельном полноэкранном пространстве.",symbol:"◎"},
 {href:"/tools/laboratory",index:"02",label:"ХИМИЯ",name:"Химическая лаборатория",description:"Собирайте установки и исследуйте вещества на виртуальном лабораторном столе.",symbol:"⚗"}
];

export default function LektrusPublicSite(){
 const [section,setSection]=useState<Section>("overview");
 const goDemo=()=>{
  const id="00000000-0000-4000-8000-0000000000a0",key=`lesson-board.document.v1.board.${id}`;
  try{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,title:"Попробуйте доску",view:{x:0,y:0,zoom:1},items:[]}))}catch{/* The demo can still open without persistent storage. */}
  window.location.assign("/demo/board");
 };
 return <main className="lektrus-showcase">
  <aside className="showcase-rail">
   <a className="showcase-brand" href="/" aria-label="Lektrus, главная"><img src="/lektrus-icon-192.png" alt=""/><span><b>Lektrus</b><small>Пространство для обучения</small></span></a>
   <div className="showcase-rail-caption">ЗНАКОМСТВО С LEKTRUS</div>
   <nav className="showcase-nav" aria-label="Разделы сайта">{sections.map(([id,label,icon])=><button key={id} type="button" className={section===id?"active":""} onClick={()=>setSection(id)} aria-current={section===id?"page":undefined}><span aria-hidden="true">{icon}</span><b>{label}</b>{id==="board"&&<i>ДЕМО</i>}</button>)}</nav>
   <div className="showcase-rail-bottom"><span className="showcase-status"><i/> Доска доступна для знакомства</span><a className="showcase-login" href="/app">Войти в аккаунт <span>↗</span></a><small>Обучение, в котором можно действовать</small></div>
  </aside>
  <section className="showcase-workspace">
   <header className="showcase-topbar"><div><span>LEKTRUS</span><i>/</i><b>{sections.find(item=>item[0]===section)?.[1]}</b></div><a href="/app">Перейти в приложение <span>↗</span></a></header>
   <div className={`showcase-content showcase-${section}`}>
    {section==="overview"&&<div className="showcase-overview">
     <div className="showcase-overview-copy"><div className="showcase-kicker"><i/> ОБЩЕЕ ПРОСТРАНСТВО ДЛЯ УРОКОВ И ИДЕЙ</div><h1>Объясняйте.<br/><em>Исследуйте.</em><br/>Создавайте вместе.</h1><p>Lektrus — интерактивная доска с предметными инструментами для преподавателей и учеников.</p><div className="showcase-actions"><button className="showcase-primary" onClick={goDemo}>Открыть живую демо-доску <span>↗</span></button><button className="showcase-quiet" onClick={()=>setSection("tools")}>Посмотреть инструменты <span>→</span></button></div><div className="showcase-facts"><span><b>01</b> Одна общая доска</span><span><b>02</b> Инструменты для предметов</span><span><b>03</b> Компьютер и планшет</span></div></div>
     <button className="showcase-board-shot" type="button" onClick={goDemo} aria-label="Открыть интерактивную демонстрацию доски"><img src="/site/board-showcase.png" alt="Реальный экран Lektrus: интерактивная доска с лабораторией и учебными материалами"/><span className="showcase-shot-label"><i/> РЕАЛЬНАЯ ДОСКА LEKTRUS</span><span className="showcase-shot-play" aria-hidden="true">▶</span><span className="showcase-shot-caption"><b>Доска, на которой объясняют наглядно</b><small>Нажмите и попробуйте инструменты сами</small></span></button>
     <div className="showcase-bottom-note"><span>ОДИН УРОК — МНОГО СПОСОБОВ ПОКАЗАТЬ</span><b>Рисуйте · обсуждайте · исследуйте</b><button onClick={()=>setSection("board")}>Как работает доска <span>→</span></button></div>
    </div>}
    {section==="board"&&<div className="showcase-board-page"><div className="showcase-page-heading"><div><div className="showcase-kicker"><i/> ПОПРОБУЙТЕ САМИ</div><h1>Доска работает,<br/><em>пока вы с ней работаете.</em></h1><p>Здесь настоящее приложение Lektrus. Можно рисовать, добавлять текст и фигуры, перемещаться по рабочему пространству.</p><button className="showcase-primary" onClick={goDemo}>Запустить интерактивную доску <span>↗</span></button></div><div className="showcase-steps"><span><b>1</b><strong>Выберите инструмент</strong><small>Перо, текст, фигура или выделение</small></span><span><b>2</b><strong>Создайте на доске</strong><small>Добавьте материал в рабочее пространство</small></span><span><b>3</b><strong>Продолжайте исследовать</strong><small>Попробуйте предметные инструменты</small></span></div></div><button className="showcase-board-shot large" onClick={goDemo}><img src="/site/board-showcase.png" alt="Реальный снимок доски Lektrus с предметными материалами"/><span className="showcase-shot-label"><i/> ЭКРАН НАСТОЯЩЕГО ПРИЛОЖЕНИЯ</span><span className="showcase-shot-play" aria-hidden="true">▶</span></button><div className="showcase-board-footer"><span>Нажмите на доску — откроется интерактивная демонстрация</span><button onClick={goDemo}>Открыть доску <span>↗</span></button></div></div>}
    {section==="tools"&&<div className="showcase-tools-page"><div className="showcase-kicker"><i/> ПРЕДМЕТНЫЕ ПРОСТРАНСТВА</div><h1>Инструменты для<br/><em>открытий и практики.</em></h1><p>Каждый инструмент запускается отдельно на весь экран. Доска для этого не нужна.</p><div className="showcase-tool-grid">{toolData.map(tool=><a className="showcase-tool-card" href={tool.href} key={tool.index}><div className="showcase-tool-top"><span>{tool.symbol}</span><small>{tool.label}</small><b>{tool.index}</b></div><h2>{tool.name}</h2><p>{tool.description}</p><strong>Открыть инструмент <i>↗</i></strong><div className="showcase-tool-lines" aria-hidden="true"/></a>)}</div><div className="showcase-tools-foot"><span>Открываются отдельно, без привязки к доске</span><button onClick={goDemo}>Или открыть общую доску <b>↗</b></button></div></div>}
    {section==="about"&&<div className="showcase-about-page"><div className="showcase-kicker"><i/> ПРОЕКТ LEKTRUS</div><div className="showcase-about-grid"><div><h1>Понятные идеи<br/><em>начинаются с наглядности.</em></h1><p>Lektrus объединяет совместную интерактивную доску и самостоятельные предметные инструменты. На доске можно объяснять и создавать вместе, а инструменты позволяют исследовать тему в собственном темпе.</p><button className="showcase-primary" onClick={goDemo}>Познакомиться с доской <span>↗</span></button></div><div className="showcase-about-list"><span><b>01</b><strong>Объяснять</strong><small>Показывайте ход мысли прямо на общем поле.</small></span><span><b>02</b><strong>Исследовать</strong><small>Открывайте карты, модели и лабораторные опыты.</small></span><span><b>03</b><strong>Работать вместе</strong><small>Делитесь пространством урока и материалами.</small></span></div></div><div className="showcase-about-visual"><img src="/lektrus-icon-192.png" alt=""/><span>LEKTRUS</span><b>Пространство для обучения</b></div></div>}
    {section==="feedback"&&<div className="showcase-feedback-page"><div className="showcase-feedback-copy"><div className="showcase-kicker"><i/> ОБРАТНАЯ СВЯЗЬ</div><h1>Помогите сделать<br/><em>Lektrus лучше.</em></h1><p>Идеи, отзывы и сообщения о проблемах помогают нам развивать сервис. Напишите команде или отправьте сообщение через форму.</p>{import.meta.env.VITE_TELEGRAM_URL&&<a className="showcase-telegram" href={import.meta.env.VITE_TELEGRAM_URL} target="_blank" rel="noreferrer">Написать в Telegram <span>↗</span></a>}</div><div className="showcase-feedback-form"><LektrusFeedbackForm compact source="site"/></div></div>}
   </div>
   <footer className="showcase-footer"><span>© Lektrus · Пространство для обучения</span><button onClick={()=>setSection("feedback")}>Отзывы и предложения <span>↗</span></button><a href="/app">Войти <span>↗</span></a></footer>
  </section>
 </main>;
}
