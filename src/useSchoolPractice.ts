import {useLayoutEffect,useRef,useState} from "react";
import {validSchoolPractice,type SchoolPractice,type SchoolPracticeBinding} from "./schoolPractice";
/** With a binding, the document is authoritative. Without one, an editor's
 * preview is independent. A binding with no writer is a read-only observer. */
export function useSchoolPractice<T extends SchoolPractice>(defaultValue:T|((candidate?:SchoolPractice)=>T),binding?:SchoolPracticeBinding){
 const resolve=(candidate?:SchoolPractice)=>typeof defaultValue==="function"?defaultValue(candidate):defaultValue;
 const [local,setLocal]=useState<T>(()=>resolve());
 const candidate=binding?binding.value:local;
 const initial=resolve(candidate);
 const value=(candidate&&validSchoolPractice(candidate)&&candidate.kind===initial.kind&&candidate.key===initial.key?candidate:initial) as T;
 const latest=useRef(value),writer=useRef(binding),resolveRef=useRef(resolve);
 useLayoutEffect(()=>{latest.current=value;writer.current=binding;resolveRef.current=resolve});
 const update=(change:T|((prev:T)=>T))=>{
  const target=writer.current;if(target&&!target.onChange)return;
  const next=typeof change==="function"?(change as (prev:T)=>T)(latest.current):change;
  if(!validSchoolPractice(next))return;
  const fallback=resolveRef.current(next);
  if(next.kind!==fallback.kind||next.key!==fallback.key)return;
  if(JSON.stringify(latest.current)===JSON.stringify(next))return;
  latest.current=next;
  if(target)target.onChange?.(next);else setLocal(next);
 };
 return {value,update,editable:!binding||!!binding.onChange};
}
