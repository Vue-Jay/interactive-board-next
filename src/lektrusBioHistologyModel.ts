/** Microscope plates exist only for anatomically reviewed, species-specific
 * node IDs. Hotspots are viewBox coordinates on the corresponding illustration,
 * not universal coordinates inherited from unrelated specimen silhouettes.
 * Illustrations are deliberately NOT microscope photographs or to scale.
 */
export type BioHistologyPlateId=
 "sponge-chamber"|"sponge-choanocyte"|"sponge-mesohyl"|
 "hydra-cnidocyte"|"hydra-gastrodermis"|
 "moss-lamella"|"moss-capsule"|
 "chlamydomonas-chloroplast"|"chlamydomonas-eyespot"|
 "spirogyra-cell"|"spirogyra-conjugation";
export type BioHistologyPoint={x:number;y:number};
export type BioHistologyPlateInfo={
 id:BioHistologyPlateId;title:string;subtitle:string;source:string;
 /** Plate-local positions for ACTUAL direct children. */
 children:Readonly<Record<string,BioHistologyPoint>>;
};
const sources={
 porifera:"https://openstax.org/books/biology-2e/pages/28-1-phylum-porifera",
 cnidaria:"https://openstax.org/books/biology-2e/pages/28-2-phylum-cnidaria",
 moss:"https://pza.sanbi.org/polytrichum-commune",
 green:"https://pmc.ncbi.nlm.nih.gov/articles/PMC3811559/",
 spirogyra:"https://allenwebsite-general.s3.ap-south-1.amazonaws.com/nios/download/sr-secondary/Biology_314_Book2.pdf"
};
export const BIO_HISTOLOGY_PLATES:Readonly<Record<string,BioHistologyPlateInfo>>={
 "sponge/water/chamber":{
  id:"sponge-chamber",title:"Поперечный срез жгутиковой камеры",
  subtitle:"Хоаноциты выстилают полость камеры, их жгутики направлены в просвет",
  source:sources.porifera,children:{"sponge/water/chamber/choanocyte":{x:338,y:166}}
 },
 "sponge/water/chamber/choanocyte":{
  id:"sponge-choanocyte",title:"Хоаноцит · строение клетки",
  subtitle:"Жгутик окружён воротничком микроворсинок; клетка захватывает пищевые частицы",
  source:sources.porifera,children:{
   "sponge/water/chamber/choanocyte/flagellum":{x:245,y:77},
   "sponge/water/chamber/choanocyte/collar":{x:183,y:150}
  }
 },
 "sponge/mesohyl":{
  id:"sponge-mesohyl",title:"Мезохил · межклеточный матрикс",
  subtitle:"Коллагеноподобное вещество содержит подвижные клетки и скелетные элементы",
  source:sources.porifera,children:{"sponge/mesohyl/amoebocyte":{x:240,y:179}}
 },
 "hydra/tentacle/epidermis/cnidocyte":{
  id:"hydra-cnidocyte",title:"Книдоцит · стрекательная клетка",
  subtitle:"Нематоциста расположена внутри клетки, а не является отдельной клеткой",
  source:sources.cnidaria,children:{"hydra/tentacle/epidermis/cnidocyte/nematocyst":{x:253,y:154}}
 },
 "hydra/cavity/gastrodermis":{
  id:"hydra-gastrodermis",title:"Гастродерма · клеточный слой",
  subtitle:"Пищеварительные клетки обращены к гастроваскулярной полости",
  source:sources.cnidaria,children:{"hydra/cavity/gastrodermis/digestive":{x:240,y:168}}
 },
 "moss/gametophyte/leaf/lamella":{
  id:"moss-lamella",title:"Ламеллы Polytrichum · срез листовидного органа",
  subtitle:"Вертикальные фотосинтезирующие пластины состоят из нескольких рядов клеток",
  source:sources.moss,children:{"moss/gametophyte/leaf/lamella/cell":{x:245,y:134}}
 },
 "moss/sporophyte/capsule":{
  id:"moss-capsule",title:"Коробочка спорофита · продольный срез",
  subtitle:"Диплоидные материнские клетки образуют гаплоидные споры путём мейоза",
  source:sources.moss,children:{"moss/sporophyte/capsule/sporocyte":{x:242,y:170}}
 },
 "chlamydomonas/chloroplast":{
  id:"chlamydomonas-chloroplast",title:"Чашевидный хлоропласт",
  subtitle:"Пиреноид связан с концентрацией углекислого газа при фотосинтезе",
  source:sources.green,children:{"chlamydomonas/chloroplast/pyrenoid":{x:258,y:184}}
 },
 "chlamydomonas/eyespot":{
  id:"chlamydomonas-eyespot",title:"Глазок хламидомонады",
  subtitle:"Пигментные гранулы хлоропласта работают совместно с мембранными фоторецепторами",
  source:sources.green,children:{}
 },
 "spirogyra/filament/cell":{
  id:"spirogyra-cell",title:"Клетка спирогиры · внутреннее строение",
  subtitle:"Лентовидный хлоропласт идёт спиралью вдоль стенки; ядро подвешено на цитоплазматических тяжах",
  source:sources.spirogyra,children:{
   "spirogyra/filament/cell/chloroplast":{x:315,y:198},
   "spirogyra/filament/cell/nucleus":{x:235,y:156}
  }
 },
 "spirogyra/conjugation":{
  id:"spirogyra-conjugation",title:"Конъюгация спирогиры · две нити",
  subtitle:"Конъюгационная трубка связывает соседние клетки до формирования зиготы",
  source:sources.spirogyra,children:{"spirogyra/conjugation/tube":{x:246,y:169}}
 }
};
export const bioHistologyFor=(id:string):BioHistologyPlateInfo|null=>
 BIO_HISTOLOGY_PLATES[id]??null;
export function bioHistologyChildSpot(parentId:string,childId:string):BioHistologyPoint|null{
 return BIO_HISTOLOGY_PLATES[parentId]?.children[childId]??null;
}
