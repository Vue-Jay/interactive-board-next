import {useEffect,useRef,useState,type ChangeEvent} from "react";
import {decodeSiteCanvasTransfer,putSiteCanvasTransfer,type SiteCanvasTransfer} from "./SiteCanvasDnD";
import type {SiteObjectInfo} from "./SiteObjectLayer";
import {getCurrentUser} from "./authStore";
import {getAccountAccess} from "./accountRoleStore";
import {isRemoteBackendEnabled} from "./backend";
import SiteImageChooser from "./SiteImageChooser";
import {SITE_SECTION_PRESETS,SITE_THEME_PRESETS} from "./siteStudioPresets";
import {DEFAULT_SITE_BLOCK_STYLE,type SiteBlockStyle} from "./marketingSiteConfig";
import {BUILTIN_SITE_PAGES,defaultSiteDocument,loadPublishedSiteDocument,newSiteBlock,normalizeSiteDocument,publishSiteDocument,saveSiteDraft,siteDraft,SITE_DRAFT_KEY,SITE_PREVIEW_MESSAGE,type SiteBlockKind,type SiteDocument,type SitePage,type SiteTheme} from "./marketingSiteConfig";

type Inspector="page"|"block"|"object"|"design";
type LibraryMode="blocks"|"kits";
type Device="desktop"|"tablet"|"phone";
const builtin=new Set<string>(BUILTIN_SITE_PAGES);
const kinds:{kind:SiteBlockKind;label:string;icon:string}[]=[
 {kind:"text",label:"Текст",icon:"T"},{kind:"image",label:"Изображение",icon:"▧"},
 {kind:"gallery",label:"Галерея",icon:"▦"},{kind:"cards",label:"Карточки",icon:"▤"},
 {kind:"cta",label:"Кнопка и призыв",icon:"↗"},{kind:"divider",label:"Разделитель",icon:"─"},
 {kind:"faq",label:"Вопросы и ответы",icon:"?"},{kind:"stats",label:"Цифры",icon:"№"},
 {kind:"quote",label:"Цитата",icon:"❞"},
 {kind:"video",label:"Видео",icon:"▶"},{kind:"timeline",label:"Этапы и история",icon:"≡"},
 {kind:"comparison",label:"Сравнение",icon:"◫"},{kind:"logos",label:"Логотипы",icon:"◈"},
 {kind:"spacer",label:"Пустое пространство",icon:"↕"},{kind:"checklist",label:"Список плюсов",icon:"✓"},
 {kind:"button-row",label:"Несколько кнопок",icon:"▤"}
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
 const [selectedObject,setSelectedObject]=useState<string|null>(null);
 const [objectMeta,setObjectMeta]=useState<SiteObjectInfo|null>(null);
 const [objectList,setObjectList]=useState<SiteObjectInfo[]>([]);
 const [objectSearch,setObjectSearch]=useState("");
 const [interactive,setInteractive]=useState(false);
 const [inspector,setInspector]=useState<Inspector>("page");
 const [device,setDevice]=useState<Device>("desktop");
 const [libraryMode,setLibraryMode]=useState<LibraryMode>("kits");
 const [pageSearch,setPageSearch]=useState("");
 const [focusMode,setFocusMode]=useState(false);
 const [panelOpen,setPanelOpen]=useState(false);
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
 const blockDrag=useRef<string|null>(null);
 const activePage=basePage(doc,active);
 const activeBlock=activePage.blocks.find(x=>x.id===selected);
 const activeObjectPatch=selectedObject?doc.objects[selectedObject]:undefined;
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
 useEffect(()=>{if(access!=="allowed")return;saveSiteDraft(doc);frame.current?.contentWindow?.postMessage({type:SITE_PREVIEW_MESSAGE,document:doc,selectedId:selected,objectId:selectedObject,interactive},window.location.origin)},[doc,access,selected,selectedObject,interactive]);

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
 const patchObject=(patch:Record<string,unknown>)=>{
  if(!selectedObject)return;
  change(next=>{
   const old=next.objects[selectedObject]??{};
   next.objects[selectedObject]={...old,...patch,style:{...old.style,...(patch.style as Record<string,unknown>||{})}};
  });
 };
 const resetObject=()=>{
  if(!selectedObject)return;
  change(next=>{delete next.objects[selectedObject]});
 };
 const insertCanvasTransfer=(transfer:SiteCanvasTransfer,anchor:string,index:number)=>{
  if(!/^(?:end|before-(?:[0-9]|[12][0-9]))$/.test(anchor))return;
  const kit=transfer.type==="kit"?SITE_SECTION_PRESETS.find(item=>item.id===transfer.id):undefined;
  if(transfer.type==="kit"&&!kit)return;
  if(transfer.type==="block"&&!kinds.some(item=>item.kind===transfer.kind))return;
  const moving=transfer.type==="move"?activePage.blocks.find(b=>b.id===transfer.id):undefined;
  if(transfer.type==="move"&&!moving)return;
  const added=transfer.type==="block"?[newSiteBlock(transfer.kind)]:transfer.type==="kit"?kit?.create()??[]:moving?[moving]:[];
  if(!added.length||activePage.blocks.length+(moving?0:added.length)>40){setNotice("На странице не может быть больше 40 блоков.");return}
  const items=activePage.blocks.filter(block=>block.id!==moving?.id);
  const oldAnchor=moving?.anchor||"end";
  const oldIndex=activePage.blocks.filter(x=>(x.anchor||"end")===oldAnchor).findIndex(x=>x.id===moving?.id);
  const targetIndex=moving&&oldAnchor===anchor&&oldIndex>=0&&oldIndex<index?index-1:index;
  const matching=items.map((block,i)=>(block.anchor||"end")===anchor?i:-1).filter(i=>i>=0);
  const insertion=matching.length?targetIndex>=matching.length?matching[matching.length-1]+1:matching[Math.max(0,targetIndex)]:items.length;
  const positioned=added.map(block=>({...block,anchor}));
  items.splice(insertion,0,...positioned);
  patchPage({blocks:items});
  setSelected(positioned[0].id);setSelectedObject(null);setInspector("block");setPanelOpen(true);
 };
 useEffect(()=>{
  const choose=(event:MessageEvent)=>{
   if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow)return;
   if(event.data?.type==="lektrus:site-select-block"&&typeof event.data.id==="string"){
    setSelected(event.data.id);setSelectedObject(null);setInspector("block");setPanelOpen(true);
   }
   if(event.data?.type==="lektrus:site-select-page"){setSelected(null);setSelectedObject(null);setInspector("page");setPanelOpen(true)}
   if(event.data?.type==="lektrus:site-select-object"){
    const info=event.data.info as SiteObjectInfo|undefined;
    if(info&&typeof info.id==="string"&&/^(?:global|[a-z][a-z0-9-]{0,39}):[a-z0-9_/.-]{1,180}$/.test(info.id)){
     setSelectedObject(info.id);setObjectMeta(info);setSelected(null);setInspector("object");setPanelOpen(true);
    }
   }
   if(event.data?.type==="lektrus:site-object-list"&&event.data.page===active&&Array.isArray(event.data.objects)){
    setObjectList((event.data.objects as SiteObjectInfo[]).filter(item=>item&&typeof item.id==="string").slice(0,700));
   }
   if(event.data?.type==="lektrus:site-canvas-drop"&&event.data.page===active){
    const transfer=decodeSiteCanvasTransfer(JSON.stringify(event.data.transfer));
    const anchor=event.data.anchor,index=event.data.index;
    if(transfer&&typeof anchor==="string"&&Number.isInteger(index)&&index>=0&&index<=40)insertCanvasTransfer(transfer,anchor,index);
   }
   if(event.data?.type==="lektrus:site-navigate"&&typeof event.data.page==="string"&&doc.navigation.some(item=>item.id===event.data.page)){
    setActive(event.data.page);setSelected(null);setSelectedObject(null);setInspector("page");
   }
   if(event.data?.type==="lektrus:site-preview-link"&&typeof event.data.href==="string"){
    setNotice("Это ссылка на другую страницу: "+event.data.href.slice(0,120)+". Переход отключён в предпросмотре.");
   }
  };
  window.addEventListener("message",choose);
  return ()=>window.removeEventListener("message",choose);
 },[doc,active]);

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
 const moveBlockTo=(source:string,target:string)=>{
  if(source===target)return;
  const blocks=activePage.blocks.slice(),i=blocks.findIndex(x=>x.id===source),j=blocks.findIndex(x=>x.id===target);
  if(i<0||j<0)return;
  const [item]=blocks.splice(i,1);
  blocks.splice(j,0,item);patchPage({blocks});
 };
 const addSectionKit=(id:string)=>{
  const kit=SITE_SECTION_PRESETS.find(item=>item.id===id);
  if(!kit)return;
  const blocks=kit.create();
  if(activePage.blocks.length+blocks.length>40){setNotice("На одной странице максимум 40 блоков.");return}
  patchPage({blocks:[...activePage.blocks,...blocks]});
  setSelected(blocks[0].id);setInspector("block");setPanelOpen(true);
 };
 const duplicateBlock=()=>{
  if(!activeBlock||activePage.blocks.length>=40)return;
  const copy={...structuredClone(activeBlock),id:crypto.randomUUID()};
  const blocks=activePage.blocks.slice();
  blocks.splice(blocks.findIndex(x=>x.id===selected)+1,0,copy);
  patchPage({blocks});setSelected(copy.id);
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
 const duplicatePage=()=>{
  if(doc.customPages.length>=18){setNotice("Достигнут лимит: 18 дополнительных страниц.");return}
  const id="page-"+crypto.randomUUID().slice(0,8);
  const title=(activePage.title+" · копия").slice(0,54);
  const originalBuiltin=builtin.has(active)&&!activePage.replaceDefault;
  const sourceBlocks=activePage.blocks.length?activePage.blocks:originalBuiltin?SITE_SECTION_PRESETS[0].create():[];
  change(next=>{
   next.customPages.push({...structuredClone(activePage),id,title,heading:activePage.heading||title,
    lead:activePage.lead||"Настройте описание этого раздела.",replaceDefault:false,
    blocks:sourceBlocks.map(block=>({...structuredClone(block),id:crypto.randomUUID()}))});
   next.navigation.push({id,title,hidden:false});
  });
  setActive(id);setSelected(null);setInspector("page");setPanelOpen(true);
  if(originalBuiltin)setNotice("Создана независимая страница с редактируемыми блоками. Уникальный исходный макет этой вкладки остался без изменений.");
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
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{
   if(access!=="allowed")return;
   const tag=event.target instanceof HTMLElement?event.target:null;
   if(event.key==="Escape"){setFocusMode(false);setPanelOpen(false);return}
   const cmd=event.ctrlKey||event.metaKey;
   if(!cmd)return;
   if(event.key.toLowerCase()==="s"){event.preventDefault();saveSiteDraft(doc);setNotice("Черновик сохранён в этом браузере.");return}
   if(tag?.closest("input,textarea,select,[contenteditable=true]"))return;
   if(event.key.toLowerCase()==="z"){event.preventDefault();history(event.shiftKey?"redo":"undo")}
   if(event.key.toLowerCase()==="y"){event.preventDefault();history("redo")}
  };
  window.addEventListener("keydown",onKey);
  return ()=>window.removeEventListener("keydown",onKey);
 },[doc,access]);
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
 return <div className={"site-builder"+(focusMode?" is-focus":"")}>
  <header className="site-builder-top">
   <a className="site-builder-back" href="/app">← Lektrus</a>
   <div className="site-builder-heading"><span className="site-builder-studio-label">LEKTRUS / DESIGN STUDIO</span><strong>Конструктор сайта</strong><small><span className={"site-builder-status-dot"+(saved==="published"?" published":"")}/>{saved==="published"?"Опубликовано":"Черновик сохраняется автоматически"}</small></div>
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
     <input className="site-builder-page-search" aria-label="Найти страницу" placeholder="⌕  Найти страницу..." value={pageSearch} onChange={e=>setPageSearch(e.target.value)}/>
     <nav className="site-builder-page-list" aria-label="Страницы сайта">{doc.navigation.filter(item=>item.title.toLowerCase().includes(pageSearch.trim().toLowerCase())).map(item=><div key={item.id} draggable onDragStart={()=>{drag.current=item.id}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(drag.current)moveNav(drag.current,item.id);drag.current=null}}>
      <button type="button" className={active===item.id?"selected":""} onClick={()=>{setActive(item.id);setSelected(null);setSelectedObject(null);setInspector("page")}}><span className="site-builder-handle">⠿</span><span>{item.title}</span>{item.hidden&&<span title="Скрыта">◌</span>}</button>
      <button type="button" title={item.hidden?"Показать вкладку":"Скрыть вкладку"} disabled={item.id==="home"} onClick={()=>change(next=>{next.navigation=next.navigation.map(x=>x.id===item.id?{...x,hidden:!x.hidden}:x)})}>{item.hidden?"◉":"◌"}</button>
     </div>)}</nav>
     <form className="site-builder-add-page" onSubmit={e=>{e.preventDefault();addPage()}}><input aria-label="Название новой страницы" placeholder="Новая страница…" value={newTitle} onChange={e=>setNewTitle(e.target.value)}/><button type="submit" disabled={doc.customPages.length>=18}>+</button></form>
    </section>
    <section><h2>Блоки страницы <span>{activePage.blocks.length}</span></h2><p>Зажми блок или готовую секцию и перетащи на сайт, в подсвеченное место. Обычный клик добавляет в конец.</p>
     <div className="site-builder-block-list">{activePage.blocks.map((block,i)=><div key={block.id} className={selected===block.id?"selected":""} draggable
       onDragStart={event=>{blockDrag.current=block.id;putSiteCanvasTransfer(event,{type:"move",id:block.id})}}
       onDragOver={e=>e.preventDefault()}
       onDrop={e=>{e.preventDefault();if(blockDrag.current)moveBlockTo(blockDrag.current,block.id);blockDrag.current=null}}
       onDragEnd={()=>{blockDrag.current=null}}>
      <button type="button" onClick={()=>{setSelected(block.id);setSelectedObject(null);setInspector("block")}}>{labelFor(block.kind)} <small>{block.title}</small></button>
      <button type="button" disabled={i===0} title="Выше" onClick={()=>moveBlock(i,-1)}>↑</button>
      <button type="button" disabled={i===activePage.blocks.length-1} title="Ниже" onClick={()=>moveBlock(i,1)}>↓</button>
     </div>)}</div>
     <div className="site-builder-library-switch" role="group" aria-label="Библиотека секций">
      <button type="button" aria-pressed={libraryMode==="kits"} className={libraryMode==="kits"?"active":""} onClick={()=>setLibraryMode("kits")}>Готовые секции</button>
      <button type="button" aria-pressed={libraryMode==="blocks"} className={libraryMode==="blocks"?"active":""} onClick={()=>setLibraryMode("blocks")}>Все блоки</button>
     </div>
     {libraryMode==="blocks"?<div className="site-builder-library">{kinds.map(item=><button type="button" key={item.kind} draggable disabled={activePage.blocks.length>=40} onDragStart={event=>putSiteCanvasTransfer(event,{type:"block",kind:item.kind})} title="Перетащи в нужное место сайта или нажми для добавления в конец" onClick={()=>addBlock(item.kind)}><b>{item.icon}</b>{item.label}</button>)}</div>:
      <div className="site-builder-kits">{SITE_SECTION_PRESETS.map(kit=><button type="button" key={kit.id} draggable disabled={activePage.blocks.length>=40} onDragStart={event=>putSiteCanvasTransfer(event,{type:"kit",id:kit.id})} title="Перетащи на страницу или нажми для добавления" onClick={()=>addSectionKit(kit.id)}><span className="site-builder-kit-icon">{kit.symbol}</span><span><strong>{kit.title}</strong><small>{kit.description}</small></span><span aria-hidden="true">＋</span></button>)}</div>}
    </section>
   </aside>
   <main className="site-builder-center"><div className="site-builder-previewbar"><span><b className="site-builder-live-dot"/> Живой предпросмотр <span className="site-builder-preview-separator">/</span> {size[device].label} <span className="site-builder-preview-separator">/</span> {activePage.title}</span>
     <div className="site-builder-preview-actions"><button type="button" className={interactive?"is-active":""} aria-pressed={interactive} onClick={()=>setInteractive(v=>!v)}>{interactive?"◉ Проверить клики":"✥ Выбирать объекты"}</button><button type="button" onClick={()=>{setFocusMode(v=>!v);setPanelOpen(false)}}>{focusMode?"⊟ Вернуться в редактор":"⛶ Фокус на сайте"}</button><button type="button" onClick={()=>{setPanelOpen(v=>!v);setFocusMode(false)}} aria-expanded={panelOpen} title="Показать свойства">⚙ Свойства</button></div>
    </div>
    <div className="site-builder-stage"><iframe key={active} ref={frame} title="Предпросмотр сайта Lektrus" src={previewSrc} style={{width:size[device].width}} onLoad={()=>frame.current?.contentWindow?.postMessage({type:SITE_PREVIEW_MESSAGE,document:doc,selectedId:selected,objectId:selectedObject,interactive},window.location.origin)}/></div>
   </main>
   <aside className={"site-builder-right"+(panelOpen?" is-open":" is-collapsed")} aria-label="Настройки">
    <div className="site-builder-inspect-tabs">{(["page","block","object","design"] as Inspector[]).map((tab,i)=><button key={tab} type="button" className={inspector===tab?"active":""} onClick={()=>setInspector(tab)}>{["Страница","Блок","Объект","Дизайн"][i]}</button>)}</div>
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
      <button type="button" className="site-builder-neutral" onClick={duplicatePage}>Создать копию страницы</button>
     </>:<><button type="button" className="site-builder-neutral" onClick={duplicatePage}>Создать копию страницы</button><button type="button" className="site-builder-danger" onClick={removePage}>Удалить страницу</button></>}
    </div>}
    {inspector==="block"&&<div className="site-builder-fields"><h2>{activeBlock?labelFor(activeBlock.kind):"Выбери блок слева"}</h2>
     {activeBlock&&<><label>Заголовок<input value={activeBlock.title} onChange={e=>patchBlock({title:e.target.value})}/></label>
      {activeBlock.kind!=="divider"&&<label>Текст<textarea rows={5} value={activeBlock.text} onChange={e=>patchBlock({text:e.target.value})}/></label>}
      {activeBlock.kind==="image"&&<label>Адрес изображения<input value={activeBlock.image} placeholder="/site/board-math.png" onChange={e=>patchBlock({image:e.target.value})}/></label>}
      {activeBlock.kind==="image"&&<SiteImageChooser onChoose={url=>patchBlock({image:url})}/>}
      {["gallery","logos"].includes(activeBlock.kind)&&<SiteImageChooser onChoose={url=>{
       if(activeBlock.items.length>=12){setNotice("В одной галерее максимум 12 изображений");return}
       patchBlock({items:[...activeBlock.items,url]});
      }}/>}
      
      {["image","cta","video"].includes(activeBlock.kind)&&<label>{activeBlock.kind==="video"?"Ссылка YouTube или Vimeo":"Адрес ссылки"}<input value={activeBlock.href} placeholder={activeBlock.kind==="video"?"https://www.youtube.com/watch?v=...":"/app"} onChange={e=>patchBlock({href:e.target.value})}/></label>}
      {["gallery","cards","faq","stats","timeline","comparison","logos","checklist","button-row"].includes(activeBlock.kind)&&<label>{
       activeBlock.kind==="gallery"?"Изображения (один URL на строку)":
       activeBlock.kind==="faq"?"Вопрос | Ответ (каждая пара с новой строки)":
       activeBlock.kind==="stats"?"Число | Подпись (каждая пара с новой строки)":
        activeBlock.kind==="timeline"?"Этап | Описание (по строке)":
        activeBlock.kind==="comparison"?"Вариант | Описание (по строке)":
        activeBlock.kind==="button-row"?"Текст кнопки | Адрес ссылки":
        activeBlock.kind==="logos"?"Ссылки на логотипы (по одной на строку)":
        activeBlock.kind==="checklist"?"Пункты списка (по одному на строку)":"Карточки (каждая с новой строки)"
      }<textarea rows={8} value={activeBlock.items.join("\n")} onChange={e=>patchBlock({items:e.target.value.split("\n").slice(0,12)})}/></label>}
      {["image","cta"].includes(activeBlock.kind)&&<label>Текст кнопки<input value={activeBlock.buttonLabel} maxLength={45} onChange={e=>patchBlock({buttonLabel:e.target.value})}/></label>}
      <div className="site-builder-appearance"><h3>Оформление блока</h3>
       <label>Стиль фона<select value={activeBlock.style?.tone??DEFAULT_SITE_BLOCK_STYLE.tone} onChange={e=>patchBlock({style:{...activeBlock.style,tone:e.target.value as SiteBlockStyle["tone"]}})}><option value="plain">Прозрачный</option><option value="soft">Мягкий</option><option value="accent">Акцентный</option><option value="dark">Тёмный</option></select></label>
       <label>Выравнивание<select value={activeBlock.style?.align??"left"} onChange={e=>patchBlock({style:{...activeBlock.style,align:e.target.value as SiteBlockStyle["align"]}})}><option value="left">По левому краю</option><option value="center">По центру</option></select></label>
       <label>Отступы<select value={activeBlock.style?.spacing??"normal"} onChange={e=>patchBlock({style:{...activeBlock.style,spacing:e.target.value as SiteBlockStyle["spacing"]}})}><option value="compact">Компактные</option><option value="normal">Обычные</option><option value="airy">Просторные</option></select></label>
       {["cards","gallery","stats","logos"].includes(activeBlock.kind)&&<label>Колонки<select value={activeBlock.style?.columns??3} onChange={e=>patchBlock({style:{...activeBlock.style,columns:Number(e.target.value)}})}><option value={2}>2 колонки</option><option value={3}>3 колонки</option><option value={4}>4 колонки</option></select></label>}
       {activeBlock.kind==="image"&&<label>Положение изображения<select value={activeBlock.style?.imageSide??"left"} onChange={e=>patchBlock({style:{...activeBlock.style,imageSide:e.target.value as SiteBlockStyle["imageSide"]}})}><option value="left">Слева</option><option value="right">Справа</option></select></label>}
      </div>
      <button type="button" className="site-builder-neutral" disabled={activePage.blocks.length>=40} onClick={duplicateBlock}>Дублировать блок</button>
      <button type="button" className="site-builder-danger" onClick={deleteBlock}>Удалить блок</button></>}
    </div>}
    {inspector==="object"&&<div className="site-builder-fields site-builder-object-fields">
     <h2>Элементы сайта <span>{objectList.length}</span></h2>
     <p>Выбери любой заголовок, текст, изображение, кнопку, ссылку, карточку или секцию прямо на странице. Это работает и в стандартных макетах.</p>
     {selectedObject&&objectMeta&&<>
      <div className="site-builder-object-heading"><strong>{objectMeta.label}</strong><small>{objectMeta.id}</small></div>
      {objectMeta.canText&&<label>Текст элемента<textarea rows={4} value={activeObjectPatch?.text??objectMeta.text} onChange={e=>patchObject({text:e.target.value})}/></label>}
      {objectMeta.tag==="IMG"&&<><label>Адрес изображения<input value={activeObjectPatch?.src??objectMeta.src} onChange={e=>patchObject({src:e.target.value})}/></label>
       <label>Описание для доступности<input value={activeObjectPatch?.alt??objectMeta.alt} onChange={e=>patchObject({alt:e.target.value})}/></label>
       <SiteImageChooser onChoose={url=>patchObject({src:url})}/></>}
      {objectMeta.tag==="A"&&<label>Адрес ссылки<input value={activeObjectPatch?.href??objectMeta.href} onChange={e=>patchObject({href:e.target.value})}/></label>}
      <label className="site-builder-object-switch"><input type="checkbox" checked={activeObjectPatch?.hidden===true} onChange={e=>patchObject({hidden:e.target.checked})}/> Скрыть этот элемент</label>
      <h3 className="site-builder-subtitle">Внешний вид элемента</h3>
      <div className="site-builder-object-colors">
       <label>Текст<input aria-label="Цвет текста" type="color" value={activeObjectPatch?.style?.color??"#122238"} onChange={e=>patchObject({style:{color:e.target.value}})}/></label>
       <label>Фон<input aria-label="Цвет фона" type="color" value={activeObjectPatch?.style?.background??"#ffffff"} onChange={e=>patchObject({style:{background:e.target.value}})}/></label>
      </div>
      <label>Размер шрифта (пиксели)<input type="number" min="8" max="120" value={activeObjectPatch?.style?.fontSize??16} onChange={e=>patchObject({style:{fontSize:Number(e.target.value)}})}/></label>
      <label>Насыщенность<select value={activeObjectPatch?.style?.fontWeight??"normal"} onChange={e=>patchObject({style:{fontWeight:e.target.value}})}><option value="normal">Обычная</option><option value="medium">Средняя</option><option value="bold">Жирная</option></select></label>
      <label>Выравнивание<select value={activeObjectPatch?.style?.textAlign??"left"} onChange={e=>patchObject({style:{textAlign:e.target.value}})}><option value="left">Слева</option><option value="center">По центру</option><option value="right">Справа</option></select></label>
      <label>Внутренние отступы: {activeObjectPatch?.style?.padding??0} px<input type="range" min="0" max="100" value={activeObjectPatch?.style?.padding??0} onChange={e=>patchObject({style:{padding:Number(e.target.value)}})}/></label>
      <label>Скругление: {activeObjectPatch?.style?.radius??0} px<input type="range" min="0" max="80" value={activeObjectPatch?.style?.radius??0} onChange={e=>patchObject({style:{radius:Number(e.target.value)}})}/></label>
      <label>Ширина: {activeObjectPatch?.style?.width??100}%<input type="range" min="20" max="100" value={activeObjectPatch?.style?.width??100} onChange={e=>patchObject({style:{width:Number(e.target.value)}})}/></label>
      <label>Непрозрачность: {Math.round((activeObjectPatch?.style?.opacity??1)*100)}%<input type="range" min="10" max="100" value={Math.round((activeObjectPatch?.style?.opacity??1)*100)} onChange={e=>patchObject({style:{opacity:Number(e.target.value)/100}})}/></label>
      <button type="button" className="site-builder-neutral" onClick={resetObject}>Вернуть исходный вид объекта</button>
     </>}
     <details className="site-builder-object-tree" open={!selectedObject}>
      <summary>Список объектов страницы</summary>
      <input placeholder="Поиск объектов..." value={objectSearch} onChange={e=>setObjectSearch(e.target.value)}/>
      <div>{objectList.filter(info=>!objectSearch||[info.label,info.text,info.id].some(value=>value.toLowerCase().includes(objectSearch.toLowerCase()))).slice(0,180).map(info=><button type="button" key={info.id} className={selectedObject===info.id?"active":""} onClick={()=>{setSelectedObject(info.id);setObjectMeta(info);setSelected(null);setInspector("object");frame.current?.contentWindow?.postMessage({type:"lektrus:site-focus-object",id:info.id},window.location.origin)}}><strong>{info.label}</strong><small>{info.text||info.alt||info.id}</small>{doc.objects[info.id]?.hidden&&<span title="Скрыт">◌</span>}</button>)}</div>
     </details>
    </div>}
   {inspector==="design"&&<div className="site-builder-fields"><h2>Оформление сайта</h2><p>Цвета и размеры действуют на все вкладки. Их содержимое остаётся самостоятельным.</p>
     <h3 className="site-builder-subtitle">Готовые палитры</h3>
     <div className="site-builder-theme-presets">{SITE_THEME_PRESETS.map(preset=><button type="button" key={preset.id} onClick={()=>change(next=>{next.theme={...preset.theme}})} title={preset.note}><span className="site-builder-theme-swatches"><i style={{background:preset.theme.accent}}/><i style={{background:preset.theme.background}}/><i style={{background:preset.theme.ink}}/></span><strong>{preset.title}</strong><small>{preset.note}</small></button>)}</div>
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
