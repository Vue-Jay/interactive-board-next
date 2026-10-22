import {useEffect,useState} from "react";
import {atlasCountryFlagUrl,type AtlasCountrySymbol} from "./lektrusAtlasCountrySymbols";
/** Works on Windows, where flag emoji often render as bare country letters. */
export default function LektrusAtlasCountrySymbol({symbol,compact=false}:{
 symbol:AtlasCountrySymbol;compact?:boolean;
}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[symbol.code,symbol.key]);
 return <span className={"lektrus-country-symbol"+(compact?" lektrus-country-symbol--compact":"")}
  role="img" title={symbol.note} aria-label={symbol.label+": "+symbol.note}>
  <svg className="lektrus-country-symbol-shield" viewBox="0 0 40 32" aria-hidden="true">
   <path d="M20 2 36 8v11c0 7-8 12-16 14C12 31 4 26 4 19V8Z"
    fill="#dce9f7" stroke="#5c7d9f" strokeWidth="1.8"/>
   <text x="20" y="21" fontSize={symbol.monogram.length>1?11:14}
    fontFamily="system-ui, sans-serif" fontWeight="800" fill="#315375"
    textAnchor="middle">{symbol.monogram}</text>
  </svg>
  {symbol.kind==="flag"&&symbol.code&&!failed&&<img
   className="lektrus-country-symbol-flag" src={atlasCountryFlagUrl(symbol.code)}
   alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
   onError={()=>setFailed(true)}/>}
 </span>;
}
