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
 // NIST-JANAF directly measured Cp of dry Na2O and alpha-Li2SO4
 // crystals at 298.15 K: not hydration/solution heat capacity.
 Na2O:{specificJPerGK:1.114950,phase:"solid"},
 Li2SO4:{specificJPerGK:1.069786,phase:"solid"},
 // NIST-JANAF 1998 pure crystal Cp at 298.15 K. Original J/(mol K)
 // and exact solid phases live in lektrusLabJanafSolidHeatReferences.ts.
 // Per-entry conversion uses the real formula parser; these values must
 // NEVER be assigned to aqueous mixtures or hydrated salt crystals.
 "MgCO3":{specificJPerGK:0.903894,phase:"solid"},
 "CuCl2":{specificJPerGK:0.534646,phase:"solid"},
 "FeCl2":{specificJPerGK:0.604868,phase:"solid"},
 "FeCl3":{specificJPerGK:0.595888,phase:"solid"},
 "Ba(OH)2":{specificJPerGK:0.593139,phase:"solid"},
 // NIST Chemistry WebBook SRD 69, pure solid Cp at 298.15 K:
 // Seven phase-specific measurements and original molar values are tracked
 // in lektrusLabNistHeatReferences.ts (six decimals are conversion rounding).
 // Alpha-D-glucose CRYSTALS, not dissolved glucose, hydrates, or other phases.
 // Na/K acetate and LiOH/Li2CO3 are ANHYDROUS dry crystals.
 LiOH:{specificJPerGK:2.070231,phase:"solid"},
 KI:{specificJPerGK:0.317878,phase:"solid"},
 Li2CO3:{specificJPerGK:1.302975,phase:"solid"},
 CH3COONa:{specificJPerGK:1.229128,phase:"solid"},
 CH3COOK:{specificJPerGK:1.114504,phase:"solid"},
 C6H12O6:{specificJPerGK:1.216668,phase:"solid"},
 C12H22O11:{specificJPerGK:1.239567,phase:"solid"},

 H2O:{specificJPerGK:4.184,densityGPerMl:.997,phase:"liquid"},
 C2H5OH:{specificJPerGK:2.376,densityGPerMl:.789,phase:"liquid"},
 CH3OH:{specificJPerGK:2.53,densityGPerMl:.792,phase:"liquid"},
 // CRC/PubChem individually measured neat liquids, ~20–25°C:
 // https://pubchem.ncbi.nlm.nih.gov/compound/3776 (isopropanol 2.604)
 // https://www.bromaid.net/section-1-properties-of-bromaid/ (Br2 .473)
 // https://pubchem.ncbi.nlm.nih.gov/compound/177 (acetaldehyde 1.38)
 // Never use these for dilute prepared solutions or gaseous samples.
 C3H8O:{specificJPerGK:2.604,densityGPerMl:.785,phase:"liquid"},
 Br2:{specificJPerGK:.473,densityGPerMl:3.1055,phase:"liquid"},
 CH3CHO:{specificJPerGK:1.38,densityGPerMl:.7846,phase:"liquid"},
 // Room-temperature elemental-solid c_p, explicitly J/g/K, not J/kg/K.
 // Royal Society of Chemistry individually tabulated elements:
 // https://periodic-table.rsc.org/element/3/lithium
 // https://periodic-table.rsc.org/element/11/sodium
 // https://periodic-table.rsc.org/element/19/potassium
 // https://periodic-table.rsc.org/element/20/calcium
 // https://periodic-table.rsc.org/element/12/magnesium
 // https://periodic-table.rsc.org/element/30/zinc
 // https://periodic-table.rsc.org/element/82/lead
 // https://periodic-table.rsc.org/element/16/sulfur
 Li:{specificJPerGK:3.582,phase:"solid"},
 Na:{specificJPerGK:1.228,phase:"solid"},
 K:{specificJPerGK:.757,phase:"solid"},
 Ca:{specificJPerGK:.647,phase:"solid"},
 Mg:{specificJPerGK:1.023,phase:"solid"},
 Zn:{specificJPerGK:.388,phase:"solid"},
 Pb:{specificJPerGK:.130,phase:"solid"},
 S:{specificJPerGK:.708,phase:"solid"},
 // Solid iodine near room temperature, CRC chemistry heat table:
 // https://www.alloprof.qc.ca/en/students/vl/chemistry/specific-heat-capacity-of-some-substances-c1703
 I2:{specificJPerGK:.214,phase:"solid"},
 Al:{specificJPerGK:.897,phase:"solid"},
 Fe:{specificJPerGK:.449,phase:"solid"},
 Cu:{specificJPerGK:.385,phase:"solid"},
 Ag:{specificJPerGK:.235,phase:"solid"},
 Au:{specificJPerGK:.129,phase:"solid"},
 Si:{specificJPerGK:.712,phase:"solid"},
 // MgO periclase: Kirk-Othmer (27 C) via PubChem CID 14792:
 // 0.92885 kJ/kg/K = 0.92885 J/g/K. Not an arbitrary hydrated mix.
 // https://pubchem.ncbi.nlm.nih.gov/compound/14792
 MgO:{specificJPerGK:.92885,phase:"solid"},
 // NaCl crystalline solid: Kirk-Othmer via PubChem CID 5234, 0.853 J/g/K:
 // https://pubchem.ncbi.nlm.nih.gov/compound/5234
 NaCl:{specificJPerGK:.853,phase:"solid"},
 // Anhydrous (NH4)2SO4, average c_p 2-55°C (Ullmann's) from PubChem:
 // https://pubchem.ncbi.nlm.nih.gov/compound/6097028
 "(NH4)2SO4":{specificJPerGK:1.423,phase:"solid"},
 // University Medical Lublin Lab 6, Calorimetry, table 1, room temp.
 // Specific heat of crystalline/anhydrous salts, J/(g K):
 // https://www.stn.host.umlub.pl/gfx/umlub/userfiles/beatapolak/angielskie/labs_1-10/lab.6/lab_no_6._calorimetry.pdf
 NH4Cl:{specificJPerGK:1.57,phase:"solid"},
 NH4NO3:{specificJPerGK:1.74,phase:"solid"},
 CaCl2:{specificJPerGK:.657,phase:"solid"},
 Na2CO3:{specificJPerGK:1.06,phase:"solid"},
 NaOH:{specificJPerGK:1.49,phase:"solid"},
 Na2SO4:{specificJPerGK:.903,phase:"solid"},
 KBr:{specificJPerGK:.439,phase:"solid"},
 KNO3:{specificJPerGK:.95,phase:"solid"},
 // Published materials table in Velraj et al., Advances in Solar Heating
 // and Cooling (2016), table 15.2. All listed values are J/(g K) for solids:
 // https://www.sciencedirect.com/topics/engineering/solid-storage-material
 Al2O3:{specificJPerGK:.840,phase:"solid"},
 Fe3O4:{specificJPerGK:.752,phase:"solid"},
 KCl:{specificJPerGK:.670,phase:"solid"},
 K2SO4:{specificJPerGK:.920,phase:"solid"},
 // K.K. Kelley, US Bureau of Mines 584 (1960), Pankratz (1982),
 // as tabulated in Smith, Van Ness, Abbott & Swihart, app. C.2:
 // https://www.scribd.com/document/672105614/Smith-Van-Ness-Abbott-and-Swihart-2018-Appendix-C
 // From experimental Cp(298 K)/R to J/(g K):
 // specific Cp = (Cp/R) * 8.314462618 / molarMass(g/mol).
 // Pure crystalline phases, e.g. CaCO3 calcite and SiO2 quartz, not
 // carbonates in solution or hydrated variants.
 CaO:{specificJPerGK:0.749943,phase:"solid"},
 CaCO3:{specificJPerGK:0.818097,phase:"solid"},
 "Ca(OH)2":{specificJPerGK:1.258738,phase:"solid"},
 CuO:{specificJPerGK:0.53172,phase:"solid"},
 FeS:{specificJPerGK:0.621705,phase:"solid"},
 LiCl:{specificJPerGK:1.133202,phase:"solid"},
 NaHCO3:{specificJPerGK:1.043086,phase:"solid"},
 SiO2:{specificJPerGK:0.739641,phase:"solid"},
 Fe2O3:{specificJPerGK:0.649799,phase:"solid"},
 // US Army Materiel Command AMCP 706-106 (1964), appendix A table A-4,
 // independently tabulated room-temperature CAL/(g K) for dry solids.
 // 1 thermochemical calorie = 4.184 J, converted explicitly.
 // https://ru.djvu.online/file/FxAstfSBiPOi2
 BaCO3:{specificJPerGK:0.430952,phase:"solid"},
 BaCl2:{specificJPerGK:0.3661,phase:"solid"},
 "Ba(NO3)2":{specificJPerGK:0.637223,phase:"solid"},
 CaSO4:{specificJPerGK:0.707096,phase:"solid"},
 CuSO4:{specificJPerGK:0.656888,phase:"solid"},
 PbCO3:{specificJPerGK:0.406266,phase:"solid"},
 "Pb(NO3)2":{specificJPerGK:0.490783,phase:"solid"},
 // NIST-JANAF, Chase (1998), solid Shomate 298.15 K at 1 bar:
 // Cp,mol=A+B*t+C*t²+D*t³+E/t², t=298.15/1000;
 // converted to J/(g K) by dividing by molecular weight.
 // https://webbook.nist.gov/cgi/cbook.cgi?ID=C1310583&Mask=2
 KOH:{specificJPerGK:1.156642,phase:"solid"},
 // https://webbook.nist.gov/cgi/cbook.cgi?ID=C1309428&Mask=2
 "Mg(OH)2":{specificJPerGK:1.323907,phase:"solid"},
 // Perry's Chemical Engineers' Handbook, Section 2, Table 2-194, pp 2-161–168.
 // Hosted by University of Maryland:
 // https://terpconnect.umd.edu/~nsw/chbe301/chap02.pdf
 // All are PURE CRYSTALLINE SOLID cp at 298.15 K, J/(g K).
 // Empirical molar Cp formulas, valid T ranges and exact source references
 // live in lektrusLabPerryHeatReferences.ts and are numerically audited.
 AlCl3:{specificJPerGK:0.677761,phase:"solid"},
 "Al2(SO4)3":{specificJPerGK:0.776556,phase:"solid"},
 AgBr:{specificJPerGK:0.284855,phase:"solid"},
 AgI:{specificJPerGK:0.227828,phase:"solid"},
 AgNO3:{specificJPerGK:0.581284,phase:"solid"},
 Ag3PO4:{specificJPerGK:0.374844,phase:"solid"},
 BaSO4:{specificJPerGK:0.458121,phase:"solid"},
 CoS:{specificJPerGK:0.521814,phase:"solid"},
 CuS:{specificJPerGK:0.498334,phase:"solid"},
 FeO:{specificJPerGK:0.71094,phase:"solid"},
 FeS2:{specificJPerGK:0.512107,phase:"solid"},
 FeSO4:{specificJPerGK:0.605974,phase:"solid"},
 "Fe2(SO4)3":{specificJPerGK:0.692698,phase:"solid"},
 LiNO3:{specificJPerGK:1.207876,phase:"solid"},
 MgCl2:{specificJPerGK:0.809686,phase:"solid"},
 MgSO4:{specificJPerGK:0.928148,phase:"solid"},
 MnO2:{specificJPerGK:0.641187,phase:"solid"},
 MnSO4:{specificJPerGK:0.762017,phase:"solid"},
 NiS:{specificJPerGK:0.514424,phase:"solid"},
 NiSO4:{specificJPerGK:0.903045,phase:"solid"},
 PbBr2:{specificJPerGK:0.217224,phase:"solid"},
 PbCl2:{specificJPerGK:0.276369,phase:"solid"},
 PbO:{specificJPerGK:0.211415,phase:"solid"},
 PbS:{specificJPerGK:0.206797,phase:"solid"},
 PbSO4:{specificJPerGK:0.364239,phase:"solid"},
 KMnO4:{specificJPerGK:0.741317,phase:"solid"},
 NaBr:{specificJPerGK:0.505635,phase:"solid"},
 NaF:{specificJPerGK:1.122191,phase:"solid"},
 SrCl2:{specificJPerGK:0.499575,phase:"solid"},
 SrCO3:{specificJPerGK:0.617845,phase:"solid"},
 ZnCl2:{specificJPerGK:0.561383,phase:"solid"},
 ZnO:{specificJPerGK:0.502848,phase:"solid"},
 ZnS:{specificJPerGK:0.468214,phase:"solid"},
 ZnSO4:{specificJPerGK:0.725687,phase:"solid"},

 // U.S. Army Materiel Command AMCP 706-106, appendix A, table A-4:
 // measured room-temp CAL/(g K), thermochemical cal=4.184 J.
 // https://ru.djvu.online/file/FxAstfSBiPOi2
 K2Cr2O7:{specificJPerGK:.761488,phase:"solid"},
 K2CO3:{specificJPerGK:.904581,phase:"solid"},
 AgCl:{specificJPerGK:.367355,phase:"solid"},
 NaNO3:{specificJPerGK:1.083656,phase:"solid"},
 Na2S:{specificJPerGK:.380744,phase:"solid"},
 SrSO4:{specificJPerGK:.597475,phase:"solid"}
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
 // A dry salt's measured c_p is NOT the solution's partial molar heat
 // capacity. Dissolution and ionic hydration change mixture enthalpy, so
 // a water + solid-salt mixture needs separately measured solution data.
 // Otherwise the old cautious relaxation path stays in effect.
 if(entries.some(([,d])=>d.unit==="g")&&
  entries.some(([,d])=>d.unit==="ml"))return;
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
