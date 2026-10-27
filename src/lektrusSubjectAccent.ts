import type {Item} from "./boardModel";

/** Shared, restrained colors for subject-specific on-board objects. */
export type SubjectTone=
 "chemistry"|"physics"|"mathematics"|"geography"|"history"|
 "biology"|"russian"|"literature"|"social"|"languages"|"informatics";

export const subjectAccentPalette:Record<SubjectTone,{accent:string;soft:string;label:string}>={
 chemistry:{accent:"#1e766a",soft:"#e0f2e8",label:"Химия"},
 physics:{accent:"#386fae",soft:"#e8f1fc",label:"Физика"},
 mathematics:{accent:"#605bb6",soft:"#efedfb",label:"Математика"},
 geography:{accent:"#288998",soft:"#e4f4f5",label:"География"},
 history:{accent:"#a16f38",soft:"#f9f0df",label:"История"},
 biology:{accent:"#52823e",soft:"#eef5e5",label:"Биология"},
 russian:{accent:"#a34d6c",soft:"#f9e9ef",label:"Русский язык"},
 literature:{accent:"#aa6177",soft:"#faebef",label:"Литература"},
 social:{accent:"#83714f",soft:"#f5f0e2",label:"Обществознание"},
 languages:{accent:"#775cb4",soft:"#f0eafb",label:"Иностранный язык"},
 informatics:{accent:"#496b9b",soft:"#e9eff9",label:"Информатика"}
};
export function subjectToneForItem(item:Item):SubjectTone|undefined{
 if(item.kind!=="graph")return undefined;
 const id=item.graphFigureId??"";
 if(id.startsWith("chem-"))return "chemistry";
 if(id.startsWith("physics-")||item.scienceMechanics||item.scienceOptics||item.scienceCircuit)return "physics";
 if(id.startsWith("history-"))return "history";
 if(/^(geo-|maps-|contour-)/.test(id))return "geography";
 if(id.startsWith("bio-"))return "biology";
 if(id.startsWith("ru-"))return "russian";
 if(id.startsWith("literature-"))return "literature";
 if(id.startsWith("civics-"))return "social";
 if(/^(language-|foreign-)/.test(id))return "languages";
 if(id.startsWith("info-"))return "informatics";
 if(item.graphPurpose||id==="lektrus-chart"||id==="")return "mathematics";
 return undefined;
}
