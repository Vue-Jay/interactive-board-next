export type AiTool="assignment"|"quiz"|"flashcards";
export type AiDifficulty="easy"|"medium"|"hard";
export type AiDraft={id:string;tool:AiTool;topic:string;subject?:string;title:string;body:string;answers?:string[];createdAt:string};
import { generateCurriculumAi, parseCurriculumRequest } from "./aiCurriculumGenerator";

const KEY="onlinerepetitor.ai.local-history.v189";
const USAGE_KEY="onlinerepetitor.ai.local-usage.v190";
const uid=()=>`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;


export type AiUsage={month:string;used:number};
const currentMonth=()=>new Date().toISOString().slice(0,7);
export function getAiUsage():AiUsage{
 try{
  const x=JSON.parse(localStorage.getItem(USAGE_KEY)||"{}") as Partial<AiUsage>;
  return x.month===currentMonth()?{month:x.month,used:Math.max(0,Number(x.used)||0)}:{month:currentMonth(),used:0};
 }catch{return {month:currentMonth(),used:0}}
}
/** Records local generation for the user's history without enforcing paid API quotas. */
export function recordLocalAiGeneration(){
 const usage=getAiUsage();
 const next={month:currentMonth(),used:usage.used+1};
 localStorage.setItem(USAGE_KEY,JSON.stringify(next));
 window.dispatchEvent(new Event("onlinerepetitor:ai-usage"));
 return next;
}
export function listAiDrafts():AiDraft[]{
 try{return JSON.parse(localStorage.getItem(KEY)||"[]") as AiDraft[]}catch{return[]}
}
function remember(draft:AiDraft){
 const next=[draft,...listAiDrafts()].slice(0,20);
 localStorage.setItem(KEY,JSON.stringify(next));
 window.dispatchEvent(new Event("onlinerepetitor:ai-history"));
}
export function clearAiDrafts(){localStorage.removeItem(KEY);window.dispatchEvent(new Event("onlinerepetitor:ai-history"))}

export async function generateLocalAiDraft(tool:AiTool,topic:string,difficulty:AiDifficulty,count:number,subject=""):Promise<AiDraft>{
 const request=parseCurriculumRequest(topic,subject,count,difficulty,tool);
 const clean=request.topic;
 if(clean.length<2)throw new Error("Укажите тему.");
 await new Promise(r=>setTimeout(r,450));
 const generated=generateCurriculumAi(request.tool,topic,request.level,request.count,request.subject);
 const draft={id:uid(),tool:request.tool,topic:clean,subject:generated.subject,title:generated.title,body:generated.items.join("\n\n"),answers:generated.answers,createdAt:new Date().toISOString()};
 remember(draft);return draft;
}

export type AiBoardTransfer={draft:AiDraft;queuedAt:string};
const BOARD_TRANSFER_KEY="onlinerepetitor.ai.board-transfer.v191";
export function queueAiDraftForBoard(draft:AiDraft){
 const payload:AiBoardTransfer={draft,queuedAt:new Date().toISOString()};
 localStorage.setItem(BOARD_TRANSFER_KEY,JSON.stringify(payload));
 window.dispatchEvent(new Event("onlinerepetitor:ai-board-transfer"));
 return payload;
}
export function peekAiBoardTransfer():AiBoardTransfer|null{
 try{return JSON.parse(localStorage.getItem(BOARD_TRANSFER_KEY)||"null") as AiBoardTransfer|null}catch{return null}
}
export function clearAiBoardTransfer(){localStorage.removeItem(BOARD_TRANSFER_KEY)}
