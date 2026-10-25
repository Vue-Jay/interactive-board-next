type Kind="select"|"hand"|"wire"|"junction"|"undo"|"redo"|"close"|"catalog";
export default function LektrusCircuitUiIcon({kind}:{kind:Kind}){
 const path:Record<Kind,string>={
  select:"M5 3l14 9-7 1.2L9 20z",
  hand:"M8 12V5a1.7 1.7 0 0 1 3.4 0v5-7a1.7 1.7 0 0 1 3.4 0v7-5a1.7 1.7 0 0 1 3.4 0v7-3a1.7 1.7 0 0 1 3.4 0v6c0 4-3 7-7 7h-2c-3 0-5-1.5-7-4l-2-3c-1-1.5 1-3 2.4-2l2.6 2",
  wire:"M3 16h6l3-8 3 8h6M3 16l2 0M19 16h2",
  junction:"M12 3v18M3 12h18M12 12a3.2 3.2 0 1 0 0 .01",
  undo:"M9 9H4V4M4 9a8 8 0 1 1 1 8",
  redo:"M15 9h5V4M20 9a8 8 0 1 0-1 8",
  close:"M5 5l14 14M19 5L5 19",
  catalog:"M4 5h16M4 10h16M4 15h16M4 20h16"
 };
 return <svg viewBox="0 0 24 24" width="17" height="17" fill="none"
   stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
   aria-hidden="true" focusable="false"><path d={path[kind]}/></svg>;
}
