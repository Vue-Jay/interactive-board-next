import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=fs.readFileSync(new URL("../src/lektrusAtlasSchoolFacts.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const fakeEntity={
 labels:{ru:{value:"Тестовая страна"}},
 descriptions:{ru:{value:"Государство для тестирования справочника"}},
 claims:{
  P1082:[{rank:"normal",mainsnak:{datavalue:{value:{amount:"+1000000",unit:"1"}}},
   qualifiers:{P585:[{datavalue:{value:{time:"+2023-01-01T00:00:00Z"}}}]}},
   {rank:"normal",mainsnak:{datavalue:{value:{amount:"+1111111",unit:"1"}}},
   qualifiers:{P585:[{datavalue:{value:{time:"+2025-01-01T00:00:00Z"}}}]}}],
  P2046:[{mainsnak:{datavalue:{value:{amount:"+12345",unit:"http://www.wikidata.org/entity/Q712226"}}}}],
  P36:[{rank:"preferred",mainsnak:{datavalue:{value:{id:"Q99"}}},qualifiers:{P582:[{datavalue:{value:{time:"+2000-01-01T00:00:00Z"}}}]}},
   {mainsnak:{datavalue:{value:{id:"Q20"}}}},{mainsnak:{datavalue:{value:{id:"Q21"}}}},
   {mainsnak:{datavalue:{value:{id:"Q98"}}},qualifiers:{P580:[{datavalue:{value:{time:"+2999-01-01T00:00:00Z"}}}]}}],
  P37:[{mainsnak:{datavalue:{value:{id:"Q30"}}}}],
  P2044:[{mainsnak:{datavalue:{value:{amount:"-400",unit:"http://www.wikidata.org/entity/Q11573"}}}}],
  P625:[{mainsnak:{datavalue:{value:{latitude:55.75,longitude:37.62}}}}]
 }
};
const calls=[];
const mockFetch=async(url)=>{
 calls.push(url);
 const ids=new URL(url).searchParams.get("ids").split("|");
 const entities={};
 for(const id of ids)entities[id]=id==="Q10"?fakeEntity:id==="Q20"?
  {labels:{ru:{value:"Тестовая столица"}}}:id==="Q21"?{labels:{ru:{value:"Вторая столица"}}}:id==="Q30"?
  {labels:{ru:{value:"Русский язык"}}}:{labels:{ru:{value:"Объект"}}};
 return {ok:true,json:async()=>({entities})};
};
const exports={};
new Function("exports","fetch","AbortController","setTimeout","clearTimeout",compiled)(
 exports,mockFetch,AbortController,setTimeout,clearTimeout
);
const {atlasFactEntityId,fetchAtlasSchoolReference,atlasAreaKm2}=exports;
const areaClaim=(amount,unit,year,rank="normal")=>({rank,mainsnak:{datavalue:{value:{amount,unit}}},qualifiers:{P585:[{datavalue:{value:{time:`+${year}-01-01T00:00:00Z`}}}]}});
assert.equal(atlasAreaKm2([areaClaim("+500000000","http://www.wikidata.org/entity/Q25343",2010),areaClaim("+45000","http://www.wikidata.org/entity/Q35852",2025)]),450);
assert.equal(atlasFactEntityId({WIKIDATAID:"Q10"}),"Q10");
assert.equal(atlasFactEntityId({wikidata_id:"Q10"}),"Q10");
assert.equal(atlasFactEntityId({WIKIDATAID:"https://example.com"}),null);
assert.equal(atlasFactEntityId(null),null);
const facts=await fetchAtlasSchoolReference("Q10");
assert.equal(facts.title,"Тестовая страна");
assert.match(facts.description,/тестирования/);
const map=new Map(facts.facts.map(f=>[f.label,f.value]));
assert.equal(map.get("Столица"),"Тестовая столица; Вторая столица");
assert.match(map.get("Высота над уровнем моря"),/-400 м/);
assert.ok(!calls.some(url=>/Q99|Q98/.test(url)),"Ended and future capitals must not be shown as current");
assert.equal(map.get("Официальный язык"),"Русский язык");
assert.match(map.get("Численность населения"),/2025/);
assert.match(map.get("Численность населения"),/1.111.111/u);
assert.equal(map.get("Площадь"),"12 345 км²");
assert.ok(map.get("Географические координаты").includes("55.750"));
assert.equal((await fetchAtlasSchoolReference("Q10")),facts,"Encyclopedia results are cached");
assert.equal(calls.length,2);
assert.equal(await fetchAtlasSchoolReference("Q-1"),null);
const atlas=fs.readFileSync(new URL("../src/LektrusMapAtlas.tsx",import.meta.url),"utf8");
assert.match(atlas,/fetchAtlasSchoolReference/);
assert.match(atlas,/lektrus-atlas-info-object/);
assert.match(atlas,/lektrus-atlas-source-details/);
assert.doesNotMatch(atlas,/infoTab/);
console.log("Atlas encyclopedia: source-linked Russian facts, dates, enrichment and single-panel integration passed.");
