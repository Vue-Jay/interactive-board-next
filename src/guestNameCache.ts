/** Only a nickname, never an invite token, guest session or board identity. */
const KEY="lektrus.guest.nickname.v1";
export function rememberedGuestName():string{
 try{
  const value=localStorage.getItem(KEY)?.trim()??"";
  return value.length>=2&&value.length<=60?value:"";
 }catch{return "";}
}
export function rememberGuestName(name:string):void{
 const value=name.trim();
 if(value.length<2||value.length>60)return;
 try{localStorage.setItem(KEY,value)}catch{/* Private browsing and full storage are safe. */}
}
