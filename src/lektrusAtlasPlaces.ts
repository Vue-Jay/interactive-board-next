import type {GeoFeature} from "./lektrusAtlasData";

/** Exact Russian labels from the mapped source, not guessed translations. */
export function russianPlaceName(feature:GeoFeature):string|null{
 const p=feature.properties??{};
 const name=p.NAME_RU??p.NAME_ru??p.name_ru??p.name_rus;
 return typeof name==="string"&&/[А-ЯЁа-яё]/.test(name)?name.trim():null;
}
/** Natural Earth national capital attribute. Region and local capitals are
 * never silently promoted to capitals of sovereign states. */
export function nationalCapital(feature:GeoFeature):boolean{
 const p=feature.properties??{};
 const flag=Number(p.ADM0CAP??p.adm0cap);
 const type=String(p.FEATURECLA??p.featurecla??"");
 return flag===1&&/^Admin-0 capital(?: alt)?$/i.test(type);
}
export function alternateCapital(feature:GeoFeature):boolean{
 return /Admin-0 capital alt/i.test(String(feature.properties?.FEATURECLA??feature.properties?.featurecla??""));
}
export function cityPopulation(feature:GeoFeature):number{
 const p=feature.properties??{};
 const val=Number(p.POP_MAX??p.pop_max??p.POP_MIN??p.pop_min??0);
 return Number.isFinite(val)&&val>0?val:0;
}
export function cityRank(feature:GeoFeature):number{
 const p=feature.properties??{};
 const raw=Number(p.LABELRANK??p.labelrank??p.SCALERANK??p.scalerank??10);
 return Number.isFinite(raw)?raw:10;
}
export type PlacePoint={id:number;point:[number,number];feature:GeoFeature};
/** Deterministic screen-space collision filter: the visible labels have no
 * overlap at the selected zoom. All points remain searchable/selectable. */
export function chooseCityLabels<T extends PlacePoint>(points:readonly T[],scale:number,
 maxCount:number):T[]{
 const sorted=[...points].filter(f=>russianPlaceName(f.feature))
  .sort((a,b)=>cityRank(a.feature)-cityRank(b.feature)||
   cityPopulation(b.feature)-cityPopulation(a.feature)||a.id-b.id);
 const placed:{x:number;y:number;w:number}[]=[],out:T[]=[];
 for(const item of sorted){
  const text=russianPlaceName(item.feature)!;
  const x=item.point[0]*scale,y=item.point[1]*scale;
  const w=Math.min(170,Math.max(24,text.length*4.2));
  const overlap=placed.some(p=>Math.abs(p.y-y)<12&&x<=p.x+p.w+8&&p.x<=x+w+8);
  if(overlap)continue;
  placed.push({x,y,w});out.push(item);
  if(out.length>=maxCount)break;
 }
 return out;
}
/** Density filter is a visual limit, not a restriction on the source's
 * actual cities or their availability in the name search. */
export function limitCitySymbols<T extends PlacePoint>(points:readonly T[],
 scale:number,limit=850):T[]{
 const cap=Math.max(120,Math.min(limit,Math.round(limit*(scale>=4?1:scale>=2?.7:.4))));
 if(points.length<=cap)return [...points];
 const ranked=[...points].sort((a,b)=>cityRank(a.feature)-cityRank(b.feature)||
  cityPopulation(b.feature)-cityPopulation(a.feature)||a.id-b.id);
 return ranked.slice(0,cap);
}
