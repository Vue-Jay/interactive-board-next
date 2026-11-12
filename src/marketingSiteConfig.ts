import {isRemoteBackendEnabled,remoteRequest} from "./backend";

export const SITE_DRAFT_KEY="lektrus.marketing-site.draft.v1";
export const SITE_PREVIEW_MESSAGE="lektrus:marketing-site-preview";
export const BUILTIN_SITE_PAGES=["home","features","teachers","students","how","pricing","about","help"] as const;
export type SiteBlockKind="text"|"image"|"cards"|"gallery"|"cta"|"divider"|"faq"|"stats"|"quote";
export type SiteBlockStyle={tone:"plain"|"soft"|"accent"|"dark";align:"left"|"center";spacing:"compact"|"normal"|"airy";columns:2|3|4;imageSide:"left"|"right"};
export const DEFAULT_SITE_BLOCK_STYLE:SiteBlockStyle={tone:"plain",align:"left",spacing:"normal",columns:3,imageSide:"left"};
export type SiteBlock={id:string;kind:SiteBlockKind;title:string;text:string;image:string;href:string;items:string[];buttonLabel:string;style:SiteBlockStyle};
export type SitePage={id:string;title:string;eyebrow:string;heading:string;lead:string;replaceDefault?:boolean;blocks:SiteBlock[]};
export type SiteNavItem={id:string;title:string;hidden:boolean};
export type SiteTheme={accent:string;background:string;surface:string;ink:string;radius:number;maxWidth:number};
export type SiteDocument={version:1;theme:SiteTheme;navigation:SiteNavItem[];pages:Record<string,SitePage>;customPages:SitePage[]};
const defaults:SiteNavItem[]=[
 {id:"home",title:"Главная",hidden:false},
 {id:"features",title:"Возможности",hidden:false},
 {id:"teachers",title:"Учителям",hidden:false},
 {id:"students",title:"Ученикам",hidden:false},
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
 title:kind==="cta"?"Попробуйте Lektrus":kind==="gallery"?"Учебные инструменты":kind==="image"?"Снимок приложения":kind==="faq"?"Частые вопросы":kind==="stats"?"Цифры и факты":kind==="quote"?"Слова наших пользователей":"Новый блок",
 text:kind==="text"?"Здесь можно написать свой текст.":kind==="cta"?"Начните работу с интерактивной доской.":kind==="quote"?"Добавьте здесь реальную цитату пользователя или ваш ключевой тезис.":"",
 image:"/site/board-math.png",href:"/app",
 items:kind==="cards"?["Первое преимущество","Вторая возможность","Третий шаг"]:
 kind==="faq"?["Как начать работу? | Откройте Lektrus и создайте доску.","Что можно настроить? | Страницы, разделы, оформление и изображения."]:
 kind==="stats"?["01 | Ваш показатель","02 | Ещё один показатель","03 | Третий показатель"]:
 ["/site/board-math.png","/site/board-chemistry.png","/site/board-geometry.png"],
 buttonLabel:kind==="image"?"Подробнее":"Перейти",style:{...DEFAULT_SITE_BLOCK_STYLE}
});
export const newSitePage=(id:string,title="Новая страница"):SitePage=>({id,title,eyebrow:"LEKTRUS",heading:title,lead:"Расскажите посетителям об этом разделе.",blocks:[newSiteBlock("text")]});
export const defaultSiteDocument=():SiteDocument=>({
 version:1,theme:{...baseTheme},navigation:defaults.map(x=>({...x})),pages:{},customPages:[]
});
export const safeSiteUrl=(value:string):string=>{
 if(value.startsWith("/")&&!value.startsWith("//")&&!value.includes("\\"))return value;
 if(value.startsWith("#")&&/^#[a-z][a-z0-9-]{0,39}$/.test(value))return value;
 try{const url=new URL(value);return url.protocol==="https:"||url.protocol==="http:"?url.toString():"#"}catch{return "#"}
};
const kinds:SiteBlockKind[]=["text","image","cards","gallery","cta","divider","faq","stats","quote"];
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
   imageSide:imageSide==="right"?"right":"left"
  };
  return {id:original||crypto.randomUUID(),kind,title:clean(v.title,160),text:clean(v.text,4000),
   image:safeSiteUrl(clean(v.image,900)),href:safeSiteUrl(clean(v.href,900)),buttonLabel:clean(v.buttonLabel,45)||(kind==="image"?"Подробнее":"Перейти"),style,
   items:Array.isArray(v.items)?v.items.slice(0,12).map(x=>kind==="cards"||kind==="faq"||kind==="stats"?clean(x,420):safeSiteUrl(clean(x,900))).filter(x=>Boolean(x)&&x!=="#"):[]};
 };
 const parsePage=(value:unknown,id:string,defaultTitle=""):SitePage=>{
  const v=object(value);
  return {id,title:clean(v.title,64)||defaultTitle,eyebrow:clean(v.eyebrow,70),
   heading:clean(v.heading,180),lead:clean(v.lead,1300),replaceDefault:v.replaceDefault===true,
   blocks:Array.isArray(v.blocks)?v.blocks.slice(0,40).map(parseBlock).filter((x):x is SiteBlock=>Boolean(x)):[]};
 };
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
  nav.push({id,title:clean(item.title,54)||base.title,hidden:id==="home"?false:item.hidden===true});
 }
 for(const [id,base] of byId)if(!used.has(id))nav.push({...base});
 result.navigation=nav;
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
