/** Offline school periodic table. Atomic number, conventional symbol, Russian name. */
export type ElementFamily="noble"|"halogen"|"nonmetal"|"metalloid"|"metal"|"lanthanoid"|"actinoid";
export type PeriodicElement={
  number:number; symbol:string;name:string;period:number;group:number;
  row:number;col:number;family:ElementFamily;
};
const symbols=("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr "+
  "Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu "+
  "Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr "+
  "Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og").trim().split(/\s+/);
const names=(
  "Водород|Гелий|Литий|Бериллий|Бор|Углерод|Азот|Кислород|Фтор|Неон|"+
  "Натрий|Магний|Алюминий|Кремний|Фосфор|Сера|Хлор|Аргон|Калий|Кальций|"+
  "Скандий|Титан|Ванадий|Хром|Марганец|Железо|Кобальт|Никель|Медь|Цинк|"+
  "Галлий|Германий|Мышьяк|Селен|Бром|Криптон|Рубидий|Стронций|Иттрий|Цирконий|"+
  "Ниобий|Молибден|Технеций|Рутений|Родий|Палладий|Серебро|Кадмий|Индий|Олово|"+
  "Сурьма|Теллур|Йод|Ксенон|Цезий|Барий|Лантан|Церий|Празеодим|Неодим|"+
  "Прометий|Самарий|Европий|Гадолиний|Тербий|Диспрозий|Гольмий|Эрбий|Тулий|"+
  "Иттербий|Лютеций|Гафний|Тантал|Вольфрам|Рений|Осмий|Иридий|Платина|"+
  "Золото|Ртуть|Таллий|Свинец|Висмут|Полоний|Астат|Радон|Франций|Радий|"+
  "Актиний|Торий|Протактиний|Уран|Нептуний|Плутоний|Америций|Кюрий|Берклий|"+
  "Калифорний|Эйнштейний|Фермий|Менделевий|Нобелий|Лоуренсий|Резерфордий|Дубний|"+
  "Сиборгий|Борий|Хассий|Мейтнерий|Дармштадтий|Рентгений|Коперниций|Нихоний|"+
  "Флеровий|Московий|Ливерморий|Теннессин|Оганесон"
).split("|");
const noble=new Set([2,10,18,36,54,86,118]);
const halogen=new Set([9,17,35,53,85,117]);
const nonmetal=new Set([1,6,7,8,15,16,34]);
const metalloid=new Set([5,14,32,33,51,52,84]);
const mainGroup=(n:number)=>{
  if(n===1)return 1;if(n===2)return 18;
  if(n<=10)return n<=4?n-2:n+8;
  if(n<=18)return n<=12?n-10:n;
  if(n<=36)return n-18;
  if(n<=54)return n-36;
  if(n<=56)return n-54;
  if(n<=71)return 3;
  if(n<=86)return n-68;
  if(n<=88)return n-86;
  if(n<=103)return 3;
  return n-100;
};
const period=(n:number)=>n<=2?1:n<=10?2:n<=18?3:n<=36?4:n<=54?5:n<=86?6:7;
const family=(n:number):ElementFamily=>{
  if(n>=57&&n<=71)return "lanthanoid";
  if(n>=89&&n<=103)return "actinoid";
  if(noble.has(n))return "noble";
  if(halogen.has(n))return "halogen";
  if(nonmetal.has(n))return "nonmetal";
  if(metalloid.has(n))return "metalloid";
  return "metal";
};
export const periodicElements:PeriodicElement[]=symbols.map((symbol,index)=>{
  const n=index+1;
  const lan=n>=57&&n<=71,act=n>=89&&n<=103;
  return {
    number:n,symbol,name:names[index]??symbol,
    period:period(n),group:mainGroup(n),family:family(n),
    row:lan?9:act?10:period(n),
    col:lan?n-54:act?n-86:mainGroup(n)
  };
});
export const periodicFamilies:{id:ElementFamily;name:string;color:string}[]=[
  {id:"metal",name:"Металлы",color:"#dce9fb"},
  {id:"nonmetal",name:"Неметаллы",color:"#d3f1de"},
  {id:"halogen",name:"Галогены",color:"#f5e7b9"},
  {id:"noble",name:"Инертные газы",color:"#e8ddff"},
  {id:"metalloid",name:"Полуметаллы",color:"#fce1d2"},
  {id:"lanthanoid",name:"Лантаноиды",color:"#f0daf0"},
  {id:"actinoid",name:"Актиноиды",color:"#f9d6dd"}
];
