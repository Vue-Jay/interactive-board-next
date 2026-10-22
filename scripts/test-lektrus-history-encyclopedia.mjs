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
 assert.ok(item.capital.length>2&&item.summary.length>=60&&item.turn.length>=30,item.name);
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
for(const keyword of ["loadHistoricalIndex","Все эпохи","lektrus-history-tabs","lektrus-history-scope",
 "historyArticleUrl","selectedYears","jumpToPeriod","sourceYear"]){
 assert.ok(atlas.includes(keyword),keyword);
}
const data=fs.readFileSync(new URL("../src/lektrusAtlasData.ts",import.meta.url),"utf8");
assert.match(data,/aourednik\/historical-basemaps\/[0-9a-f]{40}\/index\.json/);
assert.match(data,/available\.get\(item\.year\)!==item\.filename/);
const referenceSource=fs.readFileSync(new URL("../src/lektrusHistoricalReferences.ts",import.meta.url),"utf8");
const referenceCompiled=ts.transpileModule(referenceSource,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const referencesApi={};new Function("exports",referenceCompiled)(referencesApi);
const {historicalReferences,findHistoricalReference,normalizeHistoricalReferenceName}=referencesApi;
assert.ok(historicalReferences.length>=102,"expanded source-backed history directory");
const ids=new Set();
for(const item of historicalReferences){
 assert.ok(!ids.has(item.id),"Duplicate history reference id: "+item.id);ids.add(item.id);
 assert.ok(item.title&&item.aliases.length>0&&item.from<=item.to,"Invalid history reference "+item.id);
 assert.ok(item.description.length>=50&&item.change.length>=30,"Incomplete reference "+item.id);
 assert.ok(item.sourceTitle&&item.sourceUrl.startsWith("https://"),"Missing source "+item.id);
}
for(const [alias,year,title] of [
 ["Khmer Empire",1100,"Кхмерская империя"],
 ["Ayutthaya Kingdom",1500,"Королевство Аюттхая"],
 ["Timurid Empire",1400,"Держава Тимуридов"],
 ["Yuan Dynasty",1300,"Империя Юань"],
 ["Kingdom of Aksum",400,"Аксумское царство"],
 ["Mamluk Sultanate",1400,"Мамлюкский султанат"],
 ["Delhi Sultanate",1350,"Делийский султанат"],
 ["Chimu Kingdom",1300,"Царство Чиму"],
 ["Viceroyalty of Peru",1600,"Вице-королевство Перу"],
 ["Ghaznavid Empire",1040,"Государство Газневидов"],
 ["Great Seljuk Empire",1100,"Великая Сельджукская держава"],
 ["Khwarazmian Empire",1200,"Государство Хорезмшахов"],
 ["Western Xia",1150,"Государство Западная Ся"],
 ["Goryeo Dynasty",1200,"Корё"],
 ["Joseon Dynasty",1500,"Чосон"],
 ["Tokugawa Shogunate",1700,"Сёгунат Токугава"],
 ["Vijayanagara Empire",1500,"Виджаянагарская империя"],
 ["Kingdom of Benin",1600,"Королевство Бенин"],
 ["Republic of Venice",1500,"Венецианская республика"],
 ["Papal States",1200,"Папская область"],
 ["Novgorod Republic",1350,"Новгородская республика"],
 ["Pskov Republic",1400,"Псковская республика"],
 ["Kazan Khanate",1500,"Казанское ханство"],
 ["Astrakhan Khanate",1500,"Астраханское ханство"],
 ["Crimean Khanate",1700,"Крымское ханство"],
 ["Volga Bulgaria",1100,"Волжская Булгария"],
 ["Empire of Trebizond",1300,"Трапезундская империя"],
 ["Northern Song",1100,"Северная Сун"],
 ["Southern Song",1200,"Южная Сун"],
 ["Liao dynasty",1000,"Империя Ляо"],
 ["Jin Dynasty",1200,"Империя Цзинь (чжурчжэни)"],
 ["Sui dynasty",600,"Империя Суй"],
 ["Goguryeo",600,"Когурё"],
 ["Baekje Kingdom",600,"Пэкче"],
 ["Unified Silla",800,"Силла"],
 ["Balhae",800,"Бохай (Пархэ)"],
 ["Gaya Confederacy",500,"Союз Кая"],
 ["Latin Empire",1250,"Латинская империя"],
 ["Empire of Nicaea",1250,"Никейская империя"],
 ["Despotate of Epirus",1250,"Эпирское государство"],
 ["Second Bulgarian Empire",1300,"Второе Болгарское царство"],
 ["Serbian Empire",1350,"Сербское царство"],
 ["Caliphate of Cordoba",1000,"Кордовский халифат"],
 ["Emirate of Granada",1400,"Гранадский эмират"],
 ["Crown of Aragon",1300,"Арагонская корона"],
 ["Crown of Castile",1300,"Кастильская корона"],
 ["Almoravid Empire",1100,"Держава Альморавидов"],
 ["Almohad Caliphate",1200,"Держава Альмохадов"],
 ["Kanem Empire",1100,"Царство Канем"],
 ["Bornu Empire",1500,"Царство Борну"],
 ["Kushan Empire",150,"Кушанская держава"],
 ["Gupta Empire",400,"Империя Гуптов"],
 ["Inca Empire",1500,"Империя инков"],
 ["Viceroyalty of New Spain",1600,"Вице-королевство Новая Испания"],
 ["Viceroyalty of New Granada",1750,"Вице-королевство Новая Гранада"],
 ["Viceroyalty of Rio de la Plata",1800,"Вице-королевство Рио-де-ла-Плата"],
 ["Kingdom of Jerusalem",1200,"Иерусалимское королевство"]
]){
 assert.equal(findHistoricalReference(alias,year)?.title,title,"Source matching failed: "+alias);
}
assert.equal(findHistoricalReference("Yuan Dynasty",1550),undefined,"Do not match outside attested time window");
assert.equal(findHistoricalReference("Novgorod Republic",1510),undefined,"Do not extend Novgorod independence beyond 1478");
assert.equal(findHistoricalReference("Northern Song",1150),undefined,"Northern Song ends in 1127");
assert.equal(findHistoricalReference("Liao dynasty",1200),undefined,"Liao ends in 1125");
assert.equal(findHistoricalReference("Kingdom of Jerusalem",1400),undefined,"Crusader kingdom does not persist past 1291");
assert.equal(findHistoricalReference("Inca Empire",1400),undefined,"Do not map Inca imperial borders before 1438");
assert.equal(findHistoricalReference("Казанское ханство",1500)?.id,"kazan-khanate","Russian source title lookup");
assert.equal(findHistoricalReference("Kazan-Khanate",1500)?.id,"kazan-khanate","Hyphenated atlas label lookup");
assert.equal(findHistoricalReference("Novgorod—Republic",1350)?.id,"novgorod-republic","Unicode dash atlas lookup");
assert.equal(normalizeHistoricalReferenceName("Kievan Rus’"),normalizeHistoricalReferenceName("Kievan Rus'"),"Historical apostrophe normalization");
assert.ok(atlas.includes("lektrus-history-source-library"),"The sourced catalogue should remain available without a polygon");
assert.ok(atlas.includes("visibleHistoricalReferences"),"Catalogue search must use Russian titles and aliases");
assert.ok(atlas.includes("referenceOnlyCurrentPeriod"),"Historian can filter the reference library by dated period");
assert.ok(referenceSource.includes("historicalReferenceByAlias"),"Historical lookups must use an indexed alias table");
const aliasCoverage=new Map();
for(const item of historicalReferences){
 for(const alias of [item.title,...item.aliases]){
  const key=referencesApi.normalizeHistoricalReferenceName(alias);
  const list=aliasCoverage.get(key)??[];
  for(const other of list)if(other.id!==item.id)assert.ok(item.from>other.to||item.to<other.from,
   "Ambiguous simultaneous alias: "+alias+" between "+other.id+" and "+item.id);
  list.push(item);aliasCoverage.set(key,list);
 }
}
assert.equal(new Set(historicalReferences.map(x=>x.id)).size,historicalReferences.length,"IDs must be unique");
assert.ok(atlas.includes("normalizeHistoricalReferenceName"),"Map and catalogue should share conservative name matching");
assert.ok(atlas.includes("indexedReferenceMaps"),"References must use actual indexed historical shapes");
assert.ok(atlas.includes("Показать на карте ·"),"Map action must be available only for dated matches");
console.log("Historical atlas: 41 encyclopedia entries, "+historicalReferences.length+" sourced reference records, alias/date guards and cross-era UI checked.");
