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
export function drawingCursorForBackground(background:BoardBackground, thickness=3, zoom=1){
  const {foreground,outline}=boardBackgroundAppearance(background);
  // The outline follows the actual on-screen ink width (including zoom).
  // Keep very thin strokes visible and cap dimensions for browser cursor limits.
  const diameter=Math.max(8,Math.min(96,Math.round(thickness*zoom)));
  const size=diameter+6;
  const center=size/2;
  const radius=diameter/2-1;
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'">'+
    '<circle cx="'+center+'" cy="'+center+'" r="'+radius+'" fill="none" stroke="'+outline+'" stroke-width="2.8"/>'+
    '<circle cx="'+center+'" cy="'+center+'" r="'+radius+'" fill="none" stroke="'+foreground+'" stroke-width="1.4"/>'+
    '<circle cx="'+center+'" cy="'+center+'" r="1.9" fill="'+outline+'"/>'+
    '<circle cx="'+center+'" cy="'+center+'" r="1" fill="'+foreground+'"/></svg>';
  return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'") '+center+' '+center+', crosshair';
}
