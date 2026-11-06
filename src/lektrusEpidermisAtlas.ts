/** Reference-led, clickable epidermis in the continuous body coordinate frame.
 * Four strata belong to thin hairy skin. They are shown in intentionally
 * expanded, *non-calibrated* cutaway width, not 1:1 to human body height.
 * The biological relationships are derived from OpenStax A&P 2e §5.1,
 * Leeds Histology Guide "Epidermis" and NCBI Bookshelf NBK537325.
 */
import {SKIN_ILLUSTRATIVE_LAYERS,skinEvidenceRegionAt} from "./lektrusSkinEvidenceModel";
import type {SkinSectionContour,SkinSectionPoint} from "./lektrusSkinVectorSections";

export type EpidermisId="epidermis"|"corneum"|"granulosum"|"spinosum"|
 "basale"|"keratinocyte"|"melanocyte"|"basement";
export type EpidermisStratum=Extract<EpidermisId,
 "corneum"|"granulosum"|"spinosum"|"basale">;
export type EpidermisRecord={
 id:EpidermisId;name:string;latin:string;summary:string;
 function:string;microAppearance:string;source:string;
};
export const EPIDERMIS_SOURCES={
 openstax:"https://openstax.org/books/anatomy-and-physiology-2e/pages/5-1-layers-of-the-skin",
 leeds:"https://histology.leeds.ac.uk/home/skin/epidermis_layers/",
 ncbi:"https://www.ncbi.nlm.nih.gov/books/NBK537325/"
} as const;
/** Terms describe what the user can legitimately inspect in the drawn
 * educational layer, not a photograph of the literal clicked body cell. */
export const EPIDERMIS_RECORDS:Record<EpidermisId,EpidermisRecord>={
 epidermis:{id:"epidermis",name:"Эпидермис",latin:"Epidermis",
  summary:"Наружная часть кожи: многослойный плоский ороговевающий эпителий.",
  function:"Защитный барьер, препятствующий потере воды и проникновению микроорганизмов.",
  microAppearance:"В тонкой волосистой коже выделяют четыре основных слоя. Эпидермис не содержит кровеносных сосудов, питание поступает диффузией из дермы.",
  source:EPIDERMIS_SOURCES.openstax},
 corneum:{id:"corneum",name:"Роговой слой",latin:"Stratum corneum",
  summary:"Наружные плотно прилегающие безъядерные корнеоциты, наполненные кератином.",
  function:"Главный водонепроницаемый и механический барьер; поверхностные чешуйки постепенно слущиваются.",
  microAppearance:"На гистологическом срезе это тонкие параллельные слои плоских ороговевших чешуек; в них нет ядер или органелл.",
  source:EPIDERMIS_SOURCES.leeds},
 granulosum:{id:"granulosum",name:"Зернистый слой",latin:"Stratum granulosum",
  summary:"Один или несколько рядов уплощённых кератиноцитов с тёмными гранулами кератогиалина.",
  function:"Кератинизация, участие в образовании липидного барьера эпидермиса.",
  microAppearance:"Клетки уплощены, характерны базофильные гранулы; важно не путать гранулы кератогиалина с липидными ламеллярными тельцами.",
  source:EPIDERMIS_SOURCES.ncbi},
 spinosum:{id:"spinosum",name:"Шиповатый слой",latin:"Stratum spinosum",
  summary:"Несколько рядов многогранных живых кератиноцитов с ядрами.",
  function:"Механическая прочность кожи благодаря десмосомам, связывающим соседние клетки.",
  microAppearance:"Клетки имеют более округлые ядра; «шипики» между ними особенно заметны после гистологической фиксации и не являются настоящими иглами.",
  source:EPIDERMIS_SOURCES.openstax},
 basale:{id:"basale",name:"Базальный слой",latin:"Stratum basale",
  summary:"Один ряд кубических или низких призматических клеток вдоль базальной мембраны.",
  function:"Образование новых кератиноцитов за счёт деления базальных клеток.",
  microAppearance:"Заметна одна линия более тёмных ядер у границы с дермой; среди клеток встречаются меланоциты.",
  source:EPIDERMIS_SOURCES.leeds},
 keratinocyte:{id:"keratinocyte",name:"Кератиноцит",latin:"Keratinocyte",
  summary:"Основная клетка эпидермиса; её форма меняется при перемещении от базального слоя к поверхности.",
  function:"Синтез кератина и формирование защитного барьера кожи.",
  microAppearance:"В базальном слое клетки низкие призматические, в шиповатом многогранные с ядрами, в зернистом уплощаются, а в роговом превращаются в безъядерные корнеоциты.",
  source:EPIDERMIS_SOURCES.openstax},
 melanocyte:{id:"melanocyte",name:"Меланоцит",latin:"Melanocyte",
  summary:"Пигментная клетка, обычно расположенная в базальном слое; имеет тонкие отростки.",
  function:"Синтез меланина и передача меланосом соседним кератиноцитам для защиты от ультрафиолета.",
  microAppearance:"На обычных H&E-срезах светлая цитоплазма и небольшое ядро; отростки лучше видны специальными методами окрашивания.",
  source:EPIDERMIS_SOURCES.ncbi},
 basement:{id:"basement",name:"Дермо-эпидермальное соединение",
  latin:"Basement membrane zone",
  summary:"Тонкая зона сцепления базальных кератиноцитов с подлежащей дермой.",
  function:"Механическое крепление эпидермиса к дерме и обмен веществ через границу тканей.",
  microAppearance:"Граница обычно волнистая с дермальными сосочками. Базальная мембрана слишком тонкая, чтобы быть широкой цветной полосой в масштабе всего тела.",
  source:EPIDERMIS_SOURCES.openstax}
};
export const EPIDERMIS_STRATA_ORDER=[
 "corneum","granulosum","spinosum","basale"
] as const;
export const EPIDERMIS_LAYER_FRACTIONS=[
 {id:"corneum",start:0,end:SKIN_ILLUSTRATIVE_LAYERS.granulosumStart,color:"#e8b9af"},
 {id:"granulosum",start:SKIN_ILLUSTRATIVE_LAYERS.granulosumStart,
  end:SKIN_ILLUSTRATIVE_LAYERS.spinosumStart,color:"#98729c"},
 {id:"spinosum",start:SKIN_ILLUSTRATIVE_LAYERS.spinosumStart,
  end:SKIN_ILLUSTRATIVE_LAYERS.basaleStart,color:"#d8a4bd"},
 {id:"basale",start:SKIN_ILLUSTRATIVE_LAYERS.basaleStart,
  end:SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd,color:"#a16c94"}
] as const;
export function epidermisLayerAt(fraction:number):EpidermisStratum|null{
 if(!Number.isFinite(fraction))return null;
 for(const l of EPIDERMIS_LAYER_FRACTIONS){
  if(fraction>=l.start&&fraction<l.end)return l.id;
 }
 return null;
}
export function sectionAtY(c:SkinSectionContour,y:number):SkinSectionPoint|null{
 if(y<c.minY||y>c.maxY||c.points.length<2)return null;
 let lo=0,hi=c.points.length-1;
 while(hi-lo>1){
  const m=(lo+hi)>>1;
  if(c.points[m].y<y)lo=m;else hi=m;
 }
 const a=c.points[lo],b=c.points[hi];
 const t=Math.max(0,Math.min(1,(y-a.y)/Math.max(1e-7,b.y-a.y)));
 return {x:a.x+(b.x-a.x)*t,y,depth:a.depth+(b.depth-a.depth)*t};
}
export type EpidermisPoint={x:number;y:number};
/** Clicks are mapped into the SAME body-world coordinate system as zoom.
 * Ten logical screen pixels are tolerated around the very thin epidermis,
 * but NEVER around a different limb or through neutral interior.
 */
export function pickEpidermisAt(
 contours:readonly SkinSectionContour[],point:EpidermisPoint,
 pixelsPerWorld:number
):EpidermisId|null{
 const tol=Math.min(.11,9/Math.max(1,pixelsPerWorld));
 let candidate:EpidermisId|null=null,best=Infinity;
 for(const c of contours){
  if(point.x<c.minX-tol||point.x>c.maxX+tol||
   point.y<c.minY||point.y>c.maxY)continue;
  const p=sectionAtY(c,point.y);
  if(!p||p.depth<=.04)continue;
  const d=(point.x-p.x)*c.inward;
  const outer=Math.max(0,d);
  const epi=p.depth*SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd;
  if(d< -tol||d>epi+tol)continue;
  const error=d<0?-d:d>epi?d-epi:0;
  if(error>=best)continue;
  best=error;
  const fraction=Math.max(0,Math.min(.99999*SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd,outer/p.depth));
  candidate=pixelsPerWorld*epi<28?"epidermis":
   epidermisLayerAt(fraction)??"epidermis";
  // At deep zoom, the thin basal border can be explicitly inspected.
  if(d>epi-.009&&d<epi+.009&&pixelsPerWorld>170)
   candidate="basement";
  // The only deliberately registered example is the shoulder, not
  // a fictitious melanocyte on every palm/foot edge.
  if(candidate==="basale"&&pixelsPerWorld>=180&&
   skinEvidenceRegionAt({x:p.x,y:p.y})==="thin-skin-reference"&&
   Math.abs(point.y/0.31-Math.round(point.y/0.31))<.10)
   candidate="melanocyte";
 }
 return candidate;
}
