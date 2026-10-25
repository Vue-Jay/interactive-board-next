/** One coherent set of optical-school symbols, distinct from mechanics tools. */
export type OpticsIconKind="select"|"source"|"mirror"|"converging-lens"|"diverging-lens"|"interface"|"screen"|"prism";
export default function LektrusOpticsToolIcon({type}:{type:OpticsIconKind}){
 const icons:Record<OpticsIconKind,React.ReactNode>={
  select:<path d="M4 2.5 19 12l-7.2 1.1L9 21l-5-18.5Z" strokeLinejoin="round"/>,
  source:<>
    <circle cx="12" cy="12" r="4.1" fill="currentColor" fillOpacity=".13"/>
    <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/>
    <path d="M12 1.5v5m0 11v5M1.5 12h5m11 0h5M4.4 4.4l3.5 3.5m8.2 8.2 3.5 3.5m0-15.2-3.5 3.5m-8.2 8.2-3.5 3.5"/>
  </>,
  mirror:<>
    <path d="M8 2v20" strokeWidth="3.2"/>
    <path d="m11 3 4 4m-4 1 7 7m-7-2 7 7m-3-18 4 4" opacity=".65"/>
    <path d="M2.5 12h3.5m-2-2 2 2-2 2" strokeWidth="1.55"/>
  </>,
  "converging-lens":<>
    <path d="M12 2C5.8 6.1 5.8 17.9 12 22C18.2 17.9 18.2 6.1 12 2Z" fill="currentColor" fillOpacity=".10"/>
    <path d="M12 2C5.8 6.1 5.8 17.9 12 22C18.2 17.9 18.2 6.1 12 2Z"/>
    <path d="M1.5 8H8m-6.5 8H8M16 8l6.5 4M16 16l6.5-4" strokeWidth="1.45"/>
  </>,
  "diverging-lens":<>
    <path d="M6.6 2c5.6 5.1 5.6 14.9 0 20h10.8c-5.6-5.1-5.6-14.9 0-20Z" fill="currentColor" fillOpacity=".08"/>
    <path d="M6.6 2c5.6 5.1 5.6 14.9 0 20h10.8c-5.6-5.1-5.6-14.9 0-20Z"/>
    <path d="M1.5 9h7m-7 6h7m7-6 7-6m-7 12 7 6" strokeWidth="1.45"/>
  </>,
  interface:<>
    <path d="M12 1.5v21" strokeWidth="2.6"/>
    <path d="M2 5l10 7 9 2.4M4.7 5.1l-2.7-.1.8 2.7M18.6 12.2l2.4 2.2-3 1.1" strokeWidth="1.7"/>
    <path d="M14.5 4l4.5 4m-4.5 1 4.5 4m-4.5 1 4.5 4" opacity=".45"/>
  </>,
  screen:<>
    <rect x="11" y="2.5" width="9" height="19" rx="1.8" fill="currentColor" fillOpacity=".09"/>
    <rect x="11" y="2.5" width="9" height="19" rx="1.8"/>
    <path d="M2 12h9m-3-3 3 3-3 3" strokeWidth="1.8"/>
    <path d="M15 5.5v13" strokeDasharray="1.5 3" opacity=".65"/>
  </>,
  prism:<>
    <path d="M11.9 3 3.2 21h17.6L11.9 3Z" fill="currentColor" fillOpacity=".1" strokeLinejoin="round"/>
    <path d="M1.5 12h6m-2-2 2 2-2 2" strokeWidth="1.6"/>
    <path d="m10.1 12 4.5 2.5 8-4.3m-8 4.3 8 4.8" strokeWidth="1.6"/>
  </>
 };
 return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
  aria-hidden="true" focusable="false">{icons[type]}</svg>;
}
