/**
 * Sixteen additional reviewed cellular teaching views. Each entry belongs to
 * one real pre-existing five-level model path and to its three real cellular
 * feature descriptions. SVG illustrations are qualitative, never micrographs.
 */
import type {BioOrganism,BioNode} from "./lektrusBioMicroscopeModel";
import type {BioCellPlate,BioCellSpot} from "./lektrusBioCellPlates";
export type BioExtraCellKind=
 "sparrow-keratinocyte"|"sparrow-cone"|"perch-hair"|"perch-cardiomyocyte"|
 "frog-lung-epithelium"|"frog-rod"|"bee-tracheal-epithelium"|"bee-fiber"|
 "snail-photoreceptor"|"snail-mantle-epithelium"|"pine-root-hair"|"pine-microsporocyte"|
 "fern-mesophyll"|"fern-root-cortex"|"wheat-mesophyll"|"wheat-root-hair";
export type BioExtraCellPlate=BioCellPlate&{kind:BioExtraCellKind};
type RawExtra=[
 BioOrganism,BioExtraCellKind,string,string,string,string,string,
 readonly [string,string,string],readonly [BioCellSpot,BioCellSpot,BioCellSpot]
];
const sources={
 vision:"https://openstax.org/books/biology-2e/pages/36-5-vision",
 epidermis:"https://openstax.org/books/anatomy-and-physiology-2e/pages/4-2-epithelial-tissue",
 lateral:"https://pmc.ncbi.nlm.nih.gov/articles/PMC6927855/",
 heart:"https://openstax.org/books/anatomy-and-physiology-2e/pages/10-7-cardiac-muscle-tissue",
 respiration:"https://openstax.org/books/biology-2e/pages/39-2-gas-exchange-across-respiratory-surfaces",
 arthropod:"https://openstax.org/books/biology-2e/pages/28-4-superphylum-ecdysozoa",
 muscle:"https://openstax.org/books/anatomy-and-physiology-2e/pages/10-2-skeletal-muscle",
 mollusk:"https://openstax.org/books/biology-2e/pages/28-3-mollusks-and-annelids",
 plant:"https://openstax.org/books/biology-2e/pages/30-4-leaves",
 roots:"https://openstax.org/books/biology-2e/pages/30-3-roots",
 fern:"https://openstax.org/books/biology-2e/pages/25-4-seedless-vascular-plants",
 seed:"https://openstax.org/books/biology-2e/pages/26-1-evolution-of-seed-plants"
};
const data:ReadonlyArray<RawExtra>=[
 ["sparrow","sparrow-keratinocyte","Кератиноцит","Кератиноцит покровного эпителия птицы",
  "Кератиновые промежуточные филаменты формируют механический каркас живой клетки, а межклеточные контакты удерживают эпидермис.",
  "На рисунке молодая живая клетка с ядром; полностью ороговевшие наружные клетки устроены иначе.",sources.epidermis,
  ["Кератиновые нити","Контакты клеток","Дифференцировка"],[{x:238,y:160},{x:364,y:182},{x:224,y:82}]],
 ["sparrow","sparrow-cone","Колбочка","Колбочка сетчатки воробья",
  "Наружный сегмент с фотопигментами воспринимает яркий свет. Внутренний сегмент поддерживает клетку; синаптическое окончание передаёт сигнал дальше.",
  "Схематическая колбочка, без изображения всех особенностей сетчатки птиц и не в масштабе.",sources.vision,
  ["Наружный сегмент","Внутренний сегмент","Синапс"],[{x:225,y:92},{x:245,y:187},{x:241,y:282}]],
 ["perch","perch-hair","Волосковая клетка","Механорецептор невромаста боковой линии",
  "Пучок стереоцилий расположен рядом с более высокой киноцилией. Его отклонение при движении воды влияет на передачу сигнала сенсорному нерву.",
  "Стереоцилии представляют собой актиновые выросты, а киноцилия является настоящей ресничкой.",sources.lateral,
  ["Стереоцилии","Киноцилия","Синапс"],[{x:200,y:92},{x:301,y:56},{x:248,y:264}]],
 ["perch","perch-cardiomyocyte","Кардиомиоцит","Кардиомиоцит миокарда окуня",
  "Поперечнополосатые миофибриллы обеспечивают сокращение; вставочные диски связывают сердечные клетки механически и электрически.",
  "Показан один кардиомиоцит с продольной исчерченностью, не целая стенка сердца.",sources.heart,
  ["Миофибриллы","Вставочные диски","Митохондрии"],[{x:217,y:140},{x:374,y:177},{x:258,y:220}]],
 ["frog","frog-lung-epithelium","Эпителиальная клетка лёгкого","Газообменный эпителий лёгкого взрослой лягушки",
  "Газообменная поверхность взрослого земноводного образована клетками, через которые диффундируют кислород и углекислый газ.",
  "Это схематический эпителиоцит на складке мешковидного лёгкого, а не альвеола человека.",sources.respiration,
  ["Тонкая поверхность","Клеточные контакты","Ядро"],[{x:240,y:112},{x:378,y:185},{x:212,y:184}]],
 ["frog","frog-rod","Палочка","Палочка сетчатки лягушки",
  "В мембранных дисках наружного сегмента находится родопсин; внутренний сегмент участвует в обмене веществ, а синаптическое окончание передаёт сигнал.",
  "Условная палочка сетчатки взрослой лягушки; схема не показывает точные размеры дисков.",sources.vision,
  ["Наружный сегмент","Внутренний сегмент","Синаптическое окончание"],[{x:231,y:90},{x:243,y:189},{x:253,y:285}]],
 ["bee","bee-tracheal-epithelium","Трахейная эпителиальная клетка","Эпителиоцит трахеи пчелы",
  "Апикальную сторону живой клетки трахейного эпителия покрывает хитиновая кутикулярная интима; ядро расположено глубже, под ней.",
  "Внутренняя интима не является второй клеточной мембраной. Это часть трахейной кутикулы.",sources.respiration,
  ["Кутикулярная интима","Ядро","Клеточная мембрана"],[{x:245,y:85},{x:231,y:184},{x:369,y:217}]],
 ["bee","bee-fiber","Мышечное волокно","Мышечное волокно летательной мышцы пчелы",
  "Регулярные саркомеры образуют поперечную исчерченность сократительных миофибрилл. Митохондрии обеспечивают энергией частые сокращения.",
  "Показан фрагмент мышечного волокна с характерной исчерченностью; частота сокращений не симулируется.",sources.muscle,
  ["Сарколемма","Миофибриллы","Периферические ядра"],[{x:106,y:170},{x:238,y:142},{x:360,y:223}]],
 ["snail","snail-photoreceptor","Фоторецепторная клетка","Фоторецептор глаза верхнего щупальца улитки",
  "В светочувствительной области клетка преобразует световое раздражение в изменение мембранного сигнала, передаваемого нервной системе.",
  "Улитка не имеет сетчатки позвоночного типа: на рисунке намеренно отсутствуют «палочки и колбочки».",sources.mollusk,
  ["Светочувствительный участок","Преобразование сигнала","Нервная связь"],[{x:235,y:93},{x:254,y:169},{x:265,y:271}]],
 ["snail","snail-mantle-epithelium","Покровная эпителиальная клетка","Эпителиальная клетка мантии улитки",
  "Апикальная поверхность обращена в лёгочную полость; соседние клетки соединены контактами, а живая клетка содержит ядро.",
  "Показан схематический участок выстилки мантийной полости, без универсализации всего мантийного эпителия.",sources.mollusk,
  ["Апикальная поверхность","Клеточные контакты","Ядро"],[{x:241,y:94},{x:362,y:177},{x:232,y:187}]],
 ["pine","pine-root-hair","Клетка с корневым волоском","Ризодерма молодого корня сосны",
  "Корневой волосок представляет собой длинный вырост одной живой клетки и увеличивает площадь поглощения воды и растворённых веществ.",
  "На рисунке поглощающая поверхность молодого корня: волосок не является самостоятельной клеткой.",sources.roots,
  ["Корневой волосок","Мембрана","Вакуоль"],[{x:356,y:115},{x:167,y:124},{x:245,y:180}]],
 ["pine","pine-microsporocyte","Микроспороцит","Материнская клетка микроспор сосны",
  "Диплоидный микроспороцит (2n) проходит мейоз, образуя четыре гаплоидные микроспоры (n) в микроспорангии.",
  "Четыре клетки на схеме справа обозначают последующую стадию, а не одновременно существующие ядра исходного микроспороцита.",sources.seed,
  ["Диплоидное ядро","Мейоз","Клеточная стенка"],[{x:187,y:160},{x:339,y:145},{x:124,y:215}]],
 ["fern","fern-mesophyll","Клетка мезофилла вайи","Фотосинтезирующая клетка вайи орляка",
  "Клеточная стенка поддерживает форму клетки, хлоропласты осуществляют фотосинтез, а крупная вакуоль поддерживает тургор.",
  "Учебная растительная клетка вайи; число и расположение хлоропластов условны.",sources.plant,
  ["Хлоропласты","Стенка","Вакуоль"],[{x:330,y:123},{x:105,y:159},{x:247,y:182}]],
 ["fern","fern-root-cortex","Клетка коровой паренхимы","Клетка коры придаточного корня орляка",
  "Живая клетка паренхимы имеет цитоплазму, стенку и вакуоль, участвуя в обмене веществ и возможном запасании веществ.",
  "Показан клеточный срез коры корня, а не сосуд или мёртвая одревесневшая клетка.",sources.roots,
  ["Цитоплазма","Стенка","Вакуоль"],[{x:174,y:126},{x:101,y:178},{x:246,y:185}]],
 ["wheat","wheat-mesophyll","Клетка мезофилла","Фотосинтезирующая клетка листа пшеницы",
  "Клетка мезофилла однодольного листа имеет клеточную стенку, хлоропласты и центральную вакуоль.",
  "В пределах одного листа клетки могут отличаться; на рисунке показан один пример мезофилла.",sources.plant,
  ["Хлоропласты","Центральная вакуоль","Клеточная стенка"],[{x:346,y:119},{x:241,y:187},{x:92,y:174}]],
 ["wheat","wheat-root-hair","Клетка с корневым волоском","Корневой волосок молодой пшеницы",
  "Длинный тонкий вырост клетки ризодермы увеличивает поглощающую поверхность мочковатой корневой системы злака.",
  "Корневой волосок является частью одной живой клетки, а не цепочкой отдельных клеток.",sources.roots,
  ["Корневой волосок","Мембрана","Вакуоль"],[{x:361,y:104},{x:167,y:124},{x:234,y:184}]]
];
const all:Record<string,BioExtraCellPlate>={};
for(const [organism,kind,cellName,title,description,caveat,url,names,points] of data){
 const landmarks:Record<string,BioCellSpot>={};
 names.forEach((name,i)=>{landmarks[name]=points[i];});
 const id=organism+":"+cellName;
 if(all[id])throw new Error("Duplicate reviewed cell plate: "+id);
 all[id]={kind,organism,cellName,title,description,caveat,source:{title:"Научное описание · "+cellName,url},landmarks};
}
export const BIO_ADDITIONAL_CELL_PLATES:Readonly<Record<string,BioExtraCellPlate>>=all;
export function bioAdditionalCellPlateFor(organism:BioOrganism,node:BioNode):BioExtraCellPlate|null{
 return node.level==="cell"&&node.id.startsWith(organism+"/")
  ?BIO_ADDITIONAL_CELL_PLATES[organism+":"+node.name]??null:null;
}
