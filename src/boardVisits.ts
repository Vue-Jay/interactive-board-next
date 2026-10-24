import {isRemoteBackendEnabled,remoteRequest} from "./backend";
export type BoardVisit={visit_id:string;board_id:string;user_id:string;user_name:string;board_title:string;started_at:string;left_at:string|null;duration_seconds:number;active:boolean};
const rpc=<T,>(name:string,body:unknown)=>remoteRequest<T>("/rest/v1/rpc/"+name,{method:"POST",body:JSON.stringify(body)});
export const listBoardVisits=(boardId:string,studentId?:string)=>rpc<BoardVisit[]>("list_board_visits",{p_board_id:boardId,p_student_id:studentId??null,p_limit:150});
export const listStudentVisits=(studentId:string)=>rpc<BoardVisit[]>("list_student_board_visits",{p_student_id:studentId,p_limit:100});
export function formatVisitDuration(seconds:number){
 const m=Math.max(0,Math.floor(seconds/60));
 return m>=60?`${Math.floor(m/60)} ч ${m%60} мин`:m>0?`${m} мин`:"менее минуты";
}
/** One mounted board = one session. Hidden tabs don't count toward time spent.
 * Closing the tab uses keepalive, while missed heartbeats automatically expire. */
export function trackBoardVisit(boardId:string):()=>void{
 if(!isRemoteBackendEnabled())return()=>{};
 let id=crypto.randomUUID(),closed=false,active=false;
 let chain=Promise.resolve();
 const pulse=async(action:"ping"|"leave")=>{
  const session=id;
  chain=chain.then(()=>rpc<void>("record_board_visit",{p_board_id:boardId,p_session_id:session,p_action:action})).catch(error=>{if(action==="ping")console.warn("Не удалось отметить посещение доски",error)});
  await chain;
 };
 const enter=()=>{if(closed||document.visibilityState==="hidden"||active)return;active=true;id=crypto.randomUUID();void pulse("ping")};
 const leave=()=>{if(!active)return;active=false;void pulse("leave")};
 const visibility=()=>{if(document.visibilityState==="hidden")leave();else enter()};
 const online=()=>{if(!closed&&active)void pulse("ping")};
 const timer=setInterval(()=>{if(active&&document.visibilityState==="visible")void pulse("ping")},30000);
 document.addEventListener("visibilitychange",visibility);
 window.addEventListener("pagehide",leave);
 window.addEventListener("online",online);
 enter();
 return()=>{closed=true;clearInterval(timer);document.removeEventListener("visibilitychange",visibility);window.removeEventListener("pagehide",leave);window.removeEventListener("online",online);leave()};
}
