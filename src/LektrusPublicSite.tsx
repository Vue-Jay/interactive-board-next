import {useEffect,useState,type CSSProperties,type MouseEvent,type ReactNode} from "react";
import {defaultSiteDocument,loadPublishedSiteDocument,normalizeSiteDocument,SITE_PREVIEW_MESSAGE,type SiteDocument} from "./marketingSiteConfig";
import {SiteCustomPage,SiteAnchorSlot} from "./SiteEditableSections";
import {SiteObjectLayer} from "./SiteObjectLayer";
import {commandFromKeyboard,type StudioCommand} from "./siteStudioCommands";
import LektrusFeedbackForm from "./LektrusFeedbackForm";
import {plans,limitLabel} from "./billingStore";
import "./lektrusMarketing.css";
import "./lektrusMarketingTypography.css";

type Page=string;
const navigation:{id:Page;title:string}[]=[
 {id:"home",title:"Главная"},
 {id:"features",title:"Возможности"},
 {id:"pricing",title:"Тарифы"},
 {id:"help",title:"Помощь и контакты"}
];
const featureGroups=[
 {
  id:"prepare",
  number:"01",
  label:"Подготовка",
  title:"Подготовьте всё необходимое",
  layout:"cards",
  items:[
   {icon:"files",title:"Собирайте материалы в одном месте",text:"Добавляйте изображения, документы PDF, текст, таблицы, схемы и задания прямо на доску. Всё необходимое для объяснения будет под рукой."},
   {icon:"calendar",title:"Организуйте учебную работу",text:"Упорядочивайте доски и материалы по предметам, планируйте занятия и пользуйтесь расписанием. Нужное легко найти и продолжить."}
  ]
 },
 {
  id:"explore",
  number:"02",
  label:"Работа и исследование",
  title:"Объясняйте, взаимодействуйте, исследуйте",
  layout:"rows",
  items:[
   {icon:"pen",title:"Объясняйте на интерактивной доске",text:"Пишите, рисуйте, выделяйте главное, стройте схемы и графики, добавляйте формулы и геометрические построения. Используйте подходящий инструмент для каждой задачи."},
   {icon:"users",title:"Работайте вместе в реальном времени",text:"Несколько участников могут работать на общей доске, дополнять записи, предлагать решения и обсуждать их. Объяснение превращается в совместную работу."},
   {icon:"flask",title:"Исследуйте сложные темы на практике",text:"Изучайте учебные модели, работайте с интерактивным атласом, проводите виртуальные опыты в химической лаборатории и используйте предметные инструменты."}
  ]
 },
 {
  id:"result",
  number:"03",
  label:"Закрепление и результат",
  title:"Закрепляйте знания и продолжайте работу",
  layout:"cards",
  items:[
   {icon:"tasks",title:"Создавайте и разбирайте задания",text:"Дополняйте материалы упражнениями и интерактивными заданиями, разбирайте решения и исправляйте ошибки прямо по ходу работы."},
   {icon:"save",title:"Сохраняйте результаты",text:"Возвращайтесь к созданным доскам, сохраняйте материалы и продолжайте с того места, где остановились. Проделанная работа не пропадает."}
  ]
 }
] as const;
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

function MarketingFeatureIcon({name}:{name:string}){
 const shapes:Record<string,ReactNode>={
  files:<><rect x="7" y="3" width="13" height="17" rx="2"/><path d="M4 7v13a2 2 0 0 0 2 2h11M10 8h7M10 12h7M10 16h4"/></>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h3M15 14h2"/></>,
  pen:<><path d="m4 20 4.5-1.1L20 7.4a2 2 0 0 0-3.4-3.4L5.1 15.5 4 20Z"/><path d="m14.5 6.5 3 3M3 22h18"/></>,
  users:<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2H3ZM17 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1h-3"/></>,
  flask:<><path d="M9 3h6M10 3v7l-5.5 8.2A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.8L14 10V3M7 16h10"/></>,
  tasks:<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="m7 9 1.5 1.5L11 8M13 9h4m-10 7 1.5 1.5L11 15m2 1h4"/></>,
  save:<><path d="M4 3h13l3 3v15H4V3Z"/><path d="M7 3v7h10V3M8 21v-8h8v8"/></>,
 };
 return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none">{shapes[name]??shapes.files}</svg>;
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
   setShowcaseSlide(showcaseSlide+1);
  },7500);
  return ()=>window.clearInterval(id);
 },[page,showcaseSlide,showcaseShots.length]);
 useEffect(()=>{
  if(previousSlide===null)return;
  const id=window.setTimeout(()=>setPreviousSlide(null),900);
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
      <div className="marketing-hero-identity">
       <img className="marketing-hero-logo" src="/lektrus-icon-192.png" alt="" aria-hidden="true" width="84" height="84" decoding="async"/>
       <h1 id="marketing-title">{copy?.heading||<><span className="marketing-hero-brand-name">Lektrus</span><span>платформа для обучения</span></>}</h1>
      </div>
      <p className="marketing-hero-lead">{copy?.lead||"Lektrus — интерактивное пространство для уроков в классе и онлайн. Объясняйте на общей доске, исследуйте учебные модели, решайте задачи вместе и сохраняйте результаты в одном месте."}</p>
      <div className="marketing-actions"><a className="marketing-primary" href="/app">Начать работу <span aria-hidden="true">↗</span></a><DemoLink className="marketing-secondary">Демо-версия доски <span aria-hidden="true">→</span></DemoLink></div>
     </div>
     <div className="marketing-showcase" aria-label="Автоматическая презентация настоящих экранов Lektrus" data-site-showcase>
      <div className="marketing-showcase-screen" role="img" aria-label="Примеры реальных экранов приложения Lektrus">
       <div className="marketing-showcase-motion">
        {previousShot&&<img className="marketing-showcase-base" src={previousShot.src} alt="" aria-hidden="true"/>}
        <img key={showcaseSlide} className={previousShot?"marketing-showcase-fade":"marketing-showcase-base"} src={currentShot.src} alt="" fetchPriority={showcaseSlide===0?"high":"auto"}/>
       </div>
      </div>
     </div>
    </section>
    {placed("before-1")}
    <section data-site-section-id="native-1" className="marketing-section marketing-container marketing-project-summary" aria-labelledby="marketing-project-title">
     <div className="marketing-project-intro">
      <div className="marketing-project-heading">
       <span className="marketing-eyebrow">О проекте</span>
       <h2 id="marketing-project-title">Урок, в котором можно не только смотреть, но и действовать</h2>
       <p className="marketing-project-caption">Для тех, кто хочет объяснять понятно, учиться с интересом и исследовать новое вместе.</p>
      </div>
      <div className="marketing-project-body">
       <p><strong>Lektrus — образовательная платформа с общей интерактивной доской и предметными инструментами.</strong> Здесь объяснение становится совместной работой: преподаватель показывает ход мысли, а ученики могут участвовать, задавать вопросы и пробовать свои решения.</p>
       <p className="marketing-project-detail">Рисунки, схемы, документы, задания и учебные модели находятся в одном пространстве. Не нужно разрывать занятие между разными материалами: можно показать тему, разобрать пример, провести виртуальный опыт и сохранить результат для следующего урока.</p>
      </div>
     </div>
     <div className="marketing-project-journey" aria-label="От подготовки урока до результата">
      <div className="marketing-project-journey-heading">
       <span className="marketing-eyebrow">Один процесс вместо набора разрозненных сервисов</span>
       <h3>От идеи до готового занятия</h3>
      </div>
      <div className="marketing-project-stages">
       <article className="marketing-project-stage"><span className="marketing-project-stage-number" aria-hidden="true">01</span><div><h4>Подготовьте материал</h4><p>Соберите на доске изображения, текст, схемы и задания. Всё, что понадобится для объяснения, будет под рукой.</p></div></article>
       <article className="marketing-project-stage"><span className="marketing-project-stage-number" aria-hidden="true">02</span><div><h4>Исследуйте вместе</h4><p>Рисуйте, стройте графики, работайте с учебными моделями и обсуждайте решения на общем холсте.</p></div></article>
       <article className="marketing-project-stage"><span className="marketing-project-stage-number" aria-hidden="true">03</span><div><h4>Продолжайте с результата</h4><p>Сохраните материалы и ход занятия, чтобы вернуться к ним, закрепить тему или развить следующую.</p></div></article>
      </div>
     </div>
     <div className="marketing-project-audiences">
      <article className="marketing-project-audience"><span className="marketing-project-audience-label">Преподавателям</span><h3>Меньше переключений. Больше наглядности.</h3><p>Показывайте сложные темы на примерах, вовлекайте учеников в работу и сохраняйте подготовленные уроки. Внимание остаётся на объяснении, а не на поиске нужного файла.</p></article>
      <article className="marketing-project-audience"><span className="marketing-project-audience-label">Ученикам</span><h3>Не просто слушать. Пробовать и понимать.</h3><p>Разбирайтесь в задачах шаг за шагом, дополняйте общие решения и исследуйте процессы на практике. Ошибки становятся частью изучения, а не концом попытки.</p></article>
     </div>
     <div className="marketing-project-outro">
      
      <div><strong>Больше, чем интерактивная доска.</strong><p>Интерактивный атлас и химическая лаборатория доступны также без создания доски. Можно открыть инструмент отдельно и сразу приступить к исследованию темы.</p></div>
     </div>
    </section>
    {placed("before-2")}
    {placed("before-3")}
    {placed("before-4")}
   </>}
   {page==="features"&&!copy?.replaceDefault&&<>
    {placed("before-0")}
    <section data-site-section-id="native-0" data-site-page-hero className="marketing-page-hero marketing-container marketing-features-intro marketing-features-task-intro">
     <span className="marketing-eyebrow">{copy?.eyebrow||"Возможности Lektrus"}</span>
     <h1>{copy?.heading||"Всё, что нужно для учебной работы"}</h1>
     <p>{copy?.lead||"От подготовки материалов до совместного решения задач и исследования сложных тем. Узнайте, как Lektrus помогает на каждом этапе."}</p>
    </section>
    {placed("before-1")}
    <section data-site-section-id="native-1" className="marketing-section marketing-container marketing-features-section marketing-feature-flow" aria-label="Возможности Lektrus по этапам работы">
     <div className="marketing-feature-groups">
      {featureGroups.map(group=><section className={"marketing-feature-group marketing-feature-group-"+group.layout} key={group.id} aria-labelledby={"marketing-feature-group-"+group.id}>
       <div className="marketing-feature-group-heading">
        <span className="marketing-feature-group-label"><span aria-hidden="true">{group.number} / </span>{group.label}</span>
        <h2 id={"marketing-feature-group-"+group.id}>{group.title}</h2>
       </div>
       <div className={"marketing-feature-items marketing-feature-items-"+group.layout}>
        {group.items.map(item=><article className="marketing-feature-item" key={item.icon}>
         <span className="marketing-feature-icon"><MarketingFeatureIcon name={item.icon}/></span>
         <div className="marketing-feature-item-copy">
          <h3>{item.title}</h3>
          <p>{item.text}</p>
         </div>
        </article>)}
       </div>
      </section>)}
     </div>
    </section>
    {placed("before-2")}
    {placed("before-3")}
   </>}
   {page==="pricing"&&!copy?.replaceDefault&&<>
    {placed("before-0")}
    <section data-site-section-id="native-0" data-site-page-hero className="marketing-page-hero marketing-container marketing-pricing-intro"><span className="marketing-eyebrow">{copy?.eyebrow||"Тарифы Lektrus"}</span><h1>{copy?.heading||<>Выберите формат работы <span>под свои задачи</span></>}</h1><p>{copy?.lead||"Ниже указаны тарифы и ограничения, которые сейчас определены в приложении. Платные тарифы находятся в тестовом состоянии, оформление подписки пока недоступно."}</p></section>
    {placed("before-1")}
    <section data-site-section-id="native-1" className="marketing-container marketing-pricing-grid" aria-label="Сравнение тарифов">{plans.map((plan,i)=><article className={"marketing-plan"+(i===1?" marketing-plan-highlight":"")} key={plan.id}><div className="marketing-plan-top"><span className="marketing-eyebrow">{i===0?"Для знакомства":i===1?"Для занятий":"Для групп"}</span><h2>{plan.name}</h2><p>{plan.description}</p></div><strong className="marketing-price">{plan.priceLabel}</strong><dl><div><dt>Доски</dt><dd>{limitLabel(plan.limits.boards)}</dd></div><div><dt>Участники на доске</dt><dd>{limitLabel(plan.limits.collaboratorsPerBoard)}</dd></div><div><dt>Материалы</dt><dd>{plan.limits.storageMb===100?"100 МБ":plan.limits.storageMb===2048?"2 ГБ":plan.limits.storageMb===10240?"10 ГБ":limitLabel(plan.limits.storageMb," МБ")}</dd></div></dl><ul>{plan.features.map(feature=><li key={feature}>{feature}</li>)}</ul><div className="marketing-plan-foot">{i===0?<a href="/app" className="marketing-primary">Начать бесплатно ↗</a>:<span>Тестовый тариф · оформление недоступно</span>}</div></article>)}</section>
   </>}
   {page==="help"&&!copy?.replaceDefault&&<>
    {placed("before-0")}
    <section data-site-section-id="native-0" data-site-page-hero className="marketing-page-hero marketing-container marketing-help-intro">
     <span className="marketing-eyebrow">{copy?.eyebrow||"Помощь и контакты"}</span>
     <h1>{copy?.heading||"Чем можем помочь?"}</h1>
     <p>{copy?.lead||"Найдите ответ на частый вопрос или напишите команде Lektrus. Всё в одном месте, без лишних шагов."}</p>
    </section>
    {placed("before-1")}
    <div className="marketing-container marketing-help-layout">
     <section data-site-section-id="native-1" className="marketing-section marketing-help-questions" aria-labelledby="marketing-help-questions-title">
      <div className="marketing-help-panel-heading">
       <h2 id="marketing-help-questions-title">Частые вопросы</h2>
       <p>Самое важное о работе с Lektrus.</p>
      </div>
      <div className="marketing-faq">{questions.map(item=><details key={item.q}><summary><span>{item.q}</span><span className="marketing-faq-toggle" aria-hidden="true">+</span></summary><p>{item.a}</p></details>)}</div>
     </section>
     {placed("before-2")}
     <section data-site-section-id="native-2" className="marketing-section marketing-contact marketing-help-contact" aria-labelledby="marketing-help-contact-title">
      <div className="marketing-help-panel-heading">
       <h2 id="marketing-help-contact-title">Напишите нам</h2>
       <p>Есть вопрос, предложение или замечание? Отправьте сообщение команде Lektrus.</p>
      </div>
      <div className="marketing-form-card"><LektrusFeedbackForm compact source="site"/></div>
     </section>
    </div>
   </>}
   {customPage&&<SiteCustomPage page={customPage} selectedId={previewSelection} preview={isPreview}/>}
   {!customPage&&placed("end")}
  </main>
  <footer className={"marketing-footer"+(page==="home"?" marketing-footer-home":"")}>
   {page==="home"?
    <div className="marketing-container marketing-footer-home-inner">
     <div className="marketing-footer-home-main">
      <div className="marketing-footer-home-brand">
       <div className="marketing-footer-home-wordmark">
        <img src="/lektrus-icon-192.png" width="38" height="38" alt=""/>
        <strong>Lektrus</strong>
       </div>
       <p>Уроки, в которых можно исследовать и создавать вместе.</p>
       <a className="marketing-footer-home-app" href="/app">Открыть приложение <span aria-hidden="true">↗</span></a>
      </div>
      <nav className="marketing-footer-home-links" aria-label="Разделы сайта">
       <span className="marketing-footer-home-label">На сайте</span>
       <NavLink id="features" title="Возможности"/>
       <NavLink id="pricing" title="Тарифы"/>
       <NavLink id="help" title="Помощь и контакты"/>
      </nav>
      <nav className="marketing-footer-home-links" aria-label="Учебные инструменты">
       <span className="marketing-footer-home-label">Инструменты</span>
       <a href="/tools/atlas">Интерактивный атлас</a>
       <a href="/tools/laboratory">Химическая лаборатория</a>
      </nav>
     </div>
     <div className="marketing-footer-home-bottom">
      <span>© {new Date().getFullYear()} Lektrus</span>
      <span>Пространство для обучения</span>
     </div>
    </div>:
    <div className="marketing-container">
     <span>© {new Date().getFullYear()} Lektrus</span>
     <div className="marketing-footer-end"><NavLink id="features" title="Возможности"/><NavLink id="help" title="Помощь"/><a href="/app">Открыть приложение ↗</a></div>
    </div>}
  </footer>
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
