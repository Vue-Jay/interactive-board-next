import type {ImageCropRect,Item} from "./boardModel";

/** Reframe a visible image against the SAME untouched source asset.
 * Crop coordinates are normalized to the original, not to the last crop.
 * The object may be rotated; its center shifts in the rotated local axes. */
export function placeImageCrop(
 item: Pick<Item,"x"|"y"|"width"|"height"|"rotation"|"imageCrop">,
 crop: ImageCropRect
): Pick<Item,"x"|"y"|"width"|"height"|"imageCrop"> {
 const previous=item.imageCrop??{x:0,y:0,width:1,height:1};
 const nextWidth=Math.max(24,item.width*crop.width/previous.width);
 const nextHeight=Math.max(24,item.height*crop.height/previous.height);
 const localDx=(crop.x+crop.width/2-previous.x-previous.width/2)*item.width/previous.width;
 const localDy=(crop.y+crop.height/2-previous.y-previous.height/2)*item.height/previous.height;
 const angle=(item.rotation??0)*Math.PI/180;
 const rotatedDx=localDx*Math.cos(angle)-localDy*Math.sin(angle);
 const rotatedDy=localDx*Math.sin(angle)+localDy*Math.cos(angle);
 return {
  imageCrop:{...crop},width:nextWidth,height:nextHeight,
  x:item.x+item.width/2+rotatedDx-nextWidth/2,
  y:item.y+item.height/2+rotatedDy-nextHeight/2,
 };
}
