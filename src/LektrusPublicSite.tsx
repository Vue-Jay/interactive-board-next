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
 {id:"tools",title:"Инструменты"},
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
 {href:"/tools/atlas",name:"Интерактивный атлас",text:"Исследуйте карты и исторические территории независимо от доски.",symbol:"◎"},
 {href:"/tools/laboratory",name:"Химическая лаборатория",text:"Работайте с веществами, реакциями и лабораторным оборудованием.",symbol:"⚗"}
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
     {copy?.eyebrow&&<span className="marketing-eyebrow">{copy.eyebrow}</span>}
     <h1 id="marketing-title">{copy?.heading||<>Одна платформа <span>для преподавания и обучения</span></>}</h1>
     <p className="marketing-hero-lead">{copy?.lead||"Создавайте наглядные уроки, работайте вместе с учениками и используйте учебные инструменты на единой интерактивной доске."}</p>
     <div className="marketing-actions"><a className="marketing-primary" href="/app">Начать работу <span aria-hidden="true">↗</span></a><DemoLink className="marketing-secondary">Попробовать доску <span aria-hidden="true">→</span></DemoLink></div>
     <div className="marketing-showcase" aria-label="Автоматическая презентация настоящих экранов Lektrus" data-site-showcase>
      <div className="marketing-showcase-screen" role="img" aria-label="Примеры реальных экранов приложения Lektrus">
       {previousShot&&<img className="marketing-showcase-previous" src={previousShot.src} alt="" aria-hidden="true"/>}
       <img key={currentShot.src} className="marketing-showcase-current" src={currentShot.src} alt="" fetchPriority={showcaseSlide===0?"high":"auto"}/>
      </div>
     </div>
    </section>
    {placed("before-1")}
    <section data-site-section-id="native-1" className="marketing-section marketing-container marketing-home-summary">
     <div><h2>Всё нужное на одной доске</h2><p>Записи, учебные модели и совместная работа без лишних переключений.</p></div>
     <NavLink id="features" title="Смотреть возможности ↗"/>
    </section>
    {placed("before-2")}
    {placed("before-3")}
    {placed("before-4")}
   </>}
   {page==="features"&&!copy?.replaceDefault&&<>
    {placed("before-0")}
    <section data-site-section-id="native-0" data-site-page-hero className="marketing-page-hero marketing-container marketing-features-intro">
     {copy?.eyebrow&&<span className="marketing-eyebrow">{copy.eyebrow}</span>}
     <h1>{copy?.heading||<>Возможности <span>доски Lektrus</span></>}</h1>
     <p>{copy?.lead||"Всё для объяснения и совместной работы на одном холсте."}</p>
    </section>
    {placed("before-1")}
    <section data-site-section-id="native-1" className="marketing-section marketing-container marketing-features-section" aria-label="Возможности доски">
     <div className="marketing-features-list">{featureCards.map((card,i)=><DemoLink className="marketing-feature-row" scene={card.scene} key={card.index}>
      <span className="marketing-feature-row-mark" aria-hidden="true">{featureSymbols[i]}</span>
      <span className="marketing-feature-row-copy"><strong>{card.title}</strong><small>{card.text}</small></span>
      <span className="marketing-feature-row-arrow" aria-hidden="true">↗</span>
     </DemoLink>)}</div>
     <div className="marketing-features-footer"><span>Нужен инструмент без доски?</span><NavLink id="tools" title="Открыть инструменты ↗"/></div>
    </section>
    {placed("before-2")}
    {placed("before-3")}
   </>}
   {page==="tools"&&!copy?.replaceDefault&&<>
    {placed("before-0")}
    <section data-site-section-id="native-0" data-site-page-hero className="marketing-page-hero marketing-container marketing-tools-intro">
     {copy?.eyebrow&&<span className="marketing-eyebrow">{copy.eyebrow}</span>}
     <h1>{copy?.heading||<>Инструменты <span>без доски</span></>}</h1>
     <p>{copy?.lead||"Откройте атлас или лабораторию напрямую. Создавать доску не требуется."}</p>
    </section>
    {placed("before-1")}
    <section data-site-section-id="native-1" className="marketing-section marketing-container marketing-standalone-tools" aria-label="Самостоятельные учебные инструменты">
     {toolData.map(tool=><a key={tool.href} href={tool.href} className="marketing-standalone-tool">
      <span className="marketing-standalone-tool-symbol" aria-hidden="true">{tool.symbol}</span>
      <span className="marketing-standalone-tool-copy"><strong>{tool.name}</strong><small>{tool.text}</small></span>
      <span aria-hidden="true" className="marketing-standalone-tool-arrow">↗</span>
     </a>)}
    </section>
    {placed("before-2")}
   </>}
   {page==="how"&&!copy?.replaceDefault&&<>
    {placed("before-0")}
    <section data-site-section-id="native-0" data-site-page-hero className="marketing-page-hero marketing-container">
     {copy?.eyebrow&&<span className="marketing-eyebrow">{copy.eyebrow}</span>}
     <h1>{copy?.heading||<>Как начать <span>работу</span></>}</h1>
     <p>{copy?.lead||"Четыре шага от создания доски до сохранения занятия."}</p>
    </section>
    {placed("before-1")}
    <section data-site-section-id="native-1" className="marketing-section marketing-container marketing-steps">
     <div className="marketing-how-list">{steps.map(step=><article key={step.number} className="marketing-how-step">
      <span className="marketing-step-index">{step.number}</span>
      <div><h2>{step.title}</h2><p>{step.text}</p></div>
     </article>)}</div>
     <DemoLink className="marketing-primary">Попробовать на доске ↗</DemoLink>
    </section>
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
    <section data-site-section-id="native-0" data-site-page-hero className="marketing-page-hero marketing-container marketing-about-intro">
     {copy?.eyebrow&&<span className="marketing-eyebrow">{copy.eyebrow}</span>}
     <h1>{copy?.heading||<>О <span>Lektrus</span></>}</h1>
     <p>{copy?.lead||"Интерактивная доска и учебные инструменты для преподавания, совместных занятий и самостоятельной практики."}</p>
    </section>
    {placed("before-1")}
    {placed("before-2")}
    <section data-site-section-id="native-2" className="marketing-section marketing-container marketing-about-practical">
     <div className="marketing-about-audience marketing-about-audience-teachers">
      <h2>Преподавателям</h2>
      <p>Готовьте материалы, объясняйте темы и сохраняйте результаты занятий.</p>
      <div className="marketing-about-teacher-journey">{teacherStories.map(story=><article key={story.number}><strong>{story.title}</strong><p>{story.text}</p></article>)}</div>
     </div>
     <div className="marketing-about-audience marketing-about-audience-students">
      <h2>Ученикам</h2>
      <p>Исследуйте темы, выполняйте задания и возвращайтесь к объяснениям.</p>
      <div className="marketing-about-student-steps">{["Смотри наглядные объяснения","Пробуй инструменты на практике","Изучай материал в своём темпе"].map((title,i)=><div key={title}><span>0{i+1}</span><strong>{title}</strong></div>)}</div>
      <div className="marketing-about-subject-links" aria-label="Открыть учебный пример">{boardShots.map(shot=><DemoLink key={shot.scene} scene={shot.scene}>{shot.subject} ↗</DemoLink>)}</div>
     </div>
    </section>
    {placed("before-3")}
   </>}
   {page==="help"&&!copy?.replaceDefault&&<>
    {placed("before-0")}
    <section data-site-section-id="native-0" data-site-page-hero className="marketing-page-hero marketing-container marketing-help-intro"><span className="marketing-eyebrow">{copy?.eyebrow||"Поддержка, инструкции и обратная связь"}</span><h1>{copy?.heading||<>Найдите решение <span>или свяжитесь с нами</span></>}</h1><p>{copy?.lead||"Ознакомьтесь с частыми вопросами или расскажите нам о своей идее, замечании или проблеме."}</p></section>
    {placed("before-1")}
    <section data-site-section-id="native-1" className="marketing-section marketing-container"><div className="marketing-section-head"><div><h2>Частые вопросы</h2><p>Короткие ответы о возможностях и работе Lektrus.</p></div></div><div className="marketing-faq">{questions.map(item=><details key={item.q} open={undefined}><summary><span>{item.q}</span><span aria-hidden="true">+</span></summary><p>{item.a}</p></details>)}</div></section>
    {placed("before-2")}
    <section data-site-section-id="native-2" className="marketing-section marketing-container marketing-contact"><div><span className="marketing-eyebrow">Обратная связь</span><h2>Расскажите, что можно улучшить</h2><p>Ваши вопросы помогают делать Lektrus удобнее. Выберите тему обращения, опишите ситуацию и при необходимости оставьте адрес для ответа.</p>{import.meta.env.VITE_TELEGRAM_URL&&<a className="marketing-secondary" href={import.meta.env.VITE_TELEGRAM_URL} target="_blank" rel="noreferrer">Написать в Telegram ↗</a>}</div><div className="marketing-form-card"><LektrusFeedbackForm compact source="site"/></div></section>
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
