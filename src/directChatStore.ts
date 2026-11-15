import { isRemoteBackendEnabled, remoteRequest } from "./backend";
import { SELFHOST_BACKEND_ENABLED,selfhostDirectChats,selfhostDirectContacts,selfhostEnsureDirectChat,selfhostDirectMessages,selfhostSendDirectMessage,selfhostMarkDirectChatRead,selfhostDirectReadState,selfhostEditDirectMessage,selfhostDeleteDirectMessage } from "./selfhostApi";

export type DirectChatConversation={
  id:string;other_user_id:string;other_name:string;other_email:string|null;
  last_message:string|null;last_message_at:string|null;unread_count:number;
};
export type DirectChatContact={user_id:string;display_name:string;email:string|null};
export type DirectChatMessage={id:string;conversation_id:string;sender_id:string;sender_name:string;body:string;created_at:string;edited_at:string|null;deleted_at:string|null};
export type DirectChatReadState={other_last_read_at:string|null};

export async function listDirectChats():Promise<DirectChatConversation[]>{
  if(SELFHOST_BACKEND_ENABLED)return selfhostDirectChats();
  if(!isRemoteBackendEnabled())return [];
  return remoteRequest<DirectChatConversation[]>("/rest/v1/rpc/list_direct_chats",{method:"POST",body:"{}"});
}
export async function listDirectChatContacts():Promise<DirectChatContact[]>{
  if(SELFHOST_BACKEND_ENABLED)return selfhostDirectContacts();
  if(!isRemoteBackendEnabled())return [];
  return remoteRequest<DirectChatContact[]>("/rest/v1/rpc/list_direct_chat_contacts",{method:"POST",body:"{}"});
}
export async function ensureDirectChat(otherUserId:string):Promise<string>{
  if(SELFHOST_BACKEND_ENABLED)return (await selfhostEnsureDirectChat(otherUserId)).id;
  return remoteRequest<string>("/rest/v1/rpc/ensure_direct_chat",{method:"POST",body:JSON.stringify({p_other_user_id:otherUserId})});
}
export async function listDirectMessages(conversationId:string):Promise<DirectChatMessage[]>{
  if(SELFHOST_BACKEND_ENABLED)return selfhostDirectMessages(conversationId);
  return remoteRequest<DirectChatMessage[]>(`/rest/v1/direct_chat_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&select=id,conversation_id,sender_id,sender_name,body,created_at,edited_at,deleted_at&order=created_at.asc&limit=500`);
}
export async function sendDirectMessage(conversationId:string,body:string):Promise<void>{
  const text=body.trim(); if(!text)return;
  if(SELFHOST_BACKEND_ENABLED){await selfhostSendDirectMessage(conversationId,text);return}
  await remoteRequest("/rest/v1/direct_chat_messages",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({conversation_id:conversationId,body:text})});
}
export async function editDirectMessage(messageId:string,body:string):Promise<void>{
  const text=body.trim(); if(!text)throw new Error("Сообщение не может быть пустым");
  if(SELFHOST_BACKEND_ENABLED){await selfhostEditDirectMessage(messageId,text);return}
  await remoteRequest(`/rest/v1/direct_chat_messages?id=eq.${encodeURIComponent(messageId)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({body:text,edited_at:new Date().toISOString()})});
}
export async function deleteDirectMessage(messageId:string):Promise<void>{
  if(SELFHOST_BACKEND_ENABLED){await selfhostDeleteDirectMessage(messageId);return}
  await remoteRequest(`/rest/v1/direct_chat_messages?id=eq.${encodeURIComponent(messageId)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({body:"Сообщение удалено",deleted_at:new Date().toISOString(),edited_at:null})});
}
export async function markDirectChatRead(conversationId:string):Promise<void>{
  if(SELFHOST_BACKEND_ENABLED){await selfhostMarkDirectChatRead(conversationId);return}
  await remoteRequest("/rest/v1/rpc/mark_direct_chat_read",{method:"POST",body:JSON.stringify({p_conversation_id:conversationId})});
}
export async function getDirectChatReadState(conversationId:string):Promise<DirectChatReadState>{
  if(SELFHOST_BACKEND_ENABLED)return selfhostDirectReadState(conversationId);
  return remoteRequest<DirectChatReadState>("/rest/v1/rpc/get_direct_chat_read_state",{method:"POST",body:JSON.stringify({p_conversation_id:conversationId})});
}
