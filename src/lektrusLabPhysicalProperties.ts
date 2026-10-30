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
 meltingC?:number;boilingC?:number;decompositionC?:number;sublimationC?:number;
 behavior?:"decomposes"|"sublimes";note?:string;
};
/** Verified normal-pressure gas identities. They are NOT liquid reagent stocks:
 * a gas bottle must not enter the liquid boiling/evaporation simulation. */
export const LAB_GAS_FORMULAS:ReadonlySet<string>=new Set([
 "H2","O2","N2","CO","CO2","NH3","Cl2","SO2","NO2","H2S",
 "CH4","C2H4","C2H2","C2H6","C3H8","C4H10","C3H6"
]);
const physical:Record<string,LabThermalRecord>={
 // Additional solid phase boundaries from PubChem/CRC experimental data.
 // CuS: ~220°C decomposition; cannot be treated as congruent melting.
 // https://pubchem.ncbi.nlm.nih.gov/compound/165914
 CuS:{decompositionC:220,behavior:"decomposes"},
 // FeO (wustite) 1377°C melting in CRC; phase unstable in air.
 // https://pubchem.ncbi.nlm.nih.gov/compound/449809
 FeO:{meltingC:1377,note:"Кристаллический FeO; на воздухе окисляется."},
 // Hematite Fe2O3 ~1565°C from ICSC; not Fe3O4.
 // https://pubchem.ncbi.nlm.nih.gov/compound/518696
 Fe2O3:{meltingC:1565},
 // Pure Na2SO4: Merck measured anhydrous 884°C melting.
 // https://www.merckmillipore.com/MM/en/product/sigald/13464
 Na2SO4:{meltingC:884,note:"Безводный сульфат натрия, не декагидрат."},
 // Pure anhydrous K2CO3 Merck mp 891°C.
 // https://www.merckmillipore.com/SG/en/product/mm/104928
 K2CO3:{meltingC:891},
 // Pure gases, phase transitions at approximately 1 atm. OpenStax
 // University Physics Vol.2 §1.5 and NIST TN 2126:
 // https://openstax.org/books/university-physics-volume-2/pages/1-5-phase-changes
 // https://nvlpubs.nist.gov/nistpubs/TechnicalNotes/NIST.TN.2126.pdf
 H2:{meltingC:-259.3,boilingC:-252.9},
 O2:{meltingC:-218.8,boilingC:-183.0},
 N2:{meltingC:-210.0,boilingC:-195.8},
 CO:{meltingC:-205.0,boilingC:-191.5},
 NH3:{meltingC:-77.73,boilingC:-33.33},
 Cl2:{meltingC:-101.5,boilingC:-34.04},
 // NIST Chemistry WebBook SRD 69, phase-change measurements.
 // Values are normal-pressure temperatures in °C. Original tabulations in
 // kelvin are converted by T_C = T_K - 273.15, rounded to 0.1 °C.
 // CH4: 111.65 K boiling; fusion 90.68 K:
 // https://webbook.nist.gov/cgi/cbook.cgi?ID=C74828&Mask=4
 CH4:{meltingC:-182.5,boilingC:-161.5},
 // C2H6: 184.6 K boiling; fusion datasets disagree (89-101 K):
 // publish only the well-established normal boiling reference.
 // https://webbook.nist.gov/cgi/cbook.cgi?ID=C74840&Mask=4
 C2H6:{boilingC:-88.6},
 // C2H4: 169.35 K boiling; fusion 103.8 K:
 // https://webbook.nist.gov/cgi/cbook.cgi?ID=C74851&Mask=4
 C2H4:{meltingC:-169.4,boilingC:-103.8},
 // Propane: 231.1 K boiling, 85.5 K fusion:
 // https://webbook.nist.gov/cgi/cbook.cgi?ID=C74986&Mask=4
 C3H8:{meltingC:-187.7,boilingC:-42.1},
 // n-Butane ONLY (C4H10 can have structural isomers):
 // 273 K boiling and 136 K fusion (rounded reference means ~1 K error).
 // https://webbook.nist.gov/cgi/cbook.cgi?ID=C106978&Mask=4
 C4H10:{meltingC:-137.2,boilingC:-0.5,
  note:"Для н-бутана; изобутан имеет другие температурные характеристики."},
 // Propene: 225.6 K boiling; fusion 88.0 K:
 // https://webbook.nist.gov/cgi/cbook.cgi?ID=C115071&Mask=4
 C3H6:{meltingC:-185.2,boilingC:-47.6},
 // Acetylene triple-point pressure is 1.2745 bar, ABOVE atmospheric,
 // so liquid C2H2 does not have a 1-atm boiling point. Air Liquide:
 // https://encyclopedia.airliquide.com/acetylene
 C2H2:{sublimationC:-84.05,behavior:"sublimes",
  note:"При 1 атм ацетилен сублимирует; кипение жидкого ацетилена требует давления выше тройной точки."},
 // ILO/WHO ICSC 0074: SO2 pure melting -75.5, boiling -10 °C:
 // https://www.inchem.org/documents/icsc/icsc/eics0074.htm
 SO2:{meltingC:-75.5,boilingC:-10},
 // NIST SRD 69 H2S 190.85 K fusion, 212.87 K normal boiling:
 // https://webbook.nist.gov/cgi/cbook.cgi?ID=C7783064&Mask=4
 H2S:{meltingC:-82.3,boilingC:-60.3},
 // CO2 has NO normal boiling point at 1 atm: its liquid exists
 // above the triple-point pressure. PubChem CID 280 / NIOSH.
 // https://pubchem.ncbi.nlm.nih.gov/compound/280
 CO2:{sublimationC:-78.5,behavior:"sublimes",
  note:"При атмосферном давлении твёрдый CO₂ сублимирует, не кипит."},
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
 // Verified ANHYDROUS solids, ~101.3 kPa; do not transfer these to
 // prepared aqueous solutions. Experimental reference pages:
 // https://pubchem.ncbi.nlm.nih.gov/compound/24561 (AgCl)
 // https://pubchem.ncbi.nlm.nih.gov/compound/5235 (NaF)
 // https://pubchem.ncbi.nlm.nih.gov/compound/4875 (KI)
 // https://pubchem.ncbi.nlm.nih.gov/compound/253877 (KBr)
 // https://pubchem.ncbi.nlm.nih.gov/compound/3084026 (SrSO4)
 // https://pubchem.ncbi.nlm.nih.gov/compound/24507 (K2SO4)
 // PubChem / CRC, pure ANHYDROUS crystals at ordinary pressure.
 // LiCl 610 °C melting; sources disagree on high-T boiling, omit it:
 // https://pubchem.ncbi.nlm.nih.gov/compound/433294
 LiCl:{meltingC:610,note:"Температура для безводного хлорида лития, не гидрата."},
 // NaBr 755 °C (Merck) / 747 °C (DOE PAC); selected Merck datum:
 // https://pubchem.ncbi.nlm.nih.gov/compound/253881
 NaBr:{meltingC:755,boilingC:1390},
 // AgI 552 °C (Merck) and 1506 °C boiling (CRC):
 // https://pubchem.ncbi.nlm.nih.gov/compound/24563
 AgI:{meltingC:552,boilingC:1506},
 // Barium nitrate near 590 °C melts and decomposes when heated; no
 // stable normal-pressure boiling point should ever be fabricated.
 // https://pubchem.ncbi.nlm.nih.gov/compound/24798
 "Ba(NO3)2":{meltingC:590,decompositionC:590,behavior:"decomposes",
  note:"Нитрат бария при сильном нагревании разлагается; это не кипение."},
 AgCl:{meltingC:455,boilingC:1547},
 NaF:{meltingC:993,boilingC:1700},
 KI:{meltingC:681},
 KBr:{meltingC:734},
 SrSO4:{meltingC:1605},
 K2SO4:{meltingC:1067},
 // https://pubchem.ncbi.nlm.nih.gov/compound/24502 (K2Cr2O7)
 // https://pubchem.ncbi.nlm.nih.gov/compound/516875 (KMnO4)
 K2Cr2O7:{meltingC:398,decompositionC:500,behavior:"decomposes"},
 KMnO4:{decompositionC:240,behavior:"decomposes"},
 // https://pubchem.ncbi.nlm.nih.gov/compound/9989226 (alpha-Al2O3)
 Al2O3:{meltingC:2072,boilingC:2977},
 // https://pubchem.ncbi.nlm.nih.gov/compound/177 (pure ethanal)
 CH3CHO:{meltingC:-123.4,boilingC:20.8,
  note:"Чистый этаналь кипит около комнатной температуры; это не температура кипения раствора."},
 // FeCl2 pure anhydrous crystal melts near 674 C; air oxidation can
 // interfere in practice (PubChem CID 24458 / Merck Index).
 // https://pubchem.ncbi.nlm.nih.gov/compound/24458
 FeCl2:{meltingC:674,note:"Безводный хлорид железа(II); на воздухе возможны окисление и гидролиз."},
 // Further SPECIFIC pure solid forms from PubChem experimental records.
 // No phase-transition numbers are inherited by water solutions or hydrates.
 // MgCl2 (anhydrous) melts at ~714 C, PubChem CID 5360315 / DOE PAC:
 // https://pubchem.ncbi.nlm.nih.gov/compound/5360315
 MgCl2:{meltingC:714,note:"Безводный MgCl₂; гидраты при нагревании ведут себя иначе."},
 // alpha-PbO (litharge), CRC, ~887 C melt and ~1472 C boil:
 // https://pubchem.ncbi.nlm.nih.gov/compound/14827
 PbO:{meltingC:887,boilingC:1472,
  note:"Параметры α-PbO; β-PbO представляет другую кристаллическую фазу."},
 // Anhydrous AlCl3 sublimes at normal pressure, rather than melting:
 // https://pubchem.ncbi.nlm.nih.gov/compound/24012
 AlCl3:{sublimationC:178,behavior:"sublimes",
  note:"Безводный AlCl₃ при атмосферном давлении сублимирует; плавление ~190 °C требует повышенного давления."},
 // FeS ~1194 C measured high-temperature fusion, PubChem CID 14828:
 // https://pubchem.ncbi.nlm.nih.gov/compound/14828
 FeS:{meltingC:1194},
 // Strontianite (SrCO3) decomposes near 1100 C, not a normal boiling:
 // https://pubchem.ncbi.nlm.nih.gov/compound/15407
 SrCO3:{decompositionC:1100,behavior:"decomposes"},
 // MnO2 decomposes near 535 C; does not form a stable simple melt:
 // https://pubchem.ncbi.nlm.nih.gov/compound/14801
 MnO2:{decompositionC:535,behavior:"decomposes"},
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
const pureLiquids=new Set(["H2O","C2H5OH","CH3OH","C3H8O","Br2","CH3CHO"]);
/** A measured ml of a stock acid or a salt solution is not the neat compound.
 * Formula alone does not specify its solvent ratio or boiling range. */
export function labThermalInfo(id:string,unit:"ml"|"g"):LabThermalRecord&{
 known:boolean;form:"pure"|"solution"|"gas"|"unverified";description:string
}{
 if(unit==="ml"&&LAB_GAS_FORMULAS.has(id)){
  const data=physical[id];
  return {...data,known:!!data,form:"gas" as const,
   description:data?.note??(data?
    "Температуры относятся к чистому газу при атмосферном давлении; баллон не считается жидкостью.":
    "Газовая проба: проверенные температуры фазовых переходов пока не заданы.")};
 }
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
