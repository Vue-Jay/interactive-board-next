/** Additional BOUNDED classroom reaction references.
 *
 * Every record is generated from an explicitly enumerated reaction family with
 * checked aqueous starting ions, or an individual familiar textbook equation.
 * These are reference formulas, not a universal thermodynamic predictor.
 *
 * Basis: LibreTexts Solubility Rules; OpenStax Chemistry 2e, precipitation and
 * acid–base / polyprotic acids; OpenStax Organic Chemistry functional groups.
 * Concentration, pH, oxidation, product isomers and catalysts remain important.
 */
import type {ReviewedExample} from "./lektrusEquationExamplePool";
type Family="inorganic"|"organic";
type Ion={formula:string;charge:number;group?:boolean};
const ion=(formula:string,charge:number,group=false):Ion=>({formula,charge,group});
const C={
 Na:ion("Na",1),K:ion("K",1),NH4:ion("NH4",1,true),
 Ag:ion("Ag",1),Ba:ion("Ba",2),Sr:ion("Sr",2),Pb:ion("Pb",2),
 Ca:ion("Ca",2),Mg:ion("Mg",2),Cu:ion("Cu",2),
 Zn:ion("Zn",2),FeII:ion("Fe",2),MnII:ion("Mn",2),
 Ni:ion("Ni",2),Co:ion("Co",2),Cd:ion("Cd",2),
 Al:ion("Al",3),FeIII:ion("Fe",3)
};
const A={
 Cl:ion("Cl",1),Br:ion("Br",1),I:ion("I",1),
 NO3:ion("NO3",1,true),SO4:ion("SO4",2,true),
 CO3:ion("CO3",2,true),OH:ion("OH",1,true),
 S:ion("S",2),CrO4:ion("CrO4",2,true),
 C2O4:ion("C2O4",2,true),PO4:ion("PO4",3,true)
};
const gcd=(x:number,y:number):number=>y?gcd(y,x%y):x;
const lcm=(x:number,y:number)=>x/gcd(x,y)*y;
function salt(c:Ion,a:Ion){
 const n=lcm(c.charge,a.charge),nc=n/c.charge,na=n/a.charge;
 const f=(v:Ion,k:number)=>(v.group&&k>1?"("+v.formula+")":v.formula)+(k>1?k:"");
 return {formula:f(c,nc)+f(a,na),nc,na};
}
const term=(n:number,formula:string)=>String(n===1?"":n)+formula;
const pool:ReviewedExample[]=[];
const signatures=new Set<string>();
function add(family:Family,category:string,title:string,equation:string,conditions="",note="",limited=false){
 const key=family+"|"+conditions+"|"+equation;
 if(signatures.has(key))return;
 signatures.add(key);
 pool.push({id:"verified-family-"+pool.length,family,category,title,equation,conditions,
  environment:family==="organic"?(category==="Горение"?"ignited":"aqueous"):"aqueous",
  note:note||title,limitedToMolecularFormula:limited});
}
/** Correct integer exchange, validated again by the atom-conservation test. */
function exchange(M:Ion,X:Ion,N:Ion,Y:Ion,which:"first"|"second"){
 const a=salt(M,X),b=salt(N,Y),c=salt(M,Y),d=salt(N,X);
 for(let i=1;i<=24;i++){
  const j=i*a.nc/c.nc,k=i*a.na/d.na,l=k*d.nc/b.nc;
  if(![j,k,l].every(n=>Number.isInteger(n)&&n>0&&n<120))continue;
  if(l*b.na!==j*c.na)continue;
  const products=[term(j,c.formula),term(k,d.formula)];
  products[which==="first"?0:1]+="↓";
  return term(i,a.formula)+" + "+term(l,b.formula)+" → "+products.join(" + ");
 }
 return null;
}
const precipitation=(title:string,metal:Ion,metalAnion:Ion,alkali:Ion,precipAnion:Ion,conditions="",note="")=>{
 const e=exchange(metal,metalAnion,alkali,precipAnion,"first");
 if(e)add("inorganic","Осаждение",title,e,conditions,note||"Малорастворимый продукт при подходящем pH и концентрации.");
};
// Insoluble strontium/barium/lead sulfates; sources are explicitly aqueous salts.
for(const metal of [C.Ba,C.Sr,C.Pb]){
 for(const metalCounter of metal===C.Pb?[A.NO3]:[A.NO3,A.Cl]){
  for(const sulfateSource of [C.Na,C.K,C.NH4,C.Mg,C.Zn,C.Cu,C.FeII,C.Al]){
   precipitation("Осаждение сульфата "+metal.formula,metal,metalCounter,sulfateSource,A.SO4,"",
    "Нерастворимый или малорастворимый сульфат. Для PbSO₄ и SrSO₄ существенна растворимость и концентрация.");
  }
 }
}
// Sulfides: not all sulfides are stable at every pH. Alkali sulfide donors,
// soluble metal salts, theoretical diagrams only. No Fe(III) redox extrapolation.
for(const metal of [C.Cu,C.Zn,C.FeII,C.Ni,C.Co,C.MnII,C.Pb,C.Cd,C.Ag])
 for(const metalCounter of metal===C.Pb||metal===C.Ag?[A.NO3]:[A.NO3,A.Cl,A.SO4])
  for(const source of [C.Na,C.K]){
   precipitation("Осаждение сульфида "+metal.formula,metal,metalCounter,source,A.S,
    "щелочная среда",
    "Школьная схема при достаточной концентрации сульфид-иона; pH определяет равновесие H₂S / HS⁻ / S²⁻. Для токсичных солей только теоретическое рассмотрение.");
  }
// Chromates: insoluble BaCrO4, SrCrO4, PbCrO4, Ag2CrO4.
// The chromate/dichromate speciation changes in acid.
for(const metal of [C.Ba,C.Sr,C.Pb,C.Ag])
 for(const metalCounter of metal===C.Pb||metal===C.Ag?[A.NO3]:[A.NO3,A.Cl])
  for(const source of [C.Na,C.K]){
   precipitation("Осаждение хромата "+metal.formula,metal,metalCounter,source,A.CrO4,
    "нейтральная среда",
    "Ионы CrO₄²⁻ дают малорастворимый хромат; в кислой среде равновесие смещается к дихромату. Соединения Cr(VI) токсичны.");
  }
// Calcium/strontium/barium/lead oxalates are sparingly soluble.
for(const metal of [C.Ca,C.Sr,C.Ba,C.Pb])
 for(const metalCounter of metal===C.Pb?[A.NO3]:[A.NO3,A.Cl])
  for(const source of [C.Na,C.K]){
   precipitation("Осаждение оксалата "+metal.formula,metal,metalCounter,source,A.C2O4,"",
    "Образование малорастворимого оксалата из растворимых солей.");
  }
// Additional simple carbonates of Fe(II) and Zn(II); explicitly normal salts,
// with pH/oxidation caveats. Copper(II) gives basic carbonate and is excluded.
for(const metal of [C.FeII,C.Zn,C.MnII])
 for(const counter of [A.NO3,A.Cl,A.SO4])
  for(const alkali of [C.Na,C.K]){
   precipitation("Осаждение карбоната "+metal.formula,metal,counter,alkali,A.CO3,
    "нейтральная среда",
    "Условная схема выделения карбоната; pH, гидролиз, растворённый CO₂ и окисление на воздухе могут менять состав.");
  }
// Isolated textbook combination/decomposition/oxygen reactions.
const inorganic=[
 ["Основные оксиды","Гашение негашёной извести","CaO + H2O → Ca(OH)2",""],
 ["Основные оксиды","Гидратация оксида натрия","Na2O + H2O → 2NaOH",""],
 ["Основные оксиды","Гидратация оксида калия","K2O + H2O → 2KOH",""],
 ["Кислотные оксиды","Растворение SO₃ в воде","SO3 + H2O → H2SO4",""],
 ["Кислотные оксиды","Растворение P₂O₅ в воде","P2O5 + 3H2O → 2H3PO4",""],
 ["Кислотные оксиды","Поглощение CO₂ раствором NaOH","CO2 + 2NaOH → Na2CO3 + H2O","избыток щёлочи"],
 ["Кислотные оксиды","Избыток CO₂ с NaOH","CO2 + NaOH → NaHCO3","избыток CO₂"],
 ["Кислотные оксиды","Поглощение CO₂ раствором KOH","CO2 + 2KOH → K2CO3 + H2O","избыток щёлочи"],
 ["Кислотные оксиды","Избыток CO₂ с KOH","CO2 + KOH → KHCO3","избыток CO₂"],
 ["Кислотные оксиды","Поглощение SO₂ раствором NaOH","SO2 + 2NaOH → Na2SO3 + H2O","избыток щёлочи"],
 ["Кислотные оксиды","Кислый сульфит натрия","SO2 + NaOH → NaHSO3","избыток SO₂"],
 ["Кислотные оксиды","Поглощение SO₂ раствором KOH","SO2 + 2KOH → K2SO3 + H2O","избыток щёлочи"],
 ["Кислотные оксиды","Кислый сульфит калия","SO2 + KOH → KHSO3","избыток SO₂"],
 ["Кислотные оксиды","SO₃ и щёлочь","SO3 + 2NaOH → Na2SO4 + H2O","избыток щёлочи"],
 ["Кислотные оксиды","Кислый сульфат натрия","SO3 + NaOH → NaHSO4","избыток SO₃"],
 ["Кислотные оксиды","SO₃ и KOH","SO3 + 2KOH → K2SO4 + H2O","избыток щёлочи"],
 ["Кислотные оксиды","Кислый сульфат калия","SO3 + KOH → KHSO4","избыток SO₃"],
 ["Окисление","Каталитическое окисление SO₂","2SO2 + O2 ⇌ 2SO3","V₂O₅, 450 °C"],
 ["Окисление","Окисление SO₂ бромной водой","SO2 + Br2 + 2H2O → H2SO4 + 2HBr","водн. р-р"],
 ["Окисление","Восстановление Fe₂O₃ угарным газом","Fe2O3 + 3CO → 2Fe + 3CO2","t°"],
 ["Окисление","Восстановление CuO водородом","CuO + H2 → Cu + H2O","t°"],
 ["Окисление","Восстановление CuO угарным газом","CuO + CO → Cu + CO2","t°"],
 ["Окисление","Реакция магния с кислородом","2Mg + O2 → 2MgO","поджиг"],
 ["Окисление","Реакция алюминия с кислородом","4Al + 3O2 → 2Al2O3","поджиг"],
 ["Окисление","Реакция железа с хлором","2Fe + 3Cl2 → 2FeCl3","нагревание"],
 ["Синтез","Реакция водорода с хлором","H2 + Cl2 → 2HCl","hν"],
 ["Синтез","Синтез аммиака","N2 + 3H2 ⇌ 2NH3","Fe, t°, p↑"],
 ["Синтез","Реакция натрия с хлором","2Na + Cl2 → 2NaCl","поджиг"],
 ["Синтез","Реакция магния с серой","Mg + S → MgS","t°"],
 ["Синтез","Реакция алюминия с серой","2Al + 3S → Al2S3","t°"],
 ["Разложение","Разложение нитрата серебра","2AgNO3 → 2Ag + 2NO2↑ + O2↑","t°"],
 ["Разложение","Разложение гидрокарбоната калия","2KHCO3 → K2CO3 + CO2↑ + H2O","t°"],
 ["Разложение","Разложение гидроксида железа(II) без кислорода","Fe(OH)2 → FeO + H2O","t°, без доступа воздуха"],
 ["Разложение","Дегидратация сульфата меди","CuSO4·5H2O → CuSO4 + 5H2O","t°"],
 ["Гидратация","Кристаллогидрат сульфата меди","CuSO4 + 5H2O → CuSO4·5H2O","водн. р-р"],
 ["Амфотерность","Растворение ZnO в щёлочи","ZnO + 2NaOH + H2O → Na2[Zn(OH)4]","конц. щёлочь"],
 ["Амфотерность","Растворение Al₂O₃ в щёлочи","Al2O3 + 2NaOH + 3H2O → 2Na[Al(OH)4]","конц. щёлочь, t°"],
 ["Газ","Взаимодействие NH₄Cl и NaOH","NH4Cl + NaOH → NaCl + NH3↑ + H2O","t°"],
 ["Газ","Взаимодействие NH₄NO₃ и NaOH","NH4NO3 + NaOH → NaNO3 + NH3↑ + H2O","t°"],
 ["Газ","Взаимодействие (NH₄)₂SO₄ и NaOH","(NH4)2SO4 + 2NaOH → Na2SO4 + 2NH3↑ + 2H2O","t°"],
 ["Газ","Взаимодействие NH₄Cl и KOH","NH4Cl + KOH → KCl + NH3↑ + H2O","t°"],
 ["Газ","Взаимодействие NH₄Cl и Ca(OH)₂","2NH4Cl + Ca(OH)2 → CaCl2 + 2NH3↑ + 2H2O","t°"],
 ["Газ","Натрий и вода","2Na + 2H2O → 2NaOH + H2↑",""],
 ["Газ","Калий и вода","2K + 2H2O → 2KOH + H2↑",""],
 ["Газ","Кальций и вода","Ca + 2H2O → Ca(OH)2 + H2↑",""]
] as const;
for(const [category,title,expression,conditions] of inorganic)
 add("inorganic",category,title,expression,conditions,
  "Схема для указанных реагентов и условий; реальный состав зависит от температуры, избытка реагента и среды.");
// Displacement reactions: only clear metal activity pairs in dilute salt solution.
// For iron, the product is Fe(II) under the simple non-oxidising conditions.
const metals=[
 {free:"Mg",saltC:C.Mg,above:["Zn","Fe","Cu"]},
 {free:"Zn",saltC:C.Zn,above:["Fe","Cu"]},
 {free:"Fe",saltC:C.FeII,above:["Cu"]},
 {free:"Cu",saltC:C.Cu,above:["Ag"]}
] as const;
for(const metal of metals){
 for(const displaced of metal.above){
  const target=displaced==="Ag"?C.Ag:displaced==="Cu"?C.Cu:displaced==="Fe"?C.FeII:C.Zn;
  for(const counter of [A.NO3,A.SO4,A.Cl]){
   // AgCl and Ag2SO4 are unsuitable as soluble starting salts; AgNO3 only.
   if(displaced==="Ag"&&counter!==A.NO3)continue;
   const productMetalSalt=salt(metal.saltC,counter);
   const reagentMetalSalt=salt(target,counter);
   const toFree=displaced;
   const metalCount=reagentMetalSalt.nc;
   const resultingMetalCount=productMetalSalt.nc;
   const count=lcm(metalCount,resultingMetalCount);
   const mFree=count/resultingMetalCount*productMetalSalt.nc;
   const mReleased=count/metalCount*reagentMetalSalt.nc;
   const mSalt=count/metalCount;
   const pSalt=mFree/productMetalSalt.nc;
   // Find stoichiometry using the preserved counterion and free-metal atoms.
   for(let p=1;p<=6;p++){
    const q=p*reagentMetalSalt.na/productMetalSalt.na;
    const k=q*productMetalSalt.nc;
    const freed=p*reagentMetalSalt.nc;
    if(![q,k,freed].every(v=>Number.isInteger(v)&&v>0&&v<20))continue;
    add("inorganic","Замещение",metal.free+" вытесняет "+displaced,
     term(k,metal.free)+" + "+term(p,reagentMetalSalt.formula)+" → "+
     term(q,productMetalSalt.formula)+" + "+term(freed,toFree),"",
     "Замещение на основании ряда активности в разбавленном растворе без побочных окислителей.");
    break;
   }
  }
 }
}
// More organic examples: named acid/alcohol pairs (condensed structures) and
// their acid- and base-catalysed reverse transformations.
const organicAcids=[
 ["HCOOH","HCOO","муравьиная"],
 ["CH3COOH","CH3COO","уксусная"],
 ["CH3CH2COOH","CH3CH2COO","пропионовая"],
 ["CH3CH2CH2COOH","CH3CH2CH2COO","масляная"]
] as const;
const alcohols=[
 ["CH3OH","CH3","метанол"],
 ["C2H5OH","C2H5","этанол"],
 ["CH3CH2CH2OH","CH3CH2CH2","пропан-1-ол"],
 ["CH3CH2CH2CH2OH","CH3CH2CH2CH2","бутан-1-ол"]
] as const;
for(const [acid,anion,acidName] of organicAcids){
 for(const [alcohol,alkyl,alcoholName] of alcohols){
  const ester=anion+alkyl;
  add("organic","Этерификация",acidName+" кислота + "+alcoholName,
   acid+" + "+alcohol+" ⇌ "+ester+" + H2O",
   "H₂SO₄ (конц.), t°",
   "Равновесная этерификация выбранных карбоновой кислоты и первичного спирта.");
  add("organic","Гидролиз", "Кислотный гидролиз сложного эфира",
   ester+" + H2O ⇌ "+acid+" + "+alcohol,
   "H⁺, t°","Обратимый гидролиз сложного эфира в кислой среде.");
  add("organic","Гидролиз","Щелочной гидролиз сложного эфира",
   ester+" + NaOH → "+anion+"Na + "+alcohol,
   "водн. NaOH, t°","Омыление сложного эфира с образованием соли кислоты.");
  add("organic","Гидролиз","Омыление сложного эфира калием",
   ester+" + KOH → "+anion+"K + "+alcohol,
   "водн. KOH, t°","Щелочной гидролиз сложного эфира, образование калиевой соли.");
 }
}
for(const [alcohol,aldehyde,title] of [
 ["CH3OH","HCHO","метанол"],
 ["C2H5OH","CH3CHO","этанол"],
 ["CH3CH2CH2OH","CH3CH2CHO","пропанол"],
 ["CH3CH2CH2CH2OH","CH3CH2CH2CHO","бутанол"]
] as const){
 add("organic","Окисление","Окисление "+title+" оксидом меди(II)",
  alcohol+" + CuO → "+aldehyde+" + Cu + H2O","t°",
  "Школьная схема дегидрирования первичного спирта оксидом Cu(II).");
 add("organic","Восстановление","Гидрирование альдегида",
  aldehyde+" + H2 → "+alcohol,"Ni, t°",
  "Гидрирование карбонильной группы альдегида.");
}
for(const [equation,title,conditions] of [
 ["C6H12O6 → 2C3H6O3","Молочнокислое брожение глюкозы","фермент"],
 ["C6H12O6 → 2C2H5OH + 2CO2↑","Спиртовое брожение глюкозы","фермент"],
 ["C12H22O11 + H2O → 2C6H12O6","Гидролиз сахарозы, суммарная формула","H⁺, t°"],
 ["C2H4 + H2O → C2H5OH","Гидратация этена","H₃PO₄, t°, p↑"],
 ["C2H2 + H2O → CH3CHO","Гидратация ацетилена (реакция Кучерова)","Hg²⁺, H₂SO₄"],
 ["CH3COOH + NaHCO3 → CH3COONa + CO2↑ + H2O","Уксусная кислота и гидрокарбонат",""],
 ["CH3COOH + Na2CO3 → CH3COONa + NaHCO3","Первая стадия взаимодействия кислоты и карбоната","недостаток кислоты"]
] as const)add("organic","Органические превращения",title,equation,conditions,
 "Школьная схема по указанным условиям; молекулярная формула не определяет изомер.",true);
export const additionalEquationCases:readonly ReviewedExample[]=pool;
export const additionalEquationCount=pool.length;
