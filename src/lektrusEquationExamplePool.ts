/** Teacher-reviewed school examples for unobtrusive placeholders and reference-only checks.
 * They are neither assigned to a board object nor claimed as an exhaustive chemistry engine.
 * Inorganic cases reuse the condition-specific curated reaction collection.
 */
import {reviewedReactionCases,type ReactionEnvironment} from "./lektrusReactionDatabase";
import {parseEquationDraft} from "./lektrusChemicalEquationModel";
export type EquationFamily="inorganic"|"organic";
export type ReviewedExample={
 id:string;title:string;equation:string;conditions:string;family:EquationFamily;
 category:string;environment?:ReactionEnvironment;note:string;
};
const inorganic:ReviewedExample[]=reviewedReactionCases.filter(v=>v.status==="reaction").map((v,i)=>({
 id:"i-"+i,title:v.description.split(/[.;]/)[0].slice(0,62),equation:v.equation,
 conditions:v.environment==="ignited"?"поджиг":v.environment==="heated"?"t°":"",
 family:"inorganic" as const,
 category:v.observation==="precipitate"?"Осадок":v.observation==="gas"?"Газ":
  v.observation==="heat"?"Тепловая реакция":v.observation==="dissolution"?"Растворение":
  v.observation==="color"?"Изменение окраски":"Превращение",
 environment:v.environment,note:v.description
}));
const direct=(id:string,title:string,equation:string,conditions:string,category:string,note:string):ReviewedExample=>
 ({id,title,equation,conditions,category,family:"organic",note});
const organic:ReviewedExample[]=[
 direct("o1","Горение метана","CH4 + 2O2 → CO2 + 2H2O","поджиг","Горение","Полное горение при достатке кислорода"),
 direct("o2","Горение этана","2C2H6 + 7O2 → 4CO2 + 6H2O","поджиг","Горение","Полное горение"),
 direct("o3","Горение этена","C2H4 + 3O2 → 2CO2 + 2H2O","поджиг","Горение","Полное горение"),
 direct("o4","Горение этина","2C2H2 + 5O2 → 4CO2 + 2H2O","поджиг","Горение","Полное горение"),
 direct("o5","Горение этанола","C2H5OH + 3O2 → 2CO2 + 3H2O","поджиг","Горение","Полное горение"),
 direct("o6","Горение пропана","C3H8 + 5O2 → 3CO2 + 4H2O","поджиг","Горение","Полное горение"),
 direct("o7","Горение метанола","2CH3OH + 3O2 → 2CO2 + 4H2O","поджиг","Горение","Полное горение"),
 direct("o8","Гидрирование этена","C2H4 + H2 → C2H6","Ni, t°","Присоединение","Гидрирование алкена на катализаторе"),
 direct("o9","Гидрирование этина (первая стадия)","C2H2 + H2 → C2H4","кат. Линдлара","Присоединение","Селективное частичное гидрирование на катализаторе Линдлара"),
 direct("o10","Гидрирование этина","C2H2 + 2H2 → C2H6","Ni, t°","Присоединение","Полное гидрирование"),
 direct("o11","Присоединение брома к этену","C2H4 + Br2 → C2H4Br2","","Присоединение","Обесцвечивание бромной воды, присоединение по двойной связи"),
 direct("o12","Присоединение брома к этину","C2H2 + Br2 → C2H2Br2","","Присоединение","Присоединение одного эквивалента брома"),
 direct("o13","Хлорирование метана","CH4 + Cl2 → CH3Cl + HCl","hν","Замещение","Радикальное замещение на свету"),
 direct("o14","Хлорирование этана","C2H6 + Cl2 → C2H5Cl + HCl","hν","Замещение","Радикальное замещение на свету"),
 direct("o15","Присоединение HCl к этену","C2H4 + HCl → C2H5Cl","","Присоединение","Присоединение галогеноводорода к этену"),
 direct("o16","Гидратация этена","C2H4 + H2O → C2H5OH","H₃PO₄, t°, p↑","Присоединение","Кислотно-каталитическая гидратация этена при температуре и давлении"),
 direct("o17","Дегидратация этанола","C2H5OH → C2H4 + H2O","H₂SO₄ (конц.), 170 °C","Разложение","Внутримолекулярная дегидратация"),
 direct("o18","Окисление этанола оксидом меди","C2H5OH + CuO → CH3CHO + Cu + H2O","t°","Окисление","При нагревании образуется этаналь"),
 direct("o19","Гидрирование этаналя","CH3CHO + H2 → C2H5OH","Ni, t°","Восстановление","Восстановление альдегида до спирта"),
 direct("o20","Этерификация","CH3COOH + C2H5OH ⇌ CH3COOC2H5 + H2O","H₂SO₄ (конц.), t°","Этерификация","Равновесная этерификация уксусной кислоты этанолом"),
 direct("o21","Нейтрализация уксусной кислоты","CH3COOH + NaOH → CH3COONa + H2O","","Нейтрализация","Образуется ацетат натрия"),
 direct("o22","Уксусная кислота и карбонат","2CH3COOH + Na2CO3 → 2CH3COONa + CO2↑ + H2O","","Газ","Выделение CO₂"),
 direct("o23","Уксусная кислота и гидрокарбонат","CH3COOH + NaHCO3 → CH3COONa + CO2↑ + H2O","","Газ","Выделение CO₂"),
 direct("o24","Брожение глюкозы","C6H12O6 → 2C2H5OH + 2CO2↑","фермент","Брожение","Спиртовое брожение при соответствующих условиях"),
 direct("o25","Гидрирование пропена","C3H6 + H2 → C3H8","Ni, t°","Присоединение","Гидрирование пропена"),
 direct("o26","Бромирование пропена","C3H6 + Br2 → C3H6Br2","","Присоединение","Присоединение по двойной связи"),
 direct("o27","Взаимодействие уксусной кислоты с магнием","2CH3COOH + Mg → Mg(CH3COO)2 + H2↑","","Замещение","Выделение водорода при взаимодействии с металлом"),
 direct("o28","Этанол и натрий","2C2H5OH + 2Na → 2C2H5ONa + H2↑","","Замещение","Образуется этилат натрия и выделяется водород"),
 direct("o29","Получение этина из карбида кальция","CaC2 + 2H2O → C2H2↑ + Ca(OH)2","","Газ","Гидролиз карбида кальция"),
 direct("o30","Дегидрирование этана","C2H6 → C2H4 + H2","кат., t°","Отщепление","Каталитическое дегидрирование при высокой температуре")
];
const inorganicExtras:ReviewedExample[]=[
 {id:"i-carbonic",title:"Распад угольной кислоты",equation:"H2CO3 → H2O + CO2↑",conditions:"",
  family:"inorganic",category:"Разложение",note:"Промежуточная угольная кислота распадается при удалении CO₂ из раствора"},
 {id:"i-carbonate-intermediate",title:"Образование H₂CO₃ (промежуточная стадия)",equation:"Na2CO3 + 2HCl → 2NaCl + H2CO3",conditions:"",
  family:"inorganic",category:"Обмен",note:"Учебная промежуточная запись, далее нужен этап разложения"}
];
export const equationExamplePool:readonly ReviewedExample[]=[...inorganic,...inorganicExtras,...organic];
export const equationExamplesByDomain=(domain:EquationFamily):ReviewedExample[]=>equationExamplePool.filter(v=>v.family===domain);
export function selectRandomEquationExample(domain:EquationFamily,excludedId?:string,random=Math.random):ReviewedExample{
 const candidates=equationExamplesByDomain(domain);
 const choice=excludedId&&candidates.length>1?candidates.filter(v=>v.id!==excludedId):candidates;
 return choice[Math.min(choice.length-1,Math.floor(Math.max(0,Math.min(0.999999,random()))*choice.length))];
}
export function referenceMatchesInput(example:ReviewedExample,reactants:string[]):boolean{
 const draft=parseEquationDraft(example.equation);
 if(!draft)return false;
 const normal=(value:string)=>value.replace(/[₀-₉]/g,v=>String("₀₁₂₃₄₅₆₇₈₉".indexOf(v))).replace(/\s+/g,"");
 const signature=(arr:string[])=>arr.map(normal).sort().join("|");
 return signature(draft.left.map(v=>v.formula))===signature(reactants);
}
