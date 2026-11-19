import {selfhostRequest} from "./selfhostApi";

export type NewsCategory = "update" | "feature" | "announcement";
export type NewsFilter = NewsCategory | "all";
export type NewsArticle = {id:string;category:NewsCategory;title:string;summary:string;body:string;version:string;published_at:string|null;created_at?:string;updated_at?:string};
export type NewsDraft = Pick<NewsArticle,"category"|"title"|"summary"|"body"|"version"> & {published:boolean};
export const NEWS_CATEGORIES:Record<NewsCategory,string> = {update:"Обновление",feature:"Новая функция",announcement:"Анонс"};
export const EMPTY_NEWS_DRAFT:NewsDraft={category:"update",title:"",summary:"",body:"",version:"",published:false};
export const newsDate=(value:string|null)=>value?new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long",year:"numeric"}).format(new Date(value)):"";
export async function loadPublicNews(category:NewsFilter,offset:number,limit:number,signal?:AbortSignal):Promise<NewsArticle[]>{
  const query=new URLSearchParams({offset:String(offset),limit:String(limit)});
  if(category!=="all")query.set("category",category);
  // The marketing site and its public news API share the canonical origin.
  // Never attach the signed-in session or read any admin-only data here.
  const response=await fetch("/api/v1/news?"+query,{signal,cache:"no-store",credentials:"omit"});
  if(!response.ok)throw new Error("Не удалось загрузить новости.");
  const data:unknown=await response.json();
  if(!Array.isArray(data))throw new Error("Не удалось загрузить новости.");
  return data;
}
export const loadAdminNews=(offset:number,limit:number)=>selfhostRequest<NewsArticle[]>(`/api/v1/admin/news?offset=${offset}&limit=${limit}`);
export const saveAdminNews=(draft:NewsDraft,id?:string)=>selfhostRequest<NewsArticle>("/api/v1/admin/news"+(id?"/"+encodeURIComponent(id):""),{method:id?"PUT":"POST",body:JSON.stringify(draft)});
