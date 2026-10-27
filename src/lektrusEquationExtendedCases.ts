/** Explicitly bounded school-reaction families, not an unrestricted chemical predictor.
 * Families follow standard solubility, neutralisation, gas-evolution and activity
 * series rules. Only curated cations, anions and reaction environments appear.
 *
 * Background scientific basis:
 * - Chemistry LibreTexts, precipitation/solubility rules
 * - Chemistry LibreTexts, acid-base and gas evolution reactions
 * - Chemistry LibreTexts, activity series
 */
import type {ReviewedExample} from "./lektrusEquationExamplePool";
type Ion={formula:string;charge:number;group?:boolean};
type Metal=Ion & {name:string};
const M=(formula:string,charge:number,name:string,group=false):Metal=>({formula,charge,name,group});
const I=(formula:string,charge:number,group=false):Ion=>({formula,charge,group});
const c={
 Na:M("Na",1,"натрия"),K:M("K",1,"калия"),
 NH4:M("NH4",1,"аммония",true),
 Ca:M("Ca",2,"кальция"),Ba:M("Ba",2,"бария"),
 Mg:M("Mg",2,"магния"),Zn:M("Zn",2,"цинка"),
 Cu:M("Cu",2,"меди(II)"),FeII:M("Fe",2,"железа(II)"),
 FeIII:M("Fe",3,"железа(III)"),Al:M("Al",3,"алюминия"),
 Pb:M("Pb",2,"свинца(II)"),Ag:M("Ag",1,"серебра"),
 Sr:M("Sr",2,"стронция")
};
const a={
 chloride:I("Cl",1),bromide:I("Br",1),iodide:I("I",1),
 nitrate:I("NO3",1,true),sulfate:I("SO4",2,true),
 carbonate:I("CO3",2,true),hydroxide:I("OH",1,true),
 phosphate:I("PO4",3,true),acetate:I("CH3COO",1,true)
};
const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a;
const lcm=(a:number,b:number):number=>a/gcd(a,b)*b;
function makeSalt(cation:Ion,anion:Ion){
 const total=lcm(cation.charge,anion.charge);
 const nc=total/cation.charge,na=total/anion.charge;
 const f=(ion:Ion,n:number)=>(n>1&&ion.group?"("+ion.formula+")":ion.formula)+(n>1?n:"");
 return {formula:f(cation,nc)+f(anion,na),cations:nc,anions:na};
}
const show=(coefficient:number,formula:string)=>String(coefficient===1?"":coefficient)+formula;
const pool:ReviewedExample[]=[];
let count=0;
const register=(name:string,category:string,expression:string,conditions="",note="",environment:"aqueous"|"heated"|"ignited"|"dry"="aqueous",family:"inorganic"|"organic"="inorganic")=>{
 pool.push({id:"expanded-"+(++count),title:name,category,equation:expression,conditions,
  family,note:note||name,environment,
  limitedToMolecularFormula:family==="organic"&&/молекулярн|изомер|строени|структур|положение|расположение|общая формула/i.test(note)});
};
/** Exchange reaction: AX + BY -> AY + BX, coefficients conserved by ionic stoichiometry. */
function exchange(A:Ion,X:Ion,B:Ion,Y:Ion){
 const ax=makeSalt(A,X),by=makeSalt(B,Y),ay=makeSalt(A,Y),bx=makeSalt(B,X);
 const scale=lcm(lcm(ay.cations,bx.anions),by.cations*bx.anions);
 // Work with integer coefficients, then reduce by their common divisor.
 const base=scale*by.cations*bx.anions;
 const ca=base,cc=base*ax.cations/ay.cations,cd=base*ax.anions/bx.anions;
 const cb=cd*bx.cations/by.cations;
 const values=[ca,cb,cc,cd].map(Math.round);
 const divider=values.reduce(gcd);
 const [p,q,r,s]=values.map(v=>v/divider);
 if(![p,q,r,s].every(v=>Number.isSafeInteger(v)&&v>0&&v<100))return null;
 return {
  reactants:[show(p,ax.formula),show(q,by.formula)],
  products:[show(r,ay.formula),show(s,bx.formula)],
  formulas:{ax:ax.formula,by:by.formula,ay:ay.formula,bx:bx.formula}
 };
}
const mark=(eq:ReturnType<typeof exchange>,precipitate:"AY"|"BX")=>{
 if(!eq)return null;
 const products=eq.products.slice();
 const idx=precipitate==="AY"?0:1;products[idx]+="↓";
 return eq.reactants.join(" + ")+" → "+products.join(" + ");
};
// Insoluble silver and lead halides, paired ONLY with water-soluble starting salts.
for(const metal of [c.Ag,c.Pb]){
 for(const [ion,label,partners] of [
  [a.chloride,"хлорида",[c.Na,c.K,c.NH4,c.Ca,c.Ba,c.Mg,c.Zn]],
  [a.bromide,"бромида",[c.Na,c.K,c.NH4,c.Ca,c.Mg]],
  [a.iodide,"иодида",[c.Na,c.K,c.NH4,c.Ca,c.Mg]]
 ] as const){
  for(const partner of partners){
   const eq=exchange(metal,a.nitrate,partner,ion);
   const value=mark(eq,"AY");
   if(value)register("Осаждение "+label+" "+metal.name,"Осадки",value,"",
    "В водном растворе образуется малорастворимый "+makeSalt(metal,ion).formula+
    "; растворимость зависит от концентраций.");
  }
 }
}
// BaSO4 is robustly insoluble across this deliberately bounded set.
for(const bariumSalt of [a.chloride,a.nitrate])
 for(const partner of [c.Na,c.K,c.NH4,c.Mg,c.Zn,c.Cu,c.FeII,c.FeIII,c.Al]){
  const eq=exchange(c.Ba,bariumSalt,partner,a.sulfate);
  const value=mark(eq,"AY");
  if(value)register("Осаждение сульфата бария","Осадки",value,"",
   "Белый осадок BaSO4 при смешении растворимых солей.");
 }
// Calcium, barium and strontium carbonates from soluble chlorides / nitrates.
for(const metal of [c.Ca,c.Ba,c.Sr])
 for(const metalSalt of [a.chloride,a.nitrate])
 for(const partner of [c.Na,c.K,c.NH4]){
  const eq=exchange(metal,metalSalt,partner,a.carbonate);
  const value=mark(eq,"AY");
  if(value)register("Осаждение карбоната "+metal.name,"Осадки",value,"",
   "Образуется малорастворимый карбонат. Условия: водный раствор.");
 }
// Insoluble metal hydroxides. Aluminium and zinc hydroxides redissolve in excess alkali.
for(const metal of [c.Cu,c.FeII,c.FeIII,c.Zn,c.Al,c.Mg])
 for(const metalSalt of [a.chloride,a.nitrate,a.sulfate]){
  // Salts of trivalent iron/aluminium with these common anions are water-soluble.
  for(const alkali of [c.Na,c.K]){
   const eq=exchange(metal,metalSalt,alkali,a.hydroxide);
   const value=mark(eq,"AY");
   if(value)register("Осаждение гидроксида "+metal.name,"Осадки",value,"",
    metal===c.Zn||metal===c.Al?"Осадок образуется без избытка щёлочи; при избытке возможен растворимый гидроксокомплекс.":
     "Малорастворимый гидроксид, продукты для обычных школьных условий.");
  }
 }
// Phosphates: insoluble alkaline-earth and divalent transition-metal salts.
for(const metal of [c.Ca,c.Ba,c.Sr,c.Mg,c.Zn,c.Cu])
 for(const metalSalt of [a.chloride,a.nitrate])
 for(const partner of [c.Na,c.K]){
  const eq=exchange(metal,metalSalt,partner,a.phosphate);
  const value=mark(eq,"AY");
  if(value)register("Осаждение фосфата "+metal.name,"Осадки",value,"",
   "Школьная схема осаждения фосфата, реальный состав осадка зависит от pH.");
 }
// Conventional complete neutralisation; phosphoric acid requires complete consumption and excess base.
const acids=[
 {formula:"HCl",anion:a.chloride,protons:1,name:"соляной кислотой"},
 {formula:"HBr",anion:a.bromide,protons:1,name:"бромоводородной кислотой"},
 {formula:"HNO3",anion:a.nitrate,protons:1,name:"азотной кислотой"},
 {formula:"H2SO4",anion:a.sulfate,protons:2,name:"разбавленной серной кислотой"},
 {formula:"CH3COOH",anion:a.acetate,protons:1,name:"уксусной кислотой"},
 {formula:"H3PO4",anion:a.phosphate,protons:3,name:"ортофосфорной кислотой"}
] as const;
for(const acid of acids)
 for(const base of [c.Na,c.K,c.Ca,c.Ba,c.Mg]){
  const salt=makeSalt(base,acid.anion);
  const total=lcm(base.charge,acid.protons);
  const nAcid=total/acid.protons,nBase=total/base.charge;
  const condition=acid.protons===3?"избыток щёлочи":"";
  const equation=show(nAcid,acid.formula)+" + "+show(nBase,makeSalt(base,a.hydroxide).formula)+
   " → "+salt.formula+" + "+show(total,"H2O");
  register("Нейтрализация "+acid.name,"Нейтрализация",equation,condition,
   "Полная нейтрализация с указанной стехиометрией; при недостатке основания возможны кислые соли.");
 }
// Acid / carbonate or bicarbonate: CO2 + H2O always included.
// Omit ambiguous phosphate acid cases and sulphate surface-passivation cases.
for(const acid of acids.filter(v=>v.protons<=2)){
 for(const metal of [c.Na,c.K,c.Ca,c.Ba,c.Mg,c.Zn]){
  if(acid.anion===a.sulfate&&[c.Ca,c.Ba].includes(metal))continue;
  const carbonate=makeSalt(metal,a.carbonate);
  const salt=makeSalt(metal,acid.anion);
  // Search tiny integer coefficients constrained by conservation of each ion.
  for(let nCarb=1;nCarb<=6;nCarb++){
   const acidCount=2*nCarb/acid.protons;
   const saltCount=carbonate.cations*nCarb/salt.cations;
   if(!Number.isInteger(acidCount)||!Number.isInteger(saltCount)||
     salt.anions*saltCount!==acidCount)continue;
   const equation=show(nCarb,carbonate.formula)+" + "+show(acidCount,acid.formula)+" → "+
    show(saltCount,salt.formula)+" + "+show(nCarb,"CO2")+"↑ + "+show(nCarb,"H2O");
   register("Карбонат с "+acid.name,"Газ",equation,"",
    "Выделяется CO₂. Угольная кислота рассматривается как неустойчивое промежуточное вещество.");
   break;
  }
 }
 for(const metal of [c.Na,c.K]){
  const acidSalt=makeSalt(metal,acid.anion);
  const hydrogencarbonate=metal.formula+"HCO3";
  const equation=show(acid.protons,hydrogencarbonate)+" + "+acid.formula+" → "+
   show(acid.protons,acidSalt.formula)+" + "+show(acid.protons,"CO2")+"↑ + "+
   show(acid.protons,"H2O");
  // Above only valid for monobasic acids; for dibasic acid derive matching salt counts.
  if(acid.protons!==1)continue;
  register("Гидрокарбонат с "+acid.name,"Газ",equation,"",
   "Образование и распад промежуточной H₂CO₃ с выделением CO₂.");
 }
}
// Non-oxidising dilute acids and active metals. Fe gives iron(II) here.
for(const metal of [c.Mg,c.Zn,c.FeII,c.Al]){
 for(const acid of acids.filter(v=>["HCl","HBr","H2SO4"].includes(v.formula))){
  const salt=makeSalt(metal,acid.anion);
  let total=lcm(metal.charge,acid.protons);
  if(total%2!==0)total*=2; // Al requires two atoms per three H2 molecules
  const nMetal=total/metal.charge,nAcid=total/acid.protons;
  const nSalt=nMetal/salt.cations;
  if(!Number.isInteger(nSalt))continue;
  const value=show(nMetal,metal.formula)+" + "+show(nAcid,acid.formula)+" → "+
   show(nSalt,salt.formula)+" + "+show(total/2,"H2")+"↑";
  register("Металл и разбавленная кислота","Замещение",value,"разб.",
   "Активный металл с неокисляющей кислотой; водород выделяется. Не применять к концентрированной H₂SO₄.");
 }
}
// Basic and amphoteric oxides with common acids. Deliberately omit unstable nitrate oxidation of lower Fe.
for(const ox of [
 {metal:c.Ca,formula:"CaO",oxy:1},{metal:c.Mg,formula:"MgO",oxy:1},
 {metal:c.Cu,formula:"CuO",oxy:1},{metal:c.Zn,formula:"ZnO",oxy:1},
 {metal:c.FeIII,formula:"Fe2O3",oxy:3},{metal:c.Al,formula:"Al2O3",oxy:3}
]){
 for(const acid of acids.filter(v=>["HCl","HNO3","H2SO4"].includes(v.formula))){
  const salt=makeSalt(ox.metal,acid.anion);
  const oxideMetalCount=ox.metal.charge===3?2:1;
  const nAcid=ox.oxy*2/acid.protons;
  if(!Number.isInteger(nAcid))continue;
  const saltCount=oxideMetalCount/salt.cations;
  if(!Number.isInteger(saltCount))continue;
  register("Оксид "+ox.metal.name+" с кислотой","Основные оксиды",
   ox.formula+" + "+show(nAcid,acid.formula)+" → "+show(saltCount,salt.formula)+
   " + "+show(ox.oxy,"H2O"),"",
   "Реакция оксида с кислотой с образованием соли и воды.");
 }
}
// Specific thermal decompositions: no general extrapolation from arbitrary salts.
for(const [equation,name,conditions] of [
 ["2NaHCO3 → Na2CO3 + CO2↑ + H2O","Разложение гидрокарбоната натрия","t°"],
 ["CaCO3 → CaO + CO2↑","Разложение карбоната кальция","t°"],
 ["MgCO3 → MgO + CO2↑","Разложение карбоната магния","t°"],
 ["BaCO3 → BaO + CO2↑","Разложение карбоната бария","сильный нагрев"],
 ["2KClO3 → 2KCl + 3O2↑","Разложение хлората калия","MnO₂, t°"],
 ["2KMnO4 → K2MnO4 + MnO2 + O2↑","Разложение перманганата калия","t°"],
 ["2H2O2 → 2H2O + O2↑","Разложение перекиси водорода","MnO₂"],
 ["2NaNO3 → 2NaNO2 + O2↑","Нагревание нитрата натрия","t°"],
 ["2KNO3 → 2KNO2 + O2↑","Нагревание нитрата калия","t°"],
 ["2Cu(NO3)2 → 2CuO + 4NO2↑ + O2↑","Термическое разложение нитрата меди(II)","t°"],
 ["2Pb(NO3)2 → 2PbO + 4NO2↑ + O2↑","Термическое разложение нитрата свинца(II)","t°"],
 ["Cu(OH)2 → CuO + H2O","Разложение гидроксида меди(II)","t°"],
 ["2Fe(OH)3 → Fe2O3 + 3H2O","Разложение гидроксида железа(III)","t°"],
 ["2Al(OH)3 → Al2O3 + 3H2O","Разложение гидроксида алюминия","t°"],
 ["Zn(OH)2 → ZnO + H2O","Разложение гидроксида цинка","t°"],
 ["H2CO3 → CO2↑ + H2O","Распад угольной кислоты",""]
] as const)register(name,"Разложение",equation,conditions,"Проверенная школьная схема; условия температурного распада зависят от вещества.","heated");
// Simple single-displacement reactions governed by the reviewed activity series.
for(const [equation,name] of [
 ["Fe + CuSO4 → FeSO4 + Cu","Железо и сульфат меди(II)"],
 ["Zn + CuSO4 → ZnSO4 + Cu","Цинк и сульфат меди(II)"],
 ["Mg + CuSO4 → MgSO4 + Cu","Магний и сульфат меди(II)"],
 ["Zn + FeSO4 → ZnSO4 + Fe","Цинк и сульфат железа(II)"],
 ["Mg + FeSO4 → MgSO4 + Fe","Магний и сульфат железа(II)"],
 ["Cu + 2AgNO3 → Cu(NO3)2 + 2Ag","Медь и нитрат серебра"],
 ["Fe + CuCl2 → FeCl2 + Cu","Железо и хлорид меди(II)"],
 ["Zn + CuCl2 → ZnCl2 + Cu","Цинк и хлорид меди(II)"],
 ["Cu + 2AgNO3 → 2Ag + Cu(NO3)2","Вытеснение серебра медью"]
] as const)register(name,"Замещение",equation,"","Металл вытесняет менее активный металл из раствора соли.");
// Organic high-coverage molecular-formula pathways, explicitly limited to named homologous series.
for(let n=1;n<=10;n++){
 const alkane=n===1?"CH4":"C"+n+"H"+(2*n+2);
 const co2=show(n,"CO2"),water=show(n+1,"H2O");
 const coefO=(3*n+1)/2;
 if(Number.isInteger(coefO))
  register("Горение алкана C"+n,"Горение",alkane+" + "+show(coefO,"O2")+" → "+co2+" + "+water,
   "поджиг","Полное горение избытке кислорода.","ignited","organic");
 else register("Горение алкана C"+n,"Горение","2"+alkane+" + "+(3*n+1)+"O2 → "+
   show(2*n,"CO2")+" + "+show(2*n+2,"H2O"),"поджиг",
   "Полное горение в избытке кислорода.","ignited","organic");
}
for(let n=2;n<=10;n++){
 const alkene="C"+n+"H"+2*n;
 const alkane="C"+n+"H"+(2*n+2);
 register("Гидрирование алкена C"+n,"Присоединение",
  alkene+" + H2 → "+alkane,"Ni, t°",
  "Указана молекулярная формула; для несимметричных алкенов строение изомера требует отдельного уточнения.","aqueous","organic");
 register("Бромирование алкена C"+n,"Присоединение",
  alkene+" + Br2 → C"+n+"H"+2*n+"Br2","",
  "Общая формула присоединения одного Br₂ по двойной связи; изомеры не различаются.","aqueous","organic");
 register("Гидрохлорирование алкена C"+n,"Присоединение",
  alkene+" + HCl → C"+n+"H"+(2*n+1)+"Cl","",
  "Молекулярный состав продукта проверяется, но положение Cl зависит от строения алкена.","aqueous","organic");
}
for(let n=2;n<=7;n++){
 const alkyne="C"+n+"H"+(2*n-2),alkene="C"+n+"H"+2*n;
 register("Частичное гидрирование алкина C"+n,"Присоединение",
  alkyne+" + H2 → "+alkene,"кат. Линдлара",
  "Селективное присоединение одного H₂, без определения геометрии изомера.","aqueous","organic");
 register("Полное гидрирование алкина C"+n,"Присоединение",
  alkyne+" + 2H2 → C"+n+"H"+(2*n+2),"Ni, t°",
  "Полное гидрирование при достатке водорода.","aqueous","organic");
 register("Бромирование алкина C"+n,"Присоединение",
  alkyne+" + Br2 → C"+n+"H"+(2*n-2)+"Br2","",
  "Одна молекула Br₂ на тройную связь, возможна дальнейшая реакция при избытке Br₂.","aqueous","organic");
}
for(let n=2;n<=8;n++){
 const alcohol="C"+n+"H"+(2*n+1)+"OH",alkene="C"+n+"H"+(2*n);
 register("Дегидратация спирта C"+n,"Отщепление",
  alcohol+" → "+alkene+" + H2O","H₂SO₄ (конц.), 170 °C",
  "Молекулярный состав продуктов при внутримолекулярной дегидратации; изомерный состав не установлен.","heated","organic");
 const oxygen=(3*n)/2;
 if(Number.isInteger(oxygen))
  register("Горение спирта C"+n,"Горение",
   alcohol+" + "+show(oxygen,"O2")+" → "+show(n,"CO2")+" + "+show(n+1,"H2O"),
   "поджиг","Полное горение спирта.","ignited","organic");
 else
  register("Горение спирта C"+n,"Горение",
   "2"+alcohol+" + "+(3*n)+"O2 → "+show(2*n,"CO2")+" + "+show(2*n+2,"H2O"),
   "поджиг","Полное горение спирта.","ignited","organic");
}
for(let n=2;n<=8;n++){
 const acid="C"+n+"H"+2*n+"O2";
 const salt="C"+n+"H"+(2*n-1)+"O2Na";
 register("Нейтрализация карбоновой кислоты C"+n,"Нейтрализация",
  acid+" + NaOH → "+salt+" + H2O","",
  "Общая формула монокарбоновой кислоты, проверяется состав, а не расположение группы.","aqueous","organic");
 register("Карбоновая кислота и гидрокарбонат C"+n,"Газ",
  acid+" + NaHCO3 → "+salt+" + CO2↑ + H2O","",
  "Выделение CO₂; изомерная структура кислоты не определяется.","aqueous","organic");
}
export const expandedEquationCases:readonly ReviewedExample[]=pool;
export const expandedEquationCount=pool.length;
