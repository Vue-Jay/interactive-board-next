/** Ion product of ordinary liquid water near atmospheric pressure.
 * IAPWS R11-24 (2024), tabulated pKw along 0.1 MPa / saturated-liquid
 * boundary. Tabulated values are reference thermodynamic values, NOT a
 * general model for ion activities in concentrated electrolyte solutions.
 * https://iapws.org/technical-guidance/release/Ionization
 * https://iapws.org/documents/release/Ionization.download
 * Interpolation is linear in log(Kw), so it remains positive and monotonic
 * over the school-laboratory 0–100 °C range. Outside it we return undefined
 * rather than extrapolating through boiling or a change of phase.
 */
const referencePkw=[
 {temperatureC:0,pKw:14.95},
 {temperatureC:25,pKw:13.99},
 {temperatureC:50,pKw:13.26},
 {temperatureC:75,pKw:12.70},
 {temperatureC:100,pKw:12.25}
] as const;
export const LAB_WATER_IONIZATION_REFERENCE=referencePkw;
export function labWaterPKw(temperatureC:number):number|undefined{
 if(!Number.isFinite(temperatureC)||temperatureC<0||temperatureC>100)return;
 if(temperatureC===100)return referencePkw[4].pKw;
 for(let i=1;i<referencePkw.length;i++){
  const low=referencePkw[i-1],high=referencePkw[i];
  if(temperatureC<=high.temperatureC){
   const f=(temperatureC-low.temperatureC)/
    (high.temperatureC-low.temperatureC);
   return low.pKw+(high.pKw-low.pKw)*f;
  }
 }
}
export function labWaterIonProduct(temperatureC:number):number|undefined{
 const pKw=labWaterPKw(temperatureC);
 return pKw===undefined?undefined:Math.pow(10,-pKw);
}
export function labNeutralWaterPH(temperatureC:number):number|undefined{
 const pKw=labWaterPKw(temperatureC);
 return pKw===undefined?undefined:pKw/2;
}
