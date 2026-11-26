/** Evidence-led Denmark context; the map's source shape is not a legal survey. */
export function historicalRealmContext(name:string,year:number){
 if(!['Denmark','Kingdom of Denmark','Дания'].includes(name)||year<1948||year>2024)return null;
 const faroe='Фарерские острова обладают автономией в составе Королевства Дания с 23 марта 1948 года.';
 const greenland=year>=2009?'Гренландия получила расширенное самоуправление в 2009 году, оставаясь частью Королевства Дания.':year>=1979?'Гренландия получила домашнее правление в 1979 году, оставаясь частью Королевства Дания.':'Домашнее правление Гренландии началось позднее, в 1979 году.';
 return {title:'Королевство Дания и автономии',
 description:faroe+' '+greenland+' Исходная заливка королевства не равнозначна только материковой Дании и не является независимо проверенной линией границ автономий.',
 sources:[
  {label:'Датское правительство',url:'https://english.stm.dk/the-prime-ministers-office/the-unity-of-the-realm'},
  {label:'Правительство Фарер',url:'https://www.government.fo/en/foreign-relations/constitutional-status/'}
 ]};
}
