import {isRemoteBackendEnabled,remoteRequest} from "./backend";

export type ProfileDetails={
 firstName:string;
 lastName:string;
 middleName:string;
 phone:string;
 city:string;
 organization:string;
 focusArea:string;
};

const emptyDetails=():ProfileDetails=>({firstName:"",lastName:"",middleName:"",phone:"",city:"",organization:"",focusArea:""});
const localKey=(userId:string)=>`lektrus.profile-details.v1.${userId}`;
const clean=(value:string,max:number)=>value.trim().slice(0,max);

export function normalizeProfileDetails(value:Partial<ProfileDetails>|null|undefined):ProfileDetails{
 return {
  firstName:clean(String(value?.firstName??""),80),
  lastName:clean(String(value?.lastName??""),80),
  middleName:clean(String(value?.middleName??""),80),
  phone:clean(String(value?.phone??""),40),
  city:clean(String(value?.city??""),100),
  organization:clean(String(value?.organization??""),160),
  focusArea:clean(String(value?.focusArea??""),120),
 };
}

export function validateProfileDetails(value:ProfileDetails):string{
 const details=normalizeProfileDetails(value);
 if(details.firstName.length>0&&details.firstName.length<2)return "Имя должно содержать минимум 2 символа.";
 if(details.phone&&!/^[+\d\s().-]{7,40}$/.test(details.phone))return "Проверьте номер телефона.";
 return "";
}

export async function getProfileDetails(userId:string):Promise<ProfileDetails>{
 if(!isRemoteBackendEnabled()){
  try{return normalizeProfileDetails(JSON.parse(localStorage.getItem(localKey(userId))||"{}"))}
  catch{return emptyDetails()}
 }
 const rows=await remoteRequest<Array<Record<string,unknown>>>(`/rest/v1/profiles?select=first_name,last_name,middle_name,phone,city,organization,focus_area&id=eq.${encodeURIComponent(userId)}`);
 const row=rows[0];
 return normalizeProfileDetails(row?{
  firstName:String(row.first_name??""),lastName:String(row.last_name??""),middleName:String(row.middle_name??""),
  phone:String(row.phone??""),city:String(row.city??""),organization:String(row.organization??""),
  focusArea:String(row.focus_area??""),
 }:emptyDetails());
}

export async function saveProfileDetails(userId:string,value:ProfileDetails):Promise<void>{
 const details=normalizeProfileDetails(value),validation=validateProfileDetails(details);
 if(validation)throw new Error(validation);
 if(!isRemoteBackendEnabled()){
  localStorage.setItem(localKey(userId),JSON.stringify(details));
  return;
 }
 await remoteRequest(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,{
  method:"PATCH",
  headers:{Prefer:"return=minimal"},
  body:JSON.stringify({
   first_name:details.firstName,last_name:details.lastName,middle_name:details.middleName,
   phone:details.phone,city:details.city,organization:details.organization,
   focus_area:details.focusArea,
  }),
 });
}

export const emptyProfileDetails=emptyDetails;
