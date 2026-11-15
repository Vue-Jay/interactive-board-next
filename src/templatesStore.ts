import { isRemoteBackendEnabled,remoteRequest,remoteStorageRequest } from "./backend";
import type { DocumentData } from "./boardModel";
import { SELFHOST_BACKEND_ENABLED, selfhostRequest } from "./selfhostApi";
import { ensureBoardAssets, getAsset, putAsset } from "./assetStore";
export type BoardTemplate={id:string;ownerId:string;title:string;description:string;category:string;document:DocumentData;createdAt:string;updatedAt:string;useCount:number};
const KEY="onlinerepetitor.templates.v46";
const read=():BoardTemplate[]=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}};
const write=(x:BoardTemplate[])=>localStorage.setItem(KEY,JSON.stringify(x));
const map=(r:any):BoardTemplate=>({id:r.id,ownerId:r.owner_id,title:r.title,description:r.description||"",category:r.category||"",document:r.document,createdAt:r.created_at,updatedAt:r.updated_at,useCount:Number(r.use_count||0)});
export async function listTemplates(userId:string){if(SELFHOST_BACKEND_ENABLED)return (await selfhostRequest<any[]>("/api/v1/board-templates")).map(map);if(!isRemoteBackendEnabled())return read().filter(x=>x.ownerId===userId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));return (await remoteRequest<any[]>("/rest/v1/board_templates?select=*&order=updated_at.desc")).map(map)}
export async function createTemplate(userId:string,title:string,description:string,category:string,document:DocumentData){const t:BoardTemplate={id:crypto.randomUUID(),ownerId:userId,title:title.trim()||document.title||"Шаблон",description:description.trim(),category:category.trim(),document,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),useCount:0};if(!isRemoteBackendEnabled()){write([t,...read()]);return t}await remoteRequest("/rest/v1/board_templates",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({id:t.id,title:t.title,description:t.description,category:t.category,document:t.document})});return t}
export async function deleteTemplate(id:string){if(SELFHOST_BACKEND_ENABLED){await selfhostRequest<void>("/api/v1/board-templates/"+encodeURIComponent(id),{method:"DELETE"});return}if(!isRemoteBackendEnabled()){write(read().filter(x=>x.id!==id));return}await remoteRequest(`/rest/v1/board_templates?id=eq.${encodeURIComponent(id)}`,{method:"DELETE",headers:{Prefer:"return=minimal"}});await remoteRequest("/rest/v1/rpc/delete_template_assets",{method:"POST",body:JSON.stringify({p_template_id:id})}).catch(()=>null)}
export async function markTemplateUsed(id:string){if(SELFHOST_BACKEND_ENABLED){await selfhostRequest("/api/v1/board-templates/"+encodeURIComponent(id)+"/used",{method:"POST"});return}if(!isRemoteBackendEnabled()){write(read().map(x=>x.id===id?{...x,useCount:x.useCount+1}:x));return}await remoteRequest("/rest/v1/rpc/mark_template_used",{method:"POST",body:JSON.stringify({p_template_id:id})})}
export async function putTemplateAsset(userId:string,templateId:string,assetId:string,blob:Blob){if(!isRemoteBackendEnabled())return;await remoteStorageRequest("template-assets",`${userId}/${templateId}/${assetId}`,blob)}
export async function getTemplateAsset(userId:string,templateId:string,assetId:string){if(!isRemoteBackendEnabled())return null;return remoteStorageRequest("template-assets",`${userId}/${templateId}/${assetId}`)}

const mediaIds=(document:DocumentData)=>[...new Set(document.items.filter(i=>i.kind==="image"||i.kind==="pdf").map(i=>i.assetId).filter((id):id is string=>Boolean(id)))];
export async function savePersonalBoardTemplate(userId:string,boardId:string,title:string,description:string,category:string,document:DocumentData){
 if(SELFHOST_BACKEND_ENABLED){
  await ensureBoardAssets(boardId,document);
  return map(await selfhostRequest("/api/v1/board-templates",{method:"POST",body:JSON.stringify({board_id:boardId,title,description,category,document})}));
 }
 const template=await createTemplate(userId,title,description,category,document);
 try{
  for(const id of mediaIds(document)){
   const blob=await getAsset(id,boardId);
   if(!blob)throw new Error("Не удалось сохранить вложение шаблона.");
   if(isRemoteBackendEnabled())await putTemplateAsset(userId,template.id,id,blob);
   else await putAsset(id,blob,template.id,true);
  }
  return template;
 }catch(e){await deleteTemplate(template.id).catch(()=>{});throw e}
}
export async function copyTemplateAssets(template:BoardTemplate,boardId:string){
 if(SELFHOST_BACKEND_ENABLED){
  if(mediaIds(template.document).length)await selfhostRequest("/api/v1/board-templates/"+encodeURIComponent(template.id)+"/copy-assets",{method:"POST",body:JSON.stringify({board_id:boardId})});
  return;
 }
 for(const id of mediaIds(template.document)){
  const blob=isRemoteBackendEnabled()?await getTemplateAsset(template.ownerId,template.id,id):await getAsset(id,template.id);
  if(!blob)throw new Error("Вложение шаблона не найдено.");
  await putAsset(id,blob,boardId);
 }
}
