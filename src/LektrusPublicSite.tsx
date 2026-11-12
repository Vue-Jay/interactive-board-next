import {useEffect,useState,type CSSProperties,type MouseEvent,type ReactNode} from "react";
import {defaultSiteDocument,loadPublishedSiteDocument,normalizeSiteDocument,SITE_PREVIEW_MESSAGE,type SiteDocument} from "./marketingSiteConfig";
import {SiteCustomPage,SiteAnchorSlot} from "./SiteEditableSections";
import {SiteObjectLayer} from "./SiteObjectLayer";
import {commandFromKeyboard,type StudioCommand} from "./siteStudioCommands";
import LektrusFeedbackForm from "./LektrusFeedbackForm";
import {plans,limitLabel} from "./billingStore";
import "./lektrusMarketing.css";

type Page=string;
const navigation:{id:Page;title:string}[]=[
 {id:"home",title:"Главная"},
 {id:"features",title:"Возможности"},
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

const featureSymbols=["✎","◎","∑","⚗","✓","▣"];
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
 if(hash==="teachers"||hash==="students")return "about";
 return /^[a-z][a-z0-9-]{0,39}$/.test(hash)?hash:"home";
}
function DemoLink({scene="math",children,className=""}:{scene?:string;children:ReactNode;className?:string}){
 return <a className={className} href={"/demo/board?scene="+encodeURIComponent(scene)}>{children}</a>;
}

export default function LektrusPublicSite(){
 const isPreview=new URLSearchParams(window.location.search).has("site-preview");
 const [config,setConfig]=useState<SiteDocument>(defaultSiteDocument);
 const [previewSelection,setPreviewSelection]=useState<string|null>(null);
 const [previewObject,setPreviewObject]=useState<string|null>(null);
 const [previewInteractive,setPreviewInteractive]=useState(false);
 const [page,setPage]=useState<Page>(readPage);
 const siteNavigation=(config.navigation.length?config.navigation:navigation.map(item=>({...item,hidden:false}))).filter(item=>(!item.hidden||item.id==="home")&&item.id!=="teachers"&&item.id!=="students");
 const customPage=config.customPages.find(item=>item.id===page)??(config.pages[page]?.replaceDefault?config.pages[page]:undefined);
 const copy=config.pages[page];
 const [menuOpen,setMenuOpen]=useState(false);
 const [showcaseSlide,setShowcaseSlide]=useState(0);
 const [previousSlide,setPreviousSlide]=useState<number|null>(null);
 const showcaseShots=config.showcase;
 const currentShot=showcaseShots[showcaseSlide%showcaseShots.length];
 const previousShot=previousSlide!==null?showcaseShots[previousSlide%showcaseShots.length]:null;
 useEffect(()=>{
  if(!isPreview)return;
  const handle=(event:Event)=>{
   if(event.target instanceof Element&&event.target.closest("[data-site-editor-control]"))return;
   if(event.target instanceof Element&&event.target.closest("[data-site-object-id]"))return;
   const anchor=event.target instanceof Element?event.target.closest("a[href]"):null;
   if(anchor){
    const target=anchor.getAttribute("href")||"";
    if(!target.startsWith("#")){
     event.preventDefault();event.stopPropagation();
     window.parent.postMessage({type:"lektrus:site-preview-link",href:target},window.location.origin);
    }
    return;
   }
   if(event.target instanceof Element&&event.target.closest("button,summary,input,select,textarea,[role=button]"))return;
   const element=event.target instanceof Element?event.target.closest("[data-site-block-id],[data-site-page-hero]"):null;
   if(!element)return;
   event.preventDefault();event.stopPropagation();
   const blockId=element.getAttribute("data-site-block-id");
   window.parent.postMessage(blockId?{type:"lektrus:site-select-block",id:blockId}:{type:"lektrus:site-select-page"},window.location.origin);
  };
  document.addEventListener("click",handle,true);
  return ()=>document.removeEventListener("click",handle,true);
 },[isPreview]);
 useEffect(()=>{
  if(!isPreview)return;
  const onKey=(event:KeyboardEvent)=>{
   if(event.defaultPrevented)return;
   const command=commandFromKeyboard(event);
   if(!command)return;
   if((command==="delete"||command==="escape")&&!previewSelection&&!previewObject)return;
   event.preventDefault();event.stopPropagation();
   window.parent.postMessage({type:"lektrus:site-editor-command",command},window.location.origin);
  };
  window.addEventListener("keydown",onKey);
  return ()=>window.removeEventListener("keydown",onKey);
 },[isPreview,previewSelection,previewObject]);
 useEffect(()=>{
  if(isPreview){
   const sync=(event:MessageEvent)=>{
    if(event.origin!==window.location.origin||event.source!==window.parent)return;
    if(event.data?.type===SITE_PREVIEW_MESSAGE){
     setConfig(normalizeSiteDocument(event.data.document));
     setPreviewSelection(typeof event.data.selectedId==="string"?event.data.selectedId:null);
     setPreviewObject(typeof event.data.objectId==="string"?event.data.objectId:null);
     setPreviewInteractive(event.data.interactive===true);
    }
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
 // The single homepage frame automatically crossfades through existing screenshots.
 // No controls or subject pickers: the rest of the site keeps its own editorial content.
 useEffect(()=>{
  if(page!=="home"||showcaseShots.length<2||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const id=window.setInterval(()=>{
   if(document.hidden)return;
   setPreviousSlide(showcaseSlide);
   setShowcaseSlide((showcaseSlide+1)%showcaseShots.length);
  },6800);
  return ()=>window.clearInterval(id);
 },[page,showcaseSlide,showcaseShots.length]);
 useEffect(()=>{
  if(previousSlide===null)return;
  const id=window.setTimeout(()=>setPreviousSlide(null),850);
  return ()=>window.clearTimeout(id);
 },[previousSlide]);
 useEffect(()=>{
  if(page!=="home"||showcaseShots.length<2)return;
  const next=showcaseShots[(showcaseSlide+1)%showcaseShots.length];
  const image=new Image();image.src=next.src;
 },[page,showcaseSlide,showcaseShots]);
 const navigate=(target:Page,event?:MouseEvent<HTMLAnchorElement>)=>{
  event?.preventDefault();
  if(target==="teachers"||target==="students")target="about";
  if(target!==page){
   window.history.pushState(null,"","#"+target);
   setPage(target);
   window.scrollTo({top:0,behavior:"instant"});
  }else window.scrollTo({top:0,behavior:"smooth"});
  setMenuOpen(false);
  if(isPreview)window.parent.postMessage({type:"lektrus:site-navigate",page:target},window.location.origin);
 };
 const placed=(anchor:string)=><SiteAnchorSlot page={page} anchor={anchor} blocks={copy?.blocks??[]} selectedId={previewSelection} preview={isPreview}/>;
 const editorCommand=(command:StudioCommand)=>window.parent.postMessage({type:"lektrus:site-editor-command",command},window.location.origin);
 const NavLink=({id,title}:{id:Page;title:string})=><a href={"#"+id} aria-current={page===id?"page":undefined} className={page===id?"is-current":""} onClick={event=>navigate(id,event)}>{title}</a>;
 return <div className={isPreview?"marketing-site site-preview"+(previewInteractive?" site-preview-interactive":""):"marketing-site"} style={{"--marketing-blue":config.theme.accent,"--marketing-bg":config.theme.background,"--marketing-white":config.theme.surface,"--marketing-ink":config.theme.ink,"--site-custom-radius":config.theme.radius+"px","--site-custom-width":config.theme.maxWidth+"px"} as CSSProperties}>
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
   {page==="home"&&!copy?.replaceDefault&&<>
    {placed("before-0")}
    <section data-site-section-id="native-0" data-site-page-hero className="marketing-hero marketing-container" aria-labelledby="marketing-title">
     <span className="marketing-eyebrow">{copy?.eyebrow||"Интерактивное пространство Lektrus"}</span>
     <h1 id="marketing-title">{copy?.heading||<>Одна платформа <span>для преподавания и обучения</span></>}</h1>
     <p className="marketing-hero-lead">{copy?.lead||"Создавайте наглядные уроки, работайте вместе с учениками и используйте учебные инструменты на единой интерактивной доске."}</p>
     <div className="marketing-actions"><a className="marketing-primary" href="/app">Начать работу <span aria-hidden="true">↗</span></a><DemoLink className="marketing-secondary">Попробовать доску <span aria-hidden="true">→</span></DemoLink></div>
     <div className="marketing-showcase" aria-label="Автоматическая презентация настоящих экранов Lektrus" data-site-showcase>
      <div className="marketing-showcase-window" aria-hidden="true">
       <span className="marketing-showcase-window-dots"><i/><i/><i/></span>
       <span className="marketing-showcase-window-title">Lektrus · Пространство для обучения</span>
       <span className="marketing-showcase-window-live"><span/> Продукт в действии</span>
      </div>
      <div className="marketing-showcase-screen" role="img" aria-label="Примеры реальных экранов приложения Lektrus">
       {previousShot&&<img className="marketing-showcase-previous" src={previousShot.src} alt="" aria-hidden="true"/>}
       <img key={currentShot.src} className="marketing-showcase-current" src={currentShot.src} alt="" fetchPriority={showcaseSlide===0?"high":"auto"}/>
      </div>
     </div>
     <p className="marketing-hero-footnote">Доска · Учебные инструменты · Совместная работа</p>
    </section>
    {placed("before-1")}
    <section data-site-section-id="native-1" className="marketing-section marketing-container">
     <div className="marketing-section-head"><div><span className="marketing-eyebrow">Возможности</span><h2>Все инструменты для наглядного урока</h2><p>Объединяйте материалы и учебные модели на одном холсте.</p></div><NavLink id="features" title="Смотреть возможности ↗"/></div>
     <div className="marketing-preview-grid">{featureCards.slice(0,3).map(card=><article className="marketing-feature-card" key={card.index}><span className="marketing-feature-mark" aria-hidden="true">{featureSymbols[Number(card.index)-1]}</span><span className="marketing-number">{card.index}</span><h3>{card.title}</h3><p>{card.text}</p><DemoLink scene={card.scene}>Посмотреть пример ↗</DemoLink></article>)}</div>
    </section>
    {placed("before-2")}
    <section data-site-section-id="native-2" className="marketing-section marketing-container">
     <div className="marketing-audience-grid">
      <article className="marketing-audience-card"><span className="marketing-eyebrow">Преподавателям</span><h2>Преподавайте так, как удобно именно вам</h2><p>Подготовка, объяснение и практическая работа в одном пространстве.</p><NavLink id="about" title="Подробнее в разделе «О Lektrus» ↗"/></article>
      <article className="marketing-audience-card marketing-audience-student"><span className="marketing-eyebrow">Ученикам</span><h2>Учиться легче, когда всё видно</h2><p>Разбирайте сложные темы на наглядных примерах и участвуйте в работе.</p><NavLink id="about" title="Узнать больше о Lektrus ↗"/></article>
     </div>
    </section>
    {placed("before-3")}
    <section data-site-section-id="native-3" className="marketing-section marketing-container marketing-home-steps"><div><span className="marketing-eyebrow">Как это работает</span><h2>От идеи до занятия за несколько шагов</h2><p>Создайте доску, добавьте материалы и пригласите участников.</p><NavLink id="how" title="Посмотреть все этапы ↗"/></div>
     <div className="marketing-home-flow" aria-label="Три шага работы">
      <div><span>01</span><strong>Создайте доску</strong><small>Чистый холст для любой идеи</small></div>
      <div><span>02</span><strong>Добавьте содержание</strong><small>Задания, объяснения и модели</small></div>
      <div><span>03</span><strong>Работайте вместе</strong><small>Учитель и ученики на одном поле</small></div>
     </div></section>
    {placed("before-4")}
    <section data-site-section-id="native-4" className="marketing-last-cta marketing-container"><h2>Готовы провести урок по-новому?</h2><p>Откройте Lektrus и создайте своё учебное пространство.</p><a className="marketing-primary" href="/app">Открыть Lektrus ↗</a></section>
   </>}
   {page==="features"&&!copy?.replaceDefault&&<>
    {placed("before-0")}
    <section data-site-section-id="native-0" data-site-page-hero className="marketing-page-hero marketing-container marketing-features-intro"><span className="marketing-eyebrow">{copy?.eyebrow||"Знакомьтесь с возможностями Lektrus"}</span><h1>{copy?.heading||<>Один холст. <span>Множество способов преподавать</span></>}</h1><p>{copy?.lead||"От простых записей до учебных моделей и совместной работы. Собирайте на доске всё, что нужно для вашего занятия."}</p><DemoLink className="marketing-primary">Попробовать инструменты ↗</DemoLink></section>
    {placed("before-1")}
    <section data-site-section-id="native-1" className="marketing-section marketing-container marketing-feature-story">
     <div className="marketing-section-head"><div><span className="marketing-eyebrow">Один общий холст</span><h2>Любая идея начинается здесь</h2><p>Собирайте материалы, объясняйте и исследуйте без переключения между десятком разных инструментов.</p></div><DemoLink className="marketing-secondary">Открыть живую демонстрацию ↗</DemoLink></div>
     <div className="marketing-workflow-diagram" aria-label="Возможности одного учебного холста">
      <div className="marketing-workflow-core"><span>LEKTRUS</span><strong>Ваш учебный холст</strong><small>Одно пространство для занятия</small></div>
      {["Текст и формулы","Рисунки и фигуры","Задания и материалы","Совместная работа"].map((name,i)=><div key={name} className={"marketing-workflow-node marketing-workflow-node-"+i}><span>0{i+1}</span><strong>{name}</strong></div>)}
     </div>
    </section>
    {placed("before-2")}
    <section data-site-section-id="native-2" className="marketing-section marketing-container"><div className="marketing-section-head"><div><span className="marketing-eyebrow">Что внутри</span><h2>Инструменты для разных задач</h2></div></div><div className="marketing-feature-grid">{featureCards.map(card=><article className="marketing-feature-card" key={card.index}><span className="marketing-feature-mark" aria-hidden="true">{featureSymbols[Number(card.index)-1]}</span><span className="marketing-number">{card.index}</span><h3>{card.title}</h3><p>{card.text}</p><DemoLink scene={card.scene}>Посмотреть пример ↗</DemoLink></article>)}</div></section>
    {placed("before-3")}
    <section data-site-section-id="native-3" className="marketing-section marketing-container"><div className="marketing-section-head"><div><span className="marketing-eyebrow">Отдельные инструменты</span><h2>Исследуйте без создания доски</h2><p>Открываются отдельно, без привязки к доске.</p></div></div><div className="marketing-tool-grid">{toolData.map((tool,i)=><a href={tool.href} className="marketing-tool-card" key={tool.href}><span className="marketing-tool-symbol" aria-hidden="true">{i===0?"◈":"⚗"}</span><div><span className="marketing-eyebrow">{tool.subject}</span><h3>{tool.name}</h3><p>{tool.text}</p><strong>Открыть инструмент ↗</strong></div></a>)}</div></section>
   </>}
   {page==="how"&&!copy?.replaceDefault&&<>
    {placed("before-0")}
    <section data-site-section-id="native-0" data-site-page-hero className="marketing-page-hero marketing-container"><span className="marketing-eyebrow">{copy?.eyebrow||"Посмотрите, как устроена работа в Lektrus"}</span><h1>{copy?.heading||<>Привычные действия <span>в удобном пространстве</span></>}</h1><p>{copy?.lead||"От подготовки урока до работы вместе с учениками. Пройдите четыре наглядных этапа."}</p></section>
    {placed("before-1")}
    <div data-site-section-id="native-1" className="marketing-steps">{steps.map((step,i)=><section className="marketing-step" key={step.number} aria-labelledby={"marketing-step-"+i}><div className="marketing-container marketing-step-grid"><div><span className="marketing-step-index">Шаг {step.number} / 04</span><h2 id={"marketing-step-"+i}>{step.title}</h2><p>{step.text}</p>{i===2?<DemoLink className="marketing-primary">Попробовать на доске ↗</DemoLink>:null}</div>
       <div className={"marketing-step-visual marketing-step-visual-"+i} aria-hidden="true"><span className="marketing-step-visual-index">{step.number}</span><div className="marketing-step-visual-card"><strong>{["Чистая доска","Материалы урока","Общий холст","Сохранённый результат"][i]}</strong><span>{["Идея → структура","Текст + схемы + инструменты","Объяснение + практика","Доска готова к продолжению"][i]}</span><div className="marketing-step-visual-track"><i/><i/><i/></div></div></div>
      </div></section>)}</div>
   </>}
   {page==="pricing"&&!copy?.replaceDefault&&<>
    {placed("before-0")}
    <section data-site-section-id="native-0" data-site-page-hero className="marketing-page-hero marketing-container marketing-pricing-intro"><span className="marketing-eyebrow">{copy?.eyebrow||"Тарифы Lektrus"}</span><h1>{copy?.heading||<>Выберите формат работы <span>под свои задачи</span></>}</h1><p>{copy?.lead||"Ниже указаны тарифы и ограничения, которые сейчас определены в приложении. Платные тарифы находятся в тестовом состоянии, оформление подписки пока недоступно."}</p></section>
    {placed("before-1")}
    <section data-site-section-id="native-1" className="marketing-container marketing-pricing-grid" aria-label="Сравнение тарифов">{plans.map((plan,i)=><article className={"marketing-plan"+(i===1?" marketing-plan-highlight":"")} key={plan.id}><div className="marketing-plan-top"><span className="marketing-eyebrow">{i===0?"Для знакомства":i===1?"Для занятий":"Для групп"}</span><h2>{plan.name}</h2><p>{plan.description}</p></div><strong className="marketing-price">{plan.priceLabel}</strong><dl><div><dt>Доски</dt><dd>{limitLabel(plan.limits.boards)}</dd></div><div><dt>Участники на доске</dt><dd>{limitLabel(plan.limits.collaboratorsPerBoard)}</dd></div><div><dt>Материалы</dt><dd>{plan.limits.storageMb===100?"100 МБ":plan.limits.storageMb===2048?"2 ГБ":plan.limits.storageMb===10240?"10 ГБ":limitLabel(plan.limits.storageMb," МБ")}</dd></div></dl><ul>{plan.features.map(feature=><li key={feature}>{feature}</li>)}</ul><div className="marketing-plan-foot">{i===0?<a href="/app" className="marketing-primary">Начать бесплатно ↗</a>:<span>Тестовый тариф · оформление недоступно</span>}</div></article>)}</section>
    <p className="marketing-container marketing-pricing-note">Это текущие технические ограничения тарифов из проекта Lektrus, а не опубликованное коммерческое предложение. Условия платной подписки будут объявлены отдельно.</p>
   </>}
   {page==="about"&&!copy?.replaceDefault&&<>
    {placed("before-0")}
    <section data-site-section-id="native-0" data-site-page-hero className="marketing-page-hero marketing-container marketing-about-intro"><span className="marketing-eyebrow">{copy?.eyebrow||"О Lektrus"}</span><h1>{copy?.heading||<>Больше возможностей <span>для современного обучения</span></>}</h1><p>{copy?.lead||"Lektrus объединяет интерактивную доску, учебные инструменты и совместную работу. Вместо разрозненных материалов вы получаете единое пространство, где можно объяснять, исследовать и заниматься вместе."}</p><DemoLink className="marketing-primary">Посмотреть Lektrus в деле ↗</DemoLink></section>
    {placed("before-1")}
    <section data-site-section-id="native-1" className="marketing-section marketing-container marketing-feature-spotlight marketing-about-spotlight"><div className="marketing-about-statement"><span>Идея Lektrus</span><strong>Объяснять.<br/>Исследовать.<br/><em>Создавать.</em></strong><small>В одном учебном пространстве.</small></div><div><span className="marketing-eyebrow">Один продукт, разные задачи</span><h2>Не только показывайте. Действуйте</h2><p>Рисуйте схемы, работайте с документами, используйте предметные модели и возвращайтесь к подготовленным материалам. Возможности платформы помогают проводить объяснения и практические занятия на одном поле.</p><NavLink id="features" title="Изучить возможности ↗"/></div></section>
    {placed("before-2")}
    <section data-site-section-id="native-2" className="marketing-section marketing-container marketing-about-advantages">
      <div className="marketing-about-aside">
       <span className="marketing-eyebrow">Преимущества проекта</span>
       <h2>Больше, чем цифровая доска</h2>
       <p>От подготовки урока до самостоятельного исследования: разные задачи решаются в одной учебной среде.</p>
       <div className="marketing-about-aside-note"><span>LEKTRUS / МИССИЯ</span><strong>Делать знания наглядными и доступными.</strong></div>
      </div>
      <div className="marketing-about-list">{advantages.map(a=><article key={a.number}>
       <span className="marketing-number">{a.number}</span><div><h3>{a.title}</h3><p>{a.text}</p></div>
      </article>)}</div>
      <div className="marketing-about-audience marketing-about-audience-teachers">
       <div className="marketing-about-audience-head"><span className="marketing-eyebrow">Для преподавателей</span><h2>Удобно готовить. Понятно объяснять.</h2><p>Создавайте уроки в собственном темпе, сохраняйте материалы и возвращайтесь к ним на следующих занятиях.</p></div>
       <div className="marketing-about-teacher-journey">{teacherStories.map(story=><article key={story.number}><span className="marketing-number">{story.number}</span><h3>{story.title}</h3><p>{story.text}</p></article>)}</div>
       <DemoLink scene="physics" className="marketing-secondary">Посмотреть пример занятия ↗</DemoLink>
      </div>
      <div className="marketing-about-audience marketing-about-audience-students">
       <div className="marketing-about-audience-head"><span className="marketing-eyebrow">Для учеников</span><h2>Увидеть. Разобраться. Попробовать.</h2><p>Наглядные объяснения, самостоятельная практика и совместная работа. Можно выбрать тему и сразу открыть интерактивный пример.</p></div>
       <div className="marketing-about-student-steps">
        {["Смотри, как устроена тема","Пробуй инструменты на практике","Разбирайся в своём темпе"].map((title,i)=><div key={title}><span>0{i+1}</span><strong>{title}</strong></div>)}
       </div>
       <div className="marketing-about-subject-links" aria-label="Открыть учебный пример">{boardShots.map(shot=><DemoLink key={shot.scene} scene={shot.scene}>{shot.subject} ↗</DemoLink>)}</div>
      </div>
     </section>
    {placed("before-3")}
    <section data-site-section-id="native-3" className="marketing-last-cta marketing-container"><h2>Посмотрите, как всё устроено</h2><p>Откройте живую демонстрационную доску без регистрации.</p><DemoLink className="marketing-primary">Попробовать Lektrus ↗</DemoLink></section>
   </>}
   {page==="help"&&!copy?.replaceDefault&&<>
    {placed("before-0")}
    <section data-site-section-id="native-0" data-site-page-hero className="marketing-page-hero marketing-container marketing-help-intro"><span className="marketing-eyebrow">{copy?.eyebrow||"Поддержка, инструкции и обратная связь"}</span><h1>{copy?.heading||<>Найдите решение <span>или свяжитесь с нами</span></>}</h1><p>{copy?.lead||"Ознакомьтесь с частыми вопросами или расскажите нам о своей идее, замечании или проблеме."}</p></section>
    {placed("before-1")}
    <section data-site-section-id="native-1" className="marketing-section marketing-container"><div className="marketing-section-head"><div><h2>Частые вопросы</h2><p>Короткие ответы о возможностях и работе Lektrus.</p></div></div><div className="marketing-faq">{questions.map(item=><details key={item.q} open={undefined}><summary><span>{item.q}</span><span aria-hidden="true">+</span></summary><p>{item.a}</p></details>)}</div></section>
    {placed("before-2")}
    <section data-site-section-id="native-2" className="marketing-section marketing-container marketing-contact"><div><span className="marketing-eyebrow">Обратная связь</span><h2>Расскажите, что можно улучшить</h2><p>Ваши вопросы помогают делать Lektrus удобнее. Выберите тему обращения, опишите ситуацию и при необходимости оставьте адрес для ответа.</p>{import.meta.env.VITE_TELEGRAM_URL&&<a className="marketing-secondary" href={import.meta.env.VITE_TELEGRAM_URL} target="_blank" rel="noreferrer">Написать в Telegram ↗</a>}<div className="marketing-contact-help"><strong>Поддержка, инструкции и обратная связь</strong><span>Для знакомства с доской можно открыть гостевую демонстрацию.</span><DemoLink>Открыть демонстрацию ↗</DemoLink></div></div><div className="marketing-form-card"><LektrusFeedbackForm compact source="site"/></div></section>
   </>}
   {customPage&&<SiteCustomPage page={customPage} selectedId={previewSelection} preview={isPreview}/>}
   {!customPage&&placed("end")}
  </main>
  <footer className="marketing-footer"><div className="marketing-container"><div className="marketing-footer-brand"><img src="/lektrus-icon-192.png" width="32" height="32" alt=""/><span><strong>Lektrus</strong><small>Пространство для обучения</small></span></div><nav aria-label="Разделы внизу страницы">{siteNavigation.filter(item=>item.id!=="home").map(item=><NavLink key={item.id} {...item}/>)}</nav><div className="marketing-footer-end"><span>© {new Date().getFullYear()} Lektrus</span><a href="/app">Перейти в приложение ↗</a></div></div></footer>
  {isPreview&&(previewSelection||previewObject)&&<div className="site-canvas-selection-actions" role="toolbar" aria-label="Действия над выделенным элементом">
   <span>{previewSelection?"Выделен блок":config.objects[previewObject||""]?.hidden?"Элемент скрыт":"Выделен объект"}</span>
   <button type="button" onClick={()=>editorCommand("undo")} title="Отменить, Ctrl+Z" aria-label="Отменить действие">↶</button>
   <button type="button" onClick={()=>editorCommand("redo")} title="Повторить, Ctrl+Y" aria-label="Повторить действие">↷</button>
   {previewObject&&config.objects[previewObject]?.hidden?
    <button type="button" className="site-canvas-restore-button" onClick={()=>editorCommand("restore")}>↺ Восстановить</button>:
    <button type="button" className="site-canvas-delete-button" onClick={()=>editorCommand("delete")}>⌫ Удалить <kbd>Del</kbd></button>}
   <button type="button" onClick={()=>editorCommand("escape")} title="Снять выделение, Esc" aria-label="Снять выделение">×</button>
  </div>}
  <SiteObjectLayer siteDocument={config} page={page} preview={isPreview} selected={previewObject} interactive={previewInteractive}/>
 </div>;
}
