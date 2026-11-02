/**
 * Source-aware animation catalogue for the variable-depth biological atlas.
 * The animation is an educational visualization, not a timed physiological
 * simulator or proof of actual microscopic scale or motion frequency.
 */
import type {BioAlternativeOrganism,BioAltNode} from "./lektrusBioAlternativeAtlas";

export type BioMotionId=
 "water-current"|"choanocyte-beat"|"tentacle-sway"|"nematocyst-discharge"|
 "moss-sway"|"spore-release"|"flagellar-swim"|"light-sensing"|
 "spiral-chloroplast"|"conjugation";
export type BioMotionMode="loop"|"once";
export type BioMotionInfo={
 id:BioMotionId;
 name:string;
 description:string;
 mode:BioMotionMode;
 sourceUrl:string;
};

const lesson=(id:BioMotionId,name:string,description:string,mode:BioMotionMode,sourceUrl:string):BioMotionInfo=>
 ({id,name,description,mode,sourceUrl});

const spongeSource="https://openstax.org/books/biology-2e/pages/28-1-phylum-porifera";
const hydraSource="https://openstax.org/books/biology-2e/pages/28-2-phylum-cnidaria";
const mossSource="https://openstax.org/books/biology-2e/pages/25-3-bryophytes";
const flagellaSource="https://pmc.ncbi.nlm.nih.gov/articles/PMC3811559/";
const spirogyraSource="https://allenwebsite-general.s3.ap-south-1.amazonaws.com/nios/download/sr-secondary/Biology_314_Book2.pdf";

export const BIO_MOTIONS:Readonly<Record<BioMotionId,BioMotionInfo>>={
 "water-current":lesson("water-current","Ток воды через поры","Вода поступает через остии, проходит через фильтрующие камеры и выходит наружу. Направление движения показано условно.","loop",spongeSource),
 "choanocyte-beat":lesson("choanocyte-beat","Работа жгутика хоаноцита","Жгутик создаёт ток воды, а воротничок микроворсинок задерживает частицы пищи.","loop",spongeSource),
 "tentacle-sway":lesson("tentacle-sway","Движение щупалец гидры","Живая гидра может изменять форму тела и перемещать щупальца. Скорость на схеме не соответствует реальной.","loop",hydraSource),
 "nematocyst-discharge":lesson("nematocyst-discharge","Выстрел нематоцисты","При раздражении стрекательная капсула однократно выворачивает нить. Повторное срабатывание этой же капсулы не изображается как естественный цикл.","once",hydraSource),
 "moss-sway":lesson("moss-sway","Гаметофит мха","Небольшое колебание рисунка показывает гибкость листовидных структур, а не активные движения растения.","loop",mossSource),
 "spore-release":lesson("spore-release","Высвобождение спор","После созревания споры (n) высвобождаются из коробочки спорофита (2n). Один запуск показывает один условный эпизод.","once",mossSource),
 "flagellar-swim":lesson("flagellar-swim","Движение двух жгутиков","Хламидомонада перемещается с помощью двух жгутиков; анимация схематична и не воспроизводит траекторию их трёхмерного биения.","loop",flagellaSource),
 "light-sensing":lesson("light-sensing","Восприятие света","Глазок и фоторецепторы участвуют в фототаксисе. Световой луч показан как объясняющая подсветка, а не реальный видимый поток в клетке.","loop",flagellaSource),
 "spiral-chloroplast":lesson("spiral-chloroplast","Спиральные хлоропласты","Подсвечивается характерная ленточная форма хлоропласта внутри клетки спирогиры. Это не вращение хлоропласта.","loop",spirogyraSource),
 "conjugation":lesson("conjugation","Конъюгация спирогиры","Содержимое гаплоидных клеток переходит через конъюгационную трубку, затем образуется диплоидная зигота (2n).","once",spirogyraSource)
};

/** Specific first match wins: a nematocyst does NOT repetitively discharge. */
export function bioMotionFor(species:BioAlternativeOrganism,node:BioAltNode):BioMotionInfo|null{
 const id=node.id;
 if(species==="sponge"){
  if(id.includes("choanocyte")||id.includes("chamber"))return BIO_MOTIONS["choanocyte-beat"];
  if(id==="sponge"||id.includes("/water")||id.includes("/pores"))return BIO_MOTIONS["water-current"];
 }
 if(species==="hydra"){
  if(id.includes("cnidocyte")||id.includes("nematocyst"))return BIO_MOTIONS["nematocyst-discharge"];
  if(id==="hydra"||id.includes("/tentacle"))return BIO_MOTIONS["tentacle-sway"];
 }
 if(species==="moss"){
  if(id==="moss/spore"||id==="moss/sporophyte/capsule")return BIO_MOTIONS["spore-release"];
  if(id==="moss"||id.includes("/gametophyte"))return BIO_MOTIONS["moss-sway"];
 }
 if(species==="chlamydomonas"){
  if(id.includes("/eyespot"))return BIO_MOTIONS["light-sensing"];
  if(id==="chlamydomonas"||id.includes("/flagella"))return BIO_MOTIONS["flagellar-swim"];
 }
 if(species==="spirogyra"){
  if(id.includes("/conjugation"))return BIO_MOTIONS.conjugation;
  if(id==="spirogyra"||id==="spirogyra/filament"||id==="spirogyra/filament/cell"||id.includes("/chloroplast"))return BIO_MOTIONS["spiral-chloroplast"];
 }
 return null;
}
