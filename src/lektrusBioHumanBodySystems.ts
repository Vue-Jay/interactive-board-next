/** System-selector contract for the school human biomodel.
 * The three systems with reviewed deep paths reuse atlas node IDs.
 * Digestive and musculoskeletal illustrations are labelled as educational
 * reconstructions, never substituted with another organism's anatomy.
 */
export const HUMAN_BODY_SYSTEMS=[
 {id:"all",name:"Все системы",short:"Все",color:"#806eab",description:"Общий полупрозрачный обзор анатомии"},
 {id:"nervous",name:"Нервная",short:"Нервная",color:"#9573b6",description:"Головной мозг, спинной мозг и нервы"},
 {id:"respiratory",name:"Дыхательная",short:"Дыхательная",color:"#4f9db3",description:"Воздухоносные пути, бронхи и лёгкие"},
 {id:"circulatory",name:"Кровеносная",short:"Кровеносная",color:"#cb7387",description:"Сердце и сеть кровеносных сосудов"},
 {id:"digestive",name:"Пищеварительная",short:"Пищеварительная",color:"#c89a5f",description:"Пищевод, желудок, печень и кишечник"},
 {id:"musculoskeletal",name:"Опорно-двигательная",short:"Опорно-двигательная",color:"#7387af",description:"Кости, суставы и скелетные мышцы"}
] as const;
export type HumanBodySystem=typeof HUMAN_BODY_SYSTEMS[number]["id"];
export type HumanFocusedSystem=Exclude<HumanBodySystem,"all">;
export const HUMAN_BODY_SYSTEM_ANCHORS:Record<HumanFocusedSystem,{x:number;y:number}>={
 nervous:{x:485,y:62},
 respiratory:{x:484,y:178},
 circulatory:{x:483,y:194},
 digestive:{x:484,y:289},
 musculoskeletal:{x:486,y:348}
};
export const HUMAN_SYSTEM_REGION:Record<HumanFocusedSystem,
 "brain"|"lungs"|"heart"|"digestive"|"musculoskeletal">={
 nervous:"brain",respiratory:"lungs",circulatory:"heart",
 digestive:"digestive",musculoskeletal:"musculoskeletal"
};
export const humanSystemById=(id:HumanBodySystem)=>
 HUMAN_BODY_SYSTEMS.find(s=>s.id===id)??HUMAN_BODY_SYSTEMS[0];
export function humanSystemVisibility(selected:HumanBodySystem,
 drawn:HumanFocusedSystem):number{
 return selected==="all"?1:selected===drawn?1:0;
}
