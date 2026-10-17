import type {GraphDraft} from "./LektrusGraphEditor";

export type ConstructionKind="circle"|"polygon"|"segment"|"angle"|"midpoint";
type Geometry=Pick<GraphDraft,"points"|"segments"|"circles"|"polygons"|"angles"|"midpoints">;

/** Removing a shape also removes points used exclusively by it.
 * A point shared with another shape, its midpoint or another relation survives.
 * Existing unrelated free points are untouched.
 */
export function removeConstruction<T extends Geometry>(geometry:T,kind:ConstructionKind,index:number):T {
  const current=geometry[kind==="circle"?"circles":kind==="polygon"?"polygons":kind==="segment"?"segments":kind==="angle"?"angles":"midpoints"];
  if(!Number.isInteger(index)||index<0||index>=current.length)return geometry;
  let segments=geometry.segments.filter((_,i)=>kind!=="segment"||i!==index);
  let circles=geometry.circles.filter((_,i)=>kind!=="circle"||i!==index);
  let polygons=geometry.polygons.filter((_,i)=>kind!=="polygon"||i!==index);
  let angles=geometry.angles.filter((_,i)=>kind!=="angle"||i!==index);
  let midpoints=geometry.midpoints.filter((_,i)=>kind!=="midpoint"||i!==index);

  // An independently created angle has two supporting rays. Only remove them
  // when there is no other angle that still needs the same rays.
  if(kind==="angle"){
    const removed=geometry.angles[index];
    const pairs=[[removed.vertex,removed.a],[removed.vertex,removed.b]];
    const shared=(a:number,b:number)=>angles.some(v=>
      v.vertex===a&&(v.a===b||v.b===b));
    segments=segments.filter(segment=>
      segment.kind!=="ray"||!pairs.some(([a,b])=>
        segment.a===a&&segment.b===b&&!shared(a,b)));
  }

  // A shape's schoolbook angle mark, edge or radius is part of that shape.
  // Drop these dependent relations before computing which vertices are orphaned.
  // A point that belongs to a different primary polygon or circle is protected.
  if(kind==="polygon"||kind==="circle"||kind==="segment"){
    const source=kind==="polygon"?geometry.polygons[index].points:
      kind==="circle"?[geometry.circles[index].center,geometry.circles[index].edge]:
      [geometry.segments[index].a,geometry.segments[index].b];
    const owned=new Set(source);
    const independentlyOwned=new Set<number>();
    for(const polygon of polygons)for(const point of polygon.points)independentlyOwned.add(point);
    for(const circle of circles){independentlyOwned.add(circle.center);independentlyOwned.add(circle.edge)}
    const dependent=(points:number[])=>points.length>0&&
      points.every(i=>owned.has(i))&&points.some(i=>!independentlyOwned.has(i));
    if(kind!=="segment"){
      segments=segments.filter(v=>!dependent([v.a,v.b]));
    }
    angles=angles.filter(v=>!dependent([v.a,v.vertex,v.b]));
    midpoints=midpoints.filter(v=>!dependent([v.a,v.b]));
  }

  const refs=(data:Geometry)=>{
    const result=new Set<number>();
    for(const v of data.segments){result.add(v.a);result.add(v.b)}
    for(const v of data.circles){result.add(v.center);result.add(v.edge)}
    for(const v of data.angles){result.add(v.a);result.add(v.vertex);result.add(v.b)}
    for(const v of data.midpoints){result.add(v.a);result.add(v.b)}
    for(const v of data.polygons)for(const i of v.points)result.add(i);
    return result;
  };
  const before=refs(geometry),after=refs({...geometry,segments,circles,polygons,angles,midpoints});
  const removedPoints=new Set([...before].filter(i=>!after.has(i)));
  const remap=new Map<number,number>();
  const points=geometry.points.filter((_,i)=>{
    if(removedPoints.has(i))return false;
    remap.set(i,remap.size);return true;
  });
  const indexOf=(i:number)=>remap.get(i)??i;
  return {...geometry,points,
    segments:segments.map(v=>({...v,a:indexOf(v.a),b:indexOf(v.b)})),
    circles:circles.map(v=>({...v,center:indexOf(v.center),edge:indexOf(v.edge)})),
    angles:angles.map(v=>({...v,a:indexOf(v.a),vertex:indexOf(v.vertex),b:indexOf(v.b)})),
    midpoints:midpoints.map(v=>({...v,a:indexOf(v.a),b:indexOf(v.b)})),
    polygons:polygons.map(v=>({...v,points:v.points.map(indexOf)}))
  };
}

/** Delete an entire school construction, including its segments, arcs and
 * private vertices, while preserving vertices reused by unrelated objects.
 */
export function removeSchoolConstructionGroup<T extends Geometry>(geometry:T,schoolGroupId:string):T {
  if(!schoolGroupId||schoolGroupId.length>64)return geometry;
  const remains=<V extends {schoolGroupId?:string}>(list:V[])=>list.filter(item=>item.schoolGroupId!==schoolGroupId);
  const segments=remains(geometry.segments),circles=remains(geometry.circles),
    polygons=remains(geometry.polygons),angles=remains(geometry.angles),
    midpoints=remains(geometry.midpoints);
  const referenced=new Set<number>();
  for(const segment of segments){referenced.add(segment.a);referenced.add(segment.b)}
  for(const circle of circles){referenced.add(circle.center);referenced.add(circle.edge)}
  for(const polygon of polygons)for(const index of polygon.points)referenced.add(index);
  for(const angle of angles){referenced.add(angle.a);referenced.add(angle.vertex);referenced.add(angle.b)}
  for(const midpoint of midpoints){referenced.add(midpoint.a);referenced.add(midpoint.b)}
  const remap=new Map<number,number>();
  const points=geometry.points.flatMap((point,index)=>{
    if(point.schoolGroupId===schoolGroupId&&!referenced.has(index))return [];
    const next=point.schoolGroupId===schoolGroupId?{...point,schoolGroupId:undefined,schoolGroupLabel:undefined}:point;
    remap.set(index,remap.size);
    return [next];
  });
  const shift=(index:number)=>remap.get(index)??index;
  return {...geometry,points,
    segments:segments.map(s=>({...s,a:shift(s.a),b:shift(s.b)})),
    circles:circles.map(c=>({...c,center:shift(c.center),edge:shift(c.edge)})),
    polygons:polygons.map(p=>({...p,points:p.points.map(shift)})),
    angles:angles.map(a=>({...a,a:shift(a.a),vertex:shift(a.vertex),b:shift(a.b)})),
    midpoints:midpoints.map(m=>({...m,a:shift(m.a),b:shift(m.b)}))
  };
}
