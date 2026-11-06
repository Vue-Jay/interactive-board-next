/** Original offline reference slides. These are independent examples,
 * NOT serial optical zoom frames or a registered sample of this person.
 * Wikimedia Commons author metadata does not explicitly verify species;
 * never label them as a patient-specific human biopsy.
 */
import thinSkinUrl from "./assets/bio-atlas/specimens/skin-thin-bhavya-akula-cc-by-sa4.jpg";
import thickSkinUrl from "./assets/bio-atlas/specimens/skin-thick-bhavya-akula-cc-by-sa4.jpg";
export type SkinReferenceType="thin"|"thick";
export type SkinReferenceSpecimen={
 id:SkinReferenceType;title:string;imageUrl:string;originalUrl:string;
 author:string;licenseName:string;licenseUrl:string;fileSha1:string;
 sampleOrigin:string;kind:"independent-reference-specimen";
 notes:string;hairFolliclesExpected:boolean;stratumLucidumExpected:boolean;
};
const commons="https://commons.wikimedia.org/wiki/File:";
export const SKIN_REFERENCE_SPECIMENS:readonly SkinReferenceSpecimen[]=[
 {id:"thin",title:"Тонкая кожа · волосяные фолликулы",
 imageUrl:thinSkinUrl,
 originalUrl:commons+"Histology_of_thin_skin.jpg",
 author:"Bhavya akula",
 licenseName:"CC BY-SA 4.0",
 licenseUrl:"https://creativecommons.org/licenses/by-sa/4.0/",
 fileSha1:"5f74f84105b13bdc7dc880d3bc38ef2bc2404d07",
 sampleOrigin:"Микроскопический препарат H&E; вид, участок тела и масштабная калибровка не указаны автором.",
 kind:"independent-reference-specimen",
 notes:"Типовой образец тонкой волосистой кожи. Не является срезом выбранной точки тела; цифровой зум доски не равен увеличению этого микроскопа.",
 hairFolliclesExpected:true,stratumLucidumExpected:false},
 {id:"thick",title:"Толстая кожа · выраженный роговой слой",
 imageUrl:thickSkinUrl,
 originalUrl:commons+"Histology_of_thick_skin.jpg",
 author:"Bhavya akula",
 licenseName:"CC BY-SA 4.0",
 licenseUrl:"https://creativecommons.org/licenses/by-sa/4.0/",
 fileSha1:"9eba91a3b2060e7d626a301ef1e278fa9897ebb6",
 sampleOrigin:"Микроскопический препарат H&E; вид, участок тела и масштабная калибровка не указаны автором.",
 kind:"independent-reference-specimen",
 notes:"Морфология толстой безволосой кожи характерна для ладоней и подошв человека. Препарат демонстрационный, а не зарегистрированная точка модели.",
 hairFolliclesExpected:false,stratumLucidumExpected:true}
] as const;
