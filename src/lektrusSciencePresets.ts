import type {Item} from "./boardModel";
import type {CircuitSymbol} from "./ScienceCircuitGlyph";
import {makeMathPresetItem} from "./lektrusMathPresets";

/** School diagrams only: symbols and qualitative constructions, never solved work. */
export type SciencePresetId=
  |"physics-forces"|"physics-incline"|"physics-friction"|"physics-lever"|"physics-spring"|"physics-equilibrium"
  |"physics-optics"|"physics-refraction"|"physics-lens"|"physics-diverging-lens"|"physics-plane-mirror"|"physics-total-reflection"|"physics-prism"
  |"physics-motion"|"physics-speed"|"physics-accelerated-speed"|"physics-acceleration"|"physics-braking"|"physics-rest"
  |"physics-circuit-series"|"physics-circuit-meters"|"physics-circuit-free"
  |"chem-water"|"chem-carbon-dioxide"|"chem-methane"|"chem-ammonia"|"chem-oxygen"|"chem-atom"
  |"chem-organic-ethane"|"chem-organic-ethene"|"chem-organic-ethyne"
  |"chem-organic-ethanol"|"chem-organic-ethanoic"|"chem-organic-benzene"|"chem-organic-free"
  |"chem-formula-water"|"chem-formula-combustion"|"chem-formula-neutralization"|"chem-formula-free"
  |"chem-experiment-salt"|"chem-experiment-litmus"|"chem-experiment-lime"|"chem-experiment-free";

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
  const motionPresets:Partial<Record<SciencePresetId,{name:string;points:number[][]}>>={
    "physics-motion":{name:"Равномерное движение · s(t)",points:[[0,0],[3,2],[6,4],[9,6],[12,8]]},
    "physics-speed":{name:"Постоянная скорость · v(t)",points:[[0,4],[3,4],[6,4],[9,4],[12,4]]},
    "physics-accelerated-speed":{name:"Разгон · v(t)",points:[[0,0],[3,2],[6,4],[9,6],[12,8]]},
    "physics-acceleration":{name:"Постоянное ускорение · a(t)",points:[[0,3],[3,3],[6,3],[9,3],[12,3]]},
    "physics-braking":{name:"Равнозамедленное движение · v(t)",points:[[0,9],[3,6.75],[6,4.5],[9,2.25],[12,0]]},
    "physics-rest":{name:"Остановка и движение · s(t)",points:[[0,1],[3,3],[6,3],[9,6],[12,6]]}
  };
  const motion=motionPresets[id];
  if(motion){
    return {...base,text:motion.name,
      graphPurpose:"coordinates",graphAxisMode:"both",graphGrid:true,
      graphConnectPoints:true,graphAxisLabels:true,graphXMin:0,graphXMax:12,
      graphYMin:0,graphYMax:10,graphPoints:motion.points.map(([px,py])=>P(px,py))};
  }
  if(id==="physics-circuit-free")return {...base,text:"Электрическая цепь · новый чертёж",graphGrid:true,graphSnap:true};
  let title="";
  let points:Vertex[]=[];
  let segments:Edge[]=[];
  let polygons:NonNullable<Item["graphPolygons"]>=[];
  let circles:NonNullable<Item["graphCircles"]>=[];
  const formulaPresets:Partial<Record<SciencePresetId,{title:string;expression:string}>>={
    "chem-formula-water":{title:"Молекулярная формула · вода",expression:"H2O"},
    "chem-formula-combustion":{title:"Горение метана",expression:"CH4 + 2O2 → CO2 + 2H2O"},
    "chem-formula-neutralization":{title:"Нейтрализация",expression:"HCl + NaOH → NaCl + H2O"},
    "chem-formula-free":{title:"Химическое уравнение",expression:""}
  };
  if(formulaPresets[id]){
    const entry=formulaPresets[id]!;
    return {...base,text:entry.title,graphExpression:entry.expression,width:590,height:240};
  }
  const experimentPresets:Partial<Record<SciencePresetId,string>>={
    "chem-experiment-salt":"Растворение хлорида натрия в воде",
    "chem-experiment-litmus":"Действие кислой среды на лакмус",
    "chem-experiment-lime":"Реакция CO₂ с известковой водой"
  };
  if(id==="chem-experiment-free")
    return {...base,text:"Химический стол",scienceLabBench:{vessels:[{id:"v1",kind:"beaker",x:48,y:57,reagents:[],environment:"aqueous",observed:false}],selectedId:"v1",event:0},scienceReagents:[],scienceEnvironment:"aqueous",scienceExperimentStage:0,width:820,height:500};
  if(experimentPresets[id])
    return {...base,text:experimentPresets[id],scienceExperimentStage:0,width:630,height:390};
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
    case "physics-friction":
      title="Механика · трение скольжения";
      points=[P(-5,-2.2,""),P(5,-2.2,""),P(0,-1,"O"),P(0,2.0,"N"),
        P(0,-4.2,"mg"),P(4,-1,"F"),P(-3.6,-1,"Fтр")];
      segments=[S(0,1),V(2,3),V(2,4),V(2,5),V(2,6)];
      break;
    case "physics-lever":
      title="Механика · рычаг и опора";
      points=[P(-5,0,"A"),P(5,0,"B"),P(0,0,"O"),P(-5,-3.0,"F₁"),
        P(5,-2.2,"F₂"),P(0,2.6,"N"),P(-.7,-1.5,""),P(.7,-1.5,"")];
      segments=[S(0,1),V(0,3),V(1,4),V(2,5),S(6,2),S(2,7),S(6,7)];
      break;
    case "physics-spring":
      title="Механика · пружина и сила упругости";
      points=[P(-4,3.6,""),P(-2.8,3.6,""),P(-2.8,2.6,""),
        P(-4,2.0,""),P(-1.6,1.35,""),P(-4,.7,""),P(-1.6,0,""),
        P(-4,-.7,""),P(-2.8,-1.4,""),P(-2.8,-2.3,"O"),
        P(-2.8,1.6,"Fупр"),P(-2.8,-4.1,"mg")];
      segments=[S(0,1),S(1,2),S(2,3),S(3,4),S(4,5),S(5,6),
        S(6,7),S(7,8),S(8,9),V(9,10),V(9,11)];
      break;
    case "physics-equilibrium":
      title="Механика · равновесие сил";
      points=[P(0,0,"O"),P(0,3.4,"F₁"),P(-3,-2.1,"F₂"),P(3,-2.1,"F₃")];
      segments=[V(0,1),V(0,2),V(0,3)];
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
    case "physics-diverging-lens":
      title="Оптика · рассеивающая линза";
      points=[P(-5,0,""),P(5,0,""),P(0,-4,""),P(0,4,""),
        P(-3,0,"F₁"),P(3,0,"F₂"),P(-5,2.6,"A"),P(0,2.6,""),P(2.2,4.5,"B")];
      segments=[S(0,1,"Оптическая ось"),S(2,3,"Линза"),
        V(6,7,"Падающий луч"),V(7,8,"Преломлённый луч")];
      break;
    case "physics-plane-mirror":
      title="Оптика · изображение в плоском зеркале";
      points=[P(0,-4.2,""),P(0,4.2,""),P(-3,-2.5,"A"),P(-3,1.8,"B"),
        P(3,-2.5,"A′"),P(3,1.8,"B′"),P(-5,-3.5,""),P(5,-3.5,"")];
      segments=[S(0,1,"Зеркало"),S(2,3,"Предмет"),S(4,5,"Мнимое изображение"),
        S(2,4),S(3,5)];
      break;
    case "physics-total-reflection":
      title="Оптика · полное внутреннее отражение";
      points=[P(-5,0,""),P(5,0,""),P(0,0,"O"),P(0,4.2,"N"),
        P(-4,-3.4,"A"),P(4,-3.4,"B")];
      segments=[S(0,1,"Граница сред"),S(2,3,"Нормаль"),
        V(4,2,"Падающий луч"),V(2,5,"Отражённый луч")];
      break;
    case "physics-prism":
      title="Оптика · преломление через призму";
      points=[P(-2.8,-2.9,""),P(0,3,""),P(2.8,-2.9,""),
        P(-5,.6,"A"),P(-1.14,.6,""),P(1.7,-.65,""),P(5,-2.1,"B")];
      segments=[S(0,1),S(1,2),S(2,0),V(3,4,"Падающий луч"),
        V(4,5,"Внутри призмы"),V(5,6,"Выходящий луч")];
      polygons=[{points:[0,1,2],label:"",measure:false}];
      break;
    case "chem-organic-free":
      title="Органическая структура · новый чертёж";
      points=[A(-1.7,0,"C"),A(1.7,0,"C")];segments=[B(0,1)];break;
    case "chem-organic-ethane":
      title="Этан · C₂H₆";
      points=[A(-1.7,0,"C"),A(1.7,0,"C")];segments=[B(0,1)];break;
    case "chem-organic-ethene":
      title="Этен · C₂H₄";
      points=[A(-1.7,0,"C"),A(1.7,0,"C")];segments=[B(0,1,2)];break;
    case "chem-organic-ethyne":
      title="Этин · C₂H₂";
      points=[A(-1.7,0,"C"),A(1.7,0,"C")];segments=[B(0,1,3)];break;
    case "chem-organic-ethanol":
      title="Этанол · C₂H₆O";
      points=[A(-3,0,"C"),A(0,0,"C"),A(3,0,"O"),A(5,1.4,"H")];
      segments=[B(0,1),B(1,2),B(2,3)];break;
    case "chem-organic-ethanoic":
      title="Этановая кислота · C₂H₄O₂";
      points=[A(-3.1,0,"C"),A(-.2,0,"C"),A(2.2,2.2,"O"),A(2.5,-2,"O"),A(4.8,-2.2,"H")];
      segments=[B(0,1),B(1,2,2),B(1,3),B(3,4)];break;
    case "chem-organic-benzene":
      title="Бензол · C₆H₆";
      points=Array.from({length:6},(_,i)=>{
       const angle=-Math.PI/2+i*Math.PI/3;
       return A(3.3*Math.cos(angle),3.3*Math.sin(angle),"C");
      });
      segments=Array.from({length:6},(_,i)=>B(i,(i+1)%6,i%2===0?2:1));break;
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
