import type {Item} from "./boardModel";
import {getGeoCountry,type GeoTrainingDiagram} from "./lektrusGeographyTrainingModel";

/** Stable preferred width, independent of the viewer's window size or board zoom. */
export function geoMatchingPreferredWidth(diagram:GeoTrainingDiagram):number{
 const widths={left:174,right:174};
 const relation=diagram.relation;
 for(const code of diagram.countryCodes){
  const country=getGeoCountry(code);
  if(!country)continue;
  const a=relation==="country-capital"?country.name:relation==="flag-country"?"":""; 
  const b=relation==="country-capital"?country.capital:country.name;
  const values=diagram.reverse?[b,a]:[a,b];
  for(const [i,value] of values.entries()){
   const visual=relation==="outline-country"&&((diagram.reverse&&i===1)||(!diagram.reverse&&i===0))?180:
    relation==="flag-country"&&((diagram.reverse&&i===1)||(!diagram.reverse&&i===0))?156:0;
   const textWidth=42+Array.from(value).reduce((total,ch)=>total+(ch===" "?4:ch==="—"?10:8.4),0);
   const preferred=Math.min(355,Math.max(visual,textWidth));
   if(i===0)widths.left=Math.max(widths.left,preferred);
   else widths.right=Math.max(widths.right,preferred);
  }
 }
 // Leave room for completion marks, headers and the full interaction panel.
 return Math.ceil(Math.max(460,Math.min(835,widths.left+widths.right+66)));
}

/** Initial estimate; the mounted exercise refines height from actual content. */
export function geoMatchingEstimatedHeight(diagram:GeoTrainingDiagram):number{
 const row=diagram.relation==="outline-country"?83:diagram.relation==="flag-country"?59:57;
 return Math.max(260,Math.ceil(145+diagram.countryCodes.length*(row+8)));
}

/** Centre the fitted exercise without changing any other board object. */
export function fitGeoMatchingItem(item:Item):Item{
 const diagram=item.schoolDiagram;
 if(item.graphFigureId!=="geo-matching"||diagram?.kind!=="geo-training"||diagram.exercise!=="matching")return item;
 const width=geoMatchingPreferredWidth(diagram),height=geoMatchingEstimatedHeight(diagram);
 if(item.width===width&&item.height===height)return item;
 return {...item,x:item.x+(item.width-width)/2,y:item.y+(item.height-height)/2,width,height};
}
