/** Evidence-backed reference micrographs. These are independent samples, never
 * a photograph of the selected point in the continuous 360x600 human model.
 * Even when the species is known, tissue location and pixel calibration must
 * remain unknown unless the published specimen explicitly identifies them.
 */
import humanSkinUrl from "./assets/bio-atlas/specimens/skin-human-cdc-phil14586.jpg";
import thinSkinUrl from "./assets/bio-atlas/specimens/skin-thin-bhavya-akula-cc-by-sa4.jpg";
import thickSkinUrl from "./assets/bio-atlas/specimens/skin-thick-bhavya-akula-cc-by-sa4.jpg";

export type SkinReferenceType="human"|"thin"|"thick";
export type SkinReferenceSpecimen={
 id:SkinReferenceType;title:string;imageUrl:string;originalUrl:string;
 author:string;licenseName:string;licenseUrl:string;fileSha1:string|null;
 fileSha256:string|null;sampleOrigin:string;
 kind:"independent-reference-specimen";
 notes:string;
 hairFolliclesExpected:boolean|null;
 stratumLucidumExpected:boolean|null;
 speciesVerified:"human"|null;
 skinType:"thin"|"thick"|null;
 siteVerified:string|null;
 stainVerified:string|null;
 sourcePhotoMagnification:number|null;
 micronsPerPixel:number|null;
};
const commons="https://commons.wikimedia.org/wiki/File:";
export const SKIN_REFERENCE_SPECIMENS:readonly SkinReferenceSpecimen[]=[
 {id:"human",title:"Кожа человека · подтверждённый препарат",
 imageUrl:humanSkinUrl,
 originalUrl:"https://wwwn.cdc.gov/phil/Details.aspx?pid=14586",
 author:"Centers for Disease Control and Prevention (CDC), PHIL 14586",
 licenseName:"Общественное достояние США (CDC)",
 licenseUrl:"https://wwwn.cdc.gov/phil/Details.aspx?pid=14586",
 fileSha1:null,
 fileSha256:"179fba0d9ef1929b2aba7f193a212c896a28f3a2dd82f4198298066fa3355393",
 sampleOrigin:"Человеческая кожа, CDC PHIL №14586. При съёмке указано увеличение 50×; область тела, тип окраски и размер пикселя не сообщаются.",
 kind:"independent-reference-specimen",
 notes:"Оригинальный биологический образец кожи человека для сравнения; не является препаратом выбранной точки силуэта и не имеет известной линейной калибровки.",
 hairFolliclesExpected:null,stratumLucidumExpected:null,
 speciesVerified:"human",skinType:null,siteVerified:null,
 stainVerified:null,sourcePhotoMagnification:50,micronsPerPixel:null},
 {id:"thin",title:"Тонкая кожа · демонстрационный препарат",
 imageUrl:thinSkinUrl,originalUrl:commons+"Histology_of_thin_skin.jpg",
 author:"Bhavya akula",licenseName:"CC BY-SA 4.0",
 licenseUrl:"https://creativecommons.org/licenses/by-sa/4.0/",
 fileSha1:"5f74f84105b13bdc7dc880d3bc38ef2bc2404d07",
 fileSha256:null,
 sampleOrigin:"H&E, заявлена тонкая кожа; вид, область тела и масштабная калибровка не указаны автором.",
 kind:"independent-reference-specimen",
 notes:"Типовой образец тонкой волосистой кожи. Не является срезом выбранной точки тела; цифровой зум доски не равен оптическому увеличению.",
 hairFolliclesExpected:true,stratumLucidumExpected:false,
 speciesVerified:null,skinType:"thin",siteVerified:null,
 stainVerified:"H&E",sourcePhotoMagnification:null,micronsPerPixel:null},
 {id:"thick",title:"Толстая кожа · демонстрационный препарат",
 imageUrl:thickSkinUrl,originalUrl:commons+"Histology_of_thick_skin.jpg",
 author:"Bhavya akula",licenseName:"CC BY-SA 4.0",
 licenseUrl:"https://creativecommons.org/licenses/by-sa/4.0/",
 fileSha1:"9eba91a3b2060e7d626a301ef1e278fa9897ebb6",
 fileSha256:null,
 sampleOrigin:"H&E, заявлена толстая кожа; вид, область тела и масштабная калибровка не указаны автором.",
 kind:"independent-reference-specimen",
 notes:"Толстая безволосая кожа человека характерна для ладоней и подошв, но происхождение данного демонстрационного образца неизвестно.",
 hairFolliclesExpected:false,stratumLucidumExpected:true,
 speciesVerified:null,skinType:"thick",siteVerified:null,
 stainVerified:"H&E",sourcePhotoMagnification:null,micronsPerPixel:null}
] as const;

/** Human slides with verified spatial and pixel metadata. Images belong to
 * the University of Minnesota and are NOT bundled while redistribution terms
 * remain unverified. Only links/metadata are displayed in Lektrus.
 */
export const SKIN_CALIBRATED_EXTERNAL_REFERENCES=[
 {id:"thin-human",title:"Тонкая кожа человека",
 site:"Тонкая кожа (конкретный участок не указан)",
 sourceUrl:"https://histologyguide.org/slideview/MH-090-thin-skin/11-slide-1.html",
 source:"University of Minnesota, Histology Guide, MH 090",
 preparation:"Гематоксилин и эозин (H&E)",
 objective:"40×",micronsPerPixel:.3171,
 species:"Homo sapiens",siteVerified:false,usage:"external-viewer-only",
 notes:"Калибровка оригинального цифрового препарата, а не масштаб виртуального разреза Lektrus."},
 {id:"thumb-human",title:"Толстая кожа большого пальца человека",
 site:"Большой палец руки (человек)",
 sourceUrl:"https://histologyguide.org/slideview/MH-091bhr-thick-skin/11-slide-1.html",
 source:"University of Minnesota, Histology Guide, MH 091bhr",
 preparation:"Гематоксилин и эозин (H&E)",
 objective:"60×, масляная иммерсия",micronsPerPixel:.3171,
 species:"Homo sapiens",siteVerified:true,usage:"external-viewer-only",
 notes:"Участок подтверждён; масштаб относится к оригиналу, не к цифровому зуму Lektrus."},
 {id:"scalp-human",title:"Кожа волосистой части головы человека",
 site:"Волосистая часть головы",
 sourceUrl:"https://www.histologyguide.org/slideview/MH-086b-scalp/11-slide-1.html",
 source:"University of Minnesota, Histology Guide, MH 086b",
 preparation:"Гематоксилин и эозин (H&E)",
 objective:"40×",micronsPerPixel:.3171,
 species:"Homo sapiens",siteVerified:true,usage:"external-viewer-only",
 notes:"Проверенный участок для изучения волоса и фолликула; изображения остаются на исходном сайте."}
] as const;
export const SKIN_CALIBRATED_EXTERNAL_REFERENCE=
 SKIN_CALIBRATED_EXTERNAL_REFERENCES[1];
