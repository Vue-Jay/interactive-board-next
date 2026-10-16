import type {Item} from "./boardModel";

export type MathPresetId =
  | "blank" | "linear" | "quadratic" | "sine" | "cosine"
  | "number-line" | "triangle" | "quadrilateral" | "angle"
  | "circle" | "unit-circle";

export type MathPreset = {
  id:MathPresetId; title:string; subtitle:string; group:"Функции"|"Числа и координаты"|"Геометрия"|"Тригонометрия";
};
export const mathPresets:MathPreset[]=[
  {id:"blank",title:"Чистая плоскость",subtitle:"Оси, сетка и свободные точки",group:"Числа и координаты"},
  {id:"number-line",title:"Числовая прямая",subtitle:"Числа и границы промежутка",group:"Числа и координаты"},
  {id:"linear",title:"Линейная функция",subtitle:"y = 2x + 1",group:"Функции"},
  {id:"quadratic",title:"Парабола",subtitle:"y = x² − 4x + 3",group:"Функции"},
  {id:"sine",title:"Синусоида",subtitle:"y = sin(x)",group:"Функции"},
  {id:"cosine",title:"Косинусоида",subtitle:"y = cos(x)",group:"Функции"},
  {id:"triangle",title:"Треугольник",subtitle:"Подвижные вершины и заданные стороны",group:"Геометрия"},
  {id:"quadrilateral",title:"Четырёхугольник",subtitle:"Четыре вершины и параметры условия",group:"Геометрия"},
  {id:"angle",title:"Угол",subtitle:"Лучи и угол, заданный в условии",group:"Геометрия"},
  {id:"circle",title:"Окружность",subtitle:"Центр и изменяемый радиус",group:"Геометрия"},
  {id:"unit-circle",title:"Единичная окружность",subtitle:"π, sin, cos и угол в радианах",group:"Тригонометрия"}
];

export function makeMathPresetItem(id:MathPresetId,x:number,y:number,objectId:string):Item {
  const title=mathPresets.find(p=>p.id===id)?.title??"Координатная плоскость";
  const graph:Item={
    id:objectId,kind:"graph",text:title,x:x-260,y:y-170,width:520,height:340,
    graphPurpose:"coordinates",graphAxisMode:"both",graphType:"quadratic",
    graphExpression:"",graphShowCurve:false,
    graphConnectPoints:false,graphA:1,graphB:0,graphC:0,
    graphXMin:-10,graphXMax:10,graphYMin:-6,graphYMax:6,
    graphGrid:true,graphGridStep:1,graphSnap:true,graphAxisLabels:true,
    graphShowLabels:true,graphPoints:[],graphProjections:false,
    graphSegments:[],graphCircles:[],graphAngles:[],
    graphPolygons:[],graphMidpoints:[],
    graphIntervalStartClosed:true,graphIntervalEndClosed:true,color:"#4267ce"
  };
  if(id==="blank")return {...graph,text:"Координатная плоскость"};
  if(id==="linear")return {...graph,graphPurpose:"function",graphType:"linear",graphExpression:"2*x + 1",graphShowCurve:true};
  if(id==="quadratic")return {...graph,graphPurpose:"function",graphType:"quadratic",graphExpression:"x^2 - 4*x + 3",graphShowCurve:true};
  if(id==="sine"||id==="cosine")return {...graph,graphPurpose:"function",graphType:id==="sine"?"sin":"cos",graphExpression:id==="sine"?"sin(x)":"cos(x)",graphShowCurve:true,graphXMin:-7,graphXMax:7,graphYMin:-2,graphYMax:2};
  if(id==="number-line")return {
    ...graph,graphPurpose:"number-line",graphAxisMode:"x",graphGrid:false,
    graphXMin:-10,graphXMax:10,graphYMin:-3,graphYMax:3,
    graphIntervalStartClosed:false,graphIntervalEndClosed:true,
    graphConnectPoints:true,graphPoints:[{x:-2,y:0,label:""},{x:3,y:0,label:""}]
  };
  if(id==="triangle")return {
    ...graph,graphPurpose:"geometry",graphAxisMode:"none",graphGrid:false,
    graphPoints:[{x:-4,y:-3,label:"A"},{x:4,y:-3,label:"B"},{x:0,y:3,label:"C"}],
    graphPolygons:[{points:[0,1,2],label:"ABC",measure:true}]
  };
  if(id==="quadrilateral")return {
    ...graph,graphPurpose:"geometry",graphAxisMode:"none",graphGrid:false,
    graphPoints:[{x:-4,y:-3,label:"A"},{x:4,y:-3,label:"B"},{x:3,y:3,label:"C"},{x:-3,y:3,label:"D"}],
    graphPolygons:[{points:[0,1,2,3],label:"ABCD",measure:true}]
  };
  if(id==="angle")return {
    ...graph,graphPurpose:"geometry",graphAxisMode:"none",graphGrid:false,
    graphPoints:[{x:4,y:0,label:"A"},{x:0,y:0,label:"O"},{x:3,y:4,label:"B"}],
    graphSegments:[{a:1,b:0,kind:"ray",label:"",measure:false},{a:1,b:2,kind:"ray",label:"",measure:false}],
    graphAngles:[{a:0,vertex:1,b:2,label:"∠AOB"}]
  };
  if(id==="circle")return {
    ...graph,graphPurpose:"geometry",graphAxisMode:"none",graphGrid:false,
    graphPoints:[{x:0,y:0,label:"O"},{x:3,y:0,label:"R"}],
    graphCircles:[{center:0,edge:1,label:"",measure:true}]
  };
  return {
    ...graph,graphPurpose:"unit-circle",graphGrid:false,graphGridStep:.5,
    graphXMin:-2.8,graphXMax:2.8,graphYMin:-1.7,graphYMax:1.7,
    graphPoints:[
      {x:0,y:0,label:"O"},
      {x:1,y:0,label:"0"},
      {x:0,y:1,label:"π/2"},
      {x:-1,y:0,label:"π"},
      {x:0,y:-1,label:"3π/2"},
      {x:Math.SQRT1_2,y:Math.SQRT1_2,label:"π/4"}
    ],
    graphCircles:[{center:0,edge:1,label:"",measure:false}],
    graphSegments:[{a:0,b:5,kind:"segment",label:"",measure:false}],
    graphAngles:[{a:1,vertex:0,b:5,label:""}],
    graphProjections:true
  };
}

/** Render angles in radians with standard exact π fractions when appropriate. */
export function formatPiRadians(radians:number):string {
  if(!Number.isFinite(radians))return "";
  const tau=2*Math.PI;
  const normalized=((radians%tau)+tau)%tau;
  if(normalized<.015||Math.abs(tau-normalized)<.015)return "0";
  const fractions:Array<[number,number]>=[
    [1,6],[1,4],[1,3],[1,2],[2,3],[3,4],[5,6],[1,1],
    [7,6],[5,4],[4,3],[3,2],[5,3],[7,4],[11,6]
  ];
  for(const [n,d] of fractions)if(Math.abs(normalized-n*Math.PI/d)<.025){
    return n===1?(d===1?"π":`π/${d}`):d===1?`${n}π`:`${n}π/${d}`;
  }
  return `≈ ${(normalized/Math.PI).toFixed(2)}π`;
}
