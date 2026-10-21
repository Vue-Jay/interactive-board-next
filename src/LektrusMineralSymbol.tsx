import type {ReactNode} from "react";
import {isSchoolAtlasMineral,type SchoolAtlasMineral} from "./lektrusSchoolAtlasMinerals";

/** Traditional educational cartographic glyphs for the limited geography
 * school-atlas legend, not a geological dictionary of every commodity.
 * A missing symbol must not become a made-up generic square or letter badge.
 */
type SchoolMineralGlyph="oil"|"gas"|"coal"|"brown-coal"|"iron"|"manganese"|
 "chromium"|"nickel"|"tungsten"|"molybdenum"|"bauxite"|"copper"|
 "polymetallic"|"tin"|"gold"|"diamonds"|"apatite"|"potash"|"salt";

const schoolSigns:Record<SchoolAtlasMineral,SchoolMineralGlyph>={
 "Нефть":"oil","Природный газ":"gas",
 "Каменный уголь":"coal","Бурый уголь":"brown-coal",
 "Железная руда":"iron","Марганец":"manganese",
 "Хромиты":"chromium","Никель":"nickel",
 "Вольфрам":"tungsten","Молибден":"molybdenum",
 "Бокситы и алюминий":"bauxite","Медь":"copper",
 "Полиметаллические руды":"polymetallic",
 "Олово":"tin","Золото":"gold","Алмазы":"diamonds",
 "Апатиты и фосфориты":"apatite","Калийные соли":"potash",
 "Каменная соль":"salt"
};
const nonmetalNames=new Set<string>([
 "Алмазы","Апатиты и фосфориты","Калийные соли","Каменная соль"
]);
const fuelNames=new Set<string>([
 "Нефть","Природный газ","Каменный уголь","Бурый уголь"
]);
export const mineralMapSymbol=(name:string)=>{
 if(!isSchoolAtlasMineral(name))return null;
 return {glyph:schoolSigns[name],
  group:fuelNames.has(name)?"Топливные":nonmetalNames.has(name)?"Нерудные":"Рудные",
  fill:"#24313a",conventional:true};
};
/** The same vector pictograms serve the legend and actual USGS map points. */
export function MineralAtlasGlyph({name}:{name:string}):ReactNode{
 const symbol=mineralMapSymbol(name);
 if(!symbol)return null;
 const ink="#20292e";
 switch(symbol.glyph){
  case "coal":return <rect x="-9" y="-9" width="18" height="18" fill={ink}/>;
  case "brown-coal":return <><rect x="-9" y="-9" width="18" height="18" fill="#fff"
   stroke={ink} strokeWidth="1.6"/><path d="M-9 -1L-1 -9M-9 8L8 -9M0 9L9 0"
   stroke={ink} strokeWidth="2.3"/></>;
  case "oil":return <path d="M0 -9L8.5 9H-8.5Z" fill={ink}/>;
  case "gas":return <path d="M0 -9L8.5 9H-8.5Z" fill="#fff" stroke={ink} strokeWidth="2.2"/>;
  case "iron":return <path d="M0 -9L9.1 8H-9.1Z" fill={ink}/>;
  case "copper":return <rect x="-9.5" y="-4.8" width="19" height="9.6" fill={ink}/>;
  case "gold":return <><circle r="8.2" stroke={ink} strokeWidth="1.9" fill="#fff"/>
   <path d="M0 -8.2A8.2 8.2 0 0 0 0 8.2Z" fill={ink}/></>;
  case "bauxite":return <><rect x="-9" y="-9" width="18" height="18" fill={ink}/>
   <circle r="5.4" fill="#fff"/></>;
  case "nickel":return <><path d="M-9 -7H9L0 9Z" fill={ink}/>
   <path d="M-6.8 -5.8H6.8L0 -.6Z" fill="#fff"/></>;
  case "manganese":return <><rect x="-9" y="-9" width="18" height="18" fill={ink}/>
   <path d="M-6 -9L0 -2.3L6 -9Z" fill="#fff"/></>;
  case "chromium":return <><rect x="-9" y="-9" width="18" height="18" fill={ink}/>
   <path d="M0 -4.1L-5.5 -9H5.5Z M0 4.1L-5.5 9H5.5Z" fill="#fff"/></>;
  case "tungsten":return <rect x="-8.5" y="-8.5" width="17" height="17"
   fill="#fff" stroke={ink} strokeWidth="2.6"/>;
  case "molybdenum":return <><path d="M0 -10L10 0L0 10L-10 0Z" fill={ink}/>
   <rect x="-4.2" y="-4.2" width="8.4" height="8.4" fill="#fff"/></>;
  case "tin":return <rect x="-9" y="-5.5" width="18" height="11"
   rx="4.5" fill="#fff" stroke={ink} strokeWidth="3"/>;
  case "polymetallic":return <><circle r="8.5" fill="#fff" stroke={ink} strokeWidth="2.5"/>
   <path d="M-5.8 -5.8L5.8 5.8M5.8 -5.8L-5.8 5.8" fill="none" stroke={ink} strokeWidth="2.5"/></>;
  case "diamonds":return <path d="M0 -9.5L9.5 0L0 9.5L-9.5 0Z" fill={ink}/>;
  case "apatite":return <><ellipse rx="9.5" ry="6.5" fill={ink}/>
   <path d="M-8.5 0H8.5" stroke="#fff" strokeWidth="2.5"/></>;
  case "potash":return <><rect x="-8.5" y="-8.5" width="17" height="17" fill="#fff"
   stroke={ink} strokeWidth="2"/><path d="M-8.5 -8.5H8.5V-3H-3V8.5H-8.5Z" fill={ink}/></>;
  case "salt":return <><path d="M-8 -5L-2 -9H8L2 -5ZM2 -5L8 -9V5L2 9Z" fill="#e8ecee"
    stroke={ink} strokeWidth="1.3" strokeLinejoin="round"/>
   <rect x="-8" y="-5" width="10" height="14" fill="#fff" stroke={ink}
    strokeWidth="1.4"/></>;
 }
}
export function LektrusMineralSymbol({name,size=22}:{name:string;size?:number}):ReactNode{
 if(!isSchoolAtlasMineral(name))return null;
 return <svg width={size} height={size} viewBox="-12 -12 24 24"
  role="img" aria-label={name} style={{flex:"none",overflow:"visible"}}>
   <MineralAtlasGlyph name={name}/>
 </svg>;
}
