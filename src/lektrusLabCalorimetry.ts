/** Calorimetry for explicitly measured pure materials, near ambient pressure.
 *
 * q = m * c * delta(T), C = sum(m_i*c_i) + C_vessel.
 * Specific heats (J/g/K) from OpenStax Chemistry 2e §5.1 / Physics §11.2:
 * https://openstax.org/books/chemistry-2e/pages/5-1-energy-basics
 * https://openstax.org/books/physics/pages/11-2-heat-specific-heat-and-heat-transfer
 * Methanol heat capacity: https://www.engineeringtoolbox.com/methanol-CH3OH-specific-heat-capacity-Cp-Cv-isobaric-isochoric-d_2103.html
 *
 * Only entries with a verified density AND specific heat are accepted for
 * weighed liquid portions. Glassware mass and heater contact factors are
 * explicit EDUCATIONAL apparatus assumptions, not claimed measurements.
 * Prepared stock solutions, unverified powders and unknown mixtures use the
 * existing cautious legacy relaxation rather than fabricated material data.
 */
type HeatDose={value:number;unit:"ml"|"g";concentrationM?:number};
type SubstanceHeat={specificJPerGK:number;densityGPerMl?:number;phase:"liquid"|"solid"};
export const LAB_CALORIMETRY_REFERENCE:Readonly<Record<string,SubstanceHeat>>={
 H2O:{specificJPerGK:4.184,densityGPerMl:.997,phase:"liquid"},
 C2H5OH:{specificJPerGK:2.376,densityGPerMl:.789,phase:"liquid"},
 CH3OH:{specificJPerGK:2.53,densityGPerMl:.792,phase:"liquid"},
 Al:{specificJPerGK:.897,phase:"solid"},
 Fe:{specificJPerGK:.449,phase:"solid"},
 Cu:{specificJPerGK:.385,phase:"solid"},
 Ag:{specificJPerGK:.235,phase:"solid"},
 Au:{specificJPerGK:.129,phase:"solid"},
 Si:{specificJPerGK:.712,phase:"solid"}
};
/** Effective glass + utensil thermal mass by vessel type, grams of glass
 * equivalent (c_glass≈0.84 J/g/K). Intended for comparative teaching only. */
export const LAB_VESSEL_GLASS_EQUIVALENT_G:Readonly<Record<string,number>>={
 beaker:65,tube:22,flask:70,conical:70,volumetric:75,
 dish:38,cylinder:75,pipette:12,burette:40,crucible:25
};
const glassCp=.84;
export function labKnownHeatCapacityJPerK(kind:string,doses?:Record<string,HeatDose>){
 if(!doses)return;
 const entries=Object.entries(doses).filter(([,d])=>d.value>0);
 if(!entries.length)return;
 const glass=LAB_VESSEL_GLASS_EQUIVALENT_G[kind];
 if(glass===undefined)return;
 let capacity=glass*glassCp;
 for(const [id,d] of entries){
  if(!Number.isFinite(d.value)||d.value<=0||d.concentrationM!==undefined)return;
  const material=LAB_CALORIMETRY_REFERENCE[id];
  if(!material||material.phase!==(d.unit==="ml"?"liquid":"solid"))return;
  const mass=d.unit==="ml"?d.value*material.densityGPerMl!:d.value;
  capacity+=mass*material.specificJPerGK;
 }
 return Number.isFinite(capacity)?capacity:undefined;
}
/** Deterministic bounded heat-exchange step, second-based, no hidden clock.
 * Contact efficiency and ambient conductance are explicit simulation
 * settings, not universal thermophysical constants or calibrated hardware.
 * No heating above contact plate temperature; latent heats/boiling plateaus
 * are applied separately by the evaporation/phase model. */
export function labSensibleHeatStep(
 kind:string,doses:Record<string,HeatDose>|undefined,
 currentC:number,ambientC:number,seconds:number,
 heater?:{kind:"hotplate"|"burner";temperatureC:number;powerW:number}
):{temperatureC:number;capacityJPerK:number;heaterWattsToContents:number}|undefined{
 const capacity=labKnownHeatCapacityJPerK(kind,doses);
 if(capacity===undefined||!Number.isFinite(currentC)||!Number.isFinite(ambientC)||
  !Number.isFinite(seconds)||seconds<0||!Number.isFinite(heater?.temperatureC??ambientC)||
  // These room-temperature heat capacities are not high-temperature curves.
  currentC>220||currentC<0)return;
 const dt=Math.min(10,seconds);
 const hot=heater&&heater.powerW>0&&heater.temperatureC>currentC;
 const powerW=hot?
  Math.min(heater.powerW*(heater.kind==="hotplate"?.75:.55),
   (heater.temperatureC-currentC)*(heater.kind==="hotplate"?4:2.6)):0;
 const ambientLossW=(currentC-ambientC)*.11;
 const temperatureC=currentC+dt*(powerW-ambientLossW)/capacity;
 const bound=hot?Math.min(temperatureC,heater.temperatureC):
  Math.max(ambientC,temperatureC);
 return {temperatureC:Math.max(0,bound),
  capacityJPerK:capacity,heaterWattsToContents:powerW};
}
