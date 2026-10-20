/** Школьный атлас: прямоугольники для навигации, не границы субъектов.
 * Географические координаты WGS84; вид России разрезан 180-м меридианом. */
export type AtlasRegion={id:string;title:string;group:string;bounds:readonly [number,number,number,number]};
export const atlasRegionGroups=["Обзор","Материки","Зарубежные регионы","Федеральные округа России","Природные районы России","Океаны"] as const;
export const atlasRegions:ReadonlyArray<AtlasRegion>=[
 {id:"world",title:"Весь мир",group:"Обзор",bounds:[-180,-90,180,90]},
 {id:"russia",title:"Россия (обзор)",group:"Обзор",bounds:[19,40,180,82]},
 {id:"europe",title:"Европа",group:"Материки",bounds:[-13,34,48,72]},
 {id:"asia",title:"Азия",group:"Материки",bounds:[25,-12,180,82]},
 {id:"africa",title:"Африка",group:"Материки",bounds:[-20,-36,54,38]},
 {id:"north-america",title:"Северная Америка",group:"Материки",bounds:[-170,5,-50,84]},
 {id:"south-america",title:"Южная Америка",group:"Материки",bounds:[-84,-58,-32,15]},
 {id:"australia",title:"Австралия и Океания",group:"Материки",bounds:[107,-50,180,3]},
 {id:"antarctica",title:"Антарктида",group:"Материки",bounds:[-180,-90,180,-58]},
 {id:"west-europe",title:"Западная Европа",group:"Зарубежные регионы",bounds:[-11,35,17,60]},
 {id:"north-europe",title:"Северная Европа",group:"Зарубежные регионы",bounds:[-26,53,33,72]},
 {id:"east-europe",title:"Восточная Европа",group:"Зарубежные регионы",bounds:[14,42,48,61]},
 {id:"south-europe",title:"Южная Европа",group:"Зарубежные регионы",bounds:[-11,34,37,47]},
 {id:"central-asia",title:"Центральная Азия",group:"Зарубежные регионы",bounds:[46,34,89,56]},
 {id:"east-asia",title:"Восточная Азия",group:"Зарубежные регионы",bounds:[99,18,149,54]},
 {id:"south-asia",title:"Южная Азия",group:"Зарубежные регионы",bounds:[60,4,95,38]},
 {id:"southeast-asia",title:"Юго-Восточная Азия",group:"Зарубежные регионы",bounds:[92,-12,142,24]},
 {id:"southwest-asia",title:"Юго-Западная Азия",group:"Зарубежные регионы",bounds:[30,11,66,43]},
 {id:"north-africa",title:"Северная Африка",group:"Зарубежные регионы",bounds:[-18,14,38,38]},
 {id:"west-africa",title:"Западная Африка",group:"Зарубежные регионы",bounds:[-18,4,18,26]},
 {id:"east-africa",title:"Восточная Африка",group:"Зарубежные регионы",bounds:[25,-13,52,19]},
 {id:"central-africa",title:"Центральная Африка",group:"Зарубежные регионы",bounds:[9,-15,33,14]},
 {id:"south-africa",title:"Южная Африка",group:"Зарубежные регионы",bounds:[10,-36,42,-13]},
 {id:"central-america",title:"Центральная Америка",group:"Зарубежные регионы",bounds:[-117,6,-76,33]},
 {id:"caribbean",title:"Карибский бассейн",group:"Зарубежные регионы",bounds:[-90,7,-57,28]},
 {id:"andes",title:"Анды",group:"Зарубежные регионы",bounds:[-82,-57,-65,12]},
 {id:"amazon",title:"Амазония",group:"Зарубежные регионы",bounds:[-80,-18,-46,6]},
 {id:"rf-northwest",title:"Северо-Западный федеральный округ",group:"Федеральные округа России",bounds:[25,54,65,71]},
 {id:"rf-central",title:"Центральный федеральный округ",group:"Федеральные округа России",bounds:[30,49,43,59]},
 {id:"rf-south",title:"Южный федеральный округ",group:"Федеральные округа России",bounds:[32,43,52,52]},
 {id:"rf-north-caucasus",title:"Северо-Кавказский федеральный округ",group:"Федеральные округа России",bounds:[40,40,49,46]},
 {id:"rf-volga",title:"Приволжский федеральный округ",group:"Федеральные округа России",bounds:[42,51,63,60]},
 {id:"rf-ural",title:"Уральский федеральный округ",group:"Федеральные округа России",bounds:[55,54,88,74]},
 {id:"rf-siberia",title:"Сибирский федеральный округ",group:"Федеральные округа России",bounds:[75,49,115,64]},
 {id:"rf-far-east",title:"Дальневосточный федеральный округ",group:"Федеральные округа России",bounds:[104,42,180,79]},
 {id:"russian-plain",title:"Восточно-Европейская равнина",group:"Природные районы России",bounds:[27,47,63,70]},
 {id:"caucasus",title:"Кавказ",group:"Природные районы России",bounds:[35,40,53,47]},
 {id:"urals",title:"Уральские горы",group:"Природные районы России",bounds:[54,48,70,70]},
 {id:"west-siberia",title:"Западно-Сибирская равнина",group:"Природные районы России",bounds:[60,50,92,74]},
 {id:"central-siberian",title:"Среднесибирское плоскогорье",group:"Природные районы России",bounds:[88,57,115,74]},
 {id:"east-siberia",title:"Восточная Сибирь",group:"Природные районы России",bounds:[105,51,145,76]},
 {id:"altai",title:"Алтай и Саяны",group:"Природные районы России",bounds:[80,47,101,55]},
 {id:"baikal",title:"Прибайкалье и Забайкалье",group:"Природные районы России",bounds:[100,47,122,59]},
 {id:"amur",title:"Приамурье и Приморье",group:"Природные районы России",bounds:[125,42,143,57]},
 {id:"kamchatka",title:"Камчатка",group:"Природные районы России",bounds:[153,50,167,63]},
 {id:"sakhalin",title:"Сахалин и Курильские острова",group:"Природные районы России",bounds:[139,43,160,56]},
 {id:"chukotka",title:"Чукотка: восточное полушарие",group:"Природные районы России",bounds:[162,62,180,74]},
 {id:"chukotka-west",title:"Чукотка: западное полушарие",group:"Природные районы России",bounds:[-180,62,-166,74]},
 {id:"arctic",title:"Северный Ледовитый океан",group:"Океаны",bounds:[-180,65,180,90]},
 {id:"atlantic",title:"Атлантический океан",group:"Океаны",bounds:[-78,-60,12,66]},
 {id:"indian",title:"Индийский океан",group:"Океаны",bounds:[20,-62,118,25]},
 {id:"pacific-east",title:"Тихий океан: восток",group:"Океаны",bounds:[-180,-55,-74,60]},
 {id:"pacific-west",title:"Тихий океан: запад",group:"Океаны",bounds:[110,-55,180,60]},
 {id:"southern",title:"Южный океан",group:"Океаны",bounds:[-180,-90,180,-50]},
];
export const findAtlasRegion=(id:string|undefined)=>atlasRegions.find(region=>region.id===id)??atlasRegions[0];
export function atlasRegionCamera(region:AtlasRegion){
 const [w,s,e,n]=region.bounds;
 const width=Math.max(.1,(e-w)/360*900),height=Math.max(.1,(n-s)/180*450);
 const scale=Math.max(1,Math.min(16384,Math.min(790/width,390/height)));
 const cx=(w+e+360)/360*900,cy=(90-(s+n)/2)/180*450;
 return {scale,position:{x:-(cx-450)*scale,y:-(cy-225)*scale}};
}

/** Horizontal distances in a cylindrical equirectangular school map are
 * latitude dependent. This bar is an estimate at the viewport centre. */
export function atlasDistanceScale(scale:number,offsetY:number,maxWidth=115){
 const worldY=225-offsetY/Math.max(1,scale);
 const latitude=Math.max(-89.9,Math.min(89.9,90-worldY*.4));
 const kmPerUnit=(40075.016686/900)*Math.cos(latitude*Math.PI/180)/Math.max(1,scale);
 const limit=Math.max(1e-10,kmPerUnit*maxWidth);
 const magnitude=Math.pow(10,Math.floor(Math.log10(limit)));
 const tick=[1,2,5,10].filter(n=>n*magnitude<=limit+1e-12).at(-1)??1;
 const kilometres=tick*magnitude;
 return {width:kilometres/kmPerUnit,label:kilometres<1?
  Math.round(kilometres*1000)+" м":Number(kilometres.toPrecision(3)).toLocaleString("ru-RU")+" км",
  latitude};
}
