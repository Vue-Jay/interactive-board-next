import { remoteRequest } from "./backend";
import { isSelfhostBackendEnabled,selfhostRequest } from "./selfhostApi";
import type { DocumentData } from "./boardModel";

export type BoardHistoryEntry={
 id:number; version:number; saved_at:string; saved_by:string|null; saved_by_name:string|null;
 item_count:number; ink_count?:number; title:string; added_count:number; changed_count:number; removed_count:number;
};

export type BoardActivityEntry={
 id:number; version:number; created_at:string; actor_id:string|null; actor_name:string|null;
 added_count:number; changed_count:number; removed_count:number; item_count:number; summary:string;
};

export async function listBoardHistory(boardId:string,limit=30):Promise<BoardHistoryEntry[]>{
 if(isSelfhostBackendEnabled())return selfhostRequest<BoardHistoryEntry[]>(`/api/v1/boards/${encodeURIComponent(boardId)}/history?limit=${Math.max(1,Math.min(100,limit))}`);
 const rows=await remoteRequest<BoardHistoryEntry[]>("/rest/v1/rpc/list_board_history",{method:"POST",body:JSON.stringify({p_board_id:boardId,p_limit:limit})});
 return rows||[];
}
export async function getBoardHistoryVersion(boardId:string,version:number):Promise<DocumentData>{
 if(isSelfhostBackendEnabled())return selfhostRequest<DocumentData>(`/api/v1/boards/${encodeURIComponent(boardId)}/history/${version}`);
 return remoteRequest<DocumentData>("/rest/v1/rpc/get_board_history_version",{method:"POST",body:JSON.stringify({p_board_id:boardId,p_version:version})});
}
export async function listBoardActivity(boardId:string,limit=100):Promise<BoardActivityEntry[]>{
 if(isSelfhostBackendEnabled())return (await listBoardHistory(boardId,limit)).map(row=>({id:row.id,version:row.version,created_at:row.saved_at,actor_id:row.saved_by,actor_name:row.saved_by_name,added_count:row.added_count,changed_count:row.changed_count,removed_count:row.removed_count,item_count:row.item_count,summary:`+${row.added_count} ~${row.changed_count} −${row.removed_count}`}));
 const rows=await remoteRequest<BoardActivityEntry[]>("/rest/v1/rpc/list_board_activity",{method:"POST",body:JSON.stringify({p_board_id:boardId,p_limit:limit})});
 return rows||[];
}
