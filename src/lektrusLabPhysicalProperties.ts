/** Phase data for the VIRTUAL lab. Temperatures are indicative °C at ~101.3 kPa.
 * Do not assign an arbitrary boiling/melting point to a mixture, hydrate,
 * decomposing compound or unverified entry.
 * References: NIST Chemistry WebBook (https://webbook.nist.gov/),
 * RSC Periodic Table (https://periodic-table.rsc.org/),
 * PubChem (https://pubchem.ncbi.nlm.nih.gov/), NCBI ATSDR nitrate table
 * (https://www.ncbi.nlm.nih.gov/books/NBK592481/table/ch4.tab4/).
 * A value only means it was individually curated, NOT an exhaustive dataset.
 */
export type LabThermalRecord={
 meltingC?:number;boilingC?:number;decompositionC?:number;
 behavior?:"decomposes"|"sublimes";note?:string;
};
const physical:Record<string,LabThermalRecord>={
 H2O:{meltingC:0,boilingC:100},
 C2H5OH:{meltingC:-114.1,boilingC:78.37},
 CH3OH:{meltingC:-97.6,boilingC:64.7},
 C3H8O:{meltingC:-89.5,boilingC:82.6},
 Br2:{meltingC:-7.2,boilingC:58.8},
 I2:{meltingC:113.7,boilingC:184.3,behavior:"sublimes",
  note:"При обычных условиях заметно возгоняется ещё до плавления."},
 S:{meltingC:115.21,boilingC:444.6},
 Na:{meltingC:97.79,boilingC:882.9},
 K:{meltingC:63.38,boilingC:759},
 Li:{meltingC:180.5,boilingC:1342},
 Ca:{meltingC:842,boilingC:1484},
 Mg:{meltingC:650,boilingC:1091},
 Al:{meltingC:660.3,boilingC:2519},
 Zn:{meltingC:419.5,boilingC:907},
 Fe:{meltingC:1538,boilingC:2862},
 Cu:{meltingC:1084.6,boilingC:2562},
 Ag:{meltingC:961.8,boilingC:2162},
 Au:{meltingC:1064.2,boilingC:2856},
 Si:{meltingC:1414,boilingC:3265},
 NaCl:{meltingC:800.7,boilingC:1465},
 KCl:{meltingC:770,boilingC:1420},
 // Individually reviewed pure ANHYDROUS compounds, NOT water solutions.
 // PubChem 24459: PbCl2 501/950°C (melting/boiling).
 // https://pubchem.ncbi.nlm.nih.gov/compound/24459
 PbCl2:{meltingC:501,boilingC:950},
 // ATSDR Table 4-2: PbBr2 371/892°C (pure salt).
 // https://www.ncbi.nlm.nih.gov/books/NBK589540/table/ch4.tab2/
 PbBr2:{meltingC:371,boilingC:892},
 // ATSDR Barium Table 4-2: anhydrous BaCl2 962/1560°C.
 // https://www.atsdr.cdc.gov/ToxProfiles/tp24-c4.pdf
 BaCl2:{meltingC:962,boilingC:1560},
 // ILO/WHO ICSC 1184: anhydrous CaCl2 melts at 772°C;
 // avoid disputed boiling point and hydration-phase assumptions.
 // https://www.inchem.org/documents/icsc/icsc/eics1184.htm
 CaCl2:{meltingC:772,
  note:"Только безводный хлорид кальция; гидраты плавятся иначе."},
 // ATSDR table: PbSO4, anhydrous crystal, 1170°C.
 // https://www.ncbi.nlm.nih.gov/books/NBK589540/
 PbSO4:{meltingC:1170},
 // NCBI Toxicological Profile for Copper: CuO thermal decomposition.
 // https://www.ncbi.nlm.nih.gov/books/NBK610366/
 CuO:{decompositionC:1026,behavior:"decomposes",
  note:"Оксид меди(II) при сильном нагревании разлагается; это не кипение."},
 NaOH:{meltingC:318,boilingC:1388},
 KOH:{meltingC:360,boilingC:1327},
 LiOH:{meltingC:462,boilingC:924},
 AgNO3:{meltingC:212,decompositionC:440,behavior:"decomposes"},
 NaNO3:{meltingC:308,decompositionC:380,behavior:"decomposes"},
 KNO3:{meltingC:334,decompositionC:400,behavior:"decomposes"},
 NH4NO3:{meltingC:169.7,decompositionC:210,behavior:"decomposes",
  note:"Разложение зависит от условий; точная температура не универсальна."},
 NaNO2:{meltingC:271,decompositionC:320,behavior:"decomposes"},
 KNO2:{meltingC:440,decompositionC:537,behavior:"decomposes"},
 C12H22O11:{decompositionC:185.5,behavior:"decomposes",
  note:"При нагревании разлагается/карамелизуется; нормальной температуры кипения нет."},
 C6H12O6:{decompositionC:146,behavior:"decomposes",
  note:"При нагревании разлагается; не представлять как устойчивый расплав."},
 CaCO3:{decompositionC:825,behavior:"decomposes",
  note:"Разложение зависит от парциального давления CO₂; не обычное кипение."},
 NaHCO3:{decompositionC:80,behavior:"decomposes",
  note:"Начало термического разложения зависит от условий."},
 "Cu(OH)2":{decompositionC:80,behavior:"decomposes"},
 "Fe(OH)3":{decompositionC:100,behavior:"decomposes"},
 "Mg(OH)2":{decompositionC:350,behavior:"decomposes"}
};
const pureLiquids=new Set(["H2O","C2H5OH","CH3OH","C3H8O","Br2"]);
/** A measured ml of a stock acid or a salt solution is not the neat compound.
 * Formula alone does not specify its solvent ratio or boiling range. */
export function labThermalInfo(id:string,unit:"ml"|"g"):LabThermalRecord&{
 known:boolean;form:"pure"|"solution"|"gas"|"unverified";description:string
}{
 if(unit==="ml"&&!pureLiquids.has(id))return{
  known:false,form:"solution",
  description:"Раствор или газовая проба: температуры фазовых переходов зависят от состава, концентрации и давления; числовое значение не задано."
 };
 const data=physical[id];
 if(!data)return {known:false,form:"unverified",
  description:"Для этой формы нет проверенных температур в справочнике. Плавление и кипение не моделируются."};
 return {...data,known:true,form:"pure",
  description:data.note??(data.behavior==="decomposes"?
   "Нагрев выше температуры разложения не равен кипению.":
   data.behavior==="sublimes"?"Возможно возгоняние до образования расплава.":
   "Переходы указаны для чистого вещества при нормальном давлении.")};
}
export function labVesselThermal(reagents:readonly string[],doses?:Record<string,{
 value:number;unit:"g"|"ml";concentrationM?:number}>){
 if(reagents.length!==1)return null;
 const id=reagents[0],dose=doses?.[id];
 if(!dose||dose.value<=0||dose.concentrationM!==undefined)return null;
 const info=labThermalInfo(id,dose.unit);
 return info.form==="pure"?{id,unit:dose.unit,info}:null;
}
export function labThermalState(
 reagents:readonly string[],doses:Record<string,{value:number;unit:"g"|"ml";concentrationM?:number}>|undefined,
 temperatureC:number,meltFraction=0
){
 const pure=labVesselThermal(reagents,doses);
 if(!pure)return {label:"Смесь / форма не установлена",boiling:false,molten:false,freezing:false};
 const {info,unit}=pure;
 const boiling=unit==="ml"&&info.boilingC!==undefined&&temperatureC>=info.boilingC-.5;
 const molten=unit==="g"&&info.meltingC!==undefined&&meltFraction>=.995;
 const freezing=unit==="g"&&info.meltingC!==undefined&&meltFraction>0&&meltFraction<.995;
 const label=unit==="g"?(molten?"Расплав":freezing?"Плавление / кристаллизация":"Твёрдое"):
  boiling?"Кипение":"Жидкость";
 return {label,boiling,molten,freezing};
}
export const LAB_THERMAL_REFERENCE=physical;
