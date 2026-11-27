import { getRealtimeSocketUrl, getRemoteSession, isRemoteBackendEnabled } from "./backend";
import { isSelfhostBackendEnabled, selfhostSubscribeBoard } from "./selfhostApi";

export type AttachmentApprovalRequest={
  requestId:string; studentId:string; studentName:string; assetId:string; name:string; mime:string;
  kind:"image"|"pdf"; width:number; height:number; sentAt:number;
};
export type AttachmentApprovalResult={requestId:string;studentId:string;approved:boolean;name:string};

export type AttachmentApprovalChannel={
  request:(payload:AttachmentApprovalRequest)=>void;
  result:(payload:AttachmentApprovalResult)=>void;
  close:()=>void;
};

export function connectAttachmentApprovalChannel(
 boardId:string,
 me:{userId:string;name:string},
 onRequest:(payload:AttachmentApprovalRequest)=>void,
 onResult:(payload:AttachmentApprovalResult)=>void,
):AttachmentApprovalChannel{
 if(isSelfhostBackendEnabled()){
  let ready=false,stopped=false;
  let retry:ReturnType<typeof setTimeout>|undefined;
  type Queued={type:"attachment_request"|"attachment_result";payload:Record<string,unknown>};
  // A periodic student retry is the same logical request, not another queue
  // entry. Keep unsuccessful transport writes until a subsequent flush.
  const queue=new Map<string,Queued>();
  const flush=()=>{
   clearTimeout(retry);retry=undefined;
   if(stopped||!ready)return;
   for(const [key,next] of queue){
    if(!channel.sendEvent({type:next.type,...next.payload})){
     retry=setTimeout(flush,500);return;
    }
    queue.delete(key);
   }
  };
  const channel=selfhostSubscribeBoard(boardId,()=>{},status=>{
   ready=status==="online";
   if(ready)flush();else{clearTimeout(retry);retry=undefined;}
  },event=>{
   if(event.type==="attachment_request"){
    onRequest({
     requestId:event.request_id,studentId:event.user_id,studentName:event.name,
     assetId:event.asset_id,name:event.attachment_name,mime:event.mime,
     kind:event.kind,width:event.width,height:event.height,sentAt:event.sent_at,
    });
   }else if(event.type==="attachment_result"&&event.target_user_id===me.userId){
    onResult({
     requestId:event.request_id,studentId:event.target_user_id,
     approved:event.approved,name:event.attachment_name,
    });
   }
  });
  const send=(type:"attachment_request"|"attachment_result",payload:Record<string,unknown>)=>{
   if(stopped)return;
   const key=type+":"+String(payload.request_id);
   queue.set(key,{type,payload});
   // The per-request application retry remains the authoritative recovery
   // path when this bounded transport queue is full.
   while(queue.size>200){const oldest=queue.keys().next().value;if(oldest===undefined)break;queue.delete(oldest)}
   if(ready)flush();
  };
  return{
   request:p=>send("attachment_request",{
    request_id:p.requestId,asset_id:p.assetId,name:p.name,mime:p.mime,
    kind:p.kind,width:p.width,height:p.height,
   }),
   result:p=>send("attachment_result",{
    request_id:p.requestId,target_user_id:p.studentId,approved:p.approved,name:p.name,
   }),
   close:()=>{stopped=true;clearTimeout(retry);queue.clear();channel()},
  };
 }
 if(!isRemoteBackendEnabled())return{request:()=>{},result:()=>{},close:()=>{}};
 const topic=`realtime:board-attachment-approval:${boardId}`;
 let socket:WebSocket|null=null,stopped=false,ready=false,seq=0,generation=0,attempt=0;
 let retry:ReturnType<typeof setTimeout>|undefined,heartbeat:ReturnType<typeof setInterval>|undefined,deadline:ReturnType<typeof setTimeout>|undefined;
 const queue:{event:string;payload:unknown}[]=[];
 const closeSocket=()=>{clearInterval(heartbeat);clearTimeout(deadline);ready=false;if(socket){socket.onopen=socket.onmessage=socket.onerror=socket.onclose=null;try{socket.close()}catch{}socket=null}};
 const reconnect=()=>{if(stopped)return;generation++;closeSocket();clearTimeout(retry);retry=setTimeout(()=>void connect(),Math.min(1000*2**attempt++,30000))};
 const sendBroadcast=(event:string,payload:unknown)=>{
   if(stopped)return;
   if(!ready||!socket||socket.readyState!==WebSocket.OPEN){queue.push({event,payload});if(queue.length>20)queue.shift();return}
   try{socket.send(JSON.stringify({topic,event:"broadcast",payload:{type:"broadcast",event,payload:{...(payload as Record<string,unknown>),senderId:me.userId,senderName:me.name}},ref:String(++seq),join_ref:null}))}catch{queue.push({event,payload});if(queue.length>20)queue.shift();reconnect()}
 };
 const flush=()=>{while(ready&&queue.length){const x=queue.shift()!;sendBroadcast(x.event,x.payload)}};
 const connect=async()=>{
  if(stopped)return;
  const current=++generation;
  try{
   const session=await getRemoteSession();if(stopped||current!==generation)return;if(!session){reconnect();return}
   const ws=new WebSocket(getRealtimeSocketUrl());socket=ws;const joinRef=String(++seq);
   const active=()=>!stopped&&current===generation&&socket===ws;
   deadline=setTimeout(()=>{if(active()&&!ready)reconnect()},15000);
   ws.onopen=()=>{if(!active())return;try{ws.send(JSON.stringify({topic,event:"phx_join",payload:{access_token:session.access_token,config:{private:false,broadcast:{self:false,ack:false},presence:{enabled:false}}},ref:joinRef,join_ref:joinRef}))}catch{reconnect();return}heartbeat=setInterval(()=>{if(active()&&ws.readyState===WebSocket.OPEN){try{ws.send(JSON.stringify({topic:"phoenix",event:"heartbeat",payload:{},ref:String(++seq),join_ref:null}))}catch{reconnect()}}},25000)};
   ws.onmessage=e=>{if(!active())return;try{const m=JSON.parse(String(e.data));if(m.topic!==topic)return;if(m.event==="phx_reply"&&m.ref===joinRef){if(m.payload?.status!=="ok"){reconnect();return}clearTimeout(deadline);attempt=0;ready=true;flush();return}if(m.event==="phx_error"||m.event==="phx_close"){reconnect();return}if(m.event!=="broadcast")return;const payload=m.payload?.payload??{};if(payload.senderId===me.userId)return;if(m.payload?.event==="attachment_request")onRequest(payload as AttachmentApprovalRequest);if(m.payload?.event==="attachment_result")onResult(payload as AttachmentApprovalResult)}catch{}};
   ws.onerror=ws.onclose=()=>{if(active())reconnect()};
  }catch{reconnect()}
 };
 const networkChanged=()=>{if(navigator.onLine)reconnect();else closeSocket()};
 window.addEventListener("online",networkChanged);window.addEventListener("offline",networkChanged);
 void connect();
 return{
  request:p=>sendBroadcast("attachment_request",p),
  result:p=>sendBroadcast("attachment_result",p),
  close:()=>{stopped=true;generation++;clearTimeout(retry);closeSocket();window.removeEventListener("online",networkChanged);window.removeEventListener("offline",networkChanged)}
 };
}
