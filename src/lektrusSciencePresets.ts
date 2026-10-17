import type {Item} from "./boardModel";
import type {CircuitSymbol} from "./ScienceCircuitGlyph";
import {makeMathPresetItem} from "./lektrusMathPresets";

/** School diagrams only: symbols and qualitative constructions, never solved work. */
export type SciencePresetId=
  |"physics-forces"|"physics-incline"|"physics-optics"|"physics-refraction"|"physics-lens"
  |"physics-motion"|"physics-speed"|"physics-circuit-series"|"physics-circuit-meters"|"physics-circuit-free"
  |"chem-water"|"chem-carbon-dioxide"|"chem-methane"|"chem-ammonia"|"chem-oxygen"|"chem-atom";

type Vertex={x:number;y:number;label:string;color?:string};
type Edge={a:number;b:number;kind:"segment"|"ray"|"line";label:string;measure:boolean;bondOrder?:1|2|3;scienceArrow?:boolean;scienceCircuitSymbol?:CircuitSymbol};
const P=(x:number,y:number,label=""):Vertex=>({x,y,label});
const elementColor:Record<string,string>={H:"#5177cc",O:"#d34c53",C:"#35485f",N:"#3973c9","e⁻":"#4169ba"};
const A=(x:number,y:number,label:string):Vertex=>({...P(x,y,label),color:elementColor[label]??"#455b75"});
const S=(a:number,b:number,label="",extras:Partial<Edge>={}):Edge=>({a,b,kind:"segment",label,measure:false,...extras});
const V=(a:number,b:number,label=""):Edge=>S(a,b,label,{scienceArrow:true});
const B=(a:number,b:number,order:1|2|3=1):Edge=>S(a,b,"",{bondOrder:order});

export function makeSciencePresetItem(id:SciencePresetId,x:number,y:number,createId:()=>string):Item{
  const graph=makeMathPresetItem("blank",x,y,createId());
  const base:Item={...graph,graphFigureId:id,graphPurpose:"geometry",graphAxisMode:"none",
    graphGrid:false,graphGridStep:1,graphSnap:false,graphShowLabels:true,
    graphShowCurve:false,graphConnectPoints:false,graphExpression:"",
    graphSegments:[],graphAngles:[],graphCircles:[],graphPolygons:[],graphMidpoints:[],
    graphXMin:-7,graphXMax:7,graphYMin:-5,graphYMax:5,width:500,height:360};
  if(id==="physics-motion"||id==="physics-speed"){
    const speed=id==="physics-speed";
    return {...base,text:speed?"График скорости v(t)":"График пути s(t)",
      graphPurpose:"coordinates",graphAxisMode:"both",graphGrid:true,
      graphConnectPoints:true,graphAxisLabels:true,graphXMin:0,graphXMax:12,
      graphYMin:0,graphYMax:10,graphPoints:(speed?[[0,2],[3,2],[7,5],[10,5]]:[[0,0],[3,2],[7,6],[10,8]]).map(([px,py])=>P(px,py))};
  }
  if(id==="physics-circuit-free")return {...base,text:"Электрическая цепь · новый чертёж",graphGrid:true,graphSnap:true};
  let title="";
  let points:Vertex[]=[];
  let segments:Edge[]=[];
  let polygons:NonNullable<Item["graphPolygons"]>=[];
  let circles:NonNullable<Item["graphCircles"]>=[];
  switch(id){

    case "physics-circuit-series":
      title="Электрическая цепь · последовательно";
      points=[P(-4,-3,"A"),P(4,-3,"B"),P(4,3,"C"),P(-4,3,"D")];
      segments=[
        S(0,1,"",{scienceCircuitSymbol:"resistor"}),
        S(1,2,"",{scienceCircuitSymbol:"lamp"}),
        S(2,3,"",{scienceCircuitSymbol:"switch"}),
        S(3,0,"",{scienceCircuitSymbol:"source"})
      ];
      break;
    case "physics-circuit-meters":
      title="Электрическая цепь · измерительные приборы";
      points=[P(-5,-2,"A"),P(5,-2,"B"),P(5,2,"C"),P(-5,2,"D"),
        P(-2,2,"E"),P(2,2,"F"),P(-2,4,"G"),P(2,4,"H")];
      segments=[
        S(0,1,"",{scienceCircuitSymbol:"source"}),
        S(1,2),S(2,5),S(5,4,"",{scienceCircuitSymbol:"resistor"}),
        S(4,3,"",{scienceCircuitSymbol:"ammeter"}),S(3,0),
        S(4,6),S(6,7,"",{scienceCircuitSymbol:"voltmeter"}),S(7,5)
      ];
      break;
    case "physics-forces":
      title="Механика · силы на тело";
      points=[P(0,0,"O"),P(0,3.7,"N"),P(0,-3.7,"mg"),P(4,0,"F"),P(-3.7,0,"Fтр")];
      segments=[V(0,1),V(0,2),V(0,3),V(0,4)];
      break;
    case "physics-incline":
      title="Механика · наклонная плоскость";
      points=[P(-5,-3,"A"),P(5,-3,"B"),P(5,2.5,"C"),P(0,-.25,"O"),P(-1.8,3,"N"),P(0,-4,"mg"),P(3.1,1.4,"F")];
      segments=[S(0,1),S(1,2),S(2,0),V(3,4),V(3,5),V(3,6)];
      polygons=[{points:[0,1,2],label:"",measure:false}];
      break;
    case "physics-optics":
      title="Оптика · отражение света";
      points=[P(-4,3.5,"A"),P(0,0,"O"),P(4,3.5,"B"),P(-5,0,""),P(5,0,""),P(0,4.6,"N")];
      segments=[V(0,1,"Падающий луч"),V(1,2,"Отражённый луч"),S(3,4,"Зеркало"),S(1,5,"Нормаль")];
      break;
    case "physics-refraction":
      title="Оптика · преломление света";
      points=[P(-3.7,3.5,"A"),P(0,0,"O"),P(2,-3.7,"B"),P(-5,0,""),P(5,0,""),P(0,4.5,"N₁"),P(0,-4.5,"N₂")];
      segments=[V(0,1,"Падающий луч"),V(1,2,"Преломлённый луч"),S(3,4,"Граница сред"),S(5,6,"Нормаль")];
      break;
    case "physics-lens":
      title="Оптика · собирающая линза";
      points=[P(-5,0,""),P(5,0,""),P(0,-4,""),P(0,4,""),P(-3,0,"F₁"),P(3,0,"F₂"),P(-5,2.2,"A"),P(0,2.2,"O"),P(4,-.8,"B")];
      segments=[S(0,1,"Главная оптическая ось"),S(2,3,"Линза"),V(6,7,"Падающий луч"),V(7,8,"После линзы")];
      break;
    case "chem-water":
      title="Молекула воды · H₂O";
      points=[A(0,1,"O"),A(-2.7,-1.5,"H"),A(2.7,-1.5,"H")];
      segments=[B(0,1),B(0,2)];break;
    case "chem-carbon-dioxide":
      title="Молекула углекислого газа · CO₂";
      points=[A(-3.7,0,"O"),A(0,0,"C"),A(3.7,0,"O")];
      segments=[B(0,1,2),B(1,2,2)];break;
    case "chem-methane":
      title="Молекула метана · CH₄";
      points=[A(0,0,"C"),A(-3.3,0,"H"),A(3.3,0,"H"),A(0,3.3,"H"),A(0,-3.3,"H")];
      segments=[B(0,1),B(0,2),B(0,3),B(0,4)];break;
    case "chem-ammonia":
      title="Молекула аммиака · NH₃";
      points=[A(0,0.5,"N"),A(-3,-1.7,"H"),A(3,-1.7,"H"),A(0,3.6,"H")];
      segments=[B(0,1),B(0,2),B(0,3)];break;
    case "chem-oxygen":
      title="Молекула кислорода · O₂";
      points=[A(-2,0,"O"),A(2,0,"O")];
      segments=[B(0,1,2)];break;
    case "chem-atom":
      title="Атом · ядро и электронная оболочка";
      points=[A(0,0,"Ядро"),A(3.1,0,"e⁻"),A(0,3.1,"e⁻"),A(-3.1,0,"e⁻")];
      circles=[{center:0,edge:1,label:"Оболочка",measure:false}];break;
  }
  return {...base,text:title,graphGrid:id.startsWith("physics-circuit-"),graphSnap:id.startsWith("physics-circuit-"),graphPoints:points,graphSegments:segments,graphPolygons:polygons,graphCircles:circles};
}
