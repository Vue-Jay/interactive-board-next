/** Curated qualitative SCHOOL chemistry cases, never a predictive chemistry engine.
 * Records are deliberately condition-specific and never extrapolated to unknown mixtures.
 * Data model is compatible with future reviewed reaction datasets and PubChem IDs. */
export type ReactionEnvironment="aqueous"|"dry"|"heated"|"ignited";
export type ReactionStatus="reaction"|"none"|"unknown";
export type Observation="gas"|"precipitate"|"color"|"heat"|"dissolution"|"none";
export type Substance={id:string;name:string;formula:string;kind:string};
export type ReactionCase={reactants:string[];environment:ReactionEnvironment;status:"reaction"|"none";
 equation:string;observation:Observation;description:string;beforeColor?:string;afterColor?:string;
 safety?:string;confidence:"curated";sourceNote:string};
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
