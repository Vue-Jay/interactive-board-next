type Type="select"|"block"|"circle"|"floor"|"incline"|"pivot"|"force"|"source"|"mirror"|"converging-lens"|"diverging-lens"|"interface"|"screen"|"prism";
export default function LektrusPhysicsToolIcon({type}:{type:Type}){
 const basic:{[K in Type]:string}={
  select:"M5 3L19 12l-7 1-3 7Z",
  block:"M4 6h16v12H4zM4 10h16",
  circle:"M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18ZM12 9v6m-3-3h6",
  floor:"M3 11h18M5 15l-3 5m9-5-3 5m9-5-3 5",
  incline:"M3 20L20 7v13ZM5 21h16",
  pivot:"M12 5L4 18h16Z M2 21h20",
  force:"M3 18L20 5m-7 0h7v7M4 6h6M7 3v6",
  source:"M12 7v10m-5-5h10M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2",
  mirror:"M8 3v18m4-18v18M14 5l6 5m-6 1 6 5m-6 1 4 4",
  "converging-lens":"M12 2C4 6 4 18 12 22M12 2c8 4 8 16 0 20M2 12h7m6 0h7",
  "diverging-lens":"M8 2C16 7 16 17 8 22M16 2C8 7 8 17 16 22M2 12h7m6 0h7",
  interface:"M12 2v20m-10-10h20M2 5l8 6m3 2 9 5",
  screen:"M7 2v20h10V2H7ZM10 5h4m-4 5h4m-4 5h4",
  prism:"M12 3 2 21h20Z M3 12h8l7 5"
 };
 return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
   <path d={basic[type]}/>
 </svg>;
}
