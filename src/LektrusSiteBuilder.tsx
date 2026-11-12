import {useEffect,useRef,useState,type ChangeEvent} from "react";
import {getCurrentUser} from "./authStore";
import {getAccountAccess} from "./accountRoleStore";
import {isRemoteBackendEnabled} from "./backend";
import {BUILTIN_SITE_PAGES,defaultSiteDocument,loadPublishedSiteDocument,newSiteBlock,normalizeSiteDocument,publishSiteDocument,saveSiteDraft,siteDraft,SITE_DRAFT_KEY,SITE_PREVIEW_MESSAGE,type SiteBlockKind,type SiteDocument,type SitePage,type SiteTheme} from "./marketingSiteConfig";

type Inspector="page"|"block"|"design";
type Device="desktop"|"tablet"|"phone";
const builtin=new Set<string>(BUILTIN_SITE_PAGES);
const kinds:{kind:SiteBlockKind;label:string;icon:string}[]=[
 {kind:"text",label:"Текст",icon:"T"},{kind:"image",label:"Изображение",icon:"▧"},
 {kind:"gallery",label:"Галерея",icon:"▦"},{kind:"cards",label:"Карточки",icon:"▤"},
 {kind:"cta",label:"Кнопка и призыв",icon:"↗"},{kind:"divider",label:"Разделитель",icon:"─"}
];
const labelFor=(kind:SiteBlockKind)=>kinds.find(x=>x.kind===kind)?.label??kind;
const basePage=(doc:SiteDocument,id:string):SitePage=>doc.customPages.find(x=>x.id===id)??doc.pages[id]??{
 id,title:doc.navigation.find(x=>x.id===id)?.title??id,eyebrow:"",heading:"",lead:"",blocks:[]
};
const clone=(doc:SiteDocument)=>structuredClone(doc);
const report=(e:unknown)=>e instanceof Error?e.message:"Не удалось выполнить действие";
const size:Record<Device,{width:string;label:string}>={desktop:{width:"100%",label:"Компьютер"},tablet:{width:"768px",label:"Планшет"},phone:{width:"390px",label:"Телефон"}};
export default function LektrusSiteBuilder(){
 const [access,setAccess]=useState<"checking"|"allowed"|"denied">("checking");
 const [doc,setDoc]=useState<SiteDocument>(siteDraft);
 const [active,setActive]=useState("home");
 const [selected,setSelected]=useState<string|null>(null);
 const [inspector,setInspector]=useState<Inspector>("page");
 const [device,setDevice]=useState<Device>("desktop");
 const [newTitle,setNewTitle]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [saved,setSaved]=useState<"draft"|"published">("draft");
 const frame=useRef<HTMLIFrameElement>(null);
 const file=useRef<HTMLInputElement>(null);
 const hadInitialDraft=useRef(Boolean(localStorage.getItem(SITE_DRAFT_KEY)));
 const undo=useRef<SiteDocument[]>([]);
 const redo=useRef<SiteDocument[]>([]);
 const drag=useRef<string|null>(null);
 const activePage=basePage(doc,active);
 const activeBlock=activePage.blocks.find(x=>x.id===selected);
 useEffect(()=>{
  let alive=true;
  void Promise.all([getCurrentUser(),getAccountAccess()]).then(([user,role])=>{
   if(alive)setAccess(user&&!user.isGuest&&role.isAdmin&&isRemoteBackendEnabled()?"allowed":"denied");
  }).catch(()=>{if(alive)setAccess("denied")});
  return ()=>{alive=false};
 },[]);
 useEffect(()=>{
  if(access!=="allowed")return;
  let alive=true;
  void loadPublishedSiteDocument().then(published=>{
   if(alive&&published&&!hadInitialDraft.current)setDoc(published);
  }).catch(()=>{if(alive)setNotice("Опубликованная версия пока недоступна. Черновик сохраняется только в этом браузере.")});
  return ()=>{alive=false};
 },[access]);
 useEffect(()=>{if(access!=="allowed")return;saveSiteDraft(doc);frame.current?.contentWindow?.postMessage({type:SITE_PREVIEW_MESSAGE,document:doc},window.location.origin)},[doc,access]);
 useEffect(()=>{
  const choose=(event:MessageEvent)=>{
   if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow)return;
   if(event.data?.type==="lektrus:site-select-block"&&typeof event.data.id==="string"){
    setSelected(event.data.id);setInspector("block");
   }
  };
  window.addEventListener("message",choose);return()=>window.removeEventListener("message",choose);
 },[]);
 const change=(edit:(next:SiteDocument)=>void)=>{
  undo.current.push(clone(doc));if(undo.current.length>60)undo.current.shift();
  redo.current=[];const next=clone(doc);edit(next);setDoc(normalizeSiteDocument(next));setSaved("draft");setNotice("");
 };
 const history=(direction:"undo"|"redo")=>{
  const from=direction==="undo"?undo.current:redo.current;
  const to=direction==="undo"?redo.current:undo.current;
  const value=from.pop();if(!value)return;
  to.push(clone(doc));setDoc(value);setSaved("draft");setSelected(null);
 };
 const patchPage=(patch:Partial<SitePage>)=>change(next=>{
  if(builtin.has(active))next.pages[active]={...basePage(next,active),...patch};
  else next.customPages=next.customPages.map(p=>p.id===active?{...p,...patch}:p);
 });
 const patchBlock=(patch:Record<string,unknown>)=>{
  if(!activeBlock)return;
  change(next=>{
   const p=basePage(next,active);
   const update={...p,blocks:p.blocks.map(b=>b.id===selected?{...b,...patch}:b)};
   if(builtin.has(active))next.pages[active]=update;
   else next.customPages=next.customPages.map(x=>x.id===active?update:x);
  });
 };
 const addBlock=(kind:SiteBlockKind)=>{
  const block=newSiteBlock(kind);
  change(next=>{
   const p=basePage(next,active),update={...p,blocks:[...p.blocks,block]};
   if(builtin.has(active))next.pages[active]=update;
   else next.customPages=next.customPages.map(x=>x.id===active?update:x);
  });
  setSelected(block.id);setInspector("block");
 };
 const moveBlock=(index:number,offset:number)=>{
  const newIndex=index+offset;if(newIndex<0||newIndex>=activePage.blocks.length)return;
  const blocks=activePage.blocks.slice();[blocks[index],blocks[newIndex]]=[blocks[newIndex],blocks[index]];
  patchPage({blocks});
 };
 const deleteBlock=()=>{if(!activeBlock)return;patchPage({blocks:activePage.blocks.filter(b=>b.id!==selected)});setSelected(null);setInspector("page")};
 const addPage=()=>{
  const title=newTitle.trim().slice(0,64)||"Новая страница";
  const id="page-"+crypto.randomUUID().slice(0,8);
  change(next=>{
   next.customPages.push({id,title,eyebrow:"LEKTRUS",heading:title,lead:"Расскажите о вашем разделе.",blocks:[]});
   next.navigation.push({id,title,hidden:false});
  });
  setNewTitle("");setActive(id);setSelected(null);setInspector("page");
 };
 const removePage=()=>{
  if(builtin.has(active)||!window.confirm("Удалить страницу и все её блоки?"))return;
  const id=active;change(next=>{
   next.customPages=next.customPages.filter(p=>p.id!==id);
   next.navigation=next.navigation.filter(x=>x.id!==id);
  });setActive("home");setSelected(null);
 };
 const renameNav=(title:string)=>change(next=>{
  next.navigation=next.navigation.map(item=>item.id===active?{...item,title:title.slice(0,54)}:item);
  next.customPages=next.customPages.map(p=>p.id===active?{...p,title:title.slice(0,54)}:p);
 });
 const moveNav=(id:string,toId:string)=>{
  if(id===toId)return;
  change(next=>{
   const i=next.navigation.findIndex(x=>x.id===id),j=next.navigation.findIndex(x=>x.id===toId);
   if(i<0||j<0)return;
   const [item]=next.navigation.splice(i,1);next.navigation.splice(j,0,item);
  });
 };
 const previewSrc="/?site-preview=1#"+active;
 const publish=async()=>{setBusy(true);setNotice("");
  try{await publishSiteDocument(doc);setSaved("published");setNotice("Сайт опубликован. Изменения будут видны посетителям после обновления страницы.")}
  catch(e){setNotice(report(e)+". Черновик сохранён локально, опубликованный сайт не изменился.")}
  finally{setBusy(false)}
 };
 const loadPublished=async()=>{
  if(!window.confirm("Заменить текущий черновик опубликованной версией?"))return;
  setBusy(true);
  try{const published=await loadPublishedSiteDocument();
   if(!published)throw Error("Опубликованного дизайна пока нет");
   change(next=>Object.assign(next,published));setNotice("Опубликованная версия загружена в редактор.");
  }catch(e){setNotice(report(e))}finally{setBusy(false)}
 };
 const exportJson=()=>{
  const blob=new Blob([JSON.stringify(doc,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);const link=document.createElement("a");
  link.href=url;link.download="lektrus-site-design.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const importJson=async(event:ChangeEvent<HTMLInputElement>)=>{
  const f=event.target.files?.[0];event.target.value="";if(!f)return;
  try{if(f.size>350000)throw Error("Файл слишком большой");
   const data=normalizeSiteDocument(JSON.parse(await f.text()));
   change(next=>Object.assign(next,data));setActive("home");setSelected(null);
   setNotice("Дизайн загружен в черновик. Опубликуй его отдельно.");
  }catch(e){setNotice("Ошибка импорта: "+report(e))}
 };
 if(access!=="allowed")return <main className="site-builder-guard"><h1>Конструктор сайта Lektrus</h1><p>{access==="checking"?"Проверка прав администратора…":"Доступен только администратору Lektrus после входа в приложение."}</p><a href="/app">Перейти в приложение</a></main>;
 return <div className="site-builder">
  <header className="site-builder-top">
   <a className="site-builder-back" href="/app">← Lektrus</a>
   <div className="site-builder-heading"><strong>Конструктор сайта</strong><small>{saved==="published"?"Опубликовано":"Черновик сохраняется автоматически"}</small></div>
   <div className="site-builder-history"><button type="button" disabled={!undo.current.length} onClick={()=>history("undo")} title="Отменить">↶</button><button type="button" disabled={!redo.current.length} onClick={()=>history("redo")} title="Повторить">↷</button></div>
   <div className="site-builder-device">{(["desktop","tablet","phone"] as Device[]).map(value=><button key={value} type="button" aria-pressed={device===value} className={device===value?"active":""} onClick={()=>setDevice(value)}>{size[value].label}</button>)}</div>
   <button type="button" className="site-builder-neutral" onClick={exportJson}>Экспорт</button>
   <button type="button" className="site-builder-neutral" onClick={()=>file.current?.click()}>Импорт</button>
   <input type="file" accept="application/json,.json" ref={file} hidden onChange={e=>void importJson(e)}/>
   <button type="button" className="site-builder-neutral" disabled={busy} onClick={()=>void loadPublished()}>Загрузить с сайта</button>
   <button type="button" className="site-builder-publish" disabled={busy} onClick={()=>void publish()}>{busy?"Публикация…":"Опубликовать"}</button>
  </header>
  <div className="site-builder-columns">
   <aside className="site-builder-left" aria-label="Страницы и блоки">
    <section><h2>Страницы <span>{doc.navigation.length}</span></h2>
     <p>Перетаскивай страницы, чтобы менять порядок вкладок.</p>
     <nav className="site-builder-page-list" aria-label="Страницы сайта">{doc.navigation.map(item=><div key={item.id} draggable onDragStart={()=>{drag.current=item.id}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(drag.current)moveNav(drag.current,item.id);drag.current=null}}>
      <button type="button" className={active===item.id?"selected":""} onClick={()=>{setActive(item.id);setSelected(null);setInspector("page")}}><span className="site-builder-handle">⠿</span><span>{item.title}</span>{item.hidden&&<span title="Скрыта">◌</span>}</button>
      <button type="button" title={item.hidden?"Показать вкладку":"Скрыть вкладку"} disabled={item.id==="home"} onClick={()=>change(next=>{next.navigation=next.navigation.map(x=>x.id===item.id?{...x,hidden:!x.hidden}:x)})}>{item.hidden?"◉":"◌"}</button>
     </div>)}</nav>
     <form className="site-builder-add-page" onSubmit={e=>{e.preventDefault();addPage()}}><input aria-label="Название новой страницы" placeholder="Новая страница…" value={newTitle} onChange={e=>setNewTitle(e.target.value)}/><button type="submit" disabled={doc.customPages.length>=18}>+</button></form>
    </section>
    <section><h2>Блоки страницы <span>{activePage.blocks.length}</span></h2>
     <div className="site-builder-block-list">{activePage.blocks.map((block,i)=><div key={block.id} className={selected===block.id?"selected":""}>
      <button type="button" onClick={()=>{setSelected(block.id);setInspector("block")}}>{labelFor(block.kind)} <small>{block.title}</small></button>
      <button type="button" disabled={i===0} title="Выше" onClick={()=>moveBlock(i,-1)}>↑</button>
      <button type="button" disabled={i===activePage.blocks.length-1} title="Ниже" onClick={()=>moveBlock(i,1)}>↓</button>
     </div>)}</div>
     <h3>Добавить блок</h3><div className="site-builder-library">{kinds.map(item=><button type="button" key={item.kind} disabled={activePage.blocks.length>=40} onClick={()=>addBlock(item.kind)}><b>{item.icon}</b>{item.label}</button>)}</div>
    </section>
   </aside>
   <main className="site-builder-center"><div className="site-builder-previewbar"><span>Предпросмотр • {size[device].label} • {activePage.title}</span><a href={"/?site-preview=1#"+active} target="_blank" rel="noreferrer">Открыть отдельно ↗</a></div>
    <div className="site-builder-stage"><iframe key={active} ref={frame} title="Предпросмотр сайта Lektrus" src={previewSrc} style={{width:size[device].width}} onLoad={()=>frame.current?.contentWindow?.postMessage({type:SITE_PREVIEW_MESSAGE,document:doc},window.location.origin)}/></div>
   </main>
   <aside className="site-builder-right" aria-label="Настройки">
    <div className="site-builder-inspect-tabs">{(["page","block","design"] as Inspector[]).map((tab,i)=><button key={tab} type="button" className={inspector===tab?"active":""} onClick={()=>setInspector(tab)}>{["Страница","Блок","Дизайн"][i]}</button>)}</div>
    {inspector==="page"&&<div className="site-builder-fields"><h2>Настройка страницы</h2>
     <label>Название вкладки<input value={doc.navigation.find(x=>x.id===active)?.title??""} onChange={e=>renameNav(e.target.value)}/></label>
     <label>Надпись над заголовком<input value={activePage.eyebrow} placeholder="Используется исходная" onChange={e=>patchPage({eyebrow:e.target.value})}/></label>
     <label>Заголовок<input value={activePage.heading} placeholder={builtin.has(active)?"Используется исходный заголовок":""} onChange={e=>patchPage({heading:e.target.value})}/></label>
     <label>Описание<textarea rows={5} value={activePage.lead} placeholder="Используется исходный текст" onChange={e=>patchPage({lead:e.target.value})}/></label>
     {builtin.has(active)?<>
      <label className="site-builder-replace"><input type="checkbox" checked={activePage.replaceDefault===true} onChange={e=>patchPage({replaceDefault:e.target.checked})}/>
       <span><strong>Свой макет страницы</strong><small>{activePage.replaceDefault?"Показаны только выбранные тобой блоки. Можно вернуть стандартный дизайн.":"Стандартный макет и настоящие снимки остаются. Новые блоки добавятся ниже."}</small></span>
      </label>
      <p className="site-builder-tip">Переключатель действует только на эту страницу. Исходная версия не удаляется и вернётся при отключении.</p>
     </>:<button type="button" className="site-builder-danger" onClick={removePage}>Удалить страницу</button>}
    </div>}
    {inspector==="block"&&<div className="site-builder-fields"><h2>{activeBlock?labelFor(activeBlock.kind):"Выбери блок слева"}</h2>
     {activeBlock&&<><label>Заголовок<input value={activeBlock.title} onChange={e=>patchBlock({title:e.target.value})}/></label>
      {activeBlock.kind!=="divider"&&<label>Текст<textarea rows={5} value={activeBlock.text} onChange={e=>patchBlock({text:e.target.value})}/></label>}
      {activeBlock.kind==="image"&&<label>Адрес изображения<input value={activeBlock.image} placeholder="/site/board-math.png" onChange={e=>patchBlock({image:e.target.value})}/></label>}
      {["image","cta"].includes(activeBlock.kind)&&<label>Адрес ссылки<input value={activeBlock.href} placeholder="/app" onChange={e=>patchBlock({href:e.target.value})}/></label>}
      {["gallery","cards"].includes(activeBlock.kind)&&<label>{activeBlock.kind==="gallery"?"Изображения (по одному URL на строку)":"Карточки (по одной на строку)"}<textarea rows={8} value={activeBlock.items.join("\n")} onChange={e=>patchBlock({items:e.target.value.split("\n").slice(0,12)})}/></label>}
      <button type="button" className="site-builder-danger" onClick={deleteBlock}>Удалить блок</button></>}
    </div>}
    {inspector==="design"&&<div className="site-builder-fields"><h2>Оформление сайта</h2><p>Цвета и размеры действуют на все вкладки. Их содержимое остаётся самостоятельным.</p>
     {([["accent","Акцентный цвет"],["background","Фон страницы"],["surface","Поверхность карточек"],["ink","Основной текст"]] as [keyof SiteTheme,string][]).map(([key,label])=><label key={key}>{label}<span className="site-builder-color"><input type="color" value={String(doc.theme[key])} onChange={e=>change(next=>{(next.theme as unknown as Record<string,unknown>)[key]=e.target.value})}/><code>{doc.theme[key]}</code></span></label>)}
     <label>Скругление карточек: {doc.theme.radius}px<input type="range" min="0" max="40" value={doc.theme.radius} onChange={e=>change(next=>{next.theme.radius=Number(e.target.value)})}/></label>
     <label>Ширина контента: {doc.theme.maxWidth}px<input type="range" min="850" max="1500" step="25" value={doc.theme.maxWidth} onChange={e=>change(next=>{next.theme.maxWidth=Number(e.target.value)})}/></label>
     <button type="button" className="site-builder-neutral" onClick={()=>change(next=>{next.theme=defaultSiteDocument().theme})}>Сбросить цвета и размеры</button>
    </div>}
    {notice&&<p className="site-builder-notice" role="status">{notice}</p>}
   </aside>
  </div>
 </div>;
}
