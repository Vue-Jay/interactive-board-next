/** Legal national territory must not be conflated with civil-war front lines. */
export function historicalConflictContext(name:string,year:number){
 if(['Bosnia and Herzegovina','Republic of Bosnia and Herzegovina','Босния и Герцеговина'].includes(name)&&year>=1992&&year<=1995)
  return {title:'Босния: международные границы и военные линии',
  description:'В 1992–1995 годах военные линии контроля не являлись государственными границами. Дейтонское соглашение 1995 года определило внутреннюю линию между двумя образованиями, сохранив международные границы Боснии и Герцеговины. Исходный контур не является точной картой фронта 1994 года.',
  sources:[{label:'ООН: резолюция 942 (1994)',url:'https://digitallibrary.un.org/record/161700'},
   {label:'Дейтонские соглашения 1995',url:'https://www.ohr.int/dayton-peace-agreement/?lang=en'}]};
 if(['Afghanistan','Islamic State of Afghanistan','Афганистан'].includes(name)&&year>=1996&&year<=2001)
  return {title:'Афганистан: суверенитет и фактический военный контроль',
  description:'В 1996–2001 годах движение «Талибан» контролировало значительную часть Афганистана; Северный альянс и правительство Бурхануддина Раббани сохраняли собственные районы и международное представительство. Военный контроль менялся и не равнозначен государственной границе. Исходный контур не доказывает власть одного правительства над всем Афганистаном в каждом году.',
  sources:[{label:'Госдепартамент США: 2000 год',url:'https://www.refworld.org/reference/annualreport/usdos/2001/en/25964'},
   {label:'SIPRI Yearbook 2000',url:'https://www.sipri.org/yearbook/2000'}]};
 return null;
}
