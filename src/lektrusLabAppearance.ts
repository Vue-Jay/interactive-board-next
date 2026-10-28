import {substances,type ReactionEnvironment} from "./lektrusReactionDatabase";

export type ReagentAppearance={color:string;phase:"solution"|"solid"|"metal"|"gas";label:string};
/** Representative appearances for classroom visualisation, not concentration-specific
 * spectral data. Unknown solutions remain transparent rather than inventing a dye. */
const vivid:Record<string,{solution?:string;solid?:string;label:string}>={
 "CuSO4":{solution:"#61a9d3",solid:"#337eb9",label:"Голубой раствор; синие кристаллы пентагидрата"},
 "CuCl2":{solution:"#73bb9f",solid:"#66a17b",label:"Зелёно-голубой раствор"},
 "Cu(NO3)2":{solution:"#79b6dc",solid:"#477dad",label:"Голубой раствор"},
 "FeSO4":{solution:"#abc99d",solid:"#a2c59a",label:"Бледно-зелёный раствор"},
 "FeCl2":{solution:"#bfd9ad",solid:"#a9c49a",label:"Бледно-зелёный раствор"},
 "FeCl3":{solution:"#e1b66d",solid:"#9b794c",label:"Жёлто-бурый раствор"},
 "Fe2(SO4)3":{solution:"#e8c68c",solid:"#dbc08d",label:"Желтоватый раствор"},
 "KMnO4":{solution:"#9853bb",solid:"#633068",label:"Фиолетовый раствор, тёмные кристаллы"},
 "K2Cr2O7":{solution:"#e7a04c",solid:"#d7782b",label:"Оранжевый раствор и кристаллы"},
 "Fe(OH)2":{solid:"#92aa80",label:"Зеленоватый осадок"},
 "Fe(OH)3":{solid:"#a85c38",label:"Бурый осадок"},
 "CuO":{solid:"#242c35",label:"Чёрный порошок"},
 "FeO":{solid:"#333b41",label:"Чёрный порошок"},
 "Fe2O3":{solid:"#ad583c",label:"Красно-бурый порошок"},
 "MnO2":{solid:"#343538",label:"Тёмно-бурый порошок"},
 "PbI2":{solid:"#e9d03c",label:"Ярко-жёлтый осадок"},
 "AgCl":{solid:"#f2f0ea",label:"Белый осадок"},
 "CuS":{solid:"#242c2c",label:"Чёрный осадок"},
 "FeS":{solid:"#323735",label:"Тёмный сульфид"},
 "Pb(NO3)2":{solid:"#f2f0ed",label:"Белые кристаллы; раствор бесцветен"},
 "I2":{solution:"#bd9965",solid:"#4c354b",label:"Буроватая водная окраска; тёмные кристаллы"},
 "Br2":{solution:"#a85d37",solid:"#9f4d29",label:"Красно-бурый бром"},
 "Cl2":{solution:"#d7d89a",label:"Желтовато-зелёный газ"},
 "NO2":{solution:"#b56c42",label:"Бурый газ"},
 "S":{solid:"#e0ca54",label:"Жёлтая сера"},
 "C":{solid:"#393a39",label:"Чёрный углерод (графит)"},
 "P":{solid:"#a94745",label:"Красный фосфор (школьная модель)"},
 "Cu":{solid:"#b66d48",label:"Медно-красный металл"},
 "Fe":{solid:"#818b91",label:"Серый металл"},
 "Zn":{solid:"#abb5bb",label:"Серебристый металл"},
 "Mg":{solid:"#bbc7ce",label:"Серебристый металл"},
 "Al":{solid:"#bbc6cc",label:"Серебристый металл"},
 "Ca":{solid:"#b7b8ad",label:"Серебристо-серый металл"},
 "Na":{solid:"#c4c5b8",label:"Серебристый металл"},
 "K":{solid:"#c3c2b6",label:"Серебристый металл"},
 "Ag":{solid:"#c5d0d6",label:"Серебристый металл"},
 "Au":{solid:"#d7b258",label:"Золотистый металл"},
 "CuCO3":{solid:"#78af8c",label:"Зелёный карбонат (упрощённая модель)"},
 "Cu(OH)2":{solid:"#77bce0",label:"Голубой осадок"},
 "AgI":{solid:"#e5d05b",label:"Жёлтый осадок"},
 "AgBr":{solid:"#e1d4a4",label:"Кремовый осадок"}
};
const insoluble=new Set(["AgCl","BaSO4","CaCO3","MgCO3","BaCO3","CuCO3",
 "FeS","CuS","Fe(OH)2","Fe(OH)3","Cu(OH)2","Zn(OH)2","Al(OH)3",
 "Mg(OH)2","Ca3(PO4)2","PbI2","AgBr","AgI","PbSO4","PbCl2"]);
export function reagentAppearance(id:string,environment:ReactionEnvironment="aqueous"):ReagentAppearance{
 const substance=substances.find(s=>s.id===id);
 const record=vivid[id];
 const kind=substance?.kind??"";
 const dry=environment==="dry";
 const solid=dry||insoluble.has(id)||["оксид","металл","неметалл","простое вещество"].includes(kind);
 const gas=kind==="газ";
 const phase=gas?"gas":kind==="металл"?"metal":solid?"solid":"solution";
 const color=solid?(record?.solid??(kind==="оксид"?"#dededa":"#e9e7df")):
  (record?.solution??(gas?"#e9f0e2":"#e4f1f2"));
 const label=record?.label??(gas?"Газ (условная окраска)":
  solid?"Светлое твёрдое вещество, схематично":"Бесцветный раствор при обычных условиях, схематично");
 return {color,phase,label};
}
export const reagentAppearanceCount=substances.length;
