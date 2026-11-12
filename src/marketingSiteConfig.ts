import {isRemoteBackendEnabled,remoteRequest} from "./backend";

export const SITE_DRAFT_KEY="lektrus.marketing-site.draft.v1";
export const SITE_PREVIEW_MESSAGE="lektrus:marketing-site-preview";
export const BUILTIN_SITE_PAGES=["home","features","tools","teachers","students","how","pricing","about","help"] as const;
export type SiteBlockKind="text"|"image"|"cards"|"gallery"|"cta"|"divider"|"faq"|"stats"|"quote"|"video"|"timeline"|"comparison"|"logos"|"spacer"|"checklist"|"button-row";
export type SiteBlockStyle={tone:"plain"|"soft"|"accent"|"dark";align:"left"|"center";spacing:"compact"|"normal"|"airy";columns:2|3|4;imageSide:"left"|"right";width?:number;minHeight?:number};
export const DEFAULT_SITE_BLOCK_STYLE:SiteBlockStyle={tone:"plain",align:"left",spacing:"normal",columns:3,imageSide:"left"};
export type SiteBlock={id:string;kind:SiteBlockKind;title:string;text:string;image:string;href:string;items:string[];buttonLabel:string;style:SiteBlockStyle;anchor?:string};
export type SiteObjectStyle={color?:string;background?:string;fontSize?:number;fontWeight?:"normal"|"medium"|"bold";textAlign?:"left"|"center"|"right";padding?:number;radius?:number;opacity?:number;width?:number};
export type SiteObjectPatch={text?:string;src?:string;alt?:string;href?:string;hidden?:boolean;style?:SiteObjectStyle};
export type SitePage={id:string;title:string;eyebrow:string;heading:string;lead:string;replaceDefault?:boolean;blocks:SiteBlock[]};
export type SiteNavItem={id:string;title:string;hidden:boolean};
export type SiteTheme={accent:string;background:string;surface:string;ink:string;radius:number;maxWidth:number};
export type SiteShowcaseShot={scene:string;subject:string;src:string};
export const DEFAULT_SITE_SHOWCASE:SiteShowcaseShot[]=[
 {scene:"home",subject:"Рабочее пространство",src:"/site/app-home.png"},
 {scene:"math",subject:"Математика",src:"/site/board-math.png"},
 {scene:"chemistry",subject:"Химия",src:"/site/board-chemistry.png"},
 {scene:"geometry",subject:"Геометрия",src:"/site/board-geometry.png"},
 {scene:"physics",subject:"Физика",src:"/site/board-physics.png"},
 {scene:"contour",subject:"География",src:"/site/board-contour.png"},
 {scene:"history",subject:"История",src:"/site/board-history.png"},
 {scene:"russian",subject:"Русский язык",src:"/site/board-russian.png"}
];
export type SiteDocument={version:1;theme:SiteTheme;navigation:SiteNavItem[];pages:Record<string,SitePage>;customPages:SitePage[];objects:Record<string,SiteObjectPatch>;showcase:SiteShowcaseShot[]};
const defaults:SiteNavItem[]=[
 {id:"home",title:"Главная",hidden:false},
 {id:"features",title:"Возможности",hidden:false},
 {id:"tools",title:"Инструменты",hidden:false},
 {id:"teachers",title:"Учителям",hidden:true},
 {id:"students",title:"Ученикам",hidden:true},
 {id:"how",title:"Как это работает",hidden:false},
 {id:"pricing",title:"Тарифы",hidden:false},
 {id:"about",title:"О Lektrus",hidden:false},
 {id:"help",title:"Помощь и контакты",hidden:false}
];
const baseTheme:SiteTheme={accent:"#2563eb",background:"#f8fafc",surface:"#ffffff",ink:"#122238",radius:18,maxWidth:1200};
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
const clean=(v:unknown,max=240)=>typeof v==="string"?v.slice(0,max):"";
const color=(v:unknown,fallback:string)=>typeof v==="string"&&/^#[0-9a-fA-F]{6}$/.test(v)?v:fallback;
const int=(v:unknown,min:number,max:number,fallback:number)=>typeof v==="number"&&Number.isFinite(v)?Math.round(Math.min(max,Math.max(min,v))):fallback;
const slug=(v:unknown)=>typeof v==="string"&&/^[a-z][a-z0-9-]{0,39}$/.test(v)?v:"";
export const newSiteBlock=(kind:SiteBlockKind="text"):SiteBlock=>({
 id:crypto.randomUUID(),kind,
 title:kind==="cta"?"Попробуйте Lektrus":kind==="gallery"?"Учебные инструменты":kind==="image"?"Снимок приложения":kind==="faq"?"Частые вопросы":kind==="stats"?"Цифры и факты":kind==="quote"?"Слова наших пользователей":kind==="video"?"Видео о проекте":kind==="timeline"?"Наш путь":kind==="comparison"?"Сравните возможности":kind==="logos"?"Нам доверяют":kind==="checklist"?"Что вы получаете":kind==="button-row"?"Полезные ссылки":"Новый блок",
 text:kind==="text"?"Здесь можно написать свой текст.":kind==="cta"?"Начните работу с интерактивной доской.":kind==="quote"?"Добавьте здесь реальную цитату пользователя или ваш ключевой тезис.":"",
 image:"/site/board-math.png",href:"/app",
 items:kind==="cards"?["Первое преимущество","Вторая возможность","Третий шаг"]:
 kind==="faq"?["Как начать работу? | Откройте Lektrus и создайте доску.","Что можно настроить? | Страницы, разделы, оформление и изображения."]:
 kind==="stats"?["01 | Ваш показатель","02 | Ещё один показатель","03 | Третий показатель"]:
 kind==="timeline"?["Первый этап | Расскажите, с чего всё началось","Следующий шаг | Что изменилось","Сегодня | К чему вы пришли"]:
 kind==="comparison"?["Первый вариант | Главное преимущество","Второй вариант | Другой подход"]:
 kind==="checklist"?["Простой старт","Удобная настройка","Гибкая работа"]:
 kind==="button-row"?["Открыть Lektrus | /app","Попробовать доску | /demo/board?scene=math"]:
 kind==="logos"?["/lektrus-icon-192.png"]:
 ["/site/board-math.png","/site/board-chemistry.png","/site/board-geometry.png"],
 buttonLabel:kind==="image"?"Подробнее":"Перейти",style:{...DEFAULT_SITE_BLOCK_STYLE},anchor:"end"
});
export const newSitePage=(id:string,title="Новая страница"):SitePage=>({id,title,eyebrow:"LEKTRUS",heading:title,lead:"Расскажите посетителям об этом разделе.",blocks:[newSiteBlock("text")]});
export const defaultSiteDocument=():SiteDocument=>({
 version:1,theme:{...baseTheme},navigation:defaults.map(x=>({...x})),pages:{},customPages:[],objects:{},showcase:DEFAULT_SITE_SHOWCASE.map(x=>({...x}))
});
export const safeSiteUrl=(value:string):string=>{
 if(value.startsWith("/")&&!value.startsWith("//")&&!value.includes("\\"))return value;
 if(value.startsWith("#")&&/^#[a-z][a-z0-9-]{0,39}$/.test(value))return value;
 try{const url=new URL(value);return url.protocol==="https:"||url.protocol==="http:"?url.toString():"#"}catch{return "#"}
};
const kinds:SiteBlockKind[]=["text","image","cards","gallery","cta","divider","faq","stats","quote","video","timeline","comparison","logos","spacer","checklist","button-row"];
export function normalizeSiteDocument(raw:unknown):SiteDocument{
 const data=object(raw),result=defaultSiteDocument(),t=object(data.theme);
 result.theme={
  accent:color(t.accent,baseTheme.accent),background:color(t.background,baseTheme.background),
  surface:color(t.surface,baseTheme.surface),ink:color(t.ink,baseTheme.ink),
  radius:int(t.radius,0,40,baseTheme.radius),maxWidth:int(t.maxWidth,850,1500,baseTheme.maxWidth)
 };
 const parseBlock=(value:unknown):SiteBlock|null=>{
  const v=object(value),kind=kinds.includes(v.kind as SiteBlockKind)?v.kind as SiteBlockKind:null;
  if(!kind)return null;
  const original=clean(v.id,100),appearance=object(v.style);
  const tone=appearance.tone;
  const align=appearance.align;
  const spacing=appearance.spacing;
  const imageSide=appearance.imageSide;
  const style:SiteBlockStyle={
   tone:tone==="soft"||tone==="accent"||tone==="dark"?tone:"plain",
   align:align==="center"?"center":"left",
   spacing:spacing==="compact"||spacing==="airy"?spacing:"normal",
   columns:int(appearance.columns,2,4,3) as 2|3|4,
   imageSide:imageSide==="right"?"right":"left",
   ...(typeof appearance.width==="number"&&Number.isFinite(appearance.width)?{width:int(appearance.width,35,100,100)}:{}),
   ...(typeof appearance.minHeight==="number"&&Number.isFinite(appearance.minHeight)?{minHeight:int(appearance.minHeight,0,1200,0)}:{})
  };
  return {id:original||crypto.randomUUID(),kind,title:clean(v.title,160),text:clean(v.text,4000),
   image:safeSiteUrl(clean(v.image,900)),href:safeSiteUrl(clean(v.href,900)),buttonLabel:clean(v.buttonLabel,45)||(kind==="image"?"Подробнее":"Перейти"),style,
   anchor:typeof v.anchor==="string"&&/^(?:end|before-(?:[0-9]|[12][0-9]))$/.test(v.anchor)?v.anchor:"end",
   items:Array.isArray(v.items)?v.items.slice(0,12).map(x=>kind==="cards"||kind==="faq"||kind==="stats"||kind==="timeline"||kind==="comparison"||kind==="checklist"||kind==="button-row"?clean(x,420):safeSiteUrl(clean(x,900))).filter(x=>Boolean(x)&&x!=="#"):[]};
 };
 const parsePage=(value:unknown,id:string,defaultTitle=""):SitePage=>{
  const v=object(value);
  return {id,title:clean(v.title,64)||defaultTitle,eyebrow:clean(v.eyebrow,70),
   heading:clean(v.heading,180),lead:clean(v.lead,1300),replaceDefault:v.replaceDefault===true,
   blocks:Array.isArray(v.blocks)?v.blocks.slice(0,40).map(parseBlock).filter((x):x is SiteBlock=>Boolean(x)):[]};
 };
 // Legacy published sites automatically receive the original eight real captures.
 // All screenshots live in one homepage showcase, with admin-editable source/order.
 if(Array.isArray(data.showcase)){
  const chosen:SiteShowcaseShot[]=[];
  const seen=new Set<string>();
  for(const candidate of data.showcase.slice(0,12)){
   const entry=object(candidate);
   const src=safeSiteUrl(clean(entry.src,900));
   if(src==="#"||seen.has(src))continue;
   seen.add(src);
   chosen.push({scene:slug(entry.scene)||"home",subject:clean(entry.subject,70)||"Lektrus",src});
  }
  if(chosen.length)result.showcase=chosen;
 }
 const rawPages=object(data.pages);
 for(const entry of defaults)if(rawPages[entry.id])result.pages[entry.id]=parsePage(rawPages[entry.id],entry.id,entry.title);
 const known=new Set<string>(defaults.map(item=>item.id));
 if(Array.isArray(data.customPages))for(const value of data.customPages.slice(0,18)){
  const id=slug(object(value).id);
  if(!id||known.has(id))continue;
  known.add(id);
  result.customPages.push(parsePage(value,id,"Новая страница"));
 }
 const byId=new Map(defaults.map(x=>[x.id,x]));
 for(const page of result.customPages)byId.set(page.id,{id:page.id,title:page.title,hidden:false});
 const used=new Set<string>();
 const nav:Array<SiteNavItem>=[];
 if(Array.isArray(data.navigation))for(const rawItem of data.navigation){
  const item=object(rawItem),id=slug(item.id),base=byId.get(id);
  if(!base||used.has(id))continue;
  used.add(id);
  nav.push({id,title:clean(item.title,54)||base.title,hidden:id==="home"?false:id==="teachers"||id==="students"?true:item.hidden===true});
 }
 for(const [id,base] of byId)if(!used.has(id)){
  if(id==="tools"){
   // Add the newly introduced tab next to Features in existing published documents
   // without disturbing a deliberately customized navigation order.
   const index=nav.findIndex(item=>item.id==="features");
   nav.splice(index>=0?index+1:nav.length,0,{...base});
  }else nav.push({...base});
 }
 result.navigation=nav;
 const rawObjects=object(data.objects),keys=Object.keys(rawObjects).slice(0,1000);
 for(const key of keys){
  if(!/^(?:global|[a-z][a-z0-9-]{0,39}):[a-z0-9_/.-]{1,180}$/.test(key))continue;
  const patch=object(rawObjects[key]),appearance=object(patch.style);
  const normalized:SiteObjectPatch={};
  if("text" in patch)normalized.text=clean(patch.text,2000);
  if("src" in patch)normalized.src=safeSiteUrl(clean(patch.src,900));
  if("alt" in patch)normalized.alt=clean(patch.alt,200);
  if("href" in patch)normalized.href=safeSiteUrl(clean(patch.href,900));
  if(patch.hidden===true)normalized.hidden=true;
  const st:SiteObjectStyle={};
  if(appearance.color)st.color=color(appearance.color,"#122238");
  if(appearance.background)st.background=color(appearance.background,"#ffffff");
  if(appearance.fontSize!==undefined)st.fontSize=int(appearance.fontSize,8,120,16);
  if(appearance.padding!==undefined)st.padding=int(appearance.padding,0,100,0);
  if(appearance.radius!==undefined)st.radius=int(appearance.radius,0,80,0);
  if(appearance.opacity!==undefined&&typeof appearance.opacity==="number"&&Number.isFinite(appearance.opacity))st.opacity=Math.max(0.1,Math.min(1,appearance.opacity));
  if(appearance.width!==undefined)st.width=int(appearance.width,20,100,100);
  if(["normal","medium","bold"].includes(String(appearance.fontWeight)))st.fontWeight=appearance.fontWeight as SiteObjectStyle["fontWeight"];
  if(["left","center","right"].includes(String(appearance.textAlign)))st.textAlign=appearance.textAlign as SiteObjectStyle["textAlign"];
  if(Object.keys(st).length)normalized.style=st;
  if(Object.keys(normalized).length)result.objects[key]=normalized;
 }
 return result;
}
export const siteDraft=():SiteDocument=>{
 try{return normalizeSiteDocument(JSON.parse(localStorage.getItem(SITE_DRAFT_KEY)||"null"))}
 catch{return defaultSiteDocument()}
};
export function saveSiteDraft(doc:SiteDocument){localStorage.setItem(SITE_DRAFT_KEY,JSON.stringify(normalizeSiteDocument(doc)))}
const endpoint=String(import.meta.env.VITE_SUPABASE_URL||"").replace(/\/$/,"");
const key=String(import.meta.env.VITE_SUPABASE_ANON_KEY||"");
export async function loadPublishedSiteDocument():Promise<SiteDocument|null>{
 if(!endpoint||!key)return null;
 const response=await fetch(endpoint+"/rest/v1/marketing_site_settings?setting_key=eq.default&select=document&limit=1",{
  headers:{apikey:key,Accept:"application/json"} // anonymous site reads use the public API key, never a fake user JWT
 });
 if(!response.ok)throw new Error("Не удалось получить опубликованный дизайн сайта ("+response.status+").");
 const rows=await response.json() as Array<{document:unknown}>;
 return rows[0]?.document?normalizeSiteDocument(rows[0].document):null;
}
export async function publishSiteDocument(doc:SiteDocument):Promise<void>{
 if(!isRemoteBackendEnabled())throw new Error("Сервер не подключён. Черновик можно экспортировать, но не публиковать.");
 await remoteRequest("/rest/v1/rpc/admin_publish_marketing_site",{
  method:"POST",body:JSON.stringify({p_document:normalizeSiteDocument(doc)})
 });
}
