/** One definition of a meaningful chemistry-board edit for preview and dismissal.
 * A bare reaction arrow is not a formula, even though its string is nonempty.
 */
import type {Item} from "./boardModel";
import {readReactionText} from "./lektrusChemicalEquationControls";

export const chemistryBoardHasContent=(item:Pick<Item,
 "graphExpression"|"scienceReactionConditions"|"scienceReactionSteps">):boolean=>{
 const steps=item.scienceReactionSteps?.length?item.scienceReactionSteps:
  [{expression:item.graphExpression??"",conditions:item.scienceReactionConditions??""}];
 return steps.some(step=>{
  const split=readReactionText(step.expression??"");
  return !!split.reactants.trim()||!!split.products.trim()||!!step.conditions.trim();
 });
};
