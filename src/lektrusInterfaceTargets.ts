import type {DeviceProfile,Placement} from "./lektrusInterfaceLayout";

/** UI-only regions. Neither canvas contents nor user documents are candidates. */
const anchors=[
 ".topbar",".toolbar.compact-toolbar",".mobile-board-tools",".board-controls",
 "#lektrus-subject-tools-panel",".selection-toolbar-screen",".minimap",".coordinates",
 ".mobile-tools-sheet",".topbar-more-popover",".lectris-layout-menu",
 ".lektrus-tool-overflow",".mobile-board-bottom-panel",".board-status",
 ".lektrus-subject-tools-trigger"
];
const children="button,input,select,textarea,summary,[role='button'],[role='tab'],[role='switch'],label";
export type InterfaceElement={selector:string;rect:DOMRect;node:HTMLElement};
/** Stable structural selectors are also valid in real board sessions. Avoid storing
 * unstable text/IDs (board title, user ID, randomly created React keys). */
export function getInterfaceElements(doc:Document):InterfaceElement[]{
 const output:InterfaceElement[]=[];
 const seen=new Set<string>();
 for(const anchor of anchors){
  for(const root of doc.querySelectorAll<HTMLElement>(anchor)){
   const targets=[root,...Array.from(root.children).filter((e):e is HTMLElement=>e instanceof (doc.defaultView?.HTMLElement??HTMLElement)),
    ...Array.from(root.querySelectorAll<HTMLElement>(children))];
   for(const node of targets){
    if(!node.isConnected||node.closest(".lektrus-live-layout-editor"))continue;
    const rect=node.getBoundingClientRect();
    if(rect.width<7||rect.height<7)continue;
    const computed=doc.defaultView?.getComputedStyle(node);
    if(computed?.visibility==="hidden"||computed?.display==="none")continue;
    const parts:string[]=[];
    let cursor:Element|null=node;
    while(cursor&&cursor!==root){
     const parent:Element|null=cursor.parentElement;
     if(!parent){parts.length=0;break}
     const index=Array.prototype.indexOf.call(parent.children,cursor)+1;
     if(index<1){parts.length=0;break}
     parts.unshift("> "+cursor.tagName.toLowerCase()+":nth-child("+index+")");
     cursor=parent;
    }
    if(cursor!==root)continue;
    const selector=anchor+(parts.length?" "+parts.join(" "):"");
    if(seen.has(selector))continue;
    seen.add(selector);output.push({selector,rect,node});
   }
  }
 }
 return output;
}
export const safeInterfaceSelector=(selector:string)=>selector.length<380&&
 /^[.#a-zA-Z0-9 _>:()\-]+$/.test(selector)&&
 (selector.startsWith(".topbar")||selector.startsWith(".toolbar.compact-toolbar")||
 selector.startsWith(".mobile-board-tools")||selector.startsWith(".board-controls")||
 selector.startsWith("#lektrus-subject-tools-panel")||selector.startsWith(".selection-toolbar-screen")||
 selector.startsWith(".minimap")||selector.startsWith(".coordinates")||
 selector.startsWith(".mobile-tools-sheet")||selector.startsWith(".topbar-more-popover")||
 selector.startsWith(".lectris-layout-menu")||selector.startsWith(".lektrus-tool-overflow")||
 selector.startsWith(".mobile-board-bottom-panel")||selector.startsWith(".board-status")||
 selector.startsWith(".lektrus-subject-tools-trigger"));
const num=(n:number)=>Math.max(-100,Math.min(100,Number.isFinite(n)?n:0));
/** CSS is scoped to UI only; important protects the stored customization against
 * breakpoint styles without mutating JSX or impacting actual board drawing. */
export function renderExtraLayoutCSS(extras:Record<string,Placement>){
 return Object.entries(extras).filter(([selector])=>safeInterfaceSelector(selector))
  .map(([selector,p])=>`${selector}{translate:${num(p.x)}vw ${num(p.y)}vh !important;scale:${Math.max(.65,Math.min(1.45,p.scale))} !important}`)
  .join("\n");
}
export function applyExtraLayout(doc:Document,extras:Record<string,Placement>,_device:DeviceProfile){
 let style=doc.getElementById("lektrus-interface-extras") as HTMLStyleElement|null;
 if(!style){style=doc.createElement("style");style.id="lektrus-interface-extras";doc.head.appendChild(style)}
 style.textContent=renderExtraLayoutCSS(extras);
}
