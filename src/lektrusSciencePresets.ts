import type {Item} from "./boardModel";
import {makeMathPresetItem} from "./lektrusMathPresets";

/** Editable classroom diagrams. No simulations or solved numerical answers.
 * Each diagram is an ordinary graph object, retaining undo, saves and realtime.
 */
export type SciencePresetId =
  | "physics-forces" | "physics-incline" | "physics-optics" | "physics-motion"
  | "chem-water" | "chem-carbon-dioxide" | "chem-methane" | "chem-atom";

type Vertex=[number,number,string];
type Edge=[number,number,"segment"|"ray"|"line",string?];
const pt=(x:number,y:number,label:string):Vertex=>[x,y,label];
const edge=(a:number,b:number,kind:"segment"|"ray"|"line"="segment",label=""):Edge=>[a,b,kind,label];

export function makeSciencePresetItem(id:SciencePresetId,x:number,y:number,createId:()=>string):Item{
  const graph=makeMathPresetItem("blank",x,y,createId());
  const base:Item={...graph,graphPurpose:"geometry",graphAxisMode:"none",graphGrid:false,
    graphSnap:false,graphShowLabels:true,graphShowCurve:false,
    graphSegments:[],graphAngles:[],graphCircles:[],graphPolygons:[],graphMidpoints:[],
    graphXMin:-7,graphXMax:7,graphYMin:-5,graphYMax:5,width:500,height:360};
  if(id==="physics-motion"){
    return {...graph,text:"График движения",graphPurpose:"coordinates",
      graphAxisMode:"both",graphType:"linear",graphShowCurve:false,
      graphExpression:"",graphConnectPoints:true,graphGrid:true,
      graphXMin:0,graphXMax:12,graphYMin:0,graphYMax:10,
      graphPoints:[pt(0,0,"").slice(0,2),pt(3,2,"").slice(0,2),pt(7,6,"").slice(0,2)].map(([px,py])=>({x:px,y:py,label:""})),
      graphSegments:[]};
  }
  let title="",vertices:Vertex[]=[],edges:Edge[]=[],polygons:number[][]=[];
  switch(id){
    case "physics-forces":
      title="Механика: силы на тело";
      vertices=[pt(0,0,"O"),pt(0,4,"N"),pt(0,-4,"mg"),pt(4,0,"F"),pt(-3,0,"Fтр")];
      edges=[edge(0,1,"ray"),edge(0,2,"ray"),edge(0,3,"ray"),edge(0,4,"ray")];break;
    case "physics-incline":
      title="Механика: наклонная плоскость";
      vertices=[pt(-5,-3,"A"),pt(5,-3,"B"),pt(5,3,"C"),pt(1,-.5,"O"),pt(1,3.8,"N"),pt(1,-4,"mg"),pt(4,1.5,"F")];
      edges=[edge(0,1),edge(1,2),edge(2,0),edge(3,4,"ray"),edge(3,5,"ray"),edge(3,6,"ray")];break;
    case "physics-optics":
      title="Оптика: лучи и зеркало";
      vertices=[pt(-5,0,"A"),pt(0,0,"O"),pt(4,4,"B"),pt(4,-4,"C"),pt(0,-4,""),pt(0,4,"")];
      edges=[edge(0,1,"ray","Падающий луч"),edge(1,2,"ray","Отражённый луч"),
        edge(1,3,"ray","Продолжение"),edge(4,5,"segment","Зеркало")];break;
    case "chem-water":
      title="Химическая структура: H₂O";
      vertices=[pt(0,0,"O"),pt(-3,-2,"H"),pt(3,-2,"H")];
      edges=[edge(0,1),edge(0,2)];break;
    case "chem-carbon-dioxide":
      title="Химическая структура: CO₂";
      vertices=[pt(-4,0,"O"),pt(0,0,"C"),pt(4,0,"O"),pt(-4,.25,""),pt(0,.25,""),pt(4,.25,"")];
      edges=[edge(0,1),edge(1,2),edge(3,4),edge(4,5)];break;
    case "chem-methane":
      title="Химическая структура: CH₄";
      vertices=[pt(0,0,"C"),pt(-3,0,"H"),pt(3,0,"H"),pt(0,3.5,"H"),pt(0,-3.5,"H")];
      edges=[edge(0,1),edge(0,2),edge(0,3),edge(0,4)];break;
    case "chem-atom":
      title="Строение атома: схема";
      vertices=[pt(0,0,"Ядро"),pt(2.6,0,"e⁻"),pt(0,2.6,"e⁻"),pt(-2.6,0,"e⁻")];
      edges=[];
      break;
  }
  return {...base,text:title,
    graphPoints:vertices.map(([px,py,label])=>({x:px,y:py,label})),
    graphSegments:edges.map(([a,b,kind,label])=>({a,b,kind,label:label||"",measure:false})),
    graphPolygons:polygons.map(points=>({points,label:"",measure:false})),
    graphCircles:id==="chem-atom"?[{center:0,edge:1,label:"Электронная оболочка",measure:false}]:[]};
}
