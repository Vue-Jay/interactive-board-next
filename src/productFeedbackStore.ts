import {isRemoteBackendEnabled,remoteRequest} from "./backend";

export type ProductFeedbackStatus="new"|"reviewed"|"closed";
export type ProductFeedbackTopic="Предложение"|"Отзыв о сервисе"|"Сообщить о проблеме"|"Другое";
export type ProductFeedbackSource="site"|"app";
export type ProductFeedback={id:string;user_id:string|null;name:string;email:string;topic:ProductFeedbackTopic;message:string;source:ProductFeedbackSource;status:ProductFeedbackStatus;created_at:string};

function requireServer(){if(!isRemoteBackendEnabled())throw new Error("Отправка обратной связи станет доступна после подключения серверной базы Lektrus.")}

export async function submitProductFeedback(input:{name:string;email:string;topic:ProductFeedbackTopic;message:string;source:ProductFeedbackSource}){
 requireServer();
 const rows=await remoteRequest<ProductFeedback[]>("/rest/v1/product_feedback",{
  method:"POST",headers:{Prefer:"return=representation"},
  body:JSON.stringify({name:input.name.trim().slice(0,100)||"Гость",email:input.email.trim().slice(0,254),topic:input.topic,message:input.message.trim().slice(0,4000),source:input.source}),
 });
 if(!rows[0])throw new Error("Сообщение не получило подтверждение от сервера. Попробуйте ещё раз.");
 return rows[0];
}

export async function listProductFeedback(){
 requireServer();
 return remoteRequest<ProductFeedback[]>("/rest/v1/product_feedback?select=id,user_id,name,email,topic,message,source,status,created_at&order=created_at.desc&limit=200");
}

export async function updateProductFeedbackStatus(id:string,status:ProductFeedbackStatus){
 requireServer();
 await remoteRequest(`/rest/v1/product_feedback?id=eq.${encodeURIComponent(id)}`,{
  method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status}),
 });
}
