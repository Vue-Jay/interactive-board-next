import { memo, useSyncExternalStore, type CSSProperties } from "react";
import {TEACHER_COLOR,fallbackParticipantColor} from "./boardParticipantColors";
import type { RemoteCursor } from "./boardBroadcast";
import type { RemoteCursorStore } from "./boardRemoteCursors";
import { BOARD_SELECTION_ARROW_PATH } from "./lektrusSelectionCursor";
import "./lektrusRemoteCursor.css";

const Cursor=memo(function Cursor({cursor,x,y,zoom,color}:{cursor:RemoteCursor;x:number;y:number;zoom:number;color:string}){
  return <div className="remote-cursor lektrus-remote-cursor" style={{transform:`translate(${cursor.x*zoom+x}px,${cursor.y*zoom+y}px)`,"--participant-color":color} as CSSProperties}>
    <svg className="remote-cursor-pointer" viewBox="0 0 32 32" aria-hidden="true"><path d={BOARD_SELECTION_ARROW_PATH}/></svg>
    <span>{cursor.name}</span>
  </div>;
});

export const RemoteCursorOverlay=memo(function RemoteCursorOverlay({store,x,y,zoom,colors,ownerId}:{store:RemoteCursorStore;x:number;y:number;zoom:number;colors?:ReadonlyMap<string,string>;ownerId?:string}){
  const cursors=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
  return <>{Array.from(cursors.values(),cursor=><Cursor key={cursor.userId} cursor={cursor} x={x} y={y} zoom={zoom} color={cursor.role==="owner"||cursor.userId===ownerId?TEACHER_COLOR:colors?.get(cursor.userId)??fallbackParticipantColor(cursor.userId)}/>)}</>;
});

export const RemoteCursorCount=memo(function RemoteCursorCount({store}:{store:RemoteCursorStore}){
  return <>{useSyncExternalStore(store.subscribe,store.getCount,store.getCount)}</>;
});
