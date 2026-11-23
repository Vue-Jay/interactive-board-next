import type {ImageCropRect} from "./boardModel";

/**
 * Recognize only very large, nearly white or transparent margins. Regular
 * photos, graphics reaching the edges and narrowly bordered pages are left
 * untouched. Returns a non-destructive crop of the original pixels.
 */
export function detectImageContentCrop(pixels:Uint8ClampedArray,width:number,height:number):ImageCropRect|null{
 if(width<24||height<24||pixels.length<width*height*4)return null;
 const columns=new Uint32Array(width),rows=new Uint32Array(height);
 let count=0;
 for(let y=0;y<height;y++){
  for(let x=0;x<width;x++){
   const index=(y*width+x)*4;
   const a=pixels[index+3];
   if(a<32)continue;
   // JPEG compression can make a white scan margin slightly grey.
   if(pixels[index]>=242&&pixels[index+1]>=242&&pixels[index+2]>=242)continue;
   columns[x]++;rows[y]++;count++;
  }
 }
 if(count<Math.max(15,width*height*.001))return null;
 // Ignore isolated compression speckles without erasing one-pixel diagrams.
 const columnThreshold=Math.max(1,Math.floor(height*.003));
 const rowThreshold=Math.max(1,Math.floor(width*.003));
 let left=0,right=width-1,top=0,bottom=height-1;
 while(left<width&&columns[left]<columnThreshold)left++;
 while(right>=left&&columns[right]<columnThreshold)right--;
 while(top<height&&rows[top]<rowThreshold)top++;
 while(bottom>=top&&rows[bottom]<rowThreshold)bottom--;
 if(left>=right||top>=bottom)return null;
 const leftGap=left/width,rightGap=(width-1-right)/width;
 const topGap=top/height,bottomGap=(height-1-bottom)/height;
 // Deliberately do not trim normal page margins or one-sided whitespace.
 const trimHorizontal=leftGap>=.12&&rightGap>=.12&&(leftGap+rightGap)>=.30;
 const trimVertical=topGap>=.12&&bottomGap>=.12&&(topGap+bottomGap)>=.30;
 if(!trimHorizontal&&!trimVertical)return null;
 // A modest safety margin prevents anti-aliased glyphs touching crop edges.
 const padX=Math.max(2,Math.round(width*.016));
 const padY=Math.max(2,Math.round(height*.016));
 if(trimHorizontal){left=Math.max(0,left-padX);right=Math.min(width-1,right+padX);}
 else {left=0;right=width-1;}
 if(trimVertical){top=Math.max(0,top-padY);bottom=Math.min(height-1,bottom+padY);}
 else {top=0;bottom=height-1;}
 return {x:left/width,y:top/height,width:(right-left+1)/width,height:(bottom-top+1)/height};
}

/** Read source pixels, never the CSS-scaled viewport or a previously cropped frame. */
export function detectImageContentCropFromElement(image:HTMLImageElement):ImageCropRect|null{
 if(!image.complete||!image.naturalWidth||!image.naturalHeight)return null;
 try{
  const scale=Math.min(1,512/Math.max(image.naturalWidth,image.naturalHeight));
  const width=Math.max(1,Math.round(image.naturalWidth*scale));
  const height=Math.max(1,Math.round(image.naturalHeight*scale));
  const canvas=document.createElement("canvas");
  canvas.width=width;canvas.height=height;
  const context=canvas.getContext("2d",{willReadFrequently:true});
  if(!context)return null;
  context.drawImage(image,0,0,width,height);
  const crop=detectImageContentCrop(context.getImageData(0,0,width,height).data,width,height);
  canvas.width=0;canvas.height=0;
  return crop;
 }catch{
  // Tainted or undecodable media must never block insertion or resizing.
  return null;
 }
}

/** Correct pre-existing padded frames without resizing the bitmap itself. */
export function fitImageFrameAspect<T extends {x:number;y:number;width:number;height:number}>(
 frame:T,ratio:number
):T{
 if(!Number.isFinite(ratio)||ratio<=0||frame.width<=0||frame.height<=0)return frame;
 const oldRatio=frame.width/frame.height;
 if(Math.abs(Math.log(oldRatio/ratio))<.025)return frame;
 if(oldRatio>ratio){
  const width=frame.height*ratio;
  return {...frame,x:frame.x+(frame.width-width)/2,width};
 }
 const height=frame.width/ratio;
 return {...frame,y:frame.y+(frame.height-height)/2,height};
}
