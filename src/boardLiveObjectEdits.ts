import type {Item} from "./boardModel";
import {editorDiff,type LiveEditorOp} from "./lektrusLiveEditorMerge";

// Visual edits never grant durable write permission or replace object identity,
// ownership, private assets, ink, or the lab's generation-checked delta stream.
const fields=new Set<string>(["text","x","y","width","height","rotation","color","weight","fontSize","textAlign","fontWeight","fontStyle","textDecoration","textList","lineHeight","shapeType","instrumentScale","imageCrop","imageSourceAspect","pdfPage","connectorStart","connectorEnd","connectorStyle","arrowHeadStyle","arrowHeadSize","connectorRouting","connectorStartBinding","connectorEndBinding","tableRows","tableCols","tableCells","tableHeader","tableAlign","tableStripe","tableCompact","graphPurpose","graphFigureId","chartStyle","chartEntries","scienceCircuit","scienceOptics","scienceMechanics","scienceAtomModel","sciencePeriodicHighlights","sciencePeriodicShowNames","sciencePeriodicLayout","scienceExperimentStage","scienceOrganicAnnotations","scienceOrganicShowSystematic","scienceOrganicShowTrivial","scienceReactionConditions","scienceReactionDomain","scienceReactionSteps","subjectBoardEntries","subjectBoardStandalone","scienceReagents","scienceEnvironment","schoolDiagram","graphRotationX","graphRotationY","graphParallelMarks","fractionMode","fractionNumerator","fractionDenominator","graphAxisMode","graphIntervalStartClosed","graphIntervalEndClosed","graphType","graphExpression","graphConnectPoints","graphA","graphB","graphC","graphXMin","graphXMax","graphYMin","graphYMax","graphGrid","graphPoints","graphShowLabels","graphSegments","graphAngles","graphCircles","graphPolygons","graphTriangleLines","graphTriangleVertex","graphShowArea","graphGivenSides","graphGivenAngles","graphTriangleInputMode","graphMidpoints","graphConstraints","graphMagneticSnap","graphFreePathStart","graphSnap","graphAxisLabels","graphAxisLabelScale","graphAxisLabelStep","graphGridStep","graphShowCurve","graphProjections","resolved","commentTargetId","presentationOrder","notes","checklistItems","checklistDone","quizOptions","quizCorrect","quizSelected","quizRevealed","quizExplanation","flashcardBack","flashcardFlipped","flashcardMastery","coverOpen","coverOpacity","mediaTitle"]);
export function isLiveBoardObjectField(field:unknown):field is string{
 return typeof field==="string"&&fields.has(field);
}
export function boardObjectLiveOps(before:Item,after:Item):LiveEditorOp[]{
 if(before===after||before.id!==after.id||before.kind!==after.kind||
    before.kind==="pen"||before.kind==="marker")return [];
 return editorDiff(before,after).filter(op=>isLiveBoardObjectField(op.path[0]));
}
// Drafts have not been persisted yet. Send absolute values at the root so a
// repeated or cancelled draft cannot replay an append against another draft.
export function boardDraftLiveOps(before:Item,after:Item):LiveEditorOp[]{
 if(before.id!==after.id||before.kind!==after.kind)return [];
 const a=before as unknown as Record<string,unknown>,b=after as unknown as Record<string,unknown>;
 const ops:LiveEditorOp[]=[];
 for(const field of fields){
  if(a[field]===b[field]||JSON.stringify(a[field])===JSON.stringify(b[field]))continue;
  ops.push(b[field]===undefined?{path:[field],kind:"remove"}:{path:[field],kind:"set",value:b[field]});
 }
 return ops;
}

// Geometry has an independently sequenced, origin-checked stream. Even an
// older live editor snapshot must never override the durable geometry.
export function boardLiveContent(stored:Item,preview:Item|undefined):Item{
 if(!preview||preview.id!==stored.id||preview.kind!==stored.kind)return stored;
 return {...preview,x:stored.x,y:stored.y,width:stored.width,height:stored.height,rotation:stored.rotation,
  connectorStart:stored.connectorStart,connectorEnd:stored.connectorEnd};
}
