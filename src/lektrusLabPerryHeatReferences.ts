/** Transcription of Perry's Chemical Engineers' Handbook, Section 2,
 * Table 2-194 (pp. 2-161–2-168). University of Maryland mirror:
 * https://terpconnect.umd.edu/~nsw/chbe301/chap02.pdf
 *
 * Cp_molar = a+b*T+c/(T*T)+d*T*T, T in Kelvin,
 * Cp_molar in thermochemical cal/(mol K).
 * Cp_mass in J/(g K)=Cp_molar * 4.184 / molarMass_g_per_mol.
 *
 * All records are experimentally tabulated, CRYSTALLINE SOLID forms.
 * Each range includes 298.15 K. These are source measurements at
 * room temperature, not claims of constant Cp for arbitrary heating,
 * aqueous solutions, molten salt or different hydrates/polymorphs.
 */
export const LAB_PERRY_HANDBOOK_SOURCE =
 "https://terpconnect.umd.edu/~nsw/chbe301/chap02.pdf";
export type LabPerrySolidHeatReference={
 formula:string;roomHeatJPerGK:number;
 a:number;b:number;c:number;d:number;
 minKelvin:number;maxKelvin:number;phase:"solid";sourceUrl:string;
};
export const LAB_PERRY_SOLID_HEAT_REFERENCES:readonly LabPerrySolidHeatReference[]=[
 {formula:"AlCl3",roomHeatJPerGK:0.677761,a:13.25,b:0.028,c:0,d:0,
  minKelvin:273,maxKelvin:465,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"Al2(SO4)3",roomHeatJPerGK:0.776556,a:63.5,b:0,c:0,d:0,
  minKelvin:273,maxKelvin:373,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"AgBr",roomHeatJPerGK:0.284855,a:8.58,b:0.0141,c:0,d:0,
  minKelvin:273,maxKelvin:703,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"AgI",roomHeatJPerGK:0.227828,a:8.58,b:0.0141,c:0,d:0,
  minKelvin:273,maxKelvin:423,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"AgNO3",roomHeatJPerGK:0.581284,a:18.83,b:0.016,c:0,d:0,
  minKelvin:273,maxKelvin:433,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"Ag3PO4",roomHeatJPerGK:0.374844,a:37.5,b:0,c:0,d:0,
  minKelvin:293,maxKelvin:325,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"BaSO4",roomHeatJPerGK:0.458121,a:21.35,b:0.0141,c:0,d:0,
  minKelvin:273,maxKelvin:1323,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"CoS",roomHeatJPerGK:0.521814,a:10.6,b:0.00251,c:0,d:0,
  minKelvin:273,maxKelvin:1373,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"CuS",roomHeatJPerGK:0.498334,a:10.6,b:0.00264,c:0,d:0,
  minKelvin:273,maxKelvin:1273,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"FeO",roomHeatJPerGK:0.71094,a:12.62,b:0.001492,c:-76200,d:0,
  minKelvin:273,maxKelvin:1173,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"FeS2",roomHeatJPerGK:0.512107,a:10.7,b:0.01336,c:0,d:0,
  minKelvin:273,maxKelvin:773,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"FeSO4",roomHeatJPerGK:0.605974,a:22,b:0,c:0,d:0,
  minKelvin:293,maxKelvin:373,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"Fe2(SO4)3",roomHeatJPerGK:0.692698,a:66.2,b:0,c:0,d:0,
  minKelvin:273,maxKelvin:373,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"LiNO3",roomHeatJPerGK:1.207876,a:9.17,b:0.036,c:0,d:0,
  minKelvin:273,maxKelvin:523,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"MgCl2",roomHeatJPerGK:0.809686,a:17.3,b:0.00377,c:0,d:0,
  minKelvin:273,maxKelvin:991,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"MgSO4",roomHeatJPerGK:0.928148,a:26.7,b:0,c:0,d:0,
  minKelvin:296,maxKelvin:372,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"MnO2",roomHeatJPerGK:0.641187,a:1.92,b:0.0471,c:0,d:-0.0000297,
  minKelvin:273,maxKelvin:773,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"MnSO4",roomHeatJPerGK:0.762017,a:27.5,b:0,c:0,d:0,
  minKelvin:293,maxKelvin:373,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"NiS",roomHeatJPerGK:0.514424,a:9.25,b:0.0064,c:0,d:0,
  minKelvin:273,maxKelvin:597,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"NiSO4",roomHeatJPerGK:0.903045,a:33.4,b:0,c:0,d:0,
  minKelvin:293,maxKelvin:373,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"PbBr2",roomHeatJPerGK:0.217224,a:18.13,b:0.0031,c:0,d:0,
  minKelvin:273,maxKelvin:761,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"PbCl2",roomHeatJPerGK:0.276369,a:15.88,b:0.00835,c:0,d:0,
  minKelvin:273,maxKelvin:771,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"PbO",roomHeatJPerGK:0.211415,a:10.33,b:0.00318,c:0,d:0,
  minKelvin:273,maxKelvin:544,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"PbS",roomHeatJPerGK:0.206797,a:10.63,b:0.00401,c:0,d:0,
  minKelvin:273,maxKelvin:873,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"PbSO4",roomHeatJPerGK:0.364239,a:26.4,b:0,c:0,d:0,
  minKelvin:293,maxKelvin:372,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"KMnO4",roomHeatJPerGK:0.741317,a:28,b:0,c:0,d:0,
  minKelvin:287,maxKelvin:318,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"NaBr",roomHeatJPerGK:0.505635,a:11.74,b:0.00233,c:0,d:0,
  minKelvin:273,maxKelvin:543,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"NaF",roomHeatJPerGK:1.122191,a:10.4,b:0.00289,c:0,d:0,
  minKelvin:273,maxKelvin:1261,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"SrCl2",roomHeatJPerGK:0.499575,a:18.2,b:0.00244,c:0,d:0,
  minKelvin:273,maxKelvin:1143,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"SrCO3",roomHeatJPerGK:0.617845,a:21.8,b:0,c:0,d:0,
  minKelvin:281,maxKelvin:371,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"ZnCl2",roomHeatJPerGK:0.561383,a:15.9,b:0.008,c:0,d:0,
  minKelvin:273,maxKelvin:638,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"ZnO",roomHeatJPerGK:0.502848,a:11.4,b:0.00145,c:-182400,d:0,
  minKelvin:273,maxKelvin:1573,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"ZnS",roomHeatJPerGK:0.468214,a:12.81,b:0.00095,c:-194600,d:0,
  minKelvin:273,maxKelvin:1173,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE},
 {formula:"ZnSO4",roomHeatJPerGK:0.725687,a:28,b:0,c:0,d:0,
  minKelvin:293,maxKelvin:373,phase:"solid",sourceUrl:LAB_PERRY_HANDBOOK_SOURCE}
];
export const labPerryMolarHeatCalPerMolK=(row:LabPerrySolidHeatReference,t:number)=>
 Number.isFinite(t)&&t>=row.minKelvin&&t<=row.maxKelvin?
 row.a+row.b*t+row.c/(t*t)+row.d*t*t:undefined;
