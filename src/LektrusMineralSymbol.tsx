import type {ReactNode} from "react";
import {isSchoolAtlasMineral,type SchoolAtlasMineral} from "./lektrusSchoolAtlasMinerals";
/** Conventional black-and-white pictograms from the user's Russian school atlas.
 * The same glyph geometry is used for both actual map features and the legend.
 */
type MineralGlyph="coal"|"brown"|"shale"|"oil"|"gas"|"iron"|"manganese"|"chromium"|
 "nickel"|"tungsten"|"molybdenum"|"aluminium"|"copper"|"polymetal"|"tin"|
 "gold"|"mercury"|"asbestos"|"graphite"|"mica"|"apatite"|"phosphate"|
 "potash"|"salt"|"glauber"|"diamonds";
const signs:Record<SchoolAtlasMineral,MineralGlyph>={
 "Каменный уголь":"coal","Бурый уголь":"brown","Горючие сланцы":"shale",
 "Нефть":"oil","Природный газ":"gas",
 "Железные руды":"iron","Марганцевые руды":"manganese","Хромовые руды":"chromium",
 "Никелевые руды":"nickel","Вольфрамовые руды":"tungsten",
 "Молибденовые руды":"molybdenum","Алюминиевые руды":"aluminium",
 "Медные руды":"copper","Полиметаллические руды":"polymetal",
 "Оловянные руды":"tin","Золото":"gold","Ртутные руды":"mercury",
 "Асбест":"asbestos","Графит":"graphite","Слюда":"mica","Апатиты":"apatite",
 "Фосфориты":"phosphate","Калийные соли":"potash","Поваренная соль":"salt",
 "Глауберова соль":"glauber","Алмазы":"diamonds"
};
export const mineralMapSymbol=(name:string)=>{
 if(!isSchoolAtlasMineral(name))return null;
 return {glyph:signs[name],fill:"#202528",conventional:true};
};
const ink="#15191c";
export function MineralAtlasGlyph({name}:{name:string}):ReactNode{
 const shape=mineralMapSymbol(name)?.glyph;
 switch(shape){
  case "coal":return <rect x="-9" y="-9" width="18" height="18" fill={ink}/>;
  case "brown":return <><rect x="-9" y="-9" width="18" height="18" fill="white" stroke={ink} strokeWidth="2"/>
   <path d="M-9 -3L-3 -9M-9 5L5 -9M-5 9L9 -5M3 9L9 3"
    stroke={ink} strokeWidth="2.9"/></>;
  case "shale":return <path d="M-11 6L-5 -6H11L5 6Z" fill={ink}/>;
  case "oil":return <path d="M-4 -10H4L9 10H-9Z" fill={ink}/>;
  case "gas":return <path d="M-4 -10H4L9 10H-9Z" fill="#fff" stroke={ink} strokeWidth="2.4"/>;
  case "iron":return <path d="M0 -10L10 9H-10Z" fill={ink}/>;
  case "manganese":return <path d="M-10 -9L0 1 10 -9 10 9H-10Z" fill={ink}/>;
  case "chromium":return <><rect x="-9" y="-9" width="18" height="18" fill={ink}/>
   <path d="M-8 -8L0 0 8 -8 0 -2Z M-8 8L0 0 8 8 0 2Z" fill="#fff"/></>;
  case "nickel":return <><path d="M-10 -9H10L0 10Z" fill={ink}/>
   <path d="M-6 -8H6L0 -2Z" fill="#fff"/></>;
  case "tungsten":return <rect x="-9" y="-9" width="18" height="18"
   fill="white" stroke={ink} strokeWidth="3"/>;
  case "molybdenum":return <><path d="M0 -11L11 0 0 11 -11 0Z" fill={ink}/>
   <rect x="-5" y="-5" width="10" height="10" fill="white"/></>;
  case "aluminium":return <><rect x="-9" y="-9" width="18" height="18" fill={ink}/>
   <circle r="6.2" fill="white"/></>;
  case "copper":return <rect x="-11" y="-5.5" width="22" height="11" fill={ink}/>;
  case "polymetal":return <><circle r="9.5" fill={ink}/><path d="M0 0L-6 -7A9.5 9.5 0 0 1 6 -7Z M0 0L8 5A9.5 9.5 0 0 1 -8 5Z"
   fill="white"/><circle r="2.4" fill="white"/></>;
  case "tin":return <rect x="-10" y="-5.8" width="20" height="11.6" rx="5.8"
   fill="white" stroke={ink} strokeWidth="3.4"/>;
  case "gold":return <><circle r="9" fill="white" stroke={ink} strokeWidth="1.9"/>
   <path d="M0 -9A9 9 0 0 0 0 9Z" fill={ink}/></>;
  case "mercury":return <circle r="9" fill="white" stroke={ink} strokeWidth="4"/>;
  case "asbestos":return <path d="M0 -11V11M-11 0H11" stroke={ink} strokeWidth="3.8" strokeLinecap="round"/>;
  case "graphite":return <path d="M-5 10V-5L0 -10 5 -5V10Z" fill={ink}/>;
  case "mica":return <><rect x="-9" y="-9" width="18" height="18" fill="white" stroke={ink} strokeWidth="2"/>
   <path d="M-9 -9L9 9" stroke={ink} strokeWidth="2.5"/>
   <path d="M-9 -9H-1L9 1V9Z" fill={ink}/></>;
  case "apatite":return <><circle r="9" fill={ink}/>
   <rect x="-8" y="-2.4" width="16" height="4.8" fill="white"/></>;
  case "phosphate":return <><circle r="9" fill={ink}/>
   <rect x="-2.3" y="-8.5" width="4.6" height="17" fill="white"/></>;
  case "potash":return <><path d="M-10 -5L-3 -10H9V5L2 10H-10Z" fill={ink}/>
   <path d="M-8 -4H2V8H-8Z" fill="#fff"/></>;
  case "salt":return <><path d="M-10 -5L-3 -10H9V5L2 10H-10Z" fill="#fff"
   stroke={ink} strokeWidth="1.6" strokeLinejoin="round"/>
   <path d="M-10 -5H2V10H-10ZM2 -5L9 -10M2 10L9 5" stroke={ink}
    fill="none" strokeWidth="1.8"/></>;
  case "glauber":return <path d="M-11 2H-4V-8H5V2H11V10H-11Z" fill={ink}/>;
  case "diamonds":return <path d="M0 -11L2 -6 7 -9 6 -3 11 -1 6 2 9 7 3 6
   0 11 -3 6 -9 7 -6 2 -11 -1 -6 -3 -7 -9 -2 -6Z" fill={ink}/>;
  default:return null;
 }
}
export function LektrusMineralSymbol({name,size=22}:{name:string;size?:number}):ReactNode{
 if(!isSchoolAtlasMineral(name))return null;
 return <svg width={size} height={size} viewBox="-12 -12 24 24"
  role="img" aria-label={name} style={{flex:"none",overflow:"visible"}}>
  <MineralAtlasGlyph name={name}/>
 </svg>;
}
