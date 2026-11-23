/** The most recently used guest display name on THIS browser/device.
 * Intentionally stores neither a guest token nor a server-side profile. */
export const GUEST_NAME_CACHE_KEY="lektrus.guest.last-name.v1";
const normalize=(value:string):string=>value.trim().replace(/\s+/g," ");

export function getCachedGuestName():string{
 try{
  const value=localStorage.getItem(GUEST_NAME_CACHE_KEY);
  if(!value)return "";
  const name=normalize(value);
  return name.length>=2&&name.length<=60?name:"";
 }catch{return "";} // Private browsing or disabled browser storage.
}

export function rememberGuestName(value:string):void{
 const name=normalize(value);
 if(name.length<2||name.length>60)return;
 try{localStorage.setItem(GUEST_NAME_CACHE_KEY,name)}
 catch{/* Guest login must work even when storage is unavailable. */}
}
