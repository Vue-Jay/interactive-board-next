/** Seven traceable room-temperature heat capacities from the NIST Chemistry
 * WebBook SRD 69. The underlying reported molar values are in J/(mol*K);
 * the laboratory stores specific Cp in J/(g*K), converted using the actual
 * formula parser. Pure anhydrous CRYSTALS only, not aqueous stock solutions,
 * hydrates, molten phases, or generic glucose isomers.
 *
 * Shomate: Cp,mol = A+B*t+C*t²+D*t³+E/t², t=T/1000, T=298.15 K.
 * For direct experimental data, Cp,mol is the source's 298.15 K value.
 * Six-decimal specific Cp values are audited against both kinds of sources.
 */
export type LabNistRoomHeatReference={
 formula:string;
 form:string;
 phase:"solid";
 minKelvin:number;
 maxKelvin:number;
 sourceUrl:string;
 roomHeatJPerGK:number;
 molarHeatJPerMolK?:number;
 shomate?:readonly [number,number,number,number,number];
};
export const LAB_NIST_ROOM_HEAT_REFERENCES:readonly LabNistRoomHeatReference[]=[
 {formula:"LiOH",form:"anhydrous lithium hydroxide crystal",phase:"solid",
  minKelvin:298,maxKelvin:744.3,roomHeatJPerGK:2.070231,
  shomate:[51.39416,32.37931,0.789241,-0.230311,-1.025499],
  sourceUrl:"https://webbook.nist.gov/cgi/cbook.cgi?ID=C1310652&Table=on&Type=JANAFS"},
 {formula:"KI",form:"anhydrous potassium iodide crystal",phase:"solid",
  minKelvin:298,maxKelvin:954,roomHeatJPerGK:0.317878,
  shomate:[73.62376,-85.43644,130.0973,-48.86619,-0.502415],
  sourceUrl:"https://webbook.nist.gov/cgi/cbook.cgi?ID=C7681110&Table=on&Type=JANAFS"},
 {formula:"Li2CO3",form:"anhydrous lithium carbonate crystal",phase:"solid",
  minKelvin:298,maxKelvin:683,roomHeatJPerGK:1.302975,
  shomate:[68.33230,146.6390,-162.5730,248.0260,-0.702297],
  sourceUrl:"https://webbook.nist.gov/cgi/cbook.cgi?ID=C554132&Table=on&Type=JANAFS"},
 {formula:"CH3COONa",form:"anhydrous crystalline sodium acetate",phase:"solid",
  minKelvin:7,maxKelvin:350,roomHeatJPerGK:1.229128,molarHeatJPerMolK:100.83,
  sourceUrl:"https://webbook.nist.gov/cgi/cbook.cgi?ID=C127093&Mask=2"},
 {formula:"CH3COOK",form:"anhydrous crystalline potassium acetate",phase:"solid",
  minKelvin:4,maxKelvin:585,roomHeatJPerGK:1.114504,molarHeatJPerMolK:109.38,
  sourceUrl:"https://webbook.nist.gov/cgi/cbook.cgi?ID=C127082&Mask=2"},
 {formula:"C6H12O6",form:"anhydrous crystalline alpha-D-glucose",phase:"solid",
  minKelvin:7,maxKelvin:347,roomHeatJPerGK:1.216668,molarHeatJPerMolK:219.19,
  sourceUrl:"https://webbook.nist.gov/cgi/cbook.cgi?ID=C492626&Mask=2"},
 {formula:"C12H22O11",form:"crystalline sucrose",phase:"solid",
  minKelvin:10,maxKelvin:340,roomHeatJPerGK:1.239567,molarHeatJPerMolK:424.30,
  sourceUrl:"https://webbook.nist.gov/cgi/cbook.cgi?ID=C57501&Mask=2"}
];
export function labNistMolarHeatAt298K(row:LabNistRoomHeatReference):number{
 if(row.shomate){
  const [a,b,c,d,e]=row.shomate;
  const t=298.15/1000;
  return a+b*t+c*t*t+d*t*t*t+e/(t*t);
 }
 if(row.molarHeatJPerMolK===undefined)
  throw new Error("No NIST molar heat source for "+row.formula);
 return row.molarHeatJPerMolK;
}
