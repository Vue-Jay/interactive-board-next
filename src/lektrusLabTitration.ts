/** Explicit strong, monovalent acid/base titration for teaching.
 * Concentrations are user supplied, never guessed from the general reaction database.
 * All pH values are idealised at 25°C, with activity effects ignored. */
export type TitrationAcid="HCl"|"HNO3"|"HBr";
export type TitrationBase="NaOH"|"KOH";
export type TitrationIndicator="phenolphthalein"|"methyl-orange"|"litmus"|"universal";
export type TitrationModel={
 acid:TitrationAcid;base:TitrationBase;
 analyte:"acid"|"base";
 concentrationAnalyte:number;concentrationTitrant:number;
 volumeAnalyteMl:number;addedMl:number;
 indicator:TitrationIndicator;
};
export const defaultTitration=():TitrationModel=>({
 acid:"HCl",base:"NaOH",analyte:"acid",
 concentrationAnalyte:0.1,concentrationTitrant:0.1,
 volumeAnalyteMl:25,addedMl:0,indicator:"phenolphthalein"
});
export function validTitration(v:unknown):v is TitrationModel{
 if(!v||typeof v!=="object")return false;
 const t=v as TitrationModel;
 return ["HCl","HNO3","HBr"].includes(t.acid)&&["NaOH","KOH"].includes(t.base)&&
  ["acid","base"].includes(t.analyte)&&
  ["phenolphthalein","methyl-orange","litmus","universal"].includes(t.indicator)&&
  Number.isFinite(t.volumeAnalyteMl)&&t.volumeAnalyteMl>=1&&t.volumeAnalyteMl<=100&&
  Number.isFinite(t.concentrationAnalyte)&&t.concentrationAnalyte>=.001&&t.concentrationAnalyte<=2&&
  Number.isFinite(t.concentrationTitrant)&&t.concentrationTitrant>=.001&&t.concentrationTitrant<=2&&
  Number.isFinite(t.addedMl)&&t.addedMl>=0&&t.addedMl<=100;
}
export function titrationReading(t:TitrationModel){
 const initialMoles=t.volumeAnalyteMl*t.concentrationAnalyte/1000;
 const addedMoles=t.addedMl*t.concentrationTitrant/1000;
 const excess=t.analyte==="acid"?initialMoles-addedMoles:addedMoles-initialMoles;
 const denominator=(t.volumeAnalyteMl+t.addedMl)/1000;
 const eqVolume=t.volumeAnalyteMl*t.concentrationAnalyte/t.concentrationTitrant;
 // Concentration of excess H+ or OH-, limited to conventional pH 0..14.
 const pH=Math.max(0,Math.min(14,Math.abs(excess)<1e-11?7:
  excess>0?-Math.log10(excess/denominator):
  14+Math.log10(-excess/denominator)));
 const tint=t.indicator==="phenolphthalein"?(pH<8.2?"#dcecef":pH<10?"#f0a4ce":"#d9489e"):
  t.indicator==="methyl-orange"?(pH<3.1?"#d95c50":pH<=4.4?"#edab65":"#ebd477"):
  t.indicator==="litmus"?(pH<4.5?"#cf6678":pH>8.3?"#537cca":"#958ac0"):
  pH<3?"#e45650":pH<6?"#eabf5d":pH<8?"#73b677":pH<11?"#68a5bf":"#8065bd";
 const phase=Math.abs(excess)<1e-11?"equivalence":excess>0?"acidic":"alkaline";
 return {pH:Math.round(pH*100)/100,
  endPointMl:Math.round(eqVolume*100)/100,
  remainingMl:Math.max(0,Math.round((100-t.addedMl)*100)/100),
  tint,phase,complete:t.addedMl>=eqVolume};
}
export function addTitrant(t:TitrationModel,amountMl:number):TitrationModel{
 if(!Number.isFinite(amountMl)||amountMl<=0||!validTitration(t))return t;
 const volume=Math.min(100,Math.round((t.addedMl+amountMl)*100)/100);
 return volume===t.addedMl?t:{...t,addedMl:volume};
}
export function resetTitration(t:TitrationModel):TitrationModel{return {...t,addedMl:0}}
export function updateTitration(t:TitrationModel,changes:Partial<TitrationModel>):TitrationModel{
 const next={...t,...changes,addedMl:0};
 return validTitration(next)?next:t;
}
export function titrationEquation(t:TitrationModel){
 const salt=({HCl:{NaOH:"NaCl",KOH:"KCl"},HNO3:{NaOH:"NaNO3",KOH:"KNO3"},
  HBr:{NaOH:"NaBr",KOH:"KBr"}} as Record<TitrationAcid,Record<TitrationBase,string>>)[t.acid][t.base];
 return `${t.acid} + ${t.base} → ${salt} + H2O`;
}
