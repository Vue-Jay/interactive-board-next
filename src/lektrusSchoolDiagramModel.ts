/** Curriculum-aligned, editable teaching illustrations. Only the school content
 * explicitly entered by a teacher is represented; no invented lab measurements. */
import {defaultFurtherDiagram,isFurtherId,validFurtherDiagram,type FurtherDiagram,type FurtherSchoolId} from "./lektrusFurtherSchoolModel";
import {defaultNextSchoolDiagram,isNextSchoolId,validNextSchoolDiagram,type NextSchoolDiagram,type NextSchoolId} from "./lektrusNextSchoolModel";
export type SchoolDiagramId="bio-cell"|"bio-food-chain"|"geo-climate"|"history-timeline"|NextSchoolId|FurtherSchoolId;
export type CellOrganelle="wall"|"membrane"|"cytoplasm"|"nucleus"|"vacuole"|"chloroplast"|"mitochondria";
export type FoodRole="producer"|"consumer"|"decomposer";
export type SchoolDiagram=
 |{kind:"cell";cell:"plant"|"animal";visible:CellOrganelle[];showLabels:boolean;title:string}
 |{kind:"food-chain";title:string;organisms:{id:string;name:string;role:FoodRole}[];showRoles:boolean}
 |{kind:"climate";title:string;months:{temperature:number;precipitation:number}[];showLegend:boolean}
 |{kind:"timeline";title:string;events:{id:string;year:number;label:string}[];showEra:boolean}
 |NextSchoolDiagram|FurtherDiagram;
export const months=["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"] as const;
export const organelleTitles:Record<CellOrganelle,string>={
 wall:"Клеточная стенка",membrane:"Клеточная мембрана",cytoplasm:"Цитоплазма",
 nucleus:"Ядро",vacuole:"Вакуоль",chloroplast:"Хлоропласты",mitochondria:"Митохондрии"
};
export const ids:SchoolDiagramId[]=["bio-cell","bio-food-chain","geo-climate","history-timeline","ru-syntax","info-flowchart","info-place-value","bio-organ-systems","geo-relief-profile"];
export function isSchoolDiagramId(value:string|undefined):value is SchoolDiagramId{
 return ids.includes(value as SchoolDiagramId);
}
export function makeSchoolDiagram(id:SchoolDiagramId):SchoolDiagram{
 if(isFurtherId(id))return defaultFurtherDiagram(id);
 if(isNextSchoolId(id))return defaultNextSchoolDiagram(id);
 switch(id){
  case "bio-cell":return {kind:"cell",cell:"plant",showLabels:true,title:"Растительная клетка",
   visible:["wall","membrane","cytoplasm","nucleus","vacuole","chloroplast","mitochondria"]};
  case "bio-food-chain":return {kind:"food-chain",title:"Цепь питания",showRoles:false,organisms:[
   {id:"a",name:"Трава",role:"producer"},{id:"b",name:"Полёвка",role:"consumer"},{id:"c",name:"Сова",role:"consumer"}]};
  case "geo-climate":return {kind:"climate",title:"Климатограмма · учебный пример",showLegend:true,
   months:[-9,-8,-2,6,13,18,20,18,12,5,-2,-7].map((t,i)=>({temperature:t,precipitation:[28,25,30,37,48,69,77,66,49,42,35,31][i]}))};
  case "history-timeline":return {kind:"timeline",title:"Основные исторические события",showEra:true,
   events:[{id:"a",year:988,label:"Крещение Руси"},{id:"b",year:1240,label:"Невская битва"},
   {id:"c",year:1380,label:"Куликовская битва"},{id:"d",year:1612,label:"Освобождение Москвы"}]};
 }
}
const label=(s:unknown,length=90)=>typeof s==="string"&&s.length<=length;
const number=(value:unknown,lo:number,hi:number)=>typeof value==="number"&&Number.isFinite(value)&&value>=lo&&value<=hi;
export function isSchoolDiagram(value:unknown):value is SchoolDiagram{
 if(!value||typeof value!=="object")return false;
 const d=value as Record<string,unknown>;
 if(!label(d.title,120))return false;
 switch(d.kind){
  case "cell":{
   if(d.cell!=="plant"&&d.cell!=="animal"||typeof d.showLabels!=="boolean"||
      !Array.isArray(d.visible)||d.visible.length>7)return false;
   const choices=d.cell==="plant"?Object.keys(organelleTitles):["membrane","cytoplasm","nucleus","mitochondria"];
   return d.visible.every(v=>typeof v==="string"&&choices.includes(v))&&new Set(d.visible).size===d.visible.length;
  }
  case "food-chain":
   return typeof d.showRoles==="boolean"&&Array.isArray(d.organisms)&&d.organisms.length>=2&&d.organisms.length<=6&&
    d.organisms.every((v:unknown)=>!!v&&typeof v==="object"&&label((v as {name:unknown}).name,45)&&
     label((v as {id:unknown}).id,64)&&["producer","consumer","decomposer"].includes((v as {role:string}).role)&&
     (v as {name:string}).name.trim().length>0)&&
    new Set(d.organisms.map((v:{id:string})=>v.id)).size===d.organisms.length;
  case "climate":
   return typeof d.showLegend==="boolean"&&Array.isArray(d.months)&&d.months.length===12&&
    d.months.every((m:unknown)=>!!m&&typeof m==="object"&&
     number((m as {temperature:number}).temperature,-70,60)&&
     number((m as {precipitation:number}).precipitation,0,1000));
  case "timeline":
   return typeof d.showEra==="boolean"&&Array.isArray(d.events)&&d.events.length>=2&&d.events.length<=8&&
    d.events.every((v:unknown)=>!!v&&typeof v==="object"&&
     label((v as {id:unknown}).id,64)&&label((v as {label:unknown}).label,90)&&
     (v as {label:string}).label.trim().length>0&&
     Number.isInteger((v as {year:number}).year)&&
     number((v as {year:number}).year,-3000,2100)&&(v as {year:number}).year!==0)&&
    new Set(d.events.map((v:{id:string})=>v.id)).size===d.events.length;
  default:return validNextSchoolDiagram(value)||validFurtherDiagram(value);
 }
}
export function safeSchoolDiagram(value:unknown,id:SchoolDiagramId):SchoolDiagram{
 return isSchoolDiagram(value)?value:makeSchoolDiagram(id);
}
export function prettyYear(year:number,showEra=true):string{
 return year<0?`${Math.abs(year)}${showEra?" до н. э.":""}`:`${year}${showEra?" г.":""}`;
}
