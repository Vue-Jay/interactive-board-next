/** Seven independently selectable human anatomy illustrations.
 * "all" is the organism overview, not an eighth organ system.
 * These identifiers are kept stable for saved diagrams and assignments.
 */
export const HUMAN_BODY_SYSTEMS=[
 {id:"nervous",name:"Нервная",short:"Нервная",color:"#9573b6",description:"Головной и спинной мозг, периферические нервы"},
 {id:"respiratory",name:"Дыхательная",short:"Дыхательная",color:"#4f9db3",description:"Дыхательные пути, бронхи и лёгкие"},
 {id:"circulatory",name:"Кровеносная",short:"Кровеносная",color:"#cb7387",description:"Сердце, артерии и вены"},
 {id:"digestive",name:"Пищеварительная",short:"Пищеварительная",color:"#c89a5f",description:"Пищевод, желудок, печень и кишечник"},
 {id:"urinary",name:"Мочевыделительная",short:"Мочевыделительная",color:"#b98f65",description:"Почки, мочеточники и мочевой пузырь"},
 {id:"musculoskeletal",name:"Опорно-двигательная",short:"Опорно-двигательная",color:"#7387af",description:"Скелет, суставы и скелетная мускулатура"},
 {id:"integumentary",name:"Покровная",short:"Покровная",color:"#ca9c82",description:"Кожа и её производные"}
] as const;
export type HumanFocusedSystem=typeof HUMAN_BODY_SYSTEMS[number]["id"];
export type HumanBodySystem=HumanFocusedSystem|"all";
export const HUMAN_BODY_SYSTEM_ANCHORS:Record<HumanFocusedSystem,{x:number;y:number}>={
 nervous:{x:485,y:62},
 respiratory:{x:484,y:178},
 circulatory:{x:483,y:194},
 digestive:{x:484,y:289},
 urinary:{x:485,y:301},
 musculoskeletal:{x:486,y:348},
 integumentary:{x:485,y:255}
};
export const HUMAN_SYSTEM_REGION:Record<HumanFocusedSystem,
 "brain"|"lungs"|"heart"|"digestive"|"musculoskeletal"|"urinary"|"integumentary">={
 nervous:"brain",respiratory:"lungs",circulatory:"heart",
 digestive:"digestive",urinary:"urinary",
 musculoskeletal:"musculoskeletal",integumentary:"integumentary"
};
export const humanSystemById=(id:HumanBodySystem)=>
 HUMAN_BODY_SYSTEMS.find(s=>s.id===id)??HUMAN_BODY_SYSTEMS[0];
export function humanSystemVisibility(selected:HumanBodySystem,
 drawn:HumanFocusedSystem):number{
 return selected==="all"?1:selected===drawn?1:0;
}
