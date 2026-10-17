import type {Item} from "./boardModel";
import {normalizeLektrusSubject} from "./lektrusSchoolSubjects";
import {makeMathPresetItem} from "./lektrusMathPresets";
import {makeSciencePresetItem} from "./lektrusSciencePresets";
import {scienceDefaultPreset,scienceToolGroups,type ScienceToolId} from "./lektrusScienceCatalog";

export type SubjectToolId="math-coordinate"|"math-fractions"|"math-formula"|"math-geometry"|"chem-periodic-table"|ScienceToolId;
export type SubjectToolDefinition={id:SubjectToolId;label:string;description:string;subjects:string[];group:string};

/** A tool is a distinct editing workflow; its examples are selected INSIDE the editor. */
export const subjectToolRegistry:SubjectToolDefinition[]=[
  {id:"math-formula",label:"Математическая формула",description:"Степени, корни и математические символы",group:"Математические инструменты",subjects:["математика"]},
  {id:"math-geometry",label:"Построение фигур",description:"Плоские и объёмные фигуры, стороны и углы",group:"Математические инструменты",subjects:["математика"]},
  {id:"math-coordinate",label:"Координатная плоскость",description:"Функции, точки, числовая прямая и графики",group:"Математические инструменты",subjects:["математика"]},
  {id:"math-fractions",label:"Дроби",description:"Круг и полоска с наглядными частями",group:"Математические инструменты",subjects:["математика"]},
  {id:"chem-periodic-table",label:"Периодическая система",description:"118 элементов, поиск, семейства и выделение элементов для урока",group:"Химия · элементы",subjects:["химия"]},
  ...scienceToolGroups.map(group=>({id:group.id,label:group.label,description:group.description,
    group:group.group,subjects:[group.subject==="physics"?"физика":"химия"]}))
];

export function subjectToolsFor(subject:string):SubjectToolDefinition[]{
  const key=normalizeLektrusSubject(subject).toLocaleLowerCase("ru-RU");
  return subjectToolRegistry.filter(tool=>tool.subjects.includes(key));
}

export function makeSubjectToolItem(id:SubjectToolId,x:number,y:number,createId:()=>string):Item{
  const sciencePreset=scienceDefaultPreset(id);
  if(sciencePreset)return makeSciencePresetItem(sciencePreset,x,y,createId);
  if(id==="chem-periodic-table"){
    const base=makeMathPresetItem("blank",x,y,createId());
    return {...base,text:"Периодическая система химических элементов",
      x:x-420,y:y-260,width:840,height:520,
      graphFigureId:"chem-periodic",graphPurpose:"geometry",
      graphAxisMode:"none",graphGrid:false,graphSnap:false,
      graphPoints:[],graphSegments:[],sciencePeriodicHighlights:[],sciencePeriodicShowNames:true};
  }
  if(id==="math-formula")return {id:createId(),kind:"formula",text:"x² + y² = r²",x:x-190,y:y-70,width:380,height:140,fontSize:28,color:"#20242c"};
  if(id==="math-fractions")return {
    id:createId(),kind:"fraction",text:"Дроби",x:x-180,y:y-130,width:360,height:260,
    fractionMode:"circle",fractionNumerator:3,fractionDenominator:4,color:"#5074dc"
  };
  return makeMathPresetItem(id==="math-geometry"?"free":"blank",x,y,createId());
}
