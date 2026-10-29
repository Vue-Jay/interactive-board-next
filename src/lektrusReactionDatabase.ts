/** Curated qualitative SCHOOL chemistry cases, never a predictive chemistry engine.
 * Records are deliberately condition-specific and never extrapolated to unknown mixtures.
 * Data model is compatible with future reviewed reaction datasets and PubChem IDs. */
export type ReactionEnvironment="aqueous"|"dry"|"heated"|"ignited";
export type ReactionStatus="reaction"|"none"|"unknown";
export type ReactionFamily="exchange"|"neutralization"|"synthesis"|"decomposition"|
 "displacement"|"combustion"|"redox"|"hydration"|"organic";
export type ReactionVisual="flame"|"flash"|"sparks"|"smoke"|"glow"|
 "steam"|"fizz"|"crystals"|"thermal"|"colorShift";

export type Observation="gas"|"precipitate"|"color"|"heat"|"dissolution"|"none";
export type Substance={id:string;name:string;formula:string;kind:string};
export type ReactionCase={reactants:string[];environment:ReactionEnvironment;status:"reaction"|"none";
 equation:string;observation:Observation;description:string;beforeColor?:string;afterColor?:string;
 safety?:string;family?:ReactionFamily;visual?:ReactionVisual;
 minTemperatureC?:number;confidence:"curated";sourceNote:string};
const catalog=`
H2O|Вода|вода
HCl|Соляная кислота (раствор)|кислота
H2SO4|Серная кислота (разбавленная)|кислота
HNO3|Азотная кислота|кислота
H3PO4|Ортофосфорная кислота|кислота
CH3COOH|Уксусная кислота|кислота
H2CO3|Угольная кислота|кислота
H2S|Сероводород (раствор)|кислота
HBr|Бромоводородная кислота|кислота
HF|Плавиковая кислота|кислота
NaOH|Гидроксид натрия|основание
KOH|Гидроксид калия|основание
Ca(OH)2|Гидроксид кальция|основание
Ba(OH)2|Гидроксид бария|основание
Mg(OH)2|Гидроксид магния|основание
Cu(OH)2|Гидроксид меди(II)|основание
Fe(OH)2|Гидроксид железа(II)|основание
Fe(OH)3|Гидроксид железа(III)|основание
Al(OH)3|Гидроксид алюминия|основание
Zn(OH)2|Гидроксид цинка|основание
NH3|Аммиак|газ
NH4OH|Раствор аммиака (условная запись)|основание
NaCl|Хлорид натрия|соль
KCl|Хлорид калия|соль
CaCl2|Хлорид кальция|соль
MgCl2|Хлорид магния|соль
BaCl2|Хлорид бария|соль
FeCl2|Хлорид железа(II)|соль
FeCl3|Хлорид железа(III)|соль
CuCl2|Хлорид меди(II)|соль
AlCl3|Хлорид алюминия|соль
ZnCl2|Хлорид цинка|соль
NH4Cl|Хлорид аммония|соль
AgCl|Хлорид серебра|соль
AgNO3|Нитрат серебра|соль
NaNO3|Нитрат натрия|соль
KNO3|Нитрат калия|соль
Cu(NO3)2|Нитрат меди(II)|соль
Pb(NO3)2|Нитрат свинца(II)|соль
Ca(NO3)2|Нитрат кальция|соль
NH4NO3|Нитрат аммония|соль
CuSO4|Сульфат меди(II)|соль
FeSO4|Сульфат железа(II)|соль
Fe2(SO4)3|Сульфат железа(III)|соль
MgSO4|Сульфат магния|соль
Na2SO4|Сульфат натрия|соль
K2SO4|Сульфат калия|соль
BaSO4|Сульфат бария|соль
CaSO4|Сульфат кальция|соль
ZnSO4|Сульфат цинка|соль
(NH4)2SO4|Сульфат аммония|соль
Na2CO3|Карбонат натрия|соль
NaHCO3|Гидрокарбонат натрия|соль
K2CO3|Карбонат калия|соль
CaCO3|Карбонат кальция|соль
MgCO3|Карбонат магния|соль
BaCO3|Карбонат бария|соль
CuCO3|Карбонат меди(II)|соль
Na3PO4|Фосфат натрия|соль
Ca3(PO4)2|Фосфат кальция|соль
Na2S|Сульфид натрия|соль
FeS|Сульфид железа(II)|соль
CuS|Сульфид меди(II)|соль
KI|Иодид калия|соль
KBr|Бромид калия|соль
PbI2|Иодид свинца(II)|соль
CH3COONa|Ацетат натрия|соль
C6H12O6|Глюкоза|органика
C12H22O11|Сахароза|органика
C2H5OH|Этанол|органика
CH3OH|Метанол|органика
CH4|Метан|газ
C2H6|Этан|газ
C2H4|Этен|газ
C2H2|Этин|газ
O2|Кислород|газ
H2|Водород|газ
CO2|Углекислый газ|газ
CO|Монооксид углерода|газ
N2|Азот|газ
SO2|Диоксид серы|газ
NO2|Диоксид азота|газ
Cl2|Хлор|газ
Br2|Бром|простое вещество
I2|Иод|простое вещество
Fe|Железо|металл
Cu|Медь|металл
Zn|Цинк|металл
Mg|Магний|металл
Al|Алюминий|металл
Ca|Кальций|металл
Na|Натрий|металл
K|Калий|металл
Ag|Серебро|металл
Au|Золото|металл
S|Сера|неметалл
C|Углерод|неметалл
P|Фосфор|неметалл
Si|Кремний|неметалл
CuO|Оксид меди(II)|оксид
Fe2O3|Оксид железа(III)|оксид
FeO|Оксид железа(II)|оксид
MgO|Оксид магния|оксид
CaO|Оксид кальция|оксид
Na2O|Оксид натрия|оксид
Al2O3|Оксид алюминия|оксид
ZnO|Оксид цинка|оксид
SiO2|Диоксид кремния|оксид
SO3|Триоксид серы|оксид
P2O5|Оксид фосфора(V) (условная формула)|оксид
KMnO4|Перманганат калия|соль
K2Cr2O7|Дихромат калия|соль
MnO2|Диоксид марганца|оксид
H2O2|Пероксид водорода|пероксид
NaBr|Бромид натрия|соль
AgBr|Бромид серебра|соль
AgI|Иодид серебра|соль
SrCl2|Хлорид стронция|соль
SrSO4|Сульфат стронция|соль
SrCO3|Карбонат стронция|соль
Mg(NO3)2|Нитрат магния|соль
Ba(NO3)2|Нитрат бария|соль
NiSO4|Сульфат никеля(II)|соль
NiCl2|Хлорид никеля(II)|соль
Ni(OH)2|Гидроксид никеля(II)|основание
CoCl2|Хлорид кобальта(II)|соль
Co(OH)2|Гидроксид кобальта(II)|основание
Fe(NO3)3|Нитрат железа(III)|соль
Fe(NO3)2|Нитрат железа(II)|соль
LiOH|Гидроксид лития|основание
LiCl|Хлорид лития|соль
LiNO3|Нитрат лития|соль
Li2SO4|Сульфат лития|соль
Li2CO3|Карбонат лития|соль
CH3COOLi|Ацетат лития|соль
C3H8|Пропан|газ
C4H10|Бутан|газ
C3H6|Пропен|газ
C3H8O|Пропан-2-ол|органика
NaH2PO4|Дигидрофосфат натрия|соль
(NH4)2CO3|Карбонат аммония|соль
ZnS|Сульфид цинка|соль
Li|Литий|металл
NiS|Сульфид никеля(II)|соль
CoS|Сульфид кобальта(II)|соль
Ag2CO3|Карбонат серебра|соль
Ag3PO4|Фосфат серебра|соль
PbCl2|Хлорид свинца(II)|соль
PbBr2|Бромид свинца(II)|соль
PbSO4|Сульфат свинца(II)|соль
PbCO3|Карбонат свинца(II)|соль
PbS|Сульфид свинца(II)|соль
Zn(NO3)2|Нитрат цинка|соль
Al(NO3)3|Нитрат алюминия|соль
CH3COOK|Ацетат калия|соль
Ca(CH3COO)2|Ацетат кальция|соль
Na2SO3|Сульфит натрия|соль
K2SO3|Сульфит калия|соль
CaSO3|Сульфит кальция|соль
Ba3(PO4)2|Фосфат бария|соль
NaF|Фторид натрия|соль
NaNO2|Нитрит натрия|соль
KNO2|Нитрит калия|соль
Fe3O4|Оксид железа(II,III)|оксид
FeS2|Дисульфид железа (пирит)|соль
`;
export const substances:Substance[]=catalog.trim().split("\n").map(row=>{
 const [formula,name,kind]=row.split("|");return {id:formula,formula,name,kind};
});
const scienceNote="Качественная школьная реакция. Для конкретных концентраций, кинетики и условий проверяйте справочные источники.";
const cases:ReactionCase[]=[];
const add=(reagents:string,environment:ReactionEnvironment,equation:string,observation:Observation,
 description:string,options:Partial<ReactionCase>={})=>{
 cases.push({reactants:reagents.split("+"),environment,status:"reaction",equation,observation,
 description,confidence:"curated",sourceNote:scienceNote,...options});
};
const none=(reagents:string,environment:ReactionEnvironment,description:string)=>{
 cases.push({reactants:reagents.split("+"),environment,status:"none",equation:"",observation:"none",
 description,confidence:"curated",sourceNote:"Ионы остаются в растворе: нет осадка, газа или слабого электролита как движущей силы обмена."});
};
add("HCl+NaOH","aqueous","HCl + NaOH → NaCl + H2O","heat","Нейтрализация; образуется вода.");
add("H2SO4+KOH","aqueous","H2SO4 + 2KOH → K2SO4 + 2H2O","heat","Нейтрализация кислоты щёлочью.");
add("HNO3+NaOH","aqueous","HNO3 + NaOH → NaNO3 + H2O","heat","Нейтрализация.");
add("CH3COOH+NaOH","aqueous","CH3COOH + NaOH → CH3COONa + H2O","heat","Нейтрализация слабой кислоты.");
add("HCl+Ca(OH)2","aqueous","2HCl + Ca(OH)2 → CaCl2 + 2H2O","heat","Нейтрализация.");
add("AgNO3+NaCl","aqueous","AgNO3 + NaCl → AgCl↓ + NaNO3","precipitate","Образуется белый творожистый осадок хлорида серебра.",{afterColor:"#f4f5f5"});
add("AgNO3+KCl","aqueous","AgNO3 + KCl → AgCl↓ + KNO3","precipitate","Белый осадок AgCl.",{afterColor:"#f4f5f5"});
add("BaCl2+Na2SO4","aqueous","BaCl2 + Na2SO4 → BaSO4↓ + 2NaCl","precipitate","Белый осадок сульфата бария.",{afterColor:"#f4f4f3"});
add("BaCl2+K2SO4","aqueous","BaCl2 + K2SO4 → BaSO4↓ + 2KCl","precipitate","Белый осадок BaSO4.",{afterColor:"#f4f4f3"});
add("CaCl2+Na2CO3","aqueous","CaCl2 + Na2CO3 → CaCO3↓ + 2NaCl","precipitate","Белый осадок карбоната кальция.");
add("BaCl2+Na2CO3","aqueous","BaCl2 + Na2CO3 → BaCO3↓ + 2NaCl","precipitate","Белый осадок карбоната бария.");
add("CuSO4+NaOH","aqueous","CuSO4 + 2NaOH → Cu(OH)2↓ + Na2SO4","precipitate","Голубой осадок гидроксида меди(II).",{beforeColor:"#79bde4",afterColor:"#5aa6df"});
add("FeCl3+NaOH","aqueous","FeCl3 + 3NaOH → Fe(OH)3↓ + 3NaCl","precipitate","Бурый осадок гидроксида железа(III).",{beforeColor:"#dbcf86",afterColor:"#ae704b"});
add("FeSO4+NaOH","aqueous","FeSO4 + 2NaOH → Fe(OH)2↓ + Na2SO4","precipitate","Зеленоватый осадок гидроксида железа(II), который на воздухе со временем окисляется.",{beforeColor:"#b5d9aa",afterColor:"#93ad84"});
add("ZnSO4+NaOH","aqueous","ZnSO4 + 2NaOH → Zn(OH)2↓ + Na2SO4","precipitate","Белый осадок гидроксида цинка; избыток щёлочи изменит систему.");
add("AlCl3+NaOH","aqueous","AlCl3 + 3NaOH → Al(OH)3↓ + 3NaCl","precipitate","Белый студенистый осадок; при избытке щёлочи возможен его переход в раствор.");
add("Pb(NO3)2+KI","aqueous","Pb(NO3)2 + 2KI → PbI2↓ + 2KNO3","precipitate","Жёлтый осадок иодида свинца(II).",{afterColor:"#f4db54",safety:"Соединения свинца токсичны; только теоретическая схема."});
add("HCl+Na2CO3","aqueous","Na2CO3 + 2HCl → 2NaCl + CO2↑ + H2O","gas","Выделяется углекислый газ.");
add("HCl+NaHCO3","aqueous","NaHCO3 + HCl → NaCl + CO2↑ + H2O","gas","Выделяется углекислый газ.");
add("CH3COOH+NaHCO3","aqueous","NaHCO3 + CH3COOH → CH3COONa + CO2↑ + H2O","gas","Уксусная кислота реагирует с гидрокарбонатом натрия с выделением CO2.");
add("H2SO4+Na2CO3","aqueous","H2SO4 + Na2CO3 → Na2SO4 + CO2↑ + H2O","gas","Карбонат с кислотой выделяет CO2.");
add("HCl+CaCO3","aqueous","CaCO3 + 2HCl → CaCl2 + CO2↑ + H2O","gas","Газ CO2 выделяется на поверхности карбоната кальция.");
add("HCl+MgCO3","aqueous","MgCO3 + 2HCl → MgCl2 + CO2↑ + H2O","gas","Выделяется CO2.");
add("HCl+Zn","aqueous","Zn + 2HCl → ZnCl2 + H2↑","gas","Цинк вытесняет водород из неокисляющей кислоты.",{safety:"Выделяющийся водород горюч."});
add("HCl+Mg","aqueous","Mg + 2HCl → MgCl2 + H2↑","gas","Магний вытесняет водород.",{safety:"Выделяющийся водород горюч."});
add("H2SO4+Zn","aqueous","Zn + H2SO4 → ZnSO4 + H2↑","gas","Разбавленная серная кислота реагирует с цинком.",{safety:"Важно: для концентрированной H2SO4 продукты могут быть другими."});
add("CuSO4+Fe","aqueous","Fe + CuSO4 → FeSO4 + Cu↓","color","Железо вытесняет медь, появляется красноватый налёт меди.",{beforeColor:"#65b2dc",afterColor:"#afcfa1"});
add("CuSO4+Zn","aqueous","Zn + CuSO4 → ZnSO4 + Cu↓","color","Цинк вытесняет медь из раствора.");
add("Ca(OH)2+CO2","aqueous","Ca(OH)2 + CO2 → CaCO3↓ + H2O","precipitate","Известковая вода мутнеет; при избытке CO2 осадок может раствориться.");
add("CuO+HCl","aqueous","CuO + 2HCl → CuCl2 + H2O","dissolution","Чёрный оксид меди(II) растворяется, раствор окрашивается.");
add("MgO+HCl","aqueous","MgO + 2HCl → MgCl2 + H2O","dissolution","Основный оксид реагирует с кислотой.");
add("CH4+O2","ignited","CH4 + 2O2 → CO2 + 2H2O","heat","Полное сгорание при достатке кислорода.",{safety:"Горючая смесь. Только схематичное изображение, без лабораторных инструкций."});
add("C2H5OH+O2","ignited","C2H5OH + 3O2 → 2CO2 + 3H2O","heat","Полное сгорание этанола при достатке кислорода.");
add("Mg+O2","ignited","2Mg + O2 → 2MgO","heat","Окисление магния при горении, яркое свечение.",{safety:"Интенсивное излучение; не повторять без лабораторного контроля."});
add("C+O2","ignited","C + O2 → CO2","heat","Полное сгорание углерода при достатке кислорода.");
add("Fe+S","heated","Fe + S → FeS","heat","Образуется сульфид железа(II); для реальной смеси необходимы конкретные условия.",{safety:"Нагревание смеси металла и серы требует лабораторных мер безопасности."});
add("Cu(OH)2","heated","Cu(OH)2 → CuO + H2O","color","Голубой гидроксид разлагается, образуется чёрный оксид.",{beforeColor:"#65abe0",afterColor:"#484e53"});
add("CaCO3","heated","CaCO3 → CaO + CO2↑","gas","Термическое разложение при достаточно высокой температуре.");
add("H2O2","dry","2H2O2 → 2H2O + O2↑","gas","Разложение может идти медленно; скорость зависит от катализа и условий.");
none("NaCl+KNO3","aqueous","Оба вещества хорошо растворимы; ионный обмен не даёт осадка, газа или слабого электролита.");
none("NaCl+KCl","aqueous","В разбавленном водном растворе нового наблюдаемого продукта нет.");
none("HCl+NaCl","aqueous","При смешении разбавленных растворов нет движущей силы обмена.");
none("Cu+HCl","aqueous","Медь не вытесняет водород из разбавленной неокисляющей соляной кислоты без окислителя.");
none("Ag+HCl","aqueous","Серебро не вытесняет водород из разбавленной соляной кислоты.");
none("KCl+NaOH","aqueous","В водном растворе не образуются осадок, газ или слабый электролит.");

/* Explicit negative controls for simple soluble salts and displacement pairs.
 * These apply to ordinary dilute AQUEOUS mixtures, not concentrated reagents,
 * electrolysis, melt chemistry or oxidation by air.
 */
const furtherNoReactionPairs=[
 ["NaCl","NaNO3"],["NaCl","K2SO4"],["NaCl","Na2SO4"],
 ["KCl","NaNO3"],["KCl","KNO3"],["KCl","Na2SO4"],
 ["KBr","NaNO3"],["KI","NaNO3"],["KBr","KNO3"],
 ["Na2SO4","KNO3"],["Na2SO4","NaNO3"],["K2SO4","KNO3"],
 ["CuSO4","NaCl"],["CuSO4","KNO3"],["ZnSO4","KCl"],
 ["ZnSO4","NaNO3"],["MgSO4","KNO3"],["CaCl2","NaNO3"],
 ["BaCl2","NaNO3"],["FeCl3","NaNO3"],["ZnCl2","KNO3"],
 ["MgCl2","KNO3"],["NaCl","NaOH"],["KCl","KOH"],
 ["Cu","ZnSO4"],["Cu","FeSO4"],["Ag","CuSO4"],
 ["Fe","ZnSO4"],["Zn","MgSO4"],["Fe","MgSO4"]
] as const;
for(const [first,second] of furtherNoReactionPairs)
 none(first+"+"+second,"aqueous",
  "При обычном смешении разбавленных водных растворов нет движущей силы превращения либо металл не вытесняет более активный металл.");

// Conservatively extend the negative controls to simple alkali-metal salts:
// chlorides, bromides, iodides, nitrates, sulfates and carbonates stay soluble.
// No NH4⁺ species: carbonate/ammonium mixtures may evolve NH3.
const solubleSpectators=["NaCl","KCl","NaNO3","KNO3","Na2SO4","K2SO4","KBr","KI","Na2CO3","K2CO3"];
for(let i=0;i<solubleSpectators.length;i++){
 for(let j=i+1;j<solubleSpectators.length;j++){
  const ids=[solubleSpectators[i],solubleSpectators[j]].sort().join("|");
  if(cases.some(row=>row.environment==="aqueous"&&row.reactants.slice().sort().join("|")===ids))continue;
  none(solubleSpectators[i]+"+"+solubleSpectators[j],"aqueous",
   "В разбавленном водном растворе этих солей отсутствует образование малорастворимого соединения, газа или слабого электролита; нет суммарного ионного превращения.");
 }
}


/* Additional explicit classroom cases. Each equation is checked for element balance
 * by scripts/test-lektrus-reaction-library.mjs. Never turn this table into
 * a rule claiming to predict arbitrary mixtures or concentration effects. */
const furtherKnownCases=`
HCl+KOH|aqueous|HCl + KOH → KCl + H2O|heat|Нейтрализация щёлочи
HCl+Ba(OH)2|aqueous|2HCl + Ba(OH)2 → BaCl2 + 2H2O|heat|Нейтрализация
HNO3+KOH|aqueous|HNO3 + KOH → KNO3 + H2O|heat|Нейтрализация
HNO3+Ca(OH)2|aqueous|2HNO3 + Ca(OH)2 → Ca(NO3)2 + 2H2O|heat|Нейтрализация
HNO3+Ba(OH)2|aqueous|2HNO3 + Ba(OH)2 → Ba(NO3)2 + 2H2O|heat|Нейтрализация
CH3COOH+KOH|aqueous|CH3COOH + KOH → CH3COOK + H2O|heat|Реакция уксусной кислоты со щёлочью
CH3COOH+Ca(OH)2|aqueous|2CH3COOH + Ca(OH)2 → Ca(CH3COO)2 + 2H2O|heat|Образуется ацетат кальция
H2SO4+NaOH|aqueous|H2SO4 + 2NaOH → Na2SO4 + 2H2O|heat|Нейтрализация разбавленной кислоты
H2SO4+Ca(OH)2|aqueous|H2SO4 + Ca(OH)2 → CaSO4 + 2H2O|heat|Нейтрализация, малорастворимый сульфат кальция
K2CO3+HCl|aqueous|K2CO3 + 2HCl → 2KCl + CO2↑ + H2O|gas|Карбонат с кислотой выделяет CO2
K2CO3+HNO3|aqueous|K2CO3 + 2HNO3 → 2KNO3 + CO2↑ + H2O|gas|Выделение углекислого газа
Na2CO3+HNO3|aqueous|Na2CO3 + 2HNO3 → 2NaNO3 + CO2↑ + H2O|gas|Выделение CO2
NaHCO3+HNO3|aqueous|NaHCO3 + HNO3 → NaNO3 + CO2↑ + H2O|gas|Выделение CO2
CaCO3+HNO3|aqueous|CaCO3 + 2HNO3 → Ca(NO3)2 + CO2↑ + H2O|gas|Карбонат кальция реагирует с кислотой
MgCO3+HNO3|aqueous|MgCO3 + 2HNO3 → Mg(NO3)2 + CO2↑ + H2O|gas|Карбонат магния выделяет CO2
BaCO3+HCl|aqueous|BaCO3 + 2HCl → BaCl2 + CO2↑ + H2O|gas|Карбонат бария выделяет CO2
BaCO3+HNO3|aqueous|BaCO3 + 2HNO3 → Ba(NO3)2 + CO2↑ + H2O|gas|Карбонат бария выделяет CO2
Na2CO3+CH3COOH|aqueous|Na2CO3 + 2CH3COOH → 2CH3COONa + CO2↑ + H2O|gas|Карбонат реагирует с уксусной кислотой
K2CO3+CH3COOH|aqueous|K2CO3 + 2CH3COOH → 2CH3COOK + CO2↑ + H2O|gas|Карбонат реагирует с уксусной кислотой
AgNO3+CaCl2|aqueous|2AgNO3 + CaCl2 → 2AgCl↓ + Ca(NO3)2|precipitate|Белый осадок AgCl
AgNO3+BaCl2|aqueous|2AgNO3 + BaCl2 → 2AgCl↓ + Ba(NO3)2|precipitate|Белый осадок AgCl
AgNO3+FeCl3|aqueous|3AgNO3 + FeCl3 → 3AgCl↓ + Fe(NO3)3|precipitate|Белый осадок AgCl
AgNO3+FeCl2|aqueous|2AgNO3 + FeCl2 → 2AgCl↓ + Fe(NO3)2|precipitate|Белый осадок AgCl, возможны побочные окислительно-восстановительные процессы
AgNO3+ZnCl2|aqueous|2AgNO3 + ZnCl2 → 2AgCl↓ + Zn(NO3)2|precipitate|Белый осадок AgCl
AgNO3+NH4Cl|aqueous|AgNO3 + NH4Cl → AgCl↓ + NH4NO3|precipitate|Белый осадок AgCl
AgNO3+CuCl2|aqueous|2AgNO3 + CuCl2 → 2AgCl↓ + Cu(NO3)2|precipitate|Белый осадок AgCl
AgNO3+AlCl3|aqueous|3AgNO3 + AlCl3 → 3AgCl↓ + Al(NO3)3|precipitate|Белый осадок AgCl
AgNO3+KI|aqueous|AgNO3 + KI → AgI↓ + KNO3|precipitate|Жёлтый осадок AgI
AgNO3+KBr|aqueous|AgNO3 + KBr → AgBr↓ + KNO3|precipitate|Кремовый осадок AgBr
AgNO3+Na2CO3|aqueous|2AgNO3 + Na2CO3 → Ag2CO3↓ + 2NaNO3|precipitate|Бледно-жёлтый осадок карбоната серебра
BaCl2+CuSO4|aqueous|BaCl2 + CuSO4 → BaSO4↓ + CuCl2|precipitate|Белый осадок BaSO4
BaCl2+ZnSO4|aqueous|BaCl2 + ZnSO4 → BaSO4↓ + ZnCl2|precipitate|Белый осадок BaSO4
BaCl2+MgSO4|aqueous|BaCl2 + MgSO4 → BaSO4↓ + MgCl2|precipitate|Белый осадок BaSO4
BaCl2+FeSO4|aqueous|BaCl2 + FeSO4 → BaSO4↓ + FeCl2|precipitate|Белый осадок BaSO4
BaCl2+(NH4)2SO4|aqueous|BaCl2 + (NH4)2SO4 → BaSO4↓ + 2NH4Cl|precipitate|Белый осадок BaSO4
CaCl2+K2CO3|aqueous|CaCl2 + K2CO3 → CaCO3↓ + 2KCl|precipitate|Белый осадок CaCO3
BaCl2+K2CO3|aqueous|BaCl2 + K2CO3 → BaCO3↓ + 2KCl|precipitate|Белый осадок BaCO3
Ca(NO3)2+Na2CO3|aqueous|Ca(NO3)2 + Na2CO3 → CaCO3↓ + 2NaNO3|precipitate|Белый осадок CaCO3
CaCl2+Na3PO4|aqueous|3CaCl2 + 2Na3PO4 → Ca3(PO4)2↓ + 6NaCl|precipitate|Белый осадок фосфата кальция
Pb(NO3)2+NaCl|aqueous|Pb(NO3)2 + 2NaCl → PbCl2↓ + 2NaNO3|precipitate|Белый малорастворимый хлорид свинца
Pb(NO3)2+Na2SO4|aqueous|Pb(NO3)2 + Na2SO4 → PbSO4↓ + 2NaNO3|precipitate|Белый осадок сульфата свинца
Pb(NO3)2+KBr|aqueous|Pb(NO3)2 + 2KBr → PbBr2↓ + 2KNO3|precipitate|Малорастворимый бромид свинца
CuCl2+NaOH|aqueous|CuCl2 + 2NaOH → Cu(OH)2↓ + 2NaCl|precipitate|Голубой гидроксид меди(II)
CuCl2+KOH|aqueous|CuCl2 + 2KOH → Cu(OH)2↓ + 2KCl|precipitate|Голубой осадок
Cu(NO3)2+NaOH|aqueous|Cu(NO3)2 + 2NaOH → Cu(OH)2↓ + 2NaNO3|precipitate|Голубой осадок
Cu(NO3)2+KOH|aqueous|Cu(NO3)2 + 2KOH → Cu(OH)2↓ + 2KNO3|precipitate|Голубой осадок
FeCl2+NaOH|aqueous|FeCl2 + 2NaOH → Fe(OH)2↓ + 2NaCl|precipitate|Зеленоватый осадок Fe(OH)2
FeCl2+KOH|aqueous|FeCl2 + 2KOH → Fe(OH)2↓ + 2KCl|precipitate|Зеленоватый осадок Fe(OH)2
FeCl3+KOH|aqueous|FeCl3 + 3KOH → Fe(OH)3↓ + 3KCl|precipitate|Бурый осадок гидроксида железа(III)
FeSO4+KOH|aqueous|FeSO4 + 2KOH → Fe(OH)2↓ + K2SO4|precipitate|Зеленоватый осадок
ZnSO4+KOH|aqueous|ZnSO4 + 2KOH → Zn(OH)2↓ + K2SO4|precipitate|Белый амфотерный осадок
MgSO4+NaOH|aqueous|MgSO4 + 2NaOH → Mg(OH)2↓ + Na2SO4|precipitate|Белый осадок Mg(OH)2
MgSO4+KOH|aqueous|MgSO4 + 2KOH → Mg(OH)2↓ + K2SO4|precipitate|Белый осадок Mg(OH)2
AlCl3+KOH|aqueous|AlCl3 + 3KOH → Al(OH)3↓ + 3KCl|precipitate|Белый амфотерный осадок
CuO+HNO3|aqueous|CuO + 2HNO3 → Cu(NO3)2 + H2O|dissolution|Растворяется оксид меди(II)
CuO+H2SO4|aqueous|CuO + H2SO4 → CuSO4 + H2O|dissolution|Растворяется оксид меди(II)
Fe2O3+HCl|aqueous|Fe2O3 + 6HCl → 2FeCl3 + 3H2O|dissolution|Растворяется оксид железа(III)
Fe2O3+H2SO4|aqueous|Fe2O3 + 3H2SO4 → Fe2(SO4)3 + 3H2O|dissolution|Оксид реагирует с серной кислотой
MgO+H2SO4|aqueous|MgO + H2SO4 → MgSO4 + H2O|dissolution|Оксид реагирует с кислотой
CaO+HCl|aqueous|CaO + 2HCl → CaCl2 + H2O|dissolution|Основный оксид реагирует с кислотой
ZnO+HCl|aqueous|ZnO + 2HCl → ZnCl2 + H2O|dissolution|Амфотерный оксид реагирует с кислотой
ZnO+H2SO4|aqueous|ZnO + H2SO4 → ZnSO4 + H2O|dissolution|Амфотерный оксид реагирует с кислотой
CaO+H2O|aqueous|CaO + H2O → Ca(OH)2|heat|Гашение извести, выделяется тепло
Fe+HCl|aqueous|Fe + 2HCl → FeCl2 + H2↑|gas|Железо вытесняет водород из разбавленной кислоты
Fe+H2SO4|aqueous|Fe + H2SO4 → FeSO4 + H2↑|gas|Железо реагирует с разбавленной серной кислотой
Al+HCl|aqueous|2Al + 6HCl → 2AlCl3 + 3H2↑|gas|При преодолении пассивирующей плёнки выделяется водород
Mg+H2SO4|aqueous|Mg + H2SO4 → MgSO4 + H2↑|gas|Магний вытесняет водород из разбавленной кислоты
CuCl2+Zn|aqueous|CuCl2 + Zn → ZnCl2 + Cu↓|color|Цинк вытесняет медь из раствора
CuCl2+Fe|aqueous|CuCl2 + Fe → FeCl2 + Cu↓|color|Железо вытесняет медь из раствора
FeSO4+Zn|aqueous|FeSO4 + Zn → ZnSO4 + Fe↓|color|Цинк вытесняет железо
Cu(NO3)2+Zn|aqueous|Cu(NO3)2 + Zn → Zn(NO3)2 + Cu↓|color|Цинк вытесняет медь
C2H6+O2|ignited|2C2H6 + 7O2 → 4CO2 + 6H2O|heat|Полное горение этана при достатке кислорода
C2H4+O2|ignited|C2H4 + 3O2 → 2CO2 + 2H2O|heat|Полное горение этена
C2H2+O2|ignited|2C2H2 + 5O2 → 4CO2 + 2H2O|heat|Полное горение этина
H2+O2|ignited|2H2 + O2 → 2H2O|heat|Окисление водорода
CO+O2|ignited|2CO + O2 → 2CO2|heat|Окисление монооксида углерода
S+O2|ignited|S + O2 → SO2|heat|Горение серы в кислороде
Al+O2|ignited|4Al + 3O2 → 2Al2O3|heat|Окисление алюминия при условиях преодоления защитной плёнки
CuCO3|heated|CuCO3 → CuO + CO2↑|gas|Нагревание основного карбоната меди(II) имеет более сложный состав; эта схема относится к идеализированному карбонату
MgCO3|heated|MgCO3 → MgO + CO2↑|gas|Разложение карбоната магния при достаточном нагревании
NaHCO3|heated|2NaHCO3 → Na2CO3 + CO2↑ + H2O|gas|Термическое разложение гидрокарбоната натрия
`;
for(const line of furtherKnownCases.trim().split("\n")){
 const [reagents,medium,equation,observation,description]=line.split("|");
 const sorted=reagents.split("+").sort().join("|");
 if(cases.some(c=>c.environment===medium&&c.reactants.slice().sort().join("|")===sorted))continue;
 add(reagents,medium as ReactionEnvironment,equation,observation as Observation,description);
}


/* Additional explicit, balanced school equations. Observations are tied to
 * conditions and quantities typical of qualitative demonstration, not a
 * general-purpose products predictor. */
const additionalSchoolCases=`
H2SO4+BaCl2|aqueous|H2SO4 + BaCl2 → BaSO4↓ + 2HCl|precipitate|Белый сульфат бария образуется из двух прозрачных растворов
H2SO4+Pb(NO3)2|aqueous|H2SO4 + Pb(NO3)2 → PbSO4↓ + 2HNO3|precipitate|Белый осадок сульфата свинца(II)
K2SO4+Pb(NO3)2|aqueous|K2SO4 + Pb(NO3)2 → PbSO4↓ + 2KNO3|precipitate|Осадок малорастворимого сульфата свинца(II)
KCl+Pb(NO3)2|aqueous|2KCl + Pb(NO3)2 → PbCl2↓ + 2KNO3|precipitate|Белый кристаллический осадок хлорида свинца(II)
Na2CO3+Pb(NO3)2|aqueous|Na2CO3 + Pb(NO3)2 → PbCO3↓ + 2NaNO3|precipitate|Белый осадок карбоната свинца(II)
K2CO3+Ca(NO3)2|aqueous|K2CO3 + Ca(NO3)2 → CaCO3↓ + 2KNO3|precipitate|Белый карбонат кальция
Na3PO4+Ca(NO3)2|aqueous|2Na3PO4 + 3Ca(NO3)2 → Ca3(PO4)2↓ + 6NaNO3|precipitate|Белый фосфат кальция
KOH+CuSO4|aqueous|2KOH + CuSO4 → Cu(OH)2↓ + K2SO4|precipitate|Нежно-голубой осадок гидроксида меди(II)
NaOH+Fe2(SO4)3|aqueous|6NaOH + Fe2(SO4)3 → 2Fe(OH)3↓ + 3Na2SO4|precipitate|Красно-бурый осадок гидроксида железа(III)
KOH+Fe2(SO4)3|aqueous|6KOH + Fe2(SO4)3 → 2Fe(OH)3↓ + 3K2SO4|precipitate|Красно-бурый осадок гидроксида железа(III)
NaOH+ZnCl2|aqueous|2NaOH + ZnCl2 → Zn(OH)2↓ + 2NaCl|precipitate|Белый амфотерный гидроксид цинка без избытка щёлочи
KOH+ZnCl2|aqueous|2KOH + ZnCl2 → Zn(OH)2↓ + 2KCl|precipitate|Белый осадок; в избытке щёлочи может раствориться
NaOH+MgCl2|aqueous|2NaOH + MgCl2 → Mg(OH)2↓ + 2NaCl|precipitate|Белый гидроксид магния
KOH+MgCl2|aqueous|2KOH + MgCl2 → Mg(OH)2↓ + 2KCl|precipitate|Белый гидроксид магния
Na2S+CuSO4|aqueous|Na2S + CuSO4 → CuS↓ + Na2SO4|precipitate|Чёрный осадок сульфида меди(II)
Na2S+CuCl2|aqueous|Na2S + CuCl2 → CuS↓ + 2NaCl|precipitate|Чёрный осадок сульфида меди(II)
Na2S+ZnSO4|aqueous|Na2S + ZnSO4 → ZnS↓ + Na2SO4|precipitate|Белый осадок сульфида цинка
Na2S+FeSO4|aqueous|Na2S + FeSO4 → FeS↓ + Na2SO4|precipitate|Чёрный осадок сульфида железа(II)
Na2S+Pb(NO3)2|aqueous|Na2S + Pb(NO3)2 → PbS↓ + 2NaNO3|precipitate|Чёрный осадок сульфида свинца(II)
AgNO3+Na3PO4|aqueous|3AgNO3 + Na3PO4 → Ag3PO4↓ + 3NaNO3|precipitate|Жёлтый осадок фосфата серебра
AgNO3+K2CO3|aqueous|2AgNO3 + K2CO3 → Ag2CO3↓ + 2KNO3|precipitate|Бледно-жёлтый осадок карбоната серебра
BaCl2+Na3PO4|aqueous|3BaCl2 + 2Na3PO4 → Ba3(PO4)2↓ + 6NaCl|precipitate|Белый фосфат бария
Ba(OH)2+H2SO4|aqueous|Ba(OH)2 + H2SO4 → BaSO4↓ + 2H2O|precipitate|Нейтрализация и выпадение белого осадка
HNO3+MgO|aqueous|2HNO3 + MgO → Mg(NO3)2 + H2O|dissolution|Основный оксид реагирует с кислотой
HNO3+CaO|aqueous|2HNO3 + CaO → Ca(NO3)2 + H2O|dissolution|Растворение оксида кальция в кислоте
HNO3+ZnO|aqueous|2HNO3 + ZnO → Zn(NO3)2 + H2O|dissolution|Растворение амфотерного оксида
HNO3+Fe2O3|aqueous|6HNO3 + Fe2O3 → 2Fe(NO3)3 + 3H2O|dissolution|Растворение оксида железа(III)
HCl+FeO|aqueous|2HCl + FeO → FeCl2 + H2O|dissolution|Оксид железа(II) реагирует с кислотой
HCl+Al2O3|aqueous|6HCl + Al2O3 → 2AlCl3 + 3H2O|dissolution|Амфотерный оксид алюминия реагирует с кислотой при подходящих условиях
HCl+Zn(OH)2|aqueous|2HCl + Zn(OH)2 → ZnCl2 + 2H2O|dissolution|Белый осадок растворяется в кислоте
HCl+Al(OH)3|aqueous|3HCl + Al(OH)3 → AlCl3 + 3H2O|dissolution|Гидроксид алюминия растворяется в кислоте
H2SO4+Cu(OH)2|aqueous|H2SO4 + Cu(OH)2 → CuSO4 + 2H2O|dissolution|Голубой осадок растворяется, остаётся голубой раствор
H2SO4+Zn(OH)2|aqueous|H2SO4 + Zn(OH)2 → ZnSO4 + 2H2O|dissolution|Осадок гидроксида цинка растворяется
H2SO4+Mg(OH)2|aqueous|H2SO4 + Mg(OH)2 → MgSO4 + 2H2O|dissolution|Суспензия гидроксида магния нейтрализуется
HCl+Mg(OH)2|aqueous|2HCl + Mg(OH)2 → MgCl2 + 2H2O|dissolution|Осадок гидроксида магния исчезает
HNO3+Cu(OH)2|aqueous|2HNO3 + Cu(OH)2 → Cu(NO3)2 + 2H2O|dissolution|Голубой осадок растворяется, раствор остаётся голубым
CH3COOH+CaCO3|aqueous|2CH3COOH + CaCO3 → Ca(CH3COO)2 + CO2↑ + H2O|gas|Карбонат кальция выделяет углекислый газ при действии уксусной кислоты
CH3COOH+MgCO3|aqueous|2CH3COOH + MgCO3 → Mg(CH3COO)2 + CO2↑ + H2O|gas|Карбонат магния выделяет CO2
CH3COOH+Mg|aqueous|2CH3COOH + Mg → Mg(CH3COO)2 + H2↑|gas|Магний медленно взаимодействует с уксусной кислотой с выделением водорода
AgNO3+Zn|aqueous|2AgNO3 + Zn → Zn(NO3)2 + 2Ag↓|color|Серебристый налёт на цинке
AgNO3+Cu|aqueous|2AgNO3 + Cu → Cu(NO3)2 + 2Ag↓|color|Серебристые кристаллы на меди, раствор становится голубым
H2O2+MnO2|aqueous|2H2O2 → 2H2O + O2↑|gas|Диоксид марганца выступает катализатором разложения пероксида водорода
`;
for(const line of additionalSchoolCases.trim().split("\n")){
 const [reagents,medium,equation,observation,description]=line.split("|");
 const signature=reagents.split("+").sort().join("|");
 if(cases.some(row=>row.environment===medium&&row.reactants.slice().sort().join("|")===signature))continue;
 add(reagents,medium as ReactionEnvironment,equation,observation as Observation,description,
  /Pb\(|Na2S|AgNO3\+|MnO2/.test(reagents)?
   {safety:"Учебная модель: токсичные или потенциально опасные вещества. Не является инструкцией для опыта."}:{});
}

/* More condition-specific school demonstrations. The catalogue deliberately
 * distinguishes an unknown mixture from a confirmed "no reaction" case. */
const extendedSchoolCases=`
HCl+KOH|aqueous|HCl + KOH → KCl + H2O|heat|Нейтрализация соляной кислоты раствором щёлочи
H2SO4+NaOH|aqueous|H2SO4 + 2NaOH → Na2SO4 + 2H2O|heat|Полная нейтрализация разбавленной серной кислоты
HNO3+KOH|aqueous|HNO3 + KOH → KNO3 + H2O|heat|Нейтрализация азотной кислоты
CH3COOH+KOH|aqueous|CH3COOH + KOH → CH3COOK + H2O|heat|Нейтрализация уксусной кислоты
H3PO4+NaOH|aqueous|H3PO4 + 3NaOH → Na3PO4 + 3H2O|heat|Условная схема полной нейтрализации при достатке щёлочи
H2SO4+NaHCO3|aqueous|H2SO4 + 2NaHCO3 → Na2SO4 + 2CO2↑ + 2H2O|gas|Выделяется углекислый газ
Na2CO3+HNO3|aqueous|Na2CO3 + 2HNO3 → 2NaNO3 + CO2↑ + H2O|gas|Карбонат реагирует с разбавленной азотной кислотой
NaHCO3+HNO3|aqueous|NaHCO3 + HNO3 → NaNO3 + CO2↑ + H2O|gas|Гидрокарбонат выделяет углекислый газ
K2CO3+HCl|aqueous|K2CO3 + 2HCl → 2KCl + CO2↑ + H2O|gas|Выделение углекислого газа из карбоната
Na2CO3+CH3COOH|aqueous|Na2CO3 + 2CH3COOH → 2CH3COONa + CO2↑ + H2O|gas|Уксусная кислота взаимодействует с карбонатом
CaCO3+HNO3|aqueous|CaCO3 + 2HNO3 → Ca(NO3)2 + CO2↑ + H2O|gas|Разрушение карбоната кальция с выделением CO2
MgCO3+HNO3|aqueous|MgCO3 + 2HNO3 → Mg(NO3)2 + CO2↑ + H2O|gas|Разрушение карбоната магния с выделением CO2
AgNO3+KI|aqueous|AgNO3 + KI → AgI↓ + KNO3|precipitate|Светло-жёлтый осадок иодида серебра
AgNO3+KBr|aqueous|AgNO3 + KBr → AgBr↓ + KNO3|precipitate|Кремовый осадок бромида серебра
Na2O+H2O|aqueous|Na2O + H2O → 2NaOH|heat|Основный оксид реагирует с водой с выделением тепла
NaOH+NH4Cl|heated|NaOH + NH4Cl → NaCl + NH3↑ + H2O|gas|При нагревании аммонийной соли со щёлочью выделяется аммиак
KOH+NH4Cl|heated|KOH + NH4Cl → KCl + NH3↑ + H2O|gas|При нагревании аммонийной соли со щёлочью выделяется аммиак
`;
for(const line of extendedSchoolCases.trim().split("\n")){
 const [reagents,medium,equation,observation,description]=line.split("|");
 const signature=reagents.split("+").sort().join("|");
 if(cases.some(row=>row.environment===medium&&row.reactants.slice().sort().join("|")===signature))continue;
 add(reagents,medium as ReactionEnvironment,equation,observation as Observation,description,
  reagents.includes("NH4Cl")?
   {safety:"Выделяющийся аммиак раздражает дыхательные пути; только виртуальный опыт."}:{});
}


/* Expanded condition-specific cases for the full existing reagent cupboard.
 * Families and animations encode observations, NOT a general equilibrium,
 * kinetics or energetics predictor. Sources for teaching categories:
 * OpenStax Chemistry 2e §4.2 and RSC Education demonstration collection.
 * Vigorous/toxic reactions are virtual visualizations only. */
const extendedDiverseCases=`
Na+Cl2|ignited|2Na + Cl2 → 2NaCl|heat|Реакция соединения натрия с хлором; возможна яркая вспышка|synthesis|flash
K+Cl2|ignited|2K + Cl2 → 2KCl|heat|Реакция соединения калия с хлором, интенсивное свечение|synthesis|flash
Fe+Cl2|ignited|2Fe + 3Cl2 → 2FeCl3|heat|Горячее железо взаимодействует с хлором|synthesis|sparks
Cu+Cl2|ignited|Cu + Cl2 → CuCl2|heat|Медь образует хлорид меди(II) при нагревании|synthesis|glow
Zn+Cl2|ignited|Zn + Cl2 → ZnCl2|heat|Образуется хлорид цинка|synthesis|glow
Al+Cl2|ignited|2Al + 3Cl2 → 2AlCl3|heat|Реакция соединения алюминия с хлором|synthesis|flash
H2+Cl2|ignited|H2 + Cl2 → 2HCl|heat|Фотохимическая или инициированная реакция; может протекать чрезвычайно быстро|synthesis|flash
Fe+O2|ignited|3Fe + 2O2 → Fe3O4|heat|Образование оксида железа и искры раскалённого металла|combustion|sparks
Zn+O2|ignited|2Zn + O2 → 2ZnO|heat|Горящий цинк образует оксид цинка|combustion|glow
P+O2|ignited|4P + 5O2 → 2P2O5|heat|Образование оксида фосфора(V); белый дым частиц оксида|combustion|smoke
Cu+O2|heated|2Cu + O2 → 2CuO|color|Медная поверхность чернеет при окислении|synthesis|colorShift
Zn+S|heated|Zn + S → ZnS|heat|Синтез сульфида цинка при нагревании|synthesis|glow
Na2O+CO2|dry|Na2O + CO2 → Na2CO3|heat|Основный оксид связывает кислотный оксид|synthesis|thermal
CaO+CO2|dry|CaO + CO2 → CaCO3|heat|Образование карбоната кальция|synthesis|thermal
MgO+CO2|dry|MgO + CO2 → MgCO3|heat|Схематическое образование карбоната магния при подходящих условиях|synthesis|thermal
SO3+H2O|aqueous|SO3 + H2O → H2SO4|heat|Резко экзотермическая гидратация серного ангидрида|hydration|steam
P2O5+H2O|aqueous|P2O5 + 3H2O → 2H3PO4|heat|Образование ортофосфорной кислоты из оксида(V)|hydration|steam
MgO+H2O|aqueous|MgO + H2O → Mg(OH)2|dissolution|Медленная гидратация оксида магния|hydration|colorShift
NH3+HCl|dry|NH3 + HCl → NH4Cl|color|Белый дым мельчайших частиц хлорида аммония|synthesis|smoke
NH3+H2SO4|aqueous|2NH3 + H2SO4 → (NH4)2SO4|heat|Связывание аммиака серной кислотой|neutralization|thermal
CH3OH+O2|ignited|2CH3OH + 3O2 → 2CO2 + 4H2O|heat|Горение метанола с бледным пламенем|combustion|flame
H2S+O2|ignited|2H2S + 3O2 → 2SO2 + 2H2O|heat|Горение сероводорода; продукт токсичен|combustion|flame
NH3+O2|ignited|4NH3 + 3O2 → 2N2 + 6H2O|heat|Горение аммиака в кислороде без катализатора|combustion|flame
C12H22O11+O2|ignited|C12H22O11 + 12O2 → 12CO2 + 11H2O|heat|Идеализированная полная схема горения сахарозы|combustion|flame
C6H12O6+O2|ignited|C6H12O6 + 6O2 → 6CO2 + 6H2O|heat|Идеализированная полная схема окисления глюкозы|combustion|flame
Na+H2O|aqueous|2Na + 2H2O → 2NaOH + H2↑|gas|Бурное взаимодействие щелочного металла с водой, выделяются водород и тепло|displacement|fizz
K+H2O|aqueous|2K + 2H2O → 2KOH + H2↑|gas|Энергичная реакция калия с водой, возможно воспламенение водорода|displacement|flash
Ca+H2O|aqueous|Ca + 2H2O → Ca(OH)2 + H2↑|gas|Кальций реагирует с водой, появляются пузырьки водорода|displacement|fizz
Mg+CuSO4|aqueous|Mg + CuSO4 → MgSO4 + Cu↓|color|Магний вытесняет медь, выпадает красноватый металл|displacement|crystals
Mg+CuCl2|aqueous|Mg + CuCl2 → MgCl2 + Cu↓|color|Магний вытесняет медь из хлорида|displacement|crystals
Mg+FeSO4|aqueous|Mg + FeSO4 → MgSO4 + Fe↓|color|Магний вытесняет железо|displacement|crystals
Mg+AgNO3|aqueous|Mg + 2AgNO3 → Mg(NO3)2 + 2Ag↓|color|Серебро осаждается на поверхности магния|displacement|crystals
Zn+FeCl2|aqueous|Zn + FeCl2 → ZnCl2 + Fe↓|color|Замещение железа цинком|displacement|crystals
Fe+Cu(NO3)2|aqueous|Fe + Cu(NO3)2 → Fe(NO3)2 + Cu↓|color|Железо покрывается медью|displacement|crystals
Fe+AgNO3|aqueous|Fe + 2AgNO3 → Fe(NO3)2 + 2Ag↓|color|Серебристый налёт выделяется на железе|displacement|crystals
Zn+AgNO3|aqueous|Zn + 2AgNO3 → Zn(NO3)2 + 2Ag↓|color|Серебро выделяется на цинке|displacement|crystals
Al+CuSO4|aqueous|2Al + 3CuSO4 → Al2(SO4)3 + 3Cu↓|color|После разрушения защитной плёнки алюминий вытесняет медь|displacement|crystals
Al+CuCl2|aqueous|2Al + 3CuCl2 → 2AlCl3 + 3Cu↓|heat|Восстановление меди алюминием с выделением тепла|redox|thermal
Al+AgNO3|aqueous|Al + 3AgNO3 → Al(NO3)3 + 3Ag↓|color|На активированной поверхности алюминия выделяется серебро|displacement|crystals
Cu+FeCl3|aqueous|Cu + 2FeCl3 → CuCl2 + 2FeCl2|color|Ионы железа(III) окисляют медь, окраска раствора изменяется|redox|colorShift
Fe+FeCl3|aqueous|Fe + 2FeCl3 → 3FeCl2|color|Железо восстанавливает ионы железа(III) до железа(II)|redox|colorShift
KI+Cl2|aqueous|2KI + Cl2 → 2KCl + I2|color|Хлор вытесняет йод из иодида; появляется бурое окрашивание|redox|colorShift
KBr+Cl2|aqueous|2KBr + Cl2 → 2KCl + Br2|color|Хлор окисляет бромид, раствор окрашивается|redox|colorShift
KI+Br2|aqueous|2KI + Br2 → 2KBr + I2|color|Бром окисляет иодид до йода|redox|colorShift
FeCl2+Cl2|aqueous|2FeCl2 + Cl2 → 2FeCl3|color|Хлор окисляет железо(II) до железа(III)|redox|colorShift
FeSO4+H2O2+H2SO4|aqueous|2FeSO4 + H2SO4 + H2O2 → Fe2(SO4)3 + 2H2O|color|Окисление железа(II) пероксидом в кислой среде|redox|colorShift
KI+H2O2+H2SO4|aqueous|2KI + H2O2 + H2SO4 → I2 + K2SO4 + 2H2O|color|Йодид окисляется пероксидом в кислой среде|redox|colorShift
KMnO4+H2O2+H2SO4|aqueous|2KMnO4 + 5H2O2 + 3H2SO4 → K2SO4 + 2MnSO4 + 5O2↑ + 8H2O|gas|Обесцвечивание перманганата с выделением кислорода в кислой среде|redox|fizz
FeCl3+KI|aqueous|2FeCl3 + 2KI → 2FeCl2 + 2KCl + I2|color|Железо(III) окисляет иодид до йода|redox|colorShift
H2S+Cl2|aqueous|H2S + Cl2 → 2HCl + S↓|precipitate|Жёлтая взвесь серы, хлор восстанавливается до хлорида|redox|crystals
H2S+I2|aqueous|H2S + I2 → 2HI + S↓|precipitate|Образование серы; йод восстанавливается|redox|crystals
CuO+H2|heated|CuO + H2 → Cu + H2O|color|Чёрный оксид восстанавливается до красной меди|redox|colorShift
CuO+CO|heated|CuO + CO → Cu + CO2|color|Монооксид углерода восстанавливает медь из оксида|redox|colorShift
Fe2O3+CO|heated|Fe2O3 + 3CO → 2Fe + 3CO2|color|Восстановление оксида железа(III) при высоких температурах|redox|colorShift
Fe2O3+H2|heated|Fe2O3 + 3H2 → 2Fe + 3H2O|color|Восстановление железа водородом при высоких температурах|redox|colorShift
CuO+C|heated|2CuO + C → 2Cu + CO2|color|Восстановление меди углеродом при сильном нагревании|redox|glow
CuSO4|heated|CuSO4 → CuO + SO3↑|gas|Сульфат меди(II) при сильном нагревании разлагается|decomposition|smoke
FeSO4|heated|2FeSO4 → Fe2O3 + SO2↑ + SO3↑|gas|При сильном нагревании сульфата железа(II) появляются оксид и газы|decomposition|smoke
Fe(OH)3|heated|2Fe(OH)3 → Fe2O3 + 3H2O|color|При нагревании бурый гидроксид теряет воду|decomposition|colorShift
Fe(OH)2|heated|Fe(OH)2 → FeO + H2O|color|Разложение гидроксида железа(II)|decomposition|colorShift
Mg(OH)2|heated|Mg(OH)2 → MgO + H2O|color|При нагревании гидроксид магния образует оксид|decomposition|colorShift
Ca(OH)2|heated|Ca(OH)2 → CaO + H2O|color|Разложение гидроксида кальция при сильном нагревании|decomposition|colorShift
Al(OH)3|heated|2Al(OH)3 → Al2O3 + 3H2O|color|Образуется оксид алюминия и вода|decomposition|colorShift
Zn(OH)2|heated|Zn(OH)2 → ZnO + H2O|color|Образуется оксид цинка|decomposition|colorShift
AgNO3|heated|2AgNO3 → 2Ag + 2NO2↑ + O2↑|gas|Термическое разложение нитрата серебра с выделением оксида азота(IV)|decomposition|smoke
Cu(NO3)2|heated|2Cu(NO3)2 → 2CuO + 4NO2↑ + O2↑|gas|Бурый токсичный газ выделяется при нагревании нитрата меди|decomposition|smoke
Pb(NO3)2|heated|2Pb(NO3)2 → 2PbO + 4NO2↑ + O2↑|gas|Бурый токсичный газ выделяется при разложении нитрата свинца|decomposition|smoke
NaNO3|heated|2NaNO3 → 2NaNO2 + O2↑|gas|При сильном нагревании выделяется кислород|decomposition|fizz
KNO3|heated|2KNO3 → 2KNO2 + O2↑|gas|Разложение нитрата калия при сильном нагревании|decomposition|fizz
KMnO4|heated|2KMnO4 → K2MnO4 + MnO2 + O2↑|gas|Перманганат разлагается при нагревании с выделением кислорода|decomposition|fizz
H2CO3|aqueous|H2CO3 → H2O + CO2↑|gas|Нестойкая угольная кислота разлагается|decomposition|fizz
H2O2|aqueous|2H2O2 → 2H2O + O2↑|gas|Медленное разложение пероксида водорода без катализатора|decomposition|fizz
FeS+HCl|aqueous|FeS + 2HCl → FeCl2 + H2S↑|gas|Образуется токсичный сероводород|exchange|fizz
FeS+H2SO4|aqueous|FeS + H2SO4 → FeSO4 + H2S↑|gas|Выделяется сероводород|exchange|fizz
Na2S+HCl|aqueous|Na2S + 2HCl → 2NaCl + H2S↑|gas|Сульфид реагирует с кислотой|exchange|fizz
Na2S+H2SO4|aqueous|Na2S + H2SO4 → Na2SO4 + H2S↑|gas|Кислота вытесняет сероводород из соли|exchange|fizz
CO2+NaOH|aqueous|CO2 + 2NaOH → Na2CO3 + H2O|heat|Щёлочь поглощает углекислый газ|neutralization|thermal
CO2+KOH|aqueous|CO2 + 2KOH → K2CO3 + H2O|heat|Щёлочь связывает углекислый газ|neutralization|thermal
SO2+NaOH|aqueous|SO2 + 2NaOH → Na2SO3 + H2O|heat|Образуется сульфит натрия|neutralization|thermal
SO2+KOH|aqueous|SO2 + 2KOH → K2SO3 + H2O|heat|Образуется сульфит калия|neutralization|thermal
SO3+NaOH|aqueous|SO3 + 2NaOH → Na2SO4 + H2O|heat|Серный ангидрид реагирует со щёлочью|neutralization|thermal
SO3+KOH|aqueous|SO3 + 2KOH → K2SO4 + H2O|heat|Образуется сульфат калия|neutralization|thermal
SO2+Ca(OH)2|aqueous|SO2 + Ca(OH)2 → CaSO3↓ + H2O|precipitate|Белая суспензия сульфита кальция|exchange|crystals
NH3+H2O|aqueous|NH3 + H2O → NH4OH|dissolution|Условная школьная запись равновесного растворения аммиака|hydration|colorShift
NaHCO3+NaOH|aqueous|NaHCO3 + NaOH → Na2CO3 + H2O|heat|Гидрокарбонат нейтрализуется щёлочью|neutralization|thermal
HBr+NaOH|aqueous|HBr + NaOH → NaBr + H2O|heat|Нейтрализация бромоводородной кислоты|neutralization|thermal
HF+NaOH|aqueous|HF + NaOH → NaF + H2O|heat|Нейтрализация плавиковой кислоты|neutralization|thermal
H3PO4+KOH|aqueous|H3PO4 + 3KOH → K3PO4 + 3H2O|heat|Условная полная нейтрализация кислоты щёлочью|neutralization|thermal
CH3COOH+Zn|aqueous|2CH3COOH + Zn → Zn(CH3COO)2 + H2↑|gas|Цинк медленно реагирует с уксусной кислотой|displacement|fizz
CH3COOH+Fe|aqueous|2CH3COOH + Fe → Fe(CH3COO)2 + H2↑|gas|Медленная реакция железа с уксусной кислотой|displacement|fizz
CH3COOH+CaO|aqueous|2CH3COOH + CaO → Ca(CH3COO)2 + H2O|dissolution|Образование ацетата кальция|neutralization|colorShift
C2H4+Br2|aqueous|C2H4 + Br2 → C2H4Br2|color|Обесцвечивание бромной воды этеном|organic|colorShift
C2H2+Br2|aqueous|C2H2 + Br2 → C2H2Br2|color|Присоединение одной молекулы брома к этину|organic|colorShift
C2H5OH+CuO|heated|C2H5OH + CuO → CH3CHO + Cu + H2O|color|Окисление этанола и восстановление меди(II)|organic|colorShift
CH3OH+CuO|heated|CH3OH + CuO → HCHO + Cu + H2O|color|Окисление метанола до формальдегида|organic|colorShift
C2H5OH+Na|dry|2C2H5OH + 2Na → 2C2H5ONa + H2↑|gas|Образование этилата натрия с выделением водорода|organic|fizz
CH3OH+Na|dry|2CH3OH + 2Na → 2CH3ONa + H2↑|gas|Образование метилата натрия|organic|fizz
`;
for(const line of extendedDiverseCases.trim().split("\n")){
 const [reagents,medium,equation,observation,description,family,visual]=line.split("|");
 const signature=reagents.split("+").sort().join("|");
 if(cases.some(row=>row.environment===medium&&row.reactants.slice().sort().join("|")===signature))continue;
 add(reagents,medium as ReactionEnvironment,equation,observation as Observation,description,{
  family:family as ReactionFamily,visual:visual as ReactionVisual,
  safety:/Na\+|K\+|Cl2|P\+|H2S|Pb\(|HNO3|HF\+|AgNO3\+|NO2/.test(reagents+" "+equation)?
   "Опасная реакция: только виртуальная демонстрация; не является инструкцией для реального опыта.":undefined
 });
}
/** Additional condition-scoped, balanced school cases. Flash effects remain
 * reserved for specifically reviewed rapid reactions, not every combustion. */
const newVerifiedCases=`
AgNO3+NaBr|aqueous|AgNO3 + NaBr → AgBr↓ + NaNO3|precipitate|Кремовый осадок бромида серебра|exchange|crystals
AgNO3+KBr|aqueous|AgNO3 + KBr → AgBr↓ + KNO3|precipitate|Кремовый осадок бромида серебра|exchange|crystals
AgNO3+KI|aqueous|AgNO3 + KI → AgI↓ + KNO3|precipitate|Жёлтый осадок иодида серебра|exchange|crystals
SrCl2+Na2SO4|aqueous|SrCl2 + Na2SO4 → SrSO4↓ + 2NaCl|precipitate|Белый малорастворимый сульфат стронция|exchange|crystals
SrCl2+Na2CO3|aqueous|SrCl2 + Na2CO3 → SrCO3↓ + 2NaCl|precipitate|Белый карбонат стронция|exchange|crystals
CaCl2+Na3PO4|aqueous|3CaCl2 + 2Na3PO4 → Ca3(PO4)2↓ + 6NaCl|precipitate|Белый фосфат кальция|exchange|crystals
MgCl2+NaOH|aqueous|MgCl2 + 2NaOH → Mg(OH)2↓ + 2NaCl|precipitate|Белый гидроксид магния|exchange|crystals
NiSO4+NaOH|aqueous|NiSO4 + 2NaOH → Ni(OH)2↓ + Na2SO4|precipitate|Зеленоватый гидроксид никеля(II)|exchange|crystals
NiCl2+NaOH|aqueous|NiCl2 + 2NaOH → Ni(OH)2↓ + 2NaCl|precipitate|Зеленоватый осадок гидроксида никеля(II)|exchange|crystals
CoCl2+NaOH|aqueous|CoCl2 + 2NaOH → Co(OH)2↓ + 2NaCl|precipitate|Гидроксид кобальта(II), изменение оттенка зависит от условий|exchange|crystals
Fe(NO3)3+NaOH|aqueous|Fe(NO3)3 + 3NaOH → Fe(OH)3↓ + 3NaNO3|precipitate|Бурый гидроксид железа(III)|exchange|crystals
Fe(NO3)2+NaOH|aqueous|Fe(NO3)2 + 2NaOH → Fe(OH)2↓ + 2NaNO3|precipitate|Зеленоватый осадок гидроксида железа(II)|exchange|crystals
Mg(NO3)2+NaOH|aqueous|Mg(NO3)2 + 2NaOH → Mg(OH)2↓ + 2NaNO3|precipitate|Белый гидроксид магния|exchange|crystals
Ba(NO3)2+Na2SO4|aqueous|Ba(NO3)2 + Na2SO4 → BaSO4↓ + 2NaNO3|precipitate|Белый сульфат бария|exchange|crystals
Na2S+ZnCl2|aqueous|Na2S + ZnCl2 → ZnS↓ + 2NaCl|precipitate|Белый сульфид цинка|exchange|crystals
Na2S+FeCl2|aqueous|Na2S + FeCl2 → FeS↓ + 2NaCl|precipitate|Чёрный сульфид железа(II)|exchange|crystals
Na2S+CuCl2|aqueous|Na2S + CuCl2 → CuS↓ + 2NaCl|precipitate|Чёрный сульфид меди(II)|exchange|crystals
HCl+LiOH|aqueous|HCl + LiOH → LiCl + H2O|heat|Нейтрализация гидроксида лития|neutralization|thermal
HNO3+LiOH|aqueous|HNO3 + LiOH → LiNO3 + H2O|heat|Нейтрализация азотной кислоты|neutralization|thermal
H2SO4+LiOH|aqueous|H2SO4 + 2LiOH → Li2SO4 + 2H2O|heat|Нейтрализация серной кислоты|neutralization|thermal
CH3COOH+LiOH|aqueous|CH3COOH + LiOH → CH3COOLi + H2O|heat|Нейтрализация уксусной кислоты|neutralization|thermal
HCl+NH4OH|aqueous|HCl + NH4OH → NH4Cl + H2O|heat|Нейтрализация раствора аммиака (школьная условная запись)|neutralization|thermal
H2SO4+NH4OH|aqueous|H2SO4 + 2NH4OH → (NH4)2SO4 + 2H2O|heat|Нейтрализация раствора аммиака (школьная схема)|neutralization|thermal
HCl+MgO|aqueous|2HCl + MgO → MgCl2 + H2O|dissolution|Реакция основного оксида с кислотой|neutralization|colorShift
H2SO4+MgO|aqueous|H2SO4 + MgO → MgSO4 + H2O|dissolution|Реакция оксида магния с кислотой|neutralization|colorShift
HNO3+CaCO3|aqueous|2HNO3 + CaCO3 → Ca(NO3)2 + CO2↑ + H2O|gas|Реакция карбоната с кислотой|exchange|fizz
HCl+Li2CO3|aqueous|2HCl + Li2CO3 → 2LiCl + CO2↑ + H2O|gas|Карбонат лития реагирует с кислотой|exchange|fizz
CaCl2+(NH4)2CO3|aqueous|CaCl2 + (NH4)2CO3 → CaCO3↓ + 2NH4Cl|precipitate|Осаждение карбоната кальция|exchange|crystals
C3H8+O2|ignited|C3H8 + 5O2 → 3CO2 + 4H2O|heat|Полное сгорание пропана при избытке кислорода|combustion|flame
C4H10+O2|ignited|2C4H10 + 13O2 → 8CO2 + 10H2O|heat|Полное сгорание бутана при достатке кислорода|combustion|flame
C2H6+O2|ignited|2C2H6 + 7O2 → 4CO2 + 6H2O|heat|Полное сгорание этана при достатке кислорода|combustion|flame
C3H6+O2|ignited|2C3H6 + 9O2 → 6CO2 + 6H2O|heat|Полное сгорание пропена при достатке кислорода|combustion|flame
C3H8O+O2|ignited|2C3H8O + 9O2 → 6CO2 + 8H2O|heat|Полное горение пропан-2-ола|combustion|flame
NaHCO3|heated|2NaHCO3 → Na2CO3 + H2O + CO2↑|gas|Выделение пара и углекислого газа при нагревании|decomposition|steam
`;
for(const line of newVerifiedCases.trim().split("\n")){
 const [reactants,medium,equation,observation,description,family,visual]=line.split("|");
 const signature=reactants.split("+").sort().join("|");
 if(cases.some(row=>row.environment===medium&&row.reactants.slice().sort().join("|")===signature))continue;
 add(reactants,medium as ReactionEnvironment,equation,observation as Observation,description,{
  family:family as ReactionFamily,visual:visual as ReactionVisual,
  safety:/Ni|Co|AgNO3|Ba\(|BaCl2|Ba\(NO3\)2|Na2S|HNO3/.test(reactants)?
   "Только виртуальная модель: некоторые вещества токсичны или опасны.":undefined
 });
}
/** Complementary school cases: independently balanced before registration.
 * Conditions refer to dilute classroom solutions. Insoluble solids are
 * represented by crystals rather than fictitious flames. */
const complementaryAqueousCases=`
NiSO4+KOH|aqueous|NiSO4 + 2KOH → Ni(OH)2↓ + K2SO4|precipitate|Зелёный осадок гидроксида никеля|exchange|crystals
CoCl2+KOH|aqueous|CoCl2 + 2KOH → Co(OH)2↓ + 2KCl|precipitate|Гидроксид кобальта(II), оттенок зависит от условий|exchange|crystals
AgNO3+MgCl2|aqueous|2AgNO3 + MgCl2 → 2AgCl↓ + Mg(NO3)2|precipitate|Белый хлорид серебра|exchange|crystals
SrCl2+K2SO4|aqueous|SrCl2 + K2SO4 → SrSO4↓ + 2KCl|precipitate|Малорастворимый сульфат стронция|exchange|crystals
SrCl2+K2CO3|aqueous|SrCl2 + K2CO3 → SrCO3↓ + 2KCl|precipitate|Белый карбонат стронция|exchange|crystals
CaCl2+Na2SO4|aqueous|CaCl2 + Na2SO4 → CaSO4↓ + 2NaCl|precipitate|При подходящих концентрациях образуется малорастворимый сульфат кальция|exchange|crystals
Ba(NO3)2+K2SO4|aqueous|Ba(NO3)2 + K2SO4 → BaSO4↓ + 2KNO3|precipitate|Белый сульфат бария|exchange|crystals
LiOH+CO2|aqueous|2LiOH + CO2 → Li2CO3↓ + H2O|precipitate|Образование малорастворимого карбоната лития|exchange|crystals
Li2CO3+HNO3|aqueous|Li2CO3 + 2HNO3 → 2LiNO3 + CO2↑ + H2O|gas|Углекислый газ выделяется при реакции карбоната с кислотой|displacement|fizz
Li+H2O|aqueous|2Li + 2H2O → 2LiOH + H2↑|gas|Литий реагирует с водой с выделением водорода|displacement|fizz
Na2CO3+Ca(OH)2|aqueous|Na2CO3 + Ca(OH)2 → CaCO3↓ + 2NaOH|precipitate|Осаждение карбоната кальция|exchange|crystals
K2CO3+Ca(OH)2|aqueous|K2CO3 + Ca(OH)2 → CaCO3↓ + 2KOH|precipitate|Белый карбонат кальция|exchange|crystals
Na2S+NiSO4|aqueous|Na2S + NiSO4 → NiS↓ + Na2SO4|precipitate|Чёрный осадок сульфида никеля|exchange|crystals
Na2S+CoCl2|aqueous|Na2S + CoCl2 → CoS↓ + 2NaCl|precipitate|Тёмный осадок сульфида кобальта|exchange|crystals
AgNO3+LiCl|aqueous|AgNO3 + LiCl → AgCl↓ + LiNO3|precipitate|Белый осадок хлорида серебра|exchange|crystals
Mg(NO3)2+KOH|aqueous|Mg(NO3)2 + 2KOH → Mg(OH)2↓ + 2KNO3|precipitate|Белый гидроксид магния|exchange|crystals
Fe(NO3)3+KOH|aqueous|Fe(NO3)3 + 3KOH → Fe(OH)3↓ + 3KNO3|precipitate|Бурый осадок гидроксида железа(III)|exchange|crystals
Fe(NO3)2+KOH|aqueous|Fe(NO3)2 + 2KOH → Fe(OH)2↓ + 2KNO3|precipitate|Зеленоватый гидроксид железа(II)|exchange|crystals
NiCl2+KOH|aqueous|NiCl2 + 2KOH → Ni(OH)2↓ + 2KCl|precipitate|Зеленоватый осадок гидроксида никеля|exchange|crystals
H3PO4+Ca(OH)2|aqueous|2H3PO4 + 3Ca(OH)2 → Ca3(PO4)2↓ + 6H2O|precipitate|Условное полное осаждение фосфата кальция при заданном соотношении|exchange|crystals
H3PO4+Ba(OH)2|aqueous|2H3PO4 + 3Ba(OH)2 → Ba3(PO4)2↓ + 6H2O|precipitate|Условное полное осаждение фосфата бария при заданном соотношении|exchange|crystals
`;
for(const row of complementaryAqueousCases.trim().split("\n")){
 const [reactants,environment,equation,observation,description,family,visual]=row.split("|");
 const signature=reactants.split("+").sort().join("|");
 if(cases.some(v=>v.environment===environment&&v.reactants.slice().sort().join("|")===signature))continue;
 add(reactants,environment as ReactionEnvironment,equation,observation as Observation,description,{
  family:family as ReactionFamily,visual:visual as ReactionVisual,
  safety:/Pb|AgNO3|Ba|Ni|Co|Na2S|HNO3|Li\+H2O|Ca\+H2O/.test(reactants)?
   "Опасные вещества: только виртуальная модель, не руководство к реальному опыту.":undefined
 });
}
/** Minimum modeled activation points, not laboratory instructions. A case
 * is shown by the heater only if it can actually reach the threshold. */
const thermalCaseThresholds:Record<string,number>={
 "CaCO3":825,"BaCO3":1000,"MgCO3":350,"CuCO3":200,
 "NaHCO3":85,"Cu(OH)2":95,"Fe(OH)3":150,"Fe(OH)2":150,
 "Mg(OH)2":350,"Ca(OH)2":500,"Al(OH)3":200,"Zn(OH)2":150,
 "CuSO4":650,"FeSO4":480,"AgNO3":430,"Cu(NO3)2":180,
 "Pb(NO3)2":220,"NaNO3":380,"KNO3":410,"KMnO4":220,
 "Zn+S":190,"Fe+S":200,"Cu+O2":220,"CuO+H2":200,
 "CuO+CO":200,"CuO+C":300,"Fe2O3+CO":700,"Fe2O3+H2":550,
 "C2H5OH+CuO":210,"CH3OH+CuO":200
};
const canonicalThermalThresholds=Object.fromEntries(
 Object.entries(thermalCaseThresholds).map(([signature,temp])=>
  [signature.split("+").sort().join("+"),temp]));
for(const row of cases){
 if(row.status!=="reaction")continue;
 if(row.environment==="heated"||row.environment==="ignited"){
  const signature=row.reactants.slice().sort().join("+");
  row.minTemperatureC=canonicalThermalThresholds[signature]??
   row.reactants.map(id=>thermalCaseThresholds[id]).find(v=>v!==undefined)??
   (row.environment==="ignited"?135:90);
 }
}
// Annotate existing reviewed cases, so both new and old reactions use one
// visual language. Explosive visuals require a specifically identified case.
for(const row of cases){
 if(row.status==="none")continue;
 if(!row.family){
  const metal=["Fe","Cu","Zn","Mg","Al","Ca","Na","K"];
  const displacement=row.reactants.some(r=>metal.includes(r))&&
   row.reactants.some(r=>r!=="Fe"&&r!=="Cu"&&r!=="Zn"&&r!=="Mg"&&
    r!=="Al"&&r!=="Ca"&&r!=="Na"&&r!=="K"&&r!=="S"&&r!=="O2");
  const isHydration=row.reactants.includes("H2O")&&
   row.reactants.some(r=>["CaO","Na2O","MgO","P2O5","SO3"].includes(r));
  row.family=row.reactants.length===1?"decomposition":
   row.environment==="ignited"?"combustion":
   isHydration?"hydration":
   row.environment==="heated"&&row.reactants.includes("Fe")&&
    row.reactants.includes("S")?"synthesis":
   row.reactants.includes("H2O2")&&row.reactants.includes("MnO2")?
    "decomposition":
   displacement?"displacement":
   row.observation==="heat"&&row.environment==="aqueous"?"neutralization":
   row.observation==="color"?"redox":"exchange";
 }
 if(!row.visual){
  row.visual=row.environment==="ignited"?
    row.reactants.includes("H2")&&row.reactants.includes("O2")?"flash":
    row.reactants.includes("Mg")?"glow":"flame":
   row.observation==="gas"?"fizz":
   row.observation==="precipitate"?"crystals":
   row.observation==="heat"?"thermal":
   row.observation==="color"?"colorShift":undefined;
 }
}

/** Appearance is computed from the actual products, not from the selected
 * reaction category. The solid never recolors the supernatant by accident. */
export const schoolSolidColors:Record<string,string>={
 "AgCl":"#f2f3f5","AgBr":"#eddfad","AgI":"#e9ca37",
 "Ag2CO3":"#eddf99","Ag3PO4":"#e5ce36","PbI2":"#f4d82e",
 "PbCl2":"#f0f0ea","PbBr2":"#e9e8db","PbSO4":"#f1f1eb",
 "PbCO3":"#f1f2eb","PbS":"#222b32",
 "BaSO4":"#f2f3f2","BaCO3":"#f2f1ed","Ba3(PO4)2":"#f3f3ec",
 "CaCO3":"#f1f0e9","Ca3(PO4)2":"#eeefea","Mg(OH)2":"#f4f4ef",
 "Cu(OH)2":"#74badd","CuS":"#202a32","Cu":"#b76b47",
 "Fe(OH)2":"#90ae81","Fe(OH)3":"#a26142","FeS":"#252a30",
 "Zn(OH)2":"#f1f2ee","ZnS":"#f0f1e7","Al(OH)3":"#f2f2ec",
 "Ag":"#c6ced2","Fe":"#788f90",
 "MgO":"#f1f1e9","Fe3O4":"#42494d","ZnO":"#f0efdf",
 "CuO":"#303538","Al2O3":"#eceeec","CaO":"#ecece2",
 "NaCl":"#f1f0e9","KCl":"#eeefeb","P2O5":"#f0f0ec",
 "Na2CO3":"#ebe9e3","K2CO3":"#ecece7",
 "MnO2":"#34373b","Fe2O3":"#9a5e43","PbO":"#d5a958",
 "K2MnO4":"#66945e",
 "SrSO4":"#f3f3ef","SrCO3":"#f4f3ee",
 "Ni(OH)2":"#91b796","Co(OH)2":"#9d86b1",
 "AgBr":"#e8d5a0","AgI":"#e7ca39",
 "Li2CO3":"#f3f3ed","ZnS":"#f2f1e9"
};
export function reactionProducts(equation:string):string[]{
 const rhs=equation.split("→")[1]??"";
 return rhs.split(/\s+\+\s+/).map(value=>value.trim()).filter(Boolean);
}
export function reactionAppearance(row:ReactionCase|undefined){
 if(!row)return{solutionBefore:"#c8e2e7",solutionAfter:"#c8e2e7",solid:"",solidColor:"",
  gas:"",products:[] as string[],productSolid:"",productSolidColor:""};
 const products=reactionProducts(row.equation);
 const solid=products.find(product=>product.includes("↓"))?.replace(/^\d+\s*/,"").replace("↓","")??"";
 const gas=products.find(product=>product.includes("↑"))?.replace(/^\d+\s*/,"").replace("↑","")??"";
 // After a verified dry/thermal reaction the product can be a visible
 // powder or metal, not the original reagent or an imaginary blue liquid.
 const productSolid=row.environment!=="aqueous"?
  products.map(p=>p.replace(/^\d+\s*/,"").replace(/[↓↑]/g,""))
   .find(id=>schoolSolidColors[id]!==undefined)??"":"";
 const productSolidColor=schoolSolidColors[productSolid]??"";
 const solutionBefore=row.beforeColor??"#cae1e9";
 // Dissolved copper(II) stays blue even if a white solid settles.
 const solutionAfter=row.observation==="color"?
    row.afterColor??(products.some(p=>/Cu\(NO3\)2|CuSO4|CuCl2/.test(p))?"#79b9db":
     products.some(p=>/\bI2\b/.test(p))?"#9d6b36":
     products.some(p=>/\bBr2\b/.test(p))?"#be7343":"#c8e3e7"):
   products.some(p=>/Cu\(NO3\)2|CuSO4|CuCl2/.test(p))?"#8dbfd6":
   products.some(p=>/FeSO4|FeCl2/.test(p))?"#c3d8b8":
   products.some(p=>/FeCl3|Fe\(NO3\)3/.test(p))?"#ead697":"#d5e8ed";
 return {solutionBefore,solutionAfter,solid,solidColor:schoolSolidColors[solid]??row.afterColor??"#eef0ed",gas,products,productSolid,productSolidColor};
}
export const reviewedReactionCases=cases;
const key=(ids:string[])=>ids.slice().sort().join("|");
export const identifyReaction=(reagents:string[],environment:ReactionEnvironment):{
 status:ReactionStatus;caseData?:ReactionCase;message:string
}=>{
 const ids=reagents.filter(Boolean);
 if(ids.length<1)return{status:"unknown",message:"Добавьте реагенты и выберите условия."};
 if(ids.length>6)return{status:"unknown",message:"Выберите не более шести веществ."};
 if(ids.length!==new Set(ids).size)return{status:"unknown",message:"Один и тот же реагент выбран несколько раз. Измените список."};
 const found=cases.find(c=>c.environment===environment&&key(c.reactants)===key(ids));
 if(found)return{status:found.status,caseData:found,
  message:found.status==="none"?"Нет наблюдаемого превращения для данной проверенной пары.":found.description};
 return{status:"unknown",message:"Нельзя достоверно определить результат для такой смеси и условий по проверенной базе. Это не означает, что реакция не идёт."};
};
