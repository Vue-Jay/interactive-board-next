import type {ReactNode} from "react";
/** Compact textbook legend: ore triangles, non-metal diamonds, chemical abbreviations.
 * Chemical element symbols are international conventions; shapes are explained in legend.
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
const nonmetalNames=new Set([
 "Алмазы","Калийные соли","Фосфориты","Барит","Гипс","Каменная соль",
 "Борные минералы","Каолин","Флюорит"
]);
export const mineralMapSymbol=(name:string)=>({
 code:codes[name]??"•",group:nonmetalNames.has(name)?"Нерудные":"Рудные",
 fill:nonmetalNames.has(name)?"#337a70":"#a94e3c"
});
export function LektrusMineralSymbol({name,size=20}:{name:string;size?:number}):ReactNode{
 const sym=mineralMapSymbol(name);
 return <svg width={size} height={size} viewBox="-11 -11 22 22"
  role="img" aria-label={name} style={{flex:"none",overflow:"visible"}}>
  {sym.group==="Нерудные"?
   <path d="M0 -9L9 0 0 9 -9 0Z" fill={sym.fill} stroke="#fff" strokeWidth="1.7"/>:
   <path d="M0 -9L10 8 -10 8Z" fill={sym.fill} stroke="#fff" strokeWidth="1.7"/>}
  <text x="0" y="4.3" fontSize={sym.code.length>=3?6.5:8}
   textAnchor="middle" fill="#fff" fontWeight="800"
   stroke="#18333b" strokeWidth=".22" paintOrder="stroke">{sym.code}</text>
 </svg>;
}
