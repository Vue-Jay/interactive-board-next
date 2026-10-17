import type {ReactNode} from "react";

/** School circuit symbols in a shared, quiet, 70-unit coordinate system. */
export type CircuitSymbol=
  "wire"|"resistor"|"variable-resistor"|"photoresistor"|"lamp"|
  "source"|"cell"|"battery"|"ac-source"|
  "switch"|"push-button"|"fuse"|
  "ammeter"|"voltmeter"|"galvanometer"|"motor"|
  "diode"|"led"|"capacitor"|"capacitor-polarized"|"inductor"|"bell"|"ground";
export type CircuitCategory="Сборка"|"Источники"|"Нагрузка"|"Управление"|"Измерение"|"Электроника";
export const circuitSymbols:{id:CircuitSymbol;label:string;category:CircuitCategory;hint:string}[]=[
  {id:"wire",label:"Провод",category:"Сборка",hint:"Соединить контакты"},
  {id:"source",label:"Элемент питания",category:"Источники",hint:"Один гальванический элемент"},
  {id:"cell",label:"Гальванический элемент",category:"Источники",hint:"Один источник ЭДС"},
  {id:"battery",label:"Батарея",category:"Источники",hint:"Несколько элементов"},
  {id:"ac-source",label:"Переменный ток",category:"Источники",hint:"Источник переменного тока"},
  {id:"resistor",label:"Резистор",category:"Нагрузка",hint:"Постоянное сопротивление"},
  {id:"variable-resistor",label:"Реостат",category:"Нагрузка",hint:"Регулируемое сопротивление"},
  {id:"photoresistor",label:"Фоторезистор",category:"Нагрузка",hint:"Зависимость от освещения"},
  {id:"lamp",label:"Лампа",category:"Нагрузка",hint:"Лампа накаливания"},
  {id:"motor",label:"Электродвигатель",category:"Нагрузка",hint:"Условное обозначение M"},
  {id:"bell",label:"Звонок",category:"Нагрузка",hint:"Электрический звонок"},
  {id:"inductor",label:"Катушка",category:"Нагрузка",hint:"Катушка индуктивности"},
  {id:"switch",label:"Выключатель",category:"Управление",hint:"Замкнутое или разомкнутое состояние"},
  {id:"push-button",label:"Кнопка",category:"Управление",hint:"Кнопка без фиксации"},
  {id:"fuse",label:"Предохранитель",category:"Управление",hint:"Плавкий предохранитель"},
  {id:"ammeter",label:"Амперметр",category:"Измерение",hint:"Измерение силы тока"},
  {id:"voltmeter",label:"Вольтметр",category:"Измерение",hint:"Измерение напряжения"},
  {id:"galvanometer",label:"Гальванометр",category:"Измерение",hint:"Чувствительный прибор"},
  {id:"diode",label:"Диод",category:"Электроника",hint:"Односторонняя проводимость"},
  {id:"led",label:"Светодиод",category:"Электроника",hint:"Диод со стрелками свечения"},
  {id:"capacitor",label:"Конденсатор",category:"Электроника",hint:"Неполярный"},
  {id:"capacitor-polarized",label:"Полярный конденсатор",category:"Электроника",hint:"С обозначением полярности"},
  {id:"ground",label:"Заземление",category:"Электроника",hint:"Знак общего провода"}
];

const STROKE="#334965";
export default function ScienceCircuitGlyph({type,x,y,angle=0,closed=false}:{
  type:CircuitSymbol;x:number;y:number;angle?:number;closed?:boolean;
}){
  if(type==="wire")return null;
  let drawing:ReactNode;
  const circleLetter=(letter:string)=><>
    <circle r="15.5" fill="#fff" stroke={STROKE} strokeWidth="1.8"/>
    <text x="0" y="5.4" transform={"rotate("+(-angle)+")"} fontSize="15.5"
      fontWeight="650" fill={STROKE} textAnchor="middle" stroke="none">{letter}</text>
  </>;
  switch(type){
    case "resistor":
    case "variable-resistor":
    case "photoresistor":
      drawing=<>
        <rect x="-19" y="-8.5" width="38" height="17" fill="#fff"
          stroke={STROKE} strokeWidth="1.8" rx="1.2"/>
        {type==="variable-resistor"&&
          <path d="M-16 17L15 -17M15 -17l-2 9m2-9l-9 2" stroke={STROKE} strokeWidth="1.6" fill="none"/>}
        {type==="photoresistor"&&
          <path d="M-19 -20l9 9m-3-1h4m-1-3v4M-5-22l9 9m-3-1h4m-1-3v4"
            stroke={STROKE} strokeWidth="1.5" fill="none"/>}
      </>;break;
    case "lamp":drawing=<>
      <circle r="16" fill="#fff" stroke={STROKE} strokeWidth="1.8"/>
      <path d="M-10 -10L10 10M-10 10L10 -10" stroke={STROKE} strokeWidth="1.5"/>
    </>;break;
    case "source":
    case "cell":drawing=<>
      <path d="M-6 -17v34M6 -10v20" stroke={STROKE} strokeWidth="2"/>
      <text x="-10" y="-21" fill={STROKE} fontSize="11" fontWeight="750" stroke="none">+</text>
    </>;break;
    case "battery":drawing=<>
      <path d="M-17 -18v36M-9 -11v22M2 -18v36M10 -11v22"
        stroke={STROKE} strokeWidth="1.9"/>
      <text x="-19" y="-21" fill={STROKE} fontSize="10" stroke="none">+</text>
    </>;break;
    case "ac-source":drawing=<>
      <circle r="16" fill="#fff" stroke={STROKE} strokeWidth="1.8"/>
      <path d="M-10 0c4 -12 9 12 13 0s7 -11 11 -3" stroke={STROKE} strokeWidth="1.6" fill="none"/>
    </>;break;
    case "switch":drawing=<>
      <circle cx="-20" cy="0" r="2.7" fill="#fff" stroke={STROKE} strokeWidth="1.6"/>
      <circle cx="20" cy="0" r="2.7" fill="#fff" stroke={STROKE} strokeWidth="1.6"/>
      <path d={closed?"M-20 0L20 0":"M-20 0L15 -14"}
        stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
    </>;break;
    case "push-button":drawing=<>
      <circle cx="-20" r="2.4" fill="#fff" stroke={STROKE} strokeWidth="1.5"/>
      <circle cx="20" r="2.4" fill="#fff" stroke={STROKE} strokeWidth="1.5"/>
      <path d="M-16 -8H16M0 -17v9" fill="none" stroke={STROKE} strokeWidth="1.7"/>
    </>;break;
    case "fuse":drawing=<>
      <rect x="-19" y="-6" width="38" height="12" rx="2" fill="#fff" stroke={STROKE} strokeWidth="1.7"/>
      <path d="M-13 0H13" stroke={STROKE} strokeWidth="1.35"/>
    </>;break;
    case "ammeter":drawing=circleLetter("A");break;
    case "voltmeter":drawing=circleLetter("V");break;
    case "galvanometer":drawing=circleLetter("G");break;
    case "motor":drawing=circleLetter("M");break;
    case "diode":
    case "led":drawing=<>
      <path d="M-17 -13L7 0L-17 13Z" fill="#fff" stroke={STROKE} strokeWidth="1.8"/>
      <path d="M8 -15V15" stroke={STROKE} strokeWidth="2"/>
      {type==="led"&&<path d="M1 -17l10 -8m-3 1h4m-1-3v4M11 -12l10 -8m-3 1h4m-1-3v4"
        stroke={STROKE} strokeWidth="1.4" fill="none"/>}
    </>;break;
    case "capacitor":
    case "capacitor-polarized":drawing=<>
      <path d="M-5 -17V17M6 -17V17" stroke={STROKE} strokeWidth="2.1"/>
      {type==="capacitor-polarized"&&<text x="-13" y="-17" fontSize="13" fill={STROKE} stroke="none">+</text>}
    </>;break;
    case "inductor":drawing=<path d="M-21 0c0-15 10-15 10 0c0-15 10-15 10 0c0-15 10-15 10 0c0-15 10-15 10 0"
      fill="none" stroke={STROKE} strokeWidth="1.7"/>;break;
    case "bell":drawing=<>
      <path d="M-18 4c0 -16 36 -16 36 0v3h-36zM-6 10h12" stroke={STROKE} strokeWidth="1.7" fill="#fff"/>
      <circle cx="0" cy="13" r="2" fill={STROKE}/>
    </>;break;
    case "ground":drawing=<>
      <path d="M0 -21V0M-15 0H15M-10 6H10M-5 12H5"
        stroke={STROKE} strokeWidth="1.8"/>
    </>;break;
    default:drawing=null;
  }
  return <g transform={"translate("+x+" "+y+") rotate("+angle+")"} pointerEvents="none">
    <rect x="-23" y="-24" width="46" height="48" rx="2" fill="#fff"/>
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {drawing}
    </g>
  </g>;
}
