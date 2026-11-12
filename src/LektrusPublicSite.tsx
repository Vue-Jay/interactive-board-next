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
 {id:"pricing",title:"Тарифы"},
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
const questions=[
 {q:"Что такое Lektrus?",a:"Это образовательная платформа с интерактивной доской, предметными инструментами и возможностями совместной работы."},
 {q:"Можно ли попробовать доску без аккаунта?",a:"Да. На сайте есть отдельная гостевая демонстрация. Изменения в ней не затрагивают рабочие доски других пользователей."},
 {q:"Какие инструменты доступны отдельно?",a:"Интерактивный атлас и химическую лабораторию можно открыть напрямую, без создания доски."},
 {q:"Какие тарифы есть в Lektrus?",a:"В приложении определены Free, Teacher и Pro. Free бесплатный, а условия платных тарифов пока имеют тестовый статус."},
 {q:"Куда отправить предложение или сообщение об ошибке?",a:"Используйте форму обратной связи ниже. Можно указать тему обращения и адрес для ответа."}
];
function readPage():Page{
 const hash=window.location.hash.replace(/^#/,"");
 if(["teachers","students","tools","how","about"].includes(hash))return "home";
 return /^[a-z][a-z0-9-]{0,39}$/.test(hash)?hash:"home";
}
function DemoLink({scene="math",children,className=""}:{scene?:string;children:ReactNode;className?:string}){
 return <a className={className} href={"/demo/board?scene="+encodeURIComponent(scene)}>{children}</a>;
}

function SiteMenuIcon({name}:{name:string}){
 const shapes:Record<string,ReactNode>={
  home:<><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-7h6v7"/></>,
  features:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  tools:<><path d="M9 3v7l-5 8.2A2 2 0 0 0 5.7 21h12.6a2 2 0 0 0 1.7-2.8L15 10V3"/><path d="M8 3h8M6.5 15h11"/></>,
  how:<><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/></>,
  pricing:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
  about:<><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
  help:<><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 0 1 5 1c0 1.8-2.5 2.1-2.5 3.8M12 17h.01"/></>,
  atlas:<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></>,
  laboratory:<><path d="M9 3h6M10 3v7l-5.5 8.2A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.8L14 10V3M7.5 15h9"/></>
 };
 return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="19" height="19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none">{shapes[name]??shapes.features}</svg>;
}

export default function LektrusPublicSite(){
 const isPreview=new URLSearchParams(window.location.search).has("site-preview");
 const [config,setConfig]=useState<SiteDocument>(defaultSiteDocument);
 const [previewSelection,setPreviewSelection]=useState<string|null>(null);
 const [previewObject,setPreviewObject]=useState<string|null>(null);
 const [previewInteractive,setPreviewInteractive]=useState(false);
 const [page,setPage]=useState<Page>(readPage);
 const siteNavigation=(config.navigation.length?config.navigation:navigation.map(item=>({...item,hidden:false}))).filter(item=>(!item.hidden||item.id==="home")&&!["teachers","students","tools","how","about"].includes(item.id));
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
 // The single homepage frame switches more dynamically between genuine Lektrus screenshots.
 // No controls or subject pickers: the rest of the site keeps its own editorial content.
 useEffect(()=>{
  if(page!=="home"||showcaseShots.length<2||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const id=window.setInterval(()=>{
   if(document.hidden)return;
   setPreviousSlide(showcaseSlide);
   setShowcaseSlide((showcaseSlide+1)%showcaseShots.length);
  },3600);
  return ()=>window.clearInterval(id);
 },[page,showcaseSlide,showcaseShots.length]);
 useEffect(()=>{
  if(previousSlide===null)return;
  const id=window.setTimeout(()=>setPreviousSlide(null),650);
  return ()=>window.clearTimeout(id);
 },[previousSlide]);
 useEffect(()=>{
  if(page!=="home"||showcaseShots.length<2)return;
  const next=showcaseShots[(showcaseSlide+1)%showcaseShots.length];
  const image=new Image();image.src=next.src;
 },[page,showcaseSlide,showcaseShots]);
 useEffect(()=>{
  if(!menuOpen)return;
  const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setMenuOpen(false)};
  window.addEventListener("keydown",close);
  return ()=>window.removeEventListener("keydown",close);
 },[menuOpen]);
 const navigate=(target:Page,event?:MouseEvent<HTMLAnchorElement>)=>{
  event?.preventDefault();
  if(["teachers","students","tools","how","about"].includes(target))target="home";
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
 const NavLink=({id,title,icon=false}:{id:Page;title:string;icon?:boolean})=><a href={"#"+id} aria-current={page===id?"page":undefined} className={page===id?"is-current":""} onClick={event=>navigate(id,event)}>{icon&&<SiteMenuIcon name={id}/>}<span>{title}</span></a>;
 return <div className={isPreview?"marketing-site site-preview"+(previewInteractive?" site-preview-interactive":""):"marketing-site"} style={{"--marketing-blue":config.theme.accent,"--marketing-bg":config.theme.background,"--marketing-white":config.theme.surface,"--marketing-ink":config.theme.ink,"--site-custom-radius":config.theme.radius+"px","--site-custom-width":config.theme.maxWidth+"px"} as CSSProperties}>
  <a className="marketing-skip" href="#marketing-main">Перейти к содержимому</a>
  <header className={"marketing-header"+(menuOpen?" is-expanded":"")}>
   <div className="marketing-header-inner">
    <a className="marketing-brand" href="#home" onClick={event=>navigate("home",event)} aria-label="Lektrus, на главную">
     <span className="marketing-brand-icon"><img src="/lektrus-icon-192.png" width="40" height="40" alt=""/></span>
     <span><strong>Lektrus</strong><small>Пространство для обучения</small></span>
    </a>
    <button type="button" className="marketing-menu-toggle" aria-label={menuOpen?"Закрыть меню":"Открыть меню"} aria-expanded={menuOpen} aria-controls="marketing-sidebar-content" onClick={()=>setMenuOpen(v=>!v)}>
     <SiteMenuIcon name="features"/><span>{menuOpen?"Закрыть":"Меню"}</span>
    </button>
    <div id="marketing-sidebar-content" className="marketing-sidebar-content">
     <div className="marketing-sidebar-group">
      <span className="marketing-sidebar-caption">Разделы сайта</span>
      <nav id="marketing-nav" className="marketing-nav" aria-label="Разделы сайта">
       {siteNavigation.map(item=><NavLink key={item.id} {...item} icon/>)}
      </nav>
     </div>
     <div className="marketing-sidebar-group marketing-sidebar-tools">
      <span className="marketing-sidebar-caption">Инструменты</span>
      <a href="/tools/atlas"><SiteMenuIcon name="atlas"/><span>Интерактивный атлас</span><span className="marketing-sidebar-external" aria-hidden="true">↗</span></a>
      <a href="/tools/laboratory"><SiteMenuIcon name="laboratory"/><span>Химическая лаборатория</span><span className="marketing-sidebar-external" aria-hidden="true">↗</span></a>
     </div>
     <div className="marketing-sidebar-bottom">
      <a className="marketing-app-entry" href="/app"><span className="marketing-app-entry-symbol"><SiteMenuIcon name="home"/></span><span>Войти в Lektrus</span><span aria-hidden="true">↗</span></a>
     </div>
    </div>
   </div>
  </header>
  {menuOpen&&<button type="button" className="marketing-sidebar-backdrop" onClick={()=>setMenuOpen(false)} aria-label="Закрыть боковое меню"/>}
  <main id="marketing-main" tabIndex={-1}>
   {page==="home"&&!copy?.replaceDefault&&<>
    {placed("before-0")}
    <section data-site-section-id="native-0" data-site-page-hero className="marketing-hero marketing-container marketing-hero-split" aria-labelledby="marketing-title">
     <div className="marketing-hero-copy">
      {copy?.eyebrow&&<span className="marketing-eyebrow">{copy.eyebrow}</span>}
      <h1 id="marketing-title">{copy?.heading||<>Lektrus <span>платформа для обучения</span></>}</h1>
      <p className="marketing-hero-lead">{copy?.lead||"Интерактивная доска, совместная работа и учебные инструменты в одном пространстве."}</p>
      <div className="marketing-actions"><a className="marketing-primary" href="/app">Начать работу <span aria-hidden="true">↗</span></a><DemoLink className="marketing-secondary">Попробовать доску <span aria-hidden="true">→</span></DemoLink></div>
     </div>
     <div className="marketing-showcase" aria-label="Автоматическая презентация настоящих экранов Lektrus" data-site-showcase>
      <div className="marketing-showcase-screen" role="img" aria-label="Примеры реальных экранов приложения Lektrus">
       {previousShot&&<img className="marketing-showcase-previous" src={previousShot.src} alt="" aria-hidden="true"/>}
       <img key={currentShot.src} className={"marketing-showcase-current"+(showcaseSlide===0&&previousSlide===null?" is-first":"")} src={currentShot.src} alt="" fetchPriority={showcaseSlide===0?"high":"auto"}/>
      </div>
     </div>
    </section>
    {placed("before-1")}
    <section data-site-section-id="native-1" className="marketing-section marketing-container marketing-project-summary" aria-label="О проекте Lektrus">
     <div className="marketing-project-heading">
      <span className="marketing-eyebrow">О проекте</span>
      <h2>Учиться и объяснять проще, когда всё под рукой</h2>
     </div>
     <div className="marketing-project-body">
      <p>Lektrus объединяет интерактивную доску, учебные модели и совместную работу в одном пространстве. Здесь можно подготовить материал, объяснить новую тему и продолжить занятие с того же места.</p>
      <div className="marketing-project-audiences">
       <p><strong>Преподавателям</strong> Создавайте наглядные объяснения, собирайте задания и сохраняйте материалы уроков.</p>
       <p><strong>Ученикам</strong> Исследуйте темы, участвуйте в общей работе и разбирайтесь в сложном на практике.</p>
      </div>
     </div>
    </section>
    {placed("before-2")}
    {placed("before-3")}
    {placed("before-4")}
   </>}
   {page==="features"&&!copy?.replaceDefault&&<>
    {placed("before-0")}
    <section data-site-section-id="native-0" data-site-page-hero className="marketing-page-hero marketing-container marketing-features-intro">
     {copy?.eyebrow&&<span className="marketing-eyebrow">{copy.eyebrow}</span>}
     <h1>{copy?.heading||<>Что умеет <span>Lektrus</span></>}</h1>
     <p>{copy?.lead||"Функции, которые помогают делать урок наглядным, совместным и удобным для всех участников."}</p>
    </section>
    {placed("before-1")}
    <section data-site-section-id="native-1" className="marketing-section marketing-container marketing-features-section" aria-label="Описание возможностей Lektrus">
     <div className="marketing-features-list">{featureCards.map((card,i)=><article className="marketing-feature-row" key={card.index}>
      <span className="marketing-feature-row-mark" aria-hidden="true">{featureSymbols[i]}</span>
      <span className="marketing-feature-row-copy"><h2>{card.title}</h2><p>{card.text}</p></span>
     </article>)}</div>
    </section>
    {placed("before-2")}
    {placed("before-3")}
   </>}
   {page==="pricing"&&!copy?.replaceDefault&&<>
    {placed("before-0")}
    <section data-site-section-id="native-0" data-site-page-hero className="marketing-page-hero marketing-container marketing-pricing-intro"><span className="marketing-eyebrow">{copy?.eyebrow||"Тарифы Lektrus"}</span><h1>{copy?.heading||<>Выберите формат работы <span>под свои задачи</span></>}</h1><p>{copy?.lead||"Ниже указаны тарифы и ограничения, которые сейчас определены в приложении. Платные тарифы находятся в тестовом состоянии, оформление подписки пока недоступно."}</p></section>
    {placed("before-1")}
    <section data-site-section-id="native-1" className="marketing-container marketing-pricing-grid" aria-label="Сравнение тарифов">{plans.map((plan,i)=><article className={"marketing-plan"+(i===1?" marketing-plan-highlight":"")} key={plan.id}><div className="marketing-plan-top"><span className="marketing-eyebrow">{i===0?"Для знакомства":i===1?"Для занятий":"Для групп"}</span><h2>{plan.name}</h2><p>{plan.description}</p></div><strong className="marketing-price">{plan.priceLabel}</strong><dl><div><dt>Доски</dt><dd>{limitLabel(plan.limits.boards)}</dd></div><div><dt>Участники на доске</dt><dd>{limitLabel(plan.limits.collaboratorsPerBoard)}</dd></div><div><dt>Материалы</dt><dd>{plan.limits.storageMb===100?"100 МБ":plan.limits.storageMb===2048?"2 ГБ":plan.limits.storageMb===10240?"10 ГБ":limitLabel(plan.limits.storageMb," МБ")}</dd></div></dl><ul>{plan.features.map(feature=><li key={feature}>{feature}</li>)}</ul><div className="marketing-plan-foot">{i===0?<a href="/app" className="marketing-primary">Начать бесплатно ↗</a>:<span>Тестовый тариф · оформление недоступно</span>}</div></article>)}</section>
    <p className="marketing-container marketing-pricing-note">Это текущие технические ограничения тарифов из проекта Lektrus, а не опубликованное коммерческое предложение. Условия платной подписки будут объявлены отдельно.</p>
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
  <footer className="marketing-footer"><div className="marketing-container">
   <span>© {new Date().getFullYear()} Lektrus</span>
   <div className="marketing-footer-end"><NavLink id="features" title="Возможности"/><NavLink id="help" title="Помощь"/><a href="/app">Открыть приложение ↗</a></div>
  </div></footer>
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
