// Descending annual source comparison, not a claim of exact historical borders.
// Usage: node scripts/audit-lektrus-atlas-annual.mjs CLIOPATRIA.geojson PINNED_MAP_DIR report.json
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {historicalMemberCoverage} from "../src/lektrusAtlasHistoricalCoverage.ts";
import {capitalInsideCountry} from "./atlas-2026-capitals.mjs";

const MIN=-3400,MAX=2024,CURRENT=2026;
const polygon=f=>["Polygon","MultiPolygon"].includes(f.geometry?.type)&&Array.isArray(f.geometry.coordinates)&&f.geometry.coordinates.length>0;
const normalize=name=>name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g," ");
const names=features=>[...new Set(features.map(f=>String(f.properties?.NAME??"").trim()).filter(Boolean))].sort();
const minus=(a,b)=>{const other=new Set(b.map(normalize));return a.filter(n=>!other.has(normalize(n)))};

// Independent minimum-presence checks. Admission establishes statehood by
// that date, not recognition before admission or exact border geometry.
// Year precision is intentional for the roster's later admissions. Aliases
// explicitly represent the same polity, never just a similar name.
// https://www.un.org/en/about-us/growth-in-un-membership
const laterAdmissions=[
 [1961,"Mauritania","Mauritania|Islamic Republic of Mauritania"],
 [1961,"Mongolia","Mongolian People's Republic|Mongolia"],
 [1961,"Sierra Leone","Sierra Leone|Republic of Sierra Leone"],
 [1961,"Tanganyika / Tanzania","Tanganyika|Tanzania|United Republic of Tanzania|United Republic of Tanganyika and Zanzibar"],
 [1962,"Algeria","People's Democratic Republic of Algeria|Algeria"],
 [1962,"Burundi","Republic of Burundi|Kingdom of Burundi|Burundi"],
 [1962,"Jamaica","Jamaica"],
 [1962,"Rwanda","Republic of Rwanda|Rwanda"],
 [1962,"Trinidad and Tobago","Republic of Trinidad and Tobago|Trinidad and Tobago"],
 [1962,"Uganda","Republic of Uganda|Uganda"],
 [1963,"Kenya","Republic of Kenya|Kenya"],
 [1963,"Kuwait","Kuwait|State of Kuwait"],
 [1963,"Zanzibar","Zanzibar|Sultanate of Zanzibar|People's Republic of Zanzibar",1963],
 [1964,"Malawi","Malawi|Republic of Malawi"],
 [1964,"Malta","Malta|Republic of Malta"],
 [1964,"Zambia","Zambia|Republic of Zambia"],
 [1965,"The Gambia","Republic of The Gambia|The Gambia|Gambia"],
 [1965,"Maldives","Maldives|Republic of Maldives|Sultanate of Maldives|Maldive Islands"],
 [1965,"Singapore","Republic of Singapore|Singapore"],
 [1966,"Barbados","Barbados"],
 [1966,"Botswana","Republic of Botswana|Botswana"],
 [1966,"Guyana","Guyana|Co-operative Republic of Guyana"],
 [1966,"Lesotho","Lesotho|Kingdom of Lesotho"],
 [1967,"South Yemen","People's Democratic Republic of Yemen|People's Republic of Southern Yemen|South Yemen",1989],
 [1968,"Equatorial Guinea","Equatorial Guinea|Republic of Equatorial Guinea"],
 [1968,"Mauritius","Mauritius|Republic of Mauritius"],
 [1968,"Swaziland / Eswatini","Eswatini|Swaziland|Kingdom of Swaziland|Kingdom of Eswatini"],
 [1970,"Fiji","Republic of Fiji|Fiji"],
 [1971,"Bahrain","Kingdom of Bahrain|State of Bahrain|Bahrain"],
 [1971,"Bhutan","Kingdom of Bhutan|Bhutan"],
 [1971,"Oman","Sultanate of Oman|Oman"],
 [1971,"Qatar","State of Qatar|Qatar"],
 [1971,"United Arab Emirates","United Arab Emirates"],
 [1973,"Bahamas","Commonwealth of The Bahamas|Bahamas|The Bahamas"],
 [1973,"Federal Republic of Germany / Germany","Federal Republic of Germany|Federated Republic of Germany|Germany"],
 [1973,"German Democratic Republic","German Democratic Republic|East Germany",1989],
 [1974,"Bangladesh","People's Republic of Bangladesh|Bangladesh"],
 [1974,"Grenada","Grenada"],
 [1974,"Guinea-Bissau","Republic of Guinea-Bissau|Guinea-Bissau"],
 [1975,"Cabo Verde","Republic of Cabo Verde|Cape Verde|Cabo Verde"],
 [1975,"Comoros","Comoros|Union of the Comoros|Federal Islamic Republic of the Comoros"],
 [1975,"Mozambique","Mozambique|Republic of Mozambique|People's Republic of Mozambique"],
 [1975,"Papua New Guinea","Papua New Guinea|Independent State of Papua New Guinea"],
 [1975,"São Tomé and Príncipe","São Tomé and Príncipe|Sao Tome and Principe|Democratic Republic of São Tomé and Príncipe"],
 [1975,"Suriname","Republic of Suriname|Suriname"],
 [1976,"Angola","People's Republic of Angola|Republic of Angola|Angola"],
 [1976,"Samoa","Samoa|Western Samoa|Independent State of Samoa"],
 [1976,"Seychelles","Seychelles|Republic of Seychelles"],
 [1977,"Djibouti","Republic of Djibouti|Djibouti"],
 [1977,"Vietnam","Socialist Republic of Vietnam|Vietnam|Viet Nam"],
 [1978,"Dominica","Commonwealth of Dominica|Dominica"],
 [1978,"Solomon Islands","Solomon Islands"],
 [1979,"Saint Lucia","Saint Lucia|St Lucia"],
 [1980,"Saint Vincent and the Grenadines","Saint Vincent|Saint Vincent and the Grenadines"],
 [1980,"Zimbabwe","Republic of Zimbabwe|Zimbabwe"],
 [1981,"Antigua and Barbuda","Antigua and Barbuda"],
 [1981,"Belize","Belize"],
 [1981,"Vanuatu","Vanuatu|Republic of Vanuatu"],
 [1983,"Saint Kitts and Nevis","Saint Kitts|Saint Kitts and Nevis|Saint Christopher and Nevis"],
 [1984,"Brunei","Sultanate of Brunei|Brunei|Brunei Darussalam"],
 [1990,"Liechtenstein","Liechtenstein|Principality of Liechtenstein"],
 [1990,"Namibia","Namibia|Republic of Namibia"],
 [1991,"North Korea","Democratic People's Republic of Korea|North Korea"],
 [1991,"Estonia","Republic of Estonia|Estonia"],
 [1991,"Latvia","Republic of Latvia|Latvia"],
 [1991,"Lithuania","Republic of Lithuania|Lithuania"],
 [1991,"Marshall Islands","Marshall Islands|Republic of the Marshall Islands"],
 [1991,"Micronesia","Micronesia|Federated States of Micronesia"],
 [1991,"South Korea","Republic of Korea|South Korea"],
 [1992,"Armenia","Republic of Armenia|Armenia"],
 [1992,"Azerbaijan","Republic of Azerbaijan|Azerbaijan"],
 [1992,"Bosnia and Herzegovina","Bosnia and Herzegovina|Republic of Bosnia and Herzegovina"],
 [1992,"Croatia","Republic of Croatia|Croatia"],
 [1992,"Georgia","Georgia|Republic of Georgia"],
 [1992,"Kazakhstan","Kazakhstan|Republic of Kazakhstan"],
 [1992,"Kyrgyzstan","Kyrgyzstan|Kyrgyz Republic"],
 [1992,"Moldova","Republic of Moldova|Moldova"],
 [1992,"San Marino","San Marino|Republic of San Marino"],
 [1992,"Slovenia","Republic of Slovenia|Slovenia"],
 [1992,"Tajikistan","Republic of Tajikistan|Tajikistan"],
 [1992,"Turkmenistan","Turkmenistan"],
 [1992,"Uzbekistan","Republic of Uzbekistan|Uzbekistan"],
 [1993,"Andorra","Principality of Andorra|Andorra"],
 [1993,"Czech Republic","Czech Republic|Czechia"],
 [1993,"Eritrea","State of Eritrea|Eritrea"],
 [1993,"Monaco","Principality of Monaco|Monaco"],
 [1993,"Slovakia","Slovakia|Slovak Republic"],
 [1993,"Macedonia / North Macedonia","Former Yugoslav Republic of Macedonia|Republic of Macedonia|Republic of North Macedonia|North Macedonia"],
 [1994,"Palau","Palau|Republic of Palau"],
 [1999,"Kiribati","Kiribati|Republic of Kiribati"],
 [1999,"Nauru","Nauru|Republic of Nauru"],
 [1999,"Tonga","Tonga|Kingdom of Tonga"],
 [2000,"Tuvalu","Tuvalu"],
 [2002,"Switzerland","Switzerland|Swiss Confederation"],
 [2006,"Montenegro","Montenegro|Republic of Montenegro"],
];
const unMembershipTotals1960To1993=[
 [1960,99],[1961,104],[1962,110],[1963,113],[1964,115],[1965,117],[1966,122],[1967,123],[1968,126],
 [1970,127],[1971,132],[1973,135],[1974,138],[1975,144],[1976,147],[1977,149],[1978,151],[1979,152],
 [1980,154],[1981,157],[1983,158],[1984,159],[1990,159],[1991,166],[1992,179],[1993,184],
];
export function unMembershipYearEnd(year){
 if(year<1960||year>1993)return null;
 return unMembershipTotals1960To1993.findLast(([start])=>start<=year)[1];
}
const admissionAnchors=[
 ...[
  ["Benin",["Republic of Benin","Benin","Dahomey","Republic of Dahomey","People's Republic of Benin"]],
  ["Burkina Faso",["Burkina Faso","Upper Volta","Republic of Upper Volta"]],
  ["Cameroon",["Republic of Cameroon","Cameroon","Cameroun"]],
  ["Central African Republic",["Central African Republic","Central African Empire"]],
  ["Chad",["Republic of Chad","Chad"]],
  ["Congo (Brazzaville)",["Republic of the Congo","Congo (Brazzaville)","People's Republic of the Congo"]],
  ["Congo (Leopoldville)",["Democratic Republic of the Congo","Republic of the Congo (Léopoldville)","Zaire","Republic of Zaire"]],
  ["Cyprus",["Republic of Cyprus","Cyprus"]],
  ["Gabon",["Gabon","Gabonese Republic"]],
  ["Ivory Coast",["Republic of Côte d'Ivoire","Ivory Coast","Côte d'Ivoire"]],
  ["Madagascar",["Madagascar","Malagasy Republic","Republic of Madagascar"]],
  ["Niger",["Republic of the Niger","Niger"]],
  ["Somalia",["Federal Republic of Somalia","Somali Republic","Somalia"]],
  ["Togo",["Togo","Togolese Republic"]],
 ].map(([name,aliases])=>({name,aliases,year:1960,date:"1960-09-20"})),
 {name:"Mali",aliases:["Republic of Mali","Mali"],year:1960,date:"1960-09-28"},
 {name:"Senegal",aliases:["Republic of Senegal","Senegal"],year:1960,date:"1960-09-28"},
 {name:"Nigeria",aliases:["Federal Republic of Nigeria","Federation of Nigeria","Nigeria"],year:1960,date:"1960-10-07"},
 ...laterAdmissions.map(([year,name,aliases,end])=>({name,aliases:aliases.split("|"),year,date:String(year),end})),
 {name:"South Sudan",aliases:["South Sudan","Republic of South Sudan"],year:2011,date:"2011-07-14"},
 {name:"Timor-Leste",aliases:["Timor-Leste","East Timor","Democratic Republic of Timor-Leste"],year:2002,date:"2002-09-27"},
];
export function referenceAdmissionWarnings(year,polities){
 const present=new Set(polities.map(normalize));
 return admissionAnchors.filter(a=>year>=a.year&&year<=(a.end??MAX)&&!a.aliases.some(n=>present.has(normalize(n))))
  .map(a=>({name:a.name,date:a.date,source:a.date.length===4?"https://www.un.org/en/about-us/growth-in-un-membership":"https://www.un.org/en/about-us/member-states",reason:year===a.year?"missing in admission year (intra-year transition)":"missing in full year after admission"}));
}

// Exact reviewed crosswalk for the missing late-snapshot countries. These
// are candidates for geometric review only; no automatic overlay on the map.
const referenceGapNames={BHR:"Kingdom of Bahrain",CPV:"Republic of Cabo Verde",MUS:"Mauritius",FSM:"Micronesia",MCO:"Principality of Monaco",PLW:"Palau",STP:"São Tomé and Príncipe",SYC:"Seychelles",SGP:"Republic of Singapore",SLB:"Solomon Islands",TLS:"East Timor",VUT:"Vanuatu"};
export function extractHistoricalGapCandidates(source){
 const candidates=[],unresolved=[];
 for(const year of [2010,2000,1994])for(const member of historicalMemberCoverage(year).missing){
  const wanted=referenceGapNames[member.iso];
  const matches=wanted?source.features.filter(f=>f.properties?.Type==="POLITY"&&f.properties.Name===wanted&&Number(f.properties.FromYear)<=year&&Number(f.properties.ToYear)>=year&&polygon(f)):[];
  if(matches.length!==1){unresolved.push({year,iso:member.iso,name:member.name,reason:matches.length?"multiple reference records":"no reviewed reference record"});continue;}
  const f=matches[0];
  candidates.push({type:"Feature",geometry:f.geometry,properties:{year,iso:member.iso,name:member.name,referenceName:wanted,from:f.properties.FromYear,to:f.properties.ToYear,review:"candidate-only"}});
 }
 return {type:"FeatureCollection",source:"Cliopatria v0.2.1, CC BY 4.0, https://doi.org/10.5281/zenodo.23128623",notice:"Do not render as accepted borders until geographic and historical checks pass",features:candidates,unresolved};
}

// These inland points distinguish historically separate administrations.
// Passing points is necessary, not sufficient: the actual boundaries still
// require date-specific geographic evidence and topology/overlap review.
const checks1960=[
 {name:"North Yemen",inside:[44.2,15.3],outside:[48.8,15.5],source:"https://history.state.gov/countries/yemen"},
 {name:"Federation of Malaya",inside:[101.7,3.1],outside:[112.5,2.7],source:"https://www.un.org/dppa/decolonization/history/former-trust-and-nsgts"},
 {name:"Republic of Indonesia",inside:[106.85,-6.2],outside:[138,-4],source:"https://peacekeeping.un.org/sites/default/files/past/unsfbackgr.html"},
 {name:"Republic of Cameroon",inside:[11.5,3.85],outside:[9.4,5.6],source:"https://digitallibrary.un.org/record/1291384/files/1138094_EN.pdf"},
 {name:"Democratic Republic of Vietnam",inside:[105.8,21],outside:[106.7,10.8],source:"https://history.state.gov/historicaldocuments/frus1952-54v16/d1035"},
 {name:"Republic of Vietnam",inside:[106.7,10.8],outside:[105.8,21],source:"https://history.state.gov/historicaldocuments/frus1952-54v16/d1035"},
];
export function review1960GeometryCandidates(source){
 return checks1960.map(check=>{
  const matches=source.features.filter(f=>f.properties?.Type==="POLITY"&&f.properties.Name===check.name&&Number(f.properties.FromYear)<=1960&&Number(f.properties.ToYear)>=1960&&polygon(f));
  if(matches.length!==1)return {...check,matches:matches.length,review:"unresolved"};
  const geometry=matches[0].geometry;
  const includesRequired=capitalInsideCountry(check.inside,geometry);
  const includesExcluded=capitalInsideCountry(check.outside,geometry);
  return {...check,matches:1,includesRequired,includesExcluded,review:includesRequired&&!includesExcluded?"candidate-only":"reject"};
 });
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
  rows.push({year,atlasStatus,sourceStatus,polityCount:polities.length,recordCount:active.length,unMembershipYearEnd:unMembershipYearEnd(year),
   polities,appearsGoingBack:supported&&year<MAX?minus(polities,newer):[],
   disappearsGoingBack:supported&&year<MAX?minus(newer,polities):[],comparison,
   referenceWarnings:referenceAdmissionWarnings(year,polities)});
  newer=polities;
 }
 return {source:"Cliopatria v0.2.1 (CC BY 4.0, 10.5281/zenodo.23128623)",
  sourceRange:[MIN,MAX],invalidRecords:invalid,sourceRecordCount:records.length,geometry1960Checks:review1960GeometryCandidates(source),years:rows};
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
 assert.deepEqual(referenceAdmissionWarnings(2012,["East Timor"]).filter(w=>w.date>="2000").map(w=>w.name),["Tuvalu","Switzerland","Montenegro","South Sudan"]);
 assert.equal(referenceAdmissionWarnings(2002,[]).find(w=>w.name==="Timor-Leste").reason,"missing in admission year (intra-year transition)");
 assert.equal(referenceAdmissionWarnings(2014,["Republic of South Sudan","Timor-Leste","Tuvalu","Swiss Confederation","Montenegro"]).filter(w=>w.date>="2000").length,0);
 assert.equal(referenceAdmissionWarnings(1959,[]).length,0);
 assert.equal(referenceAdmissionWarnings(1960,[]).length,17);
 assert.equal(laterAdmissions.length,95);
 assert.equal(unMembershipYearEnd(1993),184);
 assert.equal(unMembershipYearEnd(1989),159);
 assert.equal(unMembershipYearEnd(1969),126);
 assert.equal(unMembershipYearEnd(1959),null);
 assert.ok(referenceAdmissionWarnings(1963,[]).some(w=>w.name==="Zanzibar"));
 assert.ok(!referenceAdmissionWarnings(1964,[]).some(w=>w.name==="Zanzibar"));
 assert.ok(!referenceAdmissionWarnings(1990,[]).some(w=>w.name==="South Yemen"||w.name==="German Democratic Republic"));
 assert.ok(referenceAdmissionWarnings(1960,["Mali Federation"]).some(w=>w.name==="Mali"),"the dissolved federation is not the Republic of Mali");
 assert.ok(!referenceAdmissionWarnings(1960,["Republic of Senegal"]).some(w=>w.name==="Senegal"));
 const gaps=extractHistoricalGapCandidates({features:[f("East Timor",2006,2013)]});
 assert.equal(gaps.features.length,1);
 assert.equal(gaps.features[0].properties.year,2010);
 assert.equal(gaps.features.length+gaps.unresolved.length,52);
 assert.equal(review1960GeometryCandidates({features:[]}).every(c=>c.review==="unresolved"),true);
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
  const source=JSON.parse(fs.readFileSync(reference,"utf8"));
  const result=auditAnnual(source,snapshots);
  assert.equal(result.years.length,5426);
  assert.ok(result.sourceRecordCount>1000,"reference appears incomplete");
  fs.writeFileSync(out,JSON.stringify(result));
  const gapCandidates=extractHistoricalGapCandidates(source);
  fs.writeFileSync(path.join(path.dirname(out),"historical-gap-candidates.geojson"),JSON.stringify(gapCandidates));
  console.log(`Historical gap candidates: ${gapCandidates.features.length} dated polygons for review; ${gapCandidates.unresolved.length} still without a reviewed reference record`);
  for(const check of result.geometry1960Checks)console.log(`1960 geometry ${check.name}: ${check.review}`);
  for(const row of result.years.slice(0,27))console.log(`${row.year}: ${row.atlasStatus}; ${row.sourceStatus}; ${row.polityCount} reference polities; ${row.recordCount} records`);
  for(const row of result.years)for(const warning of row.referenceWarnings)console.log(`Reference warning ${row.year}: ${warning.name}; ${warning.reason}; UN admission ${warning.date}`);
  console.log(`Annual coverage: ${result.years.length} years; ${result.sourceRecordCount} valid dated polity records; ${result.invalidRecords.length} invalid reference records; ${result.years.filter(y=>y.atlasStatus==="no-dated-snapshot").length} years missing a dated Lektrus map.`);
 }
}
