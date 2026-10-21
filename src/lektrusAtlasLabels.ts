/** Cartographic display names: concise Russian school usage, never rewrite source records.
 * Explicit aliases prevent changing historical states or similarly named countries.
 */
const shortCountryNames:Record<string,string>={
 "Китайская Народная Республика":"Китай",
 "Китайская народная республика":"Китай",
 "Демократическая Республика Конго":"ДР Конго",
 "Демократическая республика Конго":"ДР Конго",
 "Республика Конго":"Конго",
 "Российская Федерация":"Россия",
 "Соединённые Штаты Америки":"США",
 "Соединенные Штаты Америки":"США",
 "Соединённое Королевство Великобритании и Северной Ирландии":"Великобритания",
 "Соединенное Королевство Великобритании и Северной Ирландии":"Великобритания",
 "Корейская Народно-Демократическая Республика":"КНДР",
 "Корейская Народно-Демократическая республика":"КНДР",
 "Республика Корея":"Южная Корея",
 "Исламская Республика Иран":"Иран",
 "Исламская республика Иран":"Иран",
 "Федеративная Республика Германия":"Германия",
 "Социалистическая Республика Вьетнам":"Вьетнам",
 "Объединённая Республика Танзания":"Танзания",
 "Объединенная Республика Танзания":"Танзания",
 "Боливарианская Республика Венесуэла":"Венесуэла",
 "Лаосская Народно-Демократическая Республика":"Лаос",
 "Объединённые Арабские Эмираты":"ОАЭ",
 "Объединенные Арабские Эмираты":"ОАЭ",
 "Центральноафриканская Республика":"ЦАР",
 "Федеративная Демократическая Республика Эфиопия":"Эфиопия",
 "Федеративная Республика Бразилия":"Бразилия",
 "Республика Индия":"Индия",
 "Исламская Республика Пакистан":"Пакистан",
 "Федеративная Республика Нигерия":"Нигерия",
 "Королевство Саудовская Аравия":"Саудовская Аравия",
 "Республика Казахстан":"Казахстан",
 "Республика Узбекистан":"Узбекистан",
 "Республика Беларусь":"Беларусь",
 "Республика Молдова":"Молдова",
 "Республика Южный Судан":"Южный Судан",
 "Восточная Республика Уругвай":"Уругвай",
 "Многонациональное Государство Боливия":"Боливия",
 "Многонациональное государство Боливия":"Боливия",
 "Королевство Таиланд":"Таиланд",
 "Арабская Республика Египет":"Египет",
 "Сирийская Арабская Республика":"Сирия",
 "Республика Союз Мьянма":"Мьянма"
};
const isoShortNames:Record<string,string>={
 CN:"Китай",CD:"ДР Конго",CG:"Конго",RU:"Россия",US:"США",
 GB:"Великобритания",KP:"КНДР",KR:"Южная Корея",
 IR:"Иран",DE:"Германия",VN:"Вьетнам",TZ:"Танзания",VE:"Венесуэла",
 LA:"Лаос",AE:"ОАЭ",CF:"ЦАР",ET:"Эфиопия",BR:"Бразилия",IN:"Индия",
 PK:"Пакистан",NG:"Нигерия",SA:"Саудовская Аравия",KZ:"Казахстан",
 UZ:"Узбекистан",BY:"Беларусь",MD:"Молдова",SS:"Южный Судан",
 UY:"Уругвай",BO:"Боливия",TH:"Таиланд",EG:"Египет",SY:"Сирия",MM:"Мьянма"
};
/** Apply only to modern sovereign country polygons. Never alias cities or historical empires. */
export function schoolCountryName(fullName:string,iso?:string):string{
 const fromISO=isoShortNames[(iso||"").toUpperCase()];
 return fromISO??shortCountryNames[fullName.trim()]??fullName;
}
export type AtlasLabelKind="country"|"capital"|"city"|"province"|"lake"|"river"|"sea"|"nature"|"stream"|"peak";
export type AtlasLabelCandidate={
 id:string;kind:AtlasLabelKind;text:string;x:number;y:number;
 fontSize:number;priority:number;align?:"middle"|"start";dx?:number;dy?:number;
};
/** Spatial hash and screen-space text rectangles. One pass handles labels across
 * countries, capitals, settlements and physical geography without O(n²) scans.
 * Coordinate positions are in the 900 × 450 map viewport's SVG units.
 */
export function layoutAtlasLabels(candidates:readonly AtlasLabelCandidate[],scale:number,
 maxCount=180):AtlasLabelCandidate[]{
 const placed=new Map<string,{x1:number;x2:number;y1:number;y2:number}[]>();
 const out:AtlasLabelCandidate[]=[];
 const cell=28;
 const ordered=[...candidates].filter(v=>v.text&&Number.isFinite(v.x)&&Number.isFinite(v.y))
  .sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
 for(const c of ordered){
  const font=Math.max(5,Math.min(17,c.fontSize));
  const x=c.x*scale+(c.dx??0),y=c.y*scale+(c.dy??0);
  // 7% safety margin accommodates different Cyrillic font metrics.
  const width=Math.max(10,Math.min(340,[...c.text].reduce((n,ch)=>
    n+(ch===" "?0.33:/[.,·-()]/.test(ch)?0.34:/[MWШЩЖЮЫ]/.test(ch)?0.85:0.63,0)*font*1.07));
  const height=font*1.35;
  const x1=(c.align==="start"?x:x-width/2)-4,x2=x1+width+8;
  const y1=y-height-3,y2=y+4;
  if(x2<0||y2<0||x1>900*scale||y1>450*scale)continue;
  const gx1=Math.floor(x1/cell),gx2=Math.floor(x2/cell),gy1=Math.floor(y1/cell),gy2=Math.floor(y2/cell);
  let overlaps=false;
  for(let i=gx1;i<=gx2&&!overlaps;i++)for(let j=gy1;j<=gy2;j++){
   if(placed.get(i+":"+j)?.some(r=>x1<r.x2&&x2>r.x1&&y1<r.y2&&y2>r.y1)){
    overlaps=true;break;
   }
  }
  if(overlaps)continue;
  const rect={x1,x2,y1,y2};
  for(let i=gx1;i<=gx2;i++)for(let j=gy1;j<=gy2;j++){
   const key=i+":"+j;
   const bucket=placed.get(key);
   if(bucket)bucket.push(rect);else placed.set(key,[rect]);
  }
  out.push(c);
  if(out.length>=maxCount)break;
 }
 return out;
}
