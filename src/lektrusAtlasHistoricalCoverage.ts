// Verified lower bound on missing named contours, not a list of all states
// that existed (UN membership is neither a prerequisite nor a border survey).
// The 1994 roster follows the UN's published count, including the exceptional
// Yugoslavia seat; Palau and Tuvalu joined during their respective map years.
export const HISTORICAL_UN_ROSTER_SOURCE="https://www.un.org/en/about-us/growth-in-un-membership";
const missingMembers=[
 ["BHR","Бахрейн",1971],["CPV","Кабо-Верде",1975],["COM","Коморы",1975],
 ["KIR","Кирибати",1999],["MDV","Мальдивы",1965],["MHL","Маршалловы Острова",1991],
 ["MUS","Маврикий",1968],["FSM","Федеративные Штаты Микронезии",1991],["MCO","Монако",1993],
 ["NRU","Науру",1999],["PLW","Палау",1994],["SMR","Сан-Марино",1992],
 ["STP","Сан-Томе и Принсипи",1975],["SYC","Сейшельские Острова",1976],["SGP","Сингапур",1965],
 ["SLB","Соломоновы Острова",1978],["TLS","Восточный Тимор",2002],["TUV","Тувалу",2000],["VUT","Вануату",1981],
] as const;
export function historicalMemberCoverage(year:number){
 const expected=year===2010?192:year===2000?189:year===1994?185:undefined;
 if(expected===undefined)return undefined;
 const missing=missingMembers.filter(([, ,admitted])=>admitted<=year)
  .map(([iso,name,admitted])=>({iso,name,admitted,transition:admitted===year}));
 return {expected,missing,source:HISTORICAL_UN_ROSTER_SOURCE};
}
