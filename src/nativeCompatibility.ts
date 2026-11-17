// WebView 83 and early iOS 15 lack a few runtime APIs that transpiling syntax
// cannot supply. Keep the compatibility layer limited to installed apps.
import { Capacitor } from "@capacitor/core";

export function installNativeCompatibility() {
 const define=(target:object,key:string,value:unknown)=>{
  if(!(key in target))Object.defineProperty(target,key,{value,writable:true,configurable:true});
 };
 define(Array.prototype,"at",function(this:unknown[],index:number){
  const offset=Math.trunc(Number(index)||0),position=offset<0?this.length+offset:offset;
  return position>=0&&position<this.length?this[position]:undefined;
 });
 define(String.prototype,"replaceAll",function(this:string,search:string|RegExp,replacement:string|((...args:any[])=>string)){
  if(search instanceof RegExp){
   if(!search.global)throw new TypeError("replaceAll requires a global regular expression");
   return String(this).replace(search,replacement as string);
  }
  return String(this).replace(new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"g"),replacement as string);
 });
 define(Object,"hasOwn",(object:object,key:PropertyKey)=>Object.prototype.hasOwnProperty.call(object,key));
 // The app uses structuredClone for plain board/editor data, not transferable
 // objects. Preserve undefined, repeated references, and cycles.
 define(globalThis,"structuredClone",function<T>(input:T):T{
  const seen=new WeakMap<object,unknown>();
  const clone=(value:any):any=>{
   if(typeof value==="function"||typeof value==="symbol")throw new DOMException("Value cannot be cloned","DataCloneError");
   if(value===null||typeof value!=="object")return value;
   if(seen.has(value))return seen.get(value);
   if(value instanceof Date){const copy=new Date(value.getTime());seen.set(value,copy);return copy;}
   if(value instanceof RegExp){const copy=new RegExp(value.source,value.flags);seen.set(value,copy);return copy;}
   if(value instanceof Map){const copy=new Map();seen.set(value,copy);for(const [k,v] of value)copy.set(clone(k),clone(v));return copy;}
   if(value instanceof Set){const copy=new Set();seen.set(value,copy);for(const v of value)copy.add(clone(v));return copy;}
   if(value instanceof ArrayBuffer){const copy=value.slice(0);seen.set(value,copy);return copy;}
   if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)
    throw new DOMException("Value cannot be cloned","DataCloneError");
   const copy=Array.isArray(value)?new Array(value.length):{};seen.set(value,copy);
   for(const key of Object.keys(value))Object.defineProperty(copy,key,{value:clone(value[key]),enumerable:true,writable:true,configurable:true});
   return copy;
  };
  return clone(input);
 });
 define(Promise,"withResolvers",function<T>(){
  let resolve!:(value:T|PromiseLike<T>)=>void,reject!:(reason?:unknown)=>void;
  const promise=new Promise<T>((res,rej)=>{resolve=res;reject=rej;});
  return {promise,resolve,reject};
 });
 define(Element.prototype,"replaceChildren",function(this:Element,...children:(Node|string)[]){
  while(this.firstChild)this.removeChild(this.firstChild);
  this.append(...children);
 });
}
if(Capacitor.isNativePlatform())installNativeCompatibility();
