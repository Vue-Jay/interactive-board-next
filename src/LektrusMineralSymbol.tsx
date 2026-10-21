import type {ReactNode} from "react";
/** Russian school-atlas cartographic signs based on mineral-resource legends:
 * triangle = iron ore; bar = copper; half-filled circle = gold;
 * black square with white disc = bauxite; special historical signs for other
 * ore types. Unlike the former chemical labels, these shapes are meaningful.
 * Rare minerals lack one universal atlas sign and use an explicit abbreviation.
 */
const codes:Record<string,string>={
 "Золото":"Au","Серебро":"Ag","Медь":"Cu","Железная руда":"Fe",
 "Уран":"U","Алмазы":"◆","Литий":"Li","Никель":"Ni",
 "Бокситы и алюминий":"Al","Олово":"Sn","Свинец":"Pb","Цинк":"Zn",
 "Калийные соли":"K","Фосфориты":"P","Вольфрам":"W","Марганец":"Mn",
 "Редкоземельные элементы":"REE","Молибден":"Mo","Кобальт":"Co",
 "Бериллий":"Be","Титан":"Ti","Хромиты":"Cr","Платина":"Pt",
 "Барит":"Ba","Гипс":"Ca","Каменная соль":"NaCl",
 "Борные минералы":"B","Каолин":"Ka","Флюорит":"F"
};
type SchoolMineralGlyph="iron"|"copper"|"gold"|"bauxite"|"nickel"|"manganese"|
 "chromium"|"tungsten"|"molybdenum"|"tin"|"uranium"|"diamonds"|"potash"|
 "phosphates"|"lead-zinc"|"silver"|"generic";
const atlasSigns:Record<string,SchoolMineralGlyph>={
 "Железная руда":"iron","Медь":"copper","Золото":"gold",
 "Бокситы и алюминий":"bauxite","Никель":"nickel",
 "Марганец":"manganese","Хромиты":"chromium",
 "Вольфрам":"tungsten","Молибден":"molybdenum",
 "Олово":"tin","Уран":"uranium","Алмазы":"diamonds",
 "Калийные соли":"potash","Фосфориты":"phosphates",
 "Свинец":"lead-zinc","Цинк":"lead-zinc","Серебро":"silver"
};
const nonmetalNames=new Set([
 "Алмазы","Калийные соли","Фосфориты","Барит","Гипс","Каменная соль",
 "Борные минералы","Каолин","Флюорит"
]);
export const mineralMapSymbol=(name:string)=>{
 const glyph=atlasSigns[name]??"generic";
 return {code:codes[name]??"?",glyph,
  group:nonmetalNames.has(name)?"Нерудные":"Рудные",
  fill:"#24313a",
  conventional:glyph!=="generic"};
};
/** One SVG glyph is reused in both the map and the key; it is not an emoji or
 * a font-dependent text pictogram. Geometry is in an intrinsic 24px square.
 */
export function MineralAtlasGlyph({name}:{name:string}):ReactNode{
 const sym=mineralMapSymbol(name),ink="#20292e";
 switch(sym.glyph){
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
  case "uranium":return <circle r="7.2" fill="#ae775d" stroke={ink} strokeWidth="1.5"/>;
  case "diamonds":return <path d="M0 -9.5L9.5 0L0 9.5L-9.5 0Z" fill={ink}/>;
  case "potash":return <rect x="-8.4" y="-8.4" width="16.8" height="16.8"
   fill="#fff" stroke="#398967" strokeWidth="2.7"/>;
  case "phosphates":return <><circle r="8.2" fill="#398967"/>
   <circle r="4" fill="#fff"/></>;
  case "lead-zinc":return <><circle r="8.4" fill={ink}/>
   <circle r="3.1" fill="#fff"/>
   <path d="M-8 0H8M0 -8V8" stroke="#fff" strokeWidth="1.6"/></>;
  case "silver":return <><circle r="8.2" fill="#f2f5f6" stroke={ink} strokeWidth="1.7"/>
   <path d="M-7.2 0H7.2" stroke={ink} strokeWidth="3"/></>;
  default:return <><rect x="-9" y="-9" width="18" height="18" rx="2.1"
   fill="#fff" stroke={ink} strokeWidth="1.8"/>
   <text x="0" y="3" fontSize={sym.code.length>2?6:9} textAnchor="middle"
    fill={ink} fontWeight="800">{sym.code}</text></>;
 }
}
export function LektrusMineralSymbol({name,size=22}:{name:string;size?:number}):ReactNode{
 return <svg width={size} height={size} viewBox="-12 -12 24 24"
  role="img" aria-label={name} style={{flex:"none",overflow:"visible"}}>
   <MineralAtlasGlyph name={name}/>
 </svg>;
}
