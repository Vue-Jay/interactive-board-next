import type {Item} from "./boardModel";

/** One shared board size for both faces and the entire deck, independent of
 * viewport, current viewer's card, and zoom. Keep manual sizing on unchanged
 * editor saves; only content changes trigger an automatic fit. */
export function fitLanguageFlashcardItem(item:Item,previous?:Item):Item {
  const d=item.schoolDiagram;
  if(item.graphFigureId!=="language-flashcards"||d?.kind!=="flashcards")return item;
  if(previous&&!(previous.width===810&&previous.height===450)&&JSON.stringify(previous.schoolDiagram)===JSON.stringify(d))return item;
  const length=(value:string)=>Array.from(value).reduce((n,c)=>n+(/\s/.test(c)?0.45:1),0);
  let longest=0,lines=1, extras=0;
  for(const card of d.cards){
    const primary=Math.max(length(card.term),length(card.translation));
    longest=Math.max(longest,primary);
    lines=Math.max(lines,Math.ceil(primary/26));
    const auxiliary=(d.showTranslation?Math.ceil(length(d.direction==="foreign-first"?card.translation:card.term)/45):0)+
      (d.showTranscription&&d.direction==="foreign-first"?Math.ceil(length(card.transcription)/45):0);
    extras=Math.max(extras,auxiliary);
  }
  const width=Math.ceil(Math.max(330,Math.min(760,100+longest*22)));
  const height=Math.max(238,Math.min(490,198+lines*40+extras*25));
  return {...item,width,height,x:item.x+(item.width-width)/2,y:item.y+(item.height-height)/2};
}
