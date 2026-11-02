/** The other two organ-to-tissue paths of each eight-species school model.
 * Every item matches an existing reviewed atlas node by its own species,
 * full path, anatomical level and exact Russian name.
 *
 * SVG is a teaching reconstruction, not histological photomicrography.
 */
import type {BioOrganism,BioNode} from "./lektrusBioMicroscopeModel";
import type {BioSpecimenPlateInfo} from "./lektrusBioSpecimenPlates";

export type BioExtraSpecimenKind=
 "sparrow-skin"|"sparrow-retina"|"perch-neuromast"|"perch-heart"|
 "frog-lung"|"frog-retina"|"bee-trachea"|"bee-flight-muscle"|
 "snail-eye"|"snail-mantle"|"pine-root"|"pine-microsporangium"|
 "fern-frond"|"fern-root"|"wheat-leaf"|"wheat-root";
export type BioExtraSpecimenPlate=BioSpecimenPlateInfo&{
 kind:BioExtraSpecimenKind;
 note:string;
};
type Pair=[
 BioOrganism,BioExtraSpecimenKind,
 string,string,string,string,string,string,
 {x:number;y:number},{x:number;y:number}
];
const references={
 epithelial:"https://openstax.org/books/anatomy-and-physiology-2e/pages/4-2-epithelial-tissue",
 vision:"https://openstax.org/books/biology-2e/pages/36-5-vision",
 lateral:"https://pmc.ncbi.nlm.nih.gov/articles/PMC10908562/",
 cardiac:"https://openstax.org/books/anatomy-and-physiology-2e/pages/10-7-cardiac-muscle-tissue",
 gas:"https://openstax.org/books/biology-2e/pages/39-2-gas-exchange-across-respiratory-surfaces",
 trachea:"https://openstax.org/books/biology-2e/pages/39-1-systems-of-gas-exchange",
 muscle:"https://openstax.org/books/anatomy-and-physiology-2e/pages/10-2-skeletal-muscle",
 mollusk:"https://openstax.org/books/biology-2e/pages/28-3-mollusks-and-annelids",
 root:"https://openstax.org/books/biology-2e/pages/30-3-roots",
 leaves:"https://openstax.org/books/biology-2e/pages/30-4-leaves",
 pollen:"https://openstax.org/books/biology-2e/pages/26-1-evolution-of-seed-plants",
 ferns:"https://openstax.org/books/biology-2e/pages/25-4-seedless-vascular-plants"
};
const raw:ReadonlyArray<Pair>=[
 ["sparrow","sparrow-skin","Кожа","Эпидермис","Кожа воробья · срез",
  "Тонкий эпидермис птицы под дермой с перьевыми фолликулами и соединительной тканью.",
  "Эпидермис включает живые кератиноциты и поверхностные ороговевающие слои.",
  references.epithelial,{x:250,y:107},{x:229,y:146}],
 ["sparrow","sparrow-retina","Глаз","Сетчатка","Глаз воробья · светочувствительные слои",
  "Хрусталик проецирует свет на многослойную сетчатку; наружные сегменты фоторецепторов находятся рядом с пигментным эпителием.",
  "Колбочки участвуют в цветном зрении, но срез не передаёт точного расположения типов колбочек птицы.",
  references.vision,{x:248,y:192},{x:225,y:136}],
 ["perch","perch-neuromast","Боковая линия","Сенсорный эпителий невромаста","Боковая линия окуня · невромаст",
  "Желеобразная купула передаёт движение воды на пучки стереоцилий и киноцилию волосковых клеток.",
  "В эпителии невромаста волосковые клетки окружены поддерживающими клетками и соединены с чувствительными нервами.",
  references.lateral,{x:246,y:151},{x:245,y:187}],
 ["perch","perch-heart","Сердце","Миокард","Сердце речного окуня · строение",
  "У костистой рыбы один желудочек и одно предсердие, а также венозный синус и артериальная луковица.",
  "Миокард состоит из сократительных кардиомиоцитов со специализированными межклеточными соединениями.",
  references.cardiac,{x:246,y:185},{x:236,y:161}],
 ["frog","frog-lung","Лёгкие","Дыхательный эпителий","Лёгкое взрослой лягушки · складки",
  "Лёгкое взрослой лягушки мешковидное, с внутренними перегородками и кровеносными капиллярами, без альвеолярного дерева млекопитающих.",
  "Выстилка газообменной поверхности представлена клетками на тонких участках складок.",
  references.gas,{x:246,y:178},{x:236,y:156}],
 ["frog","frog-retina","Глаз","Сетчатка","Глаз лягушки · сетчатка",
  "Сетчатка содержит фоторецепторы, нейроны и пигментный эпителий, поддерживающий наружные сегменты.",
  "Палочки отвечают прежде всего на слабую освещённость и передают сигнал через нейронные цепи.",
  references.vision,{x:239,y:194},{x:230,y:137}],
 ["bee","bee-trachea","Трахея","Эпителий трахеи","Трахея пчелы · хитиновая интима",
  "Разветвлённые воздухопроводящие трубки соединены с дыхальцами; спиральные утолщения интимы поддерживают их просвет.",
  "Эпителиальные клетки формируют стенку под хитиновой выстилкой, не участвуя в переносе кислорода гемолимфой.",
  references.trachea,{x:236,y:199},{x:234,y:188}],
 ["bee","bee-flight-muscle","Лётная мышца груди","Поперечнополосатая мышечная ткань",
  "Летательная мышца пчелы · волокна","Волокна поперечнополосатой мышцы содержат параллельные миофибриллы и саркомеры.",
  "Между сократительными структурами многочисленные митохондрии обеспечивают энергией работу крыльев.",
  references.muscle,{x:236,y:177},{x:240,y:161}],
 ["snail","snail-eye","Глаз верхнего щупальца","Фоторецепторный эпителий","Глаз виноградной улитки · срез",
  "Небольшой глаз на конце верхнего щупальца состоит из хрусталика и светочувствительной выстилки.",
  "Здесь имеются фоторецепторные клетки моллюска: рисунок не подменяет их палочками и колбочками позвоночных.",
  references.mollusk,{x:255,y:186},{x:244,y:147}],
 ["snail","snail-mantle","Мантия","Эпителий мантии","Мантия улитки · лёгочная полость",
  "Мантийная полость наземного брюхоногого преобразована в воздушную полость с сосудистой крышей.",
  "Внутренняя поверхность мантии выстлана эпителием, над которым находится воздушная полость.",
  references.mollusk,{x:248,y:179},{x:241,y:153}],
 ["pine","pine-root","Молодой корень","Ризодерма","Молодой корень сосны · зона всасывания",
  "Наружная ткань молодого корня формирует корневые волоски: это выросты отдельных живых клеток.",
  "Ризодерма отделяет ткани корня от почвенного раствора; волосок увеличивает площадь контакта с водой.",
  references.root,{x:330,y:141},{x:351,y:147}],
 ["pine","pine-microsporangium","Микроспорангий","Спорогенная ткань",
  "Мужской микроспорангий сосны · срез","Материнские клетки микроспор располагаются внутри микроспорангия мужского стробила.",
  "Диплоидные микроспороциты после мейоза дают начало гаплоидным микроспорам; этапы не совмещены.",
  references.pollen,{x:242,y:170},{x:245,y:165}],
 ["fern","fern-frond","Вайя","Мезофилл вайи","Вайя орляка · поперечный срез",
  "Лист содержит фотосинтезирующую паренхиму, сосудистые пучки и верхний и нижний эпидермис.",
  "Клетки мезофилла содержат хлоропласты, обеспечивающие фотосинтез.",
  references.leaves,{x:240,y:159},{x:230,y:164}],
 ["fern","fern-root","Придаточный корень","Кора корня","Корень орляка · поперечный срез",
  "Кора корня располагается между наружной покровной тканью и центральным сосудистым цилиндром.",
  "Кора содержит живые паренхимные клетки, участвующие в транспорте и запасании веществ.",
  references.root,{x:320,y:157},{x:309,y:164}],
 ["wheat","wheat-leaf","Лист","Мезофилл листа","Лист пшеницы · поперечный срез",
  "Однодольный лист имеет параллельные проводящие пучки, эпидермис и фотосинтезирующую ткань.",
  "Клетки мезофилла расположены между верхним и нижним эпидермисом, с хлоропластами и межклетниками.",
  references.leaves,{x:237,y:173},{x:232,y:173}],
 ["wheat","wheat-root","Молодой корень","Ризодерма","Молодой корень пшеницы · срез",
  "Ризодерма молодых корней образует поглощающие корневые волоски; корни формируют мочковатую систему.",
  "В зоне всасывания живые клетки внешнего слоя соприкасаются с почвенным раствором.",
  references.root,{x:335,y:137},{x:346,y:147}]
];
const byNode:Record<string,BioExtraSpecimenPlate>={};
const byKind:Record<string,[BioExtraSpecimenPlate,BioExtraSpecimenPlate]>={};
for(const [organism,kind,organ,tissue,title,organText,tissueText,source,organFocus,tissueFocus] of raw){
 const pair=([{
  id:organism+":organ:"+organ,organism,level:"organ" as const,nodeName:organ,title,
  caption:organText,note:organText,source,focus:organFocus,kind
 },{
  id:organism+":tissue:"+tissue,organism,level:"tissue" as const,nodeName:tissue,
  title:tissue+" · увеличенный срез",caption:tissueText,note:tissueText,
  source,focus:tissueFocus,kind
 }] as [BioExtraSpecimenPlate,BioExtraSpecimenPlate]);
 for(const plate of pair){
  const key=organism+":"+plate.level+":"+plate.nodeName;
  if(byNode[key])throw new Error("Duplicate detailed organ/tissue atlas node: "+key);
  byNode[key]=plate;
 }
 byKind[kind]=pair;
}
export const BIO_EXTRA_SPECIMEN_PLATES:Readonly<Record<string,BioExtraSpecimenPlate>>=byNode;
export const BIO_EXTRA_SPECIMEN_PAIRS:Readonly<Record<string,readonly [BioExtraSpecimenPlate,BioExtraSpecimenPlate]>>=byKind;
export function bioExtraSpecimenPlateFor(organism:BioOrganism,node:BioNode):BioExtraSpecimenPlate|null{
 if(node.level!=="organ"&&node.level!=="tissue")return null;
 if(!node.id.startsWith(organism+"/"))return null;
 return byNode[organism+":"+node.level+":"+node.name]??null;
}
