type ToolIconName="select"|"hand"|"pen"|"fill"|"erase"|"annotation"|"undo";
const paths:Record<ToolIconName,string>={
 select:"M5 3l14 9-7 1.5L9 20 5 3z",
 hand:"M8 13V5a1.6 1.6 0 0 1 3.2 0v6-7a1.6 1.6 0 0 1 3.2 0v7-5a1.6 1.6 0 0 1 3.2 0v6-3a1.6 1.6 0 0 1 3.2 0v7c0 5-3.4 8-8 8-3.2 0-4.6-1.7-7.5-5.8a1.6 1.6 0 0 1 2.6-1.9L8 13",
 pen:"M4 20l5-.8L20 8a2.5 2.5 0 0 0-4-4L5 15z M13 7l4 4",
 fill:"M3 14l9-9 9 9-9 9z M9 8l8 8 M18 22h4",
 erase:"M4 14l9-10a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-8 8H8z M11 9l7 7 M13 20h8",
 annotation:"M4 4h16v13H9l-5 4z M8 9h8 M8 13h5",
 undo:"M9 6L4 11l5 5 M4 11h10a6 6 0 0 1 0 12"
};
export default function LektrusContourToolIcon({name}:{name:ToolIconName}){
 return <svg viewBox="0 0 24 24" width="21" height="21" fill="none"
  stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"
  strokeLinejoin="round" aria-hidden="true">
  <path d={paths[name]}/>
 </svg>;
}
