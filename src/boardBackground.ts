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
  // Double-contour crosshair stays legible over a photo even if its color
  // differs from the board background. Inner color flips with the board.
  const path="M16 2v10M16 20v10M2 16h10M20 16h10";
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">'+
    '<path d="'+path+'" stroke="'+outline+'" stroke-width="4" fill="none" stroke-linecap="round"/>'+
    '<path d="'+path+'" stroke="'+foreground+'" stroke-width="2" fill="none" stroke-linecap="round"/>'+
    '<circle cx="16" cy="16" r="2.5" fill="'+outline+'"/><circle cx="16" cy="16" r="1" fill="'+foreground+'"/></svg>';
  return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'") 16 16, crosshair';
}
