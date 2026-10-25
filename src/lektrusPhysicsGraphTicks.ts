/** Readable, integer-numbered axes for school physics motion diagrams.
 * Major labels always use integer values; extra unlabeled lines provide detail. */
const motionFigureIds=new Set(["physics-motion","physics-speed","physics-accelerated-speed",
  "physics-acceleration","physics-braking","physics-rest"]);
export const isPhysicsMotionGraph=(id:string|undefined)=>!!id&&motionFigureIds.has(id);

export type MotionAxisTicks={labels:number[];grid:number[];labelStep:number;gridStep:number};
export function motionAxisTicks(min:number,max:number,targetLabels=7):MotionAxisTicks{
  if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min)
    return {labels:[],grid:[],labelStep:1,gridStep:1};
  const span=max-min;
  const ideal=Math.max(1,span/Math.max(1,Math.min(11,targetLabels)-1));
  // 1-2-5 decade steps never generate fractional tick labels.
  const power=10**Math.max(0,Math.floor(Math.log10(ideal)));
  const labelStep=[1,2,5,10].map(m=>power*m).find(s=>s>=ideal-1e-9)??power*10;
  const gridStep=labelStep===1?.5:labelStep===2?1:labelStep/5;
  const make=(step:number)=>{
    const first=Math.ceil(min/step-1e-9),last=Math.floor(max/step+1e-9);
    const result:number[]=[];
    for(let i=first;i<=last&&result.length<160;i++)result.push(Number((i*step).toFixed(8)));
    return result;
  };
  return {labels:make(labelStep),grid:make(gridStep),labelStep,gridStep};
}
