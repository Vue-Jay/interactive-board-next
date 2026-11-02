/** Reviewed cellular teaching plates for eight modelled species.
 * This map connects REAL existing cell nodes and feature descriptions to
 * interactive, location-specific anatomy. It does not introduce fictitious
 * biological children into the persisted five-step assignment graph.
 */
import type {BioNode,BioOrganism} from "./lektrusBioMicroscopeModel";
export type BioCellSpot={x:number;y:number};
export type BioCellPlate={
 organism:BioOrganism;cellName:string;title:string;description:string;
 source:{title:string;url:string};
 /** Real features returned by bioCellFeatures(node), in their exact order. */
 landmarks:Readonly<Record<string,BioCellSpot>>;
 /** Stage or scientific caveat, never a numerical optical scale. */
 caveat:string;
};
export const BIO_CELL_PLATES:Readonly<Partial<Record<BioOrganism,BioCellPlate>>>={
 sparrow:{
  organism:"sparrow",cellName:"Клетка газообменного эпителия",
  title:"Плоский эпителий воздухоносного капилляра",
  description:"В лёгком птицы воздух отделён от крови очень тонким клеточным барьером. Ядросодержащая область клетки утолщена, а периферия уплощена.",
  caveat:"Срез учебный. Не путать воздухоносный капилляр птицы с альвеолой млекопитающих.",
  source:{title:"US EPA · Avian respiratory system",url:"https://semspub.epa.gov/work/08/1289549.pdf"},
  landmarks:{"Тонкая цитоплазма":{x:314,y:153},"Базальная мембрана":{x:326,y:199},"Ядро":{x:216,y:177}}
 },
 perch:{
  organism:"perch",cellName:"Эпителиальная клетка ламеллы",
  title:"Эпителиоцит вторичной жаберной ламеллы",
  description:"Между протекающей водой и кровью капилляра находится тонкий эпителий, уменьшающий путь диффузии газов.",
  caveat:"Показан участок одной вторичной ламеллы, не целая жаберная нить.",
  source:{title:"OpenStax Biology 2e · Gas exchange",url:"https://openstax.org/books/biology-2e/pages/39-2-gas-exchange-across-respiratory-surfaces"},
  landmarks:{"Тонкая поверхность":{x:235,y:127},"Контакт с водой":{x:332,y:72},"Базальная поверхность":{x:270,y:225}}
 },
 frog:{
  organism:"frog",cellName:"Кератиноцит",
  title:"Живой кератиноцит эпидермиса лягушки",
  description:"Кератиновые нити укрепляют клетку эпидермиса. Контакты между соседними клетками обеспечивают устойчивость покрова.",
  caveat:"Показан живой ядросодержащий кератиноцит; наружные ороговевающие клетки могут отличаться.",
  source:{title:"OpenStax Biology 2e · Epithelial tissues",url:"https://openstax.org/books/anatomy-and-physiology-2e/pages/4-2-epithelial-tissue"},
  landmarks:{"Кератиновые нити":{x:311,y:143},"Контакты клеток":{x:140,y:185},"Дифференцировка":{x:252,y:84}}
 },
 bee:{
  organism:"bee",cellName:"Рабдомерный фоторецептор",
  title:"Ретинулярная клетка сложного глаза пчелы",
  description:"Ретинулярные клетки образуют центральный рабдом из упорядоченных микроворсинок. Фотопигмент находится в светочувствительных мембранах.",
  caveat:"Показана одна клетка рядом с рабдомом, а не самостоятельный омматидий.",
  source:{title:"Goldsmith 1962 · Honey-bee retinula ultrastructure",url:"https://pmc.ncbi.nlm.nih.gov/articles/PMC2106111/"},
  landmarks:{"Рабдомер":{x:226,y:155},"Зрительный пигмент":{x:259,y:115},"Аксон":{x:278,y:271}}
 },
 snail:{
  organism:"snail",cellName:"Гладкий миоцит",
  title:"Гладкий миоцит мускулистой ноги улитки",
  description:"Веретеновидная клетка с центральным ядром сокращается благодаря актину и миозину; поперечной исчерченности нет.",
  caveat:"Удлинение клетки усилено для наглядности. Это не многоклеточный мышечный пучок.",
  source:{title:"OpenStax Biology 2e · Mollusks",url:"https://openstax.org/books/biology-2e/pages/28-3-mollusks-and-annelids"},
  landmarks:{"Актин и миозин":{x:326,y:156},"Удлинённая форма":{x:145,y:197},"Ядро":{x:241,y:167}}
 },
 pine:{
  organism:"pine",cellName:"Клетка мезофилла хвои",
  title:"Фотосинтезирующая клетка хвои сосны",
  description:"Живая клетка с целлюлозной стенкой, хлоропластами и вакуолями, характерная для мезофилла хвои.",
  caveat:"Хлоропласты и вакуоли обозначены условно; внутриклеточные размеры не измерялись.",
  source:{title:"OpenStax Biology 2e · Leaves",url:"https://openstax.org/books/biology-2e/pages/30-4-leaves"},
  landmarks:{"Хлоропласты":{x:337,y:116},"Стенка":{x:100,y:169},"Вакуоль":{x:248,y:191}}
 },
 fern:{
  organism:"fern",cellName:"Материнская клетка спор",
  title:"Диплоидный спороцит лептоспорангия",
  description:"Материнская клетка спор (2n) проходит мейоз с образованием гаплоидных спор (n), которые позже дают начало гаметофиту.",
  caveat:"Этапы справа показаны как отдельная временная последовательность, не как содержимое одной клетки одновременно.",
  source:{title:"OpenStax Biology 2e · Seedless vascular plants",url:"https://openstax.org/books/biology-2e/pages/25-4-seedless-vascular-plants"},
  landmarks:{"Диплоидное ядро":{x:182,y:160},"Мейоз":{x:353,y:129},"Образование спор":{x:357,y:229}}
 },
 wheat:{
  organism:"wheat",cellName:"Клетка тапетума",
  title:"Клетка питательного слоя пыльника",
  description:"Тапетум поддерживает развитие микроспор, выделяет вещества для их оболочки и при нормальном созревании пыльника постепенно деградирует.",
  caveat:"Исчезновение слоя изображено в отдельной последовательности: клетка не исчезает в момент выполнения всех прочих функций.",
  source:{title:"NCBI · Wheat anther development",url:"https://pmc.ncbi.nlm.nih.gov/articles/PMC5829449/"},
  landmarks:{"Питательная функция":{x:172,y:129},"Секреция":{x:346,y:153},"Исчезновение слоя":{x:371,y:267}}
 }
};
export function bioCellPlateFor(organism:BioOrganism,node:BioNode):BioCellPlate|null{
 const plate=BIO_CELL_PLATES[organism];
 return node.level==="cell"&&plate?.cellName===node.name?plate:null;
}
