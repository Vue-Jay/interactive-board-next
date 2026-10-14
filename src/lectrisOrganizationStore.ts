import { isRemoteBackendEnabled, remoteRequest } from "./backend";

export type LectrisOrganization={subject:string;group:string};
export type LectrisCategoryCatalog={subjects:string[];groups:string[]};
export type LectrisOrganizationData={
  organization:Record<string,LectrisOrganization>;
  catalog:LectrisCategoryCatalog;
  status:"local"|"synced"|"error";
  pending:number;
};
type PendingOperation=
  | {type:"board";boardId:string;subject:string;group:string;onlyIfAbsent?:boolean}
  | {type:"category";kind:"subject"|"group";name:string};

const orgKey=(id:string)=>"lectris.board-organization.v1."+id;
const catalogKey=(id:string)=>"lectris.categories.v1."+id;
const queueKey=(id:string)=>"lectris.organization.pending.v1."+id;
const name=(value:unknown)=>typeof value==="string"?value.trim().slice(0,80):"";
const unique=(values:unknown)=>Array.isArray(values)?
  [...new Set(values.map(name).filter(Boolean))].slice(0,100):[];
const uuid=(id:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);

export function lectrisOrganizationSyncEnabled():boolean{
  const ref=(import.meta.env.VITE_LECTRIS_ISOLATED_SUPABASE_REF as string|undefined)?.trim();
  const endpoint=(import.meta.env.VITE_SUPABASE_URL as string|undefined)?.trim();
  if(!isRemoteBackendEnabled()||!ref||!endpoint||import.meta.env.VITE_LECTRIS_ORG_SYNC!=="true")return false;
  try{
    return /^[a-z0-9-]{10,40}$/.test(ref)
      && new URL(endpoint).hostname===ref+".supabase.co";
  }catch{return false}
}

export function readLectrisLocalOrganization(userId:string):Record<string,LectrisOrganization>{
  try{
    const parsed:unknown=JSON.parse(localStorage.getItem(orgKey(userId))||"{}");
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))return {};
    const out:Record<string,LectrisOrganization>={};
    for(const [id,raw] of Object.entries(parsed)){
      if(!uuid(id)||!raw||typeof raw!=="object"||Array.isArray(raw))continue;
      const row=raw as Record<string,unknown>;
      out[id]={subject:name(row.subject),group:name(row.group)};
    }
    return out;
  }catch{return {}}
}
export function readLectrisLocalCatalog(userId:string):LectrisCategoryCatalog{
  try{
    const parsed:unknown=JSON.parse(localStorage.getItem(catalogKey(userId))||"{}");
    const row=(parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{}) as Record<string,unknown>;
    return {subjects:unique(row.subjects),groups:unique(row.groups)};
  }catch{return {subjects:[],groups:[]}}
}
function readQueue(userId:string):PendingOperation[]{
  try{
    const rows:unknown=JSON.parse(localStorage.getItem(queueKey(userId))||"[]");
    if(!Array.isArray(rows))return [];
    const valid:PendingOperation[]=[];
    for(const row of rows){
      if(!row||typeof row!=="object")continue;
      const v=row as Record<string,unknown>;
      if(v.type==="board"&&typeof v.boardId==="string"&&uuid(v.boardId))
        valid.push({type:"board",boardId:v.boardId,subject:name(v.subject),group:name(v.group),...(v.onlyIfAbsent===true?{onlyIfAbsent:true}:{})});
      if(v.type==="category"&&(v.kind==="subject"||v.kind==="group")&&name(v.name))
        valid.push({type:"category",kind:v.kind,name:name(v.name)});
    }
    return valid.slice(-500);
  }catch{return []}
}
function writeQueue(userId:string,operations:PendingOperation[]){
  localStorage.setItem(queueKey(userId),JSON.stringify(operations.slice(-500)));
}
function operationKey(op:PendingOperation){
  return op.type==="board"?"board:"+op.boardId:"category:"+op.kind+":"+op.name.toLowerCase();
}
function enqueue(userId:string,op:PendingOperation){
  const key=operationKey(op);
  writeQueue(userId,[...readQueue(userId).filter(item=>operationKey(item)!==key),op]);
}
export const pendingLectrisOrganizationCount=(userId:string)=>readQueue(userId).length;

/** Explicit, non-destructive import of legacy local labels. Existing cloud rows
    win, and only boards currently owned by this user are eligible. */
export function queueLectrisLocalImport(userId:string,ownedBoardIds:string[]):number{
  const owned=new Set(ownedBoardIds.filter(uuid));
  const current=readLectrisLocalOrganization(userId);
  const queue=readQueue(userId);
  const queuedKeys=new Set(queue.map(operationKey));
  const additions:PendingOperation[]=[];
  for(const [boardId,org] of Object.entries(current)){
    if(!owned.has(boardId)||(!org.subject&&!org.group))continue;
    const key="board:"+boardId;
    if(!queuedKeys.has(key))additions.push({type:"board",boardId,subject:org.subject,group:org.group,onlyIfAbsent:true});
  }
  const cats=readLectrisLocalCatalog(userId);
  for(const kind of ["subject","group"] as const){
    for(const value of kind==="subject"?cats.subjects:cats.groups){
      const key="category:"+kind+":"+value.toLowerCase();
      if(!queuedKeys.has(key))additions.push({type:"category",kind,name:value});
    }
  }
  if(additions.length)writeQueue(userId,[...queue,...additions]);
  return additions.length;
}

function persistOrganization(userId:string,values:Record<string,LectrisOrganization>){
  localStorage.setItem(orgKey(userId),JSON.stringify(values));
}
function persistCatalog(userId:string,catalog:LectrisCategoryCatalog){
  localStorage.setItem(catalogKey(userId),JSON.stringify(catalog));
}

export function queueLectrisBoardOrganization(userId:string,boardId:string,value:LectrisOrganization){
  if(!uuid(boardId))return;
  const normalized={subject:name(value.subject),group:name(value.group)};
  persistOrganization(userId,{...readLectrisLocalOrganization(userId),[boardId]:normalized});
  enqueue(userId,{type:"board",boardId,...normalized});
}
export function queueLectrisCategory(userId:string,kind:"subject"|"group",value:string){
  const normalized=name(value);
  if(!normalized)return;
  const current=readLectrisLocalCatalog(userId);
  const key=kind==="subject"?"subjects":"groups";
  persistCatalog(userId,{...current,[key]:unique([...current[key],normalized])});
  enqueue(userId,{type:"category",kind,name:normalized});
}

async function uploadOperation(userId:string,op:PendingOperation){
  if(op.type==="board"){
    await remoteRequest<unknown>("/rest/v1/lectris_board_organization?on_conflict=board_id",{
      method:"POST",
      headers:{Prefer:op.onlyIfAbsent?"resolution=ignore-duplicates,return=minimal":"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify({board_id:op.boardId,subject:op.subject,group_name:op.group,updated_at:new Date().toISOString()})
    });
  }else{
    await remoteRequest<unknown>("/rest/v1/lectris_categories?on_conflict=owner_id,kind,name",{
      method:"POST",
      headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},
      body:JSON.stringify({owner_id:userId,kind:op.kind,name:op.name})
    });
  }
}
let flushActive:Promise<void>|null=null;
/* A single in-flight queue prevents write races within the same browser.
   A failed request leaves all unsent operations intact for manual retry. */
export async function flushLectrisOrganization(userId:string):Promise<void>{
  if(!lectrisOrganizationSyncEnabled())return;
  if(flushActive)return flushActive;
  flushActive=(async()=>{
    const ops=readQueue(userId);
    for(const op of ops){
      await uploadOperation(userId,op);
      const queue=readQueue(userId);
      const idx=queue.findIndex(v=>operationKey(v)===operationKey(op));
      if(idx>=0&&JSON.stringify(queue[idx])===JSON.stringify(op)){
        queue.splice(idx,1);
        writeQueue(userId,queue);
      }
    }
  })().finally(()=>{flushActive=null});
  return flushActive;
}
type RemoteCategory={kind:"subject"|"group";name:string};
type RemoteBoardOrg={board_id:string;subject:string;group_name:string};
export async function loadLectrisOrganization(userId:string,boardIds:string[]):Promise<LectrisOrganizationData>{
  let organization=readLectrisLocalOrganization(userId);
  let catalog=readLectrisLocalCatalog(userId);
  if(!lectrisOrganizationSyncEnabled())return {organization,catalog,status:"local",pending:pendingLectrisOrganizationCount(userId)};
  try{
    await flushLectrisOrganization(userId);
    const categories=await remoteRequest<RemoteCategory[]>("/rest/v1/lectris_categories?select=kind,name&owner_id=eq."+encodeURIComponent(userId));
    const ids=[...new Set(boardIds.filter(uuid))];
    const remoteBoards:RemoteBoardOrg[]=[];
    for(let i=0;i<ids.length;i+=50){
      const chunk=ids.slice(i,i+50);
      const rows=await remoteRequest<RemoteBoardOrg[]>("/rest/v1/lectris_board_organization?select=board_id,subject,group_name&board_id=in.("+chunk.join(",")+")");
      remoteBoards.push(...rows);
    }
    const remaining=readQueue(userId);
    const latestLocal=readLectrisLocalOrganization(userId);
    const dirtyBoards=new Set(remaining.filter((x):x is Extract<PendingOperation,{type:"board"}>=>x.type==="board").map(x=>x.boardId));
    organization={...latestLocal};
    for(const row of remoteBoards){
      if(!dirtyBoards.has(row.board_id))organization[row.board_id]={subject:name(row.subject),group:name(row.group_name)};
    }
    const latestCatalog=readLectrisLocalCatalog(userId);
    const remoteCatalog={
      subjects:unique(categories.filter(x=>x.kind==="subject").map(x=>x.name)),
      groups:unique(categories.filter(x=>x.kind==="group").map(x=>x.name))
    };
    // Preserve pre-sync local categories so a first cloud refresh does not
    // destroy labels that still need an explicit one-time import.
    catalog={
      subjects:unique([...remoteCatalog.subjects,...latestCatalog.subjects]),
      groups:unique([...remoteCatalog.groups,...latestCatalog.groups])
    };
    persistOrganization(userId,organization);
    persistCatalog(userId,catalog);
    return {organization,catalog,status:"synced",pending:remaining.length};
  }catch{
    return {organization,catalog,status:"error",pending:pendingLectrisOrganizationCount(userId)};
  }
}
