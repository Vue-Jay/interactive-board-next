/** A single map tool for geography, history and social studies.
 * Coordinates are geographic WGS84, never invented "modern borders" for a past year. */
export type AtlasScope="geography"|"history";
export type AtlasMode="political"|"contour"|"physical"|"hydrography"|"coordinates"|"historical"|"events";
export type AtlasMarker={id:string;title:string;lat:number;lon:number;year:number;description:string};
export type AtlasDocument={
 kind:"atlas";title:string;scope?:AtlasScope;mode:AtlasMode;year:number;showLabels:boolean;
 showGrid:boolean;showEvents:boolean;markers:AtlasMarker[];
};
export const geographyMapModes:ReadonlyArray<{id:AtlasMode;title:string;hint:string}>=[
 {id:"political",title:"Современная политическая",hint:"Страны и их современные границы по Natural Earth"},
 {id:"physical",title:"Физическая",hint:"Общая подложка суши с реками и озёрами (без высот)"},
 {id:"hydrography",title:"Гидрографическая",hint:"Реки, озёра и береговая линия с выбором объектов"},
 {id:"coordinates",title:"Географические координаты",hint:"Меридианы, параллели и определение координат нажатием"},
 {id:"contour",title:"Контурная",hint:"Неподписанная карта для самостоятельных заданий"}
];
export const historyMapModes:ReadonlyArray<{id:AtlasMode;title:string;hint:string}>=[
 {id:"historical",title:"Исторические границы",hint:"Реальные датированные снимки государств"},
 {id:"events",title:"Исторические события",hint:"Даты, описания, географическая привязка событий"}
];
export const atlasModes=[...geographyMapModes,...historyMapModes];
export const atlasModesForScope=(scope:AtlasScope)=>scope==="history"?historyMapModes:geographyMapModes;
export const isHistoricalAtlasMode=(mode:AtlasMode)=>mode==="historical"||mode==="events";
export const getAtlasScope=(document:AtlasDocument):AtlasScope=>
 document.scope??(isHistoricalAtlasMode(document.mode)?"history":"geography");
export const historicalSnapshots=[
 {year:-123000,file:"world_bc123000.geojson"},{year:-10000,file:"world_bc10000.geojson"},
 {year:-8000,file:"world_bc8000.geojson"},{year:-5000,file:"world_bc5000.geojson"},
 {year:-4000,file:"world_bc4000.geojson"},{year:-3000,file:"world_bc3000.geojson"},
 {year:-2000,file:"world_bc2000.geojson"},{year:-1500,file:"world_bc1500.geojson"},
 {year:-1000,file:"world_bc1000.geojson"},{year:-700,file:"world_bc700.geojson"},
 {year:-500,file:"world_bc500.geojson"},{year:-400,file:"world_bc400.geojson"},
 {year:-323,file:"world_bc323.geojson"},{year:-300,file:"world_bc300.geojson"},
 {year:-200,file:"world_bc200.geojson"},{year:-100,file:"world_bc100.geojson"},
 {year:-1,file:"world_bc1.geojson"},{year:100,file:"world_100.geojson"},
 {year:200,file:"world_200.geojson"},{year:300,file:"world_300.geojson"},
 {year:400,file:"world_400.geojson"},{year:500,file:"world_500.geojson"},
 {year:600,file:"world_600.geojson"},{year:700,file:"world_700.geojson"},
 {year:800,file:"world_800.geojson"},{year:900,file:"world_900.geojson"},
 {year:1000,file:"world_1000.geojson"},{year:1100,file:"world_1100.geojson"},
 {year:1200,file:"world_1200.geojson"},{year:1279,file:"world_1279.geojson"},
 {year:1300,file:"world_1300.geojson"},{year:1400,file:"world_1400.geojson"},
 {year:1492,file:"world_1492.geojson"},{year:1500,file:"world_1500.geojson"},
 {year:1530,file:"world_1530.geojson"},{year:1600,file:"world_1600.geojson"},
 {year:1650,file:"world_1650.geojson"},{year:1700,file:"world_1700.geojson"},
 {year:1715,file:"world_1715.geojson"},{year:1783,file:"world_1783.geojson"},
 {year:1800,file:"world_1800.geojson"},{year:1815,file:"world_1815.geojson"},
 {year:1878,file:"world_1878.geojson"},{year:1880,file:"world_1880.geojson"},
 {year:1900,file:"world_1900.geojson"},{year:1914,file:"world_1914.geojson"},
 {year:1920,file:"world_1920.geojson"},{year:1930,file:"world_1930.geojson"},
 {year:1938,file:"world_1938.geojson"},{year:1945,file:"world_1945.geojson"},
 {year:1960,file:"world_1960.geojson"},{year:1994,file:"world_1994.geojson"},
 {year:2000,file:"world_2000.geojson"},{year:2010,file:"world_2010.geojson"}
] as const;
export const yearLabel=(year:number)=>year<0?Math.abs(year)+" г. до н. э.":year+" г.";
export function nearestSnapshotIndex(year:number){
 let best=0,difference=Number.POSITIVE_INFINITY;
 historicalSnapshots.forEach((s,i)=>{const n=Math.abs(year-s.year);
  if(n<difference){difference=n;best=i}});
 return best;
}
export const schoolHistoryEvents=[
 {year:476,title:"Падение Западной Римской империи",lat:41.9,lon:12.5,
  description:"Традиционная дата завершения истории Западной Римской империи. Политические изменения были постепенными.",
  url:"https://ru.wikipedia.org/wiki/Падение_Западной_Римской_империи"},
 {year:988,title:"Крещение Руси",lat:50.45,lon:30.52,
  description:"Принятие христианства при князе Владимире. Изменения религии не означали немедленного изменения государственных границ.",
  url:"https://ru.wikipedia.org/wiki/Крещение_Руси"},
 {year:1206,title:"Образование Монгольской империи",lat:47.6,lon:107.0,
  description:"Объединение монгольских племён под властью Чингисхана; территориальное расширение происходило впоследствии.",
  url:"https://ru.wikipedia.org/wiki/Монгольская_империя"},
 {year:1453,title:"Падение Константинополя",lat:41.01,lon:28.97,
  description:"Взятие Константинополя османами и окончание существования Византийской империи.",
  url:"https://ru.wikipedia.org/wiki/Падение_Константинополя_(1453)"},
 {year:1492,title:"Экспедиция Колумба",lat:24.1,lon:-74.5,
  description:"Первое плавание Колумба к островам Карибского моря. Маркер обозначает регион, а не точную траекторию плавания.",
  url:"https://ru.wikipedia.org/wiki/Первое_плавание_Христофора_Колумба"},
 {year:1648,title:"Вестфальский мир",lat:51.96,lon:7.63,
  description:"Мирные договоры, завершившие Тридцатилетнюю войну. Договорённости затрагивали отношения между европейскими государствами.",
  url:"https://ru.wikipedia.org/wiki/Вестфальский_мир"},
 {year:1789,title:"Начало Французской революции",lat:48.86,lon:2.35,
  description:"Революция изменила политическое устройство Франции; дальнейшие войны повлияли на карту Европы.",
  url:"https://ru.wikipedia.org/wiki/Великая_французская_революция"},
 {year:1815,title:"Венский конгресс",lat:48.21,lon:16.37,
  description:"Посленаполеоновские договорённости о политическом устройстве и территориальном распределении в Европе.",
  url:"https://ru.wikipedia.org/wiki/Венский_конгресс"},
 {year:1914,title:"Начало Первой мировой войны",lat:43.86,lon:18.42,
  description:"Война 1914–1918 годов привела к распаду нескольких империй и последующим изменениям границ.",
  url:"https://ru.wikipedia.org/wiki/Первая_мировая_война"},
 {year:1917,title:"Революции в России",lat:59.94,lon:30.32,
  description:"Революции 1917 года изменили политический строй России. Последовавшая гражданская война и образование новых государств изменили политическую карту.",
  url:"https://ru.wikipedia.org/wiki/Революция_1917_года_в_России"},
 {year:1939,title:"Начало Второй мировой войны",lat:52.23,lon:21.01,
  description:"Начало Второй мировой войны в Европе. Карта границ в течение войны менялась неоднократно.",
  url:"https://ru.wikipedia.org/wiki/Вторая_мировая_война"},
 {year:1945,title:"Окончание Второй мировой войны",lat:52.52,lon:13.40,
  description:"Окончание войны сопровождалось изменениями границ, оккупационных зон и последующим послевоенным урегулированием.",
  url:"https://ru.wikipedia.org/wiki/Вторая_мировая_война"},
 {year:1947,title:"Независимость Индии и раздел Британской Индии",lat:28.61,lon:77.21,
  description:"Образование независимых Индии и Пакистана сопровождалось разделом Британской Индии.",
  url:"https://ru.wikipedia.org/wiki/Раздел_Британской_Индии"},
 {year:1960,title:"Год Африки",lat:1.5,lon:19.0,
  description:"В 1960 году значительное число африканских территорий обрело независимость. Маркер показывает регион, не единственное место события.",
  url:"https://ru.wikipedia.org/wiki/Год_Африки"},
 {year:1991,title:"Распад СССР",lat:55.75,lon:37.62,
  description:"Прекращение существования СССР и появление независимых государств на его территории.",
  url:"https://ru.wikipedia.org/wiki/Распад_СССР"}
] as const;
export function eventsNearYear(year:number){
 const position=nearestSnapshotIndex(year);
 const previous=historicalSnapshots[Math.max(0,position-1)].year;
 const next=historicalSnapshots[Math.min(historicalSnapshots.length-1,position+1)].year;
 const min=(previous+historicalSnapshots[position].year)/2;
 const max=(next+historicalSnapshots[position].year)/2;
 return schoolHistoryEvents.filter(event=>event.year>=min&&event.year<=max);
}
export function createAtlasDocument(scope:AtlasScope="geography"):AtlasDocument{
 return {kind:"atlas",scope,title:scope==="history"?"Историческая карта":"Географический атлас",
  mode:scope==="history"?"historical":"political",year:scope==="history"?1914:2010,
  showLabels:true,showGrid:false,showEvents:true,markers:[]};
}
const isText=(v:unknown,max:number,allowEmpty=false)=>typeof v==="string"&&v.length<=max&&(allowEmpty||v.trim().length>0);
export function validAtlasDocument(value:unknown):value is AtlasDocument{
 if(!value||typeof value!=="object")return false;
 const v=value as Record<string,unknown>;
 if(v.kind!=="atlas"||!isText(v.title,120)||!atlasModes.some(m=>m.id===v.mode)||
  (v.scope!==undefined&&
   (v.scope!=="geography"&&v.scope!=="history"||
    !atlasModesForScope(v.scope).some(m=>m.id===v.mode)))||
  !historicalSnapshots.some(s=>s.year===v.year)||typeof v.showLabels!=="boolean"||
  typeof v.showGrid!=="boolean"||typeof v.showEvents!=="boolean"||
  !Array.isArray(v.markers)||v.markers.length>40)return false;
 const markers=v.markers as AtlasMarker[];
 return markers.every(m=>m&&isText(m.id,64)&&isText(m.title,80)&&isText(m.description,300,true)&&
  Number.isFinite(m.lat)&&m.lat>=-90&&m.lat<=90&&
  Number.isFinite(m.lon)&&m.lon>=-180&&m.lon<=180&&
  Number.isInteger(m.year)&&m.year>=-123000&&m.year<=2100)&&
  new Set(markers.map(m=>m.id)).size===markers.length;
}
