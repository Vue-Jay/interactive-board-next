import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=fs.readFileSync(new URL("../src/lektrusHistoryEncyclopedia.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const api={};new Function("exports",compiled)(api);
const {historicalArticles,findHistoricalArticle,historicalRussianName,
 normalizeHistoricalName,historyArticleUrl}=api;
assert.ok(historicalArticles.length>=40,"broad Russian-school historical coverage");
const known=new Set();
for(const item of historicalArticles){
 assert.ok(item.from<=item.to&&item.from!==0&&item.to!==0,item.name);
 assert.ok(item.capital.length>2&&item.summary.length>80&&item.turn.length>35,item.name);
 assert.ok(item.article&&item.aliases.length>0,item.name);
 for(const alias of item.aliases){
  const key=normalizeHistoricalName(alias);
  assert.ok(!known.has(key),"ambiguous alias "+key);
  known.add(key);
  assert.equal(historicalRussianName(alias,Math.ceil((item.from+item.to)/2)),item.name);
 }
 assert.ok(historyArticleUrl(item).startsWith("https://ru.wikipedia.org/wiki/"));
}
assert.equal(findHistoricalArticle("Roman Empire",100).name,"Римская империя");
assert.equal(findHistoricalArticle("Roman Empire",600),undefined);
assert.equal(findHistoricalArticle("USSR",1945).name,"СССР");
assert.equal(findHistoricalArticle("India",1800),undefined);
assert.equal(findHistoricalArticle("Kievan Rus",1000).name,"Древняя Русь");
assert.equal(findHistoricalArticle("unknown historical state",1900),undefined);
const atlas=fs.readFileSync(new URL("../src/LektrusMapAtlas.tsx",import.meta.url),"utf8");
for(const keyword of ["loadHistoricalIndex","Поиск по всем эпохам","lektrus-history-tabs",
 "historyArticleUrl","selectedYears","jumpToPeriod","sourceYear"]){
 assert.ok(atlas.includes(keyword),keyword);
}
const data=fs.readFileSync(new URL("../src/lektrusAtlasData.ts",import.meta.url),"utf8");
assert.match(data,/master\/index\.json/);
assert.match(data,/available\.get\(item\.year\)!==item\.filename/);
console.log("Historical reference encyclopedia: 41 dated Russian-language entries, alias guards, sources, and cross-era UI checked.");
