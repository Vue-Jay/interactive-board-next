import type {SiteDocument,SitePage} from "./marketingSiteConfig";

export type StudioCommand="undo"|"redo"|"delete"|"escape"|"save";
export type StudioKeyEvent={key:string;ctrlKey:boolean;metaKey:boolean;shiftKey:boolean;altKey:boolean;isComposing?:boolean;editable:boolean};

export function getStudioCommand(event:StudioKeyEvent):StudioCommand|null{
 if(event.editable||event.isComposing||event.altKey)return null;
 const cmd=event.ctrlKey||event.metaKey;
 const key=event.key.toLowerCase();
 if(cmd){
  if(key==="z")return event.shiftKey?"redo":"undo";
  if(key==="y"&&!event.shiftKey)return "redo";
  if(key==="s"&&!event.shiftKey)return "save";
  return null;
 }
 if(event.shiftKey)return null;
 if(event.key==="Delete"||event.key==="Backspace")return "delete";
 if(event.key==="Escape")return "escape";
 return null;
}

export function isStudioEditableTarget(target:EventTarget|null):boolean{
 if(!(target instanceof Element))return false;
 return Boolean(target.closest('input,textarea,select,[contenteditable="true"],[contenteditable=""],[role="textbox"]'));
}

export function commandFromKeyboard(event:KeyboardEvent):StudioCommand|null{
 return getStudioCommand({
  key:event.key,ctrlKey:event.ctrlKey,metaKey:event.metaKey,shiftKey:event.shiftKey,
  altKey:event.altKey,isComposing:event.isComposing,editable:isStudioEditableTarget(event.target)
 });
}

export type StudioDeletion="block"|"object"|"none";
const pageFromDoc=(doc:SiteDocument,id:string):SitePage|null=>
 doc.customPages.find(page=>page.id===id)??doc.pages[id]??null;

/** Called inside an undoable document change; never alters a built-in page's JSX. */
export function deleteStudioSelection(doc:SiteDocument,pageId:string,blockId:string|null,objectId:string|null):StudioDeletion{
 if(objectId){
  if(!/^(?:global|[a-z][a-z0-9-]{0,39}):[a-z0-9_/.-]{1,180}$/.test(objectId))return "none";
  if(doc.objects[objectId]?.hidden===true)return "none";
  doc.objects[objectId]={...doc.objects[objectId],hidden:true};
  return "object";
 }
 if(!blockId)return "none";
 const page=pageFromDoc(doc,pageId);
 if(!page||!page.blocks.some(block=>block.id===blockId))return "none";
 page.blocks=page.blocks.filter(block=>block.id!==blockId);
 const prefix=pageId+":"+blockId+"/";
 for(const key of Object.keys(doc.objects))if(key.startsWith(prefix))delete doc.objects[key];
 return "block";
}

export function restoreStudioObject(doc:SiteDocument,id:string):boolean{
 const patch=doc.objects[id];
 if(!patch?.hidden)return false;
 const next={...patch};
 delete next.hidden;
 if(Object.keys(next).length)doc.objects[id]=next;
 else delete doc.objects[id];
 return true;
}
