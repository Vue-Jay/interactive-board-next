import type {DeviceProfile} from "./lektrusInterfaceLayout";

const studioPath="/board/00000000-0000-4000-8000-00000000a11a";
export function interfacePreviewProfile():DeviceProfile|null{
 const query=new URLSearchParams(window.location.search);
 const profile=query.get("device");
 return window.location.pathname===studioPath&&query.get("layout-editor")==="1"&&
  query.get("layout-preview")==="1"&&
  ["desktop","laptop","tablet","tabletPortrait","phone","phonePortrait"].includes(profile??"")
  ?profile as DeviceProfile:null;
}

// A real iframe supplies the viewport; only pointer capabilities need emulation.
export function rewritePreviewMediaQuery(query:string,touch:boolean):string{
 return query.replace(/\(\s*(?:any-)?(pointer|hover)\s*:\s*(coarse|fine|none|hover)\s*\)/gi,
  (_,feature:string,value:string)=>{
   const actual=feature.toLowerCase()==="pointer"?(touch?"coarse":"fine"):(touch?"none":"hover");
   return value.toLowerCase()===actual?"(min-width: 0px)":"(max-width: 0px)";
  });
}

export function installInterfacePreviewEnvironment(){
 const profile=interfacePreviewProfile();
 if(!profile)return;
 const touch=profile.startsWith("phone")||profile.startsWith("tablet");
 const match=window.matchMedia.bind(window);
 window.matchMedia=query=>match(rewritePreviewMediaQuery(query,touch));
 function visit(rules:CSSRuleList){
  for(const rule of Array.from(rules)){
   if(rule instanceof CSSMediaRule||rule instanceof CSSImportRule){
    const original=rule.media.mediaText,updated=rewritePreviewMediaQuery(original,touch);
    if(original!==updated)rule.media.mediaText=updated;
   }
   if(rule instanceof CSSGroupingRule)visit(rule.cssRules);
   if(rule instanceof CSSImportRule&&rule.styleSheet)try{visit(rule.styleSheet.cssRules)}catch{/* inaccessible sheet */}
  }
 }
 function refresh(){
  for(const sheet of Array.from(document.styleSheets))try{visit(sheet.cssRules)}catch{/* cross-origin sheet */}
 }
 new MutationObserver(refresh).observe(document.head,{childList:true,subtree:true,characterData:true});
 document.addEventListener("load",refresh,true);
 refresh();
}
