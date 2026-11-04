/** Drawing tool is a PER-VIEWER/PER-TAB control, never shared board data.
 * Persisting it in sessionStorage makes it survive a React workspace remount
 * (such as reloading board metadata during a second participant's session).
 * Two peers must be able to draw with the pen at the same time.
 */
export const BOARD_SESSION_TOOLS=[
 "select","hand","lasso","sticky","text","shape","pen","marker","eraser",
 "connector","frame","comment","table","formula","graph","checklist",
 "quiz","flashcard","cover","media","linkmedia"
] as const;
export type BoardSessionTool=typeof BOARD_SESSION_TOOLS[number];
export function boardSessionToolKey(boardId:string,userId:string):string{
 return "lektrus.viewer-tool.v1."+encodeURIComponent(userId)+"."+encodeURIComponent(boardId);
}
export function normalizeBoardSessionTool(raw:unknown):BoardSessionTool{
 return typeof raw==="string"&&(BOARD_SESSION_TOOLS as readonly string[]).includes(raw)
  ?raw as BoardSessionTool:"select";
}
export function readBoardSessionTool(boardId:string,userId:string):BoardSessionTool{
 try{return normalizeBoardSessionTool(sessionStorage.getItem(boardSessionToolKey(boardId,userId)));}
 catch{return "select";}
}
export function writeBoardSessionTool(boardId:string,userId:string,tool:BoardSessionTool):void{
 try{sessionStorage.setItem(boardSessionToolKey(boardId,userId),
  normalizeBoardSessionTool(tool));}catch{/* private mode: keep in React */ }
}
