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
  ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.inward,1);
  // All details stay within the lateral cutaway, including at maximum zoom.
  ctx.beginPath();ctx.rect(-6,-4,SKIN_EDGE_WORLD_WIDTH+12,8);ctx.clip();
  // Follow the same local silhouette through the entire section, rather
  // than repeating straight tiles that jump sideways at each new landmark.
  const offset=(y:number)=>{
   if(!p.offsets)return 0;
   const t=Math.max(0,Math.min(p.offsets.length-1,(y+4)*SKIN_EDGE_NATIVE_FACTOR));
   const i=Math.floor(t),j=Math.min(p.offsets.length-1,i+1);
   return p.offsets[i]+(p.offsets[j]-p.offsets[i])*(t-i);
  };
  const line=(color:string,width:number,points:number[])=>{
   ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
   ctx.moveTo(points[0]+offset(points[1]),points[1]);
   for(let i=2;i<points.length;i+=2)ctx.lineTo(points[i]+offset(points[i+1]),points[i+1]);
   ctx.stroke();
  };
  const oval=(x:number,y:number,rx:number,ry:number,color:string)=>{
   ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x+offset(y),y,rx,ry,0,0,Math.PI*2);ctx.fill();
  };
  ctx.globalAlpha=opacity*.85;
  // Dermal capillary loop, returning to a deeper vascular plexus.
  ctx.strokeStyle="#b64260";ctx.lineWidth=.045;ctx.beginPath();
  ctx.moveTo(1.4+offset(-3.7),-3.7);ctx.lineTo(.85+offset(-3.7),-3.7);
  ctx.bezierCurveTo(.45+offset(-3.7),-3.7,.45+offset(-2.9),-2.9,.85+offset(-2.9),-2.9);
  ctx.lineTo(1.4+offset(-2.9),-2.9);ctx.stroke();
  line("#bd4561",.055,[1.42,-4,1.42,4]);
  line("#547da9",.05,[1.53,-4,1.53,4]);
  // Lobules of subcutaneous adipocytes, deeper than the dermis.
  for(let row=0;row<9;row++)for(let col=0;col<2;col++){
   const x=1.95+col*.55,y=-3.7+row*.87+col*.12;
   oval(x,y,.26,.40,"#dcb574");oval(x,y,.23,.36,"#ffedb2");
   if(lod.cells>.005){ctx.globalAlpha=lod.cells;oval(x+.19,y,.025,.055,"#987451");}
   ctx.globalAlpha=opacity*.85;
  }
  if(lod.appendages>.005){
   ctx.globalAlpha=lod.appendages;
   // Hair-bearing trunk/limb sample only: do not invent follicles on
   // the hands, feet or face in this schematic registered outline.
   if((p.y>140&&p.y<290)||(p.y>390&&p.y<510)){
   // Oblique hair follicle with bulb and a central dermal papilla.
   line("#9b5870",.25,[.07,-1.6,.65,-.9,1.28,-.35,1.77,.12]);
   oval(1.77,.12,.20,.29,"#93506b");
   line("#e6b7b5",.16,[.07,-1.6,.65,-.9,1.28,-.35,1.77,.12]);
   line("#594137",.065,[.02,-1.75,.65,-.9,1.28,-.35,1.74,.1]);
   oval(1.85,.15,.075,.13,"#d78b91");
   // Sebaceous acini connect to the upper follicle, not the skin surface.
   for(let i=0;i<4;i++)oval(.85+(i%2)*.19,-1.6+Math.floor(i/2)*.24,
    .14,.17,"#f7d698");
   line("#a57a54",.05,[.87,-1.22,.66,-.9]);
   // Smooth arrector pili muscle attaches to the follicle.
   line("#b8636d",.09,[.5,.5,1.28,-.35]);
   }
   // Eccrine secretory coil in deep dermis; duct opens onto the surface.
   line("#876c9c",.065,[1.35,2.35,.9,2.35,.72,2.55,.5,2.35,.3,2.5,0,2.4]);
   for(let i=0;i<7;i++){
    ctx.strokeStyle="#876c9c";ctx.lineWidth=.055;ctx.beginPath();
    ctx.ellipse(1.15+(i%2)*.23+offset(1.6+Math.floor(i/2)*.23),1.6+Math.floor(i/2)*.23,.19,.16,.25,0,Math.PI*2);ctx.stroke();
   }
   // Sensory nerve in dermis, branching toward the epidermal junction.
   line("#bf8a38",.035,[1.55,3.8,.95,3.5,.65,3.1,.44,3.05]);
   line("#bf8a38",.025,[.95,3.5,.58,3.75,.44,3.85]);
  }
  if(lod.fibres>.005){
   ctx.globalAlpha=lod.fibres*.6;
   for(let i=0;i<23;i++){
    const y=-3.8+i*.34;
    line("#b46f80",.012,[.55,y,.77,y+.13,1.03,y-.08,1.33,y+.08]);
   }
   // Basement membrane separates epidermis from papillary dermis.
   line("#784c79",.018,[.43,-4,.43,4]);
  }
  if(lod.cells>.005){
   ctx.globalAlpha=lod.cells;
   // Thin skin: corneum, granulosum, spinosum, basale; no lucidum.
   for(let i=0;i<80;i++){
    const y=-4+i*.10;
    line("#efd4be",.012,[.01,y,.075,y+.025]); // anucleate corneocytes
    oval(.105,y+.02,.025,.035,"#7e466d"); // keratohyalin granules
    for(let j=0;j<2;j++){
     const cy=y+(j%2)*.045,cx=.18+j*.09;
     oval(cx,cy,.043,.046,"#eec0b9");oval(cx,cy,.012,.018,"#91577e");
    }
    oval(.382,y,.035,.045,"#b16e90");oval(.382,y,.013,.021,"#633c69");
   }
   // Dendritic melanocyte in the basal layer, pigment in nearby cells.
   oval(.39,.8,.028,.045,"#634536");
   line("#634536",.012,[.39,.8,.30,.65,.22,.60]);
   line("#634536",.012,[.39,.8,.29,.95,.23,1.0]);
  }
  ctx.restore();painted++;
 }
 return painted;
}
