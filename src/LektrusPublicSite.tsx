import {useEffect,useRef,useState,type CSSProperties,type MouseEvent,type ReactNode} from "react";
import {defaultSiteDocument,loadPublishedSiteDocument,normalizeSiteDocument,siteDraft,SITE_PREVIEW_MESSAGE,type SiteDocument} from "./marketingSiteConfig";
import {SiteCustomPage,SiteEditableBlocks} from "./SiteEditableSections";
import LektrusFeedbackForm from "./LektrusFeedbackForm";
import {plans,limitLabel} from "./billingStore";
import "./lektrusMarketing.css";

type Page=string;
const navigation:{id:Page;title:string}[]=[
 {id:"home",title:"Главная"},
 {id:"features",title:"Возможности"},
 {id:"teachers",title:"Учителям"},
 {id:"students",title:"Ученикам"},
 {id:"how",title:"Как это работает"},
 {id:"pricing",title:"Тарифы"},
 {id:"about",title:"О Lektrus"},
 {id:"help",title:"Помощь и контакты"}
];
const boardShots=[
 {scene:"math",subject:"Математика",src:"/site/board-math.png",title:"Графики и функции",description:"Исследуйте функции, таблицы и графики на одном холсте."},
 {scene:"chemistry",subject:"Химия",src:"/site/board-chemistry.png",title:"Химические опыты",description:"Работайте с периодической системой и виртуальной лабораторией."},
 {scene:"geometry",subject:"Геометрия",src:"/site/board-geometry.png",title:"Построения",description:"Создавайте фигуры и проверяйте геометрические свойства."},
 {scene:"physics",subject:"Физика",src:"/site/board-physics.png",title:"Электрические цепи",description:"Изучайте схемы с привычными обозначениями."},
 {scene:"contour",subject:"География",src:"/site/board-contour.png",title:"Контурные карты",description:"Отмечайте объекты, работайте с картами и заданиями."},
 {scene:"history",subject:"История",src:"/site/board-history.png",title:"Исторический атлас",description:"Сравнивайте территории и события разных эпох."},
 {scene:"russian",subject:"Русский язык",src:"/site/board-russian.png",title:"Фонетический разбор",description:"Разбирайте буквы и звуки в интерактивной схеме."}
];
const showcaseShots=[
 {scene:"home",subject:"Рабочее пространство",src:"/site/app-home.png",title:"Подготовьте урок на рабочем столе",description:"Ваши доски, материалы и расписание собраны в одном месте."},
 ...boardShots
];
const featureCards=[
 {index:"01",title:"Свободная доска",text:"Пишите, рисуйте, размещайте текст, изображения, фигуры и документы.",scene:"geometry"},
 {index:"02",title:"Совместная работа",text:"Объясняйте материал и работайте с участниками на общем холсте.",scene:"math"},
 {index:"03",title:"Предметные модели",text:"Изучайте графики, электрические цепи, карты и другие учебные объекты.",scene:"physics"},
 {index:"04",title:"Виртуальные лаборатории",text:"Исследуйте вещества и оборудование в химической лаборатории.",scene:"chemistry"},
 {index:"05",title:"Задания и практика",text:"Объединяйте объяснение, вопросы и практическую работу на доске.",scene:"russian"},
 {index:"06",title:"Материалы урока",text:"Подготавливайте содержимое занятия и возвращайтесь к сохранённым доскам.",scene:"math"}
];
const toolData=[
 {href:"/tools/atlas",name:"Интерактивный атлас",subject:"География и история",text:"Исследуйте карты и пространственные объекты в отдельном полноэкранном инструменте.",image:"/site/board-history.png"},
 {href:"/tools/laboratory",name:"Химическая лаборатория",subject:"Химия",text:"Собирайте установки и исследуйте вещества на виртуальном лабораторном столе.",image:"/site/board-chemistry.png"}
];
const teacherStories=[
 {number:"01",title:"Подготовка объяснения",text:"Соберите материалы, схемы и изображения для предстоящего урока."},
 {number:"02",title:"Наглядный разбор",text:"Показывайте ход решения и разбирайте сложные темы прямо на доске."},
 {number:"03",title:"Совместная практика",text:"Предлагайте ученикам задания и обсуждайте результат вместе."},
 {number:"04",title:"Возвращение к материалу",text:"Открывайте сохранённые доски, чтобы продолжить занятие или повторить тему."}
];
const steps=[
 {number:"01",title:"Создайте доску",text:"Начните с чистого пространства или подготовленного учебного материала.",image:"/site/app-home.png",alt:"Главная страница приложения Lektrus"},
 {number:"02",title:"Добавьте необходимое",text:"Размещайте текст, изображения, фигуры и предметные инструменты в одном месте.",image:"/site/board-geometry.png",alt:"Геометрические объекты на доске Lektrus"},
 {number:"03",title:"Работайте вместе",text:"Обсуждайте учебный материал и выполняйте задания с участниками занятия.",image:"/site/board-math.png",alt:"Математическая доска с заданием"},
 {number:"04",title:"Сохраните результат",text:"Возвращайтесь к подготовленным доскам и продолжайте работу в удобное время.",image:"/site/board-russian.png",alt:"Сохранённый пример фонетического разбора"}
];
const advantages=[
 {number:"01",title:"Единое пространство",text:"Интерактивная доска, учебные материалы и инструменты работают вместе."},
 {number:"02",title:"Наглядное объяснение",text:"От рукописной заметки до предметной модели, которая помогает увидеть связи."},
 {number:"03",title:"Совместная работа",text:"Преподаватель и ученики могут взаимодействовать в общем учебном пространстве."},
 {number:"04",title:"Практика по предметам",text:"Графики, карты, схемы, лабораторные опыты и другие учебные объекты."},
 {number:"05",title:"Гибкий формат",text:"Используйте Lektrus для объяснения, закрепления и самостоятельного изучения."}
];
const questions=[
 {q:"Что такое Lektrus?",a:"Это образовательная платформа с интерактивной доской, предметными инструментами и возможностями совместной работы."},
 {q:"Можно ли попробовать доску без аккаунта?",a:"Да. На сайте есть отдельная гостевая демонстрация. Изменения в ней не затрагивают рабочие доски других пользователей."},
 {q:"Какие инструменты доступны отдельно?",a:"Интерактивный атлас и химическую лабораторию можно открыть напрямую, без создания доски."},
 {q:"Какие тарифы есть в Lektrus?",a:"В приложении определены Free, Teacher и Pro. Free бесплатный, а условия платных тарифов пока имеют тестовый статус."},
 {q:"Куда отправить предложение или сообщение об ошибке?",a:"Используйте форму обратной связи ниже. Можно указать тему обращения и адрес для ответа."}
];
function readPage():Page{
 const hash=window.location.hash.replace(/^#/,"");
 return /^[a-z][a-z0-9-]{0,39}$/.test(hash)?hash:"home";
}
function DemoLink({scene="math",children,className=""}:{scene?:string;children:ReactNode;className?:string}){
 return <a className={className} href={"/demo/board?scene="+encodeURIComponent(scene)}>{children}</a>;
}

export default function LektrusPublicSite(){
 const isPreview=new URLSearchParams(window.location.search).has("site-preview");
 const [config,setConfig]=useState<SiteDocument>(()=>isPreview?siteDraft():defaultSiteDocument());
 const [page,setPage]=useState<Page>(readPage);
 const siteNavigation=config.navigation.length?config.navigation.filter(item=>!item.hidden||item.id==="home"):navigation;
 const customPage=config.customPages.find(item=>item.id===page);
 const copy=config.pages[page];
 const [menuOpen,setMenuOpen]=useState(false);
 const [studentScene,setStudentScene]=useState("math");
 const [showcaseSlide,setShowcaseSlide]=useState(0);
 const [showcasePaused,setShowcasePaused]=useState(false);
 const galleryRef=useRef<HTMLDivElement>(null);
 const selectedStudent=boardShots.find(item=>item.scene===studentScene)??boardShots[0];
 const currentShot=showcaseShots[showcaseSlide];
 useEffect(()=>{
  if(!isPreview)return;
  const handle=(event:Event)=>{
   const element=event.target instanceof Element?event.target.closest("[data-site-block-id]"):null;
   if(!element)return;
   event.preventDefault();event.stopPropagation();
   window.parent.postMessage({type:"lektrus:site-select-block",id:element.getAttribute("data-site-block-id")},window.location.origin);
  };
  document.addEventListener("click",handle,true);
  return ()=>document.removeEventListener("click",handle,true);
 },[isPreview]);
 useEffect(()=>{
  if(isPreview){
   const sync=(event:MessageEvent)=>{
    if(event.origin!==window.location.origin||event.source!==window.parent)return;
    if(event.data?.type===SITE_PREVIEW_MESSAGE)setConfig(normalizeSiteDocument(event.data.document));
   };
   window.addEventListener("message",sync);
   return ()=>window.removeEventListener("message",sync);
  }
  let active=true;
  void loadPublishedSiteDocument().then(doc=>{if(active&&doc)setConfig(doc)})
   .catch(error=>console.warn("Marketing design unavailable; using built-in pages",error));
  return ()=>{active=false};
 },[isPreview]);
 useEffect(()=>{
  const sync=()=>{setPage(readPage());setMenuOpen(false);window.scrollTo({top:0,behavior:"instant"})};
  window.addEventListener("hashchange",sync);window.addEventListener("popstate",sync);
  return ()=>{window.removeEventListener("hashchange",sync);window.removeEventListener("popstate",sync)};
 },[]);
 useEffect(()=>{document.title=(siteNavigation.find(item=>item.id===page)?.title??"Главная")+" | Lektrus"},[page,config]);
 // The original presentation used a real screenshot carousel with a pause control.
 // Respect reduced-motion preferences and never keep the carousel running on other pages.
 useEffect(()=>{
  if(page!=="home"||showcasePaused||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const id=window.setInterval(()=>{if(!document.hidden)setShowcaseSlide(index=>(index+1)%showcaseShots.length)},7800);
  return ()=>window.clearInterval(id);
 },[page,showcasePaused]);
 const navigate=(target:Page,event?:MouseEvent<HTMLAnchorElement>)=>{
  event?.preventDefault();
  if(target!==page){
   window.history.pushState(null,"","#"+target);
   setPage(target);
   window.scrollTo({top:0,behavior:"instant"});
  }else window.scrollTo({top:0,behavior:"smooth"});
  setMenuOpen(false);
 };
 const NavLink=({id,title}:{id:Page;title:string})=><a href={"#"+id} aria-current={page===id?"page":undefined} className={page===id?"is-current":""} onClick={event=>navigate(id,event)}>{title}</a>;
 return <div className="marketing-site" style={{"--marketing-blue":config.theme.accent,"--marketing-bg":config.theme.background,"--marketing-white":config.theme.surface,"--marketing-ink":config.theme.ink,"--site-custom-radius":config.theme.radius+"px","--site-custom-width":config.theme.maxWidth+"px"} as CSSProperties}>
  <a className="marketing-skip" href="#marketing-main">Перейти к содержимому</a>
  <header className="marketing-header">
   <div className="marketing-header-inner">
    <a className="marketing-brand" href="#home" onClick={event=>navigate("home",event)} aria-label="Lektrus, на главную"><img src="/lektrus-icon-192.png" width="38" height="38" alt=""/><span><strong>Lektrus</strong><small>Пространство для обучения</small></span></a>
    <button type="button" className="marketing-menu-toggle" aria-label={menuOpen?"Закрыть меню":"Открыть меню"} aria-expanded={menuOpen} aria-controls="marketing-nav" onClick={()=>setMenuOpen(v=>!v)}>{menuOpen?"Закрыть":"Меню"}<span aria-hidden="true">{menuOpen?"×":"☰"}</span></button>
    <nav id="marketing-nav" className={"marketing-nav"+(menuOpen?" is-open":"")} aria-label="Разделы сайта">
     {siteNavigation.filter(item=>item.id!=="home").map(item=><NavLink key={item.id} {...item}/>)}
    </nav>
    <a className="marketing-app-entry" href="/app">Войти <span aria-hidden="true">↗</span></a>
   </div>
  </header>
  <main id="marketing-main" tabIndex={-1}>
   {page==="home"&&<>
    <section className="marketing-hero marketing-container" aria-labelledby="marketing-title">
     <span className="marketing-eyebrow">{copy?.eyebrow||"Интерактивное пространство Lektrus"}</span>
     <h1 id="marketing-title">{copy?.heading||<>Одна платформа <span>для преподавания и обучения</span></>}</h1>
     <p className="marketing-hero-lead">{copy?.lead||"Создавайте наглядные уроки, работайте вместе с учениками и используйте учебные инструменты на единой интерактивной доске."}</p>
     <div className="marketing-actions"><a className="marketing-primary" href="/app">Начать работу <span aria-hidden="true">↗</span></a><DemoLink className="marketing-secondary">Попробовать доску <span aria-hidden="true">→</span></DemoLink></div>
     <div className="marketing-showcase" aria-label="Реальные снимки Lektrus">
      <div className="marketing-showcase-screen">
       <img key={currentShot.src} src={currentShot.src} alt={"Снимок Lektrus: "+currentShot.subject} fetchPriority={showcaseSlide===0?"high":"auto"}/>
      </div>
      <div className="marketing-showcase-toolbar">
       <div className="marketing-showcase-caption" aria-live={showcasePaused?"polite":"off"}>
        <span className="marketing-eyebrow">{currentShot.subject}</span>
        <strong>{currentShot.title}</strong>
        <p>{currentShot.description}</p>
        {currentShot.scene==="home"?<a href="/app">Открыть рабочее пространство ↗</a>:<DemoLink scene={currentShot.scene}>Открыть этот пример на доске ↗</DemoLink>}
       </div>
       <div className="marketing-showcase-player">
        <div className="marketing-showcase-counter"><b>{String(showcaseSlide+1).padStart(2,"0")}</b><span> / {String(showcaseShots.length).padStart(2,"0")}</span></div>
        <div className="marketing-showcase-controls">
         <button type="button" onClick={()=>setShowcaseSlide(index=>(index-1+showcaseShots.length)%showcaseShots.length)} aria-label="Предыдущий снимок" title="Предыдущий снимок">←</button>
         <button type="button" onClick={()=>setShowcasePaused(paused=>!paused)} aria-label={showcasePaused?"Возобновить смену снимков":"Остановить смену снимков"} aria-pressed={showcasePaused} title={showcasePaused?"Воспроизвести":"Пауза"}>{showcasePaused?"▶":"Ⅱ"}</button>
         <button type="button" onClick={()=>setShowcaseSlide(index=>(index+1)%showcaseShots.length)} aria-label="Следующий снимок" title="Следующий снимок">→</button>
        </div>
       </div>
      </div>
      <div className="marketing-showcase-progress" aria-hidden="true"><span style={{width:`${((showcaseSlide+1)/showcaseShots.length)*100}%`}}/></div>
      <div className="marketing-showcase-subjects" aria-label="Выберите снимок">
       {showcaseShots.map((shot,index)=><button type="button" key={shot.scene} onClick={()=>{setShowcaseSlide(index);setShowcasePaused(true)}} className={index===showcaseSlide?"is-active":""} aria-pressed={index===showcaseSlide}>{shot.subject}</button>)}
      </div>
     </div>
     <p className="marketing-hero-footnote">Доска · Учебные инструменты · Совместная работа</p>
    </section>
    <section className="marketing-section marketing-container">
     <div className="marketing-section-head"><div><span className="marketing-eyebrow">Возможности</span><h2>Все инструменты для наглядного урока</h2><p>Объединяйте материалы и учебные модели на одном холсте.</p></div><NavLink id="features" title="Смотреть возможности ↗"/></div>
     <div className="marketing-preview-grid">{featureCards.slice(0,3).map(card=><article className="marketing-feature-card" key={card.index}><img className="marketing-feature-art" src={boardShots.find(shot=>shot.scene===card.scene)?.src??"/site/board-showcase.png"} alt="" loading="lazy"/><span className="marketing-number">{card.index}</span><h3>{card.title}</h3><p>{card.text}</p><DemoLink scene={card.scene}>Посмотреть пример ↗</DemoLink></article>)}</div>
    </section>
    <section className="marketing-section marketing-container">
     <div className="marketing-audience-grid">
      <article className="marketing-audience-card"><span className="marketing-eyebrow">Преподавателям</span><h2>Преподавайте так, как удобно именно вам</h2><p>Подготовка, объяснение и практическая работа в одном пространстве.</p><NavLink id="teachers" title="Для учителей ↗"/></article>
      <article className="marketing-audience-card marketing-audience-student"><span className="marketing-eyebrow">Ученикам</span><h2>Учиться легче, когда всё видно</h2><p>Разбирайте сложные темы на наглядных примерах и участвуйте в работе.</p><NavLink id="students" title="Для учеников ↗"/></article>
     </div>
    </section>
    <section className="marketing-section marketing-container marketing-home-steps"><div><span className="marketing-eyebrow">Как это работает</span><h2>От идеи до занятия за несколько шагов</h2><p>Создайте доску, добавьте материалы и пригласите участников.</p><NavLink id="how" title="Посмотреть все этапы ↗"/></div><img src="/site/app-home.png" loading="lazy" alt="Главная страница приложения Lektrus"/></section>
    <section className="marketing-last-cta marketing-container"><h2>Готовы провести урок по-новому?</h2><p>Откройте Lektrus и создайте своё учебное пространство.</p><a className="marketing-primary" href="/app">Открыть Lektrus ↗</a></section>
   </>}
   {page==="features"&&<>
    <section className="marketing-page-hero marketing-container marketing-features-intro"><span className="marketing-eyebrow">Знакомьтесь с возможностями Lektrus</span><h1>{copy?.heading||<>Один холст. <span>Множество способов преподавать</span></>}</h1><p>{copy?.lead||"От простых записей до учебных моделей и совместной работы. Собирайте на доске всё, что нужно для вашего занятия."}</p><DemoLink className="marketing-primary">Попробовать инструменты ↗</DemoLink></section>
    <section className="marketing-section marketing-container"><div className="marketing-section-head"><div><h2>Посмотрите на Lektrus в действии</h2><p>Настоящие примеры из предметных досок приложения.</p></div><div className="marketing-gallery-arrows"><button type="button" onClick={()=>galleryRef.current?.scrollBy({left:-460,behavior:"smooth"})} aria-label="Предыдущие примеры">←</button><button type="button" onClick={()=>galleryRef.current?.scrollBy({left:460,behavior:"smooth"})} aria-label="Следующие примеры">→</button></div></div>
     <div className="marketing-gallery-track" ref={galleryRef} tabIndex={0} aria-label="Галерея возможностей">{boardShots.map(shot=><article className="marketing-gallery-card" key={shot.scene}><DemoLink scene={shot.scene}><img loading="lazy" src={shot.src} alt={"Пример доски: "+shot.subject}/><span className="marketing-gallery-label">{shot.subject}</span><h3>{shot.title}</h3><p>{shot.description}</p><span className="marketing-inline-action">Открыть живую демонстрацию ↗</span></DemoLink></article>)}</div>
    </section>
    <section className="marketing-section marketing-container"><div className="marketing-section-head"><div><span className="marketing-eyebrow">Что внутри</span><h2>Инструменты для разных задач</h2></div></div><div className="marketing-feature-grid">{featureCards.map(card=><article className="marketing-feature-card" key={card.index}><img className="marketing-feature-art" src={boardShots.find(shot=>shot.scene===card.scene)?.src??"/site/board-showcase.png"} alt="" loading="lazy"/><span className="marketing-number">{card.index}</span><h3>{card.title}</h3><p>{card.text}</p><DemoLink scene={card.scene}>Посмотреть пример ↗</DemoLink></article>)}</div></section>
    <section className="marketing-section marketing-container"><div className="marketing-section-head"><div><span className="marketing-eyebrow">Отдельные инструменты</span><h2>Исследуйте без создания доски</h2><p>Открываются отдельно, без привязки к доске.</p></div></div><div className="marketing-tool-grid">{toolData.map(tool=><a href={tool.href} className="marketing-tool-card" key={tool.href}><img loading="lazy" src={tool.image} alt={"Пример инструмента: "+tool.name}/><div><span className="marketing-eyebrow">{tool.subject}</span><h3>{tool.name}</h3><p>{tool.text}</p><strong>Открыть инструмент ↗</strong></div></a>)}</div></section>
   </>}
   {page==="teachers"&&<>
    <section className="marketing-page-hero marketing-container marketing-split-hero"><div><span className="marketing-eyebrow">Для преподавателей</span><h1>{copy?.heading||<>Преподавайте так, <span>как удобно именно вам</span></>}</h1><p>{copy?.lead||"Каждый урок требует своего подхода. Создавайте объяснения, показывайте наглядные модели и работайте с учениками на интерактивной доске."}</p><DemoLink className="marketing-primary">Открыть демонстрацию ↗</DemoLink></div><figure className="marketing-teacher-scene">
      <div className="marketing-teacher-window">
       <div className="marketing-teacher-window-head"><span>Рабочее пространство Lektrus</span><span>01 / Подготовка</span></div>
       <img src="/site/app-home.png" alt="Настоящий снимок рабочего стола преподавателя в Lektrus"/>
      </div>
      <div className="marketing-teacher-board-preview">
       <img src="/site/board-math.png" alt="Подготовленный учебный материал по математике"/>
       <div><small>Пример урока</small><strong>Объяснение и практика на одной доске</strong></div>
      </div>
      <figcaption>Настоящие экраны приложения: рабочий стол и подготовленный урок.</figcaption>
     </figure></section>
    <section className="marketing-section marketing-container"><div className="marketing-section-head"><div><span className="marketing-eyebrow">Подготовка урока</span><h2>Подготовьте урок и сохраните всё в одном месте</h2><p>Работайте с учебными материалами, схемами и предметными инструментами, а затем возвращайтесь к ним на следующих занятиях.</p></div></div><div className="marketing-story-grid">{teacherStories.map(item=><article key={item.number} className="marketing-story-card"><span className="marketing-number">{item.number}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></section>
    <section className="marketing-section marketing-container marketing-feature-spotlight"><img src="/site/board-physics.png" loading="lazy" alt="Учебная доска с электрической цепью"/><div><span className="marketing-eyebrow">Наглядность в действии</span><h2>Сделайте сложное понятным</h2><p>Показывайте не только результат, но и ход решения. Объединяйте записи, схемы и задания на общем поле.</p><DemoLink scene="physics" className="marketing-secondary">Посмотреть урок ↗</DemoLink></div></section>
   </>}
   {page==="students"&&<>
    <section className="marketing-page-hero marketing-container marketing-students-intro"><span className="marketing-eyebrow">Для учеников</span><h1>{copy?.heading||<>Учиться легче, <span>когда всё видно</span></>}</h1><p>{copy?.lead||"Смотрите наглядные объяснения, разбирайте задания и пробуйте учебные инструменты самостоятельно. Выберите пример и откройте настоящую демонстрационную доску."}</p></section>
    <section className="marketing-section marketing-container"><div className="marketing-section-head"><div><h2>Попробуйте разные учебные темы</h2><p>Выбранный пример можно открыть и исследовать на доске Lektrus.</p></div></div><div className="marketing-student-tabs" role="tablist" aria-label="Выбор предмета">{boardShots.map(shot=><button type="button" key={shot.scene} role="tab" id={"student-tab-"+shot.scene} aria-controls="marketing-student-panel" aria-selected={studentScene===shot.scene} className={studentScene===shot.scene?"is-active":""} onClick={()=>setStudentScene(shot.scene)}>{shot.subject}</button>)}</div><div className="marketing-student-demo" role="tabpanel" id="marketing-student-panel" aria-labelledby={"student-tab-"+selectedStudent.scene}><img src={selectedStudent.src} alt={"Пример доски Lektrus: "+selectedStudent.subject}/><div><span className="marketing-eyebrow">{selectedStudent.subject}</span><h3>{selectedStudent.title}</h3><p>{selectedStudent.description}</p><DemoLink scene={selectedStudent.scene} className="marketing-primary">Открыть интерактивный пример ↗</DemoLink></div></div></section>
    <section className="marketing-section marketing-container"><div className="marketing-student-benefits">{["Смотри, как устроена тема","Пробуй инструменты на практике","Разбирайся в своём темпе"].map((title,i)=><div key={title}><span className="marketing-number">0{i+1}</span><h3>{title}</h3></div>)}</div></section>
   </>}
   {page==="how"&&<>
    <section className="marketing-page-hero marketing-container"><span className="marketing-eyebrow">Посмотрите, как устроена работа в Lektrus</span><h1>{copy?.heading||<>Привычные действия <span>в удобном пространстве</span></>}</h1><p>{copy?.lead||"От подготовки урока до работы вместе с учениками. Пройдите четыре наглядных этапа."}</p></section>
    <div className="marketing-steps">{steps.map((step,i)=><section className="marketing-step" key={step.number} aria-labelledby={"marketing-step-"+i}><div className="marketing-container marketing-step-grid"><div><span className="marketing-step-index">Шаг {step.number} / 04</span><h2 id={"marketing-step-"+i}>{step.title}</h2><p>{step.text}</p>{i===2?<DemoLink className="marketing-primary">Попробовать на доске ↗</DemoLink>:null}</div><img src={step.image} alt={step.alt} loading={i===0?"eager":"lazy"}/></div></section>)}</div>
   </>}
   {page==="pricing"&&<>
    <section className="marketing-page-hero marketing-container marketing-pricing-intro"><span className="marketing-eyebrow">Тарифы Lektrus</span><h1>{copy?.heading||<>Выберите формат работы <span>под свои задачи</span></>}</h1><p>{copy?.lead||"Ниже указаны тарифы и ограничения, которые сейчас определены в приложении. Платные тарифы находятся в тестовом состоянии, оформление подписки пока недоступно."}</p></section>
    <section className="marketing-container marketing-pricing-grid" aria-label="Сравнение тарифов">{plans.map((plan,i)=><article className={"marketing-plan"+(i===1?" marketing-plan-highlight":"")} key={plan.id}><div className="marketing-plan-top"><span className="marketing-eyebrow">{i===0?"Для знакомства":i===1?"Для занятий":"Для групп"}</span><h2>{plan.name}</h2><p>{plan.description}</p></div><strong className="marketing-price">{plan.priceLabel}</strong><dl><div><dt>Доски</dt><dd>{limitLabel(plan.limits.boards)}</dd></div><div><dt>Участники на доске</dt><dd>{limitLabel(plan.limits.collaboratorsPerBoard)}</dd></div><div><dt>Материалы</dt><dd>{plan.limits.storageMb===100?"100 МБ":plan.limits.storageMb===2048?"2 ГБ":plan.limits.storageMb===10240?"10 ГБ":limitLabel(plan.limits.storageMb," МБ")}</dd></div></dl><ul>{plan.features.map(feature=><li key={feature}>{feature}</li>)}</ul><div className="marketing-plan-foot">{i===0?<a href="/app" className="marketing-primary">Начать бесплатно ↗</a>:<span>Тестовый тариф · оформление недоступно</span>}</div></article>)}</section>
    <p className="marketing-container marketing-pricing-note">Это текущие технические ограничения тарифов из проекта Lektrus, а не опубликованное коммерческое предложение. Условия платной подписки будут объявлены отдельно.</p>
   </>}
   {page==="about"&&<>
    <section className="marketing-page-hero marketing-container marketing-about-intro"><span className="marketing-eyebrow">О Lektrus</span><h1>{copy?.heading||<>Больше возможностей <span>для современного обучения</span></>}</h1><p>{copy?.lead||"Lektrus объединяет интерактивную доску, учебные инструменты и совместную работу. Вместо разрозненных материалов вы получаете единое пространство, где можно объяснять, исследовать и заниматься вместе."}</p><DemoLink className="marketing-primary">Посмотреть Lektrus в деле ↗</DemoLink></section>
    <section className="marketing-section marketing-container marketing-feature-spotlight"><img src="/site/board-showcase.png" alt="Учебный холст Lektrus с интерактивными объектами"/><div><span className="marketing-eyebrow">Один продукт, разные задачи</span><h2>Не только показывайте. Действуйте</h2><p>Рисуйте схемы, работайте с документами, используйте предметные модели и возвращайтесь к подготовленным материалам. Возможности платформы помогают проводить объяснения и практические занятия на одном поле.</p><NavLink id="features" title="Изучить возможности ↗"/></div></section>
    <section className="marketing-section marketing-container marketing-about-advantages">
      <div className="marketing-about-aside">
       <span className="marketing-eyebrow">Преимущества проекта</span>
       <h2>Больше, чем цифровая доска</h2>
       <p>От подготовки урока до самостоятельного исследования: разные задачи решаются в одной учебной среде.</p>
       <img src="/site/board-chemistry.png" alt="Пример предметного инструмента Lektrus" loading="lazy"/>
      </div>
      <div className="marketing-about-list">{advantages.map(a=><article key={a.number}>
       <span className="marketing-number">{a.number}</span><div><h3>{a.title}</h3><p>{a.text}</p></div>
      </article>)}</div>
     </section>
    <section className="marketing-last-cta marketing-container"><h2>Посмотрите, как всё устроено</h2><p>Откройте живую демонстрационную доску без регистрации.</p><DemoLink className="marketing-primary">Попробовать Lektrus ↗</DemoLink></section>
   </>}
   {page==="help"&&<>
    <section className="marketing-page-hero marketing-container marketing-help-intro"><span className="marketing-eyebrow">Поддержка, инструкции и обратная связь</span><h1>{copy?.heading||<>Найдите решение <span>или свяжитесь с нами</span></>}</h1><p>{copy?.lead||"Ознакомьтесь с частыми вопросами или расскажите нам о своей идее, замечании или проблеме."}</p></section>
    <section className="marketing-section marketing-container"><div className="marketing-section-head"><div><h2>Частые вопросы</h2><p>Короткие ответы о возможностях и работе Lektrus.</p></div></div><div className="marketing-faq">{questions.map(item=><details key={item.q} open={undefined}><summary><span>{item.q}</span><span aria-hidden="true">+</span></summary><p>{item.a}</p></details>)}</div></section>
    <section className="marketing-section marketing-container marketing-contact"><div><span className="marketing-eyebrow">Обратная связь</span><h2>Расскажите, что можно улучшить</h2><p>Ваши вопросы помогают делать Lektrus удобнее. Выберите тему обращения, опишите ситуацию и при необходимости оставьте адрес для ответа.</p>{import.meta.env.VITE_TELEGRAM_URL&&<a className="marketing-secondary" href={import.meta.env.VITE_TELEGRAM_URL} target="_blank" rel="noreferrer">Написать в Telegram ↗</a>}<div className="marketing-contact-help"><strong>Поддержка, инструкции и обратная связь</strong><span>Для знакомства с доской можно открыть гостевую демонстрацию.</span><DemoLink>Открыть демонстрацию ↗</DemoLink></div></div><div className="marketing-form-card"><LektrusFeedbackForm compact source="site"/></div></section>
   </>}
   {customPage&&<SiteCustomPage page={customPage}/>}
   {!customPage&&copy?.blocks&&<SiteEditableBlocks blocks={copy.blocks}/>}
  </main>
  <footer className="marketing-footer"><div className="marketing-container"><div className="marketing-footer-brand"><img src="/lektrus-icon-192.png" width="32" height="32" alt=""/><span><strong>Lektrus</strong><small>Пространство для обучения</small></span></div><nav aria-label="Разделы внизу страницы">{siteNavigation.filter(item=>item.id!=="home").map(item=><NavLink key={item.id} {...item}/>)}</nav><div className="marketing-footer-end"><span>© {new Date().getFullYear()} Lektrus</span><a href="/app">Перейти в приложение ↗</a></div></div></footer>
 </div>;
}
