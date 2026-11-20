export type AndroidUpdate = {version:string;minimum_version:string;download_url:string;size_bytes:number;catalog_stale?:true};
const VERSION=/^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;
const RELEASE="https://github.com/Vue-Jay/interactive-board-next/releases/download/android-v";

export function compareAndroidVersions(a:string,b:string):number|null{
  if(!VERSION.test(a)||!VERSION.test(b))return null;
  const left=a.split(".").map(Number),right=b.split(".").map(Number);
  for(let i=0;i<3;i++){if(left[i]!==right[i])return left[i]<right[i]?-1:1}
  return 0;
}
export function parseAndroidUpdate(value:unknown):AndroidUpdate|null{
  if(!value||typeof value!=="object")return null;
  const {version,minimum_version,download_url,size_bytes,catalog_stale}=value as Partial<AndroidUpdate>;
  if(typeof version!=="string"||typeof minimum_version!=="string"||typeof download_url!=="string"||
    !VERSION.test(version)||!VERSION.test(minimum_version)||compareAndroidVersions(minimum_version,version)===1||
    download_url!==RELEASE+version+"/Lektrus-Android.apk"||
    typeof size_bytes!=="number"||!Number.isSafeInteger(size_bytes)||size_bytes<=0)return null;
  return {version,minimum_version,download_url,size_bytes,...(catalog_stale===true?{catalog_stale:true as const}:{})};
}
export function androidUpdateKind(installed:string,update:AndroidUpdate):"none"|"optional"|"required"{
  if(compareAndroidVersions(installed,update.version)!==-1)return "none";
  return compareAndroidVersions(installed,update.minimum_version)===-1?"required":"optional";
}
export function shouldOfferAndroidUpdate(installed:string,update:AndroidUpdate,deferredVersion:string,deferredUntil:number,now:number,manual=false){
  const kind=androidUpdateKind(installed,update);
  if(kind==="none")return false;
  return kind==="required"||manual||deferredVersion!==update.version||!Number.isFinite(deferredUntil)||deferredUntil<=now;
}
