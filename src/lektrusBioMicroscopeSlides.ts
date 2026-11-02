/** Genuine photographed microscope slides plus a deterministic digital stage.
 * This is NOT a claim of calibrated optical magnification or z-stack focus.
 * Image links are to individually reviewed Wikimedia Commons file pages;
 * downloads load only on demand and never silently replace a species image.
 */
export type BioSlide={
 id:string; name:string; subject:string; author:string;license:string;
 source:string;image:string;detail:string;nativeMagnification?:string;
};
const file=(name:string)=>"https://commons.wikimedia.org/wiki/Special:FilePath/"+encodeURIComponent(name)+"?width=1600";
const page=(name:string)=>"https://commons.wikimedia.org/wiki/File:"+encodeURIComponent(name);
export const BIO_MICROSCOPE_SLIDES:readonly BioSlide[]=[
 {id:"pine",name:"Хвоя сосны · поперечный срез",subject:"Pinus sylvestris",author:"Lord of Konrad",license:"CC0",
  source:page("PineNeedleCross.png"),image:file("PineNeedleCross.png"),
  detail:"Настоящий микроскопический препарат хвои сосны обыкновенной. Не имитация реальных размеров."},
 {id:"epidermis",name:"Эпидермис луковицы",subject:"Allium cepa",author:"SaraKasa",license:"CC BY 4.0",
  source:page("Onion_epidermis.jpg"),image:file("Onion_epidermis.jpg"),
  detail:"Микрофотография клеточных стенок эпидермиса луковицы лука. На исходном снимке ядра не видны."},
 {id:"stomata",name:"Лист с устьицами",subject:"Лист растения (вид не указан автором)",author:"Ivan Bachev",license:"CC BY 4.0",
  source:page("Leaf_cells_with_stomata.jpg"),image:file("Leaf_cells_with_stomata.jpg"),
  detail:"Световая микрофотография эпидермиса листа и устьиц. Не приписывается определённому виду."},
 {id:"skeletal",name:"Поперечнополосатая мышечная ткань",subject:"Skeletal muscle",author:"Veeresh likhitha",license:"CC BY-SA 4.0",
  source:page("Skeletal_muscle_histology.jpg"),image:file("Skeletal_muscle_histology.jpg"),
  detail:"Реальный гистологический срез скелетной мышечной ткани, видны поперечная исчерченность и периферические ядра."},
 {id:"smooth",name:"Гладкая мышечная ткань",subject:"Smooth muscle",author:"Juan Carlos Fonseca Mata",license:"CC BY-SA 4.0",
  source:page("Smooth_muscle_-_histology.jpg"),image:file("Smooth_muscle_-_histology.jpg"),
  detail:"Микрофотография гладкой мышцы, не следует путать с поперечнополосатыми волокнами."}
] as const;
export const microscopeClamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
export type BioStageView={x:number;y:number;zoom:number};
export function bioStageBound(view:BioStageView,width:number,height:number):BioStageView{
 const z=microscopeClamp(view.zoom,1,12);
 const xMax=Math.max(0,(z-1)*Math.max(1,width)/2);
 const yMax=Math.max(0,(z-1)*Math.max(1,height)/2);
 return {zoom:z,x:microscopeClamp(view.x,-xMax,xMax),y:microscopeClamp(view.y,-yMax,yMax)};
}
/** Zoom around the cursor/gesture midpoint, keeping its image point fixed. */
export function bioStageZoomAt(view:BioStageView,zoom:number,cx:number,cy:number,width:number,height:number):BioStageView{
 const z=microscopeClamp(zoom,1,12),factor=z/Math.max(1,view.zoom);
 return bioStageBound({zoom:z,x:cx-(cx-view.x)*factor,y:cy-(cy-view.y)*factor},width,height);
}
export function bioStageMove(view:BioStageView,dx:number,dy:number,width:number,height:number):BioStageView{
 return bioStageBound({...view,x:view.x+dx,y:view.y+dy},width,height);
}
