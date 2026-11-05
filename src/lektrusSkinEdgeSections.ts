/** A schematic three-layer skin section drawn only along the sides of
 * each opaque part of the body. All coordinates share the 360x600 world.
 * The width is deliberately exaggerated for educational visibility.
 */
export const SKIN_EDGE_WORLD_WIDTH=2.9;
export const SKIN_EDGE_NATIVE_FACTOR=3;
export const SKIN_EDGE_ALPHA_THRESHOLD=44;
export const SKIN_EDGE_LAYER_WIDTHS={epidermis:.43,dermis:1.15,subcutis:1.32} as const;
export type SkinEdgeLayer="epidermis"|"dermis"|"subcutis";
export type SkinEdgeRun={start:number;end:number};
export type SkinEdgeLandmark={x:number;y:number;inward:-1|1;offsets?:readonly number[]};
export const SKIN_EDGE_COLORS={
 epidermis:[177,83,107],dermis:[233,154,151],subcutis:[243,203,118]
} as const;
export function skinEdgeLayerAt(distance:number):SkinEdgeLayer|null{
 if(!Number.isFinite(distance)||distance<0||distance>SKIN_EDGE_WORLD_WIDTH)return null;
 if(distance<SKIN_EDGE_LAYER_WIDTHS.epidermis)return "epidermis";
 if(distance<SKIN_EDGE_LAYER_WIDTHS.epidermis+SKIN_EDGE_LAYER_WIDTHS.dermis)return "dermis";
 return "subcutis";
}
export function skinEdgeRuns(alpha:Uint8ClampedArray,width:number,row:number):SkinEdgeRun[]{
 const runs:SkinEdgeRun[]=[];
 let start=-1;
 for(let x=0;x<=width;x++){
  const opaque=x<width&&alpha[row*width+x]>=SKIN_EDGE_ALPHA_THRESHOLD;
  if(opaque&&start===-1)start=x;
  if(!opaque&&start!==-1){
   if(x-start>=4)runs.push({start,end:x-1});
   start=-1;
  }
 }
 return runs;
}
export function createSkinEdgeRaster(
 alpha:Uint8ClampedArray,width:number,height:number,
 factor=SKIN_EDGE_NATIVE_FACTOR
):{rgba:Uint8ClampedArray;landmarks:SkinEdgeLandmark[]}{
 if(width*height!==alpha.length)throw Error("Invalid silhouette dimensions");
 const rgba=new Uint8ClampedArray(width*height*4);
 const landmarks:SkinEdgeLandmark[]=[];
 for(let y=0;y<height;y++){
  for(const span of skinEdgeRuns(alpha,width,y)){
   const {start,end}=span;
   const last=Math.min(Math.ceil(SKIN_EDGE_WORLD_WIDTH*factor),(end-start)/2);
   for(let d=0;d<=last;d++){
    const layer=skinEdgeLayerAt(d/factor);
    if(!layer)continue;
    const rgb=SKIN_EDGE_COLORS[layer];
    for(const x of [start+d,end-d]){
     const a=Math.round(alpha[y*width+x]*.96);
     const i=(y*width+x)*4;
     if(a<=rgba[i+3])continue;
     rgba[i]=rgb[0];rgba[i+1]=rgb[1];rgba[i+2]=rgb[2];rgba[i+3]=a;
    }
   }
   if(y%(factor*8)===0&&end-start>factor*8){
    for(const [edge,inward] of [[start,1],[end,-1]] as const){
     const offsets:number[]=[];
     for(let dy=-factor*4;dy<=factor*4;dy++){
      const row=Math.max(0,Math.min(height-1,y+dy));
      const candidates=skinEdgeRuns(alpha,width,row).map(run=>inward===1?run.start:run.end);
      const nearest=candidates.reduce((best,x)=>Math.abs(x-edge)<Math.abs(best-edge)?x:best,edge+width);
      offsets.push(Math.abs(nearest-edge)<factor*6?(nearest-edge)/factor*inward:0);
     }
     landmarks.push({x:edge/factor,y:y/factor,inward,offsets});
    }
   }
  }
 }
 return {rgba,landmarks};
}

const smooth=(a:number,b:number,value:number)=>{
 const t=Math.max(0,Math.min(1,(value-a)/(b-a)));
 return t*t*(3-2*t);
};
export function skinEdgeDetailsAlpha(scale:number){return smooth(2.5,6.5,scale);}
/** Detail geometry uses local coordinates: x = inward tissue depth,
 * y = distance along the surface. No vessels enter the avascular epidermis.
 * The repeated units represent a schematic section of thin, hairy skin;
 * they are not a measured histological map of every body region.
 */
export function skinEdgeDetailLevels(scale:number){
 return {appendages:smooth(7,22,scale),fibres:smooth(18,50,scale),
  cells:smooth(45,110,scale)};
}
/** World-anchored variations prevent a stamp of identical follicles and fat
 * cells from repeating down every limb. No Math.random, camera or frame state. */
export function skinEdgeDetailVariation(p:SkinEdgeLandmark,salt:number):number{
 const x=Math.round(p.x*31),y=Math.round(p.y*43);
 let v=Math.imul(x^salt,0x1b873593)^Math.imul(y,0x85ebca6b);
 v=Math.imul(v^(v>>>16),0x7feb352d);
 v=Math.imul(v^(v>>>15),0x846ca68b);
 return ((v^(v>>>16))>>>0)/4294967296;
}
/** Only schematic thin hairy skin has follicles. Head, hands and feet do not
 * inherit follicles merely because their silhouette happens to have an edge. */
export function skinEdgeHasFollicle(p:SkinEdgeLandmark):boolean{
 const sample=(p.y>=146&&p.y<=286)||(p.y>=394&&p.y<=510);
 return sample&&skinEdgeDetailVariation(p,7)>.23;
}
export function drawSkinEdgeDetails(
 ctx:CanvasRenderingContext2D,
 landmarks:readonly SkinEdgeLandmark[],scale:number,
 bounds:{minX:number;maxX:number;minY:number;maxY:number}
):number{
 const opacity=skinEdgeDetailsAlpha(scale);
 if(opacity<.005)return 0;
 const lod=skinEdgeDetailLevels(scale);
 let painted=0;
 for(const p of landmarks){
  if(p.y<bounds.minY-4||p.y>bounds.maxY+4||
   p.x<bounds.minX-4||p.x>bounds.maxX+4)continue;
  const variation=(salt:number)=>skinEdgeDetailVariation(p,salt);
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.inward,1);
  ctx.beginPath();ctx.rect(-.05,-4.05,SKIN_EDGE_WORLD_WIDTH+.1,8.1);ctx.clip();
  // Each station follows the curved silhouette at sub-world-unit precision.
  // All local x coordinates are tissue depth, never screen pixels.
  const offset=(y:number)=>{
   if(!p.offsets)return 0;
   const t=Math.max(0,Math.min(p.offsets.length-1,
    (y+4)*SKIN_EDGE_NATIVE_FACTOR));
   const i=Math.floor(t),j=Math.min(p.offsets.length-1,i+1);
   return p.offsets[i]+(p.offsets[j]-p.offsets[i])*(t-i);
  };
  const line=(color:string,width:number,points:readonly number[])=>{
   ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
   ctx.moveTo(points[0]+offset(points[1]),points[1]);
   for(let i=2;i<points.length;i+=2)
    ctx.lineTo(points[i]+offset(points[i+1]),points[i+1]);
   ctx.stroke();
  };
  const oval=(x:number,y:number,rx:number,ry:number,color:string)=>{
   ctx.fillStyle=color;ctx.beginPath();
   ctx.ellipse(x+offset(y),y,rx,ry,0,0,Math.PI*2);ctx.fill();
  };
  const curve=(color:string,width:number,points:readonly number[])=>{
   ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
   ctx.moveTo(points[0]+offset(points[1]),points[1]);
   ctx.bezierCurveTo(points[2]+offset(points[3]),points[3],
    points[4]+offset(points[5]),points[5],
    points[6]+offset(points[7]),points[7]);
   ctx.stroke();
  };
  const shift=(variation(13)-.5)*.40;
  // Two deep dermal vessels, with ascending papillary loops. They never
  // cross the basal membrane or enter the avascular epidermis (x < .43).
  ctx.globalAlpha=opacity*.83;
  curve("#bc4b65",.065,[1.43,-4,1.53,-1,1.32,1.25,1.47,4]);
  curve("#6686ac",.066,[1.55,-4,1.61,-1,1.43,1.4,1.57,4]);
  for(let j=0;j<3;j++){
   const y=-3.05+j*2.75+shift*.45;
   curve("#b74763",.048,[1.43,y-.45,.82,y-.50,.49,y-.38,.53,y+.02]);
   curve("#c45f72",.041,[.53,y+.02,.48,y+.37,.94,y+.56,1.55,y+.43]);
   // Papillary loops sit just below the epidermal-dermal junction.
   oval(.56,y+.01,.07,.115,"#e47e88");
  }
  // An interconnected nerve reaches receptors in papillary dermis.
  if(lod.appendages>.005){
   ctx.globalAlpha=opacity*lod.appendages*.90;
   curve("#b58a44",.045,[1.46,3.95,1.20,3.25,.73,3.65,.52,3.04]);
   line("#b58a44",.028,[1.13,3.5,.74,3.15,.56,3.22]);
   line("#b58a44",.025,[.87,3.43,.72,3.70,.51,3.87]);
   oval(.52,3.04,.06,.10,"#deb96a");
  }
  // Irregular adipocyte lobules with delicate septa, clear lipid vacuoles
  // and peripheral flattened nuclei. They replace repeated spot rows.
  ctx.globalAlpha=opacity*.74;
  for(let row=0;row<9;row++)for(let col=0;col<2;col++){
   const n=row*2+col;
   const dx=(variation(70+n)-.5)*.11,dy=(variation(100+n)-.5)*.23;
   const x=1.86+col*.56+(row%2)*.045+dx;
   const y=-3.58+row*.87+(col%2)*.19+dy;
   const rx=.245+variation(120+n)*.055;
   const ry=.325+variation(160+n)*.075;
   oval(x,y,rx+.030,ry+.035,"#d99f73");
   oval(x,y,rx,ry,"#fff0b9");
   ctx.globalAlpha=opacity*.62;
   oval(x+rx*.88,y-ry*.52,.028,.064,"#926476");
   ctx.globalAlpha=opacity*.74;
  }
  if(lod.appendages>.005){
   ctx.globalAlpha=opacity*lod.appendages;
   if(skinEdgeHasFollicle(p)){
    const fy=-1.55+(variation(21)-.5)*.8;
    // Anatomically connected follicle: follicular sheath descends obliquely
    // to its bulb, while the pigmented shaft follows the central canal.
    curve("#a65e71",.36,[.06,fy-.62,.56,fy-.13,1.34,fy+.63,1.77,fy+1.28]);
    curve("#f1c0ad",.235,[.08,fy-.59,.56,fy-.13,1.33,fy+.63,1.77,fy+1.28]);
    curve("#68443e",.085,[.03,fy-.8,.55,fy-.16,1.33,fy+.62,1.76,fy+1.25]);
    oval(1.77,fy+1.28,.22,.27,"#a55b70");
    oval(1.78,fy+1.33,.13,.16,"#e5a7a5");
    oval(1.79,fy+1.43,.072,.095,"#aa5370");
    // Connected sebaceous acini, not loose circles on the skin surface.
    for(let i=0;i<5;i++){
     const dx=(i%3)*.165,dy=Math.floor(i/3)*.20;
     oval(.82+dx,fy+.11+dy,.15,.16,"#d0a078");
     oval(.82+dx,fy+.11+dy,.117,.12,"#f4d6a2");
    }
    line("#a86c64",.050,[.91,fy+.50,.76,fy+.15]);
    curve("#b56470",.11,[.52,fy+1.34,.73,fy+.75,1.04,fy+.63,1.27,fy+.50]);
   }
   // Eccrine gland: distinct sweat duct to an actual surface opening;
   // secretory coils lie in the deep dermis, not in the epidermis.
   const sy=1.45+(variation(31)-.5)*.48;
   curve("#8c729b",.092,[.045,sy-.85,.31,sy-.72,.45,sy-.20,.76,sy+.14]);
   curve("#a28ab1",.047,[.055,sy-.85,.31,sy-.72,.45,sy-.20,.76,sy+.14]);
   oval(.052,sy-.86,.07,.048,"#795f92");
   for(let i=0;i<6;i++){
    const cx=1.00+(i%2)*.29,cy=sy+.34+Math.floor(i/2)*.22;
    ctx.strokeStyle="#876c99";ctx.lineWidth=.085;ctx.beginPath();
    ctx.ellipse(cx+offset(cy),cy,.20,.15,(i%2?-.4:.4),0,Math.PI*2);
    ctx.stroke();
    oval(cx,cy,.065,.045,"#e9bcc9");
   }
   curve("#8c729b",.080,[.76,sy+.14,.88,sy+.36,1.03,sy+.52,1.20,sy+.64]);
  }
  if(lod.fibres>.005){
   ctx.globalAlpha=opacity*lod.fibres*.48;
   // Dense irregular collagen and elastic fibres occupy the reticular
   // dermis. Both diagonal families undulate rather than forming a grid.
   for(let i=0;i<32;i++){
    const y=-3.86+i*.249;
    const delta=(variation(i+201)-.5)*.13;
    curve(i%4===0?"#a56783":"#f9d8c8",i%4===0?.031:.055,
     [.59,y, .77,y-.16+delta, 1.05,y+.18-delta, 1.36,y+.06]);
    if(i%3===0){
     curve("#ac788c",.020,[.78,y-.19, .90,y+.11,
      1.13,y-.03,1.36,y+.33]);
    }
   }
   // Wavy dermal papillae and their thin basement membrane.
   ctx.globalAlpha=opacity*lod.fibres*.85;
   ctx.strokeStyle="#84576d";ctx.lineWidth=.030;ctx.beginPath();
   for(let i=0;i<=96;i++){
    const y=-4+i/12;
    const x=.43+.038*Math.sin((y+p.y*.31)*2.8);
    if(!i)ctx.moveTo(x+offset(y),y);
    else ctx.lineTo(x+offset(y),y);
   }
   ctx.stroke();
  }
  if(lod.cells>.005){
   // Four layers of thin epidermis: flattened anucleate corneocytes,
   // keratohyalin granules, nucleated spinous keratinocytes and the basal
   // cell row. The translucent details do not obscure the layer colours.
   ctx.globalAlpha=opacity*lod.cells*.76;
   for(let i=0;i<49;i++){
    const y=-3.96+i*.164;
    const stagger=(i%2)*.028;
    // Stratum corneum, no nuclei.
    line("#ffe2c8",.026,[.018,y,.084,y+.018]);
    line("#8d586d",.012,[.018,y+.046,.082,y+.060]);
    // Granulosum: small, dark keratohyalin granules.
    oval(.128+stagger*.3,y,.033,.061,"#f4c4b9");
    oval(.130,y-.019,.012,.019,"#945675");
    oval(.139,y+.025,.011,.014,"#88526b");
    // Spinosum: adjacent polygonal cells with distinct nuclei.
    for(let col=0;col<2;col++){
     const x=.225+col*.096+stagger*.27;
     oval(x,y+.012*(col?1:-1),.052,.069,"#e7adb1");
     oval(x,y,.018,.028,"#855578");
     line("#efc5be",.012,[x-.046,y-.035,x-.008,y-.063]);
    }
    // Basal keratinocytes; nuclear axis perpendicular to the boundary.
    oval(.388,y,.034,.073,"#c67d94");
    oval(.385,y,.016,.041,"#69435f");
   }
   // Branching melanocyte in the basal layer and melanin-rich extensions.
   oval(.375,.75,.045,.077,"#76514b");
   line("#77504b",.022,[.375,.75,.30,.62,.245,.59]);
   line("#77504b",.022,[.375,.75,.29,.89,.23,.94]);
   line("#77504b",.020,[.37,.74,.31,.75,.22,.78]);
  }
  ctx.restore();painted++;
 }
 return painted;
}
