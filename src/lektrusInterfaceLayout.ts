/** Admin-only visual layout studio. Profiles are intentionally UI preferences,
 * never part of the collaborative board document or remote board history. */
export const INTERFACE_LAYOUT_KEY="lektrus.interface-layout.v1";
export const INTERFACE_LAYOUT_EVENT="lektrus-interface-layout-changed";
export const INTERFACE_TEMPLATE_KEY="lektrus.interface-layout-templates.v1";
export const deviceProfiles=["desktop","laptop","tablet","phone"] as const;
export type DeviceProfile=typeof deviceProfiles[number];
export const layoutRegions=["headerLeft","headerRight","toolbar","zoom","mobileTools","selection","subjectTools"] as const;
export type LayoutRegion=typeof layoutRegions[number];
export const layoutControls=["select","lasso","pen","marker","eraser","subject","zoomOut","zoomValue","zoomIn","boardSettings","participants","chat"] as const;
export type LayoutControl=typeof layoutControls[number];
export const layoutControlNames:Record<LayoutControl,string>={
 select:"Стрелка (выбор)",lasso:"Лассо",pen:"Карандаш",marker:"Маркер",eraser:"Ластик",
 subject:"Предметные инструменты",zoomOut:"Уменьшить масштаб",zoomValue:"Значение масштаба",
 zoomIn:"Увеличить масштаб",boardSettings:"Настройки доски",participants:"Участники",chat:"Чат"
};
export const layoutRegionNames:Record<LayoutRegion,string>={
 headerLeft:"Заголовок и переход к доскам",
 headerRight:"Кнопки верхней панели",
 toolbar:"Панель инструментов",
 zoom:"Масштаб и фон",
 mobileTools:"Мобильные инструменты",
 selection:"Настройки выделенного объекта",
 subjectTools:"Предметные инструменты"
};
export type Placement={x:number;y:number;scale:number};
export type InterfaceLayout={version:1;profiles:Record<DeviceProfile,Record<LayoutRegion,Placement>>;
 controls:Record<DeviceProfile,Record<LayoutControl,Placement>>};
export type NamedInterfaceLayout={id:string;name:string;layout:InterfaceLayout};
const cleanNumber=(value:unknown,low:number,high:number,fallback:number)=>{
 const n=typeof value==="number"?value:NaN;
 return Number.isFinite(n)?Math.max(low,Math.min(high,n)):fallback;
};
export function defaultInterfaceLayout():InterfaceLayout{
 const region=()=>Object.fromEntries(layoutRegions.map(key=>[key,{x:0,y:0,scale:1}])) as Record<LayoutRegion,Placement>;
 const control=()=>Object.fromEntries(layoutControls.map(key=>[key,{x:0,y:0,scale:1}])) as Record<LayoutControl,Placement>;
 return {version:1,profiles:{desktop:region(),laptop:region(),tablet:region(),phone:region()},
  controls:{desktop:control(),laptop:control(),tablet:control(),phone:control()}};
}
export function normalizeInterfaceLayout(value:unknown):InterfaceLayout{
 const normal=defaultInterfaceLayout();
 if(!value||typeof value!=="object")return normal;
 const incoming=(value as {profiles?:Record<string,unknown>}).profiles;
 const incomingControls=(value as {controls?:Record<string,unknown>}).controls;
 for(const device of deviceProfiles){
  const entries=incoming?.[device];
  if(!entries||typeof entries!=="object")continue;
  for(const region of layoutRegions){
   const raw=(entries as Record<string,unknown>)[region];
   if(!raw||typeof raw!=="object")continue;
   const object=raw as Record<string,unknown>;
   normal.profiles[device][region]={
    x:cleanNumber(object.x,-45,45,0),
    y:cleanNumber(object.y,-45,45,0),
    scale:cleanNumber(object.scale,.65,1.45,1)
   };
  }
  const controls=incomingControls?.[device];
  if(!controls||typeof controls!=="object")continue;
  for(const id of layoutControls){
   const raw=(controls as Record<string,unknown>)[id];
   if(!raw||typeof raw!=="object")continue;
   const object=raw as Record<string,unknown>;
   normal.controls[device][id]={
    x:cleanNumber(object.x,-45,45,0),
    y:cleanNumber(object.y,-45,45,0),
    scale:cleanNumber(object.scale,.65,1.45,1)
   };
  }
 }
 return normal;
}
export function readInterfaceLayout():InterfaceLayout{
 try{return normalizeInterfaceLayout(JSON.parse(localStorage.getItem(INTERFACE_LAYOUT_KEY)||"null"))}
 catch{return defaultInterfaceLayout()}
}
export function saveInterfaceLayout(layout:InterfaceLayout){
 localStorage.setItem(INTERFACE_LAYOUT_KEY,JSON.stringify(normalizeInterfaceLayout(layout)));
 window.dispatchEvent(new Event(INTERFACE_LAYOUT_EVENT));
}
export function readInterfaceTemplates():NamedInterfaceLayout[]{
 try{
  const data:unknown=JSON.parse(localStorage.getItem(INTERFACE_TEMPLATE_KEY)||"[]");
  if(!Array.isArray(data))return [];
  return data.filter(v=>v&&typeof v==="object"&&typeof v.name==="string"&&typeof v.id==="string")
   .slice(-30).map(v=>({id:v.id.slice(0,100),name:v.name.slice(0,60),layout:normalizeInterfaceLayout(v.layout)}));
 }catch{return []}
}
export function saveInterfaceTemplates(templates:NamedInterfaceLayout[]){
 localStorage.setItem(INTERFACE_TEMPLATE_KEY,JSON.stringify(templates.slice(-30)));
}
export function currentDeviceProfile():DeviceProfile{
 const width=window.innerWidth;
 const coarse=window.matchMedia?.("(pointer:coarse)").matches??false;
 if(coarse&&width<=950)return width<=600?"phone":"tablet";
 if(width<=600)return "phone";
 if(width<=900)return "tablet";
 return width<1200?"laptop":"desktop";
}
export function applyInterfaceLayout(){
 const documentData=readInterfaceLayout();
 const selected=currentDeviceProfile(),placements=documentData.profiles[selected];
 const root=document.documentElement;
 for(const region of layoutRegions){
  const placement=placements[region];
  root.style.setProperty("--li-"+region+"-x",placement.x+"vw");
  root.style.setProperty("--li-"+region+"-y",placement.y+"vh");
  root.style.setProperty("--li-"+region+"-scale",String(placement.scale));
 }
 for(const control of layoutControls){
  const placement=documentData.controls[selected][control];
  root.style.setProperty("--li-control-"+control+"-x",placement.x+"vw");
  root.style.setProperty("--li-control-"+control+"-y",placement.y+"vh");
  root.style.setProperty("--li-control-"+control+"-scale",String(placement.scale));
 }
 root.dataset.interfaceLayoutDevice=selected;
}
let installed=false;
export function installInterfaceLayout(){
 if(installed)return;
 installed=true;
 applyInterfaceLayout();
 window.addEventListener("resize",applyInterfaceLayout);
 window.addEventListener("orientationchange",applyInterfaceLayout);
 window.addEventListener("storage",event=>{if(event.key===INTERFACE_LAYOUT_KEY)applyInterfaceLayout()});
 window.addEventListener(INTERFACE_LAYOUT_EVENT,applyInterfaceLayout);
}
