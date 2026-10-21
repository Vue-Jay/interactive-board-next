/** Interactive classroom illustrations; classifications are teacher-editable school examples. */
export type BiologyExtensionId="bio-dna"|"bio-taxonomy";
export type TaxonomyGroup="animal"|"plant";
export type TaxonomyRank="kingdom"|"phylum"|"class"|"order"|"family"|"genus"|"species";
export type TaxonomyRow={rank:TaxonomyRank;name:string};
export type BiologyExtensionDiagram=
 |{kind:"dna";title:string;sequence:string;showComplement:boolean;showDirection:boolean}
 |{kind:"taxonomy";title:string;group:TaxonomyGroup;showRanks:boolean;rows:TaxonomyRow[]};

export const biologyExtensionIds:BiologyExtensionId[]=["bio-dna","bio-taxonomy"];
export const isBiologyExtensionId=(id:string|undefined):id is BiologyExtensionId=>
 biologyExtensionIds.includes(id as BiologyExtensionId);

export const taxonomyRanks:TaxonomyRank[]=["kingdom","phylum","class","order","family","genus","species"];
export const taxonomyRankLabels:Record<TaxonomyGroup,Record<TaxonomyRank,string>>={
 animal:{kingdom:"Царство",phylum:"Тип",class:"Класс",order:"Отряд",family:"Семейство",genus:"Род",species:"Вид"},
 plant:{kingdom:"Царство",phylum:"Отдел",class:"Класс",order:"Порядок",family:"Семейство",genus:"Род",species:"Вид"}
};
export const taxonomyExamples:Record<TaxonomyGroup,{title:string;names:string[]}>={
 animal:{title:"Классификация кошки домашней",names:[
  "Животные","Хордовые","Млекопитающие","Хищные","Кошачьи","Кошки (Felis)","Кошка домашняя"
 ]},
 plant:{title:"Классификация яблони домашней",names:[
  "Растения","Покрытосеменные","Двудольные","Розоцветные","Розовые","Яблоня","Яблоня домашняя"
 ]}
};
export function taxonomyExample(group:TaxonomyGroup):Extract<BiologyExtensionDiagram,{kind:"taxonomy"}>{
 const example=taxonomyExamples[group];
 return {kind:"taxonomy",title:example.title,group,showRanks:true,
  rows:taxonomyRanks.map((rank,i)=>({rank,name:example.names[i]}))};
}
export function dnaComplement(sequence:string):string{
 const pairs:Record<string,string>={A:"T",T:"A",G:"C",C:"G"};
 return [...sequence.toUpperCase()].map(base=>pairs[base]||"?").join("");
}
export function newBiologyExtension(id:BiologyExtensionId):BiologyExtensionDiagram{
 if(id==="bio-dna")return {kind:"dna",title:"Строение ДНК",sequence:"ATGCCGTA",
  showComplement:true,showDirection:true};
 return taxonomyExample("animal");
}
export function validateBiologyExtension(data:unknown):data is BiologyExtensionDiagram{
 if(!data||typeof data!=="object")return false;
 const d=data as Record<string,unknown>;
 if(typeof d.title!=="string"||!d.title.trim()||d.title.length>120)return false;
 if(d.kind==="dna")return typeof d.sequence==="string"&&
  /^[ATGC]{1,24}$/.test(d.sequence)&&
  typeof d.showComplement==="boolean"&&typeof d.showDirection==="boolean";
 if(d.kind==="taxonomy"){
  if((d.group!=="animal"&&d.group!=="plant")||typeof d.showRanks!=="boolean"||
   !Array.isArray(d.rows)||d.rows.length!==taxonomyRanks.length)return false;
  return d.rows.every((row:unknown,i:number)=>{
   if(!row||typeof row!=="object")return false;
   const r=row as Record<string,unknown>;
   return r.rank===taxonomyRanks[i]&&typeof r.name==="string"&&
    r.name.trim().length>0&&r.name.length<=70;
  });
 }
 return false;
}
