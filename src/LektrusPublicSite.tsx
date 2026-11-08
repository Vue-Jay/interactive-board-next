import {useEffect,useState} from "react";
import LektrusFeedbackForm from "./LektrusFeedbackForm";
import "./lektrusShowcaseRefresh.css";

type Section="overview"|"board"|"tools"|"about"|"feedback";
const sections:[Section,string,string][]=[["overview","Обзор","⌂"],["board","Интерактивная доска","▧"],["tools","Инструменты","✣"],["about","О проекте","◉"],["feedback","Связаться","↗"]];
const toolData=[
 {href:"/tools/atlas",index:"01",label:"ГЕОГРАФИЯ И ИСТОРИЯ",name:"Интерактивный атлас",description:"Изучайте страны, рельеф и исторические карты в отдельном полноэкранном пространстве.",symbol:"◎"},
 {href:"/tools/laboratory",index:"02",label:"ХИМИЯ",name:"Химическая лаборатория",description:"Собирайте установки и исследуйте вещества на виртуальном лабораторном столе.",symbol:"⚗"}
];
const boardShots=[
 {scene:"home",subject:"Главная приложения",src:"/site/app-home.png",label:"РАБОЧИЙ СТОЛ",title:"Всё нужное для занятий — на одном экране",hint:"Разделы, недавние доски и расписание собраны в рабочем пространстве."},
 {scene:"math",subject:"Математика",src:"/site/board-math.png",label:"ГРАФИК И ТАБЛИЦА",title:"Функция оживает на общей доске",hint:"Формула, график, таблица и вопрос для проверки понимания."},
 {scene:"chemistry",subject:"Химия",src:"/site/board-chemistry.png",label:"ЛАБОРАТОРИЯ",title:"От таблицы элементов — к опыту",hint:"Периодическая система и лабораторный стол на одном полотне."},
 {scene:"geometry",subject:"Геометрия",src:"/site/board-geometry.png",label:"ПОСТРОЕНИЕ И ИЗМЕРЕНИЕ",title:"Стройте и проверяйте гипотезы",hint:"Фигура, измерительный инструмент и интерактивное задание."},
 {scene:"physics",subject:"Физика",src:"/site/board-physics.png",label:"ЭЛЕКТРИЧЕСКАЯ ЦЕПЬ",title:"Разберите цепь по элементам",hint:"Настоящая схема, знакомые обозначения и вопрос по теме."},
 {scene:"contour",subject:"Контурная карта",src:"/site/board-contour.png",label:"ГЕОГРАФИЯ",title:"Подписывайте и исследуйте карту",hint:"Контурная карта, задания, подписи и отметки на общем поле."},
 {scene:"history",subject:"История",src:"/site/board-history.png",label:"ИСТОРИЧЕСКИЙ АТЛАС",title:"Сравнивайте карты разных эпох",hint:"Историческая карта соединена с вопросами и обсуждением."},
 {scene:"russian",subject:"Русский язык",src:"/site/board-russian.png",label:"ФОНЕТИЧЕСКИЙ РАЗБОР",title:"Исследуйте слово, звук за звуком",hint:"Интерактивная схема помогает работать с буквами и звуками."}
];

export default function LektrusPublicSite(){
 const [section,setSection]=useState<Section>("overview");
 const [activeShot,setActiveShot]=useState(0),[shotPaused,setShotPaused]=useState(false);
 useEffect(()=>{if(shotPaused)return;const timer=window.setInterval(()=>setActiveShot(value=>(value+1)%boardShots.length),7200);return()=>window.clearInterval(timer)},[shotPaused]);
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
     <div className="showcase-overview-copy"><div className="showcase-kicker"><i/> ОДНА ДОСКА ДЛЯ УРОКА, ИССЛЕДОВАНИЯ И ПРАКТИКИ</div><h1>Объясняйте.<br/><em>Исследуйте.</em><br/>Создавайте вместе.</h1><p>Lektrus соединяет общую интерактивную доску, предметные модели и задания, с которыми можно работать вместе.</p><div className="showcase-actions"><button className="showcase-primary" onClick={goDemo}>Попробовать доску <span>↗</span></button><button className="showcase-quiet" onClick={()=>setSection("tools")}>Отдельные инструменты <span>→</span></button></div><div className="showcase-facts"><span><b>01</b> Объясняйте наглядно</span><span><b>02</b> Давайте практику</span><span><b>03</b> Исследуйте вместе</span></div></div>
     <div className={`showcase-carousel showcase-carousel-${boardShots[activeShot].scene}`} aria-label="Снимки приложения и досок Lektrus">
      <div className="showcase-board-shot" aria-label={boardShots[activeShot].scene==="home"?"Главная страница приложения Lektrus":`Доска по предмету: ${boardShots[activeShot].subject}`}>
       <img key={boardShots[activeShot].src} src={boardShots[activeShot].src} alt={boardShots[activeShot].scene==="home"?"Главная страница приложения Lektrus":`Доска Lektrus по предмету: ${boardShots[activeShot].subject}`}/>
      </div>
      <div className="showcase-shot-meta"><small>{boardShots[activeShot].subject} · {boardShots[activeShot].label}</small><b>{boardShots[activeShot].title}</b><span>{boardShots[activeShot].hint}</span></div>
      <div className="showcase-carousel-controls"><div className="showcase-subject-tabs" role="group" aria-label="Выбрать предмет">{boardShots.map((shot,index)=><button key={shot.scene} type="button" className={activeShot===index?"active":""} aria-label={`Показать ${shot.subject}`} aria-pressed={activeShot===index} onClick={()=>setActiveShot(index)}>{shot.subject}</button>)}</div><div className="showcase-carousel-actions"><span>{String(activeShot+1).padStart(2,"0")} / {String(boardShots.length).padStart(2,"0")}</span><button className="showcase-carousel-pause" type="button" aria-label={shotPaused?"Продолжить прокрутку досок":"Остановить прокрутку досок"} title={shotPaused?"Продолжить":"Пауза"} onClick={()=>setShotPaused(value=>!value)}>{shotPaused?"▶":"Ⅱ"}</button><button className="showcase-carousel-next" type="button" aria-label="Следующий предмет" onClick={()=>setActiveShot(value=>(value+1)%boardShots.length)}>→</button></div></div>
     </div>
     <div className="showcase-bottom-note"><span><b>01</b><strong>Общая доска</strong><small>Все материалы урока на одном поле</small></span><span><b>02</b><strong>Предметные модели</strong><small>От графика до лаборатории</small></span><span><b>03</b><strong>Практика и обсуждение</strong><small>Ученики могут действовать сами</small></span></div>
    </div>}
    {section==="board"&&<div className="showcase-board-page"><div className="showcase-page-heading"><div><div className="showcase-kicker"><i/> ПРИМЕРЫ ПРИЛОЖЕНИЯ И ПРЕДМЕТНЫХ ДОСОК</div><h1>Один урок.<br/><em>Много способов показать.</em></h1><p>На доске можно соединить объяснение, наглядную модель, задание и совместную работу.</p><button className="showcase-primary" onClick={goDemo}>Запустить интерактивную доску <span>↗</span></button></div><div className="showcase-steps"><span><b>1</b><strong>Выберите инструмент</strong><small>Перо, текст, фигура или модель</small></span><span><b>2</b><strong>Создайте на доске</strong><small>Добавьте материалы и задания</small></span><span><b>3</b><strong>Работайте вместе</strong><small>Обсуждайте и исследуйте</small></span></div></div><div className="showcase-board-gallery" aria-label="Примеры предметных досок">{boardShots.filter(shot=>shot.scene!=="home").map(shot=><article className="showcase-board-card" key={shot.scene}><div className="showcase-board-card-image"><img src={shot.src} alt={`Доска Lektrus по предмету: ${shot.subject}`}/></div><div className="showcase-board-card-copy"><small>{shot.subject} · {shot.label}</small><b>{shot.title}</b><span>{shot.hint}</span></div></article>)}</div><div className="showcase-board-footer"><span>Попробуйте инструменты и создайте свой урок.</span><button onClick={goDemo}>Открыть доску <span>↗</span></button></div></div>}
    {section==="tools"&&<div className="showcase-tools-page"><div className="showcase-kicker"><i/> ПРЕДМЕТНЫЕ ПРОСТРАНСТВА</div><h1>Инструменты для<br/><em>открытий и практики.</em></h1><p>Каждый инструмент запускается отдельно на весь экран. Доска для этого не нужна.</p><div className="showcase-tool-grid">{toolData.map(tool=><a className="showcase-tool-card" href={tool.href} key={tool.index}><div className="showcase-tool-top"><span>{tool.symbol}</span><small>{tool.label}</small><b>{tool.index}</b></div><h2>{tool.name}</h2><p>{tool.description}</p><strong>Открыть инструмент <i>↗</i></strong><div className="showcase-tool-lines" aria-hidden="true"/></a>)}</div><div className="showcase-tools-foot"><span>Открываются отдельно, без привязки к доске</span><button onClick={goDemo}>Или открыть общую доску <b>↗</b></button></div></div>}
    {section==="about"&&<div className="showcase-about-page"><div className="showcase-kicker"><i/> ПРОЕКТ LEKTRUS</div><div className="showcase-about-grid"><div><h1>Понятные идеи<br/><em>начинаются с наглядности.</em></h1><p>Lektrus объединяет совместную интерактивную доску и самостоятельные предметные инструменты. На доске можно объяснять и создавать вместе, а инструменты позволяют исследовать тему в собственном темпе.</p><button className="showcase-primary" onClick={goDemo}>Познакомиться с доской <span>↗</span></button></div><div className="showcase-about-list"><span><b>01</b><strong>Объяснять</strong><small>Показывайте ход мысли прямо на общем поле.</small></span><span><b>02</b><strong>Исследовать</strong><small>Открывайте карты, модели и лабораторные опыты.</small></span><span><b>03</b><strong>Работать вместе</strong><small>Делитесь пространством урока и материалами.</small></span></div></div><div className="showcase-about-visual"><img src="/lektrus-icon-192.png" alt=""/><span>LEKTRUS</span><b>Пространство для обучения</b></div></div>}
    {section==="feedback"&&<div className="showcase-feedback-page"><div className="showcase-feedback-copy"><div className="showcase-kicker"><i/> ОБРАТНАЯ СВЯЗЬ</div><h1>Помогите сделать<br/><em>Lektrus лучше.</em></h1><p>Идеи, отзывы и сообщения о проблемах помогают нам развивать сервис. Напишите команде или отправьте сообщение через форму.</p>{import.meta.env.VITE_TELEGRAM_URL&&<a className="showcase-telegram" href={import.meta.env.VITE_TELEGRAM_URL} target="_blank" rel="noreferrer">Написать в Telegram <span>↗</span></a>}</div><div className="showcase-feedback-form"><LektrusFeedbackForm compact source="site"/></div></div>}
   </div>
   <footer className="showcase-footer"><span>© Lektrus · Пространство для обучения</span><button onClick={()=>setSection("feedback")}>Отзывы и предложения <span>↗</span></button><a href="/app">Войти <span>↗</span></a></footer>
  </section>
 </main>;
}
