import {useLayoutEffect,useRef,useState} from "react";
import {validSchoolPractice,type SchoolPractice,type SchoolPracticeBinding} from "./schoolPractice";
/** With a binding, the document is authoritative. Without one, an editor's
 * preview is independent. A binding with no writer is a read-only observer. */
export function useSchoolPractice<T extends SchoolPractice>(initial:T,binding?:SchoolPracticeBinding){
 const [local,setLocal]=useState<T>(initial);
 const candidate=binding?binding.value:local;
 const value=(candidate&&validSchoolPractice(candidate)&&candidate.kind===initial.kind&&candidate.key===initial.key?candidate:initial) as T;
 const latest=useRef(value),writer=useRef(binding),fallback=useRef(initial);
 useLayoutEffect(()=>{latest.current=value;writer.current=binding;fallback.current=initial});
 const update=(change:T|((prev:T)=>T))=>{
  const target=writer.current;if(target&&!target.onChange)return;
  const next=typeof change==="function"?(change as (prev:T)=>T)(latest.current):change;
  if(next.kind!==fallback.current.kind||next.key!==fallback.current.key||!validSchoolPractice(next))return;
  if(JSON.stringify(latest.current)===JSON.stringify(next))return;
  latest.current=next;
  if(target)target.onChange?.(next);else setLocal(next);
 };
 return {value,update,editable:!binding||!!binding.onChange};
}
