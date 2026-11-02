/** Species-specific schematic plates for existing five-level anatomy chains.
 * Only exact reviewed organ/tissue names are mapped; unrelated organs
 * continue to use their previous illustrations. No real optical scale.
 */
import type {BioOrganism,BioNode} from "./lektrusBioMicroscopeModel";
export type BioSpecimenPlateKind="organ"|"tissue";
export type BioSpecimenPlateInfo={
 id:string;organism:BioOrganism;level:BioSpecimenPlateKind;
 nodeName:string;title:string;caption:string;source:string;
 /** Position of the highlighted true child tissue or cell on this plate. */
 focus:{x:number;y:number};
};
type RawPlate=[BioOrganism,string,string,string,string,string,{x:number;y:number}];
const facts:ReadonlyArray<RawPlate>=[
 ["sparrow","Лёгкое","Газообменный эпителий",
  "Лёгкое воробья · парабронхи","Воздух проходит через парабронхи и воздухоносные капилляры; это не альвеолы млекопитающих.",
  "https://openstax.org/books/biology-2e/pages/29-5-birds",{x:252,y:177}],
 ["perch","Жабры","Эпителий ламелл",
  "Жабры окуня · вторичные ламеллы","Жаберные нити несут множество тонких вторичных ламелл с кровеносными капиллярами.",
  "https://openstax.org/books/biology-2e/pages/39-2-gas-exchange-across-respiratory-surfaces",{x:248,y:157}],
 ["frog","Кожа","Эпидермис",
  "Кожа взрослой лягушки · разрез","Влажный эпидермис и подлежащая дерма с железами и капиллярами участвуют в кожном газообмене.",
  "https://openstax.org/books/biology-2e/pages/39-2-gas-exchange-across-respiratory-surfaces",{x:232,y:132}],
 ["bee","Сложный глаз","Фоторецепторы омматидия",
  "Сложный глаз пчелы · омматидии","Каждый омматидий содержит линзу, кристаллический конус и светочувствительные ретинулярные клетки с рабдомом.",
  "https://pmc.ncbi.nlm.nih.gov/articles/PMC2203004/",{x:249,y:170}],
 ["snail","Мускулистая нога","Мышечная ткань ноги",
  "Нога виноградной улитки · разрез","Перекрещивающиеся мышечные пучки под покровным эпителием участвуют в педальных волнах ползания.",
  "https://openstax.org/books/biology-2e/pages/28-3-mollusks-and-annelids",{x:240,y:176}],
 ["pine","Хвоя","Мезофилл хвои",
  "Хвоя сосны · поперечный разрез","Под кутикулой и устьицами расположен мезофилл; в центре две проводящие связки и трансфузионная ткань.",
  "https://academic.oup.com/jxb/article/74/21/6677/7260303",{x:203,y:160}],
 ["fern","Спорангий","Спорогенная ткань",
  "Спорангий орляка · срез","Лептоспорангий с однорядной стенкой и кольцом (аннулюсом); споры появляются после мейоза.",
  "https://www.nzplants.auckland.ac.nz/en/about/ferns/reproduction/sporangium.html",{x:250,y:172}],
 ["wheat","Пыльник","Тапетум",
  "Пыльник пшеницы · поперечный разрез","Внутри микроспорангиев тапетум питает развивающиеся клетки, из которых формируется пыльца.",
  "https://pmc.ncbi.nlm.nih.gov/articles/PMC5829449/",{x:278,y:171}]
];
const plates:Record<string,BioSpecimenPlateInfo>={};
for(const [organism,organ,tissue,title,caption,source,focus] of facts){
 for(const [level,nodeName,description] of [
  ["organ",organ,caption],
  ["tissue",tissue,caption]
 ] as [BioSpecimenPlateKind,string,string][]){
  const id=organism+":"+level;
  plates[id]={
   id,organism,level,nodeName,
   title:level==="organ"?title:tissue+" · строение ткани",
   caption:level==="organ"?description:"Увеличенный учебный срез: "+description,
   source,focus:level==="organ"?focus:{x:240,y:170}
  };
 }
}
export const BIO_SPECIMEN_PLATES:Readonly<Record<string,BioSpecimenPlateInfo>>=plates;
export function bioSpecimenPlateFor(organism:BioOrganism,node:BioNode):BioSpecimenPlateInfo|null{
 if(node.level!=="organ"&&node.level!=="tissue")return null;
 const plate=BIO_SPECIMEN_PLATES[organism+":"+node.level];
 return plate&&plate.nodeName===node.name?plate:null;
}
export function bioSpecimenChildSpot(organism:BioOrganism,parent:BioNode,child:BioNode):{x:number;y:number}|null{
 const plate=bioSpecimenPlateFor(organism,parent);
 return plate&&child.parentId===parent.id?plate.focus:null;
}
