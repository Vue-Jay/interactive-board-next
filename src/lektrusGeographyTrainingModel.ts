/** Geography practice shares country facts between matching and question cards.
 * Modern ISO flags use the same flag source as the political atlas.
 * Multiple-capital states list the school-appropriate primary capital with a note. */
export type GeoRegion="Европа"|"Азия"|"Африка"|"Америка"|"Океания";
export type GeoExercise="matching"|"cards";
export type GeoRelation="flag-country"|"country-capital";
export type GeoTrainingDiagram={kind:"geo-training";title:string;exercise:GeoExercise;
 relation:GeoRelation;reverse:boolean;countryCodes:string[]};
export type GeoCountry={code:string;name:string;capital:string;region:GeoRegion;note?:string};
const countryNames=new Intl.DisplayNames(["ru"],{type:"region"});
const overrides:Record<string,string>={
 US:"США",GB:"Великобритания",KR:"Республика Корея",KP:"КНДР",
 CZ:"Чехия",TR:"Турция",CI:"Кот-д’Ивуар",CD:"ДР Конго",
 CG:"Республика Конго",TZ:"Танзания",CV:"Кабо-Верде",
 SZ:"Эсватини",TL:"Восточный Тимор",BO:"Боливия",
 ZA:"ЮАР",FM:"Микронезия",MD:"Молдавия",RU:"Россия",
 VA:"Ватикан",LA:"Лаос",BN:"Бруней",VN:"Вьетнам"
};
const notes:Record<string,string>={
 NL:"Конституционная столица — Амстердам; правительство находится в Гааге.",
 ZA:"В ЮАР три столицы: Претория (исполнительная), Кейптаун (законодательная), Блумфонтейн (судебная).",
 BO:"Конституционная столица — Сукре; правительство и парламент работают в Ла-Пасе.",
 BJ:"Официальная столица — Порто-Ново; правительство находится в Котону.",
 LK:"Официальная столица — Шри-Джаяварденепура-Котте; Коломбо остаётся крупнейшим деловым центром.",
 MY:"Официальная столица — Куала-Лумпур; административный центр — Путраджая.",
 GQ:"В январе 2026 года столица перенесена из Малабо в Сьюдад-де-ла-Пас.",
 ID:"Вопрос переноса столицы из Джакарты в Нусантару находится в процессе реализации.",
 NR:"Науру не имеет официально установленной столицы; органы власти расположены в округе Ярен."
};
// Format: ISO code | capital in Russian. A verified and intentionally bounded
// catalogue avoids offering unconfirmed territorial statuses as settled facts.
const raw:Record<GeoRegion,string>={
 "Европа":`RU|Москва
AL|Тирана
AD|Андорра-ла-Велья
AT|Вена
BY|Минск
BE|Брюссель
BA|Сараево
BG|София
HR|Загреб
CY|Никосия
CZ|Прага
DK|Копенгаген
EE|Таллин
FI|Хельсинки
FR|Париж
DE|Берлин
GR|Афины
HU|Будапешт
IS|Рейкьявик
IE|Дублин
IT|Рим
LV|Рига
LI|Вадуц
LT|Вильнюс
LU|Люксембург
MT|Валлетта
MD|Кишинёв
MC|Монако
ME|Подгорица
NL|Амстердам
MK|Скопье
NO|Осло
PL|Варшава
PT|Лиссабон
RO|Бухарест
SM|Сан-Марино
RS|Белград
SK|Братислава
SI|Любляна
ES|Мадрид
SE|Стокгольм
CH|Берн
UA|Киев
GB|Лондон
VA|Ватикан`,
 "Азия":`AF|Кабул
AM|Ереван
AZ|Баку
BH|Манама
BD|Дакка
BT|Тхимпху
BN|Бандар-Сери-Бегаван
KH|Пномпень
CN|Пекин
GE|Тбилиси
IN|Нью-Дели
ID|Джакарта
IR|Тегеран
IQ|Багдад
JP|Токио
JO|Амман
KZ|Астана
KW|Эль-Кувейт
KG|Бишкек
LA|Вьентьян
LB|Бейрут
MY|Куала-Лумпур
MV|Мале
MN|Улан-Батор
MM|Нейпьидо
NP|Катманду
KP|Пхеньян
OM|Маскат
PK|Исламабад
PH|Манила
QA|Доха
SA|Эр-Рияд
SG|Сингапур
KR|Сеул
LK|Шри-Джаяварденепура-Котте
SY|Дамаск
TJ|Душанбе
TH|Бангкок
TL|Дили
TM|Ашхабад
TR|Анкара
AE|Абу-Даби
UZ|Ташкент
VN|Ханой
YE|Сана`,
 "Африка":`DZ|Алжир
AO|Луанда
BJ|Порто-Ново
BW|Габороне
BF|Уагадугу
BI|Гитега
CV|Прая
CM|Яунде
CF|Банги
TD|Нджамена
KM|Морони
CG|Браззавиль
CD|Киншаса
DJ|Джибути
EG|Каир
GQ|Сьюдад-де-ла-Пас
ER|Асмэра
SZ|Мбабане
ET|Аддис-Абеба
GA|Либревиль
GM|Банжул
GH|Аккра
GN|Конакри
GW|Бисау
CI|Ямусукро
KE|Найроби
LS|Масеру
LR|Монровия
LY|Триполи
MG|Антананариву
MW|Лилонгве
ML|Бамако
MR|Нуакшот
MU|Порт-Луи
MA|Рабат
MZ|Мапуту
NA|Виндхук
NE|Ниамей
NG|Абуджа
RW|Кигали
ST|Сан-Томе
SN|Дакар
SC|Виктория
SL|Фритаун
SO|Могадишо
ZA|Претория
SS|Джуба
SD|Хартум
TZ|Додома
TG|Ломе
TN|Тунис
UG|Кампала
ZM|Лусака
ZW|Хараре`,
 "Америка":`AG|Сент-Джонс
AR|Буэнос-Айрес
BS|Нассау
BB|Бриджтаун
BZ|Бельмопан
BO|Сукре
BR|Бразилиа
CA|Оттава
CL|Сантьяго
CO|Богота
CR|Сан-Хосе
CU|Гавана
DM|Розо
DO|Санто-Доминго
EC|Кито
SV|Сан-Сальвадор
GD|Сент-Джорджес
GT|Гватемала
GY|Джорджтаун
HT|Порт-о-Пренс
HN|Тегусигальпа
JM|Кингстон
MX|Мехико
NI|Манагуа
PA|Панама
PY|Асунсьон
PE|Лима
KN|Бастер
LC|Кастри
VC|Кингстаун
SR|Парамарибо
TT|Порт-оф-Спейн
US|Вашингтон
UY|Монтевидео
VE|Каракас`,
 "Океания":`AU|Канберра
FJ|Сува
KI|Южная Тарава
MH|Маджуро
FM|Паликир
NZ|Веллингтон
PW|Нгерулмуд
PG|Порт-Морсби
WS|Апиа
SB|Хониара
TO|Нукуалофа
TV|Фунафути
VU|Порт-Вила`
};
export const geoRegions:GeoRegion[]=["Европа","Азия","Африка","Америка","Океания"];
export const geoCountries:readonly GeoCountry[]=geoRegions.flatMap(region=>
 raw[region].trim().split("\n").map(line=>{
  const [code,capital]=line.split("|");
  return {code,name:overrides[code]??countryNames.of(code)??code,capital,region,note:notes[code]};
 })).sort((a,b)=>a.name.localeCompare(b.name,"ru"));
const countryByIso=new Map(geoCountries.map(country=>[country.code,country]));
export const getGeoCountry=(code:string)=>countryByIso.get(code);
export const geoRelationNames:Record<GeoRelation,string>={
 "flag-country":"Флаг и страна","country-capital":"Страна и столица"
};
export function geoPair(country:GeoCountry,relation:GeoRelation):{left:string;right:string}{
 return relation==="flag-country"?{left:"flag",right:country.name}:
 {left:country.name,right:country.capital};
}
export function sampleGeoCountries(region:GeoRegion|"Все",size:number):string[]{
 const pool=geoCountries.filter(row=>region==="Все"||row.region===region).map(row=>row.code);
 // Fisher-Yates: new random sample, without repeats.
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
 return pool.slice(0,Math.max(2,Math.min(12,size)));
}
export function makeGeoTraining(exercise:GeoExercise):GeoTrainingDiagram{
 return {kind:"geo-training",title:exercise==="matching"?"Сопоставление: страны мира":"Карточки: страны мира",
  exercise,relation:"flag-country",reverse:false,countryCodes:["RU","CN","IN","US","FR","JP"]};
}
export function validGeoTraining(value:unknown):value is GeoTrainingDiagram{
 if(!value||typeof value!=="object")return false;
 const d=value as Record<string,unknown>;
 return d.kind==="geo-training"&&typeof d.title==="string"&&d.title.length<=120&&
  (d.exercise==="matching"||d.exercise==="cards")&&
  (d.relation==="flag-country"||d.relation==="country-capital")&&
  typeof d.reverse==="boolean"&&Array.isArray(d.countryCodes)&&
  d.countryCodes.length>=2&&d.countryCodes.length<=12&&
  d.countryCodes.every(code=>typeof code==="string"&&countryByIso.has(code))&&
  new Set(d.countryCodes).size===d.countryCodes.length;
}
