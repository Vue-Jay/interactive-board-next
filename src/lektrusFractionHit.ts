/** Match the SVG's default xMidYMid meet transform, including letterboxing. */
export function fractionHitPart(mode:"circle"|"bar",denominator:number,clientX:number,clientY:number,
  rect:{left:number;top:number;width:number;height:number}):number|null {
  const scale=Math.min(rect.width/360,rect.height/250);
  if(!(scale>0)||!Number.isSafeInteger(denominator)||denominator<1)return null;
  const x=(clientX-rect.left-(rect.width-360*scale)/2)/scale;
  const y=(clientY-rect.top-(rect.height-250*scale)/2)/scale;
  let proportion:number;
  if(mode==="bar"){
    if(x<22||x>338||y<86||y>166)return null;
    proportion=(x-22)/316;
  }else{
    const dx=x-180,dy=y-125;
    if(Math.hypot(dx,dy)>100)return null;
    proportion=((Math.atan2(dy,dx)+Math.PI/2+2*Math.PI)%(2*Math.PI))/(2*Math.PI);
  }
  return Math.min(denominator-1,Math.floor(proportion*denominator));
}
