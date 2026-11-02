/** Curated OFFLINE teaching index, not a complete global species checklist.
 * School groups and phylogenetic clades are labelled by their actual rank;
 * taxonomy can change, and a representative is never silently substituted
 * for another species' anatomical illustration.
 */
import type {BioOrganism} from "./lektrusBioMicroscopeModel";
export type BioKingdom="animal"|"plant";
export type BioTaxonRank="класс"|"клада"|"подкласс";
export type BioRepresentative={name:string;scientific:string;anatomy?:BioOrganism};
export type BioTaxon={
 id:string;kingdom:BioKingdom;section:string;sectionLatin:string;
 name:string;scientific:string;rank:BioTaxonRank;
 summary:string;traits:[string,string];representatives:BioRepresentative[];
 caution?:string;
};
type Raw=[string,string,string,string,string,string,string?,string?];
const entries:BioTaxon[]=[];
function section(kingdom:BioKingdom,section:string,sectionLatin:string,rows:Raw[]){
 for(const [id,scientific,name,summary,trait1,trait2,samples,caution] of rows){
  const representatives=(samples??"").split(";").filter(Boolean).map(pair=>{
   const [label,latin,anatomy]=pair.split("|");
   return {name:label,scientific:latin,...(anatomy?{anatomy:anatomy as BioOrganism}:{})};
  });
  entries.push({id,kingdom,section,sectionLatin,name,scientific,rank:"класс",summary,
   traits:[trait1,trait2],representatives,...(caution?{caution}:{})});
 }
}
section("animal","Губки","Porifera",[
 ["demospongiae","Demospongiae","Обыкновенные губки","Наиболее разнообразная группа губок; фильтруют воду через систему каналов.","Тело без настоящих органов","Скелет из спонгина и/или кремнёвых игл","Бадяга речная|Spongilla lacustris"],
 ["calcarea","Calcarea","Известковые губки","Морские губки с известковыми скелетными иглами.","Фильтрация воды","Иглы из карбоната кальция","Клатрина|Clathrina clathrus"],
 ["hexactinellida","Hexactinellida","Стеклянные губки","Глубоководные и другие морские губки с кремнёвым скелетом.","Шестилучевые иглы","Многие ткани образуют синцитий","Корзинка Венеры|Euplectella aspergillum"]
]);
section("animal","Стрекающие","Cnidaria",[
 ["hydrozoa","Hydrozoa","Гидроидные","Стрекающие с полипоидными или медузоидными стадиями; цикл развития различается.","Стрекательные клетки","У некоторых образуются колонии","Пресноводная гидра|Hydra vulgaris"],
 ["scyphozoa","Scyphozoa","Сцифоидные медузы","Большую часть заметного жизненного цикла составляет стадия медузы.","Стрекательные клетки","Преимущественно морские","Аурелия|Aurelia aurita"],
 ["anthozoa","Anthozoa","Коралловые полипы","Полипы без медузоидной стадии; многие формируют рифы.","Полипоидное тело","Среди представителей есть симбиотрофы","Актиния конская|Actinia equina"],
 ["cubozoa","Cubozoa","Кубомедузы","Морские медузы с кубовидным зонтиком и сложными органами зрения.","Четыре угла зонтика","Развитая зрительная система","Морская оса|Chironex fleckeri"]
]);
section("animal","Плоские черви","Platyhelminthes",[
 ["rhabditophora","Rhabditophora","Ресничные и родственные свободноживущие","Большая группа плоских червей, часто хищных и свободноживущих.","Двусторонняя симметрия","Нет кровеносной системы","Белая планария|Schmidtea mediterranea"],
 ["trematoda","Trematoda","Сосальщики","Паразитические плоские черви со сложными жизненными циклами.","Присоски у многих видов","Смена хозяев у многих видов","Печёночная двуустка|Fasciola hepatica"],
 ["cestoda","Cestoda","Ленточные черви","Паразитические черви без собственного кишечника; получают питание через покровы.","Нет пищеварительного тракта","Часто тело состоит из члеников","Бычий цепень|Taenia saginata"]
]);
section("animal","Нематоды","Nematoda",[
 ["chromadorea","Chromadorea","Хромадореи","Крупная линия круглых червей, включающая свободноживущих и паразитов.","Линька кутикулы","Первичная полость тела","Аскарида человеческая|Ascaris lumbricoides"],
 ["enoplea","Enoplea","Эноплеи","Разнообразные морские, почвенные и паразитические нематоды.","Кутикула","Нередко сложные органы чувств","Власоглав человеческий|Trichuris trichiura"]
]);
section("animal","Кольчатые черви","Annelida",[
 ["clitellata","Clitellata","Поясковые черви","Включают дождевых червей и пиявок; поясок участвует в размножении.","Сегментированное тело","Поясок у половозрелых","Дождевой червь|Lumbricus terrestris"],
 ["errantia","Errantia","Подвижные многощетинковые","Активно перемещающиеся морские кольчецы, часто с параподиями.","Развитые боковые выросты","Щетинки помогают двигаться","Нереис|Alitta virens"]
]);
section("animal","Моллюски","Mollusca",[
 ["gastropoda","Gastropoda","Брюхоногие","Улитки и слизни, обитающие в воде и на суше.","Мускулистая нога","Спиральная раковина не у всех","Виноградная улитка|Helix pomatia"],
 ["bivalvia","Bivalvia","Двустворчатые","Водные фильтраторы с раковиной из двух створок.","Отсутствует радула","Жабры часто участвуют в фильтрации","Беззубка|Anodonta anatina"],
 ["cephalopoda","Cephalopoda","Головоногие","Активные морские хищники с руками или щупальцами и сложным поведением.","Крупные глаза у многих","Реактивное движение","Осьминог обыкновенный|Octopus vulgaris"],
 ["polyplacophora","Polyplacophora","Панцирные моллюски","Морские донные моллюски с восемью спинными пластинками.","Восемь пластинок","Нога служит для прикрепления","Хитон|Acanthopleura granulata"]
]);
section("animal","Членистоногие","Arthropoda",[
 ["insecta","Insecta","Насекомые","Шестиногие членистоногие; у взрослых обычно три отдела тела.","Три пары ног у взрослых","Трахейное дыхание у большинства","Пчела медоносная|Apis mellifera;Бабочка монарх|Danaus plexippus"],
 ["arachnida","Arachnida","Паукообразные","Пауки, скорпионы, клещи и родственные группы без усиков.","Четыре пары ходильных ног у типичных взрослых","Хелицеры","Паук-крестовик|Araneus diadematus"],
 ["malacostraca","Malacostraca","Высшие раки","Большая группа ракообразных, включая крабов, креветок и мокриц.","Жабры у многих водных видов","Разделённое на отделы тело","Речной рак|Astacus astacus"],
 ["branchiopoda","Branchiopoda","Жаброногие раки","Ракообразные, часто обитающие в пресной воде.","Листовидные конечности у многих","Мелкие планктонные виды","Дафния|Daphnia magna"],
 ["chilopoda","Chilopoda","Губоногие","Быстрые наземные хищники с одной парой ног на туловищный сегмент.","Ядовитые ногочелюсти","Одна пара ног на сегмент","Сколопендра|Scolopendra cingulata"],
 ["diplopoda","Diplopoda","Двупарноногие","Наземные детритофаги, у которых большинство сегментов несут две пары ног.","Две пары ног у большинства диплосегментов","Часто сворачиваются при защите","Кивсяк|Ommatoiulus sabulosus"]
]);
section("animal","Иглокожие","Echinodermata",[
 ["asteroidea","Asteroidea","Морские звёзды","Морские донные иглокожие с лучами, отходящими от центрального диска.","Амбулакральная система","Пятилучевая симметрия у типичных взрослых","Морская звезда|Asterias rubens"],
 ["ophiuroidea","Ophiuroidea","Офиуры","Иглокожие с резко отделёнными тонкими подвижными лучами.","Чёткий центральный диск","Передвигаются изгибами лучей","Офиура|Ophiothrix fragilis"],
 ["echinoidea","Echinoidea","Морские ежи","Иглокожие с известковым панцирем и подвижными иглами.","Сросшиеся скелетные пластинки","Иглы на поверхности","Морской ёж|Strongylocentrotus droebachiensis"],
 ["holothuroidea","Holothuroidea","Голотурии","Удлинённые иглокожие с редуцированным известковым скелетом.","Ротовые щупальца","Амбулакральная система","Морской огурец|Holothuria tubulosa"],
 ["crinoidea","Crinoidea","Морские лилии","Иглокожие с перистыми лучами, фильтрующие взвесь.","Перистые лучи","Многие имеют стебель только в юности","Коматулида|Antedon mediterranea"]
]);
section("animal","Хордовые","Chordata",[
 ["ascidiacea","Ascidiacea","Асцидии","Морские оболочники, у личинок которых проявляются признаки хордовых.","Фильтрующий глоточный аппарат","Хорда сохраняется не у взрослых большинства","Асцидия|Ciona intestinalis"],
 ["leptocardii","Leptocardii","Ланцетники","Небольшие морские хордовые с хордой вдоль тела.","Хорда сохраняется всю жизнь","Нет черепа и настоящих позвонков","Ланцетник|Branchiostoma lanceolatum"],
 ["chondrichthyes","Chondrichthyes","Хрящевые рыбы","Акулы, скаты и химеры; опорный скелет преимущественно хрящевой.","Хрящевой скелет","Жаберное дыхание","Катран|Squalus acanthias"],
 ["actinopterygii","Actinopterygii","Лучепёрые рыбы","Крупнейшая современная группа костных рыб с лучами в плавниках.","Плавники поддерживаются лучами","Жаберное дыхание","Окунь речной|Perca fluviatilis"],
 ["sarcopterygii","Sarcopterygii","Лопастепёрые","Эволюционная линия с мясистыми парными плавниками; включает и наземных позвоночных.","Парные плавники с внутренним скелетом у рыб","Предковая линия четвероногих","Латимерия|Latimeria chalumnae","В современной филогенетике четвероногие включены внутрь Sarcopterygii."],
 ["amphibia","Amphibia","Земноводные","Лягушки, хвостатые и червяги; развитие и способы дыхания разнообразны.","Влажная кожа участвует в газообмене у многих","Метаморфоз встречается у многих","Травяная лягушка|Rana temporaria"],
 ["reptilia","Reptilia","Пресмыкающиеся (традиционная группа)","Черепахи, чешуйчатые и крокодилы в школьном объёме.","Кератинизированный покров","Лёгочное дыхание","Прыткая ящерица|Lacerta agilis","В современной кладистике птицы входят в линию рептилий; здесь традиционный школьный объём."],
 ["aves","Aves","Птицы","Оперённые динозавры с передними конечностями, преобразованными в крылья.","Перья","Четырёхкамерное сердце","Домовый воробей|Passer domesticus"],
 ["mammalia","Mammalia","Млекопитающие","Позвоночные с волосяным покровом и молочными железами.","Вскармливание молоком","Три слуховые косточки","Человек|Homo sapiens|human;Кошка домашняя|Felis catus|cat;Ёж европейский|Erinaceus europaeus"]
]);
section("plant","Зелёные водоросли (широкий школьный обзор)","Chlorophyta",[
 ["chlorophyceae","Chlorophyceae","Хлорофициевые","Разнообразные одноклеточные и колониальные пресноводные зелёные водоросли.","Хлорофиллы a и b","Клеточные стенки у многих видов","Хламидомонада|Chlamydomonas reinhardtii"],
 ["ulvophyceae","Ulvophyceae","Ульвофициевые","Многие морские зелёные водоросли с пластинчатыми или нитчатыми талломами.","Таллом без настоящих органов","Морские и пресноводные виды","Ульва|Ulva lactuca"],
 ["trebouxiophyceae","Trebouxiophyceae","Требуксиофициевые","Одноклеточные зелёные водоросли; некоторые живут в симбиозе с грибами.","Часто коккоидные клетки","Симбиоз у ряда видов","Хлорелла|Chlorella vulgaris"]
]);
section("plant","Мхи","Bryophyta",[
 ["bryopsida","Bryopsida","Листостебельные мхи","Мхи со спорофитом, развивающимся на гаметофите.","Ризоиды вместо настоящих корней","Споры в коробочке","Кукушкин лён|Polytrichum commune"],
 ["sphagnopsida","Sphagnopsida","Сфагновые мхи","Мхи болот с водоудерживающими гиалиновыми клетками.","Мёртвые водоносные клетки","Участвуют в образовании торфа","Сфагнум|Sphagnum palustre"],
 ["andreaeopsida","Andreaeopsida","Андреевые мхи","Мхи каменистых местообитаний; коробочка вскрывается продольными щелями.","Растут на камнях","Характерное вскрытие коробочки","Андрея скальная|Andreaea rupestris"]
]);
section("plant","Печёночники","Marchantiophyta",[
 ["marchantiopsida","Marchantiopsida","Маршанциевые","Печёночники с плоским слоевищем у типичных представителей.","Нет настоящих корней","Вегетативные выводковые корзинки у некоторых","Маршанция многообразная|Marchantia polymorpha"],
 ["jungermanniopsida","Jungermanniopsida","Юнгерманиевые","Печёночники с листоватым или слоевищным гаметофитом.","Споровое размножение","Ризоиды","Порелла|Porella platyphylla"]
]);
section("plant","Антоцеротовые","Anthocerotophyta",[
 ["anthocerotopsida","Anthocerotopsida","Антоцеротовые","Небольшие наземные растения с вытянутым рожковидным спорофитом.","Длительно растущий спорофит","Гаметофит в форме слоевища","Антоцерос|Anthoceros punctatus"]
]);
section("plant","Плауновидные","Lycopodiophyta",[
 ["lycopodiopsida","Lycopodiopsida","Плауновидные","Древняя линия сосудистых споровых растений с микрофиллами.","Проводящие ткани","Спорангии на спорофиллах","Плаун булавовидный|Lycopodium clavatum;Селагинелла|Selaginella kraussiana"]
]);
section("plant","Папоротники и союзные группы","Polypodiopsida (broad)",[
 ["polypodiopsida","Polypodiopsida","Папоротники (широкий объём)","Сосудистые споровые растения, среди которых преобладают папоротники.","Споры вместо семян","Проводящие ткани","Орляк обыкновенный|Pteridium aquilinum"],
 ["equisetidae","Equisetidae","Хвощи","Споровые растения с членистыми полыми побегами и кремнезёмом в покровах.","Членистый стебель","Спороносные стробилы","Хвощ полевой|Equisetum arvense","Хвощи входят в эволюционную линию папоротников; Equisetidae здесь подкласс."]
]);
section("plant","Голосеменные","Gymnosperms",[
 ["pinopsida","Pinopsida","Хвойные","Семенные древесные растения, обычно с шишками и игольчатыми или чешуйчатыми листьями.","Семязачатки не заключены в завязь","Вторичный рост древесины","Сосна обыкновенная|Pinus sylvestris"],
 ["cycadopsida","Cycadopsida","Саговниковые","Тропические и субтропические семенные растения с крупными перистыми листьями.","Семязачатки открыты","Часто раздельнополые растения","Саговник поникающий|Cycas revoluta"],
 ["ginkgoopsida","Ginkgoopsida","Гинкговые","Современный класс представлен одним ныне живущим видом.","Вееровидные листья","Двудомность","Гинкго двулопастный|Ginkgo biloba"],
 ["gnetopsida","Gnetopsida","Гнетовые","Голосеменные с необычными для этой группы особенностями строения.","Три очень разные современные линии","Семязачатки без завязи","Вельвичия удивительная|Welwitschia mirabilis"]
]);
section("plant","Цветковые растения","Angiosperms",[
 ["monocots","Monocots","Однодольные","Большая эволюционная линия цветковых, включающая злаки, орхидеи и лилии.","Одна семядоля у типичных видов","Параллельное жилкование у многих","Пшеница мягкая|Triticum aestivum"],
 ["eudicots","Eudicots","Эвдикоты","Крупнейшая линия цветковых с трёхбороздной пыльцой или её производными.","Триапертурная пыльца","Сетчатое жилкование у многих","Подсолнечник однолетний|Helianthus annuus|sunflower;Дуб черешчатый|Quercus robur|oak"],
 ["magnoliids","Magnoliids","Магнолииды","Одна из древних современных ветвей цветковых, включая магнолии и лавровые.","Разнообразные строения цветков","Часто ароматические вещества","Магнолия крупноцветковая|Magnolia grandiflora"],
 ["austrobaileyales","Austrobaileyales","Раннеотделившиеся цветковые","Небольшая эволюционная ветвь цветковых, отделившаяся до большинства современных групп.","Не относится к однодольным или эвдикотам","Разные формы роста","Бадьян настоящий|Illicium verum"]
]);
const clades=new Set(["monocots","eudicots","magnoliids","austrobaileyales"]);
export const BIO_TAXA:ReadonlyArray<BioTaxon>=entries.map(t=>
 t.id==="equisetidae"?{...t,rank:"подкласс"}:clades.has(t.id)?{...t,rank:"клада"}:t);
export const bioTaxonById=(id:string):BioTaxon|undefined=>BIO_TAXA.find(t=>t.id===id);
export const bioTaxaFor=(kingdom:BioKingdom):BioTaxon[]=>BIO_TAXA.filter(t=>t.kingdom===kingdom);
export const bioTaxonForOrganism=(id:BioOrganism):BioTaxon|undefined=>
 BIO_TAXA.find(t=>t.representatives.some(r=>r.anatomy===id));
/** Text-only search. The app runs offline, so no remote API is required. */
export function searchBioTaxa(query:string,kingdom:BioKingdom):BioTaxon[]{
 const normalized=query.trim().toLocaleLowerCase("ru-RU");
 return bioTaxaFor(kingdom).filter(t=>!normalized||
  [t.name,t.scientific,t.section,t.sectionLatin,...t.representatives.flatMap(r=>[r.name,r.scientific])]
   .some(s=>s.toLocaleLowerCase("ru-RU").includes(normalized)));
}
export const BIO_TAXONOMY_SOURCES=[
 {label:"Catalogue of Life · проверка принятых названий",url:"https://www.catalogueoflife.org/data/download"},
 {label:"GBIF · таксономический справочник",url:"https://www.gbif.org/dataset/d7dddbf4-2cf0-4f39-9b2a-bb099caae36c"},
 {label:"Kew · номенклатура растений",url:"https://powo.science.kew.org/about"}
] as const;
