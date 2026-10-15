import {normalizeBoardBackground,type BoardBackground} from "./boardModel";
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const luminance=(channels:number[])=>channels.map(n=>n/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
export function boardBackgroundAppearance(input:BoardBackground){
  const b=normalizeBoardBackground(input),[r,g,blue]=rgb(b.color),alpha=b.opacity/100;
  const effective=[r,g,blue].map(n=>Math.round(n*alpha+255*(1-alpha)));
  const dark=luminance(effective)<.36;
  const pattern=dark?"rgba(255,255,255,.27)":"rgba(22,39,69,.22)";
  const image=b.mode==="plain"?"none":b.mode==="dots"?
    "radial-gradient(circle, "+pattern+" 1px,transparent 1.2px)":
    "linear-gradient(to right,"+pattern+" 1px,transparent 1px),linear-gradient(to bottom,"+pattern+" 1px,transparent 1px)";
  return {backgroundColor:"rgba("+r+","+g+","+blue+","+alpha+")",backgroundImage:image,
    foreground:dark?"#ffffff":"#111827",outline:dark?"#111827":"#ffffff"};
}
export function drawingCursorForBackground(background:BoardBackground){
  const {foreground,outline}=boardBackgroundAppearance(background);
  // Lektrus Point: a crisp 18px broken ring with a true 9,9 drawing hotspot.
  // Contrasting double strokes keep the cursor readable on light/dark boards
  // and over images, without obscuring fine strokes with long crosshair arms.
  const ring='<circle cx="9" cy="9" r="5.3" fill="none" stroke-dasharray="5 3.325" stroke-dashoffset="1.3" stroke-linecap="round"';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">'+
    ring+' stroke="'+outline+'" stroke-width="3.1"/>'+
    ring+' stroke="'+foreground+'" stroke-width="1.45"/>'+
    '<circle cx="9" cy="9" r="1.45" fill="'+outline+'"/>'+
    '<circle cx="9" cy="9" r=".9" fill="'+foreground+'"/></svg>';
  return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'") 9 9, crosshair';
}
