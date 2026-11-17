// Locators are not territorial polygons or exact archaeological coordinates.
// Display only while the corresponding unresolved source geometry is active.
const mindanaoCenters=[
 {id:'maguindanao',from:1521,to:1608,lon:124.246,lat:7.224,title:'Магинданао — район Котабато',description:'Политический центр у устья Пуланги. Магинданао упомянуто в свидетельстве Пигафетты за 1521 год; область Котабато не означает власть над всем Минданао. Точка приблизительная, по современному географическому ориентиру.',url:'https://www.nqc.gov.ph/en/map/'},
 {id:'butuan',from:1521,to:1565,lon:125.544,lat:8.949,title:'Бутуан — северо-восток Минданао',description:'Самостоятельный торгово-политический центр, засвидетельствованный в ранних испанских описаниях XVI века, в том числе в 1521 и 1565 годах. Точка показывает район Бутуана, а не точное положение древнего поселения или его границы.',url:'https://s3.us-west-1.wasabisys.com/p-library/books/41a52e1dbb925c4eeb9b743b6555fa48.pdf'},
 {id:'buayan',from:1596,to:1608,lon:124.504,lat:7.026,title:'Буаян — район Дулава́на',description:'Центр власти в верхней долине Пуланги, отдельный от прибрежного Магинданао; в 1596 году здесь потерпела поражение испанская экспедиция. Исторический Буаян находился примерно у современного Дату-Пианга (Дулавана). Точка не устанавливает границу султаната.',url:'https://ecommons.cornell.edu/bitstream/handle/1813/57550/082.pdf?sequence=1andisAllowed=y'},
] as const;

export function historicalUnresolvedCenters(year:number,issues:readonly {group:string;from:number;to:number}[]){
 if(!issues.some(i=>i.group==='Mindanao'&&i.from<=year&&year<=i.to))return [];
 return mindanaoCenters.filter(c=>c.from<=year&&year<=c.to).map(c=>({...c,id:`historical-center-${c.id}`,year}));
}
