/** Standalone human anatomy: seven raster plates, one stable camera.
 * This is distinct from the experimental biology microscope and preserves
 * existing saved microscope documents unchanged.
 */
import {HUMAN_BODY_SYSTEMS,type HumanFocusedSystem} from "./lektrusBioHumanBodySystems";
export type HumanAnatomyDiagram={
 kind:"bio-anatomy";title:string;system:HumanFocusedSystem;showDescriptions:boolean;
};
export type AnatomyCamera={scale:number;panX:number;panY:number};
export const ANATOMY_INITIAL_CAMERA:AnatomyCamera={scale:1,panX:0,panY:0};
export const ANATOMY_SPRITE_WIDTH=2520;
export const ANATOMY_PANEL_WIDTH=360;
export const ANATOMY_SPRITE_HEIGHT=600;
export const ANATOMY_CROP_WIDTH=360;
/** Each raster plate has the same exact 360×600 frame. There is no text,
 * arrow, inset or system-dependent crop offset inside the source asset.
 * Every switch changes ONLY the selected plate, never the camera.
 */
export function anatomySpritePosition(system:HumanFocusedSystem):number{
 const index=HUMAN_BODY_SYSTEMS.findIndex(s=>s.id===system);
 return index<0?0:index*100/(HUMAN_BODY_SYSTEMS.length-1);
}
export const ANATOMY_SYSTEM_DETAILS:Record<HumanFocusedSystem,{
 summary:string;organs:{name:string;detail:string;position?:{x:number;y:number}}[]
}>={
 nervous:{summary:"Координирует работу органов, движения, чувствительность и мышление.",
  organs:[
   {name:"Головной мозг",detail:"Обрабатывает информацию и регулирует деятельность организма",position:{x:0,y:-181}},
   {name:"Спинной мозг",detail:"Проводит импульсы и участвует в рефлексах",position:{x:0,y:-79}},
   {name:"Периферические нервы",detail:"Связывают центральную нервную систему с органами",position:{x:43,y:16}}]},
 respiratory:{summary:"Обеспечивает поступление кислорода и удаление углекислого газа.",
  organs:[
   {name:"Носовая полость",detail:"Очищает, согревает и увлажняет вдыхаемый воздух",position:{x:0,y:-172}},
   {name:"Гортань и трахея",detail:"Проводят воздух к бронхам",position:{x:0,y:-118}},
   {name:"Бронхи и лёгкие",detail:"Обеспечивают вентиляцию и газообмен в альвеолах",position:{x:0,y:-57}}]},
 circulatory:{summary:"Доставляет тканям кислород и питательные вещества, удаляет продукты обмена.",
  organs:[
   {name:"Сердце",detail:"Создаёт кровоток в большом и малом кругах кровообращения",position:{x:10,y:-80}},
   {name:"Артерии",detail:"Несут кровь от сердца",position:{x:28,y:48}},
   {name:"Вены",detail:"Возвращают кровь к сердцу",position:{x:-25,y:48}},
   {name:"Капилляры",detail:"Место обмена веществ между кровью и тканями"}]},
 digestive:{summary:"Перерабатывает пищу, всасывает питательные вещества и удаляет остатки.",
  organs:[
   {name:"Пищевод",detail:"Проводит пищу в желудок",position:{x:0,y:-116}},
   {name:"Желудок",detail:"Перемешивает пищу с желудочным соком",position:{x:23,y:-10}},
   {name:"Печень",detail:"Обрабатывает вещества и вырабатывает жёлчь",position:{x:-27,y:-14}},
   {name:"Тонкий и толстый кишечник",detail:"Переваривание, всасывание и формирование каловых масс",position:{x:0,y:42}}]},
 urinary:{summary:"Регулирует водно-солевой баланс и выводит продукты обмена.",
  organs:[
   {name:"Почки",detail:"Фильтруют кровь и образуют мочу",position:{x:0,y:-17}},
   {name:"Мочеточники",detail:"Проводят мочу из почек в мочевой пузырь",position:{x:0,y:21}},
   {name:"Мочевой пузырь",detail:"Накапливает мочу",position:{x:0,y:60}}]},
 musculoskeletal:{summary:"Обеспечивает опору тела, защиту органов и движения.",
  organs:[
   {name:"Скелет",detail:"Кости формируют опору и защищают внутренние органы",position:{x:0,y:-61}},
   {name:"Суставы",detail:"Соединяют кости и обеспечивают подвижность",position:{x:45,y:70}},
   {name:"Скелетные мышцы",detail:"Сокращаются и приводят части тела в движение",position:{x:0,y:38}}]},
 integumentary:{summary:"Кожа защищает организм, участвует в терморегуляции и восприятии раздражителей.",
  organs:[
   {name:"Эпидермис",detail:"Наружный защитный слой кожи",position:{x:15,y:-43}},
   {name:"Дерма",detail:"Содержит сосуды, рецепторы и железы"},
   {name:"Подкожная клетчатка",detail:"Служит для теплоизоляции и запаса энергии"},
   {name:"Волосы и ногти",detail:"Производные кожи, выполняющие защитные функции"}]}
};
export function defaultHumanAnatomy():HumanAnatomyDiagram{
 return {kind:"bio-anatomy",title:"Анатомия человека",system:"respiratory",
  showDescriptions:true};
}
export function validHumanAnatomy(value:unknown):value is HumanAnatomyDiagram{
 if(!value||typeof value!=="object")return false;
 const d=value as Record<string,unknown>;
 return d.kind==="bio-anatomy"&&typeof d.title==="string"&&
  d.title.trim().length>0&&d.title.length<=120&&
  HUMAN_BODY_SYSTEMS.some(s=>s.id===d.system)&&typeof d.showDescriptions==="boolean";
}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
export function anatomyBoundCamera(camera:AnatomyCamera,width:number,height:number):AnatomyCamera{
 const scale=clamp(camera.scale,1,3.25);
 const maxX=Math.max(0,(scale-1)*Math.max(1,width)/2);
 const maxY=Math.max(0,(scale-1)*Math.max(1,height)/2);
 return {scale,panX:clamp(camera.panX,-maxX,maxX),
  panY:clamp(camera.panY,-maxY,maxY)};
}
/** A zoom preserves the precise point under the mouse or pinch midpoint.
 * The selected anatomical SYSTEM is never an input to this calculation. */
export function anatomyZoomAt(camera:AnatomyCamera,newScale:number,
 point:{x:number;y:number},width:number,height:number):AnatomyCamera{
 const scale=clamp(newScale,1,3.25);
 const ratio=scale/camera.scale;
 const x=point.x-width/2,y=point.y-height/2;
 return anatomyBoundCamera({scale,
  panX:x-(x-camera.panX)*ratio,
  panY:y-(y-camera.panY)*ratio},width,height);
}
export function anatomyPan(camera:AnatomyCamera,dx:number,dy:number,width:number,height:number){
 return anatomyBoundCamera({...camera,panX:camera.panX+dx,panY:camera.panY+dy},width,height);
}
