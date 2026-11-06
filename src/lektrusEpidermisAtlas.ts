/** Reference-led, clickable epidermis in the continuous body coordinate frame.
 * Four strata belong to thin hairy skin. They are shown in intentionally
 * expanded, *non-calibrated* cutaway width, not 1:1 to human body height.
 * The biological relationships are derived from OpenStax A&P 2e §5.1,
 * Leeds Histology Guide "Epidermis" and NCBI Bookshelf NBK537325.
 */
import {SKIN_ILLUSTRATIVE_LAYERS,skinEvidenceRegionAt} from "./lektrusSkinEvidenceModel";
import type {SkinSectionContour,SkinSectionPoint} from "./lektrusSkinVectorSections";
import {thickSkinInfluence,thickSkinBandsAt,thickSkinBoundaryAt,
 type ThickSkinSample} from "./lektrusThickEpidermis";

export type EpidermisId="epidermis"|"corneum"|"lucidum"|"granulosum"|"spinosum"|
 "basale"|"keratinocyte"|"melanocyte"|"basement";
export type EpidermisStratum=Extract<EpidermisId,
 "corneum"|"lucidum"|"granulosum"|"spinosum"|"basale">;
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
 lucidum:{id:"lucidum",name:"Блестящий слой",latin:"Stratum lucidum",
  summary:"Тонкая почти прозрачная прослойка уплощённых безъядерных клеток между роговым и зернистым слоями. Выделяется только в толстой коже ладоней и подошв.",
  function:"Участвует в защитном барьере кожи, подвергающейся сильному трению и давлению.",
  microAppearance:"В толстой коже видна как узкая, светлая, полупрозрачная полоса под толстым роговым слоем. На обычном H&E-препарате иногда различима с трудом, поэтому её нельзя рисовать гигантской яркой лентой.",
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
export const EPIDERMIS_THICK_STRATA_ORDER=[
 "corneum","lucidum","granulosum","spinosum","basale"
] as const;
export const EPIDERMIS_LAYER_FRACTIONS=[
 {id:"corneum",start:0,end:SKIN_ILLUSTRATIVE_LAYERS.granulosumStart,color:"#f0d2c5"},
 {id:"granulosum",start:SKIN_ILLUSTRATIVE_LAYERS.granulosumStart,
  end:SKIN_ILLUSTRATIVE_LAYERS.spinosumStart,color:"#ad88a8"},
 {id:"spinosum",start:SKIN_ILLUSTRATIVE_LAYERS.spinosumStart,
  end:SKIN_ILLUSTRATIVE_LAYERS.basaleStart,color:"#e8bbc8"},
 {id:"basale",start:SKIN_ILLUSTRATIVE_LAYERS.basaleStart,
  end:SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd,color:"#987293"}
] as const;
/** Shallow, smoothly registered rete ridges of representative thin skin.
 * Same geometry drives painting AND picking. Not a physical thickness scale. */
export function epidermisStratumEdge(y:number,fraction:number):number{
 const width=SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd;
 if(fraction<=0)return fraction;
 // Thin hairy skin has low, gentle rete ridges. The previous rapid
 // oscillations produced large staircase-like purple bumps at 220–360x
 // that resembled pathological tissue rather than ordinary epidermis.
 const wave=.00045*Math.sin(y*12.1+.4)+
  .00022*Math.sin(y*19.3+1.7);
 return fraction+wave*(fraction/width)**4;
}
/** Exact same melanocyte anchor is painted and selected by the pointer.
 * These are model locations in the representative shoulder, not biopsy data.
 */
/** A few *representative*, clickable spinous keratinocytes share the
 * same world anchors as the cell illustration. This sample is not a
 * measured population of keratinocytes on the illustrated person. */
export function epidermisKeratinocyteCenter(
 contour:SkinSectionContour,anchorY:number
):EpidermisPoint|null{
 const p=sectionAtY(contour,anchorY);
 if(!p||skinEvidenceRegionAt({x:p.x,y:anchorY})!=="thin-skin-reference")
  return null;
 const fraction=(SKIN_ILLUSTRATIVE_LAYERS.spinosumStart+
  SKIN_ILLUSTRATIVE_LAYERS.basaleStart)/2;
 return {x:p.x+contour.inward*p.depth*
  epidermisStratumEdge(anchorY,fraction),y:anchorY};
}
export function epidermisMelanocyteCenter(
 contour:SkinSectionContour,anchorY:number
):EpidermisPoint|null{
 const p=sectionAtY(contour,anchorY);
 if(!p||skinEvidenceRegionAt({x:p.x,y:anchorY})!=="thin-skin-reference")
  return null;
 const fraction=(SKIN_ILLUSTRATIVE_LAYERS.basaleStart+
  SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd)/2;
 return {x:p.x+contour.inward*p.depth*
  epidermisStratumEdge(anchorY,fraction),y:anchorY};
}
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
 pixelsPerWorld:number,thickSample:ThickSkinSample|null=null,
 allowCells=true
):EpidermisId|null{
 const ppu=Math.max(1,pixelsPerWorld);
 // No screen-pixel halo is allowed outside painted tissue: an empty
 // fingertip or neutral body must NEVER activate an invisible epidermis.
 const tol=0;
 let candidate:EpidermisId|null=null,best=Infinity;
 for(const c of contours){
  if(point.x<c.minX-tol||point.x>c.maxX+tol||
   point.y<c.minY||point.y>c.maxY)continue;
  const p=sectionAtY(c,point.y);
  if(!p||p.depth<=.04)continue;
  const d=(point.x-p.x)*c.inward;
  const thickWeight=thickSkinInfluence(c,point.y,thickSample);
  const thickBands=thickWeight>.15?
   thickSkinBandsAt(c,point.y,thickSample):null;
  const epiFraction=thickBands?
   thickBands[thickBands.length-1].end:
   SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd;
  const epi=p.depth*(thickBands?
   thickSkinBoundaryAt(point.y,epiFraction,epiFraction,thickWeight):
   epidermisStratumEdge(point.y,epiFraction));
  if(d<0||d>epi)continue;
  const error=d<0?-d:d>epi?d-epi:0;
  if(error>=best)continue;
  best=error;
  const normalized=d/Math.max(1e-8,p.depth);
  const screenWidth=ppu*epi;
  candidate="epidermis";
  if(screenWidth<28)continue;
  if(thickBands){
   const chosen=thickBands.find(l=>l.end-l.start>.0007&&
    normalized>=thickSkinBoundaryAt(point.y,l.start,epiFraction,thickWeight)&&
    normalized<thickSkinBoundaryAt(point.y,l.end,epiFraction,thickWeight));
   candidate=chosen?.id??"epidermis";
  }else{
   const selection=EPIDERMIS_LAYER_FRACTIONS.find(l=>
    normalized>=epidermisStratumEdge(point.y,l.start)&&
    normalized<epidermisStratumEdge(point.y,l.end));
   candidate=selection?.id??"epidermis";
  }
  // Thin basement-membrane zone gets a pointer-friendly hit, but not
  // a wide fictitious anatomical band.
  if(Math.abs(d-epi)<=Math.min(.009,5/ppu)&&ppu>170)
   candidate="basement";
  // Individual representative cell glyphs become clickable only when
  // they are resolved on screen. Never treat a whole painted stripe as
  // the specific cell pictured in its scientific card.
  if(!thickBands&&allowCells&&ppu>=195&&
   skinEvidenceRegionAt({x:p.x,y:point.y})==="thin-skin-reference"){
   const n=Math.round(point.y/.23);
   const keratinocyte=epidermisKeratinocyteCenter(c,n*.23);
   if(keratinocyte){
    const dx=point.x-keratinocyte.x,dy=point.y-keratinocyte.y;
    // Same compact polygon dimensions as the drawn cell, no 5–9px
    // tolerance that could select an unseen cell outside its glyph.
    if(Math.abs(dx)<=.024&&Math.abs(dy)<=.028&&
     (dx/.025)**2+(dy/.030)**2<=1.15)candidate="keratinocyte";
   }
   const k=Math.round(point.y/.31);
   const center=epidermisMelanocyteCenter(c,k*.31);
   if(center&&
    ((point.x-center.x)/.015)**2+
    ((point.y-center.y)/.020)**2<=1)
    candidate="melanocyte";
  }
 }
 return candidate;
}
