import type {AuthUser} from "./authStore";
import type {TeacherApplication,TeacherRequest} from "./accountRoleStore";

const KEY="lektrus.role-preview.teacher-requests.v1";
export type PreviewTeacherRequest=TeacherRequest&{isPreview:true};

export function listPreviewTeacherRequests():PreviewTeacherRequest[]{
 try{
  const value=JSON.parse(localStorage.getItem(KEY)||"[]");
  if(!Array.isArray(value))return [];
  return value.filter(item=>item&&typeof item.userId==="string"&&item.application)
   .map(item=>({...item,isPreview:true as const}));
 }catch{return []}
}

export function addPreviewTeacherRequest(user:AuthUser,application:TeacherApplication):PreviewTeacherRequest{
 const row:PreviewTeacherRequest={
  userId:`preview:${crypto.randomUUID?.()??Date.now().toString(36)}`,
  name:user.name||"Проверочный пользователь",email:user.email||"",status:"pending",
  requestedAt:new Date().toISOString(),reviewedAt:null,
  application:{...application},isPreview:true,
 };
 const rows=listPreviewTeacherRequests();
 try{localStorage.setItem(KEY,JSON.stringify([...rows,row]))}catch{/* Preview data is best-effort when storage is unavailable. */}
 return row;
}

export function removePreviewTeacherRequest(userId:string):void{
 try{localStorage.setItem(KEY,JSON.stringify(listPreviewTeacherRequests().filter(row=>row.userId!==userId)))}catch{}
}
