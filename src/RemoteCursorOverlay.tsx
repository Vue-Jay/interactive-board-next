import { memo, useSyncExternalStore } from "react";
import type { RemoteCursor } from "./boardBroadcast";
import type { RemoteCursorStore } from "./boardRemoteCursors";
import { BOARD_SELECTION_ARROW_PATH } from "./lektrusSelectionCursor";
import "./lektrusRemoteCursor.css";

const Cursor=memo(function Cursor({cursor,x,y,zoom}:{cursor:RemoteCursor;x:number;y:number;zoom:number}){
  return <div className="remote-cursor lektrus-remote-cursor" style={{transform:`translate(${cursor.x*zoom+x}px,${cursor.y*zoom+y}px)`}}>
    <svg className="remote-cursor-pointer" viewBox="0 0 32 32" aria-hidden="true"><path d={BOARD_SELECTION_ARROW_PATH}/></svg>
    <span>{cursor.name}</span>
  </div>;
});

export const RemoteCursorOverlay=memo(function RemoteCursorOverlay({store,x,y,zoom}:{store:RemoteCursorStore;x:number;y:number;zoom:number}){
  const cursors=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
  return <>{Array.from(cursors.values(),cursor=><Cursor key={cursor.userId} cursor={cursor} x={x} y={y} zoom={zoom}/>)}</>;
});

export const RemoteCursorCount=memo(function RemoteCursorCount({store}:{store:RemoteCursorStore}){
  return <>{useSyncExternalStore(store.subscribe,store.getCount,store.getCount)}</>;
});
