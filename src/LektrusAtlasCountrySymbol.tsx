import {useEffect,useState} from "react";
import {atlasCountryFlagUrl,type AtlasCountrySymbol} from "./lektrusAtlasCountrySymbols";
/** Works on Windows, where flag emoji often render as bare country letters. */
export default function LektrusAtlasCountrySymbol({symbol,compact=false}:{
 symbol:AtlasCountrySymbol;compact?:boolean;
}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[symbol.code,symbol.key,symbol.imageUrl]);
 return <span className={"lektrus-country-symbol"+(compact?" lektrus-country-symbol--compact":"")}
  role="img" title={symbol.note} aria-label={symbol.label+": "+symbol.note}>
  {symbol.kind==="symbol"?
   <svg className="lektrus-country-symbol-shield lektrus-country-symbol-unknown" viewBox="0 0 40 32" aria-hidden="true">
    <rect x="5" y="4" width="30" height="24" rx="7" fill="#e7f0fa" stroke="#90a9c1" strokeWidth="1.1"/>
    <path d="M11 11h9M15 16h11M11 21h16" stroke="#457ba6" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="29" cy="10" r="2.2" fill="#457ba6"/>
   </svg>:
   <svg className="lektrus-country-symbol-shield" viewBox="0 0 40 32" aria-hidden="true">
   <path d="M20 2 36 8v11c0 7-8 12-16 14C12 31 4 26 4 19V8Z"
    fill="#dce9f7" stroke="#5c7d9f" strokeWidth="1.8"/>
   <text x="20" y="21" fontSize={symbol.monogram.length>1?11:14}
    fontFamily="system-ui, sans-serif" fontWeight="800" fill="#315375"
    textAnchor="middle">{symbol.monogram}</text>
  </svg>}
  {(symbol.imageUrl||symbol.kind==="flag"&&symbol.code)&&!failed&&<img
   className="lektrus-country-symbol-flag" src={symbol.imageUrl??atlasCountryFlagUrl(symbol.code!)}
   alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
   onError={()=>setFailed(true)}/>}
 </span>;
}
