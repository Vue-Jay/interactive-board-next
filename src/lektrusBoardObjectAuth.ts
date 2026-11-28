import {isInkItem,type Item} from "./boardModel";
import {STUDENT_BLOCKED_CREATE_TOOLS} from "./lektrusBoardRolePreview";

/**
 * Authors belong to an item ID, not to the most recent editor. In particular,
 * moving a teacher's object must never turn it into a student's property.
 * Legacy items without an author remain unowned, never guessed from the
 * person who happened to open the board first.
 */
export function stampNewBoardItemAuthors(
 before:readonly Item[],after:readonly Item[],actorId:string
):Item[]{
 const originals=new Map(before.map(item=>[item.id,item]));
 return after.map(candidate=>{
  const item=withoutInkLock(candidate);
  const existing=originals.get(item.id);
  const author=existing?existing.createdBy:actorId;
  // Pen and marker strokes are never lockable, including imported legacy ink.
  if(isInkItem(item)){
   const {locked:_ignored,...stroke}=item;
   return stroke.createdBy===author?stroke:{...stroke,createdBy:author};
  }
  if(existing){
   return item.createdBy===author?item:{...item,createdBy:author};
  }
  return {...item,createdBy:author};
 });
}

/** Ink is never lockable. Provenance still governs destructive actions,
 * but an explicit object lock is reserved for placed board objects. */
export const isLockableBoardItem=(item:Pick<Item,"kind">):boolean=>
 item.kind!=="pen"&&item.kind!=="marker";

/** Ignore stale/spoofed ink locks without touching any other item flags. */
export function withoutInkLock<T extends Item>(item:T):T{
 if(isLockableBoardItem(item)||item.locked!==true)return item;
 const {locked:_locked,...unlocked}=item;
 return unlocked as T;
}

/** Ink is a shared classroom drawing layer. Pen and marker strokes
 * have no lock state, and EVERY editor (teacher, student or guest) may
 * erase any stroke, including one made by another participant or a legacy
 * stroke with no createdBy. Ordinary non-ink objects still follow the
 * author / teacher-assignment restriction. The real owner overrides all.
 */
export function canRemoveBoardItem(
 item:Item,actorId:string,isStudent:boolean,isBoardOwner=false
):boolean{
 if(isBoardOwner||isInkItem(item))return true;
 if(!isStudent)return true;
 return !!actorId&&item.createdBy===actorId&&!item.locked&&
  !(STUDENT_BLOCKED_CREATE_TOOLS as readonly string[]).includes(item.kind);
}

/** Guard the model mutation, not only the toolbar/keyboard handler: tools
 * such as ink erasers, instrument removal, selection and provisional
 * editors may remove items without calling deleteSelected().
 */
export function blockedBoardItemRemovals(
 before:readonly Item[],after:readonly Item[],actorId:string,
 isStudent:boolean,isBoardOwner=false
):Item[]{
 if(!isStudent||isBoardOwner)return [];
 const retained=new Set(after.map(item=>item.id));
 return before.filter(item=>!retained.has(item.id)&&
  !canRemoveBoardItem(item,actorId,true,isBoardOwner));
}

/** Moving a shared photo is allowed; changing which part of it is displayed
 * is a content edit reserved for its author and teaching roles. */
export function canCropBoardImage(
 item:Item|null|undefined,actorId:string,isStudent:boolean,isBoardOwner=false
):boolean{
 return !!item&&item.kind==="image"&&!item.locked&&
  (isBoardOwner||!isStudent||!!actorId&&item.createdBy===actorId);
}

export function blockedBoardImageCrops(
 before:readonly Item[],after:readonly Item[],actorId:string,
 isStudent:boolean,isBoardOwner=false
):Item[]{
 if(!isStudent||isBoardOwner)return [];
 const originals=new Map(before.filter(item=>item.kind==="image").map(item=>[item.id,item]));
 return after.filter(item=>{
  const original=originals.get(item.id);
  if(!original||canCropBoardImage(original,actorId,true))return false;
  const a=original.imageCrop,b=item.imageCrop;
  return (!!a!==!!b)||!!a&&!!b&&
   (["x","y","width","height"] as const).some(key=>a[key]!==b[key]);
 });
}

/** UI guard mirrors the server's field policy. The server still validates
 * nested exercise answers, JSON limits, ownership and the actual revision. */
export function blockedStudentObjectEdits(before:readonly Item[],after:readonly Item[],actorId:string):Item[]{
 const originals=new Map(before.map(item=>[item.id,item]));
 const forbidden=STUDENT_BLOCKED_CREATE_TOOLS as readonly string[];
 const same=(a:unknown,b:unknown)=>a===b||JSON.stringify(a)===JSON.stringify(b);
 return after.filter(item=>{
  const old=originals.get(item.id);
  if(!old)return forbidden.includes(item.kind)||!!item.locked||item.createdBy!==actorId;
  if(old.kind!==item.kind||old.createdBy!==item.createdBy)return true;
  if(isInkItem(item))return !!item.locked;
  if(!!old.locked!==!!item.locked)return true;
  if(old===item||old.createdBy===actorId&&!old.locked&&!forbidden.includes(old.kind))return false;
  const allowed=new Set<string>();
  if(!old.locked){
   for(const field of ["x","y","width","height","rotation"])allowed.add(field);
   if(old.kind==="connector")for(const field of ["connectorStart","connectorEnd","connectorStartBinding","connectorEndBinding"])allowed.add(field);
   if(old.kind==="sticky")allowed.add("stickerInk");
   if(old.kind==="pdf")allowed.add("pdfPage");
   if(old.kind==="instrument")allowed.add("instrumentScale");
   if(old.kind==="graph"&&!old.subjectBoardEntries&&!old.schoolDiagram){
    if(["coordinates","number-line","geometry","unit-circle","function"].includes(old.graphPurpose??""))
     for(const field of ["graphPoints","graphSegments","graphAngles","graphCircles","graphPolygons","graphTriangleLines","graphTriangleVertex","graphMidpoints","graphConstraints","graphFreePathStart","graphGrid","graphSnap","graphMagneticSnap","graphAxisLabelScale","graphXMin","graphXMax","graphYMin","graphYMax","graphRotationX","graphRotationY"])allowed.add(field);
    if(old.graphFigureId==="chem-periodic")for(const field of ["sciencePeriodicHighlights","sciencePeriodicLayout"])allowed.add(field);
    if(old.graphFigureId?.startsWith("physics-"))for(const field of ["graphPoints","scienceMechanics","scienceOptics","scienceCircuit"])allowed.add(field);
   }
   if(old.kind==="graph"&&old.graphFigureId==="chem-experiment-free"&&old.scienceLabBench){
    allowed.add("scienceLabBench");
    if(item.scienceReagents===undefined)allowed.add("scienceReagents");
    if(item.scienceExperimentStage===undefined)allowed.add("scienceExperimentStage");
   }
  }
  if(old.kind==="checklist")allowed.add("checklistDone");
  if(old.kind==="quiz")for(const field of ["quizSelected","quizRevealed"])allowed.add(field);
  if(old.kind==="flashcard")for(const field of ["flashcardFlipped","flashcardMastery"])allowed.add(field);
  if(old.kind==="cover")allowed.add("coverOpen");
  if(old.kind==="graph"&&old.subjectBoardEntries&&item.subjectBoardEntries)allowed.add("subjectBoardEntries");
  if(old.kind==="graph"&&old.schoolDiagram&&item.schoolDiagram&&
     ["syntax","place-value","atlas","sentence-builder","geo-training","flashcards","orthography"].includes(old.schoolDiagram.kind))allowed.add("schoolDiagram");
  const a=old as unknown as Record<string,unknown>,z=item as unknown as Record<string,unknown>;
  return [...new Set([...Object.keys(a),...Object.keys(z)])].some(key=>!allowed.has(key)&&!same(a[key],z[key]));
 });
}
