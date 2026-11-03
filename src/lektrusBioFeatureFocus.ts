/** A single camera-to-art contract for all 20 biological organisms.
 * Feature coordinates come from the SAME interactive markers used by the
 * current rendered cell plate. Never fabricate hotspots in photographs.
 */
import type {BioNode,BioOrganism,BioImageSpot} from "./lektrusBioMicroscopeModel";
import {bioCellFeatures,bioChildren,isBioNewOrganism,isBioFurtherOrganism} from "./lektrusBioMicroscopeModel";
import {bioCellPlateFor} from "./lektrusBioCellPlates";
import {bioCoreMicroscopyPlateFor} from "./lektrusBioCoreMicroscopyPlates";
import {bioCoreMicroscopySpot} from "./LektrusBioCoreMicroscopyArt";
import {lineageMicroSpots} from "./LektrusBioLineageMicroscopy";

export function bioFeatureSpotFor(
 organism:BioOrganism,node:BioNode,nodes:BioNode[],featureName:string
):BioImageSpot|null{
 if(node.level!=="cell"||!node.id.startsWith(organism+"/"))return null;
 const features=bioCellFeatures(node);
 const index=features.findIndex(item=>item.name===featureName);
 if(index<0||index>=3)return null;
 // The first eight follow the existing cell-plate landmark map. This is the
 // exact coordinate that LektrusBioCellDetail uses to draw each numbered pin.
 const specific=bioCellPlateFor(organism,node);
 if(specific)return specific.landmarks[featureName]??null;
 // The original four share the same 12 histology types and real pin data.
 const core=bioCoreMicroscopyPlateFor(organism,node);
 if(core)return bioCoreMicroscopySpot(core.kind,index);
 // The two later sets of eight use three different lineages per species.
 // Find a branch by actual parent graph, not a generic cell name, because
 // several species have "Кератиноцит" or "Ризодерма" in separate paths.
 if(isBioNewOrganism(organism)||isBioFurtherOrganism(organism)){
  const systems=bioChildren(nodes,organism);
  const systemId=organism+"/"+node.id.split("/")[1];
  const branch=systems.findIndex(system=>system.id===systemId);
  if(branch<0||branch>=3)return null;
  return lineageMicroSpots(organism,branch)[index]??null;
 }
 return null;
}
