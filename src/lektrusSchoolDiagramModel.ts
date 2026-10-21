/** Curriculum-aligned, editable teaching illustrations. Only the school content
 * explicitly entered by a teacher is represented; no invented lab measurements. */
import {defaultProgrammingDiagram,validateProgrammingDiagram,type ProgrammingDiagram} from "./lektrusProgrammingModel";
import {defaultLogicCircuit,validateLogicCircuit,type LogicCircuitDiagram} from "./lektrusLogicCircuitModel";
import {newBiologyExtension,isBiologyExtensionId,validateBiologyExtension,type BiologyExtensionDiagram,type BiologyExtensionId} from "./lektrusBiologyExtensionModel";
import {createAtlasDocument,validAtlasDocument,type AtlasDocument} from "./lektrusAtlasModel";
import {newLanguageSocialDiagram,isLanguageSocialId,validateLanguageSocialDiagram,type LanguageSocialDiagram,type LanguageSocialId} from "./lektrusLanguageSocialModel";
import {createRussianSchoolDiagram,isRussianToolId,validateRussianSchoolDiagram,type RussianSchoolDiagram,type RussianToolId} from "./lektrusRussianSchoolModel";
import {createApprovedSchoolDiagram,isApprovedSchoolId,validateApprovedSchoolDiagram,type ApprovedSchoolDiagram,type ApprovedSchoolId} from "./lektrusApprovedSchoolModel";
import {defaultFurtherDiagram,isFurtherId,validFurtherDiagram,type FurtherDiagram,type FurtherSchoolId} from "./lektrusFurtherSchoolModel";
import {defaultNextSchoolDiagram,isNextSchoolId,validNextSchoolDiagram,type NextSchoolDiagram,type NextSchoolId} from "./lektrusNextSchoolModel";
export type SchoolDiagramId="info-programming"|"info-circuit"|BiologyExtensionId|"bio-division"|"info-encoding"|"bio-genetics"|"info-logic"|"history-atlas"|"maps-atlas"|"contour-atlas"|"bio-cell"|"bio-food-chain"|"geo-climate"|"history-timeline"|NextSchoolId|FurtherSchoolId|ApprovedSchoolId|RussianToolId|LanguageSocialId;
export type CellOrganelle="wall"|"membrane"|"cytoplasm"|"nucleus"|"vacuole"|"chloroplast"|"mitochondria";
export type FoodRole="producer"|"consumer"|"decomposer";
export type SchoolDiagram=
 |{kind:"cell";cell:"plant"|"animal";visible:CellOrganelle[];showLabels:boolean;title:string}
 |{kind:"food-chain";title:string;organisms:{id:string;name:string;role:FoodRole}[];showRoles:boolean}
 |{kind:"climate";title:string;months:{temperature:number;precipitation:number}[];showLegend:boolean}
 |{kind:"division";title:string;phase:"interphase"|"prophase"|"metaphase"|"anaphase"|"telophase";showLabels:boolean}
 |{kind:"encoding";title:string;message:string;mode:"unicode"|"utf8";showCodes:boolean}
 |{kind:"genetics";title:string;parentA:string;parentB:string;showAnswers:boolean}
 |{kind:"logic";title:string;operation:"and"|"or"|"xor"|"implication"|"equivalence";showAnswers:boolean;inputA?:0|1;inputB?:0|1}
 |{kind:"timeline";title:string;events:{id:string;year:number;label:string}[];showEra:boolean}
 |ProgrammingDiagram|LogicCircuitDiagram|BiologyExtensionDiagram|NextSchoolDiagram|FurtherDiagram|ApprovedSchoolDiagram|RussianSchoolDiagram|LanguageSocialDiagram|AtlasDocument;
export const months=["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"] as const;
export const organelleTitles:Record<CellOrganelle,string>={
 wall:"Клеточная стенка",membrane:"Клеточная мембрана",cytoplasm:"Цитоплазма",
 nucleus:"Ядро",vacuole:"Вакуоль",chloroplast:"Хлоропласты",mitochondria:"Митохондрии"
};
export const ids:SchoolDiagramId[]=["info-programming","info-circuit","bio-dna","bio-taxonomy","bio-division","info-encoding","bio-genetics","info-logic","history-atlas","maps-atlas","contour-atlas","bio-cell","bio-food-chain","geo-climate","history-timeline","ru-syntax","info-flowchart","info-place-value","bio-organ-systems","geo-relief-profile","ru-morphemes","history-family-tree","language-flashcards","ru-morphology","ru-phonetics","ru-orthography","ru-sentence-builder","language-sentence-builder","civics-structure","literature-analysis"];
export function isSchoolDiagramId(value:string|undefined):value is SchoolDiagramId{
 return ids.includes(value as SchoolDiagramId);
}
export function makeSchoolDiagram(id:SchoolDiagramId):SchoolDiagram{
 if(id==="history-atlas")return createAtlasDocument("history");
 if(id==="maps-atlas")return createAtlasDocument("geography");
 if(id==="contour-atlas")return {...createAtlasDocument("geography"),title:"Контурная карта",mode:"contour"};
 if(id==="info-programming")return defaultProgrammingDiagram();
 if(id==="info-circuit")return defaultLogicCircuit();
 if(isBiologyExtensionId(id))return newBiologyExtension(id);
 if(isLanguageSocialId(id))return newLanguageSocialDiagram(id);
 if(isRussianToolId(id))return createRussianSchoolDiagram(id);
 if(isApprovedSchoolId(id))return createApprovedSchoolDiagram(id);
 if(isFurtherId(id))return defaultFurtherDiagram(id);
 if(isNextSchoolId(id))return defaultNextSchoolDiagram(id);
 switch(id){
  case "bio-division":return {kind:"division",title:"Митоз",phase:"metaphase",showLabels:true};
  case "info-encoding":return {kind:"encoding",title:"Кодирование текста",message:"АБВ",mode:"unicode",showCodes:true};
  case "bio-genetics":return {kind:"genetics",title:"Решётка Пеннета",parentA:"Aa",parentB:"Aa",showAnswers:false};
  case "info-logic":return {kind:"logic",title:"Таблица истинности",operation:"and",showAnswers:false,inputA:1,inputB:0};
  case "bio-cell":return {kind:"cell",cell:"plant",showLabels:true,title:"Растительная клетка",
   visible:["wall","membrane","cytoplasm","nucleus","vacuole","chloroplast","mitochondria"]};
  case "bio-food-chain":return {kind:"food-chain",title:"Цепь питания",showRoles:false,organisms:[
   {id:"a",name:"Трава",role:"producer"},{id:"b",name:"Полёвка",role:"consumer"},{id:"c",name:"Сова",role:"consumer"}]};
  case "geo-climate":return {kind:"climate",title:"Климатограмма · учебный пример",showLegend:true,
   months:[-9,-8,-2,6,13,18,20,18,12,5,-2,-7].map((t,i)=>({temperature:t,precipitation:[28,25,30,37,48,69,77,66,49,42,35,31][i]}))};
  case "history-timeline":return {kind:"timeline",title:"Лента времени",showEra:true,events:[]};
 }
}
const label=(s:unknown,length=90)=>typeof s==="string"&&s.length<=length;
const number=(value:unknown,lo:number,hi:number)=>typeof value==="number"&&Number.isFinite(value)&&value>=lo&&value<=hi;
export function isSchoolDiagram(value:unknown):value is SchoolDiagram{
 if(!value||typeof value!=="object")return false;
 const d=value as Record<string,unknown>;
 if(!label(d.title,120))return false;
 switch(d.kind){
  case "division":return ["interphase","prophase","metaphase","anaphase","telophase"].includes(d.phase as string)&&typeof d.showLabels==="boolean";
  case "encoding":return typeof d.message==="string"&&[...d.message].length<=12&&["unicode","utf8"].includes(d.mode as string)&&typeof d.showCodes==="boolean";
  case "genetics":return typeof d.showAnswers==="boolean"&&typeof d.parentA==="string"&&typeof d.parentB==="string"&&/^[A-Za-z]{2}$/.test(d.parentA)&&/^[A-Za-z]{2}$/.test(d.parentB)&&d.parentA.toLowerCase()===d.parentB.toLowerCase()&&d.parentA[0].toLowerCase()===d.parentA[1].toLowerCase()&&d.parentB[0].toLowerCase()===d.parentB[1].toLowerCase();
  case "logic":return typeof d.showAnswers==="boolean"&&["and","or","xor","implication","equivalence"].includes(d.operation as string)&&
   (d.inputA===undefined||d.inputA===0||d.inputA===1)&&
   (d.inputB===undefined||d.inputB===0||d.inputB===1);
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
   return typeof d.showEra==="boolean"&&Array.isArray(d.events)&&d.events.length<=8&&
    d.events.every((v:unknown)=>!!v&&typeof v==="object"&&
     label((v as {id:unknown}).id,64)&&label((v as {label:unknown}).label,90)&&
     (v as {label:string}).label.trim().length>0&&
     Number.isInteger((v as {year:number}).year)&&
     number((v as {year:number}).year,-3000,2100)&&(v as {year:number}).year!==0)&&
    new Set(d.events.map((v:{id:string})=>v.id)).size===d.events.length;
  default:return validateProgrammingDiagram(value)||validateLogicCircuit(value)||validateBiologyExtension(value)||validNextSchoolDiagram(value)||validFurtherDiagram(value)||validateApprovedSchoolDiagram(value)||validateRussianSchoolDiagram(value)||validateLanguageSocialDiagram(value)||validAtlasDocument(value);
 }
}
export function safeSchoolDiagram(value:unknown,id:SchoolDiagramId):SchoolDiagram{
 return isSchoolDiagram(value)?value:makeSchoolDiagram(id);
}
export function prettyYear(year:number,showEra=true):string{
 return year<0?`${Math.abs(year)}${showEra?" до н. э.":""}`:`${year}${showEra?" г.":""}`;
}
