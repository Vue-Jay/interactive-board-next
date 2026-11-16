// Build an immutable, candidate-only annual atlas from the pinned source.
// node scripts/build-lektrus-historical-timeline.mjs SOURCE.geojson OUTPUT_DIR
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {capitalInsideCountry} from './atlas-2026-capitals.mjs';
import {referenceAdmissionWarnings} from './audit-lektrus-atlas-annual.mjs';
import {HISTORY_SCHEMA, HISTORY_FIRST_YEAR, HISTORY_LAST_YEAR, historicalYearOrdinal, historicalYearFromOrdinal, validateHistoricalManifest, validateHistoricalPack} from '../src/lektrusHistoricalTimeline.ts';

export const SOURCE = Object.freeze({name:'Cliopatria', version:'0.2.1', url:'https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/5f433377139a6eeaeacbdc894b70f8805b72c8b5/cliopatria.geojson.zip', license:'CC BY 4.0'});
export const PINNED_SOURCE_SHA256 = 'fc6f0d1e4cc42f45da83522b3696db6f2cc85ec0d12259a85c89b31347b8fc0a';
const MAX_PACK_GZIP = 2 * 1024 * 1024;
export const sha256 = data => createHash('sha256').update(data).digest('hex');
const identity = (...parts) => sha256(JSON.stringify(parts));
const MALI_SOURCES = ['https://digitallibrary.un.org/record/620443','https://legal.un.org/ilc/publications/yearbooks/english/ilc_1962_v2.pdf'];
const INDONESIA_SOURCE = 'https://peacekeeping.un.org/sites/default/files/past/unsfbackgr.html';
const ZIMBABWE_SOURCE = 'https://legal.un.org/repertory/art73/english/rep_supp6_vol5_art73.pdf';
const DELHI_SOURCES=['https://ignca.gov.in/Asi_data/44707.pdf','https://www.metmuseum.org/de/toah/ht/08/ssa'];
const ZHOU_SOURCE='https://www.metmuseum.org/zh/toah/ht/04/eac.html';
const CHINA_GROUP_SOURCE='https://github.com/Seshat-Global-History-Databank/cliopatria/tree/5f433377139a6eeaeacbdc894b70f8805b72c8b5';
const chinaGroupTransition=new Set([155,172,175,176,177,178,261,273]);
const UK_SOURCE='https://commonslibrary.parliament.uk/research-briefings/cbp-10649/';
const UK_DEPENDENCIES='https://www.gov.uk/government/publications/crown-dependencies-jersey-guernsey-and-the-isle-of-man';
const COMMONWEALTH='https://thecommonwealth.org/our-member-countries';
const DUTCH_SOURCE='https://www.government.nl/themes/government-and-democracy/caribbean-parts-of-the-kingdom';
const DUTCH_TRANSITIONS='https://treaties.un.org/pages/historicalinfo.aspx';
const SURINAME_SOURCE='https://www.un.org/dppa/decolonization/en/history/former-trust-and-nsgts';
const PORTUGAL_SOURCE='https://www.parlamento.pt/Parlamento/Paginas/EstadoNovo.aspx';
const PORTUGAL_CONSTITUTION='https://www.parlamento.pt/Legislacao/Paginas/ConstituicaorepublicaPortuguesa.aspx';
const MACAO_SOURCE='https://bo.dsaj.gov.mo/BO/ii/2002/23/aviso42.asp';
const CABINDA_SOURCE='https://digitallibrary.un.org/record/855865/files/A_10040-EN.pdf';
const COUNTRY_NAMES='https://www.gov.uk/government/publications/country-names/timeline-of-country-name-changes-in-hmg-use-1919-to-present';
// Pinned component indices, checked against the source coordinates and the
// dated historical transition. Apply from the first complete calendar year
// or the transition year if the independent state is already present.
// Where the independent record starts late, this exposes a gap rather than
// continuing to draw the former administering power over it.
const GERMANY_OCCUPATION='https://www.bundesregierung.de/breg-de/schwerpunkte/deutsche-einheit/die-vier-maechte-in-deutschland-von-1945-bis-1990-480498';
const JAPAN_OCCUPATION='https://history.state.gov/countries/japan';
const RYUKYU='https://www.mofa.go.jp/policy/other/bluebook/1985/1985-3-3.htm';
const COMOROS='https://digitallibrary.un.org/record/441662/files/E_1990_6_Add.27-EN.pdf';
const componentExclusions=[
 [11901,2,1890,[0],'Luxembourg was a separate sovereign grand duchy under a personal union, which ended in 1890.','Люксембург был отдельным великим герцогством в личной унии, завершившейся в 1890 году.','https://luxembourg.public.lu/en/society-and-culture/history/renaissance-dun-pays.html'],
 [13318,38,1971,[22,23,24],'Fiji became independent in 1970.','Фиджи получило независимость в 1970 году.',SURINAME_SOURCE],
 [13318,38,1973,[5,6,7,8,9,10,11,12,13,14,15,16,17],'The Bahamas became independent in 1973.','Багамы получили независимость в 1973 году.',SURINAME_SOURCE],
 [13318,38,1975,[1],'Grenada became independent in 1974.','Гренада получила независимость в 1974 году.',SURINAME_SOURCE],
 [13318,38,1979,[3,25,26,27,28,29,30,31,32,33,34,35],'Dominica and the Solomon Islands became independent in 1978.','Доминика и Соломоновы Острова получили независимость в 1978 году.',SURINAME_SOURCE],
 [13318,38,1979,[2],'Saint Lucia became independent in 1979.','Сент-Люсия получила независимость в 1979 году.',SURINAME_SOURCE],
 [13318,38,1982,[4],'Belize became independent in 1981.','Белиз получил независимость в 1981 году.',SURINAME_SOURCE],
 [13318,38,1985,[36],'Brunei became independent in 1984.','Бруней получил независимость в 1984 году.',SURINAME_SOURCE],
 [12994,12,1976,[8,9,10,11],'Papua New Guinea became independent in 1975; the four source components are its islands.','Папуа — Новая Гвинея получила независимость в 1975 году; исключены четыре её островных контура.',SURINAME_SOURCE],
 [12994,12,1946,[7],'Manawatāwhi / Three Kings Islands are in New Zealand, not Australia.','Манаватафи / острова Три-Кингс относятся к Новой Зеландии, а не Австралии.','https://www.doc.govt.nz/nature/habitats/offshore-islands/te-hiku-far-north-islands/'],
 [13247,19,1963,[4],'France recognized Algerian independence on 3 July 1962.','Франция признала независимость Алжира 3 июля 1962 года.','https://history.state.gov/countries/algeria/recognition'],
 [13247,19,1976,[16,17,18],'Grande Comore, Anjouan and Mohéli became independent in 1975; Mayotte remains separately administered and disputed.','Гранд-Комор, Анжуан и Мохели получили независимость в 1975 году; Майотта остаётся отдельно управляемой спорной территорией.',COMOROS],
 [13247,19,1978,[1],'Djibouti became independent in 1977.','Джибути получило независимость в 1977 году.',SURINAME_SOURCE],
 [13247,19,1961,[8],'The occupation of the Federal Republic of Germany ended in 1955; the source retains a German component.','Оккупационный режим ФРГ завершился в 1955 году; исходник сохраняет немецкий компонент.',GERMANY_OCCUPATION],
 [13247,19,1991,[9],'Four-power status in Berlin ended in 1990.','Четырёхсторонний статус Берлина завершился в 1990 году.',GERMANY_OCCUPATION],
 [13372,11,1976,[6,7,8,9],'These four source polygons are the Comoro Islands, not Cabo Verde; the Comoros require a separate dated record.','Четыре исходных контура относятся к Коморским островам, а не к Кабо-Верде; нужна отдельная датированная запись Комор.',COMOROS],
 [13646,11,2024,[6,7,8,9],'These four source polygons are the Comoro Islands, not Cabo Verde; the Comoros require a separate dated record.','Четыре исходных контура относятся к Коморским островам, а не к Кабо-Верде; нужна отдельная датированная запись Комор.',COMOROS],
 [13019,66,1949,[29,33],'The Republic of Korea was established in 1948 and recognized by the USA on 1 January 1949.','Республика Корея образована в 1948 году, признана США 1 января 1949 года.','https://history.state.gov/countries/korea-south'],
 [13019,66,1953,[28,50,51,52,53,54,55,56,57,58,59,60],'Allied occupation of mainland Japan ended in April 1952.','Союзная оккупация основной территории Японии завершилась в апреле 1952 года.',JAPAN_OCCUPATION],
 [13019,66,1954,[49],'Amami Islands reverted to Japanese administration in 1953.','Острова Амами возвращены под управление Японии в 1953 году.',RYUKYU],
 [13019,66,1956,[38],'Occupation status of the Federal Republic of Germany ended in May 1955.','Оккупационный режим ФРГ завершился в мае 1955 года.',GERMANY_OCCUPATION],
 [13279,51,1973,[38,39,41],'The Paris Peace Accords ended US combat and provided for withdrawal from Vietnam.','Парижские соглашения 1973 года предусматривали вывод американских войск из Вьетнама.','https://history.state.gov/historicaldocuments/frus1969-76v15/d74'],
 [13279,51,1973,[43],'Okinawa reverted to Japanese administration in 1972.','Окинава возвращена под управление Японии в 1972 году.',RYUKYU],
 [13279,51,1980,[17],'The Panama Canal Zone ceased to exist on 1 October 1979.','Зона Панамского канала упразднена 1 октября 1979 года.','https://history.state.gov/milestones/1977-1980/panama-canal'],
 [13279,51,1987,[34,35,36],'The Compact of Free Association entered into force in 1986 for Micronesia.','С 1986 года Микронезия — в свободной ассоциации с США.',SURINAME_SOURCE],
 [13279,51,1991,[49],'Four-power status in Berlin ended in 1990.','Четырёхсторонний статус Берлина завершился в 1990 году.',GERMANY_OCCUPATION],
 [13279,51,1995,[37],'Palau became independent in 1994.','Палау получило независимость в 1994 году.',SURINAME_SOURCE],
];
const exclusionsFor=(index,year)=>componentExclusions.filter(r=>r[0]===index&&year>=r[2]);
const reviewedNames=[
 ['Former Yugoslav Republic of Macedonia','Q221',2019,'Republic of North Macedonia','Республика Северная Македония','https://www.un.org/en/node/123222'],
 ["People's Republic of Angola",'Q916',1992,'Republic of Angola','Республика Ангола','https://ciam.gov.ao/ao/angola/constituicao'],
 ['Union of Myanmar','Q836',2011,'Republic of the Union of Myanmar','Республика Союз Мьянма',DUTCH_TRANSITIONS],
 ['Saint Kitts','Q204989',1983,'Saint Kitts and Nevis','Сент-Китс и Невис',COUNTRY_NAMES],
 ['Saint Vincent','Q757',1979,'Saint Vincent and the Grenadines','Сент-Винсент и Гренадины',COUNTRY_NAMES],
 ['Federated Republic of Germany','Q183',1991,'Federal Republic of Germany','Федеративная Республика Германия','https://www.bundestag.de/en/parliament/history/parliamentarism/frg_parliamentarism/frg_parliamentarism-200324'],
];
const ukName=year=>year<1927?'United Kingdom of Great Britain and Ireland':'United Kingdom of Great Britain and Northern Ireland';
// Annual labels use the successor in the transition year; no new cartographic
// boundary is inferred from a dynastic succession. All raw fields survive.
const delhiTransitions=[{old:'Mamluk Dynasty',next:'Khalji Dynasty',qid:'Q919071',ru:'Династия Хильджи',from:1290,to:1293},{old:'Khalji Dynasty',next:'Tughlaq Dynasty',qid:'Q1124402',ru:'Династия Туглаков',from:1320,to:1325},{old:'Tughlaq Dynasty',next:'Sayyid Dynasty',qid:'Q1331421',ru:'Династия Сайидов',from:1414,to:1450},{old:'Sayyid Dynasty',next:'Lodi Dynasty',qid:'Q11709',ru:'Династия Лоди',from:1451,to:1452}];
function editorialSegments(base){
 const out=[];
 // Split only at an applicable correction boundary, never drop original years.
 const cuts=new Set([base.from,base.to+1]);
 const delhi=base.sourceSeshatId==='in_delhi_sultanate'&&(base.role==='composite'||base.memberOf.includes('(Delhi Sultanate)'));
 if(delhi)for(const t of delhiTransitions)if(t.from<=base.to&&t.to>=base.from){cuts.add(Math.max(base.from,t.from));cuts.add(Math.min(base.to,t.to)+1)}
 const spring=chinaGroupTransition.has(base.sourceIndex)&&base.memberOf.includes('(Spring and Autumn States)')&&base.from<=-480&&base.to>=-480;
 if(spring)cuts.add(-480);
 const cut=year=>{if(base.from<year&&year<=base.to)cuts.add(year)};
 for(const rule of componentExclusions)if(rule[0]===base.sourceIndex)cut(rule[2]);
 if(base.sourceIndex===13313)cut(1973);
 const british=base.sourceName==='Kingdom of Great Britain'&&base.sourceWikidata==='Q23666';
 const britishComponent=base.components.includes('Kingdom of Great Britain');
 if(british||britishComponent){cut(1801);cut(1927)}
 if(british){cut(2000);cut(2024)}
 for(const [name,qid,year] of reviewedNames)if(base.sourceName===name&&base.sourceWikidata===qid)cut(year);
 if(base.sourceName==='Netherlands Antilles'&&base.sourceWikidata==='Q25227'){cut(1976);cut(1986);cut(2010)}
 if(base.sourceName==='Estado Novo'&&base.sourceWikidata==='Q824489'){cut(1933);cut(1974)}
 if(base.sourceIndex===13399)cut(2000);
 if(base.sourceIndex===7783)cut(1516);
 if(base.sourceIndex===5295)cut(1210);
 if(base.sourceIndex===4776)cut(1126);
 if(base.sourceIndex===4678)cut(1094);
 const sorted=[...cuts].sort((a,b)=>a-b);
 for(let i=0;i+1<sorted.length;i++){
  const from=sorted[i],to=sorted[i+1]-1;
  let r={...base,from,to};
  const reasons=[],reasonsRu=[],sources=new Set();
  const note=(reason,urls,ru)=>{reasons.push(reason);if(ru)reasonsRu.push(ru);for(const url of urls)sources.add(url)};
  for(const rule of exclusionsFor(base.sourceIndex,from))note(rule[4]+' Only identified source components were removed; coverage and remaining borders are unverified.',[rule[6]],rule[5]+' Остальные границы и полнота покрытия требуют проверки.');
  if(base.sourceIndex===13309){
   r={...r,name:'Seychelles (British colony)',nameRu:'Сейшельские острова (британская колония)',nameStatus:'reviewed',entityId:identity('reviewed-polity','seychelles-british-colony')};
   note('The source polygon is Mahé in the Seychelles, not the mainland East Africa Protectorate. Seychelles remained a British colony until 1976.',[SURINAME_SOURCE],'Исходный контур — остров Маэ, а не материковый протекторат Восточной Африки. Сейшелы оставались британской колонией до 1976 года.');
  }
  if(base.sourceIndex===13313){
   r={...r,geometryStatus:'rejected',sourceComponents:base.components,components:r.components.map(n=>n==='British East Africa'?'Seychelles (British colony)':n)};
   note('Static imperial aggregate contains territories after their independence and cannot represent the changing empire. The original contour is preserved for review, not displayed. Seychelles colonial coverage is missing in 1973–1975.',[SURINAME_SOURCE],'Неизменный сводный контур империи включает территории после их независимости, поэтому исключён из отрисовки. Колониальный контур Сейшел за 1973–1975 годы отсутствует.');
  }
  if(delhi){
   let label=base.role==='composite'?base.components[0]:base.name;
   for(const t of delhiTransitions)if(from>=t.from&&from<=t.to&&label===t.old){
    label=t.next;
    if(base.role==='composite')r={...r,sourceComponents:base.components,components:[t.next]};
    else r={...r,name:t.next,nameRu:t.ru,nameStatus:'reviewed',entityId:identity('source-polity',t.next,t.qid)};
    note('Delhi Sultanate ruling dynasty corrected to '+t.next+'; source geometry remains unverified.',DELHI_SOURCES);
   }
   // This composite retains a stale Tughlaq label even after the Sayyid-to-Lodi transition.
   if(base.role==='composite'&&base.sourceName==='(Delhi Sultanate)'&&base.components[0]==='Tughlaq Dynasty'&&from>=1451&&to<=1452){r={...r,sourceComponents:base.components,components:['Lodi Dynasty']};note('The Lodi dynasty succeeded the Sayyids in 1451; source geometry remains unverified.',DELHI_SOURCES)}
  }
  if(base.sourceName==='Later Zhou'&&base.sourceWikidata==='Q1154556'&&to<0){r={...r,name:'Eastern Zhou',nameRu:'Восточная Чжоу',nameStatus:'reviewed',entityId:identity('reviewed-polity','eastern-zhou')};note('Ancient Zhou royal territory, not the Later Zhou dynasty of the tenth century; the reconstructed extent is unverified.',[ZHOU_SOURCE])}
  if(base.role==='composite'&&to<0&&['(Spring and Autumn States)','(Warring States China)'].includes(base.sourceName)&&base.components.includes('Later Zhou')){r={...r,sourceComponents:base.components,components:base.components.map(n=>n==='Later Zhou'?'Eastern Zhou':n)};note('Ancient Zhou component corrected; source extent is unchanged.',[ZHOU_SOURCE])}
  if(spring&&from>=-480){r={...r,sourceMemberOf:base.memberOf,memberOf:base.memberOf.map(n=>n==='(Spring and Autumn States)'?'(Warring States China)':n)};note('Membership aligned with the pinned dataset’s active chronological grouping and explicit components; this is the dataset convention, not an independently established exact period boundary.',[CHINA_GROUP_SOURCE])}
  for(const [name,qid,year,next,ru,url] of reviewedNames)if(base.sourceName===name&&base.sourceWikidata===qid&&from>=year){
   r={...r,name:next,nameRu:ru,nameStatus:'reviewed',entityId:name==='Federated Republic of Germany'?identity('source-polity',next,qid):base.entityId};
   const island=['Saint Kitts','Saint Vincent'].includes(name);
   note('Historical state name corrected; source geometry remains unverified.'+(island?' Only the main island is present in the source; other islands remain missing.':''),[url],'Уточнено историческое название. Контур ещё не проверен.'+(island?' В исходнике есть только главный остров, остальные отсутствуют.':''));
  }
  if(british&&from>=1801){
   r={...r,name:ukName(from),nameRu:from<1927?'Соединённое Королевство Великобритании и Ирландии':'Соединённое Королевство Великобритании и Северной Ирландии',nameStatus:'reviewed',entityId:identity('reviewed-polity','united-kingdom')};
   note('The 1801 union established the United Kingdom; the 1927 title distinguishes Northern Ireland. The original geometry is not independent proof of historical borders.',[UK_SOURCE],'С 1801 года — Соединённое Королевство, с 1927 года в официальном названии указана Северная Ирландия. Исторические границы требуют независимой проверки.');
   if(from>=2000&&to<=2023&&base.memberOf.includes('(British Empire)')){r={...r,sourceMemberOf:base.memberOf,memberOf:base.memberOf.filter(n=>n!=='(British Empire)')};note('Removed obsolete map link to an absent empire grouping; this is not a claim about Commonwealth membership.',[COMMONWEALTH])}
   if(base.sourceIndex===13305||base.sourceIndex===13684)note('UK core only: excluded disconnected non-UK territories (including Crown dependency Isle of Man); retained original UK islands and Northern Ireland. Missing or separately administered territories require separate review.',[UK_DEPENDENCIES],'Оставлены острова Великобритании и Северная Ирландия; исключены отдельные территории, не входящие в состав самого Соединённого Королевства. Контуры этих территорий требуют отдельной проверки.');
  }
  if(britishComponent&&from>=1801){r={...r,sourceComponents:base.components,components:base.components.map(n=>n==='Kingdom of Great Britain'?ukName(from):n)};note('Updated historical component name in line with the 1801 union and 1927 title.',[UK_SOURCE])}
  if(base.sourceIndex===13708){r={...r,geometryStatus:'rejected'};note('The Commonwealth is an association of independent countries, not a territorial union of the UK and its overseas territories. This two-component overlay is not a Commonwealth map.',[COMMONWEALTH],'Содружество состоит из независимых государств. Контур только Великобритании и её заморских территорий не является картой Содружества.')}
  if(base.sourceIndex===13633){r={...r,sourceMemberOf:base.memberOf,memberOf:base.memberOf.filter(n=>n!=='(Commonwealth of Nations)')};note('Overseas territories are not individual sovereign Commonwealth member countries.',[COMMONWEALTH],'Заморские территории не являются самостоятельными государствами — членами Содружества.')}
  if(base.sourceName==='Netherlands Antilles'&&base.sourceWikidata==='Q25227'){
   if(to<1976){r={...r,name:base.sourceIndex===11004?'Dutch Caribbean possessions':'Dutch Caribbean possessions and Suriname (source aggregate)',nameRu:base.sourceIndex===11004?'Нидерландские владения в Карибском море':'Нидерландские владения в Карибском море и Суринам (сводный контур)',nameStatus:'reviewed'};note('Source combines distinct Dutch territories; it cannot be identified as the Netherlands Antilles alone. Source extent remains unverified.',[SURINAME_SOURCE])}
   else if(from<2010){note('Source component for Suriname excluded after its 1975 independence. '+(from>=1986?'Aruba excluded from 1 January 1986. ':'')+'Source island coverage is incomplete; not a fully verified border.',[SURINAME_SOURCE,DUTCH_TRANSITIONS],'Исключён Суринам после независимости в 1975 году. '+(from>=1986?'С 1986 года исключена также Аруба. ':'')+'Остальные островные контуры неполны.')}
   else {r={...r,geometryStatus:'rejected'};note('Netherlands Antilles dissolved on 10 October 2010. A single former-country polygon is not a valid reconstruction of the successor territories; the 2010 transition and later years need separate dated polygons.',[DUTCH_SOURCE,DUTCH_TRANSITIONS],'Нидерландские Антильские острова распущены 10 октября 2010 года. Нужны отдельные датированные контуры территорий-преемников.')}
  }
  if(base.sourceName==='Estado Novo'&&base.sourceWikidata==='Q824489'){
   if(to<1933){r={...r,name:'Portugal (military dictatorship)',nameRu:'Португалия (военная диктатура)',nameStatus:'reviewed'};note('The Estado Novo constitution dates to 1933; preceding military dictatorship is a distinct regime. Source extent includes colonial areas and remains unverified.',[PORTUGAL_SOURCE])}
   else if(from>=1979){r={...r,geometryStatus:'rejected'};note('The source polygon is Cabinda, an integral part of Angola from independence in 1975, not the defunct Portuguese Estado Novo.',[PORTUGAL_SOURCE,CABINDA_SOURCE],'Кабинда входит в состав Анголы с момента независимости в 1975 году, а не в состав прекратившего существование португальского режима.')}
   else if(from>=1974){r={...r,name:'Portugal',nameRu:'Португалия',nameStatus:'reviewed',entityId:identity('source-polity','Portugal','Q45')};note('Estado Novo ended on 25 April 1974; retain only mainland Portugal, the Azores and Madeira from the same source record. Overseas transition territories require separate reconstruction.',[PORTUGAL_SOURCE,PORTUGAL_CONSTITUTION],'Режим Нового государства завершился 25 апреля 1974 года. Сохранён контур материковой Португалии, Азорских островов и Мадейры; заморские территории переходного периода требуют отдельной реконструкции.')}
  }
  if(base.sourceIndex===13399&&from>=2000){note('Macao reverted to Chinese sovereignty on 20 December 1999. Excluded the Macao polygon from the Portuguese state in the following full years, without altering the European outlines.',[MACAO_SOURCE],'Макао передан Китаю 20 декабря 1999 года. С 2000 года его контур исключён из Португалии; европейские контуры сохранены.')}
  if(base.sourceIndex===13659)note('Cabinda component restored from the same-year archival record incorrectly labelled Estado Novo; exact source coordinates preserved. The Angolan border remains a candidate.',[CABINDA_SOURCE],'Кабинда восстановлена в контуре Анголы из ошибочно подписанной записи того же года. Координаты исходника сохранены; границы требуют независимой проверки.');
  // Only reconcile names with exact pinned-source evidence; do not infer missing borders.
  const replaceComponent=(old,next)=>{r={...r,sourceComponents:base.components,components:r.components.map(n=>n===old?next:n)};note('Component label aligned with the simultaneously active record, without inferring territorial changes.',[CHINA_GROUP_SOURCE])};
  if(base.sourceIndex===7783&&from>=1516)replaceComponent('House of Habsburg','Habsburg Monarchy');
  if(base.sourceIndex===5295&&from>=1210)replaceComponent('Angevin Empire','Kingdom of England');
  if(base.sourceIndex===4776&&from>=1126)replaceComponent('County of Anjou','Angevins');
  if(base.sourceIndex===4678&&from>=1094){r={...r,sourceComponents:base.components,components:[...r.components,'County of Champagne']};note('Active County of Champagne explicitly identifies this composite in the source; its reciprocal component label was missing. Geometry is unchanged.',[CHINA_GROUP_SOURCE])}
  if(reasons.length)r={...r,review:{reason:reasons.join(' '),...(reasonsRu.length?{reasonRu:reasonsRu.join(' ')}:{}),sources:[...sources]}};
  // Avoid artificial splits where none of the corrections applied.
  const last=out.at(-1);if(last&&JSON.stringify({...last,from:0,to:0})===JSON.stringify({...r,from:0,to:0}))last.to=to;else out.push(r);
 }
 return out;
}
// Component selections are pinned to original feature/part indices. No modern
// geometry, coordinate interpolation or nearest-year geometry is introduced.
export function reviewedGeometryParts(r){
 const exclusions=exclusionsFor(r.sourceIndex,r.from);
 if(exclusions.length){
  const excluded=new Set(exclusions.flatMap(rule=>rule[3]));
  return Array.from({length:exclusions[0][1]},(_,part)=>part).filter(part=>!excluded.has(part)).map(part=>({index:r.sourceIndex,part}));
 }
 if(r.sourceIndex===13305&&r.sourceName==='Kingdom of Great Britain')return [2,3,4,5,6,7,13,14].map(part=>({index:13305,part}));
 if(r.sourceIndex===13684&&r.sourceName==='Kingdom of Great Britain')return [1,2,3,4,5,6,7,8].map(part=>({index:13684,part}));
 if(r.sourceIndex===11956&&r.sourceName==='Netherlands Antilles'&&r.from>=1976&&r.to<2010)return (r.from<1986?[1,2,3,4]:[1,2,4]).map(part=>({index:11956,part}));
 if(r.sourceIndex===13659&&r.sourceName==="People's Republic of Angola")return [{index:13659,part:0},{index:13753,part:0}];
 if(r.sourceIndex===13277&&r.sourceName==='Estado Novo'&&r.from>=1974)return [7,8,9,10,20,21].map(part=>({index:13277,part}));
 if(r.sourceIndex===13399&&r.sourceName==='Portugal'&&r.from>=2000)return [1,2,3,4,5,6].map(part=>({index:13399,part}));
 return null;
}
// Precisely identified by the bulk GEOS audit. Only retract zero-area spikes in
// interior rings: no shell, coordinate, polygon extent or historical claim changes.
const RETRACED_HOLES=new Set([
 'f997fe499f3ddf20456b2d95b3453ef88f1abb29ef6a2f1df95fdd48287661e9','50204fb705323b193bdcd69a37b4d33c32dbfdd55220b17b521e07eca0ef9d86',
 '00786671cb5daa0fa15b18636ead2753b15377443bdd09e13a530b88b9078d2f','962c7db877623c69f7517952f2ec79d401f08d950101dd747ca4b591a3305962',
 'cec2a64fe0b26774482c6ba3bd37d8a48f8606d080858534065e7806a0c01fc3','27a6bacb623875306d1f48e960e06396d390bbec077f05848588cd0632e7c72b',
 '7819e7b5ec9482a5cb0c52edc9b6987a82a3d856af63e68d5eca48a7e2889bb8','16e63e027a8082f89428731513ab3e5005f8b657a95e370b5a5766f4b8296a0b',
 'edfcab649fbe27ee26898125ca418acde76b7cf03ceb877b68444f3f76fd654f','274cd2ebff1fef2b38376a9aa953f4d3c8f3207bcdbeecf0b857196a0500d731',
 'af6ace1e0cbeacecd733df2007fea7d0a0a14395b0b37f5d64e36b140ec10fd3','cda8ecb9fd71fa7512fcd9972418a12000ac7dc5566ca800d9a6c4730c5ec2c0',
 '69fde5edb1cf8f8e0a239b131801f552e12eed146fb68aa74a8602504c919bba'
]);
const samePoint=(a,b)=>a[0]===b[0]&&a[1]===b[1];
export function removeRetracedHole(ring){
 const pts=ring.slice(0,-1);let changed=true;
 while(changed&&pts.length>2){
  changed=false;for(let i=0;i<pts.length;i++){
   const next=(i+1)%pts.length,after=(i+2)%pts.length;
   if(samePoint(pts[i],pts[next])){pts.splice(next,1);changed=true;break}
   if(samePoint(pts[i],pts[after])){for(const k of [next,after].sort((a,b)=>b-a))pts.splice(k,1);changed=true;break}
  }
 }
 if(pts.length<3)return null;
 return [...pts,pts[0]];
}
function repairGeometry(geometry,sourceGeometryId){
 if(!RETRACED_HOLES.has(sourceGeometryId))return geometry;
 const fix=p=>[p[0],...p.slice(1).map(removeRetracedHole).filter(Boolean)];
 return {...geometry,coordinates:geometry.type==='Polygon'?fix(geometry.coordinates):geometry.coordinates.map(fix)};
}

function validateGeometry(g) {
  assert.ok(g && ['Polygon','MultiPolygon'].includes(g.type));
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  assert.ok(Array.isArray(polygons) && polygons.length);
  for (const polygon of polygons) {
    assert.ok(Array.isArray(polygon) && polygon.length);
    for (const ring of polygon) {
      assert.ok(Array.isArray(ring) && ring.length >= 4);
      for (const point of ring) assert.ok(Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90);
      assert.deepEqual(ring[0], ring.at(-1), 'unclosed ring');
    }
  }
}

export function normalizeHistoricalSource(source) {
  assert.equal(source.type,'FeatureCollection');
  const geometries = new Map(), records = [];
  const counts = {sourcePolities:0, sourceComposites:0, sourceRelations:0, zeroBoundaryRecords:0, revisions:0, uniqueGeometries:0, rejectedRevisions:0, reviewedNames:0};
  for (const [sourceIndex, feature] of source.features.entries()) {
    const p = feature.properties;
    assert.ok(['POLITY','RELATION'].includes(p.Type));
    const sourceFrom = p.FromYear, sourceTo = p.ToYear;
    assert.ok(Number.isInteger(sourceFrom) && Number.isInteger(sourceTo) && sourceFrom <= sourceTo && sourceFrom >= HISTORY_FIRST_YEAR && sourceTo <= HISTORY_LAST_YEAR, `Invalid dates at ${sourceIndex}`);
    const sourceName = p.Name.trim(), sourceWikidata = p.Wikidata ?? '';
    assert.ok(sourceName, `Empty name at ${sourceIndex}`);
    // The authors explicitly distinguish composite polities from their member
    // polygons; RELATION is a different semantic layer (not sovereignty).
    const list=value=>String(value??'').split(';').map(s=>s.trim()).filter(Boolean);
    const components=list(p.Components),memberOf=list(p.MemberOf);
    const role=p.Type==='RELATION'?'relation':/^\(.+\)$/.test(sourceName)?'composite':'polity';
    assert.equal(role==='polity',components.length===0,`Unexpected component encoding ${sourceIndex}`);
    counts[role==='polity'?'sourcePolities':role==='composite'?'sourceComposites':'sourceRelations']++;
    if (sourceFrom === 0 || sourceTo === 0) counts.zeroBoundaryRecords++;
    // Preserve original endpoints; the displayed calendar has no year zero.
    const from = sourceFrom === 0 ? 1 : sourceFrom, to = sourceTo === 0 ? -1 : sourceTo;
    assert.ok(from <= to, `Zero-only source record at ${sourceIndex} requires editorial review`);
    validateGeometry(feature.geometry);
    const sourceGeometryId = sha256(JSON.stringify(feature.geometry));
    const geometry=repairGeometry(feature.geometry,sourceGeometryId);
    const geometryId = sha256(JSON.stringify(geometry));
    validateGeometry(geometry);
    if (!geometries.has(geometryId)) geometries.set(geometryId, geometry);
    // Provisional source identity, never inferred from a similar display name.
    // A reviewed crosswalk can explicitly link variants later.
    const entityId = identity('source-'+role, sourceName, sourceWikidata);
    const base = {entityId, geometryId, role,components,memberOf,sourceSeshatId:String(p.SeshatID??''),sourceWikipedia:String(p.Wikipedia??''), ...(geometryId!==sourceGeometryId?{sourceGeometryId,geometryRepair:'retracted-zero-area-interior-edges'}:{}),name: sourceName, sourceName, sourceWikidata, sourceIndex, sourceFrom, sourceTo, from, to, nameStatus:'candidate', geometryStatus:'candidate'};
    const add = revision => {
      const selection=reviewedGeometryParts(revision);
      if(selection){
        assert.ok(revision.review?.sources.length);
        const coordinates=selection.map(({index,part})=>{const g=source.features[index].geometry;const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;assert.ok(polygons[part]);return polygons[part]});
        const selected={type:'MultiPolygon',coordinates};validateGeometry(selected);
        const selectedId=sha256(JSON.stringify(selected));geometries.set(selectedId,selected);
        revision={...revision,geometryId:selectedId,sourceGeometryId,geometryRepair:'reviewed-source-components',geometryParts:selection};
      }
      const id = identity('revision', sourceIndex, sourceFrom, sourceTo, revision.geometryId, revision.from, revision.to, revision.name);
      records.push({id, ...revision});
      if (revision.nameStatus === 'reviewed') counts.reviewedNames++;
      if (revision.geometryStatus === 'rejected') counts.rejectedRevisions++;
    };
    if (sourceName === 'Mali Federation' && from >= 1961 && sourceWikidata === 'Q216632') {
      add({...base, entityId:identity('reviewed-polity','republic-of-mali'), name:'Republic of Mali', nameRu:'Республика Мали', nameStatus:'reviewed', review:{reason:'Federation dissolved in 1960; later records refer to the Republic of Mali. Geometry remains unverified.',sources:MALI_SOURCES}});
    } else if (sourceName === 'Zimbabwe Rhodesia' && sourceWikidata === 'Q890120' && from === 1979 && to === 1982) {
      add({...base,to:1979});
      add({...base,from:1980,entityId:identity('source-polity','Republic of Zimbabwe','Q954'),name:'Republic of Zimbabwe',nameRu:'Республика Зимбабве',nameStatus:'reviewed',review:{reason:'Independence as the Republic of Zimbabwe on 18 April 1980; annual label reflects the new state, not a day-level boundary reconstruction. Geometry remains unverified.',sources:[ZIMBABWE_SOURCE]}});
    } else if (sourceName === 'Republic of Indonesia' && from === 1960 && to >= 1963 && capitalInsideCountry([138,-4], feature.geometry)) {
      add({...base, to:1962, geometryStatus:'rejected', review:{reason:'Source polygon includes western New Guinea before the 1963 transfer; excluded from candidate drawing until corrected geometry is sourced.',sources:[INDONESIA_SOURCE]}});
      add({...base, from:1963});
    } else for(const revision of editorialSegments(base))add(revision);
  }
  counts.revisions = records.length;
  const used=new Set(records.map(r=>r.geometryId));for(const id of geometries.keys())if(!used.has(id))geometries.delete(id);
  counts.uniqueGeometries = geometries.size;
  return {records,geometries,counts};
}

export function buildHistoricalTimeline(source, sourceHash, outDir) {
  const {records,geometries,counts} = normalizeHistoricalSource(source);
  fs.mkdirSync(path.join(outDir,'packs'),{recursive:true});
  const blocks = [];
  function writeBlock(ordinal, end) {
    const from = historicalYearFromOrdinal(ordinal);
    const to = historicalYearFromOrdinal(end);
    const active = records.filter(r => r.from <= to && r.to >= from);
    const ids = [...new Set(active.map(r=>r.geometryId))].sort();
    const coverageGaps={};
    for(let year=Math.max(1960,from);year<=to;year++){
      const gaps=referenceAdmissionWarnings(year,active.filter(r=>r.role==='polity'&&r.geometryStatus!=='rejected'&&r.from<=year&&r.to>=year).map(r=>r.name));
      if(gaps.length)coverageGaps[year]=gaps;
    }
    const pack = {schema:HISTORY_SCHEMA,from,to,records:active,coverageGaps,geometries:Object.fromEntries(ids.map(id=>[id,geometries.get(id)]))};
    const bytes = Buffer.from(JSON.stringify(pack));
    const gzipBytes = gzipSync(bytes,{level:6}).length;
    if (gzipBytes > MAX_PACK_GZIP && ordinal < end) {
      const mid = Math.floor((ordinal + end) / 2);
      writeBlock(ordinal,mid);
      writeBlock(mid+1,end);
      return;
    }
    const digest = sha256(bytes), file = `packs/${digest}.json`;
    const block = {from,to,file,sha256:digest,bytes:bytes.length,gzipBytes};
    validateHistoricalPack(pack,block);
    fs.writeFileSync(path.join(outDir,file),bytes);
    blocks.push(block);
  }
  // Locality: nearby years share one pack; recent years need smaller blocks.
  // Algorithmically bisect dense blocks instead of forcing huge downloads.
  const endOrdinal = historicalYearOrdinal(HISTORY_LAST_YEAR);
  for (let ordinal = historicalYearOrdinal(HISTORY_FIRST_YEAR); ordinal <= endOrdinal;) {
    const size = historicalYearFromOrdinal(ordinal) >= 1900 ? 10 : 100;
    const end = Math.min(endOrdinal, ordinal + size - 1);
    writeBlock(ordinal,end);
    ordinal = end + 1;
  }
  const manifest = {schema:HISTORY_SCHEMA,from:HISTORY_FIRST_YEAR,to:HISTORY_LAST_YEAR,source:{...SOURCE,sha256:sourceHash},blocks,counts};
  validateHistoricalManifest(manifest);
  fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [sourceFile,outDir] = process.argv.slice(2);
  assert.ok(sourceFile && outDir,'Usage: build-lektrus-historical-timeline.mjs SOURCE.geojson OUTPUT_DIR');
  const bytes = fs.readFileSync(sourceFile);
  assert.equal(sha256(bytes),PINNED_SOURCE_SHA256,'Source differs from the pinned historical release');
  const manifest = buildHistoricalTimeline(JSON.parse(bytes),PINNED_SOURCE_SHA256,outDir);
  console.log(JSON.stringify({counts:manifest.counts,blocks:manifest.blocks.length,bytes:manifest.blocks.reduce((n,b)=>n+b.bytes,0),gzipBytes:manifest.blocks.reduce((n,b)=>n+b.gzipBytes,0),maxPackGzip:Math.max(...manifest.blocks.map(b=>b.gzipBytes))}));
}
