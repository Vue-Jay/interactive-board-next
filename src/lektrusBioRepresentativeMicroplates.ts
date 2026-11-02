/** School-level microscopy identities for the eight representative species.
 * A visual has to match exact organism, depth, path and reviewed node name.
 * Existing saved atlas IDs remain canonical. No surrogate species art.
 */
import type {BioNode,BioOrganism} from "./lektrusBioMicroscopeModel";
export const BIO_REPRESENTATIVE_IDS=["sparrow","perch","frog","bee","snail","pine","fern","wheat"] as const;
export type BioRepresentativeSpecies=typeof BIO_REPRESENTATIVE_IDS[number];
export type BioRepresentativeMicroKind=
 "bird-air-capillary"|"bird-keratin"|"bird-cone"|
 "fish-lamella"|"fish-neuromast"|"fish-myocardium"|
 "frog-skin"|"frog-lung"|"frog-rod"|
 "bee-trachea"|"bee-rhabdom"|"bee-flight-muscle"|
 "snail-foot-muscle"|"snail-eye"|"snail-mantle"|
 "pine-needle-mesophyll"|"pine-rhizodermis"|"pine-microsporangium"|
 "fern-frond-mesophyll"|"fern-sporocyte"|"fern-root-cortex"|
 "wheat-leaf-mesophyll"|"wheat-rhizodermis"|"wheat-tapetum";
type Branch={system:string;tissue:string;cell:string;kind:BioRepresentativeMicroKind;note:string};
const branches:Record<BioRepresentativeSpecies,readonly [Branch,Branch,Branch]>={
 sparrow:[
  {system:"Дыхательная система",tissue:"Газообменный эпителий",cell:"Клетка газообменного эпителия",kind:"bird-air-capillary",note:"Парабронхи · воздухоносные капилляры · тонкий эпителий"},
  {system:"Покровная система",tissue:"Эпидермис",cell:"Кератиноцит",kind:"bird-keratin",note:"Живые клетки эпидермиса · кератин · ороговевающий покров"},
  {system:"Зрительная система",tissue:"Сетчатка",cell:"Колбочка",kind:"bird-cone",note:"Колбочки птицы · наружный и внутренний сегменты"}
 ],
 perch:[
  {system:"Дыхательная система",tissue:"Эпителий ламелл",cell:"Эпителиальная клетка ламеллы",kind:"fish-lamella",note:"Тонкая жаберная ламелла · вода · кровеносный канал"},
  {system:"Система боковой линии",tissue:"Сенсорный эпителий невромаста",cell:"Волосковая клетка",kind:"fish-neuromast",note:"Купула · стереоцилии · настоящая киноцилия · нерв"},
  {system:"Кровеносная система",tissue:"Миокард",cell:"Кардиомиоцит",kind:"fish-myocardium",note:"Сердечные клетки · миофибриллы · вставочные диски"}
 ],
 frog:[
  {system:"Покровная система",tissue:"Эпидермис",cell:"Кератиноцит",kind:"frog-skin",note:"Тонкий влажный эпидермис · слизистые железы · капилляры"},
  {system:"Дыхательная система",tissue:"Дыхательный эпителий",cell:"Эпителиальная клетка лёгкого",kind:"frog-lung",note:"Складчатое мешковидное лёгкое, не альвеолы млекопитающих"},
  {system:"Зрительная система",tissue:"Сетчатка",cell:"Палочка",kind:"frog-rod",note:"Родопсин · диски наружного сегмента · синапс"}
 ],
 bee:[
  {system:"Трахейная система",tissue:"Эпителий трахеи",cell:"Трахейная эпителиальная клетка",kind:"bee-trachea",note:"Хитиновая интима · спиральные тении · живой эпителий"},
  {system:"Зрительная система",tissue:"Фоторецепторы омматидия",cell:"Рабдомерный фоторецептор",kind:"bee-rhabdom",note:"Омматидий · ретинулярные клетки · микроворсинки рабдома"},
  {system:"Двигательная система",tissue:"Поперечнополосатая мышечная ткань",cell:"Мышечное волокно",kind:"bee-flight-muscle",note:"Миофибриллы · саркомеры · многочисленные митохондрии"}
 ],
 snail:[
  {system:"Двигательная система",tissue:"Мышечная ткань ноги",cell:"Гладкий миоцит",kind:"snail-foot-muscle",note:"Веретеновидные гладкие миоциты, без поперечной исчерченности"},
  {system:"Зрительная система",tissue:"Фоторецепторный эпителий",cell:"Фоторецепторная клетка",kind:"snail-eye",note:"Глаз моллюска · рабдомерный аппарат, не палочка позвоночного"},
  {system:"Дыхательная система",tissue:"Эпителий мантии",cell:"Покровная эпителиальная клетка",kind:"snail-mantle",note:"Мантия лёгочной полости · эпителий · подлежащие сосуды"}
 ],
 pine:[
  {system:"Побег",tissue:"Мезофилл хвои",cell:"Клетка мезофилла хвои",kind:"pine-needle-mesophyll",note:"Складчатые стенки мезофилла · смоляные ходы · хлоропласты"},
  {system:"Корневая система",tissue:"Ризодерма",cell:"Клетка с корневым волоском",kind:"pine-rhizodermis",note:"Поглощающий вырост живой клетки молодого корня"},
  {system:"Мужские репродуктивные побеги",tissue:"Спорогенная ткань",cell:"Микроспороцит",kind:"pine-microsporangium",note:"Микроспороцит 2n до мейоза · микроспоры n после"},
 ],
 fern:[
  {system:"Листья спорофита",tissue:"Мезофилл вайи",cell:"Клетка мезофилла вайи",kind:"fern-frond-mesophyll",note:"Хлоренхима вайи · межклетники · сосудистый пучок"},
  {system:"Спороносные структуры",tissue:"Спорогенная ткань",cell:"Материнская клетка спор",kind:"fern-sporocyte",note:"Лептоспорангий · материнские клетки спор 2n · мейоз"},
  {system:"Корневая система",tissue:"Кора корня",cell:"Клетка коровой паренхимы",kind:"fern-root-cortex",note:"Коровая паренхима придаточного корня · центральный цилиндр"}
 ],
 wheat:[
  {system:"Побег",tissue:"Мезофилл листа",cell:"Клетка мезофилла",kind:"wheat-leaf-mesophyll",note:"Злаковый лист · мезофилл · параллельные жилки"},
  {system:"Корневая система",tissue:"Ризодерма",cell:"Клетка с корневым волоском",kind:"wheat-rhizodermis",note:"Мочковатый корень · наружный слой · один клеточный вырост"},
  {system:"Генеративные органы",tissue:"Тапетум",cell:"Клетка тапетума",kind:"wheat-tapetum",note:"Питательные клетки тапетума · стадия созревания пыльцы"}
 ]
};
export type BioRepresentativeMicroPlate={
 kind:BioRepresentativeMicroKind;organism:BioRepresentativeSpecies;level:"tissue"|"cell";name:string;note:string;branch:number;
};
export const BIO_REPRESENTATIVE_MICRO_PLATES:readonly BioRepresentativeMicroPlate[]=BIO_REPRESENTATIVE_IDS.flatMap(
 organism=>branches[organism].flatMap((b,branch)=>[
 {organism,kind:b.kind,branch,level:"tissue" as const,name:b.tissue,note:b.note},
 {organism,kind:b.kind,branch,level:"cell" as const,name:b.cell,note:b.note}
 ])
);
const keyed=new Map<string,BioRepresentativeMicroPlate>(
 BIO_REPRESENTATIVE_MICRO_PLATES.map(p=>[p.organism+":"+p.level+":"+p.name,p] as const)
);
export function bioRepresentativeMicroFor(organism:BioOrganism,node:BioNode):BioRepresentativeMicroPlate|null{
 if(node.level!=="tissue"&&node.level!=="cell")return null;
 if(!node.id.startsWith(organism+"/"))return null;
 const found=keyed.get(organism+":"+node.level+":"+node.name)??null;
 if(!found)return null;
 const systemName=branches[found.organism][found.branch].system;
 // Match the exact branch to avoid accidental reuse if another system has
 // similarly named cells or tissues.
 const systemSlug=systemName.toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]+/gu,"-").replace(/^-|-$/g,"");
 return node.id.split("/")[1]===systemSlug?found:null;
}
