/** Optical instrument miniatures match the shapes used on the drawing,
 * rather than abstract arrows with unclear meaning at 18px. */
export type OpticsIconKind="select"|"source"|"mirror"|"converging-lens"|"diverging-lens"|"interface"|"screen"|"prism";
export default function LektrusOpticsToolIcon({type}:{type:OpticsIconKind}){
 const opticalStroke="#3d77b7";
 const glass="#d6efff";
 return <svg className={"lektrus-optics-tool-picture symbol-"+type}
   viewBox="0 0 48 48" width="32" height="32" fill="none"
   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
  {type==="select"&&<>
    <path d="M13 7 37 24l-11.5 2.3-4.5 13L13 7Z"
      fill="#d9e8ff" stroke="#2c63bc" strokeWidth="2.7"/>
    <path d="m26 26 7.5 11" stroke="#2c63bc" strokeWidth="2.8"/>
  </>}
  {type==="source"&&<>
    <circle cx="24" cy="24" r="9" fill="#fff2cc" stroke="#e4a13f" strokeWidth="2.6"/>
    <circle cx="24" cy="24" r="3.6" fill="#e4a13f"/>
    {Array.from({length:8},(_,i)=><path key={i} d="M24 7V12"
      transform={`rotate(${45*i} 24 24)`} stroke="#e3a13f" strokeWidth="2.4"/>)}
  </>}
  {type==="mirror"&&<>
    <path d="M20 6v36" stroke="#366994" strokeWidth="4.1"/>
    {Array.from({length:6},(_,i)=><path key={i}
      d={`M24 ${6+i*6}l7 5`} stroke="#9eb2c8" strokeWidth="2"/>)}
    <path d="m9 21 9-7M18 14l-2 6m2-6-6-1" stroke="#e4a13f" strokeWidth="2"/>
  </>}
  {type==="converging-lens"&&<>
    <path d="M24 5C12 14 12 34 24 43 36 34 36 14 24 5Z"
      fill={glass} stroke={opticalStroke} strokeWidth="2.6"/>
    <path d="M5 19h10m18 10h10" stroke="#d9a04e" strokeWidth="2.1"/>
    <path d="m11 16 4 3-4 3m27 4-5 3 5 3" stroke="#d9a04e" strokeWidth="1.9"/>
  </>}
  {type==="diverging-lens"&&<>
    <path d="M14 5C23 15 23 33 14 43H34C25 33 25 15 34 5Z"
      fill={glass} stroke={opticalStroke} strokeWidth="2.6"/>
    <path d="M5 19h10m18 10h10" stroke="#d9a04e" strokeWidth="2.1"/>
    <path d="m11 16 4 3-4 3m27 4-5 3 5 3" stroke="#d9a04e" strokeWidth="1.9"/>
  </>}
  {type==="interface"&&<>
    <rect x="24" y="5" width="17" height="38" rx="2" fill="#e4f3fc"/>
    <path d="M24 5v38" stroke={opticalStroke} strokeWidth="2.8"/>
    <path d="M7 10 24 24 40 31" stroke="#e4a13f" strokeWidth="2.5"/>
    <path d="m14 12 4 0-.6 4m18 11 4.6 4-6 1" stroke="#e4a13f" strokeWidth="1.8"/>
  </>}
  {type==="screen"&&<>
    <rect x="24" y="6" width="12" height="36" rx="2" fill="#d6e2ee" stroke="#60819d" strokeWidth="2.6"/>
    <path d="M6 24h18" stroke="#e4a13f" strokeWidth="2.5"/>
    <path d="m18 20 6 4-6 4" stroke="#e4a13f" strokeWidth="2"/>
  </>}
  {type==="prism"&&<>
    <path d="M24 6 6 41h36L24 6Z" fill="#c9e9fc" stroke={opticalStroke} strokeWidth="2.6"/>
    <path d="M3 27h12m-4-3 4 3-4 3" stroke="#e4a13f" strokeWidth="2.1"/>
    <path d="m17 27 11 5 16-8m-16 8 15 4" stroke="#e4a13f" strokeWidth="2"/>
  </>}
 </svg>;
}
