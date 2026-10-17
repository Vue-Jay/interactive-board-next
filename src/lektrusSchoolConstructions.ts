import type {GraphDraft} from "./LektrusGraphEditor";

/** Geometrically valid school constructions. These work on the existing editable
 * points, lines, circles and polygons, so all results survive board persistence.
 * No answer values are calculated or exposed to pupils.
 */
type Pt={x:number;y:number;label:string;color?:string};
export type SchoolConstruction =
  | "incircle"|"circumcircle"|"centroid"|"incenter"|"circumcenter"
  | "diagonals"|"trapezoid-midline"|"triangle-midline"
  | "orthocenter"|"triangle-altitudes"|"triangle-medians"|"triangle-bisectors"
  | "radius"|"diameter"|"chord"|"tangent"|"secant"|"two-tangents"
  | "central-angle"|"inscribed-angle"|"circumference-midpoint"
  | "inscribed-polygon"|"circumscribed-polygon";
export type SchoolBuildRequest={kind:SchoolConstruction;sides?:3|4|5|6|8};
export type SchoolBuildResult={draft:GraphDraft;error?:string};

const tiny=1e-7;
const hypot=(a:Pt,b:Pt)=>Math.hypot(a.x-b.x,a.y-b.y);
const cross=(a:{x:number;y:number},b:{x:number;y:number})=>a.x*b.y-a.y*b.x;
const diff=(a:Pt,b:Pt)=>({x:b.x-a.x,y:b.y-a.y});
const midpoint=(a:Pt,b:Pt)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const unit=(a:{x:number;y:number})=>{
  const d=Math.hypot(a.x,a.y);
  return d>tiny?{x:a.x/d,y:a.y/d}:null;
};
const perpendicular=(p:Pt,a:Pt,b:Pt)=>{
  const d=diff(a,b),l=Math.hypot(d.x,d.y);
  return l>tiny?Math.abs(cross(d,diff(a,p)))/l:Infinity;
};
const inside=(p:{x:number;y:number},poly:Pt[])=>{
  let positive=false,negative=false;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    const z=cross(diff(a,b),diff(a,p as Pt));
    if(z>tiny)positive=true;
    if(z< -tiny)negative=true;
    if(positive&&negative)return false;
  }
  return true;
};
function circumcenter(a:Pt,b:Pt,c:Pt):{x:number;y:number}|null{
  const det=2*(a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y));
  if(Math.abs(det)<tiny)return null;
  const av=a.x*a.x+a.y*a.y,bv=b.x*b.x+b.y*b.y,cv=c.x*c.x+c.y*c.y;
  return {x:(av*(b.y-c.y)+bv*(c.y-a.y)+cv*(a.y-b.y))/det,
    y:(av*(c.x-b.x)+bv*(a.x-c.x)+cv*(b.x-a.x))/det};
}
function incenter(vertices:Pt[]):{center:{x:number;y:number};radius:number}|null{
  if(vertices.length<3||!inside(midpoint(vertices[0],vertices[2]),vertices))return null;
  const angleDirection=(i:number)=>{
    const n=vertices.length,p=vertices[i];
    const u=unit(diff(p,vertices[(i+n-1)%n])),v=unit(diff(p,vertices[(i+1)%n]));
    return u&&v?unit({x:u.x+v.x,y:u.y+v.y}):null;
  };
  const d0=angleDirection(0),d1=angleDirection(1);
  if(!d0||!d1)return null;
  const a=vertices[0],b=vertices[1],den=cross(d0,d1);
  if(Math.abs(den)<tiny)return null;
  const shift=diff(a,b),t=cross(shift,d1)/den;
  const center={x:a.x+t*d0.x,y:a.y+t*d0.y};
  if(!inside(center,vertices))return null;
  const radius=perpendicular(center as Pt,vertices[0],vertices[1]);
  if(radius<tiny)return null;
  for(let i=0;i<vertices.length;i++){
    const p=vertices[i],q=vertices[(i+1)%vertices.length],d=diff(p,q);
    const t=((center.x-p.x)*d.x+(center.y-p.y)*d.y)/Math.max(tiny,d.x*d.x+d.y*d.y);
    if(t< -0.005||t>1.005)return null;
    if(Math.abs(perpendicular(center as Pt,p,q)-radius)>Math.max(0.015,radius*.008))return null;
  }
  return {center,radius};
}
export function polygonCircle(vertices:Pt[],kind:"incircle"|"circumcircle"):
  {center:{x:number;y:number};radius:number}|null {
  if(vertices.length<3)return null;
  if(kind==="incircle")return incenter(vertices);
  const center=circumcenter(vertices[0],vertices[1],vertices[2]);
  if(!center)return null;
  const radius=Math.hypot(vertices[0].x-center.x,vertices[0].y-center.y);
  if(!(radius>tiny))return null;
  for(const vertex of vertices){
    if(Math.abs(Math.hypot(vertex.x-center.x,vertex.y-center.y)-radius)>Math.max(.015,radius*.008))return null;
  }
  return {center,radius};
}

export function buildSchoolConstruction(original:GraphDraft,request:SchoolBuildRequest):SchoolBuildResult{
  const points=original.points.map(point=>({...point}));
  const segments=original.segments.map(segment=>({...segment}));
  const polygons=original.polygons.map(poly=>({...poly,points:[...poly.points]}));
  const circles=original.circles.map(circle=>({...circle}));
  const angles=original.angles.map(angle=>({...angle}));
  const midpoints=original.midpoints.map(mid=>({...mid}));
  const fail=(error:string):SchoolBuildResult=>({draft:original,error});
  const reserve=(pointCount:number,segmentCount=0,circleCount=0,polygonCount=0,angleCount=0)=>{
    return points.length+pointCount<=40&&segments.length+segmentCount<=60&&circles.length+circleCount<=30&&
      polygons.length+polygonCount<=20&&angles.length+angleCount<=40;
  };
  const point=(x:number,y:number,label="")=>{
    const i=points.length;
    points.push({x,y,label});return i;
  };
  const segment=(a:number,b:number,kind:"segment"|"line"|"ray"="segment")=>{
    segments.push({a,b,kind,label:"",measure:false});
  };
  const angle=(a:number,vertex:number,b:number)=>{
    angles.push({a,vertex,b,label:""});
  };
  const circle=(x:number,y:number,radius:number)=>{
    const center=point(x,y,"O"),edge=point(x+radius,y,"");
    circles.push({center,edge,label:"",measure:false});
  };
  const polygon=polygons.find(poly=>poly.points.length>=3);
  const verts=polygon?.points.map(i=>points[i]);
  const baseCircle=circles.find(c=>points[c.center]&&points[c.edge]);

  if(["incircle","circumcircle","incenter","circumcenter","centroid","diagonals","trapezoid-midline","triangle-midline","orthocenter","triangle-altitudes","triangle-medians","triangle-bisectors","orthocenter","triangle-altitudes","triangle-medians","triangle-bisectors"].includes(request.kind)){
    if(!polygon||!verts||verts.some(v=>!v))return fail("Сначала выберите многоугольник.");
    const ids=polygon.points,n=ids.length;
    if(request.kind==="incircle"||request.kind==="circumcircle"||request.kind==="incenter"||request.kind==="circumcenter"){
      const inscribed=request.kind==="incircle"||request.kind==="incenter";
      const result=polygonCircle(verts,inscribed?"incircle":"circumcircle");
      if(!result)return fail(inscribed?
        "В эту фигуру нельзя точно вписать окружность: она должна касаться всех сторон. Для произвольного четырёхугольника это не всегда возможно.":
        "Около этой фигуры нельзя описать одну окружность через все вершины. Выберите циклический многоугольник.");
      const centerOnly=request.kind==="incenter"||request.kind==="circumcenter";
      if(!reserve(centerOnly?1:2,0,centerOnly?0:1))return fail("Превышен предел опорных точек построения.");
      if(centerOnly)point(result.center.x,result.center.y,inscribed?"I":"O");
      else circle(result.center.x,result.center.y,result.radius);
    }else if(["orthocenter","triangle-altitudes","triangle-medians","triangle-bisectors"].includes(request.kind)){
      if(n!==3)return fail("Построение высот, медиан и биссектрис доступно для треугольника.");
      const [a,b,c]=verts;
      const d=diff(b,c),den=d.x*d.x+d.y*d.y;
      if(den<tiny)return fail("Сторона треугольника должна иметь положительную длину.");
      const projection=(p:Pt,q:Pt,r:Pt)=>{
        const v=diff(q,r),sum=v.x*v.x+v.y*v.y;
        if(sum<tiny)return null;
        const t=((p.x-q.x)*v.x+(p.y-q.y)*v.y)/sum;
        return {x:q.x+t*v.x,y:q.y+t*v.y};
      };
      const altitudeA=projection(a,b,c),altitudeB=projection(b,a,c);
      if(!altitudeA||!altitudeB)return fail("Вершины треугольника не должны совпадать.");
      if(request.kind==="orthocenter"){
        const u=diff(a,altitudeA as Pt),v=diff(b,altitudeB as Pt),denominator=cross(u,v);
        if(Math.abs(denominator)<tiny)return fail("Невозможно построить ортоцентр вырожденного треугольника.");
        const offset=diff(a,b),t=cross(offset,v)/denominator;
        if(!reserve(1))return fail("Превышен предел точек.");
        point(a.x+t*u.x,a.y+t*u.y,"H");
      }else{
        if(!reserve(3,3))return fail("Превышен предел точек или линий.");
        for(let i=0;i<3;i++){
          const origin=verts[i],left=verts[(i+1)%3],right=verts[(i+2)%3];
          let target:{x:number;y:number}|null=null;
          if(request.kind==="triangle-altitudes")target=projection(origin,left,right);
          else if(request.kind==="triangle-medians")target=midpoint(left,right);
          else{
            const leftLength=hypot(origin,left),rightLength=hypot(origin,right);
            if(leftLength+rightLength<tiny)return fail("Не удаётся провести биссектрису.");
            target={x:(rightLength*left.x+leftLength*right.x)/(leftLength+rightLength),
              y:(rightLength*left.y+leftLength*right.y)/(leftLength+rightLength)};
          }
          if(!target)return fail("Невозможно построить линию вырожденного треугольника.");
          segment(ids[i],point(target.x,target.y,request.kind==="triangle-altitudes"?"H":request.kind==="triangle-medians"?"M":"K"));
        }
      }
    }else if(request.kind==="centroid"){
      if(n!==3)return fail("Точка пересечения медиан строится в треугольнике.");
      if(!reserve(1))return fail("Превышен предел точек.");
      point((verts[0].x+verts[1].x+verts[2].x)/3,
        (verts[0].y+verts[1].y+verts[2].y)/3,"G");
    }else if(request.kind==="diagonals"){
      if(n<4)return fail("Диагонали существуют у многоугольника с четырьмя и более вершинами.");
      const pairs:Array<[number,number]>=[];
      for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){
        if(i===0&&j===n-1)continue;
        if(!segments.some(s=>s.kind==="segment"&&
          (s.a===ids[i]&&s.b===ids[j]||s.a===ids[j]&&s.b===ids[i])))pairs.push([ids[i],ids[j]]);
      }
      if(!reserve(0,pairs.length))return fail("Слишком много диагоналей. Удалите ненужные построения.");
      pairs.forEach(([a,b])=>segment(a,b));
    }else{
      if(!reserve(2,1))return fail("Превышен предел точек или линий.");
      if(request.kind==="trapezoid-midline"){
        if(n!==4||!original.figureId.startsWith("trapezoid"))return fail("Средняя линия здесь строится только для трапеции.");
        const a=midpoint(verts[0],verts[3]),b=midpoint(verts[1],verts[2]);
        segment(point(a.x,a.y,"M"),point(b.x,b.y,"N"));
      }else{
        if(n!==3)return fail("Средняя линия треугольника требует три вершины.");
        const a=midpoint(verts[0],verts[1]),b=midpoint(verts[0],verts[2]);
        segment(point(a.x,a.y,"M"),point(b.x,b.y,"N"));
      }
    }
  }else{
    if(!baseCircle)return fail("Сначала выберите окружность или добавьте её к фигуре.");
    const center=points[baseCircle.center],edge=points[baseCircle.edge],radius=hypot(center,edge);
    if(radius<tiny)return fail("Радиус окружности должен быть положительным.");
    const cx=center.x,cy=center.y;
    const locate=(t:number,label="")=>point(cx+radius*Math.cos(t),cy+radius*Math.sin(t),label);
    const n=request.sides??3;
    if(request.kind==="inscribed-polygon"||request.kind==="circumscribed-polygon"){
      if(![3,4,5,6,8].includes(n))return fail("Выберите 3, 4, 5, 6 или 8 сторон.");
      if(!reserve(n,0,0,1))return fail("Недостаточно места для вершин нового многоугольника.");
      const outside=request.kind==="circumscribed-polygon";
      const r=outside?radius/Math.cos(Math.PI/n):radius;
      const origin=-Math.PI/2+(outside?Math.PI/n:0);
      const ids=Array.from({length:n},(_,i)=>{
        const t=origin+i*2*Math.PI/n;
        return point(cx+r*Math.cos(t),cy+r*Math.sin(t),"ABCDEFGH"[i]);
      });
      polygons.push({points:ids,label:"",measure:false});
    }else if(request.kind==="radius"){
      if(!reserve(0,1))return fail("Превышен предел линий.");
      segment(baseCircle.center,baseCircle.edge);
    }else if(request.kind==="diameter"){
      if(!reserve(1,1))return fail("Превышен предел точек или линий.");
      segment(baseCircle.edge,point(cx-(edge.x-cx),cy-(edge.y-cy),"B"));
    }else if(request.kind==="chord"||request.kind==="secant"){
      if(!reserve(2,1))return fail("Превышен предел точек или линий.");
      const a=locate(Math.PI/5,"A"),b=locate(4*Math.PI/5,"B");
      segment(a,b,request.kind==="secant"?"line":"segment");
    }else if(request.kind==="tangent"){
      if(!reserve(2,1))return fail("Превышен предел точек или линий.");
      const start=point(edge.x-(edge.y-cy),edge.y+(edge.x-cx),"");
      const end=point(edge.x+(edge.y-cy),edge.y-(edge.x-cx),"");
      segment(start,end,"line");
    }else if(request.kind==="two-tangents"){
      if(!reserve(3,2))return fail("Превышен предел точек или линий.");
      const p=point(cx+radius*2,cy,"P");
      const t=Math.acos(1/2);
      const a=locate(t,"A"),b=locate(-t,"B");
      segment(p,a);segment(p,b);
    }else if(request.kind==="central-angle"||request.kind==="inscribed-angle"){
      const inscribed=request.kind==="inscribed-angle";
      if(!reserve(inscribed?3:2,2,0,0,1))return fail("Превышен предел точек или линий.");
      const a=locate(0,"A"),b=locate(Math.PI*2/3,"B");
      const vertex=inscribed?locate(4*Math.PI/3,"C"):baseCircle.center;
      segment(vertex,a);segment(vertex,b);angle(a,vertex,b);
    }else if(request.kind==="circumference-midpoint"){
      if(!reserve(1,1))return fail("Превышен предел точек или линий.");
      const m=locate(Math.PI/2,"M");
      segment(baseCircle.center,m);
    }else return fail("Построение пока недоступно.");
  }
  return {draft:{...original,points,segments,polygons,circles,angles,midpoints}};
}
