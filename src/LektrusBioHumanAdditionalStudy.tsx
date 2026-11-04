/** A same-source anatomy close-up for systems without a verified
 * histology chain. Never substitute a skin cell, feline tissue or unrelated
 * organ just to fill every depth. The world camera remains unchanged.
 */
import {memo,useId} from "react";
import {HUMAN_ADDITIONAL_DRAWINGS} from "./LektrusBioHumanAdditionalSystems";

export type HumanAdditionalSystem=keyof typeof HUMAN_ADDITIONAL_DRAWINGS;
type System=HumanAdditionalSystem;
const views:Record<System,{x:number;y:number;width:number;height:number;name:string;organ:string}>={
 skeletal:{x:180,y:261,width:210,height:290,name:"Скелетная система",organ:"Грудная клетка и позвоночник"},
 muscular:{x:180,y:284,width:210,height:295,name:"Мышечная система",organ:"Скелетные мышцы туловища"},
 urinary:{x:180,y:421,width:139,height:235,name:"Мочевыделительная система",organ:"Почки, мочеточники и мочевой пузырь"},
 lymphatic:{x:180,y:271,width:180,height:295,name:"Лимфатическая система",organ:"Лимфатические пути и узлы"},
 endocrine:{x:180,y:251,width:180,height:310,name:"Эндокринная система",organ:"Железы внутренней секреции"},
 integumentary:{x:180,y:278,width:190,height:360,name:"Покровная система",organ:"Кожа и её производные"},
 sensory:{x:180,y:104,width:145,height:180,name:"Органы чувств",organ:"Зрение, слух, обоняние и вкус"}
};
function LektrusBioHumanAdditionalStudy({system,level}:{system:System;level:number}){
 const view=views[system],Drawing=HUMAN_ADDITIONAL_DRAWINGS[system];
 const gradient="human-anatomy-detail-"+useId().replace(/:/g,"");
 const factor=level>=3 ? 0.6 : level===2 ? 0.82 : 1;
 const w=view.width*factor,h=view.height*factor;
 return <svg className="lektrus-human-study-svg" viewBox="0 0 480 330"
  role="img" aria-label={view.name+": "+view.organ}>
  <defs>
   <linearGradient id={gradient} x1="0" y1="0" x2=".9" y2="1">
    <stop stopColor="#f9fbff"/><stop offset="1" stopColor="#f1eff9"/>
   </linearGradient>
  </defs>
  <rect width="480" height="330" rx="19" fill={"url(#"+gradient+")"}/>
  <rect x="22" y="43" width="436" height="233" rx="16"
   fill="#ffffffc8" stroke="#dfdaeb"/>
  <svg x="80" y="49" width="320" height="223"
   viewBox={(view.x-w/2)+" "+(view.y-h/2)+" "+w+" "+h}
   preserveAspectRatio="xMidYMid meet" overflow="hidden">
   <Drawing/>
  </svg>
  <text x="240" y="29" textAnchor="middle" fill="#655479"
   fontSize="15" fontWeight="800">{view.name}</text>
  <text x="240" y="298" textAnchor="middle" fill="#786a8a"
   fontSize="12" fontWeight="700">{view.organ}</text>
  {level>=3&&<text x="240" y="318" textAnchor="middle" fill="#968a9e"
   fontSize="10">Анатомическое приближение · гистология уточняется</text>}
 </svg>;
}
export default memo(LektrusBioHumanAdditionalStudy);
