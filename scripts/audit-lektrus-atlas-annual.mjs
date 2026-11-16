// Descending annual source comparison, not a claim of exact historical borders.
// Usage: node scripts/audit-lektrus-atlas-annual.mjs CLIOPATRIA.geojson PINNED_MAP_DIR report.json
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const MIN=-3400,MAX=2024,CURRENT=2026;
const polygon=f=>["Polygon","MultiPolygon"].includes(f.geometry?.type)&&Array.isArray(f.geometry.coordinates)&&f.geometry.coordinates.length>0;
const normalize=name=>name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g," ");
const names=features=>[...new Set(features.map(f=>String(f.properties?.NAME??"").trim()).filter(Boolean))].sort();
const minus=(a,b)=>{const other=new Set(b.map(normalize));return a.filter(n=>!other.has(normalize(n)))};

// Independent minimum-presence checks. Admission establishes statehood by
// that date, not recognition before admission or exact border geometry.
const admissionAnchors=[
 {name:"South Sudan",aliases:["South Sudan","Republic of South Sudan"],year:2011,date:"2011-07-14"},
 {name:"Timor-Leste",aliases:["Timor-Leste","East Timor","Democratic Republic of Timor-Leste"],year:2002,date:"2002-09-27"},
];
export function referenceAdmissionWarnings(year,polities){
 const present=new Set(polities.map(normalize));
 return admissionAnchors.filter(a=>year>=a.year&&year<=MAX&&!a.aliases.some(n=>present.has(normalize(n))))
  .map(a=>({name:a.name,date:a.date,source:"https://www.un.org/en/about-us/member-states",reason:year===a.year?"missing in admission year (intra-year transition)":"missing in full year after admission"}));
}

export function auditAnnual(source,snapshots,{from=CURRENT,to=MIN}={}){
 assert.equal(source.type,"FeatureCollection");
 const records=[],invalid=[];
 for(const [index,feature] of source.features.entries()){
  const p=feature.properties??{};
  if(p.Type!=="POLITY")continue; // RELATION is not a separate state.
  const name=typeof p.Name==="string"?p.Name.trim():"";
  const start=Number(p.FromYear),end=Number(p.ToYear);
  if(!name||p.FromYear==null||p.ToYear==null||!Number.isInteger(start)||!Number.isInteger(end)||start>end||!polygon(feature)){
   invalid.push({index,name,start:p.FromYear,end:p.ToYear});continue;
  }
  records.push({name,start,end,index});
 }
 assert.ok(records.length,"no dated polity records in independent source");
 const rows=[];let newer=[];
 for(let year=from;year>=to;year--){
  if(year===0)continue; // conventional historical chronology: 1 BCE → 1 CE
  const supported=year>=MIN&&year<=MAX;
  const active=supported?records.filter(r=>r.start<=year&&r.end>=year):[];
  const polities=[...new Set(active.map(r=>r.name))].sort();
  const snapshot=snapshots.get(year);
  const sourceStatus=supported?(active.length?"dated-reconstruction":"no-records"):"outside-source-coverage";
  const atlasStatus=year===CURRENT?"2022-geometry-modern-overview":snapshot?"dated-snapshot":"no-dated-snapshot";
  const comparison=snapshot&&supported?{
   // Exact normalized names only; aliases, dependencies and contested
   // territories need historical review, not automatic renaming or deletion.
   namesOnlyInAtlas:minus(snapshot,polities),namesOnlyInReference:minus(polities,snapshot)
  }:null;
  rows.push({year,atlasStatus,sourceStatus,polityCount:polities.length,recordCount:active.length,
   polities,appearsGoingBack:supported&&year<MAX?minus(polities,newer):[],
   disappearsGoingBack:supported&&year<MAX?minus(newer,polities):[],comparison,
   referenceWarnings:referenceAdmissionWarnings(year,polities)});
  newer=polities;
 }
 return {source:"Cliopatria v0.2.1 (CC BY 4.0, 10.5281/zenodo.23128623)",
  sourceRange:[MIN,MAX],invalidRecords:invalid,sourceRecordCount:records.length,years:rows};
}

function selfTest(){
 const f=(Name,FromYear,ToYear)=>({type:"Feature",properties:{Name,FromYear,ToYear,Type:"POLITY"},geometry:{type:"Polygon",coordinates:[[[0,0],[2,0],[2,2],[0,0]]]}});
 const a=auditAnnual({type:"FeatureCollection",features:[f("A",2022,2024),f("B",2020,2022)]},new Map([[2022,["A","X"]]]),{from:2026,to:2020});
 assert.deepEqual(a.years.map(y=>y.year),[2026,2025,2024,2023,2022,2021,2020]);
 assert.equal(a.years[0].sourceStatus,"outside-source-coverage");
 assert.deepEqual(a.years[4].polities,["A","B"]);
 assert.deepEqual(a.years[4].comparison,{namesOnlyInAtlas:["X"],namesOnlyInReference:["B"]});
 assert.deepEqual(a.years[5].disappearsGoingBack,["A"]);
 const bc=auditAnnual({type:"FeatureCollection",features:[f("B",-2,2)]},new Map(),{from:2,to:-2});
 assert.deepEqual(bc.years.map(y=>y.year),[2,1,-1,-2]);
 assert.deepEqual(referenceAdmissionWarnings(2012,["East Timor"]).map(w=>w.name),["South Sudan"]);
 assert.equal(referenceAdmissionWarnings(2002,[])[0].reason,"missing in admission year (intra-year transition)");
 assert.equal(referenceAdmissionWarnings(2014,["Republic of South Sudan","Timor-Leste"]).length,0);
 console.log("Annual audit fixtures passed: inclusive date intervals, descending years, missing sources, name differences, no year zero.");
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 selfTest();
 if(process.argv[2]!=="--self-test"){
  const [reference,dir,out]=process.argv.slice(2);
  assert.ok(reference&&dir&&out,"provide reference GeoJSON, pinned map directory, and report path");
  const snapshots=new Map();
  for(const file of fs.readdirSync(dir)){
   const match=/^world_(bc)?(\d+)\.geojson$/.exec(file);
   if(!match)continue;
   const year=Number(match[2])*(match[1]?-1:1);
   snapshots.set(year,names(JSON.parse(fs.readFileSync(path.join(dir,file),"utf8")).features));
  }
  assert.equal(snapshots.size,54,"all pinned Historical Basemaps snapshots required");
  const result=auditAnnual(JSON.parse(fs.readFileSync(reference,"utf8")),snapshots);
  assert.equal(result.years.length,5426);
  assert.ok(result.sourceRecordCount>1000,"reference appears incomplete");
  fs.writeFileSync(out,JSON.stringify(result));
  for(const row of result.years.slice(0,27))console.log(`${row.year}: ${row.atlasStatus}; ${row.sourceStatus}; ${row.polityCount} reference polities; ${row.recordCount} records`);
  for(const row of result.years)for(const warning of row.referenceWarnings)console.log(`Reference warning ${row.year}: ${warning.name}; ${warning.reason}; UN admission ${warning.date}`);
  console.log(`Annual coverage: ${result.years.length} years; ${result.sourceRecordCount} valid dated polity records; ${result.invalidRecords.length} invalid reference records; ${result.years.filter(y=>y.atlasStatus==="no-dated-snapshot").length} years missing a dated Lektrus map.`);
 }
}
