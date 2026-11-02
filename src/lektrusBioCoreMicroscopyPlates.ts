/** Anatomically reviewed school-level tissue and cell microplates.
 * Only explicit biological node names are mapped; a cell drawing must never
 * be silently substituted for a different taxon or saved atlas branch.
 * Illustrations are non-calibrated reconstructions, not photomicrographs.
 */
import type {BioNode,BioOrganism} from "./lektrusBioMicroscopeModel";

export type BioCoreMicroKind="alveoli"|"cardiac"|"neural"|"retina"|"skeletal"|"intestinal"|"palisade"|"root-hair"|"stomata"|"petal"|"xylem"|"mesophyll";
export type BioCoreMicroPlate={
 organism:BioOrganism;level:"tissue"|"cell";name:string;kind:BioCoreMicroKind;
 caption:string;
};
type Raw=[BioOrganism,BioCoreMicroPlate["level"],string,BioCoreMicroKind,string];
const raw:ReadonlyArray<Raw>=[
 ["human","tissue","Эпителий альвеол","alveoli","Тонкая стенка альвеол, снаружи прилежит капилляр."],
 ["human","cell","Пневмоцит I типа","alveoli","Уплощённая клетка выстилки альвеолы с заметным участком ядра."],
 ["human","tissue","Сердечная мышечная ткань","cardiac","Ветвящиеся кардиомиоциты с центральными ядрами и вставочными дисками."],
 ["human","cell","Кардиомиоцит","cardiac","Одна ветвящаяся поперечнополосатая мышечная клетка с центральным ядром."],
 ["human","tissue","Нервная ткань","neural","Нейроны с отростками и окружающие глиальные клетки."],
 ["human","cell","Нейрон","neural","Дендриты принимают входящие сигналы, аксон проводит импульсы."],
 ["cat","tissue","Сетчатка","retina","Слои светочувствительных клеток, биполярных и ганглиозных нейронов."],
 ["cat","cell","Палочка","retina","Наружный сегмент с мембранными дисками и синаптическое окончание."],
 ["cat","tissue","Поперечнополосатая мышечная ткань","skeletal","Параллельные многоядерные волокна с регулярной исчерченностью."],
 ["cat","cell","Мышечное волокно","skeletal","Длинная многоядерная скелетная мышечная клетка с миофибриллами."],
 ["cat","tissue","Кишечный эпителий","intestinal","Один слой цилиндрических клеток и апикальная щёточная каёмка."],
 ["cat","cell","Энтероцит","intestinal","Поляризованная клетка с микроворсинками и базально расположенным ядром."],
 ["sunflower","tissue","Столбчатая паренхима","palisade","Вытянутые клетки мезофилла с многочисленными хлоропластами."],
 ["sunflower","cell","Фотосинтезирующая клетка","palisade","Крупная вакуоль оттесняет цитоплазму и хлоропласты к периферии."],
 ["sunflower","tissue","Ризодерма","root-hair","Эпидермис молодого корня с поглощающими волосками."],
 ["sunflower","cell","Корневой волосок","root-hair","Вытянутый вырост одной живой клетки ризодермы, не отдельная клетка."],
 ["sunflower","tissue","Эпидермис листа","stomata","Замыкающие клетки окружают устьичную щель среди обычных клеток кожицы."],
 ["sunflower","cell","Замыкающая клетка устьица","stomata","Две замыкающие клетки для контекста; выделена одна из них."],
 ["sunflower","tissue","Эпидермис лепестка","petal","Покровные клетки лепестка с окрашенными вакуолями и папиллами."],
 ["sunflower","cell","Клетка эпидермиса","petal","Живая клетка лепестка с вакуольными пигментами, без выдуманных хлоропластов."],
 ["oak","tissue","Ксилема","xylem","Проводящие элементы с одревесневшей вторичной стенкой и порами."],
 ["oak","cell","Сосудистый элемент","xylem","Зрелый сосудистый элемент мёртв, имеет полый просвет и не имеет ядра."],
 ["oak","tissue","Мезофилл","mesophyll","Фотосинтезирующие клетки и межклетники губчатой паренхимы."],
 ["oak","cell","Клетка мезофилла","mesophyll","Хлоропласты в периферической цитоплазме вокруг большой вакуоли."],
 ["oak","tissue","Ризодерма","root-hair","Молодая поглощающая часть корня с наружными корневыми волосками."],
 ["oak","cell","Клетка корневого волоска","root-hair","Живой вырост клетки ризодермы с непрерывной мембраной и стенкой."]
];
export const BIO_CORE_MICROSCOPY_PLATES:readonly BioCoreMicroPlate[]=raw.map(
 ([organism,level,name,kind,caption])=>({organism,level,name,kind,caption})
);
const byId=new Map<string,BioCoreMicroPlate>(BIO_CORE_MICROSCOPY_PLATES.map(p=>[
 p.organism+":"+p.level+":"+p.name,p
] as const));
export function bioCoreMicroscopyPlateFor(organism:BioOrganism,node:BioNode):BioCoreMicroPlate|null{
 if((node.level!=="tissue"&&node.level!=="cell")||!node.id.startsWith(organism+"/"))return null;
 return byId.get(organism+":"+node.level+":"+node.name)??null;
}
