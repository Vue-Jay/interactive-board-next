/** School-level aqueous freezing-point depression.
 * Pure water freezes at 0°C; dissolved solutes lower that point.
 * This intentionally does NOT pretend alcohol, oils or unknown mixtures
 * become water ice at 0°C. No invented calibrated microscope/physics.
 *
 * Ideal colligative approximation is limited to dilute, nonreacting aqueous
 * samples with measured doses and known solute molar masses. Real brines
 * crystallize non-ideally and change composition during ice formation.
 */
import type {LabDose} from "./lektrusChemistryBenchModel";
import {labMolarMass} from "./lektrusLabStoichiometry";
import {labSingleSaltSolubilityGPer100gWater} from "./lektrusLabMaterialConstants";

export type LabAqueousFreezeReference={
 freezingPointC:number;waterMassG:number;
 /** Ideal estimate, not the actual eutectic of an unknown solution. */
 idealized:true;
};
const ICE_KF_C_KG_PER_MOL=1.86;
const WATER_DENSITY_G_ML=.997;
const ION_COUNTS:Readonly<Record<string,number>>={
 NaCl:2,KCl:2,NaBr:2,KI:2,KNO3:2,NaNO3:2,
 NaOH:2,KOH:2,HCl:2,HNO3:2,
 CaCl2:3,MgCl2:3,BaCl2:3,Na2SO4:3,K2SO4:3,
 Ca(NO3)2:3,CuSO4:2,AgNO3:2,Na2CO3:3,NaHCO3:2,
 H2SO4:3,FeCl3:4,AlCl3:4
};
type DoseInput=Record<string,Pick<LabDose,"unit"|"value"|"concentrationM">>;
export function labAqueousFreezeReference(
 doses:DoseInput|undefined,
):LabAqueousFreezeReference|undefined{
 if(!doses)return undefined;
 let waterMl=0,soluteParticlesMol=0;
 const dry:{id:string;g:number}[]=[];
 for(const [id,d] of Object.entries(doses)){
  if(!Number.isFinite(d.value)||d.value<=0)return undefined;
  if(id==="H2O"&&d.unit==="ml"&&d.concentrationM===undefined){
   waterMl+=d.value;
  }else if(d.unit==="ml"&&d.concentrationM!==undefined&&
     Number.isFinite(d.concentrationM)&&d.concentrationM>=0&&d.concentrationM<=2){
   // Prepared cabinet stock concentrations are explicitly measured. Count
   // its aqueous carrier as water and the dissolved formula as solute.
   if(!labMolarMass(id))return undefined;
   waterMl+=d.value;
   soluteParticlesMol+=d.value*d.concentrationM/1000*(ION_COUNTS[id]??1);
  }else if(d.unit==="g"){
   dry.push({id,g:d.value});
  }else{
   // A non-aqueous neat liquid (e.g. ethanol) is NOT pure water. Avoid a
   // fictitious water freezing plateau for unreviewed solvent blends.
   return undefined;
  }
 }
 if(waterMl<=1e-9)return undefined;
 const waterMassG=waterMl*WATER_DENSITY_G_ML;
 for(const {id,g} of dry){
  const mm=labMolarMass(id);
  const solubility=labSingleSaltSolubilityGPer100gWater(id,22);
  // Insoluble suspended solids sit on the bottom but do not lower the
  // water's freezing point. Unsupported salts do not get invented curves.
  if(!mm||solubility===undefined)continue;
  const dissolvedG=Math.min(g,Math.max(0,solubility)*waterMassG/100);
  soluteParticlesMol+=dissolvedG/mm*(ION_COUNTS[id]??1);
 }
 const molality=soluteParticlesMol/(waterMassG/1000);
 // Cap the ideal estimate to a plausible school demonstration range.
 // For highly concentrated real mixtures a calibrated phase diagram would
 // be needed; at -100°C almost all familiar dilute stocks freeze anyway.
 const freezingPointC=Math.round(-Math.min(35,ICE_KF_C_KG_PER_MOL*molality)*10)/10;
 return {freezingPointC:Object.is(freezingPointC,-0)?0:freezingPointC,
  waterMassG,idealized:true};
}
