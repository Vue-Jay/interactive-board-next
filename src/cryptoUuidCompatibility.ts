/** Compatibility for browsers opening Lectrus over HTTP on a LAN IP.
 * Crypto.randomUUID() is restricted to secure contexts, but getRandomValues()
 * remains available for local network pages. Generated IDs remain UUID v4.
 * Never treat this as a replacement for authentication secrets or HTTPS.
 */
export function compatibleRandomUUID():string{
 const api=typeof globalThis.crypto!=="undefined"?globalThis.crypto:undefined;
 if(api&&typeof api.randomUUID==="function")return api.randomUUID();
 const bytes=new Uint8Array(16);
 if(api&&typeof api.getRandomValues==="function")api.getRandomValues(bytes);
 else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
 bytes[6]=(bytes[6]&0x0f)|0x40;
 bytes[8]=(bytes[8]&0x3f)|0x80;
 const h=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
 return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20);
}
export function installRandomUUIDCompatibility():void{
 const api=typeof globalThis.crypto!=="undefined"?globalThis.crypto:undefined;
 if(!api||typeof api.randomUUID==="function")return;
 try{
  Object.defineProperty(api,"randomUUID",{
   configurable:true,writable:true,value:compatibleRandomUUID
  });
 }catch{
  // Browser engines with a non-extensible Crypto instance still use
  // compatibleRandomUUID() at critical render points.
 }
}
installRandomUUIDCompatibility();
