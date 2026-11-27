// Build an immutable, candidate-only annual atlas from the pinned source.
// node scripts/build-lektrus-historical-timeline.mjs SOURCE.geojson OUTPUT_DIR
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import polygonClipping from 'polygon-clipping';
import {capitalInsideCountry} from './atlas-2026-capitals.mjs';
import {referenceAdmissionWarnings} from './audit-lektrus-atlas-annual.mjs';
import {HISTORY_SCHEMA, HISTORY_FIRST_YEAR, HISTORY_LAST_YEAR, historicalYearOrdinal, historicalYearFromOrdinal, validateHistoricalManifest, validateHistoricalPack} from '../src/lektrusHistoricalTimeline.ts';

export const SOURCE = Object.freeze({name:'Cliopatria', version:'0.2.1', url:'https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/5f433377139a6eeaeacbdc894b70f8805b72c8b5/cliopatria.geojson.zip', license:'CC BY 4.0'});
export const PINNED_SOURCE_SHA256 = 'fc6f0d1e4cc42f45da83522b3696db6f2cc85ec0d12259a85c89b31347b8fc0a';
const MAX_PACK_GZIP = 2 * 1024 * 1024;
export const sha256 = data => createHash('sha256').update(data).digest('hex');
const identity = (...parts) => sha256(JSON.stringify(parts));
export function componentHash(polygon){
  const canonicalRing=ring=>{
    const points=ring.slice(0,-1).map(p=>JSON.stringify(p));
    let min=points[0];
    for(const p of points)if(p<min)min=p;
    let best;
    for(let i=0;i<points.length;i++)if(points[i]===min)for(const d of [1,-1]){
      const candidate=Array.from({length:points.length},(_,j)=>points[(i+d*j+points.length)%points.length]).join(',');
      if(best===undefined||candidate<best)best=candidate;
    }
    return best;
  };
  return sha256(JSON.stringify([canonicalRing(polygon[0]),polygon.slice(1).map(canonicalRing).sort()]));
}

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
const UNION_1707='https://www.parliament.uk/globalassets/documents/heritage/articlesofunion.pdf';
const BLOIS_CHAMPAGNE='https://sigilla.irht.cnrs.fr/59645';
const MAINE_FULK='https://fasg.org/projects/henryproject/data/fulk0005.htm';
const NORMANDY_GEOFFREY='https://theses.gla.ac.uk/3052/1/2011DuttonPhD.pdf';
const SONG_REUNIFICATION='https://assets.cambridge.org/97805218/12481/excerpt/9780521812481_excerpt.pdf';
const SONG_CHRONOLOGY='https://pages.ucsd.edu/~dkjordan/chin/chinahistory/dyn15-u.html';
const DENIA_HISTORY='https://digibug.ugr.es/bitstream/handle/10481/88108/Tawaif_PDF.pdf?isAllowed=y&sequence=4';
const MALLORCA_HISTORY='https://conservancy.umn.edu/bitstreams/994f9abb-c044-48ff-9f9b-fd84aa1cf8be/download';
const TAIFA_HISTORY='https://ifc.dpz.es/webs/atlash/indice_epocas/islamica/27.htm';
const BLOIS_UNION='Counties of Blois and Champagne (same ruler)';
const BRITISH_SUPPLEMENT='British colonial possessions (supplemental source record)';
const MALLORCA_TAIFA='Taifa of Mallorca';
const INDIA_OCCUPATION='https://www.loc.gov/resource/gdc.a22000934/?sp=2&st=list';
const INDIA_HISTORY='https://puducherry-dt.gov.in/history/';
const INDIA_RESTITUTION='https://library.bjp.org/jspui/bitstream/123456789/1945/1/The-Imperial-Gazetteer-Of-India-Vol-12%20%28Eineme%20to%20Gwalior%29.pdf';
const REUNION_RESTITUTION='https://www.portail-esclavage-reunion.fr/documentaires/la-traite-des-esclaves/la-traite-illegale-2/la-traite-illegale/';
const REUNION_HISTORY='https://www.departement974.fr/actualite/presentation-de-linstitution-histoire-departement-de-reunion';
const JULY_CHARTER='https://www.elysee.fr/la-presidence/la-charte-constitutionnelle-du-14-aout-1830';
const SECOND_REPUBLIC_CHARTER='https://www.elysee.fr/la-presidence/la-constitution-du-4-novembre-1848';
const SALONA_HISTORY='https://www.ime.gr/chronos/projects/fragokratia/en/webpages/salona_gen.html';
const SALONA_MUSEUM='https://delphi.culture.gr/phocis/';
const DUTCH_HOLLAND='https://www.rijksmuseum.nl/en/collection/object/Grootkruis-van-de-Orde-van-de-Unie-behoord-hebbend-aan-IJA-Gogel--3fb25da543f1f15b4fbff75c4640bc01';
const DUTCH_JAVA='https://www.rijksmuseum.nl/en/collection/publication/The-British-in-Java-1811-1816-a-Javanese-account-a-text-edition-English-synopsis-and-commentary-on-British-Library-additional-manuscript-12330-Babad-Bedhah-ing-Ngayogyakarta--eab08913130797b8ae5c29a1142b9b29';
const DUTCH_1940='https://www.annefrank.org/en/anne-frank/go-in-depth/german-invasion-netherlands/';
const DUTCH_GUYANA='https://ntg.gov.gy/monument/fort-kyk-over-al/';
const DUTCH_HUDSON='https://www.loc.gov/loc/lcib/93/9321/chart.html';
const DUTCH_BRAZIL='https://bndigital.bn.gov.br/dossies/historias-da-nova-holanda/';
const DUTCH_BRAZIL_CAPITULATION='https://funag.gov.br/loja/download/975-Obras_do_Barao_do_Rio_Branco_VI_Efemerides_Brasileiras.pdf';
const NEW_NETHERLAND_TRANSFER='https://www.loc.gov/item/2021666724/';
const DUTCH_WIC='https://www.rijksmuseum.nl/en/collection/node/The-Dutch-West-India-Company-WIC--6ce37825be4846f6bb3e683aea272840';
const DUTCH_CURACAO='https://nationaalarchief.cw/educatie/educatiemappen/';
const DUTCH_ARUBA='https://www.gobierno.aw/nl/historie-van-het-koninkrijk-en-aruba';
const DUTCH_BONAIRE='https://canoncuracao.cw/47-de-andere-eilanden-van-de-nederlandse-antillen/';
const SAINT_MARTIN_PARTITION='https://www.senat.fr/leg/pjl25-437.pdf';
const TOBAGO_HISTORY='https://visittobago.gov.tt/local-culture-people-heritage/history-culture/historical-timeline';
const ITALIAN_AUTONOMY='https://www.treccani.it/machiavelli/saggi_e_approfondimenti/saggi/equilibri-politico-diplomatici-anni-Machiavelli.html';
const FRENCH_INDIA_GROUPS=[10304,10339,10384,10416,10448,10512,10530,10600,10646,10683,10713,10786,10826,10866,10915];
const DUTCH_HOLLAND_GROUPS=[10639,10738,10747];
const DUTCH_HOLLAND_METRO=[10591,10735,10748];
const DUTCH_HOLLAND_COLONIES=[10631,10767];
// Full-year map convention, from the documented annexation year; the
// transition within that year is noted, never presented as a day-level map.
export const songAnnexations=[[3929,3909,963],[3921,3909,965],[3949,3956,971],[3951,3956,975],[3932,3956,978],[3962,3956,979]];
const SONG_ENDS={'Later Zhou':960,Jingnan:963,'Later Shu':965,'Southern Han':971,'Southern Tang':975,Wuyue:978,'Northern Han':979};
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
 // The Venetian record conflates direct rule with independent or tributary island lordships.
 [7944,21,1540,[13,14,17],'The 1540 settlement left Andros and Kythnos with tributary Latin lords and placed Ios under direct Ottoman administration. None of these components then represents direct Venetian territory; Ottoman suzerainty must not be confused with direct administration.','По итогам войны 1537–1540 годов Андрос и Китнос оставались у латинских владетелей — данников султана, Иос перешёл под непосредственное османское управление. Эти контуры больше не представляют прямую власть Венеции; османский сюзеренитет не равнозначен прямому управлению.','https://cycladiccastles.gr/en/timeline/'],
 [7944,21,1540,[19],'Skyros was conquered by Barbarossa in 1538. Exclude the Venetian component once the overlapping successor source record appears; the exact form of Ottoman and local administration still requires review.','Скирос был завоёван Барбароссой в 1538 году. Венецианский контур исключён с появления совпадающей записи преемника; форма местного и османского управления требует проверки.','https://digital.library.adelaide.edu.au/server/api/core/bitstreams/ae98e5c1-9448-404a-acd1-6b6f5ef1aeb7/content'],
 [7187,7,1440,[3],'The Athonite monasteries submitted to Ottoman rule in 1424. Their institutional autonomy did not constitute continued Byzantine territorial sovereignty. The source coverage of the successor is unverified.','Афонские монастыри признали османскую власть в 1424 году. Их автономия не означает сохранения византийского территориального суверенитета. Контур преемника требует проверки.','https://www.elpenor.org/athos/en/e21811.asp'],
 // Bounded exclusions use an optional inclusive end year (slot 7).
 [10461,2,1803,[0],'The Cape returned to Batavian administration in 1803 and was retaken by Britain in 1806; retain the original Cape component before and after this interval.','Капская колония вернулась под управление Батавской республики в 1803 году; британская власть восстановлена в 1806 году. Исходный капский контур сохранён до и после этого интервала.','https://sahistory.org.za/article/batavian-republic-1803-1806',1805],
 [9410,38,1709,[0,1,2,3,4,5,6,7,8,9,10,11,12,13,15,16,17,18,19,20,21,22,23,25,26,30,31,32,33,34,35,36,37],'After the 1707 union, these 33 exact components are already represented by the contemporary British colonial source record 9518. Keep the five unmatched components as an unverified supplemental footprint.','После унии 1707 года эти 33 точных контура уже представлены британской колониальной записью 9518 того же периода. Пять несовпадающих компонентов сохранены как непроверенный дополнительный контур.','https://www.parliament.uk/about/living-heritage/evolutionofparliament/legislativescrutiny/act-of-union-1707/'],
 [9553,2,1718,[1],'The Bombay component is duplicated by contemporary British colonial source records in 1718–1740. Preserve the unmatched Madras component and restore the original selection after the overlap interval.','Контур Бомбея дублируется британскими колониальными записями 1718–1740 годов. Несовпадающий контур Мадраса сохранён; после интервала совпадения восстанавливается исходный выбор.','https://www.parliament.uk/about/living-heritage/evolutionofparliament/legislativescrutiny/act-of-union-1707/',1740],
 [12069,22,1895,[11,12,13,15],'Makira, Guadalcanal, Malaita and New Georgia were included in the 1893 British protectorate; exclude their duplicated German source components only once the equivalent British record exists. The northern islands require separate review.','Макира, Гуадалканал, Малаита и Нью-Джорджия вошли в британский протекторат в 1893 году; их дублирующие немецкие контуры исключены с появления соответствующей британской записи. Северные острова требуют отдельной проверки.','https://press-files.anu.edu.au/downloads/press/p298111/html/ch06.xhtml?page=13&referer='],
 [1986,4,579,[2,3],'Aksumite domination in Yemen ended in the Persian interventions of the 570s; exclude the duplicated Arabian components after the latest proposed date of Sayf’s death in the source chronology. The surviving Himyarite record is not proof of independence from Persia.','Владычество Аксума в Йемене прекратилось после персидских интервенций 570-х годов; исключены дублирующие аравийские контуры после переходного периода. Сохранившаяся химьяритская запись не доказывает независимость от Персии.','https://www.iranicaonline.org/articles/abna-term/'],
 [7187,7,1454,[2,4],'Imbros and Thasos belonged to the Gattilusio lordships, not the Constantinopolitan empire after its fall in 1453. Subsequent changes of island administration and source gaps remain unverified.','Имброс и Тасос находились во владениях Гаттилузио, а не Константинопольской империи после её падения в 1453 году. Последующие переходы власти и пробелы источника остаются открытыми.','https://pandektis.ekt.gr/pandektis/handle/10442/163629'],
 [13241,16,1969,[8,9],'Equatorial Guinea became independent in 1968; exclude Río Muni and Bioko from the following full years.','Экваториальная Гвинея получила независимость в 1968 году; в последующие полные годы исключены Рио-Муни и Биоко.',SURINAME_SOURCE],
 [13241,16,1970,[10],'Spain transferred Ifni to Morocco in 1969.','Испания передала Ифни Марокко в 1969 году.','https://digitallibrary.un.org/record/843644/files/A_7753-EN.pdf'],
 [13262,44,1967,[21,23],'Guyana and Barbados became independent in 1966.','Гайана и Барбадос получили независимость в 1966 году.',SURINAME_SOURCE],
 [13232,13,1963,[7],'Tanganyika became independent in 1961; the Mafia Island component is present in the reconstructed same-year Tanganyika record from 1963.','Танганьика получила независимость в 1961 году; с 1963 года контур острова Мафия сохранён в записи Танганьики того же года.','https://www.un.org/en/about-us/member-states/tanzania'],
 [13232,13,1964,[8,9],'Zanzibar became independent in 1963; its union with Tanganyika formed Tanzania in 1964. Retain the equivalent island contours in the successor source record.','Занзибар получил независимость в 1963 году; в 1964 объединился с Танганьикой в Танзанию. Островные контуры сохранены у преемника.','https://www.un.org/en/about-us/member-states/tanzania'],
 [13232,13,1967,[0,3,4,5,6],'Lesotho, Malawi and The Gambia were independent by 1966; their separate island or territorial components are present in successor records.','К 1966 году Лесото, Малави и Гамбия получили независимость; отдельные контуры имеются в записях преемников.',SURINAME_SOURCE],
 [13209,3,1961,[2],'Syria left the United Arab Republic on 28 September 1961; the independent Syrian record is present from that year.','28 сентября 1961 года Сирия вышла из ОАР; отдельная сирийская запись присутствует с этого года.','https://history.state.gov/countries/syria'],
 [12920,2,1958,[0],'The Gold Coast became independent as Ghana in 1957. The second component is the Nigerian colony, not Ghana.','Золотой Берег получил независимость как Гана в 1957 году. Второй контур относится к колониальной Нигерии, а не к Гане.',SURINAME_SOURCE],
 [11752,7,1918,[6],'Iceland became a separate sovereign kingdom on 1 December 1918.','1 декабря 1918 года Исландия стала отдельным суверенным королевством.','https://www.government.is/library/01-Ministries/Ministry-for-Foreign-Affairs/PDF-skjol/Diplomatic-Handbook/Diplomatic%20Handbook%20WEB_09-2-22.pdf'],
 [11633,17,1865,[9,10,11,12,13],'The Ionian Islands were ceded to Greece by the 1864 treaty.','По договору 1864 года Ионические острова переданы Греции.','https://api.parliament.uk/historic-hansard/commons/1902/dec/11/british-cemeteries-in-the-ionian-states'],
 [10558,12,1803,[6],'British rule of Minorca ended in 1802.','Британское управление Меноркой завершилось в 1802 году.','https://www.push.gov.uk/wp-content/uploads/2018/05/Portsmouth-Harbour-Hinterland-project-2016.pdf'],
 [10007,15,1764,[7],'France ceded mainland North American possessions by the 1763 peace.','По миру 1763 года Франция уступила континентальные североамериканские владения.','https://history.state.gov/milestones/1750-1775/treaty-of-paris'],
 [10007,15,1769,[3,4,5,6],'France ceded Louisiana to Spain in the 1762–1763 settlements; Spanish administration was established by 1769.','Франция уступила Луизиану Испании по соглашениям 1762–1763 годов; к 1769 году установилось испанское управление.','https://www.loc.gov/collections/louisiana-european-explorations-and-the-louisiana-purchase/articles-and-essays/louisiana-as-a-spanish-colony/'],
 [10192,16,1780,[7],'The mainland North American source component is stale after the 1763 cessions.','Континентальный североамериканский контур устарел после уступок 1763 года.','https://history.state.gov/milestones/1750-1775/treaty-of-paris'],
 [10246,14,1783,[6],'The mainland North American source component is stale after the 1763 cessions.','Континентальный североамериканский контур устарел после уступок 1763 года.','https://history.state.gov/milestones/1750-1775/treaty-of-paris'],
 [10325,2,1791,[0],'The mainland North American source component is stale after the 1763 cessions. Saint-Pierre and Miquelon remains.','Континентальный североамериканский контур устарел после уступок 1763 года. Сохранён Сен-Пьер и Микелон.','https://history.state.gov/milestones/1750-1775/treaty-of-paris'],
 [7180,7,1451,[2],'Normandy was recovered by France in 1450.','Франция вернула Нормандию в 1450 году.','https://assets.cambridge.org/97805217/13894/frontmatter/9780521713894_frontmatter.pdf'],
 [7180,7,1452,[0],'Bayonne was recovered by France in 1451.','Франция вернула Байонну в 1451 году.','https://assets.cambridge.org/97805217/13894/frontmatter/9780521713894_frontmatter.pdf'],
 [7180,7,1454,[1],'The Hundred Years War ended in 1453 with the loss of Gascony; the Calais component remains.','Столетняя война закончилась в 1453 году потерей Гаскони; контур Кале сохранён.','https://www.english-heritage.org.uk/learn/story-of-england/medieval/war/'],
 [7268,14,1457,[1],'Gattilusio control of Lemnos ended in 1456; Venetian and Ottoman control alternated until 1479.','Власть Гаттилузио на Лемносе закончилась в 1456 году; до 1479 года остров переходил между венецианцами и османами.','https://www.myrina-castle.gr/en/historical-information/period-alternating-rule-1453-1479-gattilusi-venetians-ottomans'],
 [7187,7,1454,[1],'Lemnos was held by the Gattilusio from 1453, not the defunct Constantinopolitan empire.','С 1453 года Лемнос находился под властью Гаттилузио, а не прекратившей существование константинопольской империи.','https://www.myrina-castle.gr/en/historical-information/period-alternating-rule-1453-1479-gattilusi-venetians-ottomans'],
 [11215,8,1830,[0,7],'Crete was excluded from the Greek state under the 1832 settlement; the disconnected component near Heidelberg is also outside Greece.','Крит не вошёл в состав греческого государства по соглашению 1832 года; отдельный контур у Гейдельберга также не относится к Греции.','https://www.crete1821.gr/en/section/i-kriti-m%CE%B5ta-tin-%CE%B5panastasi'],
 [11275,8,1834,[7],'The disconnected component near Heidelberg is outside the Greek territory established in 1832.','Отдельный контур у Гейдельберга находится за пределами греческой территории, установленной в 1832 году.','https://200years.mfa.gr/international-treaties/'],
 [13161,18,1961,[13],'The Anglo-Kuwaiti protection agreement was terminated on 19 June 1961; Kuwait was no longer a British protectorate.','19 июня 1961 года прекращён договор о британском покровительстве Кувейту.','https://treaties.un.org/doc/publication/unts/volume%20399/v399.pdf'],
 [11140,43,1826,[1],'The Treaty of Tantauco of 19 January 1826 incorporated Chiloé into Chile.','По договору в Тантауко от 19 января 1826 года архипелаг Чилоэ вошёл в состав Чили.','https://www.archivonacional.gob.cl/noticias/archivos-para-comprender-el-bicentenario-de-chiloe-y-el-fin-del-dominio-espanol-en-chile'],
 [11140,43,1828,[2],'The Río de la Plata declared independence of Spain in 1816; the identical Río Negro coastal polygon is already present in contemporary Río de la Plata and Argentine Confederation records from 1828.','Независимость от Испании провозглашена в 1816 году; с 1828 года совпадающий прибрежный контур Рио-Негро уже присутствует в записях Рио-де-ла-Платы и Аргентинской конфедерации.','https://www.argentina.gob.ar/noticias/9-de-julio-de-1816-declaracion-de-la-independencia-de-la-argentina'],
 [11140,43,1826,[3],'Bolivia declared independence on 6 August 1825; the source component near La Paz is not Spanish territory in subsequent full years.','Боливия провозгласила независимость 6 августа 1825 года; контур в районе Ла-Паса не относится к Испании в последующие полные годы.','https://www.ine.gob.bo/index.php/bolivia/aspectos-historicos/'],
 [11074,3,1824,[2],'The 1824 separation of Johore and Riau-Lingga places the Natuna Islands in the latter sphere; the exact source component is retained in the Riau-Lingga record.','После разделения Джохора и Риау-Лингга в 1824 году острова Натуна относились к Риау-Лингга; совпадающий контур сохранён в записи последнего султаната.','https://www.durham.ac.uk/media/durham-university/research-/research-centres/ibru-centre-for-borders-research/maps-and-databases/publications-database/Maritime-Briefings-%28Vol.-1-no.-1%29.pdf'],
 [9578,7,1721,[0,1,2,6],'The 1720 Treaty of The Hague reversed the Spanish gains and transferred Sicily to Austria and Sardinia to Savoy.','Гаагский договор 1720 года отменил испанские завоевания: Сицилия перешла Австрии, Сардиния — Савойе.','https://art.torvergata.it/bitstream/2108/230502/448584/historical_hd78_2019.pdf'],
 [9047,2,1665,[0],'Cape Coast Castle passed to English control in 1664; the remaining Danish component near Accra is retained.','В 1664 году Кейп-Кост перешёл под английское управление; датский контур у Аккры сохранён.','https://snr.org.uk/maritime-art/cape-coast-castle-west-africa/'],
 [9089,11,1665,[0],'Cape Coast Castle passed to English control in 1664.','В 1664 году Кейп-Кост перешёл под английское управление.','https://snr.org.uk/maritime-art/cape-coast-castle-west-africa/'],
 [8238,6,1567,[0],'Ottoman conquest ended Genoese control of Chios in 1566.','Османское завоевание Хиоса в 1566 году положило конец генуэзскому управлению островом.','https://kampos.chios.gov.gr/history/'],
 [7268,14,1476,[9,10,11,12,13],'Ottoman conquest ended Genoese Black Sea colonial control in 1475; remove the Caffa, Cembalo, Kerch, Taman and Tana components.','Османское завоевание 1475 года положило конец генуэзским черноморским владениям; исключены контуры Каффы, Чембало, Керчи, Тамани и Таны.','https://whc.unesco.org/en/tentativelists/5575'],
 [7268,14,1463,[8],'Gattilusio rule of Lesbos ended with the Ottoman conquest in 1462.','Власть генуэзского рода Гаттилузио на Лесбосе завершилась османским завоеванием в 1462 году.','https://pandektis.ekt.gr/pandektis/handle/10442/163629'],
 [7187,7,1454,[6],'Constantinople fell to the Ottoman Empire on 29 May 1453.','Константинополь был завоёван Османской империей 29 мая 1453 года.','https://assets.cambridge.org/97811084/98180/excerpt/9781108498180_excerpt.pdf'],
 [7187,7,1461,[0],'The Ottoman conquest of the Byzantine Despotate of the Morea was completed in 1460.','Османское завоевание византийского Морейского деспотата завершилось в 1460 году.','https://student.cc.uoc.gr/uploadFiles/177-%CE%92%CE%A5%CE%96%CE%A1%CE%91%CE%A6%CE%97%CE%9A%CE%97%CE%9C%CE%95%CE%9B%CE%95%CE%A4%CE%97%CE%9C%CE%91%CE%A4%CE%91%20/Laiou._Political-historical_survey._pages_from_OHBS._ss._280-294.pdf'],
 [6377,4,1362,[1],'Valdemar IV of Denmark conquered Gotland in 1361.','В 1361 году датский король Вальдемар IV завоевал Готланд.','https://onlinelibrary.wiley.com/doi/abs/10.1002/9781444338232.wbeow241'],
 [6377,4,1344,[3],'The Norse settlements of Greenland belonged to the Norwegian crown since 1261, not to Sweden; a personal union does not make them Swedish possessions.','С 1261 года скандинавские поселения Гренландии принадлежали норвежской короне; личная уния не превращала их в шведские владения.','https://natmus.dk/organisation/forskning-og-kulturarv/nyere-tid-og-verdens-kulturer/etnografisk-samling/arktisk-forskning/prehistory-of-greenland/norse/'],
 [5267,10,1210,[0,1,2,3,4,5,6,7],'The Latin conquests following 1204 fragmented Byzantine rule; the eight identical Aegean and Ionian components are retained in the contemporary Archipelago, Venetian and Latin Empire records.','После завоеваний 1204 года византийская власть распалась; восемь совпадающих эгейских и ионических контуров сохранены в современных им записях Герцогства Архипелага, Венеции и Латинской империи.','https://assets.cambridge.org/97805218/71815/excerpt/9780521871815_excerpt.pdf'],
 [833,6,-188,[1,3,4],'The peace imposed on Philip V after Cynoscephalae required withdrawal from his Greek cities in Asia. From 188 BCE the three identical island components are mapped under Rhodes or Pergamon in the source; do not retain them under Macedonia as well.','Мир после Киноскефал обязывал Филиппа V вывести гарнизоны из греческих городов Азии. С 188 года до н. э. три совпадающих островных контура отнесены в исходнике к Родосу или Пергаму; исключено дублирование в Македонии.','https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Polybius/18%2A.html'],
 [9854,4,1769,[0],'Genoa ceded its rights to Corsica in 1768 and French forces conquered the island in 1769.','Генуя уступила права на Корсику в 1768 году; в 1769 остров заняла Франция.','https://www.napoleon.org/en/history-of-the-two-empires/biographies/paoli-pascal-philippe-antoine-also-known-as-pasquale-paoli/'],
 [9852,8,1762,[2,4,5,6],'Ferdinand inherited the Neapolitan throne in 1759 while his father Charles became king of Spain; the matching components are retained in the contemporary Naples record.','В 1759 году Фердинанд унаследовал неаполитанский престол, а его отец Карл стал королём Испании. Совпадающие компоненты остаются в записи Неаполя.','https://www.treccani.it/enciclopedia/ferdinando-i-di-borbone-re-delle-due-sicilie_%28Dizionario-Biografico%29/'],
 [11345,18,1840,[14],'The personal union with Hanover ended in 1837.','Личная уния с Ганновером завершилась в 1837 году.','https://researchbriefings.files.parliament.uk/documents/SN00683/SN00683.pdf'],
 [12589,74,1926,[40],'The treaty recognizing Cuban title to the Isle of Pines was ratified in 1925.','Договор о признании принадлежности острова Пинос Кубе ратифицирован в 1925 году.','https://history.state.gov/historicaldocuments/frus1925v02/d4'],
 [12589,74,1935,[37,38],'US forces withdrew from Haiti in 1934.','Американские войска покинули Гаити в 1934 году.','https://history.state.gov/countries/haiti'],
 [13036,61,1948,[42,43,44,45,46],'New Zealand adopted the Statute of Westminster in November 1947; this was no longer a British colony.','Новая Зеландия приняла Вестминстерский статут в ноябре 1947 года; это уже не британская колония.','https://nzhistory.govt.nz/statute-of-westminster-passed-confirming-nz-autonomy'],
 [13036,61,1948,[33,35,36],'Burma became independent on 4 January 1948.','Бирма получила независимость 4 января 1948 года.','https://history.state.gov/countries/burma'],
 [13036,61,1949,[20,41],'Newfoundland and Labrador joined Canada in March 1949.','Ньюфаундленд и Лабрадор вошли в состав Канады в марте 1949 года.','https://www.canada.ca/en/canadian-heritage/services/historical-boundaries-canada.html'],
 [13070,91,1949,[22,36],'Newfoundland and Labrador joined Canada in March 1949.','Ньюфаундленд и Лабрадор вошли в состав Канады в марте 1949 года.','https://www.canada.ca/en/canadian-heritage/services/historical-boundaries-canada.html'],
 [13161,18,1961,[14],'Cyprus became independent in 1960, except for the two sovereign base areas, which lack separate source geometry here.','Кипр стал независимым в 1960 году, кроме двух британских военных баз, отдельные контуры которых здесь отсутствуют.','https://www.gov.uk/government/publications/historical-background-information-on-nationality/historical-background-information-on-nationality-accessible'],
 [13161,18,1965,[15],'Malta became independent in September 1964.','Мальта получила независимость в сентябре 1964 года.','https://www.un.org/dppa/decolonization/en/history/former-trust-and-nsgts'],
 [13111,7,1951,[0,6],'Nationalist forces evacuated Hainan and the Chusan (Zhoushan) archipelago in 1950; this is a correction of effective control, not of competing sovereignty claims.','В 1950 году силы Китайской Республики эвакуировались с Хайнаня и архипелага Чжоушань. Уточнён фактический контроль, не юридические притязания.','https://history.state.gov/historicaldocuments/frus1950v06/d178'],
 [6167,5,1407,[0],'After alternating English and Scottish rule, the Isle of Man was granted by Henry IV to John Stanley in 1406.','После смены английской и шотландской власти Генрих IV передал остров Мэн Джону Стэнли в 1406 году.','https://manxnationalheritage.im/news/medieval-ring-declared-treasure/'],
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
const exclusionsFor=(index,year,derived=[])=>[...componentExclusions,...derived].filter(r=>r[0]===index&&year>=r[2]&&(r[7]===undefined||year<=r[7]));
// A historically reviewed transition may be resolved by exact source equality
// when part indices differ among source revisions. Geographic boxes only restrict
// eligible already-identical components; no geometry is synthesized or clipped.
const confirmedOverlapPolicies=[
 {index:10767,loser:/Dutch East Indies/i,winner:/British|Great Britain/i,from:1812,to:1815,boxes:[[105,-9.5,114.75,-5.4]],reason:'British occupation of Java began in 1811 and Dutch government returned in 1816; retain exact contemporary British components in the intervening full years.',ru:'Британская оккупация Явы началась в 1811 году, нидерландская власть восстановлена в 1816 году. Одинаковые компоненты сохранены в британской записи в промежуточные полные годы.',source:'https://digitalcollections.anu.edu.au/entities/publication/d32c0b05-0085-4f2f-9286-1c5df071eb6f/full'},
 {index:10767,loser:/Dutch East Indies/i,winner:/British|Great Britain/i,from:1811,to:1816,boxes:[[127.7,-4.05,128.6,-3.2],[127.2,0.6,127.55,0.98]],reason:'Ambon and Ternate were occupied by Britain from 1810 until the Dutch restoration in 1817; exclude only exact British duplicate components.',ru:'Амбон и Тернате находились под британским управлением с 1810 года до восстановления нидерландской власти в 1817 году; исключены только точные дубли британских компонентов.',source:'https://www.cambridge.org/core/journals/itinerario/article/revolution-and-resistance-an-exploration-of-the-looping-effect-in-the-moluccas-in-1817/4B19594F36FAB6EEBF4B854A417A3CBA'},
 {index:11781,loser:/Dutch East Indies/i,winner:/British|Great Britain/i,from:1870,to:1872,boxes:[[92.4,6.5,94.3,9.7]],reason:'Britain formally took possession of the Nicobar Islands in 1869. Identical Dutch and British source components are attributed to the latter in subsequent full years.',ru:'В 1869 году Великобритания формально вступила во владение Никобарскими островами. Совпадающие нидерландские и британские компоненты в последующие полные годы отнесены к британской записи.',source:'https://nicobars.andaman.nic.in/history/'},
 {index:12119,loser:/British|Great Britain/i,winner:/German Empire/i,winnerIndex:12069,from:1895,to:1898,boxes:[[156.25,-7.55,157.65,-6.35],[158,-8.8,159.95,-7.05],[155.3,-7.6,156.4,-6.6]],reason:'Choiseul, Isabel, Shortland and adjacent northern Solomon islands were German until the Anglo-German convention of November 1899. Preserve exact German rather than premature British components.',ru:'Шуазёль, Исабель, Шортленд и соседние северные острова Соломонова архипелага оставались германскими до англо-германской конвенции ноября 1899 года. Сохранены германские, а не преждевременные британские дубли.',source:'https://gazette.slv.vic.gov.au/images/1900/V/general/110.pdf'},
];
const rawParts=f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
// The reviewed register is pinned to the exact source release. A component
// is never removed on the strength of an index alone: check both geometries,
// their dates, and the reviewed hash. The reconstruction queue remains open.
export const territorialBatch=JSON.parse(fs.readFileSync(new URL('../docs/historical-atlas-batch-989.json',import.meta.url),'utf8'));
// Use the same source-size gate for normalization and annual-pack generation.
// Small test fixtures deliberately omit the source-indexed editorial reviews.
const REVIEWED_SOURCE_MIN_FEATURES=Math.max(...territorialBatch.rows.map(r=>Math.max(r.source,r.other)));
export const territorialResolutions=JSON.parse(fs.readFileSync(new URL('../docs/historical-atlas-batch-989-resolutions.json',import.meta.url),'utf8'));
export const independentIslands=JSON.parse(fs.readFileSync(new URL('../docs/historical-atlas-independent-islands.json',import.meta.url),'utf8'));
export const independentIslandGeometry=JSON.parse(fs.readFileSync(new URL('../docs/historical-atlas-independent-islands-geometry.json',import.meta.url),'utf8'));
independentIslandGeometry.push(...JSON.parse(fs.readFileSync(new URL('../docs/historical-atlas-microstate-geometry.json',import.meta.url),'utf8')));
independentIslands.states.push(
 {iso:'LIE',wikidata:'Q347',from:1990,name:'Liechtenstein',nameRu:'Лихтенштейн',neighbors:[13108,13662,13045,13499,13699],reasonRu:'Княжество существовало до вступления в ООН в 1990 году; его границы устойчивы на протяжении столетий.',sources:['https://www.liechtensteinusa.org/history','https://www.llv.li/en/national-administration/civil-engineering-and-geoinformation-office/national-survey/sovereign-borders']},
 {iso:'SMR',wikidata:'Q238',from:1992,name:'San Marino',nameRu:'Сан-Марино',neighbors:[13384,13794],reasonRu:'Республика существовала до вступления в ООН в 1992 году; последнее территориальное расширение состоялось в 1463 году.',sources:['https://www.elezioni.sm/on-line/home/elezioni-giunte/cenni-storici-e-curiosita.html']}
);
export const independenceTransitions=JSON.parse(fs.readFileSync(new URL('../docs/historical-atlas-independence-transitions.json',import.meta.url),'utf8'));
export function deriveTerritorialBatch(features,batch=territorialBatch){
 const exclusions=[],pending=[],resolved=[],restorations=[],relabels=new Map(),attributions=[],extensions=[],seen=new Set(),transfers=[],subtractions=[],pendingExtensions=[];
 const transfer=territorialResolutions.transfer,ceylon=territorialResolutions.ceylonTransfer,mindanao=territorialResolutions.mindanaoReview;
 assert.equal(batch.sourceSha256,PINNED_SOURCE_SHA256);
 for(const row of batch.rows){
  const {source,part,other,otherParts,hash,from,to,status,group,evidence}=row;
  const f=features[source],counterpart=features[other];
  assert.ok(f&&counterpart,`Missing reviewed source pair ${source}:${other}`);
  assert.ok(f.properties.Type==='POLITY'&&counterpart.properties.Type==='POLITY');
  assert.ok(from<=to&&f.properties.FromYear<=from&&f.properties.ToYear>=to&&counterpart.properties.FromYear<=from&&counterpart.properties.ToYear>=to,`Reviewed interval changed ${source}:${part}`);
  const parts=rawParts(f),otherGeometry=rawParts(counterpart);
  assert.equal(componentHash(parts[part]),hash,`Reviewed geometry changed ${source}:${part}`);
  assert.ok(otherParts.length&&otherParts.every(p=>componentHash(otherGeometry[p])===hash),`Counterpart geometry changed ${other}`);
  assert.ok(status==='ready'||status==='reconstruct');
  const reason=group===mindanao.group?mindanao.reasonRu:batch.descriptions[group];assert.ok(reason&&evidence.startsWith('https://github.com/Vue-Jay/interactive-board-next/pull/364#issuecomment-'));
  for(let year=from;year<=to;year++){if(year===0)continue;const key=`${source}:${hash}:${year}`;assert.ok(!seen.has(key),`Duplicate reviewed component-year ${key}`);seen.add(key);}
  const component=territorialResolutions.componentRestorations[hash];
  const retained=territorialResolutions.retained[group],restored=territorialResolutions.restored[group]??(component?.group===group?component:undefined),relabel=territorialResolutions.relabel[group],moved=group===transfer.group?transfer:group===ceylon.group?ceylon:undefined;
  const decision=status==='reconstruct'?(retained??restored??relabel??moved):undefined;
  const pendingReview=group===mindanao.group?mindanao:territorialResolutions.pendingIslandReviews[group];
  const rule=[source,parts.length,from,[part],status==='ready'?'Historically reviewed exact duplicate: '+group+'.':decision?decision.reason:pendingReview?.reason??'Incorrect or conflated political attribution; territorial reconstruction is still pending: '+group+'.',decision?.reasonRu??(status==='reconstruct'?pendingReview?.reasonRu:undefined)??reason,decision?.sources[0]??(status==='reconstruct'?pendingReview?.sources[0]:undefined)??evidence,to];
  // Unresolved original contours must not be presented as established filled
  // political boundaries. Preserve their source parts as explicit open issues.
  // Relabel a wholly misidentified island rather than deleting its geography.
  if(!relabel?.indices.includes(source))exclusions.push(rule);
  if(status==='reconstruct'&&decision){
   assert.ok(decision.sources.length&&decision.sources.every(s=>s.startsWith('https://')));
   resolved.push({...row,mode:retained?'retained':restored?'restored':moved?'transfer':'relabel',target:retained?other:restored?restored.anchor:moved?undefined:relabel.indices.find(i=>features[i].properties.FromYear<=from&&features[i].properties.ToYear>=to)});
   if(retained)attributions.push({source:other,part:otherParts[0],hash,group,from,to,reason:retained.reasonRu,sources:retained.sources});
   if(restored&&source===restored.anchor){
    const transition=restored.transition?.year;
    const ranges=transition>from&&transition<=to?[[from,transition-1],[transition,to]]:[[from,to]];
    for(const [start,end] of ranges)restorations.push({...row,from:start,to:end,decision,geometry:{type:'MultiPolygon',coordinates:[parts[part]]}});
   }
   if(restored?.excludeCounterpart)exclusions.push([other,otherGeometry.length,from,otherParts,decision.reason,decision.reasonRu,decision.sources[0],to]);
  }else if(status==='reconstruct')pending.push({...row,reason:pendingReview?.reasonRu??reason,geometry:{type:'Polygon',coordinates:parts[part]},counterpartName:counterpart.properties.Name,...(pendingReview?{sources:pendingReview.sources}:{})});
 }
 for(const [group,decision] of Object.entries(territorialResolutions.relabel))for(const index of decision.indices){
  const f=features[index];assert.equal(f.properties.Name,'Saint Kitts');assert.equal(rawParts(f).length,1);assert.equal(componentHash(rawParts(f)[0]),decision.hash);
  relabels.set(index,{...decision,group});
 }
 // Extend exact, historically justified island corrections to adjacent years
 // that were not duplicates in the original 989-case registry.
 const extensionKeys=new Set();
 // The exact same entire-island geometry continued outside the duplicate
 // interval. Do not turn cessation of the duplicate into evidence of control.
 for(const [group,routes,review] of [[mindanao.group,mindanao.pendingRoutes,mindanao],['Малакка',territorialResolutions.malaccaPendingRoutes,territorialResolutions.pendingIslandReviews['Малакка']]])for(const [source,part,from,to,other] of routes){
  const f=features[source],parts=rawParts(f);
  const original=batch.rows.find(r=>r.group===group&&((r.source===source&&r.other===other)||(r.source===other&&r.other===source)));
  assert.ok(original);const hash=original.hash;
  assert.equal(componentHash(parts[part]),hash);assert.ok(f.properties.FromYear<=from&&f.properties.ToYear>=to);
  assert.ok(rawParts(features[other]).some(p=>componentHash(p)===hash));
  for(let year=from;year<=to;year++){const key=`${source}:${hash}:${year}`;assert.ok(!seen.has(key)&&!extensionKeys.has(key));extensionKeys.add(key);}
  const issue={source,part,from,to,other,hash,group,status:'reconstruct',reason:review.reasonRu,evidence:original.evidence,sources:review.sources,geometry:{type:'Polygon',coordinates:parts[part]},counterpartName:group===mindanao.group?'Местные политические образования (границы не установлены)':'Нидерландская Малакка и соседние владения (границы не установлены)'};
  pending.push(issue);pendingExtensions.push(issue);exclusions.push([source,parts.length,from,[part],review.reason,review.reasonRu,review.sources[0],to]);
 }
 for(const ext of territorialResolutions.extensions){
  const {source,part,from,to,group,other,otherPart}=ext,f=features[source],parts=rawParts(f),hash=batch.rows.find(r=>r.group===group).hash;
  assert.ok(f.properties.Type==='POLITY'&&f.properties.FromYear<=from&&f.properties.ToYear>=to&&from<=to);assert.equal(componentHash(parts[part]),hash);
  for(let y=from;y<=to;y++){const key=`${source}:${hash}:${y}`;assert.ok(!seen.has(key)&&!extensionKeys.has(key),`Extension overlaps reviewed registry ${source}/${y}`);extensionKeys.add(key);}
  let decision=territorialResolutions.restored[group];
  if(group==='Сент-Круа')decision={...territorialResolutions.relabel[group],entity:'saint-croix',reason:'Saint Croix was transferred to the United States on 31 March 1917; restore the exact island separately from the British colonial aggregate.',reasonRu:'Сент-Круа передан США 31 марта 1917 года. В переходном 1917 году показана новая принадлежность; исходный контур острова отделён от британского колониального объединения.'};
  if(other!==undefined){
   const target=features[other];assert.ok(target.properties.FromYear<=from&&target.properties.ToYear>=to);assert.equal(componentHash(rawParts(target)[otherPart]),hash);
   decision={...decision,reason:from<1816?'Bangka was ceded to the British in 1812; preserve its matching British source component in 1813.':'Following the 1816 handover, retain the matching Dutch component, not Palembang.',reasonRu:from<1816?'Банка перешла к британцам в 1812 году; в 1813 году сохранён совпадающий британский контур.':'После передачи в 1816 году сохранён нидерландский контур Банки, а не принадлежность Палембангу.'};
   attributions.push({source:other,part:otherPart,hash,group,from,to,reason:decision.reasonRu,sources:decision.sources});
  }else{
   if(group==='Исландия')decision={...decision,reason:decision.reason.replace('under the 1941 defence agreement','during British and US military presence, with sovereignty expressly recognized in the 1941 defence agreement'),reasonRu:decision.reasonRu.replace('по соглашению об обороне 1941 года','во время британского и американского военного присутствия; суверенитет прямо признан соглашением об обороне 1941 года')};
   if(group==='Мафия')decision={...decision,reason:'The island was German following the 1890 agreement; British military capture occurred only in 1915.',reasonRu:'После соглашения 1890 года Мафия входила в Германскую Восточную Африку; британское завоевание острова произошло только в 1915 году.'};
   restorations.push({...ext,hash,decision,geometry:{type:'MultiPolygon',coordinates:[parts[part]]}});
  }
  extensions.push({...ext,hash});exclusions.push([source,parts.length,from,[part],decision.reason,decision.reasonRu,decision.sources[0],to]);
 }
 // Transfer the same independently identified cell into the contemporaneous
 // Savoy outline. Preserve the original component hash and both source dates.
 for(const [source,part,from,to] of transfer.routes){
  const f=features[source],parts=rawParts(f);assert.equal(componentHash(parts[part]),transfer.hash);
  assert.ok(f.properties.FromYear<=from&&f.properties.ToYear>=to);
  for(let year=from;year<=to;year++){
   const targets=transfer.targets.filter(i=>features[i].properties.FromYear<=year&&features[i].properties.ToYear>=year);
   assert.equal(targets.length,1,`Missing unique Savoy target ${year}`);const target=targets[0];assert.ok(['County of Savoy','House of Savoy'].includes(features[target].properties.Name));
   const last=transfers.at(-1);if(last&&last.target===target&&last.source===source&&last.part===part&&last.to+1===year)last.to=year;
   else transfers.push({source,part,target,from:year,to:year,decision:transfer});
   const key=`${source}:${transfer.hash}:${year}`;
   if(!seen.has(key)){
    assert.ok(!extensionKeys.has(key));extensionKeys.add(key);
    extensions.push({source,part,from:year,to:year,group:transfer.group,hash:transfer.hash,mode:'transfer',target});
    exclusions.push([source,parts.length,year,[part],transfer.reason,transfer.reasonRu,transfer.sources[0],year]);
   }
  }
 }
 // Restore the two eastern Ceylon cells only once, excluding their competing
 // colonial copies; the source revisions and exact component hashes are pinned.
 for(const [source,part,from,to] of ceylon.routes){
  const f=features[source],parts=rawParts(f),hash=componentHash(parts[part]);
  assert.ok(batch.rows.some(r=>r.group===ceylon.group&&r.hash===hash));
  assert.ok(f.properties.FromYear<=from&&f.properties.ToYear>=to&&features[ceylon.target].properties.FromYear<=from&&features[ceylon.target].properties.ToYear>=to);
  if(source!==9054)transfers.push({source,part,target:ceylon.target,from,to,decision:ceylon,hash});
  for(let year=from;year<=to;year++){
   const key=`${source}:${hash}:${year}`;if(seen.has(key))continue;
   assert.ok(!extensionKeys.has(key));extensionKeys.add(key);
   extensions.push({source,part,from:year,to:year,group:ceylon.group,hash,mode:'transfer',target:ceylon.target});
   exclusions.push([source,parts.length,year,[part],ceylon.reason,ceylon.reasonRu,ceylon.sources[0],year]);
  }
 }
 // Elba is a physically separate, exact island component. Tuscany's
 // mainland is available as a dated target only through 1847. Preserve the
 // island as a distinct documented restoration thereafter; do not guess
 // the missing mainland boundaries from the Austrian aggregate.
 const elba=territorialResolutions.elbaTransfer;
 const registerIslandCorrection=(source,part,from,to,decision,target,mergeRestoration=false)=>{
  const f=features[source],parts=rawParts(f),hash=componentHash(parts[part]);
  assert.equal(hash,decision.hash);assert.ok(f.properties.Type==='POLITY'&&f.properties.FromYear<=from&&f.properties.ToYear>=to);
  if(target!==undefined){
   const t=features[target];assert.ok(t.properties.FromYear<=from&&t.properties.ToYear>=to);
   transfers.push({source,part,target,from,to,decision});
  }else if(mergeRestoration){
   const r=restorations.find(r=>r.source===source&&r.from===from&&r.to===to&&r.hash===elba.hash);
   assert.ok(r&&r.geometry.coordinates.length===1);
   assert.equal(polygonClipping.intersection(r.geometry.coordinates,parts[part]).length,0);
   r.parts=[r.part,part];r.geometry.coordinates.push(parts[part]);r.decision={...decision,identitySource:elba.target};
  }else restorations.push({source,part,from,to,hash,group:decision.group,decision,geometry:{type:'MultiPolygon',coordinates:[parts[part]]}});
  for(let year=from;year<=to;year++){
   const key=`${source}:${hash}:${year}`;assert.ok(!seen.has(key)&&!extensionKeys.has(key));extensionKeys.add(key);
   extensions.push({source,part,from:year,to:year,group:decision.group,hash,...(target===undefined?{}:{mode:'transfer',target})});
  }
  if(!decision.alreadyExcluded)exclusions.push([source,parts.length,from,[part],decision.reason,decision.reasonRu,decision.sources[0],to]);
 };
 assert.equal(features[elba.target].properties.Name,'Grand Duchy of Tuscany');
 for(const [source,part,from,to] of elba.routes){
  assert.equal(features[source].properties.Name,'Austrian Empire');
  registerIslandCorrection(source,part,from,to,elba,to<=1847?elba.target:undefined);
 }
 const tuscany=territorialResolutions.tuscanyMainland;
 for(const [source,part,from,to] of tuscany.routes){
  const early=to<=1847,decision={...tuscany,hash:early?tuscany.earlyHash:tuscany.lateHash};
  assert.equal(features[source].properties.Name,'Austrian Empire');
  assert.ok(capitalInsideCountry([11.2558,43.7696],{type:'Polygon',coordinates:rawParts(features[source])[part]}));
  registerIslandCorrection(source,part,from,to,decision,early?elba.target:undefined,!early);
 }
 const provisional={...elba,...elba.provisional};
 assert.equal(features[provisional.source].properties.Name,'Kingdom of Sardinia');
 registerIslandCorrection(provisional.source,provisional.part,provisional.from,provisional.to,provisional);
 const angloCorsican=territorialResolutions.angloCorsicanRestoration;
 assert.equal(features[angloCorsican.source].properties.Name,'Kingdom of Great Britain');
 registerIslandCorrection(angloCorsican.source,angloCorsican.part,angloCorsican.from,angloCorsican.to,angloCorsican);
 const corsica1796=territorialResolutions.corsica1796;
 assert.equal(features[corsica1796.source].properties.Name,'Kingdom of Great Britain');
 assert.equal(features[corsica1796.target].properties.Name,'French Directory');
 registerIslandCorrection(corsica1796.source,corsica1796.part,corsica1796.from,corsica1796.to,corsica1796,corsica1796.target);
 for(const d of territorialResolutions.datedIslandCorrections)registerIslandCorrection(d.source,d.part,d.from,d.to,d,d.target);
 for(const d of territorialResolutions.bracketedIslandRestorations){
  const before=features[d.before.index],after=features[d.after.index],target=features[d.target];
  assert.equal(before.properties.ToYear,d.year-1);assert.equal(after.properties.FromYear,d.year+1);
  assert.equal(target.properties.Name,'Free French');assert.ok(target.properties.FromYear<=d.year&&target.properties.ToYear>=d.year);
  assert.equal(componentHash(rawParts(before)[d.before.part]),d.hash);assert.equal(componentHash(rawParts(after)[d.after.part]),d.hash);
  assert.ok(!features.some(f=>f.properties.FromYear<=d.year&&f.properties.ToYear>=d.year&&rawParts(f).some(p=>componentHash(p)===d.hash)),`Existing island ${d.group}/${d.year}`);
  transfers.push({source:d.before.index,part:d.before.part,target:d.target,from:d.year,to:d.year,decision:d,temporalWitness:{before:d.before,after:d.after,year:d.year,hash:d.hash}});
 }
 // Reassemble the missing independent state from its three exact island
 // cells. The Cabo Verde exclusions alone had left it entirely absent.
 const comoros=territorialResolutions.independentComoros;
 for(const [source,from,to,parts] of comoros.routes){
  const raw=rawParts(features[source]);
  assert.deepEqual(parts.map(p=>componentHash(raw[p])),comoros.hashes);
  for(const [i,part] of parts.entries()){
   registerIslandCorrection(source,part,from,to,{...comoros,hash:comoros.hashes[i]});
  }
  const individual=restorations.splice(-parts.length,parts.length);
  assert.ok(individual.every(r=>r.source===source&&r.from===from&&r.to===to&&r.decision.entity===comoros.entity));
  restorations.push({...individual[0],parts,geometry:{type:'MultiPolygon',coordinates:parts.map(p=>raw[p])}});
 }
 const mayotte=territorialResolutions.mayotte2024;
 registerIslandCorrection(mayotte.source,mayotte.part,mayotte.from,mayotte.to,mayotte,mayotte.target);
 assert.equal(componentHash(rawParts(features[13247])[15]),mayotte.hash);
 attributions.push({source:13247,part:15,hash:mayotte.hash,group:mayotte.group,from:1975,to:2023,reason:mayotte.reasonRu,sources:mayotte.sources});
 // Restore gaps at independence using cells that actually exist in the
 // same year. A separately dated successor is an exact geometric witness,
 // not a substitute geometry or a guess at a missing frontier.
 for(const d of territorialResolutions.independenceGapRestorations){
  const raw=rawParts(features[d.source]),reference=features[d.geometryReference??d.identitySource];
  assert.ok(reference.properties.FromYear===d.to+1&&reference.properties.Type==='POLITY');
  const hashes=d.parts.map(p=>componentHash(raw[p]));
  assert.deepEqual([...hashes].sort(),rawParts(reference).map(componentHash).sort());
  const decision={...d,reason:d.reason??`Independence in ${d.year}; the exact same-year components match the subsequent independent state, whose candidate geometry is preserved.`,reasonRu:d.reasonRu??`Независимость с ${d.year} года. Датированные исходные компоненты полностью совпадают с последующей записью независимого государства; сохранён предварительный контур источника.`,sources:d.sources??['https://www.un.org/dppa/decolonization/en/history/former-trust-and-nsgts']};
  for(const [i,part] of d.parts.entries())registerIslandCorrection(d.source,part,d.from,d.to,{...decision,hash:hashes[i]});
  const individual=restorations.splice(-d.parts.length,d.parts.length);
  assert.ok(individual.every(r=>r.source===d.source&&r.from===d.from&&r.to===d.to&&r.decision.entity===d.entity));
  restorations.push({...individual[0],parts:d.parts,geometry:{type:'MultiPolygon',coordinates:d.parts.map(p=>raw[p])}});
 }
 const davao=territorialResolutions.davaoTransfer;
 assert.equal(features[davao.target].properties.Name,'Spanish Empire');
 for(const [source,part,from,to] of davao.routes){
  assert.equal(features[source].properties.Name,'Sultanate of Maguindanao');
  assert.ok(capitalInsideCountry([125.612,7.075],{type:'Polygon',coordinates:rawParts(features[source])[part]}));
  registerIslandCorrection(source,part,from,to,davao,davao.target);
 }
 // Legal sovereignty, not transient military control: preserve the exact
 // source cell east of the Var and remove only its overlap with France.
 const nice={...territorialResolutions.niceLegalRestoration,hash:transfer.hash};
 for(const [source,part,from,to] of nice.routes){
  const f=features[source],parts=rawParts(f);assert.equal(componentHash(parts[part]),transfer.hash);
  assert.ok(f.properties.FromYear<=from&&f.properties.ToYear>=to&&f.properties.Name==='Republic of Genoa');
  registerIslandCorrection(source,part,from,to,nice);
  for(const target of nice.frenchTargets){
   const french=features[target];assert.equal(french.properties.Name,'Kingdom of France');
   const start=Math.max(from,french.properties.FromYear),end=Math.min(to,french.properties.ToYear);
   if(start>end)continue;
   assert.ok(polygonClipping.intersection(french.geometry.coordinates,parts[part]).length);
   subtractions.push({target,source,part,from:start,to:end,decision:nice});
  }
  for(let year=from;year<=to;year++)assert.equal(subtractions.filter(s=>s.source===source&&s.from<=year&&s.to>=year).length,1);
 }
 // The exact Great and Little Nicobar source polygons were systematically
 // misassigned in later source revisions, even when no duplicate was present.
 const islandHashes=['great-nicobar','little-nicobar'].map(entity=>Object.keys(territorialResolutions.componentRestorations).find(h=>territorialResolutions.componentRestorations[h].entity===entity));
 assert.ok(islandHashes.every(Boolean));
 for(const [kind,routes] of Object.entries(territorialResolutions.nicobarExtensions))for(const [source,great,little,from,to] of routes){
  const f=features[source],parts=rawParts(f);
  assert.ok(f.properties.FromYear<=from&&f.properties.ToYear>=to);
  for(const [part,k] of [[great,0],[little,1]]){
   const hash=islandHashes[k],d=territorialResolutions.componentRestorations[hash];assert.equal(componentHash(parts[part]),hash);
   for(let year=from;year<=to;year++){
    const key=`${source}:${hash}:${year}`;if(seen.has(key))continue;assert.ok(!extensionKeys.has(key));extensionKeys.add(key);
    const ext={source,part,from:year,to:year,hash,group:kind==='austrian'?'Nicobar':'Никобары'};
    let decision;
    if(kind==='austrian'||kind==='british'){
     const other=kind==='austrian'?9940:11836,otherPart=kind==='austrian'?k:k===0?1:3;
     assert.equal(componentHash(rawParts(features[other])[otherPart]),hash);assert.ok(features[other].properties.FromYear<=year&&features[other].properties.ToYear>=year);
     decision=kind==='austrian'?territorialResolutions.retained.Nicobar:d;
     attributions.push({source:other,part:otherPart,hash,group:ext.group,from:year,to:year,reason:decision.reasonRu,sources:decision.sources});
     extensions.push({...ext,other,otherPart});
    }else{
     assert.equal(kind,'dutch');const island=k===0?'Great Nicobar':'Little Nicobar',ru=k===0?'Большой Никобар':'Малый Никобар';
     decision={...d,transition:undefined,name:`${island} (Danish claim; local communities)`,nameRu:`${ru} (датская претензия; местные общины)`,reason:'Denmark maintained a nominal claim until 1868, despite withdrawal of its establishment in 1848; no Dutch sovereignty. Preserve the local island geography without claiming effective island-wide control.',reasonRu:'Дания сохраняла номинальные притязания до 1868 года, несмотря на уход администрации в 1848 году. Нидерландского суверенитета не было. Контур острова не означает единой эффективной колониальной власти.'};
     restorations.push({...ext,decision,geometry:{type:'MultiPolygon',coordinates:[parts[part]]}});extensions.push(ext);
    }
    exclusions.push([source,parts.length,year,[part],decision.reason,decision.reasonRu,decision.sources[0],year]);
   }
  }
 }
 for(const row of resolved.filter(r=>r.mode==='transfer'))for(let y=row.from;y<=row.to;y++)assert.ok(transfers.some(t=>t.from<=y&&t.to>=y&&(t.hash??t.decision.hash)===row.hash),`Missing transfer ${y}`);
 for(const row of resolved.filter(r=>r.mode==='restored'))for(let y=row.from;y<=row.to;y++)assert.ok(restorations.some(r=>r.source===row.target&&r.hash===row.hash&&r.from<=y&&r.to>=y),`Missing restored component ${row.group}/${y}`);
 return {exclusions,pending,resolved,restorations,relabels,attributions,extensions,transfers,subtractions,pendingExtensions,count:seen.size};
}
const withinBox=(polygon,box)=>polygon.every(ring=>ring.every(([x,y])=>x>=box[0]&&x<=box[2]&&y>=box[1]&&y<=box[3]));
export function deriveConfirmedOverlapExclusions(features,policies=confirmedOverlapPolicies){
 const all=[];
 const partsCache=new Map();
 const partHashes=index=>{
  if(!partsCache.has(index))partsCache.set(index,rawParts(features[index]).map(componentHash));
  return partsCache.get(index);
 };
 for(const policy of policies){
  const f=features[policy.index];
  if(!f||f.properties.Type!=='POLITY'||!policy.loser.test(f.properties.Name))continue;
  const lo=Math.max(f.properties.FromYear,policy.from),hi=Math.min(f.properties.ToYear,policy.to);
  if(lo>hi)continue;
  const parts=rawParts(f),eligible=parts.flatMap((polygon,part)=>policy.boxes.some(box=>withinBox(polygon,box))?[part]:[]);
  if(!eligible.length)continue;
  const counterparts=features.flatMap((other,index)=>index!==policy.index&&(policy.winnerIndex===undefined||index===policy.winnerIndex)&&other.properties.Type==='POLITY'&&!other.properties.Name.startsWith('(')&&policy.winner.test(other.properties.Name)&&other.properties.FromYear<=hi&&other.properties.ToYear>=lo?[index]:[]);
  const hash=partHashes(policy.index);
  const intervals=[];
  for(let year=lo;year<=hi;year++){
   const active=counterparts.filter(index=>features[index].properties.FromYear<=year&&features[index].properties.ToYear>=year);
   const matches=eligible.filter(part=>active.some(index=>{
    const excluded=new Set(exclusionsFor(index,year).flatMap(r=>r[3]));
    return partHashes(index).some((h,i)=>h===hash[part]&&!excluded.has(i));
   }));
   if(!matches.length)continue;
   const last=intervals.at(-1);if(last&&last.to+1===year&&JSON.stringify(last.parts)===JSON.stringify(matches))last.to=year;
   else intervals.push({from:year,to:year,parts:matches});
  }
  for(const span of intervals)all.push([policy.index,parts.length,span.from,span.parts,policy.reason,policy.ru,policy.source,span.to]);
 }
 return all;
}

const reviewedNames=[
 ['County of Savoy','Q1232887',1416,'Duchy of Savoy','Савойское герцогство','https://ladpe.fr/archives-turin-eng/'],
 ['Former Yugoslav Republic of Macedonia','Q221',2019,'Republic of North Macedonia','Республика Северная Македония','https://www.un.org/en/node/123222'],
 ["People's Republic of Angola",'Q916',1992,'Republic of Angola','Республика Ангола','https://ciam.gov.ao/ao/angola/constituicao'],
 ['Union of Myanmar','Q836',2011,'Republic of the Union of Myanmar','Республика Союз Мьянма',"https://www.un.org/en/about-us/member-states/myanmar"],
 ['Saint Kitts','Q204989',1983,'Saint Kitts and Nevis','Сент-Китс и Невис',COUNTRY_NAMES],
 ['Saint Vincent','Q757',1979,'Saint Vincent and the Grenadines','Сент-Винсент и Гренадины',COUNTRY_NAMES],
 ['Federated Republic of Germany','Q183',1991,'Federal Republic of Germany','Федеративная Республика Германия','https://www.bundestag.de/en/parliament/history/parliamentarism/frg_parliamentarism/frg_parliamentarism-200324'],
];
const ukName=year=>year<1927?'United Kingdom of Great Britain and Ireland':'United Kingdom of Great Britain and Northern Ireland';
const GREEK_REGIMES='https://www.presidency.gr/en/mansion/history/';
const DENMARK_SEPARATION='https://www.kongehuset.dk/nyheder/1814-spillet-om-danmark-og-norge';
const EGYPT_UAR='https://history.state.gov/countries/egypt';
const FRENCH_CESSIONS='https://history.state.gov/milestones/1750-1775/treaty-of-paris';
const TANZANIA_UN='https://www.un.org/en/about-us/member-states/tanzania';
// Dated names for unchanged source identities; rules are restricted to the
// affected source name and Wikidata ID, not the modern spellings of neighbors.
// Source-row names are NOT the historical authority: this maps the background
// geometry for Tianjin, after the source's false KMT / Hongxian-year labels
// receive explicit corrections in historicalTitleCorrections.
export function tianjinReviewedSourceOwner(year){
 if(year<=1911)return 'Qing Dynasty'; // 1900–02: Qing sovereign background under international provisional city administration
 if(year>=1912&&year<=1915||year>=1930&&year<=1936||year===1946)return 'Republic of China';
 if(year===1916)return 'Empire of China'; // ROC restored March 22
 if(year>=1917&&year<=1929)return 'Kuomintang'; // 1917–27 is Beiyang-era ROC, NOT KMT rule of Tianjin
 if(year>=1938&&year<=1944)return 'Empire of Japan';
 return null; // 1937 and 1945 are year-level transitions; 1900–02 retain only competing cell uncertainties
}

export const historicalTitleCorrections=[
 ["Kuomintang","Q31113",1928,1929,"Republic of China (Nationalist government; source aggregate)","Китайская Республика (Националистическое правительство; исходный агрегат)","https://www.tandfonline.com/doi/abs/10.1080/02665433.2017.1408487","After the 1928 Northern Expedition the Nanjing Nationalist Government governed Tianjin, but the party itself was not a separate sovereign country. Exact frontlines of Chinese rival administrations are not established by the imported polygon.","После Северного похода 1928 года Тяньцзинь перешёл под Националистическое правительство Китайской Республики. Гоминьдан не был отдельной суверенной страной, а исходный контур не является картой фронтов."],
 ["Empire of China","Q175379",1916,1916,"Republic of China (Hongxian monarchy until 22 March)","Китайская Республика (монархия Хунсянь до 22 марта)","https://mainuat.chiculture.org.hk/en/photo-story/2348","The Hongxian monarchy was abolished on 22 March 1916. The source outlines cannot present the imperial regime as government of China for all of 1916.","Монархию Юань Шикая упразднили 22 марта 1916 года. Годовая карта обозначает переход власти, не правление императора весь год."],
 ["Kuomintang","Q31113",1917,1927,"Republic of China (Beiyang era; disputed source aggregate)","Китайская Республика (период Бэйян; спорный исходный агрегат)","https://pure.tudelft.nl/ws/files/142459867/9789463666503_WEB.pdf","The Kuomintang was a party and rival southern government, not the administration of Tianjin in 1917–1927. This broad source geometry is not a dated map of authority exercised by the Beiyang government throughout all of China.","Гоминьдан был партией и конкурентом Бэйянского правительства, но не городскими властями Тяньцзиня в 1917–1927 годах. Общий контур источника не доказывает единого контроля Бэйян над всей территорией Китая."],
 ["Samoa","Q683",1962,1996,"Western Samoa","Западное Самоа","https://history.state.gov/countries/samoa","The name Western Samoa remained until the act of July 1997.","До принятия закона в июле 1997 года независимое государство называлось Западное Самоа."],
 ["Independent State of Samoa","Q683",1962,1996,"Independent State of Western Samoa","Независимое Государство Западное Самоа","https://www.legislation.govt.nz/act/public/1961/0068/latest/whole.html","The independent state's constitutional name included Western Samoa until July 1997.","При независимости в 1962 году официальное название включало Западное Самоа."],
 ["Western Samoa","Q683",1997,2024,"Samoa","Самоа","https://history.state.gov/countries/samoa","The name changed from Western Samoa to Samoa in 1997.","Название Западное Самоа изменено на Самоа в июле 1997 года."],
 ["Republic of Cameroon","Q1009",1962,1971,"Federal Republic of Cameroon","Федеративная Республика Камерун","https://www.archontology.org/nations/cameroon/01_polity.php","Cameroon was a federation from 1 October 1961 until June 1972.","Камерун был федерацией с октября 1961 до июня 1972 года."],
 ["Republic of Cameroon","Q1009",1972,1983,"United Republic of Cameroon","Объединённая Республика Камерун","https://treaties.un.org/pages/HistoricalInfo.aspx","The 1972 unitary constitution led to the United Republic title until 1984.","Название Объединённая Республика Камерун действовало с 1972 по февраль 1984 года."],
 ["Federal Republic of Cameroon","Q1009",1972,1983,"United Republic of Cameroon","Объединённая Республика Камерун","https://www.archontology.org/nations/cameroon/01_polity.php","The federal name is obsolete after 2 June 1972.","Федеративная Республика преобразована в Объединённую в июне 1972 года."],
 ["United Republic of Cameroon","Q1009",1984,2024,"Republic of Cameroon","Республика Камерун","https://treaties.un.org/pages/HistoricalInfo.aspx","The country's name returned to Republic of Cameroon on 4 February 1984.","4 февраля 1984 года Камерун вновь стал называться Республикой Камерун."],
 ["Central African Republic","Q929",1977,1978,"Central African Empire","Центральноафриканская империя","https://research.un.org/en/unmembers/currentmembers","The Central African Empire existed from December 1976 to September 1979; these full calendar years were imperial.","Империя существовала с декабря 1976 до сентября 1979 года; 1977–1978 полные годы имперского режима."],
 ["Republic of the Congo","Q971",1970,1990,"People's Republic of the Congo","Народная Республика Конго","https://www.archontology.org/nations/congo_b/01_polity.php","The constitution of 31 December 1969 declared a People's Republic, which ended in June 1991.","Народная Республика Конго существовала с конца 1969 до июня 1991 года."],
 ["Republic of Congo","Q971",1970,1990,"People's Republic of the Congo","Народная Республика Конго","https://www.archontology.org/nations/congo_b/01_polity.php","The full state title was People's Republic of the Congo for these years.","Официальное название было Народная Республика Конго."],
 ["People's Republic of the Congo","Q971",1992,2024,"Republic of the Congo","Республика Конго","https://www.archontology.org/nations/congo_b/01_polity.php","The People's Republic title ceased in June 1991.","После отмены социалистического государственного названия в 1991 году страна стала Республикой Конго."],
 ["Turkey","Q43",2022,2024,"Türkiye","Турция","https://turkiye.un.org/en/184798-turkeys-name-changed-t%C3%BCrkiye","The United Nations accepted the new English name in 2022, not new borders.","В ООН новая англоязычная форма принята в 2022 году; границы не менялись."],
 ["Republic of Turkey","Q43",2022,2024,"Republic of Türkiye","Турецкая Республика","https://turkiye.un.org/en/184798-turkeys-name-changed-t%C3%BCrkiye","The formal English name changed at the UN in 2022.","Официальное название по-английски изменено в ООН в 2022 году."],
 ["Türkiye","Q43",1923,2021,"Turkey","Турция","https://turkiye.un.org/en/184798-turkeys-name-changed-t%C3%BCrkiye","Do not retroactively apply the UN English spelling adopted in 2022.","Не переносить английское название 2022 года на более ранние годы."],
 ["Republic of Türkiye","Q43",1923,2021,"Republic of Turkey","Турецкая Республика","https://turkiye.un.org/en/184798-turkeys-name-changed-t%C3%BCrkiye","The pre-2022 formal English name was Republic of Turkey.","До 2022 года международное официальное английское название было Republic of Turkey."],
 ["Republic of Cabo Verde","Q1011",1975,2012,"Republic of Cape Verde","Республика Кабо-Верде","https://www.un.org/en/about-us/member-states/cabo-verde","The UN accepted the Cabo Verde form in October 2013.","До октября 2013 года английское название в ООН было Republic of Cape Verde."],
 ["Cabo Verde","Q1011",1975,2012,"Cape Verde","Кабо-Верде","https://www.un.org/en/about-us/member-states/cabo-verde","The pre-2013 English short name was Cape Verde.","До октября 2013 года английская краткая форма была Cape Verde."],
 ["Republic of Cape Verde","Q1011",2013,2024,"Republic of Cabo Verde","Республика Кабо-Верде","https://www.un.org/en/about-us/member-states/cabo-verde","The UN accepted Republic of Cabo Verde in October 2013.","ООН приняла Republic of Cabo Verde в октябре 2013 года."],
 ["Cape Verde","Q1011",2013,2024,"Cabo Verde","Кабо-Верде","https://www.un.org/en/about-us/member-states/cabo-verde","The UN changed the English short name in 2013.","Английская краткая форма изменена в ООН в 2013 году."],
 ["Union of Myanmar","Q836",1948,1973,"Union of Burma","Бирманский Союз","https://www.un.org/en/about-us/member-states/myanmar","The independent country's English title was the Union of Burma.","В 1948 году государство называлось Union of Burma на английском языке."],
 ["Union of Myanmar","Q836",1974,1987,"Socialist Republic of the Union of Burma","Социалистическая Республика Бирманский Союз","https://press-files.anu.edu.au/downloads/press/n7424/html/protocols_politics.xhtml","The 1974 socialist constitutional title predates the 1988 coup.","Социалистическая республика 1974 года не называлась Union of Myanmar."],
 ["Union of Myanmar","Q836",1988,1988,"Union of Burma","Бирманский Союз","https://press-files.anu.edu.au/downloads/press/n7424/html/protocols_politics.xhtml","The interim English name reverted to Union of Burma in 1988.","В 1988 году название на английском было возвращено к Union of Burma."],
 ["Republic of the Union of Myanmar","Q836",1989,2010,"Union of Myanmar","Союз Мьянма","https://www.un.org/en/about-us/member-states/myanmar","Republic of the Union of Myanmar was adopted only in 2011.","Republic of the Union of Myanmar принято только 30 марта 2011 года."],
 ['Kingdom of Italy','Q172579',568,773,'Kingdom of the Lombards','Лангобардское королевство','https://www.treccani.it/enciclopedia/longobardi_%28Enciclopedia-machiavelliana%29/','The pre-774 polity is the Lombard kingdom; Charlemagne conquered it in 774. The shared source identifier also occurs for later medieval Italy, which is not renamed.','До завоевания Карлом Великим в 774 году это Лангобардское королевство. Более поздние записи Итальянского королевства не переименованы.'],
 ['Antigua and Barbuda','Q781',1967,1980,'Antigua (associated state)','Антигуа (ассоциированное государство)','https://www.legislation.gov.uk/ukpga/1967/4','Antigua was an associated state of the United Kingdom; independent Antigua and Barbuda dates from 1981.','Антигуа имела статус ассоциированного с Великобританией государства; независимое государство Антигуа и Барбуда образовано в 1981 году.'],
 ['Sri Lanka','Q854',1948,1971,'Ceylon','Цейлон',COUNTRY_NAMES,'Sri Lanka replaced Ceylon in 1972.','Название Шри-Ланка принято в 1972 году.'],
 ['Eswatini','Q1050',1968,2017,'Kingdom of Swaziland','Королевство Свазиленд',COUNTRY_NAMES,'Swaziland was renamed Eswatini in 2018.','Свазиленд переименован в Эсватини в 2018 году.'],
 ['Republic of Poland','Q36',1952,1988,"Polish People's Republic",'Польская Народная Республика','https://eng.ipn.gov.pl/en/brief-history-of-poland','The 1952 constitution introduced the Polish People’s Republic; the Republic of Poland name was restored in December 1989.','Конституция 1952 года ввела название ПНР; название Республика Польша восстановлено в декабре 1989 года.'],
 ['Socialist Republic of Romania','Q842794',1948,1964,"People's Republic of Romania",'Румынская Народная Республика','https://legislatie.just.ro/Public/DetaliiDocumentAfis/14938','The Socialist Republic title dates from the constitution of 21 August 1965.','Название Социалистическая Республика Румыния установлено конституцией 21 августа 1965 года.'],
 ['Federal Republic of Somalia','Q1045',1960,1968,'Somali Republic','Сомалийская Республика','https://somalia.un.org/sites/default/files/2019-09/The%20UN%20in%20SOMALIA%20Yearbook%202014.pdf','The Somali Republic was formed on 1 July 1960.','Сомалийская Республика образована 1 июля 1960 года.'],
 ['Federal Republic of Somalia','Q1045',1969,1990,'Somali Democratic Republic','Сомалийская Демократическая Республика','https://somaliembassy.se/history/','The military government proclaimed the Somali Democratic Republic in 1969.','В 1969 году провозглашена Сомалийская Демократическая Республика.'],
 ['Federal Republic of Somalia','Q1045',1991,2011,'Somalia','Сомали','https://senate.gov.so/historical-background/?lang=en','The federal constitution dates from 2012; this neutral name does not imply unified effective control during civil war.','Федеральная конституция принята в 2012 году; нейтральное название не означает единого фактического контроля во время гражданской войны.'],
 ['Democratic Republic of the Congo','Q974',1960,1963,'Republic of the Congo (Léopoldville)','Республика Конго (Леопольдвиль)','https://www.un.org/dppa/decolonization/en/history/former-trust-and-nsgts','At UN admission the state was the Republic of the Congo (Léopoldville); the DRC title dates from 1964.','При вступлении в ООН государство называлось Республика Конго (Леопольдвиль); название ДР Конго принято в 1964 году.'],
 ['Democratic Republic of the Congo','Q974',1971,1996,'Republic of Zaire','Республика Заир','https://www.un.org/sites/un2.un.org/files/achieving_our_common_humanity.pdf','The Republic of Zaire title was used from 27 October 1971 until 17 May 1997.','Название Республика Заир использовалось с 27 октября 1971 до 17 мая 1997 года.'],
 ['Kingdom of Cambodia','Q424',1970,1974,'Khmer Republic','Кхмерская Республика','https://legal.un.org/avl/ha/abunac/abunac.html','The monarchy was replaced by the Khmer Republic in 1970; the Khmer Rouge seized Phnom Penh in April 1975.','В 1970 году монархию сменила Кхмерская Республика; в апреле 1975 года власть в Пномпене захватили красные кхмеры.'],
 ['Kingdom of Cambodia','Q424',1975,1975,'Cambodia (Khmer Rouge government)','Камбоджа (правительство красных кхмеров)','https://legal.un.org/avl/ha/abunac/abunac.html','Khmer Rouge rule began in April 1975; Democratic Kampuchea was formally named in 1976.','Правление красных кхмеров началось в апреле 1975 года; название Демократическая Кампучия официально принято в 1976 году.'],
 ['Papua New Guinea','Q691',1949,1971,'Territory of Papua and New Guinea (Australian administration)','Территория Папуа и Новая Гвинея (австралийское управление)','https://www.awm.gov.au/collection/PL384','The combined territory formed in 1949 under Australian administration, not as an independent country.','Объединённая территория образована в 1949 году под управлением Австралии, а не как независимое государство.'],
 ['Papua New Guinea','Q691',1972,1972,'Papua New Guinea (Australian administration)','Папуа — Новая Гвинея (австралийское управление)','https://www.dfat.gov.au/geo/papua-new-guinea/papua-new-guinea-country-brief','The territory was renamed Papua New Guinea in 1972; self-government followed in 1973.','В 1972 году территория переименована в Папуа — Новая Гвинея; самоуправление получено в 1973 году.'],
 ['Papua New Guinea','Q691',1973,1974,'Papua New Guinea (self-governing territory)','Папуа — Новая Гвинея (самоуправляемая территория)','https://www.naa.gov.au/help-your-research/fact-sheets/independence-papua-new-guinea','Self-government began on 1 December 1973; independence followed on 16 September 1975.','Самоуправление получено 1 декабря 1973 года, независимость — 16 сентября 1975 года.'],
];
// Annual labels use the successor in the transition year; no new cartographic
// boundary is inferred from a dynastic succession. All raw fields survive.
const delhiTransitions=[{old:'Mamluk Dynasty',next:'Khalji Dynasty',qid:'Q919071',ru:'Династия Хильджи',from:1290,to:1293},{old:'Khalji Dynasty',next:'Tughlaq Dynasty',qid:'Q1124402',ru:'Династия Туглаков',from:1320,to:1325},{old:'Tughlaq Dynasty',next:'Sayyid Dynasty',qid:'Q1331421',ru:'Династия Сайидов',from:1414,to:1450},{old:'Sayyid Dynasty',next:'Lodi Dynasty',qid:'Q11709',ru:'Династия Лоди',from:1451,to:1452}];
function editorialSegments(base,derived=[]){
 const out=[];
 // Split only at an applicable correction boundary, never drop original years.
 const cuts=new Set([base.from,base.to+1]);
 const delhi=base.sourceSeshatId==='in_delhi_sultanate'&&(base.role==='composite'||base.memberOf.includes('(Delhi Sultanate)'));
 if(delhi)for(const t of delhiTransitions)if(t.from<=base.to&&t.to>=base.from){cuts.add(Math.max(base.from,t.from));cuts.add(Math.min(base.to,t.to)+1)}
 const spring=chinaGroupTransition.has(base.sourceIndex)&&base.memberOf.includes('(Spring and Autumn States)')&&base.from<=-480&&base.to>=-480;
 if(spring)cuts.add(-480);
 const cut=year=>{if(year===0)year=1;if(base.from<year&&year<=base.to)cuts.add(year)};
 for(const rule of [...componentExclusions,...derived])if(rule[0]===base.sourceIndex){cut(rule[2]);if(rule[7]!==undefined)cut(rule[7]+1)}
 if([9410,9438,9441,9450].includes(base.sourceIndex))cut(1707);
 if([4739,4734].includes(base.sourceIndex)){cut(1111);cut(1144)}
 if([4776,4821,4874,4898,4880,4915].includes(base.sourceIndex)){cut(1126);cut(1152)}
 if([3863,3963].includes(base.sourceIndex))for(const year of Object.values(SONG_ENDS))cut(year);
 if(songAnnexations.some(([source])=>source===base.sourceIndex))cut(songAnnexations.find(([source])=>source===base.sourceIndex)[2]);
 if([4524,4600,4641,4705,4744].includes(base.sourceIndex))for(const year of [1077,1092,1094,1111,1116])cut(year);
 if(base.sourceIndex===9759||FRENCH_INDIA_GROUPS.includes(base.sourceIndex)||base.sourceIndex===10351)for(const y of [1791,1793])cut(y);
 if(base.sourceIndex===12755)cut(1940);
 if([13129,13137].includes(base.sourceIndex))cut(1954);
 if(base.sourceIndex===8663)cut(1622);
 if([6924,7269].includes(base.sourceIndex))cut(1459);
 if([...DUTCH_HOLLAND_GROUPS,...DUTCH_HOLLAND_METRO,...DUTCH_HOLLAND_COLONIES].includes(base.sourceIndex))for(const y of [1807,1811])cut(y);
 if(base.sourceIndex===7187){cut(1454);cut(1462)}
 if(base.role==='polity'&&base.sourceName==='Sultanate of Malacca')cut(1529);
 if(base.sourceIndex===13313){cut(1973);cut(1976)}
 if(base.sourceIndex===12910)cut(1944);
 if(base.components.includes('County of Savoy'))cut(1416);
 const british=base.sourceName==='Kingdom of Great Britain'&&base.sourceWikidata==='Q23666';
 const britishComponent=base.components.includes('Kingdom of Great Britain');
 if(british||britishComponent){cut(1801);cut(1927)}
 if(british){cut(2000);cut(2024)}
 for(const [name,qid,year] of reviewedNames)if(base.sourceName===name&&base.sourceWikidata===qid)cut(year);
 if(base.sourceName==='First Hellenic Republic'&&base.sourceWikidata==='Q528546'){cut(1832);cut(1924);cut(1935)}
 if(base.sourceName==='Denmark-Norway'&&base.sourceWikidata==='Q62651')cut(1814);
 if(base.sourceName==='United Arab Republic'&&base.sourceWikidata==='Q170468')cut(1971);
 if(base.sourceName==='New France'&&base.sourceWikidata==='Q170604')cut(1763);
 if(base.sourceName==='(Dutch Republic)'||base.components.includes('Portuguese Ceylon')){cut(1638);cut(1659);cut(1796)}
 if(base.sourceName==='(Spanish Empire)'){cut(1629);cut(1638)}
 if(base.components.includes('British Cape Colony'))for(const y of [1797,1803,1806,1808,1811,1820,1885])cut(y);
 if(base.sourceName==='New Netherland'&&base.sourceWikidata==='Q382593')cut(1675);
 if(base.sourceIndex===13271)cut(1964);
 if(base.sourceIndex===13265)cut(1964);
 if(base.role==='composite'&&base.sourceName==='(British Empire)'&&base.components.includes('British Gold Coast')){cut(1905);cut(1958);cut(1960)}
 if(base.role==='composite'&&base.sourceName==='(British Empire)'&&base.components.includes('British East Africa')){cut(1961);cut(1969)}
 if(base.role==='composite'&&base.sourceName==='(Kingdom of France)'&&base.components.includes('New France')){cut(1763);cut(1791)}
 if(base.sourceName==='Netherlands Antilles'&&base.sourceWikidata==='Q25227'){cut(1976);cut(1986);cut(2010)}
 if(base.sourceName==='Estado Novo'&&base.sourceWikidata==='Q824489'){cut(1933);cut(1974)}
 if(base.sourceIndex===13399)cut(2000);
 if(base.sourceIndex===7783)cut(1516);
 if(base.sourceIndex===5295)cut(1210);
 if(base.sourceIndex===4776)cut(1126);
 if(base.sourceIndex===4678)cut(1094);
 if(base.sourceName==='Republic of Benin'&&base.sourceWikidata==='Q962'){cut(1975);cut(1990)}
 if(base.sourceIndex===13249)cut(1984);
 if(base.sourceIndex===13267)cut(1966);
 if(base.sourceIndex===13245)cut(1963);
 if(base.sourceIndex===13306)cut(1970);
 if(base.sourceIndex===13371)cut(1990);
 const titleRules=historicalTitleCorrections.filter(([name,qid])=>base.role==='polity'&&base.sourceName===name&&base.sourceWikidata===qid);
 for(const [, , start,end] of titleRules){cut(start);cut(end+1);}
 const sorted=[...cuts].sort((a,b)=>a-b);
 for(let i=0;i+1<sorted.length;i++){
  const from=sorted[i]===0?1:sorted[i],to=sorted[i+1]-1===0?-1:sorted[i+1]-1;
  if(from>to)continue;
  let r={...base,from,to};
  const reasons=[],reasonsRu=[],sources=new Set();
  const note=(reason,urls,ru)=>{reasons.push(reason);if(ru)reasonsRu.push(ru);for(const url of urls)sources.add(url)};
  const rename=(name,nameRu,url,reason,reasonRu)=>{r={...r,name,nameRu,nameStatus:'reviewed'};note(reason,[url],reasonRu);};
  if(base.sourceIndex===9759&&from>=1791){r={...r,sourceMemberOf:base.memberOf,memberOf:[]};note('The surviving source components were duplicated in metropolitan France or under British occupation after the 1793 conquest. The historic French claim did not establish French administration until restoration in 1816–17.',[INDIA_OCCUPATION,INDIA_HISTORY],'Сохранившиеся компоненты дублировались в записи метрополии либо находились под британской оккупацией после захвата 1793 г. Французские притязания не означали французского управления до фактического возвращения в 1816–1817 гг.');}
  if(FRENCH_INDIA_GROUPS.includes(base.sourceIndex)){r={...r,sourceComponents:base.components,components:r.components.filter(n=>n!=='French India')};if(!r.components.length)r={...r,geometryStatus:'rejected'};note('Remove the obsolete India component label: the source composite either already includes the settlements in its metropolitan record or represents the period of British occupation. Comoro island claims are independently unresolved.',[INDIA_OCCUPATION,INDIA_HISTORY,comoroTraditionalRegions],'Устранена устаревшая ссылка на Индию: поселения уже включены в запись метрополии либо находились под британской оккупацией. Притязания на Коморские острова рассматриваются отдельно.');}
  if(base.sourceIndex===12755&&from>=1940){r={...r,sourceComponents:base.components,components:r.components.filter(n=>n!=='Netherlands'),nameRu:'Нидерландские владения (метрополия оккупирована)'};note('The German invasion in May 1940 led to occupation of the metropolis and the Dutch government in exile. The colonial aggregate does not establish continued Dutch effective control in Europe.',[DUTCH_1940],'После немецкого вторжения в мае 1940 г. метрополия находилась под оккупацией, нидерландское правительство — в изгнании. Колониальный контур не означает сохранения фактического контроля в Европе.');}
  if(base.sourceIndex===8648){r={...r,sourceMemberOf:base.memberOf,memberOf:[],geometryStatus:'rejected'};note('Both imported American polygons represent Dutch settlements, not Portugal; restored separately by region.',[DUTCH_GUYANA,DUTCH_HUDSON],'Оба американских контура относятся к нидерландским поселениям, не к Португалии; восстановлены отдельно по регионам.');}
  if(base.sourceIndex===8663){r={...r,sourceComponents:base.components,components:r.components.filter(n=>n!=='Portuguese Empire')};note('The American polygons are Dutch settlements, not the Portuguese Empire. The surviving aggregate contains only the contemporary Portuguese Ceylon and colonial records.',[DUTCH_GUYANA,DUTCH_HUDSON],'Американские контуры относятся к нидерландским поселениям, не к Португальской империи. В сводном слое остаются только португальский Цейлон и колонии того же года.');}
  if([6924,7269].includes(base.sourceIndex)&&from>=1459){r={...r,sourceMemberOf:base.memberOf,memberOf:r.memberOf.filter(n=>n!=='(Holy Roman Empire)')};note('The source imperial overlay now represents minor states only. Florence and Milan remain autonomous Italian states in the post-Lodi system; this cartographic link is not a determination that all imperial legal claims ended in 1459.',[ITALIAN_AUTONOMY],'Исходный имперский слой теперь охватывает только малые государства. Флоренция и Милан сохраняют автономию в послелодийской системе; удаление связи со слоем не означает прекращения всех имперских юридических притязаний в 1459 г.');}
  if(DUTCH_HOLLAND_METRO.includes(base.sourceIndex)&&from>=1807){r={...r,entityId:identity('reviewed-polity','kingdom-of-holland'),sourceMemberOf:base.memberOf,memberOf:['(Kingdom of Holland)']};rename('Kingdom of Holland','Королевство Голландия',DUTCH_HOLLAND,'The Batavian Republic was replaced by the Kingdom of Holland in 1806; annexation by France followed in 1810. The annual source geometry cannot resolve the intra-year change.','Батавскую республику сменило Королевство Голландия в 1806 г.; в 1810 г. последовала аннексия Францией. Годовой контур не устанавливает границу на конкретный день.');}
  if(DUTCH_HOLLAND_GROUPS.includes(base.sourceIndex)&&from>=1807){r={...r,sourceComponents:base.components,components:r.components.map(n=>n==='Batavian Republic'?'Kingdom of Holland':n),entityId:identity('reviewed-composite','kingdom-of-holland')};rename('(Kingdom of Holland)','Королевство Голландия (сводный контур)',DUTCH_HOLLAND,'The Batavian Republic was replaced by the Kingdom of Holland in 1806; the 1810 transition is approximate.','Батавскую республику сменило Королевство Голландия в 1806 г.; переход 1810 г. показан приблизительно.');}
  if(DUTCH_HOLLAND_COLONIES.includes(base.sourceIndex)&&from>=1807){r={...r,sourceMemberOf:base.memberOf,memberOf:from<1811?['(Kingdom of Holland)']:[]};if(from>=1811)rename('Former Dutch colonial possessions (British occupation, source aggregate)','Бывшие нидерландские колониальные владения (британская оккупация; сводный контур)',DUTCH_JAVA,'British rule in Java began in 1811; the source aggregate includes other islands and overseas settlements, whose precise local control is not established.','Британское управление Явой началось в 1811 г.; сводная запись включает другие острова и поселения, точный местный контроль которых не установлен.');else note('The colonial link follows the successor Kingdom of Holland after 1806.',[DUTCH_HOLLAND],'Колониальная связь отнесена к Королевству Голландия, преемнику республики после 1806 г.');}
  if(base.sourceIndex===10835){r={...r,sourceComponents:base.components,components:[],geometryStatus:'rejected'};note('The 1811–13 source composite mixes former Dutch possessions under British occupation with unrelated Danish claims; preserve provenance but do not draw the obsolete Dutch aggregate.',[DUTCH_JAVA],'Сводный контур 1811–1813 гг. смешивает бывшие нидерландские владения под британской оккупацией с датскими притязаниями; исходная запись сохранена, политический слой скрыт.');}
  if(base.sourceIndex===11008){r={...r,entityId:identity('rejected-source','french-india-comoros-1815'),geometryStatus:'rejected'};rename('French India (misplaced Comoro source record)','Французская Индия (ошибочный исходный контур Комор)',INDIA_OCCUPATION,'The source record consists only of Comoro components and cannot show the Indian settlements returned in 1816–17.','Исходная запись содержит только контуры Комор и не показывает индийские поселения, возвращённые в 1816–1817 гг.');}
  if(from>=1830&&to<=1847&&base.sourceName==='Bourbon Kingdom of France'){
   r={...r,entityId:identity('reviewed-polity','july-monarchy'),sourceMemberOf:base.memberOf,memberOf:['(July Monarchy)']};rename('July Monarchy','Июльская монархия',JULY_CHARTER,'The July Revolution replaced Charles X with Louis-Philippe in 1830; the constitutional monarchy lasted until February 1848.','После Июльской революции 1830 г. Карла X сменил Луи-Филипп. Июльская монархия существовала до февраля 1848 г.');
  }
  if(from>=1830&&to<=1847&&base.sourceName==='(Bourbon Kingdom of France)'){
   r={...r,entityId:identity('reviewed-composite','july-monarchy'),sourceComponents:base.components,components:r.components.map(n=>n==='Bourbon Kingdom of France'?'July Monarchy':n)};rename('(July Monarchy)','Июльская монархия (сводный контур)',JULY_CHARTER,'The composite follows the July Monarchy from 1830.','Сводный контур относится к Июльской монархии с 1830 г.');
  }
  if(from>=1830&&to<=1847&&base.sourceName!=='Bourbon Kingdom of France'&&r.memberOf.includes('(Bourbon Kingdom of France)')){r={...r,sourceMemberOf:base.memberOf,memberOf:r.memberOf.map(n=>n==='(Bourbon Kingdom of France)'?'(July Monarchy)':n)};note('Colonial administrative link follows the July Monarchy.',[JULY_CHARTER],'Колониальная связь отнесена к Июльской монархии.');}
  if(base.sourceIndex===11472){r={...r,entityId:identity('reviewed-composite','french-colonial-possession-1848')};rename('(French colonial possessions, 1848)','Французские колониальные владения (1848)',SECOND_REPUBLIC_CHARTER,'Monarchy ended in February 1848; the separate source aggregate represents colonial possessions of the Second Republic.','Монархия прекратилась в феврале 1848 г.; отдельный сводный контур относится к колониям Второй республики.');}
  if(base.sourceIndex===11458){r={...r,sourceMemberOf:base.memberOf,memberOf:['(French colonial possessions, 1848)']};note('The French African territories belonged to the Second Republic following the February revolution.',[SECOND_REPUBLIC_CHARTER],'Французские владения в Африке после Февральской революции принадлежали Второй республике.');}
  if(base.sourceIndex===3861&&from===960){
   r={...r,entityId:identity('source-polity','Northern Song','Q7462'),sourceMemberOf:base.memberOf,memberOf:[]};
   rename('Northern Song','Северная Сун',SONG_REUNIFICATION,'The Later Zhou was replaced by Song in 960; the next-year source polygon is identical. The annual label denotes the transition year.','Поздняя Чжоу сменилась Сун в 960 г.; исходный контур следующего года идентичен. Годовая запись отражает переход, а не конкретный день.');
  }
  if([3863,3963].includes(base.sourceIndex)){
   const components=base.components.filter(n=>!(n in SONG_ENDS)||from<SONG_ENDS[n]);
   if(components.length!==base.components.length){r={...r,sourceComponents:base.components,components};note('Only the surviving kingdoms are included after their dated annexations by Song; the group is reconstructed from contemporaneous member components.',[SONG_REUNIFICATION,SONG_CHRONOLOGY],'После датированных присоединений к Сун в сводном слое остаются только существующие царства; объединение построено из исходных контуров того же года.');}
   if(!components.length)r={...r,geometryStatus:'rejected'};
  }
  const songEnd=songAnnexations.find(([source])=>source===base.sourceIndex);
  if(songEnd&&from>=songEnd[2]){r={...r,sourceMemberOf:base.memberOf,memberOf:[],geometryStatus:'rejected'};note('Annexed by Northern Song in '+songEnd[2]+'; source record retained but its political area is transferred to the contemporary Song record.',[SONG_REUNIFICATION,SONG_CHRONOLOGY],'Присоединено к Северной Сун в '+songEnd[2]+' г.; исходная запись сохранена, территория отнесена к записи Сун того же года.');}
  if([4821,4874,4898].includes(base.sourceIndex)){
   rename(BLOIS_UNION,'Графства Блуа и Шампань (общий правитель)',BLOIS_CHAMPAGNE,'Thibaut IV of Blois became count of Champagne in 1125 and held both until 1152. The pinned combined polygon includes Champagne; this is common rule, not abolition of the separate titles.','Тибо IV Блуаский стал графом Шампани в 1125 г. и владел обоими графствами до 1152 г. Исходный объединённый контур включает Шампань; общая власть не означает упразднение двух титулов.');
  }
  if([4776,4827,4880,4915].includes(base.sourceIndex)&&from>=1126){r={...r,sourceComponents:base.components,components:r.components.filter(n=>n!=='County of Champagne').map(n=>n==='County of Blôis'?BLOIS_UNION:n)};note('Replace the separate labels with the combined source footprint of Thibaut’s two counties.',[BLOIS_CHAMPAGNE],'Указан объединённый контур двух графств Тибо.');}
  if(base.sourceIndex===4739&&from>=1111){r={...r,sourceComponents:base.components,components:base.components.filter(n=>n!=='County of Maine')};note('Maine passed to Fulk of Anjou in 1110; remove it from the English aggregate, retaining the dated Norman England source. Normandy is separately reassigned from 1144.',[MAINE_FULK,NORMANDY_GEOFFREY],'Мэн перешёл Фульку Анжуйскому в 1110 г.; он исключён из английского сводного контура. Нормандия отдельно перераспределена с 1144 г.');}
  if(base.sourceIndex===9438&&from>=1707){r={...r,entityId:identity('source-polity','Kingdom of Great Britain','Q23666'),sourceMemberOf:base.memberOf,memberOf:['(British Empire)']};rename('Kingdom of Great Britain','Королевство Великобритания',UNION_1707,'The 1 May 1707 union created Great Britain. The contemporaneous source polygon already includes the British mainland; exact borders remain candidates.','1 мая 1707 г. образовано Королевство Великобритания. Исходный контур того же года уже включает британский остров; точные границы требуют сверки.');}
  if(base.sourceIndex===9450&&from>=1707){r={...r,sourceComponents:base.components,components:[],geometryStatus:'rejected'};note('The English aggregate was superseded by the British aggregate after the union; its member outlines are retained in the rebuilt British layer.',[UNION_1707],'После унии английское объединение заменено британским; составляющие сохранены в восстановленном британском слое.');}
  if((base.sourceIndex===9441&&from>=1707)||base.sourceIndex===9507){r={...r,sourceComponents:base.components,components:[...new Set([...base.components,'Kingdom of Great Britain',BRITISH_SUPPLEMENT])]};note('The British composite includes the contemporary metropolitan and both colonial source records, with their source parts kept separately traceable.',[UNION_1707],'Британский сводный слой включает метрополию и обе колониальные записи того же года; исходные части прослеживаются отдельно.');}
  if(base.sourceIndex===4524&&from>=1077){
   const independent=from<1116;
   r={...r,entityId:identity('reviewed-polity',independent?'mallorca-taifa':'almoravid-balearics'),sourceMemberOf:base.memberOf,memberOf:independent?base.memberOf:[]};
   rename(independent?MALLORCA_TAIFA:'Balearic Islands (Almoravid administration)',independent?'Тайфа Мальорка':'Балеарские острова (Альморавиды)',MALLORCA_HISTORY,independent?'The Balearic polity became independent after the fall of Dénia in 1076. The 1114–15 expedition and subsequent Almoravid takeover do not establish day-level borders.':'The Balearics came under Almoravid rule in 1116; the source islands remain an approximate separate administrative region, not an independent taifa.',independent?'После захвата Дении в 1076 г. Балеарские острова стали самостоятельной тайфой. Поход 1114–1115 гг. и последующая власть Альморавидов не задают границы на конкретный день.':'С 1116 г. Балеарские острова под властью Альморавидов; островной контур — приблизительная отдельная область управления, не самостоятельная тайфа.');
  }
  if([4600,4641,4705,4744].includes(base.sourceIndex)&&from>=1077){
   const obsolete=new Set(['Taifa of Alpuente','Taifa of Zaragoza','Taifa of Tortosa','Taifa of Albarracín']);
   const components=base.components.flatMap(n=>n==='Taifa of Dénia'?(from<1116?[MALLORCA_TAIFA]:[]):from>=1111&&obsolete.has(n)?[]:[n]);
   r={...r,sourceComponents:base.components,components};note('The mainland taifas were annexed and the independent island polity survived separately until the 1115–16 transition.',[DENIA_HISTORY,MALLORCA_HISTORY,TAIFA_HISTORY],'Материковые тайфы присоединены к другим государствам, отдельная островная тайфа существовала до перехода 1115–1116 гг.');
   if(!components.length)r={...r,geometryStatus:'rejected'};
  }
  if(base.sourceName==='(Spanish Empire)'&&from>=1629&&to<=1639&&base.components.includes('Iberian Union')){
   r={...r,sourceComponents:base.components,components:[...r.components,'Portuguese Ceylon']};
   note('Portuguese Ceylon retained its Portuguese administration under the shared Iberian monarch; it is a distinct component of the union-era aggregate.',ceylonEarlySources,'Португальский Цейлон сохранял португальскую администрацию при общем монархе Иберийской унии; выделен отдельной составляющей объединения.');
  }
  if(base.sourceName==='(Dutch Republic)'&&from>=1659&&to<=1795&&!r.components.includes('Dutch Ceylon')){
   r={...r,sourceComponents:base.components,components:[...r.components,'Dutch Ceylon']};
   note('The Dutch coastal possessions in Ceylon are a distinct member of this composite.',ceylonCoastalSources,'Прибрежные владения VOC на Цейлоне выделены как отдельная составляющая объединения.');
  }
  if(base.sourceName==='(Portuguese Empire)'&&from>=1659&&r.components.includes('Portuguese Ceylon')){
   r={...r,sourceComponents:base.components,components:r.components.filter(n=>n!=='Portuguese Ceylon')};
   note('Portuguese coastal rule ended in 1658; Kandy was not a Portuguese possession.',ceylonCoastalSources,'Португальское правление на побережье завершилось в 1658 году; Канди не принадлежало Португалии.');
  }
  for(const [,,start,end,name,ru,url,reason,reasonRu] of titleRules)if(from>=start&&to<=end)rename(name,ru,url,reason,reasonRu);
  if(from>=1416&&base.components.includes('County of Savoy')){
   r={...r,sourceComponents:base.components,components:r.components.map(n=>n==='County of Savoy'?'Duchy of Savoy':n)};
   note('Sigismund elevated the Count of Savoy to Duke on 9 February 1416. Align the historical component label with the contemporary title, without altering or validating the source overlay geometry.',['https://archiviodistatotorino.beniculturali.it/siglist/?uid=270567'],'9 февраля 1416 года Сигизмунд возвёл графа Савойского в герцогское достоинство. Исправлено название составляющей; геометрия и состав остального объединения не подтверждаются этим документом.');
  }
  if(base.sourceName==='Republic of Benin'&&base.sourceWikidata==='Q962'&&from<1990){
   const dahomey=from<1975;
   rename(dahomey?'Republic of Dahomey':"People's Republic of Benin",dahomey?'Республика Дагомея':'Народная Республика Бенин','https://www.gouv.bj/pages/histoire/','Dahomey was renamed the People’s Republic of Benin in 1975; the latter name ended in 1990.','Дагомея переименована в Народную Республику Бенин в 1975 году; с 1990 года — Республика Бенин.');
  }
  if(base.sourceIndex===13249&&from<1984)rename('Republic of Upper Volta','Республика Верхняя Вольта','https://history.state.gov/countries/burkina-faso','Upper Volta became Burkina Faso in 1984.','Верхняя Вольта переименована в Буркина-Фасо в 1984 году.');
  if(base.sourceIndex===13267&&from<1966)rename('Kingdom of Burundi','Королевство Бурунди','https://www.mae.gov.bi/histoire/','The monarchy was abolished on 28 November 1966.','Монархия упразднена 28 ноября 1966 года.');
  if(base.sourceIndex===13245&&from<1963)rename('Federation of Nigeria','Федерация Нигерия','https://sccr.gov.ng/?page_id=119','The republic constitution entered into force on 1 October 1963.','Республиканская конституция вступила в силу 1 октября 1963 года.');
  if(base.sourceIndex===13306&&from<1970)rename("People's Republic of Southern Yemen",'Народная Республика Южного Йемена','https://history.state.gov/countries/yemen','South Yemen adopted its later official name in 1970.','Южный Йемен изменил официальное название в 1970 году.');
  if(base.sourceIndex===13371&&from<1990)rename("People's Republic of Mozambique",'Народная Республика Мозамбик','https://www.ts.gov.mz/legislacao/','The 1990 Constitution established the Republic of Mozambique.','Конституция 1990 года закрепила наименование Республика Мозамбик.');
  if(territorialResolutions.kandy.indices.includes(base.sourceIndex)){
   const d=territorialResolutions.kandy;
   assert.ok(['Portuguese Ceylon','Dutch Ceylon','British Ceylon'].includes(base.sourceName)&&from>=1629&&to<=1814);
   r={...r,name:'Kingdom of Kandy',nameRu:'Королевство Канди',nameStatus:'reviewed',entityId:identity('reviewed-polity','kingdom-of-kandy'),sourceMemberOf:base.memberOf,memberOf:[]};
   note(d.reason,d.sources,d.reasonRu);
  }
  if(base.role==='polity'&&base.sourceName==='Viking settlements'){
   r={...r,role:'settlement',sourceRole:'polity',nameRu:'Поселения скандинавов (викингов)',nameStatus:'reviewed'};
   note('The source aggregates settlements of different Norse communities, across different rulers and periods. Preserve the source footprint in a thematic layer, not as a single sovereign polity. Exact settlement extent and chronology still require independent review.',['https://www.metmuseum.org/pt/essays/the-vikings-780-1100','https://en.natmus.dk/historical-knowledge/denmark/prehistoric-period-until-1050-ad/the-viking-age/power-and-aristocracy/magnates-and-kings/'],'Исходник объединяет поселения разных скандинавских общин, правителей и эпох. Контур сохранён в тематическом слое расселения, а не как единое государство. Точные размеры и датировки поселений требуют отдельной сверки.');
  }
  if((base.sourceIndex===9410||base.sourceIndex===9553)&&from>=1707){
   const supplemental=base.sourceIndex===9410;
   r={...r,name:supplemental?'British colonial possessions (supplemental source record)':'British settlements in India (source aggregate)',nameRu:supplemental?'Британские колониальные владения (дополнительный контур)':'Британские поселения в Индии (сводный контур)',nameStatus:'reviewed',entityId:identity('reviewed-polity',supplemental?'british-colonial-supplement-9410':'british-indian-settlements-9553')};
   if(supplemental)r={...r,sourceMemberOf:base.memberOf,memberOf:['(British Empire)']};
   note('The 1707 Acts of Union created Great Britain; these are surviving source records for British possessions, not a separate English colonial empire. Exact remaining extents and archival group associations are unverified.',['https://www.parliament.uk/about/living-heritage/evolutionofparliament/legislativescrutiny/act-of-union-1707/'],'После образования Великобритании в 1707 году эти записи относятся к британским владениям, а не к отдельной английской колониальной империи. Оставшиеся границы и архивные связи требуют проверки.');
  }
  if(base.sourceIndex===10461&&from>=1803&&to<=1805){
   r={...r,name:'British Cape Colony (inactive source record)',nameRu:'Капская колония — исходная запись без действующего британского контура',nameStatus:'reviewed',sourceMemberOf:base.memberOf,memberOf:[]};
   note('The Cape was governed by the Batavian Republic in 1803–1805; only the separately restored Sierra Leone settlement was British.',[capeSource],'В 1803–1805 гг. Капская колония управлялась Батавской республикой; британское поселение Сьерра-Леоне выделено отдельно.');
  }
  if(base.sourceIndex===7187&&from>=1454){
   r={...r,name:'Byzantine remnants (unverified source aggregate)',nameRu:'Остаточные византийские территории (непроверенный сводный контур)',nameStatus:'reviewed',entityId:identity('reviewed-polity','byzantine-remnants-7187')};
   if(from>=1462)r.geometryStatus='rejected';
   note('Constantinople fell in 1453, Morea in 1460 and Trebizond in 1461. Remaining source components cannot be identified as a surviving Byzantine empire; after 1461 the unidentified remnant is rejected for drawing and retained for separate attribution.',['https://www.ime.gr/chronos/10/en/p/pb9/pb9c.html'],'Константинополь пал в 1453 году, Морея — в 1460, Трапезунд — в 1461. Оставшиеся компоненты источника не представляют сохранившуюся Византийскую империю; с 1462 года неопознанный остаток исключён из отрисовки, исходник сохранён для атрибуции.');
  }
  if(base.role==='polity'&&base.sourceName==='Sultanate of Malacca'&&from>=1529){
   r={...r,geometryStatus:'rejected'};
   note('Melaka fell in 1511 and the successor Johor sultanate was founded in 1528. Post-1528 contours labelled as the old Malacca polity require independent attribution to their actual successor states or colonial authorities. Retain the source record but do not draw it as a continuing Malacca Sultanate.',['https://kemahkotaan.johor.gov.my/pengenalan/sejarah-kesultanan-johor/?lang=en','https://www.malaysia.gov.my/en/government/learn-about-malaysia/malaysian-history'],'Малакка пала в 1511 году, султанат-преемник Джохор основан в 1528 году. Контуры после 1528 года, подписанные как старый Малаккский султанат, требуют отдельной атрибуции. Исходные данные сохранены, неверная политическая принадлежность исключена из отрисовки.');
  }
  if(base.sourceIndex===9806){
   r={...r,geometryStatus:'rejected'};
   note('The Malacca Sultanate centred on Melaka ended in 1511. This eighteenth-century source footprint spans distinct parts of Java, Sumatra and the Malay Peninsula and cannot be attributed to that polity. Preserve the raw source for reassignment; do not substitute a modern border or invent another state.',['https://ipim.jmm.gov.my/sites/default/files/file1p1m/Buku%20Teks%20Sejarah%20Tingkatan%202.pdf','https://www.malaysia.gov.my/en/government/learn-about-malaysia/malaysian-history'],'Малаккский султанат с центром в Малакке прекратил существование в 1511 году. Этот контур XVIII века объединяет части Явы, Суматры и Малаккского полуострова и не может принадлежать данному государству. Исходная запись сохранена для раздельной атрибуции; современные границы не подставлены.');
  }
  if(base.sourceIndex===9986){
   r={...r,name:'Kingdom of Naples (Bourbon)',nameRu:'Неаполитанское королевство (Бурбоны)',nameStatus:'reviewed',entityId:identity('reviewed-polity','bourbon-naples')};
   note('Ferdinand IV of Bourbon reigned from 1759; the 1762–1798 source revision belongs to Bourbon Naples, not the Napoleonic kingdom. Its territorial extent remains unverified.',['https://www.treccani.it/enciclopedia/ferdinando-i-di-borbone-re-delle-due-sicilie_%28Dizionario-Biografico%29/'],'В 1762–1798 годах Неаполем правил Фердинанд IV из династии Бурбонов, а не наполеоновская династия. Контур требует независимой проверки.');
  }
  for(const rule of exclusionsFor(base.sourceIndex,from,derived))note(rule[4]+' Only identified source components were removed; coverage and remaining borders are unverified.',[rule[6]],rule[5]+' Остальные границы и полнота покрытия требуют проверки.');
  if(base.sourceName==='First Hellenic Republic'&&base.sourceWikidata==='Q528546'&&from>=1832){
   const republic=from>=1924&&from<1935;
   r={...r,name:republic?'Second Hellenic Republic':'Kingdom of Greece',nameRu:republic?'Вторая Греческая республика':'Королевство Греция',nameStatus:'reviewed',entityId:republic?identity('reviewed-polity','second-hellenic-republic'):identity('source-polity','Kingdom of Greece','Q209065')};
   note('Greece became a kingdom in 1832, a republic in 1924 and restored the monarchy in 1935. The historical extent remains a candidate.',[GREEK_REGIMES,'https://200years.mfa.gr/international-treaties/'],'В 1832 году образовано Греческое королевство, в 1924 провозглашена Вторая республика, в 1935 восстановлена монархия. Границы требуют отдельной проверки.');
  }
  if(base.sourceName==='Denmark-Norway'&&base.sourceWikidata==='Q62651'&&from>=1814){
   r={...r,name:base.sourceIndex===12846?'Faroe Islands (Danish territory)':'Denmark',nameRu:base.sourceIndex===12846?'Фарерские острова (территория Дании)':'Дания',nameStatus:'reviewed',entityId:base.sourceIndex===12846?identity('reviewed-polity','faroe-islands-danish-territory'):identity('source-polity','Denmark','Q350186')};
   note('Denmark and Norway separated in 1814; the source geometry is not the former dual monarchy.'+(base.sourceIndex===12846?' This record contains only the Faroe Islands, not mainland Denmark.':''),[DENMARK_SEPARATION],'Датско-норвежская уния распалась в 1814 году. Исходный контур не представляет прежнюю двойную монархию.'+(base.sourceIndex===12846?' Здесь только Фарерские острова, без материковой Дании.':''));
  }
  if(base.sourceName==='United Arab Republic'&&base.sourceWikidata==='Q170468'&&from>=1971){
   r={...r,name:'Arab Republic of Egypt',nameRu:'Арабская Республика Египет',nameStatus:'reviewed',entityId:identity('source-polity','Arab Republic of Egypt','Q79')};
   note('Egypt retained the name United Arab Republic after Syria withdrew, but changed its official name in 1971.',[EGYPT_UAR],'После выхода Сирии Египет сохранял название ОАР, но в 1971 году изменил официальное название.');
  }
  if(base.sourceName==='New France'&&base.sourceWikidata==='Q170604'&&from>=1763){
   r={...r,name:base.sourceIndex===10325?'Saint Pierre and Miquelon':'French colonial possessions (source aggregate)',nameRu:base.sourceIndex===10325?'Сен-Пьер и Микелон':'Французские колониальные владения (сводный контур)',nameStatus:'reviewed',entityId:identity('reviewed-polity',base.sourceIndex===10325?'saint-pierre-miquelon':'french-colonial-possessions-aggregate')};
   note('After the 1763 cessions the source combines separate French colonial possessions in the Caribbean, Africa and elsewhere; it is not New France. Remaining borders need independent review.',[FRENCH_CESSIONS],'После уступок 1763 года исходник объединяет отдельные французские колонии в Карибском море, Африке и других регионах, а не Новую Францию. Остальные границы требуют проверки.');
  }
  if(base.sourceName==='New Netherland'&&base.sourceWikidata==='Q382593'&&from>=1675){
   r={...r,name:'Dutch Caribbean and Guiana possessions (source aggregate)',nameRu:'Нидерландские владения в Карибском море и Гвиане (сводный контур)',nameStatus:'reviewed',entityId:identity('reviewed-polity','dutch-caribbean-guiana-aggregate')};
   note('New Netherland in North America was ceded to England in 1674. The surviving source components are Caribbean and Guiana possessions, not New Netherland; their changing control still requires review.',['https://www.nps.gov/parkhistory/online_books/acad/wabanaki_peoples_vol1.pdf'],'Новые Нидерланды в Северной Америке уступлены Англии в 1674 году. Оставшиеся контуры относятся к Карибскому морю и Гвиане, а не к Новым Нидерландам; смена власти на них требует проверки.');
  }
  if(base.sourceName==='British Gold Coast'&&base.sourceWikidata==='Q503623'&&from>=1905){
   const nigeria=from>=1958;
   r={...r,name:nigeria?(from>=1960?'Federation of Nigeria':'British Nigeria'):'British West African territories (Gold Coast and Nigeria)',nameRu:nigeria?(from>=1960?'Федерация Нигерия':'Британская Нигерия'):'Британские владения в Западной Африке (Золотой Берег и Нигерия)',nameStatus:'reviewed',entityId:identity('reviewed-polity',nigeria?(from>=1960?'nigeria-independence-transition':'british-nigeria'):'british-gold-coast-nigeria-aggregate')};
   if(from>=1960)r={...r,sourceMemberOf:base.memberOf,memberOf:base.memberOf.filter(n=>n!=='(British Empire)')};
   note('This source record also includes the disconnected outline of Nigeria; Gold Coast became Ghana in 1957 and Nigeria became independent in 1960. The Nigeria boundary remains unverified.',[SURINAME_SOURCE],'Исходная запись включает отдельный контур Нигерии. Золотой Берег стал Ганой в 1957 году, Нигерия получила независимость в 1960. Границы Нигерии требуют проверки.');
  }
  if(base.sourceIndex===13232){
   r={...r,name:'British African and Arabian possessions (source aggregate)',nameRu:'Британские владения в Африке и Аравии (сводный контур)',nameStatus:'reviewed'};
   note('The source is not merely East Africa; it includes multiple disconnected territories and two merged mainland polygons. The remaining mainland components mix territories with different independence dates and are not a verified colonial boundary; reconstruct separately.',[SURINAME_SOURCE],'Исходник не ограничен Восточной Африкой: есть отдельные владения и два слитных материковых контура. В оставшихся материковых контурах смешаны территории с разными датами независимости; необходима отдельная реконструкция границ.');
  }
  if(base.sourceIndex===13265){
   if(from<1964){r={...r,name:'Tanganyika',nameRu:'Танганьика',nameStatus:'reviewed',entityId:identity('reviewed-polity','tanganyika')};note('Before the union of April 1964, mainland Tanganyika and Mafia Island formed the separate country of Tanganyika. Mafia is transferred from the same-year island source record.',[TANZANIA_UN],'До объединения в апреле 1964 года материковая Танганьика и остров Мафия составляли отдельное государство. Контур Мафии перенесён из островной записи того же года.');}
   else note('Tanganyika and Zanzibar united in April 1964; the three original island components from the now-defunct separate Zanzibar record are restored in this mainland record. Remaining borders are unverified.',[TANZANIA_UN],'Танганьика и Занзибар объединились в апреле 1964 года; три исходных островных контура добавлены из отдельной записи прекратившего существование Занзибара. Остальные границы требуют проверки.');
  }
  if(base.sourceIndex===13271){
   if(from>=1964){r={...r,geometryStatus:'rejected'};note('The independent Sultanate no longer existed after the 1964 union; all three original island components are retained under Tanzania in the same-year mainland record.',[TANZANIA_UN],'После объединения 1964 года самостоятельный султанат прекратил существование; все три исходных островных контура сохранены в записи Танзании того же года.');}
   else note('Mafia Island belonged to Tanganyika; it is transferred to the same-year mainland record. Zanzibar and Pemba remain here.',[TANZANIA_UN],'Остров Мафия относился к Танганьике и перенесён в материковую запись того же года. Здесь сохранены Занзибар и Пемба.');
  }
  if(base.sourceIndex===13309){
   r={...r,name:'Seychelles (British colony)',nameRu:'Сейшельские острова (британская колония)',nameStatus:'reviewed',entityId:identity('reviewed-polity','seychelles-british-colony')};
   note('The source polygon is Mahé in the Seychelles, not the mainland East Africa Protectorate. Seychelles remained a British colony until 1976.',[SURINAME_SOURCE],'Исходный контур — остров Маэ, а не материковый протекторат Восточной Африки. Сейшелы оставались британской колонией до 1976 года.');
  }
  if(base.sourceIndex===13313){
   r={...r,geometryStatus:'rejected',sourceComponents:base.components,components:r.components.flatMap(n=>n!=='British East Africa'?[n]:from<1976?['Seychelles (British colony)']:[])};
   note('Static imperial aggregate contains territories after independence and cannot represent the changing empire. It is not displayed. The Seychelles link is retained only through 1975; an independently attributed Mahé source component now covers 1973–1975.',[SURINAME_SOURCE,'https://mfa.gov.sc/history-of-the-department-2/'],'Неизменный сводный контур империи включает территории после их независимости, поэтому исключён из отрисовки. Связь с Сейшелами сохранена до 1975 года; контур Маэ за 1973–1975 годы отдельно восстановлен.');
  }
  const frenchLiberation='https://www.cheminsdememoire.gouv.fr/fr/revue/le-retour-la-republique',frenchAfrica='https://www.cheminsdememoire.gouv.fr/sites/default/files/2020-07/fiches%20tirailleurs%20africains%20complet%2011%2003%2020.pdf',frenchConstitution='https://www.vie-publique.fr/files/rapport/pdf/301916.pdf';
  const provisionalFrance='Provisional Government of the French Republic',provisionalGroup=`(${provisionalFrance})`;
  if(base.sourceIndex===12921){r={...r,sourceMemberOf:base.memberOf,memberOf:r.memberOf.filter(n=>n!=='(Vichy France)')};note('French Africa rallied to the Allied war effort after the North African campaign and joined the Algiers committee in 1943, not Vichy.',[frenchAfrica,'https://history.state.gov/historicaldocuments/frus1943v02/d104'],'После перехода французской Африки на сторону союзников в 1943 году её нельзя считать частью режима Виши.');}
  if(base.sourceIndex===12916){r={...r,geometryStatus:'rejected',sourceComponents:base.components,components:r.components.filter(n=>n!=='French Africa')};note('The aggregate contains French Africa after its rally to the Algiers committee. The source overlay is retained but cannot be drawn as Vichy territory.',[frenchAfrica],'Сводный контур включает французскую Африку после её перехода к союзникам; как территорию Виши его показывать нельзя.');}
  if(base.sourceIndex===12932){r={...r,sourceMemberOf:base.memberOf,memberOf:r.memberOf.map(n=>n==='(Vichy France)'?provisionalGroup:n)};note('The French Committee became the Provisional Government on 3 June 1944.',[frenchLiberation],'С 3 июня 1944 года Французский комитет национального освобождения стал Временным правительством Французской Республики.');}
  if(base.sourceIndex===12941){r={...r,name:provisionalGroup,nameRu:'Временное правительство Французской Республики (французская Африка)',nameStatus:'reviewed',entityId:identity('reviewed-composite','french-provisional-government')};note('The only component is French Africa, administered by the Algiers provisional government, not Vichy.',[frenchLiberation,frenchAfrica],'Единственная составляющая — французская Африка, находившаяся под управлением Временного правительства, а не Виши; контур не является полной картой Франции.');}
  if(base.sourceIndex===12910&&from>=1944){r={...r,sourceMemberOf:base.memberOf,memberOf:r.memberOf.filter(n=>n!=='(Vichy France)')};note('Decoux retained the colonial administration under Japanese pressure until the Japanese coup of 9 March 1945. This is not a continuing territorial union with the defunct Vichy regime, nor does the source extent prove uniform effective control.', ['https://www.cheminsdememoire.gouv.fr/fr/revue/1954-la-fin-de-lindochine-francaise-0','https://history.state.gov/historicaldocuments/frus1945v06/d173'],'Колониальная администрация Деку действовала под давлением Японии до переворота 9 марта 1945 года. Это не территориальный союз с прекратившим существование режимом Виши; исходный контур не подтверждает единый фактический контроль.');}
  if([12962,12969,12970].includes(base.sourceIndex)){
   if(base.sourceIndex===12962)r={...r,name:provisionalFrance,nameRu:'Временное правительство Французской Республики',nameStatus:'reviewed',entityId:identity('reviewed-polity','french-provisional-government')};
   if(base.sourceIndex===12970)r={...r,name:provisionalGroup,nameRu:'Временное правительство Французской Республики (сводный контур)',nameStatus:'reviewed',entityId:identity('reviewed-composite','french-provisional-government'),sourceComponents:base.components,components:r.components.map(n=>n==='French Fourth Republic'?provisionalFrance:n)};
   else r={...r,sourceMemberOf:base.memberOf,memberOf:r.memberOf.map(n=>n==='(French Fourth Republic)'?provisionalGroup:n)};
   note('The Fourth Republic constitution was promulgated on 27 October 1946. In 1945 the Provisional Government remained in power; the composite is a source aggregation, not proof of effective control in Indochina.',[frenchLiberation,frenchConstitution],'Конституция Четвёртой республики обнародована 27 октября 1946 года. В 1945 году действовало Временное правительство; сводный контур не доказывает фактический контроль над Индокитаем.');
  }
  if((base.sourceIndex===13129||base.sourceIndex===13137)&&from>=1954||[13172,13165].includes(base.sourceIndex)){
   const sources=['https://peacemaker.un.org/en/node/9753','https://history.state.gov/milestones/1953-1960/dien-bien-phu','https://www.cheminsdememoire.gouv.fr/fr/14-septembre-1956-les-francais-quittent-lindochine'];
   if(base.role==='composite')r={...r,sourceComponents:base.components,components:r.components.filter(n=>n!=='French Indochina')};
   else r={...r,sourceMemberOf:base.memberOf,memberOf:[],geometryStatus:'rejected'};
   note('The 1954 Geneva agreements ended the colonial territorial union; ongoing troop deployments did not constitute French sovereignty. The former colonial mainland outline is not retained as French territory.',sources,'Женевские соглашения 1954 года прекратили территориальное объединение колоний; остававшиеся французские воинские части не означают французский суверенитет. Прежний материковый контур не отображается как Франция.');
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
  if(britishComponent&&from>=1801){r={...r,sourceComponents:base.components,components:r.components.map(n=>n==='Kingdom of Great Britain'?ukName(from):n)};note('Updated historical component name in line with the 1801 union and 1927 title.',[UK_SOURCE])}
  if(base.role==='composite'&&base.sourceName==='(British Empire)'){
   if(from>=1905&&base.components.includes('British Gold Coast')){
    r={...r,sourceComponents:base.components,components:r.components.flatMap(n=>n!=='British Gold Coast'?[n]:from<1958?['British West African territories (Gold Coast and Nigeria)']:from<1960?['British Nigeria']:[])};
    note('Aligned the component label with the corrected Gold Coast/Nigeria source grouping; remove the link in the Nigerian independence year. Composite geometry remains unverified.',[SURINAME_SOURCE]);
   }
   if(from>=1961&&from<1969&&base.components.includes('British East Africa')){r={...r,sourceComponents:base.components,components:r.components.map(n=>n==='British East Africa'?'British African and Arabian possessions (source aggregate)':n)};note('Aligned the label with the corrected source aggregate; the composite geometry remains unverified.',[SURINAME_SOURCE]);}
  }
  if(base.role==='composite'&&base.sourceName==='(Kingdom of France)'&&from>=1763&&base.components.includes('New France')){r={...r,sourceComponents:base.components,components:r.components.map(n=>n==='New France'?(from<1791?'French colonial possessions (source aggregate)':'Saint Pierre and Miquelon'):n)};note('Aligned component labels with the surviving French colonial source records after the 1763 cessions; composite geometry remains unverified.',[FRENCH_CESSIONS]);}
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
  if(base.components.includes('British Cape Colony')&&from>=1797&&to<=1884){
   const names=[from<1808?capeTerritories.company.name:capeTerritories.sierra.name,...(from>=1811?[capeTerritories.seychelles.name]:[]),...(from>=1820?[capeTerritories.gambia.name]:[])];
   const components=r.components.filter(n=>!(from>=1803&&to<=1805&&n==='British Cape Colony'));
   r={...r,sourceComponents:base.components,components:[...new Set([...components,...names])]};
   note('Separate geographically distinct colonial administrations formerly hidden in the Cape source aggregate; their local boundaries remain approximate.',[capeSource,sierraSource,seychellesSource,gambiaSource],'Раздельно указаны колониальные администрации, ошибочно объединённые в исходной записи Капской колонии; местные границы остаются приблизительными.');
  }
  if(reasons.length)r={...r,review:{reason:reasons.join(' '),...(reasonsRu.length?{reasonRu:reasonsRu.join(' ')}:{}),sources:[...sources]}};
  // Avoid artificial splits where none of the corrections applied.
  const last=out.at(-1);if(last&&JSON.stringify({...last,from:0,to:0})===JSON.stringify({...r,from:0,to:0}))last.to=to;else out.push(r);
 }
 return out;
}
// Component selections are pinned to original feature/part indices. No modern
// geometry, coordinate interpolation or nearest-year geometry is introduced.
export function reviewedGeometryParts(r,derived=[]){
 if(r.sourceIndex===13265)return [{index:13265,part:0},...((r.from<1964?[0]:[0,1,2]).map(part=>({index:13271,part})))];
 if(r.sourceIndex===13271&&r.from<1964)return [1,2].map(part=>({index:13271,part}));
 const exclusions=exclusionsFor(r.sourceIndex,r.from,derived);
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

// Rare near-coincident edges in the generalized source can break the sweep
// algorithm. Retry on a documented sub-meter grid only for that partition.
export function partitionHistoricalGeometry(base,cuts){
  try{return polygonClipping.difference(base,...cuts);}
  catch(e){
    const snap=ps=>ps.map(p=>p.map(r=>r.map(([x,y])=>[Math.round(x*1e6)/1e6,Math.round(y*1e6)/1e6])));
    return polygonClipping.difference(snap(base),...cuts.map(snap));
  }
}

// Second pass over the remaining exact-component registry. Each row asserts
// contemporaneous, identical source coastlines before excluding a duplicate.
const colonialEvidence='https://github.com/Seshat-Global-History-Databank/cliopatria/tree/5f433377139a6eeaeacbdc894b70f8805b72c8b5';
const comoroTreaties='https://mjp.univ-perp.fr/constit/km1886.htm';
const comoroHistory='https://documents1.worldbank.org/curated/en/831811468771713041/pdf/multi0page.pdf';
const comoroTraditionalRegions='https://files.core.ac.uk/download/46813576.pdf';
const colonialNote='Одинаковая исходная геометрия колониального владения показана один раз; отдельная запись не означает независимость от метрополии.';
export const secondaryExactReviews=[
 [13590,13526,2014,2023,[0],[0],'Крым: международно признанная принадлежность Украине; с 2014 года фактический контроль России. Карта правового статуса не отображает отдельную линию военного контроля.','https://digitallibrary.un.org/record/767883'],
 [13277,13325,1973,1973,[18],[0],'Гвинея-Бисау провозгласила независимость в 1973 году; признание Португалией последовало в сентябре 1974 года. Контур не реконструирует фронт войны.','https://digitallibrary.un.org/record/447673/files/A_10207_S_11811-EN.pdf'],
 [13262,13299,1967,1968,[27],[0],'Антигуа получила статус ассоциированного с Великобританией государства в 1967 году; независимость Антигуа и Барбуды — 1981 год.','https://www.legislation.gov.uk/ukpga/1967/4'],
 [13232,13271,1963,1963,[8,9],[1,2],'Занзибар получил независимость 10 декабря 1963 года; объединение с Танганьикой произошло в 1964 году.',TANZANIA_UN],
 [13019,13142,1953,1953,[49],[2],'Острова Амами возвращены под управление Японии в декабре 1953 года.',RYUKYU],
 [13019,13062,1948,1948,[29,33],[0,1],'Республика Корея образована в августе 1948 года; признана США 1 января 1949 года.','https://history.state.gov/countries/korea-south'],
 [11633,11746,1864,1864,[9,13,11,10],[0,4,3,1],'Ионические острова переданы Греции в 1864 году.','https://api.parliament.uk/historic-hansard/commons/1902/dec/11/british-cemeteries-in-the-ionian-states'],
 [12130,12174,1898,1899,[0],[0],'Критское государство с 1898 года — автономия под османским сюзеренитетом, не полная независимость.','https://www.crete.gov.gr/chronologio-periodoy/'],
 [10408,10552,1800,1802,[2,19,14,15,10,8,26,24,1,5,9,23,16,17,25,7,22,6,12,20,21,11,4,3,18],[2,18,13,14,10,8,25,23,1,5,9,22,15,16,24,7,21,6,12,19,20,11,4,3,17],colonialNote,colonialEvidence],
 [7641,7690,1502,1506,[18,10,3,4,2,5,12,1,11,0,15,13,14],[16,9,5,6,3,7,11,2,10,1,4,12,13],colonialNote,colonialEvidence],
 [8229,8258,1564,1571,[5,15,2,12,18,3,8,4,10,7,6,14,13,17,9,11,16],[4,14,1,11,16,2,7,3,9,6,5,13,12,15,8,10,0],colonialNote,colonialEvidence],
 ...[[10326,1791,1791],[10351,1792,1793]].map(([target,from,to])=>[9759,target,from,to,[1,7,10,6,0,8,9],[11,14,17,13,10,15,16],colonialNote,colonialEvidence]),
 ...[[10386,1794,1795,7,6],[10427,1796,1796,7,6],[10477,1797,1798,11,10],[10487,1799,1799,14,13],[10557,1800,1802,1,0],[10566,1803,1804,1,0],[10656,1805,1805,7,6],[10668,1806,1806,7,6],[10719,1807,1808,6,5],[10778,1809,1810,10,9]].map(([target,from,to,a,b])=>[9759,target,from,to,[1,0],[a,b],colonialNote,colonialEvidence]),
 [11329,11399,1843,1845,[1],[8],'Франция вступила во владение Майоттой 13 июня 1843 года; остров включён в колонию Нуси-Бе и зависимые территории.',comoroTreaties],
];
export const earlyComorosRoutes=[[9189,4,1677,1720],[9631,2,1721,1726],[9660,2,1727,1740],[9759,2,1741,1814],[11008,0,1815,1819],[11071,1,1820,1839],[11329,1,1840,1841]];
// Review the remaining exact overlaps as a fixed queue. A dependency or
// occupation is a historical relationship, not a second independent polygon.
const manxSource='https://manxnationalheritage.im/wp-content/uploads/2020/01/Vikings-in-Mann-Teachers-Guide.pdf';
const manxNote='Мэн и острова — отдельное морское королевство в орбите Норвегии. Связь с норвежской короной не означает постоянное прямое управление из Норвегии; Магнус Босоногий временно подчинил королевство.';
const rusSource='https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CK%5CY%5CKyivanRushDA.htm';
const rusNote='В составе и при распаде древнерусского государства существовали отдельные княжества. Общая династическая связь не означает двойной суверенитет; совпавшая ячейка исходной сетки принадлежит локальной записи, её точная внешняя граница не подтверждена.';
const genoaSource='https://www.treccani.it/enciclopedia/genova_%28Enciclopedia-machiavelliana%29/';
const genoaNote='Местная генуэзская запись сохраняется: господство французских и миланских правителей было переменным. Дубликат не изображается как ещё одно географическое владение; точные линии смены контроля не восстановлены.';
const pacificSource='https://www.awm.gov.au/learn/schools/sww/pacific';
const pacificNote='Политическая принадлежность показана отдельно от японской военной оккупации в 1942–1945 годах. Источник подтверждает театр военных действий, но не одновременный контроль каждого острова на протяжении всего года.';
const philippineSource='https://ncca.gov.ph/about-ncca-3/subcommissions/subcommission-on-cultural-heritagesch/historical-research/politico-diplomatic-history-of-the-philippines/';
const philippineNote='Местное политическое образование и династические/торговые связи с Брунеем показаны раздельно. Влияние Брунея не означает прямого управления всеми его союзниками; исходный контур не является точной исторической съёмкой.';
const dutchNote='Британское управление Нидерландской Ост-Индией в переходный период после захвата Явы в 1811 году не образует вторую независимую политическую территорию. Сохранён контур конкретной колонии, не предполагающий одинакового фактического контроля над всеми островами.';
const dutchSource='https://emuseum.aberdeencity.gov.uk/objects/85179/mountbatten-medallic-history-of-great-britain-and-the-sea-medal';
const rusRoutes=[[5405,1216,1219,1],[5357,1210,1215,1],[5333,1206,1209,1],[5219,1202,1205,1],[5182,1192,1201,1],[4448,1056,1191,1],[4692,1094,1125,5],[4605,1072,1093,5],[4511,1056,1084,3],[4466,1056,1071,5]];
const genoaRoutes=[[7933,1521,1525,2],[7893,1519,1520,2],[7829,1516,1518,2],[7808,1512,1515,2],[7755,1507,1511,3],[7701,1502,1506,4],[7643,1497,1501,2],[7622,1492,1496,1],[7388,1463,1481,1]];
export const thirdExactReviews=[
 [12956,12888,1945,1945,[122,113,105,120,104,121,111,114,124],[45,77,66,80,64,81,75,78,47],pacificNote,pacificSource],
 [12923,12888,1944,1944,[129,135,31,126,118,133,117,134,32,131,33,124,127,138,136],[79,45,50,77,66,80,64,81,51,43,52,75,78,47,46],pacificNote,pacificSource],
 [12904,12888,1943,1943,[147,154,149,111,26,145,137,152,136,153,142,27,150,151,139,28,143,146,141,148,156,155,144],[79,45,41,44,50,77,66,80,64,81,74,51,42,43,69,52,75,78,72,40,47,46,76],pacificNote,pacificSource],
 [12956,12910,1945,1945,[28],[2],'Японская оккупация Индокитая в 1945 году не была передачей суверенитета Японии; в течение года менялся политический статус и фактическое управление.','https://history.state.gov/historicaldocuments/frus1945v06/d170'],
 [12852,12765,1940,1940,[35,34,69,70],[2,1,8,9],'Норвегия оккупирована Германией с апреля 1940 года; законное правительство продолжало деятельность в изгнании. Это не аннексия территории Германии.','https://www.regjeringen.no/en/the-government/previous-governments/regjeringer-siden-1814/historiske-regjeringer/norways-governments-1940-1945/johan-nygaardsvolds-government/id438691/'],
 [12295,12345,1913,1913,[72,73],[8,9],colonialNote,colonialEvidence],
 [10869,10882,1814,1814,[1,0,3],[2,0,3],'Восточноафриканские владения оманского султана представлены отдельной региональной записью; это не независимая от Омана территория.','https://whc.unesco.org/uploads/nominations/1055.pdf'],
 [10855,10767,1812,1813,[67,75,69,70,84,80,87,83,34,82,71,73,85,36,78,79,88,76,66,77,86,72,68,74],[2,22,16,17,29,7,31,28,1,27,18,20,30,6,25,5,10,23,0,24,9,19,3,21],dutchNote,dutchSource],
 [10840,10767,1811,1811,[65,73,67,68,81,77,84,80,33,79,69,71,82,35,76,34,85,74,64,75,83,70,66,72],[2,22,16,17,29,7,31,28,1,27,18,20,30,6,25,5,10,23,0,24,9,19,3,21],dutchNote,dutchSource],
 [10780,10978,1816,1816,[2],[9],'Остров Банка перешёл к британцам по договору 1812 года, затем к нидерландцам в ходе возврата колоний в 1816 году.','https://searcharchives.bl.uk/catalog/040-003377793'],
 [10780,10855,1812,1812,[1,2],[37,39],'Банка и Белитунг уступлены британцам по соглашению от 17 мая 1812 года.','https://geologi.esdm.go.id/storage/publikasi/UpSPbHG8i7VYakTV7JEn4Obk70FowYWUM1YQ9.pdf'],
 [7792,8003,1529,1581,[5,3],[2,0],philippineNote,philippineSource],
 [7792,7947,1526,1571,[9],[0],philippineNote,philippineSource],
 [7792,7906,1521,1525,[9],[0],philippineNote,philippineSource],
 ...genoaRoutes.map(([source,from,to,part])=>[source,7268,from,to,[part],[5],genoaNote,genoaSource]),
 [7338,7268,1459,1462,[2,3],[5,6],genoaNote,genoaSource],
 [7268,7462,1475,1475,[12,13],[7,8],'В 1475 году османское завоевание прекратило генуэзское управление соответствующими черноморскими колониями.',genoaSource],
 [6608,6741,1395,1401,[2],[2],'После воссоединения владений Джучидов Токтамышем отдельная запись Синей Орды не означает вторую суверенную территорию. После поражения 1395 года фактический контроль был изменчив.','https://www.cambridge.org/core/services/aop-cambridge-core/content/view/AEB03260F727D9147A9043682A24804B/S1356186324000269a.pdf/between_the_chinggisid_principle_loyalty_and_selfaggrandisement_jochid_elites_in_the_time_of_troubles_1359_to_circa_1380.pdf'],
 [6608,6711,1385,1394,[2],[2],'Токтамыш объединил владения Джучидов; дублирующее обозначение Синей Орды не означает второе государство на этой территории.','https://eurasian-research.org/wp-content/uploads/2020/10/Saryarka-and-the-Golden-Horde.pdf'],
 [6392,6133,1346,1346,[12],[0],'Хиос перешёл под генуэзское управление в 1346 году.','https://www.chios.gr/en/afieromata/mesaioniki-chios'],
 ...rusRoutes.map(([target,from,to,part])=>[4369,target,from,to,[part],[1],rusNote,rusSource]),
 [4529,5062,1177,1187,[6,8,0],[1,2,0],manxNote,manxSource],
 [4529,5024,1169,1176,[6,8,0],[1,2,0],manxNote,manxSource],
 [4529,4703,1094,1168,[6,5,2,7,4,8,1,3,0],[7,6,3,8,5,9,2,4,1],manxNote,manxSource],
 [4529,4658,1085,1093,[6,5,2,7,4,8,1,3,0],[6,5,2,7,4,8,1,3,0],manxNote,manxSource],
 [4586,4694,1094,1098,[2],[0],'Мальта после похода Рожера I в 1091 году признавала норманнский сюзеренитет; местное мусульманское население и администрация сохранялись.','https://malteselivingabroad.gov.mt/wp-content/uploads/2023/03/NEWS275.pdf'],
 [4863,4640,1139,1146,[1],[0],'В XII веке на Корсике преобладало пизанское влияние; имперские притязания не создают отдельного контура над тем же островом.','https://italica.cultura.gov.it/percorsi/p/g9ucoyi26da7852pr05n26tm'],
 [4539,4640,1085,1093,[1],[0],'Пизанское влияние на Корсике представлено отдельно от имперской принадлежности; это не два независимых острова.','https://italica.cultura.gov.it/percorsi/p/g9ucoyi26da7852pr05n26tm'],
 [3376,3404,884,885,[18],[0],'Кипр в период византийско-арабского соперничества имел особый режим; местная запись кондоминиума не означает независимое государство или точную линию раздела.','https://www.culture.gov.cy/dmculture/DA/DA.nsf/DMLchtable_en/DMLchtable_en?OpenDocument=&print='],
 [6591,6715,1385,1394,[1],[0],'Дубровницкая республика после 1358 года самостоятельно управлялась под покровительством венгерской короны; дублирующая её контур сербская запись не подтверждает сербский суверенитет.','https://hrcak.srce.hr/en/file/98050'],
 [6041,5885,1298,1304,[2,3],[0,1],'Мальорка в этот период сохраняла отдельное королевство; принадлежность к арагонской династической сфере не превращает её в два независимых государства.','https://www.caib.es/pidip2front/ficha_convocatoria.xhtml?lang=es&urlSemantica=8818060'],
 [4310,4203,1034,1035,[6,5,9,8],[17,16,15,14],'Кнут владел норвежской короной; в 1035 году Норвегия перешла к Магнусу. Сохраняется местное королевство, а не дублирующий контур объединения корон.','https://www.english-heritage.org.uk/learn/histories/1066-and-the-norman-conquest/northern-battles-1066/'],
 [4257,4203,1028,1033,[6,5,9,8],[17,16,15,14],'Владение Кнутом норвежской короной было частью объединения корон Англии, Дании и Норвегии; сохраняется отдельная запись Норвегии.','https://www.english-heritage.org.uk/learn/histories/1066-and-the-norman-conquest/northern-battles-1066/'],
 [3926,3869,962,969,[0,1],[0,2],'В 962 году Оттон I объединил итальянскую корону с императорской; местное Итальянское королевство не является вторым независимым сувереном.','https://www.treccani.it/enciclopedia/il-regno-italico_%28Storia-della-civilta-Europea%29/'],
 [3901,3869,961,961,[0,1],[0,2],'В 961 году Оттон I вернулся в Италию и получил итальянскую корону; личная уния корон не делает одинаковые контуры двумя территориями.','https://www.treccani.it/enciclopedia/la-dinastia-sassone-e-il-sacro-romano-impero_%28Storia-della-civilt%C3%A0-europea-a-cura-di-Umberto-Eco%29/'],
 [10342,10328,1792,1793,[0,3,1,2],[0,4,1,2],'Нгуен Ань занял Сайгон в 1788 году, сделал Зядинь своей столицей и опорой для борьбы с Тэйшонами. Это не утверждение о точной линии фронта.','https://baotanglichsu.vn/VI/Articles/3091/7512/ngam-cac-thanh-co-viet-nam-tu-tren-cao-phan-1.html'],
 [9564,9740,1738,1740,[5],[0],'Бахрейн был занят войсками Надир-шаха в 1736 году; отдельный оманский контур на том же острове не соответствует этому переходу.','https://www.iranicaonline.org/articles/navy-i-nader-shah/'],
 [7853,7200,1519,1519,[6],[1],'Экспедиция Кортеса высадилась на Косумеле в 1519 году; местный правитель Нахум Пат оставался у власти и встретил экспедицию Монтехо в 1527 году. Высадка не равнозначна постоянной аннексии.','https://mexicograndezaydiversidad.inah.gob.mx/images/fasciculos/MexicoGrandezaDiversidad_F-08.pdf'],
 [1048,943,-48,-47,[16],[1],'В 48–47 гг. до н. э. Кипр в ходе Александрийской войны был возвращён Египту; дата перехода в течение этого периода не установлена с точностью до дня.','https://publications.gov.cy/assets/user/publications/CyprusAlwaysEurope/Cyprus_has_always_been_Europe_ENEL.pdf'],
 ];
// Last exact-overlap pass: retain the more specific political record when
// evidence supports it. These decisions do not certify the imported borders.
export const fourthExactReviews=[
 [10852,10794,1812,1813,[12],[1],'Рюген оставался частью Шведской Померании до передачи Пруссии в 1815 году. Французское военное присутствие в 1812–1813 гг. не означало аннексии.','https://www.greifswald.de/de/urlaub-kultur/stadtgeschichte-persoenlichkeiten/stadtgeschichte/schwedenzeit/index.html'],
 [7335,6859,1459,1474,[1,2],[5,6],'Региональная историография Банки и Белитунга относит эти острова к периоду Шривиджаи и Маджапахита до 1475 г.; султанатская эпоха выделяется отдельно. Точные пределы власти не подтверждены.','https://disparbudkepora.babelprov.go.id/sites/default/files/dokumen/bank_data/Historiografi%20Bangka%20Belitung%20%281%29.pdf'],
 [6859,7336,1459,1474,[13],[0],'После падения раннего Сингапура его правитель основал Малаккский султанат; Сингапур стал частью этого султаната. Прежнее яванское влияние не означает продолжающейся прямой власти Маджапахита.','https://www.roots.gov.sg/stories-landing/stories/a-game-of-thrones/a-game-of-thrones'],
 [7187,7268,1453,1453,[1],[1],'Дорино I Гаттилузио ещё до 1453 года получил Лемнос как феод; после падения Константинополя власть династии подтверждена султаном за дань. Генуэзская династическая запись не означает прямого управления республикой из Генуи.','https://isamveri.org/pdfdkm/12/DKM120184.pdf'],
 [6167,6346,1344,1346,[0],[0],'Эдуард III пожаловал остров Мэн Уильяму Монтегю в 1333 году; его сын наследовал владение в 1344 году. Шотландские притязания сохранялись, но не равнозначны второму прямому владению.','https://radar.brookes.ac.uk/radar/file/b86ba867-c96b-c287-3466-2d5a5c1b92f2/1/edge1997manx.pdf'],
 [6233,6167,1326,1328,[5],[0],'Мэн после возвращения под власть шотландских правителей в 1310-е гг. оставался предметом англо-шотландских притязаний. В 1328 году английская сторона обязалась не содействовать лишению шотландцев острова; точная дата смены контроля не установлена.','https://www.isle-of-man.com/manxnotebook/fulltext/hist1900/ch17.htm'],
 [5983,5356,1296,1304,[2],[1],'Сирос вошёл в герцогство Архипелага в 1207 году; данные о византийском возврате отдельных Киклад не подтверждают одновременную прямую власть Византии над Сиросом.','https://www.ime.gr/chronos/projects/fragokratia/en/webpages/aegean_gen.html'],
 [5909,5356,1279,1280,[1],[1],'Сирос был завоёван венецианцами в 1207 году; греческая служба древностей относит последующие века к периоду латинского управления.','https://cyclades.culture.gov.gr/en/location/byzantine-syros/'],
 [5457,5198,1220,1226,[5],[0],'Бонифачо с конца XII века являлся генуэзским укреплённым поселением; французская запись того же участка не подтверждается. Размер исходного округа остаётся приблизительным.','https://bonifacio.co.uk/discover/bonifacio-town-of-art-and-history/bonifacio-citadel/'],
 [2797,2858,763,767,[4],[0],'С 763 года Неаполь управлялся автономным герцогом Стефаном, сохраняя связи с византийским миром; местная юрисдикция не является второй копией имперского контура.','https://whc.unesco.org/document/154119'],
 [2238,2298,626,632,[0],[1],'Беда сообщает о подчинении Эдвином Меванских островов (Мэна и Англси). Это свидетельство верховенства, не доказательство прямого административного управления или точного года перехода.','https://orca.cardiff.ac.uk/id/eprint/161165/1/Guy%20-%20Manaw%20of%20the%20Britons.pdf'],
 [510,503,-315,-314,[4,0,8,6,3,9,1,7,5,13,12],[4,1,10,6,3,12,2,7,5,17,15],'В 315 г. до н. э. Антигон объявил свободу и автономию греческих городов; война диадохов и гарнизоны продолжались. Сохранён сводный контур греческих общин, а не вторая копия единой Македонской державы; это не подтверждение независимости каждого полиса.','https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Diodorus_Siculus/19C%2A.html'],
 [510,503,-313,-308,[4,0,8,6,3,9,1,7,5,13],[4,1,10,6,3,12,2,7,5,17],'В ходе войн диадохов менялись гарнизоны и союзы греческих полисов; мир 311 г. до н. э. признавал их автономию. Сохранён сводный контур общин, не утверждение об их полной независимости или непрерывной власти одного правителя.','https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Diodorus_Siculus/19F%2A.html'],
 [180,187,-700,-676,[4],[1],'Гадир и другие финикийские поселения южной Иберии образовывали колониальную сеть, связанную с Тиром. Местная колониальная запись сохранена вместо дублирующей метрополии; площадь исходного контура не является доказанной границей колонии.','https://turismo.cadiz.es/es/node/17545'],
];
// Keep the original island outline and distinguish the dated change of control
// from unsupported attribution of a neighbouring island.
export const fifthExactReviews=[
 [1083,1052,-31,-31,[9],[1],'Лемнос возвращён Афинам в 166 г. до н. э.; монеты раннего Августова периода и афинские декреты после Акция подтверждают сохранение афинских клерухий при римском верховенстве. Сохранена запись греческих общин, а не птолемеевская атрибуция.','https://www.corpus-nummorum.eu/en/typology/38'],
 [830,809,-202,-202,[11],[5],'Самос сохранялся военно-морской базой Птолемеев до захвата Филиппом V в 201 г. до н. э. Поэтому в 202 г. оставлен птолемеевский контур; соседняя Икария рассматривается независимо.','https://doi.org/10.1371/journal.pone.0193786.s002'],
 [809,830,-201,-198,[5],[11],'Филипп V захватил Самос в 201 г. до н. э.; Птолемеи вернули остров приблизительно в 197 г. до н. э. На годовой карте 201 год отмечает переход власти; захват Самоса не доказывает захват Икарии.','https://doi.org/10.1371/journal.pone.0193786.s002'],
 [692,665,-230,-226,[9],[2],'Археологический музей Самофракии относит переход острова под контроль Птолемеев ко второй половине III века до н. э. и захват Филиппом V к 200/199 гг. до н. э. Сохранена птолемеевская атрибуция острова, без утверждения об отмене местного самоуправления.','https://www.samothracemuseum.gr/en/timeline-of-samothrace/'],
 [701,665,-225,-219,[10],[2],'Самофракия находилась в птолемеевской сфере до захвата Филиппом V в 200/199 гг. до н. э.; местные декреты в честь птолемеевских должностных лиц свидетельствуют о взаимодействии с островной общиной. Это не доказательство прямого управления каждым поселением.','https://www.samothracemuseum.gr/en/timeline-of-samothrace/'],
];
export const sixthExactReviews=[
 [815,808,-203,-203,[12],[13],'Кизик сохранял собственные городские институты и выступил на стороне Родоса против Филиппа V в войне 202–201 гг. до н. э. Сохранён контур местной греческой общины в 203 г. до н. э.; его точные сухопутные границы не подтверждены.','https://repository.ukim.mk/bitstream/20.500.12188/791/1/Comfortably_Sunk_Philip_the_Battle_of_Ch.pdf'],
 [1083,1052,-31,-31,[2],[0],'Декрет IG XII.5.653 свидетельствует о собственных совете и народном собрании Сироса во II–I вв. до н. э.; городская община продолжала существовать при римском влиянии. В 31 г. до н. э. сохранён контур местной общины, а не неподтверждённая птолемеевская атрибуция. Точный провинциальный статус не установлен.','https://attalus.org/docs/other/inscr_201.html'],
];
// Hypothesis-based cartographic choices are tracked separately from established
// chronological attributions; the source is explicitly tentative.
export const provisionalExactReviews=[
 [2436,2453,644,646,[11],[2],'Эльба: вероятная лангобардская принадлежность после завоеваний Ротари в 643–644 гг. Это рабочая реконструкция, а не установленная дата аннексии острова. Археологическое исследование прямо обозначает датировку присоединения как гипотезу.','https://www.academia.edu/59443324/UN_FILO_CHE_CI_LEGA_STORIE_DI_POPULONIA_E_DELL_ISOLA_D_ELBA_TRA_L_ANTICHIT%C3%80_CLASSICA_E_L_ALTO_MEDIOEVO',['https://www.treccani.it/enciclopedia/elba/','https://www.academia.edu/35105672/Catia_Renzi_Rizzo_Pisa_Lucca_i_Longobardi_e_il_mare_secoli_VII_VIII']],
];
// Both exact claims are demonstrably conflicting, but the literature does not
// establish a unique owner of the whole footprint for each year. Preserve both
// source records as evidence, render one explicitly uncertain region instead.
export const exactConflictPendingReviews=[
 [9854,10012,1768,1768,[0],[0],'Корсика — переход 1768 года','Генуя уступила права Франции по Версальскому договору 15 мая 1768 г.; республика Паоли сопротивлялась до поражения в 1769 г. К концу августа французы заняли Кап-Корс, а в ноябре потребовали сдачи оружия у его жителей. Северная часть полуострова восстановлена отдельно; остальной остров остаётся областью неуточнённого контроля.','https://www.isula.corsica/linguacorsa/Approche-historique-geographique-et-economique-de-la-Corse_a78.html',['https://www.academia.edu/40638823/R_O_C_C_H_E_Revue_On_Line_Cap_Corse_Historique_vol_6_2019','https://www.servicehistorique.sga.defense.gouv.fr/en/node/1151057']],
 [9047,9089,1662,1664,[0],[0],'Золотой Берег — область восточнее Кейп-Коста','Исходный контур находится восточнее замка Кейп-Коста и включает район Мори. Договор Вест-Индской компании с правителем и старейшинами Асебу от 21 марта 1657 г. касается береговой полосы у форта Нассау, а не всей прилегающей территории. Здесь сохранялись местные африканские владения Асебу, Фету и Фанте; датская и шведская заливки не подтверждают суверенитет над всем контуром.','https://mass.cultureelerfgoed.nl/fort-nassau',['https://dokumen.pub/trade-and-politics-on-the-gold-coast-1600-1720-a-study-of-the-african-reaction-to-european-trade-9780198216537.html','https://books.openedition.org/ifra/pdf/3775']],
 [7908,8183,1552,1555,[1],[16],'Маскат — португальско-османское соперничество','В 1552 году Пири-реис захватил Маскат и продолжил поход к Ормузу; после его ухода португальцы вновь заняли Маскат. Архивные свидетельства описывают военно-морскую борьбу и контроль портов, но не подтверждают политическую границу всей полосы побережья.','https://www.sabrizain.org/malaya/library/portrecords.pdf'],
 [7955,8030,1534,1539,[0],[6],'Южный Пьемонт — спорные владения','Контур включает Бра и Кераско, но не Альбу и Асти. Бра вновь занят французами в 1536 г. Кераско юридически передан Беатрисе Португальской в 1531 г.; имперский гарнизон сохранялся, а в 1537 г. город пережил французское нападение и возвращение под имперский контроль. Нельзя распространить власть над одним городом на всю область.','https://www.treccani.it/enciclopedia/piemonte_%28Enciclopedia-Italiana%29/',['https://municipium-images-production.s3-eu-west-1.amazonaws.com/s3/874/allegati/archivio-storico.pdf','https://cherascocultura.it/quando-cherasco-divento-sabauda/','https://archiviodistatotorino.beniculturali.it/inventari/?id=313532','https://www.cherasco1547.org/public/pdf/20190620153420_Gli_Ebrei_di_Cherasco.pdf']],
 [7955,8016,1529,1533,[0],[4],'Южный Пьемонт — спорные владения','Контур включает Бра и Кераско, но не Альбу и Асти. В Бра после 1525 г. изменился военный контроль; в 1531 г. Кераско принёс присягу Беатрисе Португальской, супруге герцога Савойского, при сохранявшемся имперском гарнизоне. Правовой титул и военное присутствие следует различать.','https://archiviodistatotorino.beniculturali.it/inventari/?id=313532',['https://municipium-images-production.s3-eu-west-1.amazonaws.com/s3/874/allegati/archivio-storico.pdf','https://cherascocultura.it/quando-cherasco-divento-sabauda/','https://www.cherasco1547.org/public/pdf/20190620153420_Gli_Ebrei_di_Cherasco.pdf']],
 [1986,2144,577,578,[2,3],[0,1],'Южная Аравия — аксумско-сасанидский переход','В 570-е годы эфиопское правление в Йемене было оспорено местной династией и персидскими войсками; источники расходятся в датировке смены власти. Нельзя представлять весь южноаравийский контур как два одновременно установленных царства.','https://www.iranicaonline.org/articles/abna-term/'],
 [1620,1661,410,442,[2,3],[1,2],'Хорезм — кидариты и эфталиты','Два совпадающих четырёхугольника расположены в Кызылкуме к востоку от нижней Амударьи (62,30–62,46° в. д., 41,26–41,40° с. ш.), а не в районе столицы Кята. Их форма — ячейки исходной цифровой сетки, не свидетельство исторического межевания. Хорезм имел собственную династию шахов, а источники о кидаритах и эфталитах описывают прежде всего Тохаристан и соседние области. Атрибуция именно этих участков не подтверждена.','https://www.iranicaonline.org/articles/central-asia-iii/',['https://www.iranicaonline.org/articles/kidarites/','https://unora.unior.it/retrieve/afc3b506-f504-457d-ae93-bc970eb031ae/Michele%20Minardi%20The%20Oxus%20Route%20ACSS%2024_1-2-compressed.pdf','https://www.history-museum.uz/site/exposition/30']],
 [809,830,-202,-198,[4],[10],'Икария — война Филиппа V','Икария была связана с птолемеевской системой восточной Эгеиды в III веке до н. э.; даты перехода под власть Самоса остаются спорными. Захват Самоса в 201 г. до н. э. не доказывает захвата Икарии.','https://www.tandfonline.com/doi/full/10.1080/09518967.2024.2319521'],
];
export const exactConflictGroupPrefix='Неуточнённая принадлежность: ';
export const earlyComorosHashes=['5e8c3940ad185cbe4cf1af0d7f420aeaaa9bead9e850dd11ecbb7a72f850de2a','ca0861672c2aec6d4ea750a6f663d4b43e5be11e371c321ed69e8c520313b233','8f31d16f944b3cefe048b3146bf73aea4320e11e4b0dcabb74b7fe8d1886569c','cf8a539df8f350003fa8d49a17d63e1c36f9ff5f3a21c912e39b611680012904'];
// Elba: approximate manual transcription of the three jurisdictions in the
// regional historical atlas, section 8.19, printed p.114; the map is not a
// georeferenced cadastral survey. Bagnaia and the Felciaio boundary are anchors.
// Only the coastline is modern (Natural Earth); no modern municipal borders.
export const elba1797Partition={
 source:9986,part:2,from:1797,to:1798,
 sources:['https://www.consiglio.regione.toscana.it/upload/eda/pubblicazioni/vol2.pdf','https://www.rmg.co.uk/collections/objects/rmgc-object-540400','https://www.comune.rio.li.it/vivere-il-comune/luoghi/localita-bagnaia/','https://www.consiglio.regione.toscana.it/upload/eda/pubblicazioni/pub4072.pdf',independentIslands.source.url],
 outline:[[[10.44337,42.845445],[10.436046,42.838121],[10.431163,42.827867],[10.430675,42.816148],[10.436697,42.804429],[10.430024,42.787584],[10.420258,42.776435],[10.406912,42.768988],[10.388845,42.763495],[10.40797,42.75727],[10.425141,42.74079],[10.430675,42.722113],[10.415538,42.708889],[10.410981,42.717963],[10.403331,42.718899],[10.39324,42.718207],[10.381358,42.722561],[10.377289,42.727973],[10.367198,42.745998],[10.364268,42.749823],[10.351248,42.755683],[10.337901,42.764838],[10.325043,42.764838],[10.313731,42.742987],[10.304535,42.759752],[10.265391,42.744574],[10.245372,42.75727],[10.240001,42.741889],[10.235199,42.735907],[10.229666,42.735419],[10.147227,42.737291],[10.124848,42.743109],[10.106781,42.757392],[10.10141,42.784003],[10.111664,42.801256],[10.132986,42.811916],[10.158214,42.817288],[10.179535,42.818752],[10.189952,42.816881],[10.212169,42.807847],[10.224376,42.804429],[10.242198,42.803168],[10.26588,42.804429],[10.264903,42.809394],[10.264334,42.810452],[10.262706,42.810248],[10.259044,42.811916],[10.272146,42.818752],[10.272146,42.826239],[10.272146,42.827338],[10.289317,42.825629],[10.326834,42.826239],[10.322113,42.811713],[10.332774,42.805976],[10.347341,42.805854],[10.354666,42.808173],[10.358084,42.817532],[10.365977,42.822943],[10.374766,42.827094],[10.381358,42.832424],[10.3921,42.857978],[10.399913,42.868842],[10.412364,42.873358],[10.422048,42.870836],[10.431,42.864447],[10.438487,42.855455],[10.44337,42.845445]]],
 // Digitized generalized separation from the published diagram: Tuscany
 // encloses Portoferraio, the Presidi enclose Porto Longone and Fort Focardo.
 masks:[[[[10.26,42.86],[10.26,42.819],[10.267,42.8],[10.292,42.79],[10.31,42.788],[10.316,42.774],[10.334,42.766],[10.345,42.75],[10.355,42.757],[10.356,42.775],[10.35,42.79],[10.364,42.81],[10.365,42.86],[10.26,42.86]]],
 [[[10.365,42.78],[10.376,42.791],[10.40,42.792],[10.415,42.782],[10.46,42.78],[10.46,42.736],[10.410,42.736],[10.398,42.749],[10.378,42.758],[10.365,42.77],[10.365,42.78]]]],
 areas:[['elba-tuscany-1797','Portoferraio (Grand Duchy of Tuscany)','Портоферрайо (Великое герцогство Тосканское)'],['elba-naples-1797','Porto Longone (Kingdom of Naples)','Порто-Лонгоне (Неаполитанское королевство)'],['elba-piombino-1797','Elba (Principality of Piombino)','Эльба (Княжество Пьомбино)']]
};
export function buildElbaPartition(){
 const {outline,masks}=elba1797Partition;
 const areas=masks.map(mask=>polygonClipping.intersection(outline,mask));
 assert.equal(polygonClipping.intersection(...areas).length,0);
 areas.push(polygonClipping.difference(outline,...masks));
 assert.ok(areas.every(a=>a.length));
 return areas.map(coordinates=>({type:'MultiPolygon',coordinates}));
}

// A confirmed interior fragment is not a reconstructed political frontier.
// The cut is deliberately north of the southern boundary of the Cap Corse
// jurisdiction on the 1770 map (Dal Passo, fig. 2). The years of the siege
// and local realignment (1761–64) remain unassigned (Macinaggio held out
// until March 1765), as does the rest of Corsica.
export const corsicaCore={
 id:'cap-corse',
 part:0,hash:'c6112dfe98f227b48dbd7df302405c9bd2abbe65204887ced3463de80aa1ac44',
 mask:[[[8.9,42.83],[9.6,42.83],[9.6,43.1],[8.9,43.1],[8.9,42.83]]],
 sources:[
 'https://www.stmoderna.it/uploads/pubblicazioni/870/2.LACORSICAXVIIISECOLO-FabrizioDalPasso.pdf',
 'https://www.persee.fr/doc/ahrf_0003-4436_1974_num_218_1_4183',
 'https://www.academia.edu/40638823/R_O_C_C_H_E_Revue_On_Line_Cap_Corse_Historique_vol_6_2019',
 'https://bureaudumercure.org/mercure/sites/default/files/webform/digital_copy/1044809/1764%2C%2001%2C%20vol.%201.pdf',
 ],
 periods:[
 {source:9854,from:1757,to:1760,entity:'cap-corse-genoa',name:'Cap Corse (Genoese control, documented core)',nameRu:'Кап-Корс — генуэзское управление (подтверждённая область)'},
 {source:10012,from:1765,to:1767,entity:'cap-corse-paoli',name:'Cap Corse (Corsican Republic, documented core)',nameRu:'Кап-Корс — Корсиканская республика (подтверждённая область)'},
 {source:10012,from:1768,to:1768,entity:'cap-corse-france',name:'Cap Corse (French control, documented core)',nameRu:'Кап-Корс — французское управление (подтверждённая область)'},
 ]
};
// The very small summit core is inside the old fortified town: the surviving
// Church of Our Lady of the Mount anchors it, and the Portuguese gate lies
// outside this conservative cut. The 2009 study's fig. 5 depicts a wider
// late-Dutch enclosure, NOT the 1641 frontier. Schouten's 1641 report
// independently documents the capture and the fort's hilltop interior.
export const malaccaCore={
 id:'malacca-fort',
 hash:'863c6273c2e50d9d3fdb251fb1ac5c8af5def763839bc464af335a1af8dc4323',
 mask:[[[102.24915,2.19225],[102.25005,2.19225],[102.25005,2.193],[102.24915,2.193],[102.24915,2.19225]]],
 sources:[
 'https://repo.uum.edu.my/id/eprint/13538/1/PID226.pdf',
 'https://www.dbnl.org/tekst/_ber002185901_01/_ber002185901_01_0004.php',
 'https://hpip.org/en/heritage/details/1533',
 'https://commons.wikimedia.org/wiki/Commons:Wiki_Loves_Monuments_in_Malaysia/Monuments',
 ],
 periods:[
 {source:8866,part:11,from:1641,to:1644,entity:'malacca-voc-core',name:'Malacca (VOC fortified town, documented core)',nameRu:'Малакка — крепость VOC (подтверждённая область)'},
 {source:8910,part:10,from:1645,to:1647,entity:'malacca-voc-core',name:'Malacca (VOC fortified town, documented core)',nameRu:'Малакка — крепость VOC (подтверждённая область)'},
 ],
};
// Early VOC Ceylon: these tiny clips restore only the documentary
// interiors of captured forts while the mixed Portuguese/VOC/Kandyan
// west-coast cell remains unresolved. They are NOT the perimeter of a
// colonial province, a cadastral fort survey, or a transferable modern border.
// The old Portuguese town footprints survive inside the later urban layouts;
// historic conquest dates come from the Rijksmuseum and archaeological studies.
export const ceylonFortCores=[
 {
  id:'ceylon-batticaloa-fort',
  mask:[[[81.70215,7.71175],[81.70255,7.71175],[81.70255,7.71205],[81.70215,7.71205],[81.70215,7.71175]]],
  sources:[
   'https://www.airport.lk/Bati/things_to_do/batticaloa_dutch_fort.html',
   'https://bulletin.rijksmuseum.nl/article/download/9736/10237/16002',
   'https://lakdiva.org.lk/codrington/chap08.html',
   'https://www.geonames.org/search.html?q=Batticaloa%20Fort'
  ],
  review:{
   reason:'The VOC and Kandyan allies captured the Portuguese Batticaloa fort in May 1638. This is a tiny core at the known fortress site, not the exact Portuguese 1628 plan, the later Dutch bastions, or a surveyed coastal boundary. Transfer to Kandyan control occurred afterwards; sources give different dates, so the core stops in 1641 and the rest of the territory remains unresolved.',
   reasonRu:'VOC и союзники из Канди захватили португальский форт Баттикалоа в мае 1638 г. Показан лишь небольшой внутренний фрагмент места крепости, а не точный план португальской постройки 1628 г., позднейшие голландские бастионы или береговая граница. Даты передачи Канди в источниках расходятся; участок ограничен 1641 годом, остальная территория неуточнённая.'
  },
  periods:[
   {source:8785,part:56,from:1638,to:1639,entity:'voc-batticaloa-core',name:'Batticaloa (VOC captured fortress, documented interior)',nameRu:'Баттикалоа — укрепление VOC (подтверждённый внутренний участок)'},
   {source:8866,part:12,from:1640,to:1641,entity:'voc-batticaloa-core',name:'Batticaloa (VOC captured fortress, documented interior)',nameRu:'Баттикалоа — укрепление VOC (подтверждённый внутренний участок)'}
  ],
 },
 {
  id:'ceylon-trincomalee-fort',
  mask:[[[81.24190,8.57675],[81.24230,8.57675],[81.24230,8.57705],[81.24190,8.57705],[81.24190,8.57675]]],
  sources:[
   'https://ccf.gov.lk/heritage-sites/trincomalee-fort/',
   'https://hpip.org/en/Heritage/Details/1925',
   'https://bulletin.rijksmuseum.nl/article/download/9736/10237/16002',
   'https://www.geonames.org/advanced-search.html?q=Fort%20Frederick'
  ],
  review:{
   reason:'The Dutch captured the Portuguese Trincomalee fortress in May 1639 before handing the site to Kandy. Only a tiny conservative inner fortress fragment is attributed to the VOC for 1639. The original coastal polygon and Kandy-VOC frontier are not reconstructed.',
   reasonRu:'Нидерландцы захватили португальскую крепость Тринкомали в мае 1639 г., а позднее передали её Канди. Лишь небольшой внутренний участок крепости относится к VOC за 1639 год. Исходный прибрежный контур и граница VOC с Канди остаются неуточнёнными.'
  },
  periods:[
   {source:8785,part:58,from:1639,to:1639,entity:'voc-trincomalee-core',name:'Trincomalee (VOC captured fortress, documented interior)',nameRu:'Тринкомали — крепость VOC (подтверждённый внутренний участок)'}
  ],
 },
 {
  id:'ceylon-galle-fort',
  mask:[[[80.21615,6.02785],[80.21655,6.02785],[80.21655,6.02815],[80.21615,6.02815],[80.21615,6.02785]]],
  sources:[
   'https://whc.unesco.org/en/list/451/',
   'https://whc.unesco.org/document/180038',
   'https://mass.cultureelerfgoed.nl/documents/00000041.pdf',
   'https://bulletin.rijksmuseum.nl/article/download/9736/10237/16002'
  ],
  review:{
   reason:'Galle fell to the VOC in March 1640. An extremely small interior sample of the documented Portuguese/Dutch fortified town is clipped to the dated source region. Its four straight edges are NOT historic fortification or political borders; surrounding Portuguese/VOC territory remains unresolved.',
   reasonRu:'Галле захвачен VOC в марте 1640 г. Восстановлен очень небольшой внутренний участок подтверждённого португальско-нидерландского укреплённого города внутри исходного контура. Прямые края фрагмента НЕ исторические крепостные или государственные границы; принадлежность остального побережья остаётся неуточнённой.'
  },
  periods:[
   {source:8866,part:0,from:1640,to:1647,entity:'voc-galle-core',name:'Galle Fort (VOC, documented interior only)',nameRu:'Галле — крепость VOC (подтверждённый внутренний участок)'},
   {source:8953,part:11,from:1648,to:1652,entity:'voc-galle-core',name:'Galle Fort (VOC, documented interior only)',nameRu:'Галле — крепость VOC (подтверждённый внутренний участок)'},
   {source:9013,part:11,from:1653,to:1658,entity:'voc-galle-core',name:'Galle Fort (VOC, documented interior only)',nameRu:'Галле — крепость VOC (подтверждённый внутренний участок)'}
  ],
 },
 {
  id:'ceylon-colombo-fort',
  mask:[[[79.84970,6.93270],[79.85010,6.93270],[79.85010,6.93310],[79.84970,6.93310],[79.84970,6.93270]]],
  sources:[
   'https://hpip.org/en/Contents/Place/501',
   'https://bulletin.rijksmuseum.nl/article/download/9736/10237/16002',
   'https://www.uda.gov.lk/attachments/outdated_dev_plans/Commercial%20City%20Development%20Plan/Volume%20I/English-Reduce.pdf'
  ],
  review:{
   reason:'Colombo surrendered to the VOC on 12 May 1656. This is a deliberately tiny inland excerpt of the historic Fort District, not the Portuguese fortress perimeter or the post-1656 Dutch redesign. The 1656–58 west-coast control frontier remains unknown.',
   reasonRu:'Коломбо капитулировал перед VOC 12 мая 1656 г. Показан очень небольшой внутренний фрагмент района исторического форта, а НЕ периметр португальской крепости или позднейшей голландской перестройки. Граница контроля побережья 1656–1658 гг. остаётся неизвестной.'
  },
  periods:[
   {source:9013,part:11,from:1656,to:1658,entity:'voc-colombo-core',name:'Colombo Fort (VOC, documented interior only)',nameRu:'Коломбо — крепость VOC (подтверждённый внутренний участок)'}
  ],
 },
 {
  id:'ceylon-jaffna-fort',
  mask:[[[80.00818,9.66205],[80.00858,9.66205],[80.00858,9.66235],[80.00818,9.66235],[80.00818,9.66205]]],
  sources:[
   'https://www.cambridge.org/core/journals/antiquity/article/antiquity-of-jaffna-fort-new-evidence-from-postdisaster-archaeological-investigations-in-northern-sri-lanka/C55CDA3934CC5C18EE40B903734C7215',
   'https://dur.ac.uk/research/institutes-and-centres/ethics-cultural-heritage/unescochair/research/sri-lanka/',
   'https://bulletin.rijksmuseum.nl/article/download/9736/10237/16002'
  ],
  review:{
   reason:'The VOC took the Portuguese fortress of Jaffna after a siege in 1658. The clip is a limited interior witness at the documented fortress, not the modern Dutch rampart line or a historic frontier. Other 1658 coastal regions remain unresolved.',
   reasonRu:'VOC взяла португальскую крепость Джафны после осады в 1658 г. Показан ограниченный внутренний фрагмент на месте документированной крепости, не линия позднейших бастионов и не историческая граница. Остальное побережье 1658 г. остаётся неуточнённым.'
  },
  periods:[
   {source:9013,part:11,from:1658,to:1658,entity:'voc-jaffna-core',name:'Jaffna Fort (VOC, documented interior only)',nameRu:'Джафна — крепость VOC (подтверждённый внутренний участок)'}
  ],
 }
];
export const documentedCores=[corsicaCore,malaccaCore,...ceylonFortCores];
// Whole-island attribution while a single documented colonial power
// administered Saint Martin. Union of Natural Earth 1:10m MAF and SXM;
// the modern internal border is deliberately discarded.
export const saintMartinSpanish={
 periods:[[8771,3,1633,1635],[8797,5,1636,1639],[8841,5,1640,1641],[8901,5,1642,1644],[8935,5,1645,1647]],
 sources:['https://www1.sintmaartengov.org/Documents/Policies/Spatial%20development%20Strategy%20%2B%20attachements%20-%20Policy%20department%202022%20-%20Final.pdf','https://www.sintmaartengov.org/Ministries/Departments/Documents/Integrated%20Cultural%20Policy%20Framework%20St%20Maarten.pdf',independentIslands.source.url],
 coastline:[[[[-63.14684,18.070299],[-63.14387,18.064683],[-63.134348,18.059475],[-63.130523,18.060248],[-63.115305,18.065375],[-63.107004,18.066962],[-63.107004,18.059475],[-63.118886,18.0515],[-63.112172,18.043036],[-63.097646,18.035956],[-63.030629,18.01911],[-63.017569,18.033391],[-63.010732,18.040839],[-63.011098,18.070746],[-63.017934,18.100531],[-63.017649,18.122138],[-63.031402,18.121894],[-63.052113,18.116848],[-63.070872,18.110012],[-63.079091,18.104193],[-63.083811,18.087958],[-63.096099,18.078803],[-63.113759,18.074652],[-63.143625,18.074164],[-63.14684,18.070299]]]]
};
export const tobagoDutch={
 periods:[[9029,1,1659,1661],[9090,1,1662,1664]],
 sources:['https://visittobago.gov.tt/local-culture-people-heritage/history-culture/historical-timeline','https://www.tha.gov.tt/info-hub/the-dutch-presence-in-tobago/','https://library2.nalis.gov.tt/greenstone/collect/hist3/index/assoc/HASH0100.dir/doc.pdf',independentIslands.source.url],
 coastline:[[[[-60.530507,11.35106],[-60.523061,11.343655],[-60.522084,11.318834],[-60.525543,11.288153],[-60.53303,11.266506],[-60.544179,11.26911],[-60.550364,11.26911],[-60.556508,11.254096],[-60.565297,11.252427],[-60.575266,11.255764],[-60.585113,11.25552],[-60.587066,11.251125],[-60.60204,11.231431],[-60.60558,11.230658],[-60.628774,11.216539],[-60.636057,11.210761],[-60.647125,11.204169],[-60.659779,11.204291],[-60.671864,11.206732],[-60.681304,11.207099],[-60.74177,11.177069],[-60.759511,11.172919],[-60.786448,11.14997],[-60.803334,11.143256],[-60.810414,11.159247],[-60.825429,11.151801],[-60.839345,11.15412],[-60.847524,11.163967],[-60.845204,11.179145],[-60.836741,11.183336],[-60.822865,11.185533],[-60.809926,11.19066],[-60.80427,11.203681],[-60.794342,11.21662],[-60.709706,11.271308],[-60.69164,11.288886],[-60.681304,11.296454],[-60.668609,11.302924],[-60.635813,11.314846],[-60.607574,11.320705],[-60.595815,11.327297],[-60.583648,11.329535],[-60.567738,11.320299],[-60.560374,11.321194],[-60.541331,11.343411],[-60.530507,11.35106]]]]
};
export function buildDocumentedCore(outline,definition){
 const coordinates=polygonClipping.intersection(outline,definition.mask);
 assert.ok(coordinates.length&&polygonClipping.difference(outline,coordinates).length);
 return {type:'MultiPolygon',coordinates};
}
export function deriveSecondaryTerritorialReviews(features){
 const exclusions=[],restorations=[],pending=[],attributions=[];
 const exclude=(source,from,to,parts,reasonRu,url)=>{
  const f=features[source];assert.ok(f.properties.Type==='POLITY'&&f.properties.FromYear<=from&&f.properties.ToYear>=to);
  exclusions.push([source,rawParts(f).length,from,parts,'Reviewed dated source-component attribution; see linked evidence.',reasonRu,url,to]);
 };
 for(const [source,target,from,to,parts,winners,reason,url,additionalSources=[]] of [...secondaryExactReviews,...thirdExactReviews,...fourthExactReviews,...fifthExactReviews,...sixthExactReviews,...provisionalExactReviews]){
  const f=features[source],t=features[target];assert.ok(t.properties.Type==='POLITY'&&t.properties.FromYear<=from&&t.properties.ToYear>=to&&parts.length===winners.length);
  for(const [i,part] of parts.entries()){
   const hash=componentHash(rawParts(f)[part]);assert.equal(hash,componentHash(rawParts(t)[winners[i]]));
   attributions.push({source:target,part:winners[i],hash,group:provisionalExactReviews.some(r=>r[0]===source&&r[1]===target&&r[2]===from)?'Вероятная принадлежность — датировка не установлена':'Историческая принадлежность',from,to,reason,sources:[url,...additionalSources]});
  }
  exclude(source,from,to,parts,reason,url);
 }
 for(const [source,target,from,to,parts,counterparts,title,reason,url,additionalSources=[]] of exactConflictPendingReviews){
  const a=features[source],b=features[target];assert.equal(parts.length,counterparts.length);
  for(const [i,part] of parts.entries()){
   const left=rawParts(a)[part],right=rawParts(b)[counterparts[i]],hash=componentHash(left);assert.equal(hash,componentHash(right));
   for(const [index,p,polygon,other] of [[source,part,left,b],[target,counterparts[i],right,a]])pending.push({source:index,part:p,from,to,hash,group:exactConflictGroupPrefix+title,reason,counterpartName:other.properties.Name,evidence:url,sources:[url,...additionalSources],geometry:{type:'Polygon',coordinates:polygon}});
  }
  exclude(source,from,to,parts,reason,url);exclude(target,from,to,counterparts,reason,url);
 }
 const reasonRu='Коморские острова не входили во Французскую Индию в этот период. Франция вступила во владение Майоттой в 1843 году; протектораты других островов относятся к 1886 году. Береговой контур не подтверждает точную внутреннюю границу или непрерывность одной династии.';
 const decision=(entity,name,nameRu,reason=reasonRu)=>({entity,name,nameRu,reason:'Reviewed island attribution; the historical internal jurisdictions are approximate, not a surveyed political boundary.',reasonRu:reason,sources:[comoroTreaties,comoroHistory]});
 const local=[decision('historical-mayotte','Mayotte (local rulers)','Майотта (местные правители)'),decision('historical-moheli','Mohéli (local rulers)','Мохели (местные правители)'),decision('historical-anjouan','Anjouan (sultanate)','Анжуан (султанат)')];
 const restore=(source,part,from,to,d)=>{
  const polygon=rawParts(features[source])[part],hash=componentHash(polygon);
  restorations.push({source,part,from,to,hash,group:'Коморы',decision:d,geometry:{type:'MultiPolygon',coordinates:[polygon]}});
 };
 for(const [source,first,from,to] of earlyComorosRoutes){
  const f=features[source];assert.equal(f.properties.Name,'French India');
  for(let i=0;i<4;i++)assert.equal(componentHash(rawParts(f)[first+i]),earlyComorosHashes[i]);
  exclude(source,from,to,[first,first+1,first+2,first+3],reasonRu,comoroTreaties);
  for(let i=0;i<3;i++)if(source!==11329||i!==0)restore(source,first+i,from,to,local[i]);
  pending.push({source,part:first+3,from,to,hash:earlyComorosHashes[3],group:'Коморы',reason:'На Нгазидже существовали соперничающие местные султанаты. Французская принадлежность ошибочна; точные границы султанатов для этого года не установлены.',counterpartName:'Местные султанаты Нгазиджи',evidence:comoroTreaties,sources:[comoroTreaties,comoroHistory],geometry:{type:'Polygon',coordinates:rawParts(f)[first+3]}});
 }
 assert.equal(componentHash(rawParts(features[11329])[1]),earlyComorosHashes[0]);assert.equal(componentHash(rawParts(features[11399])[8]),earlyComorosHashes[0]);
 exclude(11329,1842,1842,[1],reasonRu,comoroTreaties);exclude(11399,1842,1842,[8],reasonRu,comoroTreaties);
 restore(11329,1,1840,1840,local[0]);restore(11329,1,1841,1842,decision('historical-mayotte','Mayotte (cession treaty pending ratification)','Майотта (договор уступки, до ратификации)','Договор уступки подписан 25 апреля 1841 года; ратификация и фактическое вступление Франции во владение — 1843 год.'));
 exclude(11329,1840,1845,[6],'Французская колонистская экспедиция в Акароа прибыла после провозглашения британского суверенитета над Южным островом; отдельного французского владения не возникло.','https://nzhistory.govt.nz/french-pipped-at-akaroa-british-sovereignty-proclaimed-over-the-south-island-again');
 return {exclusions,restorations,pending,attributions};
}

const ceylonCoastalSources=[
 'https://www.archives.gov.lk/online-exhibits/path-to-freedom/1-1815-convention',
 'https://www.archives.gov.lk/our-catalogues',
 'https://researchbriefings.files.parliament.uk/documents/RP09-51/RP09-51.pdf',
 'https://cdn.nationalarchives.gov.uk/documents/migratedarchives-2.guidance.pdf',
];
const ceylonEarlySources=[...ceylonCoastalSources,
 'https://www.cambridge.org/core/journals/transactions-of-the-royal-historical-society/article/representative-institutions-and-parliamentary-culture-in-the-portuguese-and-spanish-empires-c-1500c-1700/F21F4E68DCE923AE9E714057D6346F81',
 'https://bulletin.rijksmuseum.nl/article/download/9736/10237/16002',
];
export const ceylonEarlyRoutes=[[8721,1629,1631,[60,61,62]],[8769,1632,1635,[59,60,61]],[8785,1636,1637,[56,57,58]]];
// Exact, contemporaneous Cliopatria components, not modern island outlines.
// The eastern coastal parts already attributed to Kandy through 1664 must
// remain outside these VOC routes. The source is pinned by SHA-256.
export const ceylonCoastalRoutes=[
 [9054,1659,1661,[5,8]],[9066,1662,1664,[6,9]],[9066,1665,1669,[6,7,8,9]],
 [9099,1670,1672,[7,8,9,10]],[9173,1673,1676,[8,9,10,11]],[9196,1677,1682,[8,9,10,11]],
 [9246,1683,1686,[1,2,3,4]],[9277,1687,1690,[1,2,3,4,5]],[9324,1691,1699,[1,2,3,4,5]],
 [9403,1700,1701,[1,2,3,4,5]],[9416,1702,1705,[1,2,3,4,5]],[9472,1706,1708,[1,2,3,4,5]],
 [9499,1709,1712,[1,2,3,4,5]],[9545,1713,1720,[0,1,2,3,4]],[9622,1721,1733,[0,1,2,3,4]],
 [9695,1734,1743,[0,1,2,3,4]],[9828,1744,1756,[0,1,2,3,4]],[9924,1757,1761,[0,1,2,3,4]],
 [9980,1762,1762,[0,1,2,3,4]],[10032,1763,1768,[0,1,2,3,4]],[10068,1769,1774,[9]],
 [10125,1775,1779,[10]],[10214,1780,1787,[11]],[10255,1788,1790,[10]],[10300,1791,1793,[9]],
 [10396,1794,1795,[11]],[10404,1796,1796,[20]],[10456,1797,1798,[20]],[10499,1799,1799,[19]],
 [10560,1800,1801,[18]],[10560,1802,1802,[18]],[10575,1803,1804,[19]],[10625,1805,1805,[30]],
 [10702,1806,1806,[31]],[10728,1807,1808,[32]],[10763,1809,1810,[33]],[10798,1811,1813,[34]],
 [10944,1814,1814,[35]],
];
export function deriveCeylonCoastalReviews(features,existingExclusions){
 const exclusions=[],restorations=[],transfers=[];
 const islandPart=polygon=>polygon.every(r=>r.every(([x,y])=>x>=79.4&&x<=82&&y>=5.65&&y<=10));
 const coastDecision=(from)=>{
  const dutch=from<1796,crown=from>=1802;
  return {entity:dutch?'dutch-ceylon-coast':'british-ceylon-coast',name:dutch?'Dutch Ceylon':'British Ceylon',nameRu:dutch?'Нидерландский Цейлон (прибрежные владения)':'Британский Цейлон (прибрежные владения)',memberOf:[dutch?'(Dutch Republic)':'(British Empire)'],reason:`Separate contemporaneous coastal components from the metropolitan aggregate; Kandy remained independent until 1815. ${dutch?'VOC territories.':crown?'Crown colony from 1802.':'British occupation and administration from 1796.'} Source coastline and inland boundaries remain approximate.`,reasonRu:`Прибрежные компоненты выделены из сводного контура империи. Канди сохраняло независимость до 1815 года. ${dutch?'Владения VOC.':crown?'Коронная колония с 1802 года.':'Британская оккупация и управление с 1796 года.'} Исторические береговые и внутренние границы источника приблизительны.`,sources:ceylonCoastalSources};
 };
 const exclude=(source,from,to,parts,decision)=>{
  const f=features[source];assert.ok(f.properties.FromYear<=from&&f.properties.ToYear>=to&&parts.every(p=>islandPart(rawParts(f)[p])));
  for(let y=from;y<=to;y++){const old=new Set(exclusionsFor(source,y,existingExclusions).flatMap(r=>r[3]));assert.ok(parts.every(p=>!old.has(p)),`Ceylon component previously excluded ${source}/${y}`);}
  exclusions.push([source,rawParts(f).length,from,parts,decision.reason,decision.reasonRu,decision.sources[0],to]);
 };
 for(const [source,from,to,parts] of ceylonCoastalRoutes){
  const f=features[source],d=coastDecision(from);assert.equal(f.properties.Name,from<1796?'Dutch Republic':'British Empire');assert.equal(f.properties.Type,'POLITY');
  exclude(source,from,to,parts,d);
  const coordinates=parts.map(p=>rawParts(f)[p]);restorations.push({source,part:parts[0],parts,from,to,hash:sha256(JSON.stringify(coordinates)),group:'Цейлон — побережье',decision:d,geometry:{type:'MultiPolygon',coordinates}});
 }
 const early={entity:'portuguese-ceylon-coast',name:'Portuguese Ceylon',nameRu:'Португальский Цейлон (прибрежные владения)',memberOf:['(Portuguese Empire)','(Spanish Empire)'],reason:'Portuguese coastal administration under the shared Iberian monarch, before the Dutch capture of Batticaloa in 1638. Kandy remained independent. The contemporaneous source coast is approximate.',reasonRu:'Португальская прибрежная администрация при общем монархе Иберийской унии до захвата Баттикалоа голландцами в 1638 году. Канди независимо. Современный указанной эпохе контур источника приблизителен.',sources:ceylonEarlySources,preserveCoastalParts:true};
 for(const [source,from,to,parts] of ceylonEarlyRoutes){
  assert.equal(features[source].properties.Name,'Spanish Empire');exclude(source,from,to,parts,early);
  const coordinates=parts.map(p=>rawParts(features[source])[p]);restorations.push({source,part:parts[0],parts,from,to,hash:sha256(JSON.stringify(coordinates)),group:'Цейлон — побережье',decision:early,geometry:{type:'MultiPolygon',coordinates}});
  for(const [target,f] of features.entries()){
   const p=f.properties;if(p.Name!=='(Portuguese Empire)'||p.FromYear>to||p.ToYear<from)continue;
   assert.ok(p.Components.includes('Portuguese Ceylon'));const old=rawParts(f).flatMap((poly,part)=>islandPart(poly)?[part]:[]);assert.ok(old.length);
   const start=Math.max(from,p.FromYear),end=Math.min(to,p.ToYear);exclude(target,start,end,old,early);
   for(const part of parts)transfers.push({target,source,part,from:start,to:end,decision:early});
  }
 }
 const portuguese={reason:'Portuguese rule in Ceylon ended in 1658; remove the stale island component.',reasonRu:'Португальские владения на Цейлоне ликвидированы в 1658 году; удалён устаревший компонент острова.',sources:ceylonCoastalSources};
 assert.equal(features[9013].properties.Name,'Portuguese Colonies');exclude(9013,1659,1661,[11],portuguese);
 // Composite and relation outlines previously included the inland kingdom.
 // Replace only their Sri Lankan parts with the reviewed same-year coast.
 for(const [target,f] of features.entries()){
  const p=f.properties;if(p.ToYear<1659||p.FromYear>1814||!p.Components)continue;
  const dutch=p.Name==='(Dutch Republic)'&&p.FromYear<=1795;
  const brit=p.Components.includes('British Ceylon')&&p.ToYear>=1796;
  const portug=p.Name==='(Portuguese Empire)'&&p.Components.includes('Portuguese Ceylon');
  if(!dutch&&!brit&&!portug)continue;
  const old=rawParts(f).flatMap((poly,part)=>islandPart(poly)?[part]:[]);assert.ok(old.length,`Missing island overlay ${target}`);
  if(portug){exclude(target,Math.max(1659,p.FromYear),Math.min(1814,p.ToYear),old,portuguese);continue;}
  for(const [source,start,end,parts] of ceylonCoastalRoutes){
   if(dutch!==(start<1796))continue;
   const from=Math.max(start,p.FromYear),to=Math.min(end,p.ToYear);if(from>to)continue;
   const decision={...coastDecision(from),preserveCoastalParts:true};exclude(target,from,to,old,decision);
   for(const part of parts)transfers.push({target,source,part,from,to,decision});
  }
 }
 assert.equal(restorations.reduce((n,r)=>n+r.to-r.from+1,0),165);
 return {exclusions,restorations,transfers};
}

const ceylonWarSources=[
 'https://eprints.soas.ac.uk/33621/1/11010382.pdf',
 'https://www.sciencedirect.com/org/science/article/pii/S0006229480000093',
 'https://bulletin.rijksmuseum.nl/article/download/9736/10237/16002',
 'https://ccf.gov.lk/heritage-sites/galle-fort/',
];
// Order is Batticaloa, western/ northern coast, Trincomalee. The western
// component spans several opposing fort administrations after 1640.
export const ceylonWarRoutes=[[8785,1638,1639,56,57,58],[8866,1640,1647,12,0,13],[8953,1648,1652,10,11,12],[9013,1653,1658,10,11,12]];
export function deriveCeylonWarReviews(features,existingExclusions){
 const exclusions=[],restorations=[],transfers=[],pending=[];
 const islandPart=polygon=>polygon.every(r=>r.every(([x,y])=>x>=79.4&&x<=82&&y>=5.65&&y<=10));
 const d=(reason,reasonRu)=>({reason,reasonRu,sources:ceylonWarSources});
 const exclude=(source,from,to,parts,decision)=>{
  const f=features[source];assert.ok(f.properties.FromYear<=from&&f.properties.ToYear>=to&&parts.every(p=>islandPart(rawParts(f)[p])));
  for(let y=from;y<=to;y++){const old=new Set(exclusionsFor(source,y,existingExclusions).flatMap(r=>r[3]));assert.ok(parts.every(p=>!old.has(p)),`Previously excluded war component ${source}/${y}`);}
  exclusions.push([source,rawParts(f).length,from,parts,decision.reason,decision.reasonRu,decision.sources[0],to]);
 };
 const uncertain=(source,part,from,to,decision)=>{
  const polygon=rawParts(features[source])[part];exclude(source,from,to,[part],decision);
  pending.push({source,part,from,to,hash:componentHash(polygon),group:'Цейлон — война VOC',reason:decision.reasonRu,counterpartName:'Португалия / VOC / Канди',evidence:decision.sources[0],sources:decision.sources,geometry:{type:'Polygon',coordinates:polygon}});
 };
 const early={...d('Portuguese coastal possessions still held after the capture of Batticaloa in 1638 and before the capture of Trincomalee in 1639 and Galle in 1640. The outline is generalized.','Португальские прибрежные владения после потери Баттикалоа в 1638 г., Тринкомале в 1639 г. и до захвата Галле в 1640 г. Исходные границы приблизительны.'),entity:'portuguese-ceylon-coast',name:'Portuguese Ceylon',nameRu:'Португальский Цейлон (прибрежные владения)',memberOf:['(Portuguese Empire)','(Spanish Empire)'],preserveCoastalParts:true};
 for(const [source,from,to,batti,west,trinco] of ceylonWarRoutes){
  const f=features[source];assert.equal(f.properties.Name,from<1640?'Spanish Empire':'Portuguese Colonies');
  if(from===1638){for(const year of [1638,1639]){
   const parts=year===1638?[west,trinco]:[west],coordinates=parts.map(p=>rawParts(f)[p]);exclude(source,year,year,parts,early);
   restorations.push({source,part:parts[0],parts,from:year,to:year,hash:sha256(JSON.stringify(coordinates)),group:'Цейлон — побережье',decision:early,geometry:{type:'MultiPolygon',coordinates}});
   for(const part of parts)transfers.push({target:8788,source,part,from:year,to:year,decision:early});
  }}else uncertain(source,west,from,to,d('The 1640–1658 source outline combines opposing coastal possessions, including Galle, Colombo and Jaffna. The 1645 treaty and later fort captures do not establish its complete internal borders.','Контур 1640–1658 гг. объединяет владения противоборствующих сторон, в том числе Галле, Коломбо и Джафну. Договор 1645 г. и последующие захваты фортов не устанавливают все внутренние границы.'));
  for(const [part,capture,handed,port] of [[batti,1638,1642,'Batticaloa'],[trinco,1639,1640,'Trincomalee']]){
   const begin=Math.max(from,capture),end=Math.min(to,handed-1);
   if(begin<=end)uncertain(source,part,begin,end,d(`${port}: captured by VOC in ${capture}, passed to Kandy in ${handed}; the extent of temporary Dutch rule is not known.`,`${port==='Batticaloa'?'Баттикалоа':'Тринкомале'}: захвачена VOC в ${capture} г., передана Канди в ${handed} г.; границы временной нидерландской администрации не установлены.`));
   const start=Math.max(from,handed);if(start>to)continue;
   const decision=d(`${port}: the fort was handed to Kandy in ${handed}; the contemporaneous eastern component is retained as an approximate regional attribution, not a surveyed boundary or proof of direct garrison administration throughout.`,`${port==='Batticaloa'?'Баттикалоа':'Тринкомале'}: крепость передана Канди в ${handed} г.; современный эпохе восточный компонент сохранён как приблизительная атрибуция региона, а не точно установленная граница или доказательство управления всей областью из гарнизона.`);
   exclude(source,start,to,[part],decision);transfers.push({source,part,target:8828,from:start,to,decision});
  }
 }
 // The empire overlay showed the inland kingdom as Portuguese Ceylon.
 // Remove that inland area even when the coastal boundary remains unresolved.
 for(const [target,f] of features.entries()){
  const p=f.properties;if(p.Name!=='(Portuguese Empire)'||p.FromYear>1658||p.ToYear<1638||!p.Components.includes('Portuguese Ceylon'))continue;
  const parts=rawParts(f).flatMap((poly,part)=>islandPart(poly)?[part]:[]);assert.ok(parts.length);
  exclude(target,Math.max(1638,p.FromYear),Math.min(1658,p.ToYear),parts,early);
 }
 assert.equal(features[8816].properties.Name,'(Spanish Empire)');
 for(const [part,from] of [[70,1638],[72,1639]])exclude(8816,from,1639,[part],early);
 assert.equal(restorations.reduce((n,r)=>n+r.parts.length,0),3);assert.equal(transfers.filter(t=>t.target===8828).reduce((n,r)=>n+r.to-r.from+1,0),36);assert.equal(pending.reduce((n,r)=>n+r.to-r.from+1,0),24);
 return {exclusions,restorations,transfers,pending};
}

const capeSource='https://sahistory.org.za/article/batavian-republic-1803-1806';
const sierraSource='https://www.parliament.gov.sl/uploads/other_resources/TRCVolume3A.pdf';
const seychellesSource='https://seychellesnationalmuseums.org/history/';
const gambiaSource='https://www.cambridge.org/core/books/abs/political-history-of-the-gambia-18161994/constitutional-change-in-the-gambia-18161994/90E1B0F127CA3D62479566082FC0EA3D';
const socotraSource='https://qdl.qa/en/archive/81055/vdc_100023462214.0x00004f';
const goreeSource='https://www.cambridge.org/core/books/abs/political-history-of-the-gambia-18161994/merchants-and-recaptives-the-origins-of-modern-politics-181686/0343E946F8D5DFBB14438F4D2D8E2EA9';
const capeDecision=(entity,name,nameRu,reason,reasonRu,sources,memberOf=['(British Empire)'])=>({entity,name,nameRu,reason,reasonRu,sources,memberOf});
export const capeTerritories={
 company:capeDecision('sierra-leone-company','Sierra Leone Company settlement','Поселение Компании Сьерра-Леоне','The Freetown settlement belonged to the Sierra Leone Company until Crown administration began in 1808; the source outline is not a surveyed boundary.','Поселение Фритаун управлялось Компанией Сьерра-Леоне до перехода под управление короны в 1808 г.; исходный контур не является точно установленной границей.',[sierraSource,'https://sierraleonepublicarchives.gov.sl/Public/about.php']),
 sierra:capeDecision('sierra-leone-crown','Sierra Leone (Crown colony)','Сьерра-Леоне (коронная колония)','British Crown administration dates from 1808, initially around Freetown; the inland Protectorate dates from 1896. This historical source outline is approximate and does not establish direct rule over the entire mapped interior.','С 1808 г. существовала британская коронная колония, первоначально вокруг Фритауна; протекторат внутренних земель образован в 1896 г. Исходный приблизительный контур не доказывает прямое управление всей обозначенной внутренней областью.',[sierraSource,'https://tourism.gov.sl/history-of-sierra-leone/']),
 seychelles:capeDecision('seychelles-mauritius','Seychelles (dependency of Mauritius)','Сейшелы (зависимая территория Маврикия)','British possession in 1811, formally ceded in 1814; administered through Mauritius until 1903. This generalized source component depicts only a portion of the archipelago, not its full extent.','Британское владение с 1811 г., официальная уступка в 1814 г.; управление через Маврикий до 1903 г. Генерализованный исходный компонент не охватывает весь архипелаг.',[seychellesSource,'https://cdn.nationalarchives.gov.uk/documents/migrated-archives-5-guidance.pdf']),
 gambia:capeDecision('gambia-settlements','Gambia (British settlements)','Гамбия (британские поселения)','Bathurst founded in 1816; colonial administration dates from 1821. The source component is approximate, not proof of the boundaries of the later protectorate.','Батерст основан в 1816 г.; колониальное управление с 1821 г. Приблизительный компонент источника не подтверждает границы позднейшего протектората.',[gambiaSource,'https://cdn.nationalarchives.gov.uk/documents/migratedarchives-2.guidance.pdf']),
 socotra:capeDecision('mahra-socotra','Socotra (Mahra Sultanate)','Сокотра (султанат Махра)','The 1834 coaling arrangement and subsequent negotiations did not transfer sovereignty over Socotra; a British garrison did not make the entire island a Cape Colony possession. The generalized source island is retained under its local ruler.','Соглашение 1834 г. о снабжении углём и переговоры не передали суверенитет над Сокотрой; присутствие гарнизона не превращало остров в Капскую колонию. Сохранён генерализованный контур острова под местной властью.',[socotraSource,'https://whc.unesco.org/document/168954'],[]),
};
// Indexes of geographically separate source components. South African
// mainland parts are deliberately not changed by this attribution pass.
export const capeTerritoryRoutes=[
 [10461,1,-1,-1,-1],[10769,1,-1,-1,2],[10804,2,1,-1,3],
 [11041,2,1,3,-1],[11083,2,1,3,-1],[11123,2,1,3,-1],[11183,2,1,3,-1],
 [11248,2,1,4,-1],[11341,2,1,3,-1],[11465,2,1,3,-1],[11513,2,1,3,-1],[11590,2,1,3,-1],
 [11909,4,3,5,-1],[11962,6,5,7,-1],[11996,6,5,7,-1],
];
export function deriveCapeTerritoryReviews(features,existingExclusions){
 const exclusions=[],restorations=[],pending=[];
 const exclude=(source,from,to,parts,d)=>{
  const f=features[source];assert.ok(f.properties.FromYear<=from&&f.properties.ToYear>=to&&parts.every(p=>rawParts(f)[p]));
  for(let y=from;y<=to;y++){const old=new Set(exclusionsFor(source,y,existingExclusions).flatMap(r=>r[3]));assert.ok(parts.every(p=>!old.has(p)),`Previously excluded Cape component ${source}/${y}`);}
  exclusions.push([source,rawParts(f).length,from,parts,d.reason,d.reasonRu,d.sources[0],to]);
 };
 const restore=(source,part,from,to,d)=>{
  const polygon=rawParts(features[source])[part];exclude(source,from,to,[part],d);
  restorations.push({source,part,from,to,hash:componentHash(polygon),group:'Капская колония — отдельные владения',decision:d,geometry:{type:'MultiPolygon',coordinates:[polygon]}});
 };
 const within=(polygon,x0,y0,x1,y1)=>polygon.every(r=>r.every(([x,y])=>x>=x0&&x<=x1&&y>=y0&&y<=y1));
 for(const [source,sierra,seychelles,gambia,goree] of capeTerritoryRoutes){
  const f=features[source],{Name,FromYear:from,ToYear:to}=f.properties;assert.equal(Name,'British Cape Colony');const parts=rawParts(f);
  assert.ok(within(parts[sierra],-14,6,-10,11));
  if(from<1808)restore(source,sierra,from,Math.min(1807,to),capeTerritories.company);
  if(to>=1808)restore(source,sierra,Math.max(from,1808),to,capeTerritories.sierra);
  if(seychelles>=0){assert.ok(within(parts[seychelles],55,-5,56,-4));restore(source,seychelles,from,to,capeTerritories.seychelles);}
  if(gambia>=0){assert.ok(within(parts[gambia],-17,12,-16,14));restore(source,gambia,from,to,capeTerritories.gambia);}
  if(goree>=0){
   const polygon=parts[goree];assert.ok(within(polygon,-18,14,-17,15));const hash=componentHash(polygon);
   const d={reason:'The polygon represents a broad mainland area near Dakar, not the island of Gorée. British occupation of Gorée ended in 1817. Neither a British nor a French polygon of this extent is established.',reasonRu:'Контур охватывает материковый район близ Дакара, а не остров Горе. Британская оккупация Горе завершилась в 1817 г. Ни британская, ни французская принадлежность всей исходной площади не установлена.',sources:[goreeSource,'https://whc.unesco.org/en/list/26/']};
   exclude(source,from,to,[goree],d);pending.push({source,part:goree,from,to,hash,group:'Горе — материковый контур',reason:d.reasonRu,counterpartName:'Горе / территория близ Дакара',evidence:d.sources[0],sources:d.sources,geometry:{type:'Polygon',coordinates:polygon}});
   // Remove the same unsupported mainland part from EVERY same-date British overlay.
   for(const [target,overlay] of features.entries()){
    const p=overlay.properties;if(!p.Components.includes('British Cape Colony')||p.FromYear>to||p.ToYear<from)continue;
    const matches=rawParts(overlay).flatMap((poly,j)=>componentHash(poly)===hash?[j]:[]);assert.equal(matches.length,1,`Missing Gorée overlay part ${target}`);
    exclude(target,Math.max(from,p.FromYear),Math.min(to,p.ToYear),matches,d);
   }
  }
 }
 const source=11248,part=3,polygon=rawParts(features[source])[part],d=capeTerritories.socotra;assert.ok(within(polygon,53,12,55,13));
 restore(source,part,1834,1839,d);const hash=componentHash(polygon);
 for(const [target,overlay] of features.entries()){
  const p=overlay.properties;if(!p.Components.includes('British Cape Colony')||p.FromYear>1839||p.ToYear<1834)continue;
  const matches=rawParts(overlay).flatMap((poly,j)=>componentHash(poly)===hash?[j]:[]);assert.equal(matches.length,1,`Missing Socotra overlay part ${target}`);
  exclude(target,Math.max(1834,p.FromYear),Math.min(1839,p.ToYear),matches,d);
 }
 assert.equal(restorations.reduce((n,r)=>n+r.to-r.from+1,0),233);assert.equal(pending.reduce((n,r)=>n+r.to-r.from+1,0),11);
 return {exclusions,restorations,pending};
}

export function deriveMedievalAndUnionReviews(features,existingExclusions){
 const exclusions=[],transfers=[],pending=[],groupRebuilds=[];
 const d=(reason,reasonRu,sources)=>({reason,reasonRu,sources});
 const all=source=>rawParts(features[source]).map((_,part)=>part);
 const exclude=(source,from,to,parts,decision)=>{
  const f=features[source];assert.ok(f.properties.FromYear<=from&&f.properties.ToYear>=to&&parts.every(p=>rawParts(f)[p]));
  for(let y=from;y<=to;y++){const old=new Set(exclusionsFor(source,y,existingExclusions).flatMap(r=>r[3]));assert.ok(parts.every(p=>!old.has(p)),`Previously excluded historic component ${source}/${y}`);}
  exclusions.push([source,rawParts(f).length,from,parts,decision.reason,decision.reasonRu,decision.sources[0],to]);
 };
 const move=(source,target,from,to,parts,decision)=>{exclude(source,from,to,parts,decision);for(const part of parts)transfers.push({source,target,part,from,to,decision});};
 const rebuild=(target,from,to,refs,decision)=>{
  assert.ok(features[target].properties.Components&&features[target].properties.FromYear<=from&&features[target].properties.ToYear>=to);
  const parts=refs.flatMap(([index,selection])=>{const f=features[index];assert.ok(f.properties.FromYear<=from&&f.properties.ToYear>=to);return (selection??all(index)).map(part=>({index,part}));});
  assert.ok(parts.length&&new Set(parts.map(p=>`${p.index}/${p.part}`)).size===parts.length);
  groupRebuilds.push({target,from,to,parts,decision});
 };
 const song=d('The dated conquests of Northern Song replace the obsolete independent polity with the same-year source components. Boundaries are generalized; no day-level claim.','Датированные завоевания Северной Сун заменяют устаревшую самостоятельную политию исходными компонентами того же года. Границы генерализованы; без утверждения о контроле на конкретный день.',[SONG_REUNIFICATION,SONG_CHRONOLOGY]);
 assert.equal(componentHash(rawParts(features[3861])[0]),componentHash(rawParts(features[3909])[0]));
 for(const [source,target,from] of songAnnexations){const to=features[source].properties.ToYear,decision=source===3932?{...song,allowSourceOverlap:true,group:'Сун — объединение'}:song;move(source,target,from,to,all(source),decision);}
 for(const target of [3863,3963]){
  const f=features[target],names=f.properties.Components.split(';');
  for(let year=f.properties.FromYear;year<=f.properties.ToYear;year++){
   const active=names.filter(n=>year<SONG_ENDS[n]);if(!active.length)continue;
   const refs=active.map(name=>{const matches=features.flatMap((x,index)=>x.properties.Name===name&&x.properties.FromYear<=year&&x.properties.ToYear>=year?[[index]]:[]);assert.equal(matches.length,1,`${name}/${year}`);return matches[0];});
   rebuild(target,year,year,refs,song);
  }
 }
 const maine=d('Maine passed to the counts of Anjou in 1110; the English political aggregate is rebuilt from the contemporary Norman England record alone.','Мэн перешёл графам Анжу в 1110 г.; английский сводный слой восстановлен только из записи Нормандской Англии того же года.',[MAINE_FULK]);
 rebuild(4739,1111,1143,[[4734]],maine);
 const normandy=d('Geoffrey of Anjou completed the conquest of Normandy in 1144. The contemporary Norman French component is reassigned to Geoffrey; original source outline remains approximate.','Жоффруа Анжуйский завершил завоевание Нормандии в 1144 г. Французский компонент того же года отнесён к его владениям; исходная граница приблизительна.',[NORMANDY_GEOFFREY,'https://fasg.org/projects/henryproject/data/geoff005.htm']);
 move(4734,4893,1144,1146,[0],normandy);transfers.push({source:4734,target:4880,part:0,from:1144,to:1146,decision:normandy});
 rebuild(4739,1144,1146,[[4734,[1]]],normandy);
 const british=d('The 1707 union replaced the English state and composite. Rebuild the British overlay from the same-year metropolitan and colonial footprints, including the nonduplicated supplemental parts.','Уния 1707 г. заменила английское государство и сводный контур. Британский слой восстановлен из метрополии и колоний того же года, включая недублирующие дополнительные части.',[UNION_1707]);
 rebuild(9441,1707,1708,[[9438],[9449],[9410]],british);
 rebuild(9507,1709,1712,[[9477],[9518],[9410,[14,24,27,28,29]]],british);
 const denia=d('The mainland taifa of Dénia was annexed by Zaragoza in 1076; its island polity survived independently. The source mainland component is attributed only where the contemporary regional contours do not compete.','Материковая тайфа Дения присоединена к Сарагосе в 1076 г., островная тайфа сохраняла самостоятельность. Материковый компонент отнесён только там, где исходные контуры того же времени не конфликтуют.',[DENIA_HISTORY,MALLORCA_HISTORY,TAIFA_HISTORY]);
 move(4524,4604,1077,1084,[0],denia);
 const ambiguous=d('The former Dénia mainland component overlaps the source Tortosa polity in 1085–93 and the boundary of the 1092 Almoravid takeover is not established.','Материковый контур бывшей Дении накладывается на исходную запись Тортосы в 1085–1093 гг.; пределы перехода к Альморавидам в 1092 г. не установлены.',[DENIA_HISTORY,TAIFA_HISTORY]);
 exclude(4524,1085,1093,[0],ambiguous);const polygon=rawParts(features[4524])[0];
 pending.push({source:4524,part:0,from:1085,to:1093,hash:componentHash(polygon),group:'Дения — материковый контур',reason:ambiguous.reasonRu,counterpartName:'Сарагоса / Альморавиды',evidence:ambiguous.sources[0],sources:ambiguous.sources,geometry:{type:'Polygon',coordinates:polygon}});
 const almoravid=d('The mainland taifa had fallen to the Almoravids by the end of the eleventh century. The contemporary successor outline covers more than 99% of this source component; the remaining border differences are not reconstructed.','К концу XI в. материковая тайфа перешла к Альморавидам. Контур преемника того же года охватывает более 99% исходного компонента; оставшиеся различия границ не реконструированы.',[DENIA_HISTORY,TAIFA_HISTORY]);
 exclude(4524,1094,1125,[0],almoravid);
 // By 1111 the only surviving member represented in this obsolete Iberian
 // mainland aggregate is the Balearic taifa. Keep its exact island shapes.
 rebuild(4744,1111,1115,[[4524,[1,2,3]]],denia);
 return {exclusions,transfers,pending,groupRebuilds};
}

// Independently sourced political/colonial transitions; the old outlines
// remain accessible as provenance. Repair only the specifically identified
// source parts, not entire modern country outlines.
export function deriveColonialAndSalonaReviews(features,existingExclusions){
 const exclusions=[],transfers=[],restorations=[],subtractions=[],pending=[],groupLinks=[];
 const d=(reason,reasonRu,sources)=>({reason,reasonRu,sources});
 const exclude=(source,from,to,parts,decision)=>{
  const f=features[source];assert.ok(f.properties.FromYear<=from&&f.properties.ToYear>=to&&parts.every(p=>rawParts(f)[p]));
  let range;
  for(let y=from;y<=to;y++){
   const previous=new Set(exclusionsFor(source,y,[...existingExclusions,...exclusions]).flatMap(r=>r[3]));
   const remaining=parts.filter(p=>!previous.has(p));if(!remaining.length){range=undefined;continue;}
   if(range&&range[7]===y-1&&JSON.stringify(range[3])===JSON.stringify(remaining))range[7]=y;
   else{range=[source,rawParts(f).length,y,remaining,decision.reason,decision.reasonRu,decision.sources[0],y];exclusions.push(range);}
  }
 };
 const restore=(source,part,from,to,decision)=>{exclude(source,from,to,[part],decision);const polygon=rawParts(features[source])[part];restorations.push({source,part,from,to,hash:componentHash(polygon),group:'Историческая атрибуция',decision,geometry:{type:'MultiPolygon',coordinates:[polygon]}});};
 const addParts=(source,target,from,to,parts,decision)=>{for(const part of parts)transfers.push({source,target,part,from,to,decision});};
 const india=d('The French Indian settlements were occupied by Britain in 1793; the 1802 Amiens provision was not implemented and actual restoration came in 1816–17. Correct the physical-control map without denying the French legal claims.','Французские поселения Индии заняты Великобританией в 1793 г.; положение Амьенского мира 1802 г. не было реализовано, фактическое возвращение состоялось в 1816–1817 гг. Исправляется карта фактического контроля, а не юридических притязаний.',[INDIA_OCCUPATION,INDIA_HISTORY]);
 const partialIndia={...india,allowSourceOverlap:true,group:'Индия — британская оккупация'};
 exclude(10351,1793,1793,[13,14,15,16,17],india);
 exclude(9759,1794,1814,[6,7,8,9,10],india);
 // In these intervals the British source omits part or all of a documented
 // occupied settlement. Preserve that contemporaneous source outline by union.
 for(const [source,from,to,parts,polity,overlay] of [[10351,1793,1793,[13,14,15,16],10346,10332],[9759,1799,1799,[6],10499,10481],[9759,1800,1802,[6,8],10560,10535],[9759,1803,1804,[10],10575,10607]]){
  addParts(source,polity,from,to,parts,partialIndia);addParts(source,overlay,from,to,parts,partialIndia);
 }
 const islands=d('The French imperial composite includes the same pre-annexation Comoro components already removed from its political source records; the unresolved island outlines must not reappear via the thematic layer.','Французский сводный контур включает те же доаннексионные компоненты Комор, которые уже исключены из политических записей; спорные острова не должны повторно появляться в тематическом слое.',[comoroTraditionalRegions]);
 for(const target of FRENCH_INDIA_GROUPS){const f=features[target],parts=rawParts(f).flatMap((p,i)=>p[0].every(([x,y])=>x>=43&&x<=45.3&&y>=-13.2&&y<=-11.2)?[i]:[]);assert.equal(parts.length,4);exclude(target,f.properties.FromYear,f.properties.ToYear,parts,islands);}
 exclude(10339,1793,1793,[19,20,21,22,23],india);
 const salona=d('The Greek component centred on Amfissa and Delphi is not territory of the Republic of Florence. Salona passed to the Despot of Morea in 1402, to the Hospitallers in 1403, and back to Ottoman rule in 1410. The source outline is generalized.','Греческий компонент с Амфиссой и Дельфами не принадлежит Флорентийской республике. Салона перешла к Морейскому деспоту в 1402 г., к госпитальерам в 1403 г., вновь под власть османов в 1410 г. Исходный контур генерализован.',[SALONA_MUSEUM,SALONA_HISTORY]);
 const morea={...salona,entity:'salona-morea',name:'Salona (Despotate of Morea)',nameRu:'Салона (Морейский деспотат)',memberOf:[]};
 const hospitaller={...salona,entity:'salona-hospitaller',name:'Salona (Knights Hospitaller)',nameRu:'Салона (госпитальеры)',memberOf:[]};
 restore(6808,0,1402,1402,morea);restore(6808,0,1403,1406,hospitaller);restore(6924,0,1407,1409,hospitaller);
 exclude(6924,1410,1486,[0],salona);
 for(const [target,from,to] of [[6912,1410,1414],[6997,1422,1428]])addParts(6924,target,from,to,[0],salona);
 for(const target of [6814,6915,7015]){const f=features[target];const parts=rawParts(f).flatMap((p,i)=>capitalInsideCountry([22.38,38.525],{type:'Polygon',coordinates:p})?[i]:[]);assert.equal(parts.length,1);exclude(target,f.properties.FromYear,f.properties.ToYear,parts,salona);}
 const dutch=d('The source Portuguese aggregate incorrectly includes Dutch trading settlements in Essequibo and the Hudson valley. Both precede the later Dutch West India Company colony; the precise imported regional boundaries are not verified.','Исходный португальский контур ошибочно включает нидерландские торговые поселения Эссекибо и долины Гудзона. Оба предшествуют более поздней колонии Вест-Индской компании; точные исходные региональные границы не подтверждены.',[DUTCH_GUYANA,DUTCH_HUDSON]);
 const essequibo={...dutch,entity:'dutch-essequibo',name:'Essequibo (Dutch settlements)',nameRu:'Эссекибо (нидерландские поселения)',memberOf:[]};
 restore(8648,0,1619,1621,essequibo);restore(8648,1,1619,1621,{...dutch,entity:'dutch-hudson-trading-posts',name:'Dutch Hudson River settlements',nameRu:'Нидерландские поселения на Гудзоне',memberOf:[]});
 restore(8670,0,1622,1625,essequibo);restore(8712,0,1626,1628,essequibo);exclude(8663,1619,1628,[0,4],dutch);
 const guiana={...essequibo,reason:'Dutch trading settlements in Essequibo formed a separate colonial territory from New Netherland; the source outline is not a verified seventeenth-century border.',reasonRu:'Нидерландские поселения в Эссекибо образовывали отдельное колониальное владение и не являлись частью Новых Нидерландов. Исходная граница XVII века не подтверждена.',sources:[DUTCH_GUYANA,DUTCH_WIC]};
 const brazil={...d('Dutch Brazil was a separate West India Company colony, not New Netherland. Its last occupied forts surrendered in January 1654. The contemporary source outlines are generalized.','Голландская Бразилия была отдельным владением Вест-Индской компании, а не частью Новых Нидерландов; последние укрепления капитулировали в январе 1654 г. Контуры источника генерализованы.',[DUTCH_BRAZIL,DUTCH_BRAZIL_CAPITULATION]),entity:'dutch-brazil',name:'Dutch Brazil (New Holland)',nameRu:'Голландская Бразилия (Новая Голландия)',memberOf:[]};
 const recife={...brazil,entity:'portuguese-recife',name:'Portuguese Brazil (Recife region)',nameRu:'Португальская Бразилия (район Ресифи)',reasonRu:'Последние нидерландские укрепления капитулировали в январе 1654 года. Район Ресифи возвращён Португалии; сохранён исходный обобщённый контур.'};
 const english={...d('England seized New Netherland in 1664, dividing it into New York and New Jersey. The source outline combines the regional English claims and does not establish exact colonial or indigenous boundaries.','Англия захватила Новые Нидерланды в 1664 г. и разделила их на Нью-Йорк и Нью-Джерси; исходный контур не устанавливает точные границы колоний и коренных народов.',[NEW_NETHERLAND_TRANSFER,'https://www.loc.gov/item/today-in-history/may-04/']),entity:'english-new-york-region',name:'English colonies of New York and New Jersey (source region)',nameRu:'Английские колонии Нью-Йорк и Нью-Джерси (сводный контур)',memberOf:[]};
 const uncertain=(source,part,from,to,group,reason,reasonRu,sources)=>{const decision=d(reason,reasonRu,sources),polygon=rawParts(features[source])[part];exclude(source,from,to,[part],decision);pending.push({source,part,from,to,hash:componentHash(polygon),group,reason:reasonRu,counterpartName:group,evidence:sources[0],sources,geometry:{type:'Polygon',coordinates:polygon}});};
 for(const [source,es,braz,tob,sint,abc,north] of [[8725,0,-1,1,2,[],3],[8771,1,0,2,3,[],4],[8797,1,0,-1,5,[2,3,4],6],[8841,1,0,-1,5,[2,3,4],6],[8901,1,0,-1,5,[2,3,4],6],[8935,1,0,-1,5,[2,3,4],6],[8973,1,0,-1,5,[2,3,4],6],[8998,1,0,-1,5,[2,3,4],6],[9029,0,-1,1,5,[2,3,4],6],[9090,0,-1,1,5,[2,3,4],6],[9135,0,-1,-1,4,[1,2,3],-1]]){
  const f=features[source],from=f.properties.FromYear,to=f.properties.ToYear;
  restore(source,es,from,to,from<1670?guiana:{...guiana,entity:'dutch-guiana',name:'Dutch Guiana (source region)',nameRu:'Нидерландская Гвиана (сводный контур)',reasonRu:'Сводный контур в Гвиане не является частью Новых Нидерландов; границы отдельных поселений требуют отдельной реконструкции.'});
  if(braz>=0){if(from<1654)restore(source,braz,from,Math.min(to,1653),brazil);if(to>=1654)restore(source,braz,Math.max(from,1654),to,recife);}
  if(north>=0&&to>=1664)restore(source,north,Math.max(from,1664),to,english);
  for(const [j,part] of abc.entries()){
   const [entity,name,nameRu,url]=[['curacao','Curaçao (Dutch colony)','Кюрасао (нидерландская колония)',DUTCH_CURACAO],['bonaire','Bonaire (Dutch colony)','Бонайре (нидерландская колония)',DUTCH_BONAIRE],['aruba','Aruba (Dutch colony)','Аруба (нидерландская колония)',DUTCH_ARUBA]][j];
   restore(source,part,from,to,{...d('The ABC islands were administered by the Dutch West India Company after the respective conquests in 1634–36, separately from the North American colony.','Острова АВС после завоеваний 1634–1636 гг. управлялись Нидерландской Вест-Индской компанией отдельно от североамериканской колонии.',[url,DUTCH_WIC]),entity,name,nameRu,memberOf:[]});
  }
  const spanish=saintMartinSpanish.periods.find(([s])=>s===source);
  if(spanish){assert.equal(spanish[1],sint);exclude(source,spanish[2],spanish[3],[sint],d('Spanish occupation of Saint Martin, 1633–1647.','Испанская оккупация Сен-Мартена в 1633–1647 гг.',saintMartinSpanish.sources));}
  for(const [a,b] of spanish?[[from,spanish[2]-1],[spanish[3]+1,to]]:[[from,to]])if(a<=b)uncertain(source,sint,a,b,'Сен-Мартен — раздел острова','The whole-island source outline cannot be attributed to New Netherland; the 1648 Concordia Treaty provided for Franco-Dutch partition but did not fix the precise line. Earlier colonial settlement control needs separate documentation.','Весь остров не относится к Новым Нидерландам. Договор Конкордия 1648 г. предусматривает франко-нидерландский раздел без точного установления границы; более ранний контроль поселений требует отдельных документов.',[SAINT_MARTIN_PARTITION,'https://www.diplomatie.gouv.fr/en/information-by-country/netherlands/france-and-the-netherlands']);
  if(tob>=0){const dutchTobago=tobagoDutch.periods.find(([s])=>s===source);
   if(dutchTobago){assert.equal(dutchTobago[1],tob);exclude(source,dutchTobago[2],dutchTobago[3],[tob],d('Dutch colonial administration of Tobago after the Courland surrender.','Нидерландская колониальная администрация Тобаго после капитуляции курляндцев.',tobagoDutch.sources));}
   for(const [a,b] of dutchTobago?[[from,dutchTobago[2]-1],[dutchTobago[3]+1,to]]:[[from,to]])if(a<=b)uncertain(source,tob,a,b,'Тобаго — колониальные поселения','The whole-island outline does not establish the geographical extent of Dutch, Courlander, or indigenous control, including the 1628 Dutch settlement and later changes.','Контур всего острова не устанавливает границы нидерландских, курляндских поселений и земель коренных народов, включая поселение 1628 г. и позднейшие переходы.',[TOBAGO_HISTORY,'https://www.nalis.gov.tt/resources/tt-content-guide/towns-and-villages/towns-and-villages-s-z/']);
  }
 }
 const occupation=d('The metropolitan Netherlands was occupied by German forces in May 1940. Its government remained in exile; the colonial overlay must not duplicate the German occupation polygon.','Метрополия Нидерландов оккупирована немецкими войсками в мае 1940 г. Правительство оставалось в изгнании; колониальный слой не должен дублировать контур немецкой оккупации.',[DUTCH_1940]);
 exclude(12755,1940,1940,[17],occupation);
 const reunion={...d('Bourbon was handed back to France on 6 April 1815. It was a separate colonial administration, not one of the five French Indian settlements.','Остров Бурбон возвращён Франции 6 апреля 1815 г.; это отдельная колониальная администрация, а не один из пяти французских анклавов Индии.',[REUNION_RESTITUTION,REUNION_HISTORY]),entity:'ile-bourbon',name:'Île Bourbon (French colony)',nameRu:'Остров Бурбон (французская колония)',memberOf:[]};
 restore(10975,48,1815,1819,reunion);exclude(10959,1815,1819,[99],reunion);exclude(10953,1815,1819,[106],reunion);
 for(const source of [11071,11329,11407]){const f=features[source];restore(source,0,f.properties.FromYear,f.properties.ToYear,reunion);}
 const restitution=d('The five settlements were returned in December 1816–April 1817. The dated source presents French territory and parts of the British outline over the same land; remove the overlap from British control without claiming cadastral precision.','Пять поселений возвращены в декабре 1816 — апреле 1817 гг. Датированные контуры французской и британской территорий частично перекрываются; перекрытие исключено из британской заливки. Кадастровая точность границы не заявляется.',[INDIA_RESTITUTION,INDIA_OCCUPATION]);
 for(const [source,parts] of [[11071,[5,6,7,8,9]],[11329,[5,7,8,9,10]],[11407,[1,2,3,4,5]]]){
  const f=features[source];for(const [target,g] of features.entries()){
   if(!['British Empire','(British Empire)'].includes(g.properties.Name))continue;
   const from=Math.max(f.properties.FromYear,g.properties.FromYear),to=Math.min(f.properties.ToYear,g.properties.ToYear);if(from>to)continue;
   for(const part of parts){const polygon=rawParts(f)[part];if(polygonClipping.intersection(rawParts(g),polygon).length)subtractions.push({target,source,part,from,to,decision:restitution});}
  }
 }
 // All five Indian enclaves in the later source are repeatedly attached to
 // metropolitan France, New Caledonia, and then French Indochina. Match the
 // pinned footprints, not a loose geographic name or a modern border.
 const indiaArchive='https://rdf.archives-nationales.culture.gouv.fr/garance/entities/agent/FRAN_RI_013-d3m0bo6nd5i-1kc429fvh2r1t/?lang=en';
 const india1940='https://www.cheminsdememoire.gouv.fr/de/node/7707';
 const indiaTransfer='https://statistics.py.gov.in/sites/default/files/ii-iv-freedom-movement.pdf';
 const indiaCession='https://www.py.gov.in/sites/default/files/lawvol1.pdf';
 const lateIndia={...d('The five French establishments in India were a separate administration; their source footprints are generalized, not surveyed boundaries. They rallied to Free France in September 1940. Chandernagore passed to Indian administration on 2 May 1950; the remaining four on 1 November 1954.','Пять французских поселений в Индии составляли отдельную администрацию; исходные контуры генерализованы, а не кадастровые границы. В сентябре 1940 г. они присоединились к Свободной Франции. Чандернагор перешёл под управление Индии 2 мая 1950 г., остальные четыре — 1 ноября 1954 г.',[indiaArchive,india1940,indiaTransfer,indiaCession]),name:'French India',nameRu:'Французская Индия',entity:'french-india',identitySource:11407};
 const ceded={...lateIndia,allowSourceOverlap:true,group:'Индия — передача поселений'};
 const indianCells=rawParts(features[11464]).slice(7);assert.equal(indianCells.length,5);
 const indianHashes=indianCells.map(componentHash),chandernagoreHashes=[indianHashes[4],componentHash(rawParts(features[11657])[5])];indianHashes.push(chandernagoreHashes[1]);
 const isIndian=p=>indianHashes.includes(componentHash(p));
 const caveat=' The inherited outline has cartographic generalization; no new surveyed boundary is implied.';
 const reunionDecision={...d('Réunion was a separate French colony, not New Caledonia or Indochina; it rallied to Free France on 28 November 1942 and became an overseas department on 19 March 1946.'+caveat,'Реюньон — отдельная французская колония, не часть Новой Каледонии или Индокитая; присоединился к Свободной Франции 28 ноября 1942 г., стал заморским департаментом 19 марта 1946 г. Береговой контур генерализован.',[REUNION_HISTORY,'https://www.departement974.fr/actualite/19-mars-1793-19-mars-1946-dun-19-mars-lautre-reunion-change-de-nom-de-statut-2023','https://www.cheminsdememoire.gouv.fr/fr/1942-11-28-la-reunion-se-rallie-la-france-libre']),entity:'ile-bourbon',name:'Réunion (French colony)',nameRu:'Реюньон (французская колония)'};
 const ncDecision={...d('New Caledonia administered separately from French Indochina. The archipelago joined Free France in September 1940 and became an overseas territory in 1946.'+caveat,'Новая Каледония управлялась отдельно от Французского Индокитая. В сентябре 1940 г. присоединилась к Свободной Франции, с 1946 г. — заморская территория. Береговые контуры генерализованы.',['https://service-public.nc/article/repartition-des-competences-en-nouvelle-caledonie','https://www.cheminsdememoire.gouv.fr/fr/la-nouvelle-caledonie-dans-les-deux-guerres-mondiales']),entity:'new-caledonia',identitySource:11576,identitySourceName:'New Caledonia',name:'New Caledonia',nameRu:'Новая Каледония (французская колония)'};
 const kerguelenDecision={...d('French sovereignty over Kerguelen was reaffirmed in 1893. Administration was attached to Madagascar in 1924 and the islands became a district of the French Southern and Antarctic Lands on 6 August 1955. They were never part of Indochina.'+caveat,'Франция подтвердила суверенитет над Кергеленом в 1893 г.; в 1924 г. архипелаг административно присоединён к Мадагаскару, 6 августа 1955 г. стал округом Французских Южных и Антарктических территорий. К Индокитаю не относился. Береговой контур генерализован.',['https://taaf.fr/actualite/crozet-et-kerguelen-250-ans-dhistoire-et-de-decouvertes/','https://taaf.fr/actualite/2-janvier-1893-une-date-historique-pour-kerguelen/','https://www.cheminsdememoire.gouv.fr/fr/revue/80-ans-apres-1942']),entity:'kerguelen',name:'Kerguelen (French possession)',nameRu:'Кергелен (французское владение)'};
 const isReunion=p=>componentHash(p)===componentHash(rawParts(features[11464])[6]);
 const ncHashes=[0,1,3].map(part=>componentHash(rawParts(features[11576])[part]));
 const isNC=p=>ncHashes.includes(componentHash(p));
 const loyalty=d('French military assertion of authority in the Loyalty Islands began on Lifou in 1864 and reached Maré in 1865. The 1853 declaration over New Caledonia and its dependencies did not establish effective control of these islands; local chiefly jurisdictions and exact borders remain unknown.','Установление французской власти на островах Луайоте началось с военной экспедиции на Лифу в 1864 г. и распространилось на Маре в 1865 г. Декларация 1853 г. о Новой Каледонии и её зависимостях не означает фактического контроля над этими островами; точное деление местных вождеств не установлено.',['https://www.unc.nc/wp-content/uploads/2021/11/Understanding-New-Caledonia-Web.pdf','https://www.persee.fr/doc/outre_0300-9513_1998_num_85_319_3652_t1_0174_0000_1','https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000000555817']);
 const loyaltyDate=new Map([[ncHashes[0],1865],[ncHashes[2],1864]]);
 const kerguelenHashes=[12107,12155].map(i=>componentHash(rawParts(features[i])[0]));
 const restoreGroup=(source,parts,from,to,decision)=>{
  exclude(source,from,to,parts,decision);const coordinates=parts.map(part=>rawParts(features[source])[part]);
  restorations.push({source,part:parts[0],parts,from,to,hash:sha256(JSON.stringify(coordinates)),group:'Разделение французских владений',decision,geometry:{type:'MultiPolygon',coordinates}});
 };
 const frenchGroups=features.flatMap((f,index)=>/^\((French Second Republic|Second French Empire|French Third Republic|Vichy France|French Fourth Republic)\)$/.test(f.properties.Name)&&f.properties.FromYear>=1848&&f.properties.ToYear<=1957?[index]:[]);
 const links=(source,parts,from,to,decision,freeFrom)=>{
  // Retain the imperial outline only for the actual allegiance. The 1944
  // Africa-only source overlay is intentionally not expanded to a full empire.
  for(const target of frenchGroups){const f=features[target];const start=Math.max(from,f.properties.FromYear),end=Math.min(to,f.properties.ToYear);if(start>end)continue;
   const hashes=parts.map(part=>componentHash(rawParts(features[source])[part]));
   const present=rawParts(f).flatMap((p,i)=>hashes.includes(componentHash(p))?[i]:[]);
   if(f.properties.Name==='(Vichy France)'&&start>=freeFrom){if(present.length)exclude(target,start,end,present,decision);continue;}
   if(start===1944)continue;
   const missing=parts.filter(part=>!present.some(i=>componentHash(rawParts(f)[i])===componentHash(rawParts(features[source])[part])));
   if(missing.length)addParts(source,target,start,end,missing,decision);
   groupLinks.push({target,from:start,to:end,name:decision.name,decision});
  }
 };
 // The next source series continues to aggregate the whole Comoro archipelago
 // under French Africa, then metropolitan France, from 1846 until independence.
 // Keep legal colonial status separate from actual island-level power.
 const comoroAdministration='https://mjp.univ-perp.fr/constit/km1896.htm',comoroModern='https://mjp.univ-perp.fr/constit/km.htm',comoroFrance='https://www.diplomatie.gouv.fr/fr/priorites-et-actions/grands-dossiers/la-strategie-de-la-france-dans-lindopacifique/l-espace-indopacifique-une-priorite-pour-la-france/l-union-des-comores-et-mayotte';
 const comoroDecision=(entity,name,nameRu,reason,reasonRu)=>({...d(reason,reasonRu,[comoroTreaties,comoroAdministration,comoroHistory,comoroModern,comoroFrance]),entity,name,nameRu});
 const comoroLocal=[null,comoroDecision('historical-moheli','Mohéli (local rulers)','Мохели (местные правители)','Separate local island authority before the French protectorate treaty of 26 April 1886; this is an island outline, not a surveyed dynastic frontier.','Местные правители Мохели до договора о протекторате 26 апреля 1886 г.; контур острова не устанавливает точные пределы власти отдельных династий.'),comoroDecision('historical-anjouan','Anjouan (sultanate)','Анжуан (султанат)','Separate sultanate before the French protectorate treaty of 21 April 1886; this is a generalized coastline.','Отдельный султанат до договора о французском протекторате 21 апреля 1886 г.; береговой контур генерализован.')];
 const mayotteColony=comoroDecision('historical-mayotte','Mayotte (French colony)','Майотта (французская колония)','France formally took possession in June 1843; Mayotte remained a colony distinct from the neighboring protectorates until the 1912 reorganization.','Франция официально вступила во владение в июне 1843 г.; Майотта оставалась колонией, отличной от соседних протекторатов, до реорганизации 1912 г.');
 const protectorates=[mayotteColony,...[[1,'historical-moheli','Mohéli','Мохели','26 April','26 апреля'],[2,'historical-anjouan','Anjouan','Анжуан','21 April','21 апреля'],[3,'historical-ngazidja','Grande Comore','Нгазиджа','6 January','6 января']].map(([,entity,name,ru,date,dateRu])=>comoroDecision(entity,`${name} (French protectorate)`,`${ru} (французский протекторат)`,`The initial protectorate treaty was signed on ${date} 1886, with later complementary agreements and reorganizations; formal protectorate status, not uniform effective control.`,`Первоначальный договор о протекторате подписан ${dateRu} 1886 г.; последовали дополнительные соглашения и административные изменения. Показан юридический статус, не единообразный фактический контроль.`))];
 // Decree of 9 April 1908 attached Mayotte and its dependent protectorates to
// the Governor-General of Madagascar, but the other three islands retained
// their *protectorate* status until the annexation law of 25 July 1912.
// The 1908 change was administrative, not a new sovereignty border.
const comoroUnderMadagascar=protectorates.map((d,i)=>({
 ...d,
 name:['Mayotte (French colony, Madagascar administration)',
       'Mohéli (French protectorate, Madagascar administration)',
       'Anjouan (French protectorate, Madagascar administration)',
       'Grande Comore (French protectorate, Madagascar administration)'][i],
 nameRu:['Майотта (французская колония; управление через Мадагаскар)',
         'Мохели (французский протекторат; управление через Мадагаскар)',
         'Анжуан (французский протекторат; управление через Мадагаскар)',
         'Нгазиджа (французский протекторат; управление через Мадагаскар)'][i],
 reason:d.reason+' The decree of 9 April 1908 subordinated the colonial administration to the Madagascar Governor-General, without abolishing the three protectorates before 1912.',
 reasonRu:d.reasonRu+' По декрету от 9 апреля 1908 г. административное руководство островами перешло генерал-губернаторству Мадагаскара; статус трёх протекторатов сохранялся до закона от 25 июля 1912 г.',
 sources:[...new Set([...d.sources,comoroAdministration,'https://www.persee.fr/doc/outre_1631-0438_2005_num_92_348_4160'])]
}));
const comoroColony=comoroDecision('comoros-colonial','Comoros (Madagascar dependencies)','Коморы (зависимости Мадагаскара)','The 1908 decree attached Mayotte and the protectorates to Madagascar; the 25 July 1912 law annexed the three protectorates. During WWII the archipelago was affected by the British intervention and Free French transition. Colonial jurisdiction, not precise military control.','Декрет 1908 г. подчинил Майотту и протектораты Мадагаскару; закон от 25 июля 1912 г. превратил три протектората в колонии. Во Вторую мировую войну архипелаг затронули британская операция и переход к Свободной Франции. Показана колониальная юрисдикция, не точные пределы военного контроля.');
 const comoroTerritory=comoroDecision('comoros-colonial','Comoros (French overseas territory)','Коморы (заморская территория Франции)','The archipelago became a separate overseas territory under the 1946 law; internal autonomy followed in 1961.','В 1946 г. архипелаг стал самостоятельной заморской территорией Франции; в 1961 г. получил внутреннюю автономию.');
 const comoroAutonomous={...comoroTerritory,name:'Comoros (autonomous French overseas territory)',nameRu:'Коморы (автономная заморская территория Франции)'};
 const comoroUncertain=comoroDecision('historical-ngazidja','Grande Comore (local sultanates)','Нгазиджа (местные султанаты)','Several rival sultanates existed on Ngazidja before the 1886 protectorate; no year-specific territorial partition has been established.','На Нгазидже до договора 1886 г. существовали соперничающие местные султанаты; точное ежегодное разделение территории не установлено.');
 const comoroOverlays=features.flatMap((f,target)=>f.properties.Components&&f.properties.ToYear>=1846&&f.properties.FromYear<=1974&&/French|France/.test(f.properties.Name)?[{target,f,parts:rawParts(f).flatMap((p,part)=>earlyComorosHashes.includes(componentHash(p))?[{part,hash:componentHash(p)}]:[])}]:[]).filter(x=>x.parts.length);
 let comoroReviewed=0,comoroPending=0;
 for(const [source,f] of features.entries()){
  const {Name:name,FromYear:from,ToYear:to}=f.properties;if(to<1846||from>1974||!['French Africa','French Fifth Republic'].includes(name))continue;
  const parts=earlyComorosHashes.map(h=>rawParts(f).findIndex(p=>componentHash(p)===h));assert.ok(parts.every(i=>i>=0),`Comoro source ${source}`);
  const overlay=(selected,a,b,decision,local=false)=>{for(const {target,f,parts:overlayParts} of comoroOverlays){const start=Math.max(a,f.properties.FromYear),end=Math.min(b,f.properties.ToYear);if(start>end)continue;const matching=overlayParts.filter(p=>selected.some(i=>componentHash(rawParts(features[source])[i])===p.hash)).map(p=>p.part);if(!matching.length)continue;if(local||f.properties.Name==='(Vichy France)'&&start>=1942)exclude(target,start,end,matching,decision);else groupLinks.push({target,from:start,to:end,name:decision.name,decision});}};
  const first=Math.max(from,1846),last=Math.min(to,1974);
  for(const [a,b,mode] of [[first,Math.min(last,1885),'local'],[Math.max(first,1886),Math.min(last,1907),'protectorate'],[Math.max(first,1908),Math.min(last,1911),'madagascar-protectorate'],[Math.max(first,1912),Math.min(last,1945),'colony'],[Math.max(first,1946),Math.min(last,1960),'territory'],[Math.max(first,1961),last,'autonomy']])if(a<=b){
   if(mode==='local'){
    for(let i=0;i<3;i++){const decision=i===0?mayotteColony:comoroLocal[i];restoreGroup(source,[parts[i]],a,b,decision);overlay([parts[i]],a,b,decision,i!==0);comoroReviewed+=b-a+1;}
    uncertain(source,parts[3],a,b,'Коморы',comoroUncertain.reason,comoroUncertain.reasonRu,comoroUncertain.sources);overlay([parts[3]],a,b,comoroUncertain,true);comoroPending+=b-a+1;
   }else if(mode==='protectorate'||mode==='madagascar-protectorate'){
    const decisions=mode==='protectorate'?protectorates:comoroUnderMadagascar;
    for(let i=0;i<4;i++){restoreGroup(source,[parts[i]],a,b,decisions[i]);overlay([parts[i]],a,b,decisions[i]);comoroReviewed+=b-a+1;}
   }else{
    const decision=mode==='colony'?comoroColony:mode==='territory'?comoroTerritory:comoroAutonomous;
    restoreGroup(source,parts,a,b,decision);overlay(parts,a,b,decision);comoroReviewed+=4*(b-a+1);
   }
  }
 }
 assert.equal(comoroReviewed,476);assert.equal(comoroPending,40);
 let indianYears=0,reunionYears=0,ncYears=0,kerguelenYears=0,loyaltyYears=0;
 for(const [source,f] of features.entries()){
  const {Name:name,FromYear:from,ToYear:to}=f.properties;
  if(from<1848||to>1957||!['French Second Republic','Second French Empire','New Caledonia','French Indochina'].includes(name))continue;
  const parts=rawParts(f),indiaParts=parts.flatMap((p,i)=>isIndian(p)?[i]:[]),reunionParts=parts.flatMap((p,i)=>isReunion(p)?[i]:[]),ncParts=parts.flatMap((p,i)=>isNC(p)?[i]:[]),kerguelenParts=parts.flatMap((p,i)=>kerguelenHashes.includes(componentHash(p))?[i]:[]);
  if(indiaParts.length){assert.equal(indiaParts.length,5);indianYears+=indiaParts.length*(to-from+1);exclude(source,from,to,indiaParts,lateIndia);
   for(const [a,b] of [[from,Math.min(to,1949)],[Math.max(from,1950),Math.min(to,1953)]])if(a<=b){
    const selected=indiaParts.filter(i=>a<1950||!chandernagoreHashes.includes(componentHash(parts[i])));
    restoreGroup(source,selected,a,b,lateIndia);links(source,selected,a,b,lateIndia,1940);
    for(const [target,g] of features.entries()){
     if(!['British Empire','(British Empire)','British Raj','Republic of India'].includes(g.properties.Name))continue;
     const start=Math.max(a,g.properties.FromYear),end=Math.min(b,g.properties.ToYear);if(start>end)continue;
     for(const part of selected)if(polygonClipping.intersection(rawParts(g),parts[part]).length)subtractions.push({target,source,part,from:start,to:end,decision:lateIndia});
    }
   }
   for(const [a,b,selected] of [[Math.max(from,1950),Math.min(to,1953),indiaParts.filter(i=>chandernagoreHashes.includes(componentHash(parts[i])) )],[Math.max(from,1954),to,indiaParts]])if(a<=b){
    for(const target of frenchGroups){const g=features[target],start=Math.max(a,g.properties.FromYear),end=Math.min(b,g.properties.ToYear);if(start>end)continue;
     const remove=rawParts(g).flatMap((p,i)=>selected.some(part=>componentHash(parts[part])===componentHash(p))?[i]:[]);if(remove.length)exclude(target,start,end,remove,lateIndia);
    }
    for(const [target,g] of features.entries())if(g.properties.Name==='Republic of India'){
     const start=Math.max(a,g.properties.FromYear),end=Math.min(b,g.properties.ToYear);if(start>end)continue;
     for(const part of selected)if(polygonClipping.difference(parts[part],rawParts(g)).length)addParts(source,target,start,end,[part],ceded);
    }
   }
  }
  if(reunionParts.length){assert.equal(reunionParts.length,1);reunionYears+=to-from+1;
   for(const [a,b,decision] of [[from,Math.min(to,1945),reunionDecision],[Math.max(from,1946),to,{...reunionDecision,name:'Réunion (French overseas department)',nameRu:'Реюньон (заморский департамент Франции)'}]])if(a<=b){restoreGroup(source,reunionParts,a,b,decision);links(source,reunionParts,a,b,decision,1942);}
  }
  if(ncParts.length&&['New Caledonia','French Indochina'].includes(name)){
   for(const part of ncParts){const start=loyaltyDate.get(componentHash(parts[part]));if(!start||from>=start)continue;const end=Math.min(to,start-1);loyaltyYears+=end-from+1;uncertain(source,part,from,end,'Луайоте — местные вождества',loyalty.reason,loyalty.reasonRu,loyalty.sources);
    for(const target of frenchGroups){const g=features[target],a=Math.max(from,g.properties.FromYear),b=Math.min(end,g.properties.ToYear);if(a>b)continue;const remove=rawParts(g).flatMap((p,i)=>componentHash(p)===componentHash(parts[part])?[i]:[]);if(remove.length)exclude(target,a,b,remove,loyalty);}
   }
   if(name==='French Indochina'){assert.equal(ncParts.length,3);ncYears+=3*(to-from+1);
    for(const [a,b,decision] of [[from,Math.min(to,1863),ncDecision],[Math.max(from,1864),Math.min(to,1864),ncDecision],[Math.max(from,1865),Math.min(to,1945),{...ncDecision,reason:ncDecision.reason+' '+loyalty.reason,reasonRu:ncDecision.reasonRu+' После установления колониального управления границы местных вождеств и фактический охват власти не показаны.',sources:[...ncDecision.sources,...loyalty.sources]}],[Math.max(from,1946),to,{...ncDecision,nameRu:'Новая Каледония (заморская территория Франции)'}]])if(a<=b){const selected=ncParts.filter(part=>(loyaltyDate.get(componentHash(parts[part]))??0)<=a);restoreGroup(source,selected,a,b,decision);links(source,selected,a,b,decision,1940);}
   }
  }
  if(name==='French Indochina'&&kerguelenParts.length){assert.equal(kerguelenParts.length,1);kerguelenYears+=to-from+1;
   for(const [a,b,decision] of [[from,Math.min(to,1923),kerguelenDecision],[Math.max(from,1924),Math.min(to,1954),{...kerguelenDecision,name:'Kerguelen (dependency of French Madagascar)',nameRu:'Кергелен (владение Франции, под управлением Мадагаскара)'}],[Math.max(from,1955),to,{...kerguelenDecision,name:'Kerguelen (French Southern and Antarctic Lands)',nameRu:'Кергелен (Французские Южные и Антарктические территории)'}]])if(a<=b){restoreGroup(source,kerguelenParts,a,b,decision);links(source,kerguelenParts,a,b,decision,1942);}
  }
 }
 assert.equal(indianYears,540);assert.equal(reunionYears,110);assert.equal(ncYears,294);assert.equal(kerguelenYears,63);assert.equal(loyaltyYears,17);
 // All nine treaty-port concessions are misrepresented by oversized source
 // cells. They were municipal administrations on the Hai River, not broad
 // sovereign territories. Preserve original footprints as provenance; repair
 // the underlying regional control only in independently documented years.
 const tianjin=d('The nine Tianjin concessions were confined to an urban area along the Hai River. The oversized source footprints are not surveyed concession boundaries. For the world map, use the documented surrounding regional authority; the concessions themselves require a separate municipal-scale layer.','Девять концессий Тяньцзиня располагались в городской зоне вдоль Хайхэ, а не на десятках километров вокруг города. Исходные крупные ячейки не являются границами концессий. На мировой карте восстанавливается подтверждённая принадлежность окружающей территории; точные городские границы концессий требуют отдельного слоя.',['https://journals.open.tudelft.nl/iphs/article/download/2751/2962/','https://archivesdiplomatiques.diplomatie.gouv.fr/ark%3A/14366/tdp05kl67vqh','https://www.cambridge.org/core/journals/urban-history/article/multiimperial-dimensions-in-treatyport-tianjin-and-its-historiographical-significance/B0D546345E6077BF4C7AAD7872AC0399','https://history.state.gov/historicaldocuments/frus1928v02/d100','https://history.state.gov/historicaldocuments/frus1937v03/ch1subch3']);
 const tianjinTransfer={...tianjin,group:'Тяньцзинь — фон',allowSourceOverlap:true,sources:[...tianjin.sources,'https://history.state.gov/historicaldocuments/frus1902/d159','https://history.state.gov/historicaldocuments/frus1901China/d122']};
 const tianjinNames=new Set(['French Indochina','British Colonial Empire','United States of America','German Empire','Empire of Japan','Russian Empire','Kingdom of Belgium','Kingdom of Italy','Austria-Hungary']);
 const box=p=>{let x=180,y=90,X=-180,Y=-90;for(const [a,b] of p[0]){x=Math.min(x,a);y=Math.min(y,b);X=Math.max(X,a);Y=Math.max(Y,b);}return [x,y,X,Y];};
 const intersectsBox=(a,b)=>a[0]<b[2]&&a[1]<b[3]&&a[2]>b[0]&&a[3]>b[1];
 const tianjinLocal=features.flatMap((f,source)=>{
  const {Name:name,FromYear:from,ToYear:to}=f.properties;if(to<1860||from>1946||f.properties.Type!=='POLITY'||f.properties.Components)return [];
  return rawParts(f).flatMap((p,part)=>{const b=box(p);if(!intersectsBox(b,[116.5,38.5,118.3,40.2]))return [];
   const cell=tianjinNames.has(name)&&b[0]>116.5&&b[2]<118.3&&b[1]>38.5&&b[3]<40.2;
   // The southern Japanese wartime/garrison corridor is NOT a separate
   // Japanese sovereign territory. The 1901 Boxer Protocol (Article IX)
   // granted occupation of communication points, not cession to Japan.
   // Unlike the urban concession, this large shape is near Tanggu/Taku.
   // Exact spatial/date/identity guards prevent removing Japanese land elsewhere.
   if(cell&&name==='Empire of Japan'&&b[1]<39){
    assert.equal(f.properties.Wikidata,'Q188712','Tianjin southern Japanese source identity');
    assert.ok(from>=1900&&to<=1937&&b[0]>117.26&&b[0]<117.27&&
     b[1]>38.73&&b[1]<38.75&&b[2]>117.70&&b[2]<117.72&&
     b[3]>38.99&&b[3]<39,
     'New southern occupied source cell must match the pinned Taku/Tanggu corridor');
   }
   return [{source,part,from,to,name,p,b,cell}];});
 });
 const tianjinCells=tianjinLocal.filter(c=>c.cell);assert.equal(tianjinCells.length,135);
 const tianjinJapaneseSouthSourceIndices=new Set([12182,12260,12306,12371,12440,12522,12577,12617,12632,12649,12667,12678,12712,12777]);
 const southernJapaneseRows=tianjinCells.filter(c=>c.name==='Empire of Japan'&&c.b[1]<39);
 assert.deepEqual(southernJapaneseRows.map(c=>c.source),[...tianjinJapaneseSouthSourceIndices]);
 assert.equal(southernJapaneseRows.reduce((sum,c)=>sum+(c.to-c.from+1),0),38);
 for(const row of southernJapaneseRows)
  assert.ok(tianjinJapaneseSouthSourceIndices.has(row.source)&&row.from>=1900&&row.to<=1937,
   'Pinned false Japanese corridor source index/interval unexpectedly changed');
 const tianjinHashes=new Set(tianjinCells.map(c=>componentHash(c.p)));
 assert.deepEqual(Object.fromEntries([...tianjinNames].map(n=>[n,tianjinCells.filter(c=>c.name===n).reduce((sum,c)=>sum+c.to-c.from+1,0)])),{'French Indochina':86,'British Colonial Empire':86,'United States of America':12,'German Empire':19,'Empire of Japan':78,'Russian Empire':34,'Kingdom of Belgium':36,'Kingdom of Italy':42,'Austria-Hungary':12});
 for(const c of tianjinCells)exclude(c.source,c.from,c.to,[c.part],tianjin);
 for(const [target,f] of features.entries())if(f.properties.Components&&f.properties.FromYear>=1860&&f.properties.ToYear<=1946){const parts=rawParts(f).flatMap((p,i)=>tianjinHashes.has(componentHash(p))?[i]:[]);if(parts.length)exclude(target,f.properties.FromYear,f.properties.ToYear,parts,tianjin);}
 // 1916: Hongxian abolished 22 March; 1917–27: Beiyang ROC authority,
// not the KMT party; 1936: Chinese municipal government before Japan took
// Tianjin in July 1937. These are corrections of the surrounding background,
// NOT polygons purporting to trace any foreign municipal concession.
 const tianjinOwner=tianjinReviewedSourceOwner;
 const openRanges=new Map(),transferRanges=new Map();let tianjinResolved=0,tianjinPending=0;
 for(let year=1860;year<=1946;year++){
  const local=tianjinLocal.filter(c=>c.from<=year&&year<=c.to),cells=local.filter(c=>c.cell),owner=tianjinOwner(year),base=local.filter(c=>!c.cell&&c.name===owner);
  const targets=new Set(base.map(c=>c.source));if(owner)assert.equal(targets.size,1,`Tianjin regional owner ${year}`);
  // Protect against attributing the city to any identically named later row.
  if(year>=1900&&year<=1902||year===1916||year>=1917&&year<=1927||year===1936){
   const expected=year<=1902?'Q8733':year===1916?'Q175379':year<=1927?'Q31113':'Q148';
   assert.equal(features[base[0].source].properties.Wikidata,expected,
    `Incorrect dated Chinese source identity in Tianjin ${year}`);
  }
  const target=base[0]?.source;let covered=base.map(c=>c.p);
  for(const c of cells){
   const competition=local.some(o=>!o.cell&&o.name!==owner&&intersectsBox(c.b,o.b)&&polygonClipping.intersection(c.p,o.p).length);
   if(!owner||competition){
    tianjinPending++;const key=`${c.source}/${c.part}`,range=openRanges.get(key);
    if(range&&range.to===year-1)range.to=year;
    else{const issue={source:c.source,part:c.part,from:year,to:year,hash:componentHash(c.p),group:'Тяньцзинь — концессия',reason:`${tianjin.reasonRu} В этой редакции принадлежность исходной ячейки требует проверки переходного периода, конкурирующего контура или региональной власти.`,counterpartName:'Китай / иностранные концессии',evidence:tianjin.sources[0],sources:tianjin.sources,geometry:{type:'Polygon',coordinates:c.p}};openRanges.set(key,issue);pending.push(issue);}
    continue;
   }
   tianjinResolved++;
   if(!polygonClipping.difference(c.p,...covered).length)continue;
   const key=`${c.source}/${c.part}/${target}`,range=transferRanges.get(key);
   if(range&&range.to===year-1)range.to=year;
   else{const entry={source:c.source,part:c.part,target,from:year,to:year,decision:tianjinTransfer};transferRanges.set(key,entry);transfers.push(entry);}
   covered=polygonClipping.union(...covered,c.p);
  }
 }
 // Reviewed source components: 1900–02 (3×6), 1916 (9), 1917–27 (11×5), 1936 (4);\n // plus 38 Japanese southern source-years 1900–37, and 5 previously competing\n // German source cells 1900–04 after the false southern Japanese overlap is excluded.
 // 128 original false-foreign political component-years are now assigned
 // to the documented surrounding Chinese state row rather than left unresolved.
 assert.equal(tianjinResolved,397);assert.equal(tianjinPending,8);
 // The 1859 conquest of Saigon must not be confused with the later cession
 // of Cochinchina; this source has already painted most of the Mekong delta.
 const saigon=d('The French campaign began in 1858 and seized Saigon in 1859. The treaty of 5 June 1862 ceded the three eastern provinces and Poulo Condor; the three western provinces were annexed in June 1867, recognized by treaty in 1874. The identical source extent for 1859–1867 cannot substantiate French control of all these mainland areas before 1867.','Французская кампания началась в 1858 г., Сайгон был захвачен в 1859 г. По договору от 5 июня 1862 г. переданы три восточные провинции и Пуло-Кондор; три западные провинции аннексированы в июне 1867 г., уступка признана договором 1874 г. Одинаковый исходный контур 1859–1867 гг. не подтверждает контроль Франции над всей областью до 1867 г.',['https://mjp.univ-perp.fr/constit/vn1862.htm','https://archives-nationales-outre-mer.culture.gouv.fr/faire-une-recherche/indochine','https://www.musee-armee.fr/ExpoIndochine/pdf/MA_ExpoIndochine_Livretvisite.pdf']);
 for(const part of [9,10])uncertain(11657,part,1859,1859,'Кохинхина — кампания 1859 года',saigon.reason,saigon.reasonRu,saigon.sources);
 for(const part of [9,10]){
  const hash=componentHash(rawParts(features[11657])[part]);assert.equal(componentHash(rawParts(features[11671])[part]),hash);
  uncertain(11671,part,1860,1866,'Кохинхина — поэтапная уступка',saigon.reason,saigon.reasonRu,saigon.sources);
  for(const target of frenchGroups){const g=features[target],a=Math.max(1859,g.properties.FromYear),b=Math.min(1866,g.properties.ToYear);if(a>b)continue;const remove=rawParts(g).flatMap((p,i)=>componentHash(p)===hash?[i]:[]);if(remove.length)exclude(target,a,b,remove,saigon);}
 }
 // A small Davao Gulf cell is the only raw representation of the Sultanate
 // of Maguindanao for 1612–1847 even though its principal centre was Cotabato.
 // Spanish colonial claim and actual control must not be conflated here.
 const davao=d('The Maguindanao and Buayan power centres were based in the lower and upper Pulangi valley; the source polygon instead lies in Davao Gulf. Davao contained local datus, and Dutch accounts recorded several rulers in the 1620s; Cotabato ceded Davao in 1844 but acknowledged by 1847 that the local datus no longer obeyed the sultan. Spanish effective conquest began in 1848. The source cell cannot establish a boundary for any of these authorities.','Центры Магинданао и Буаяна располагались в нижнем и верхнем течении Пуланги; исходная ячейка лежит в заливе Давао. Нидерландские сведения 1620-х гг. называют нескольких местных правителей. Султан Котабато уступил Давао в 1844 г., но к 1847 г. признал неподчинение местных дату; фактическое испанское завоевание началось в 1848 г. Контур не позволяет установить границы ни одной из этих властей.',['https://cpdo.davaocity.gov.ph/wp-content/uploads/2016/10/Vol1CLUP2013-202220151215084007.pdf','https://ecommons.cornell.edu/bitstream/handle/1813/57550/082.pdf?sequence=1andisAllowed%3Dy','https://publishing.cdlib.org/ucpressebooks/public/book/muslim-rulers-and-rebels-everyday-politics-and-armed-separatism-in-the-southern-philippines.html','https://davaocity.gov.ph/wp-content/uploads/2018/09/Davao-History.pdf']);
 const davaoCell=rawParts(features[8613])[0];assert.equal(features[8613].properties.Name,'Sultanate of Maguindanao');assert.equal(componentHash(davaoCell),componentHash(rawParts(features[11490])[0]));
 uncertain(8613,0,1612,1847,'Давао — местные правители',davao.reason,davao.reasonRu,davao.sources);
 let spanishDavaoYears=0;
 for(const [target,f] of features.entries())if(['Spanish Empire','(Spanish Empire)'].includes(f.properties.Name)&&f.properties.ToYear>=1612&&f.properties.FromYear<=1847){
  const from=Math.max(1612,f.properties.FromYear),to=Math.min(1847,f.properties.ToYear);
  if(!rawParts(f).some(p=>intersectsBox(box(p),box(davaoCell))&&polygonClipping.intersection(p,davaoCell).length))continue;
  subtractions.push({target,source:8613,part:0,from,to,decision:davao});if(!f.properties.Components)spanishDavaoYears+=to-from+1;
 }
 assert.equal(spanishDavaoYears,236);
 const geneva=d('The Geneva accords replaced French Indochina with sovereign Cambodia and Laos and provisional Vietnamese regroupment zones. Residual French military presence was not French sovereign territory.','Женевские соглашения закрепили независимость Камбоджи и Лаоса, а во Вьетнаме — временные зоны перегруппировки. Оставшееся присутствие французских войск не означает суверенитет Франции.',['https://peacemaker.un.org/en/node/9753','https://www.cheminsdememoire.gouv.fr/fr/14-septembre-1956-les-francais-quittent-lindochine']);
 exclude(13129,1954,1955,[10,11],geneva);exclude(13137,1954,1955,[22,26],geneva);
 // The small source land cell in the Vietnamese interior is not a separate
 // sovereign colony. Preserve it in the contemporary Vietnamese outline.
 exclude(13172,1956,1957,[5],geneva);exclude(13165,1956,1957,[22],geneva);addParts(13172,13153,1956,1957,[5],geneva);
 return {exclusions,transfers,restorations,subtractions,pending,groupLinks};
}

export function normalizeHistoricalSource(source) {
  assert.equal(source.type,'FeatureCollection');
  const indochinaLabel=year=>year<=1866?['French campaign in Cochinchina','Французская кампания в Кохинхине']:year===1867?['French Cochinchina','Французская Кохинхина']:year<=1884?['French Cochinchina and Cambodia (source aggregate)','Французская Кохинхина и протекторат Камбоджа (сводный контур)']:year<=1886?['French possessions in Indochina (source aggregate)','Французские владения и протектораты в Индокитае (сводный контур)']:['French Indochina','Французский Индокитай'];
  const geometries = new Map(), records = [];
  const derivedExclusions=deriveConfirmedOverlapExclusions(source.features);
  // Small synthetic fixtures do not contain the pinned source indices.
  const batch=source.features.length>REVIEWED_SOURCE_MIN_FEATURES?deriveTerritorialBatch(source.features):{exclusions:[],pending:[],resolved:[],restorations:[],relabels:new Map(),attributions:[],count:0};
  if(batch.count){const secondary=deriveSecondaryTerritorialReviews(source.features);for(const key of ['exclusions','pending','restorations','attributions'])batch[key].push(...secondary[key]);
   const coast=deriveCeylonCoastalReviews(source.features,[...derivedExclusions,...batch.exclusions]);for(const key of ['exclusions','restorations','transfers'])batch[key].push(...coast[key]);
   const cape=deriveCapeTerritoryReviews(source.features,[...derivedExclusions,...batch.exclusions]);for(const key of ['exclusions','restorations','pending'])batch[key].push(...cape[key]);
   const war=deriveCeylonWarReviews(source.features,[...derivedExclusions,...batch.exclusions]);for(const key of ['exclusions','restorations','transfers','pending'])batch[key].push(...war[key]);
   const medieval=deriveMedievalAndUnionReviews(source.features,[...derivedExclusions,...batch.exclusions]);for(const key of ['exclusions','transfers','pending'])batch[key].push(...medieval[key]);batch.groupRebuilds=medieval.groupRebuilds;
   const colonies=deriveColonialAndSalonaReviews(source.features,[...derivedExclusions,...batch.exclusions]);for(const key of ['exclusions','transfers','restorations','subtractions','pending'])batch[key].push(...colonies[key]);batch.groupLinks=colonies.groupLinks;
   // The old opposing claims remain excluded; the reconstructed three-part
   // island replaces the unresolved footprint, not either original owner.
   assert.equal(batch.pending.filter(p=>p.group==='Эльба'&&p.from===1797&&p.to===1798).length,2);
   batch.pending=batch.pending.filter(p=>!(p.group==='Эльба'&&p.from===1797&&p.to===1798));
  }
  derivedExclusions.push(...batch.exclusions);
  const pendingBySource=new Map();
  const attributionsBySource=new Map();
  for(const {source,...note} of batch.attributions){if(!attributionsBySource.has(source))attributionsBySource.set(source,[]);attributionsBySource.get(source).push(note);}
  for(const issue of batch.pending){
   if(issue.group==='Коморы')issue.sources=[...new Set([...(issue.sources??[issue.evidence]),comoroTraditionalRegions])];
   const geometryId=sha256(JSON.stringify(issue.geometry));geometries.set(geometryId,issue.geometry);
   if(!pendingBySource.has(issue.source))pendingBySource.set(issue.source,[]);
   pendingBySource.get(issue.source).push({part:issue.part,hash:issue.hash,from:issue.from,to:issue.to,group:issue.group,reason:issue.reason,evidence:issue.evidence,counterpartName:issue.counterpartName,geometryId,...(issue.sources?{sources:issue.sources}:{})});
  }
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
    if(territorialResolutions.kandy.indices.includes(sourceIndex)){
      assert.ok(capitalInsideCountry([80.635,7.29],feature.geometry),`Kandy missing from source ${sourceIndex}`);
      for(const port of [[79.86,6.93],[80.025,9.66],[80.22,6.03],[81.23,8.58],[81.69,7.71]])assert.ok(!capitalInsideCountry(port,feature.geometry),`Colonial port inside Kandy candidate ${sourceIndex}`);
    }
    const geometryId = sha256(JSON.stringify(geometry));
    validateGeometry(geometry);
    if (!geometries.has(geometryId)) geometries.set(geometryId, geometry);
    // Provisional source identity, never inferred from a similar display name.
    // A reviewed crosswalk can explicitly link variants later.
    const entityId = identity('source-'+role, sourceName, sourceWikidata);
    const base = {entityId, geometryId, role,components,memberOf,sourceSeshatId:String(p.SeshatID??''),sourceWikipedia:String(p.Wikipedia??''), ...(geometryId!==sourceGeometryId?{sourceGeometryId,geometryRepair:'retracted-zero-area-interior-edges'}:{}),name: sourceName, sourceName, sourceWikidata, sourceIndex, sourceFrom, sourceTo, from, to, nameStatus:'candidate', geometryStatus:'candidate'};
    const addOne = revision => {
      if(sourceName==='French Indochina'&&revision.to<1887){
        const [name,nameRu]=indochinaLabel(revision.to);
        revision={...revision,name,nameRu,nameStatus:'reviewed',review:{reason:[revision.review?.reason,'The Indochinese Union was established in 1887. Earlier source records represent a military campaign or earlier colonial possessions, not the later union.'].filter(Boolean).join(' '),reasonRu:[revision.review?.reasonRu,'Индокитайский союз учреждён в 1887 г.; ранние записи означают военную кампанию или предшествующие колониальные владения, а не союз. Сводный контур не устанавливает фактические пределы военного контроля.'].filter(Boolean).join(' '),sources:[...new Set([...(revision.review?.sources??[]),'https://mjp.univ-perp.fr/constit/vn1862.htm','https://blogs.loc.gov/international-collections/2018/03/early-european-resources-on-vietnam-at-the-library-of-congress/'])]}};
      }
      if(revision.to<1887&&revision.components.includes('French Indochina'))revision={...revision,sourceComponents:revision.sourceComponents??revision.components,components:revision.components.map(c=>c==='French Indochina'?indochinaLabel(revision.to)[0]:c)};
      const linked=(batch.groupLinks??[]).filter(t=>t.target===sourceIndex&&t.from<=revision.from&&t.to>=revision.to);
      if(linked.length){assert.equal(revision.role,'composite');revision={...revision,sourceComponents:revision.sourceComponents??revision.components,components:[...new Set([...revision.components,...linked.map(t=>t.name)])],review:{reason:[...new Set([revision.review?.reason,...linked.map(t=>t.decision.reason)].filter(Boolean))].join(' '),reasonRu:[...new Set([revision.review?.reasonRu,...linked.map(t=>t.decision.reasonRu)].filter(Boolean))].join(' '),sources:[...new Set([...(revision.review?.sources??[]),...linked.flatMap(t=>t.decision.sources)])]}};}
      const attribution=(attributionsBySource.get(sourceIndex)??[]).filter(issue=>issue.from<=revision.to&&issue.to>=revision.from);
      if(attribution.length)revision={...revision,territorialAttributions:attribution};
      const relabel=batch.relabels.get(sourceIndex);
      if(relabel)revision={...revision,name:relabel.name,nameRu:relabel.nameRu,entityId:identity('reviewed-territory','saint-croix'),nameStatus:'reviewed',review:{reason:relabel.reason,reasonRu:relabel.reasonRu,sources:relabel.sources}};
      const territorialIssues=(pendingBySource.get(sourceIndex)??[]).filter(issue=>issue.from<=revision.to&&issue.to>=revision.from);
      if(territorialIssues.length)revision={...revision,territorialIssues};
      let selection=reviewedGeometryParts(revision,derivedExclusions);
      const rebuild=(batch.groupRebuilds??[]).find(t=>t.target===sourceIndex&&t.from<=revision.from&&t.to>=revision.to);
      if(rebuild){assert.equal(revision.role,'composite');assert.equal(selection,null);selection=rebuild.parts;const d=rebuild.decision;revision={...revision,review:{reason:[revision.review?.reason,d.reason].filter(Boolean).join(' '),reasonRu:[revision.review?.reasonRu,d.reasonRu].filter(Boolean).join(' '),sources:[...new Set([...(revision.review?.sources??[]),...d.sources])]}};}
      const matchingTransfers=(batch.transfers??[]).filter(t=>t.target===sourceIndex&&t.from<=revision.from&&t.to>=revision.to);
      const matchingSubtractions=(batch.subtractions??[]).filter(t=>t.target===sourceIndex&&t.from<=revision.from&&t.to>=revision.to);
      const transfer=matchingTransfers[0];
      const preserveCoastalParts=matchingTransfers.length>0&&matchingTransfers.every(t=>t.decision.preserveCoastalParts);
      if(transfer){
        // Italy's sole raw 1944 component was the false Tianjin footprint;
        // its independently reviewed Elba transfer remains valid.
        if(selection?.length===0)assert.ok(sourceIndex===12929&&revision.from===1944&&matchingTransfers.every(t=>t.decision.group==='Эльба'),`Empty transfer target ${sourceIndex}/${revision.from}`);
        selection=[...(selection??rawParts(feature).map((_,part)=>({index:sourceIndex,part}))),...matchingTransfers.map(t=>({index:t.source,part:t.part}))];
        const decisions=matchingTransfers.map(t=>t.decision);
        const witnesses=matchingTransfers.flatMap(t=>t.temporalWitness?[t.temporalWitness]:[]);
        if(witnesses.length)revision={...revision,geometryTemporalWitnesses:witnesses};
        revision={...revision,review:{reason:[...new Set([revision.review?.reason,...decisions.map(d=>d.reason)].filter(Boolean))].join(' '),reasonRu:[...new Set([revision.review?.reasonRu,...decisions.map(d=>d.reasonRu)].filter(Boolean))].join(' '),sources:[...new Set([...(revision.review?.sources??[]),...decisions.flatMap(d=>d.sources)])]}};
      }
      if(matchingSubtractions.length){
        assert.notEqual(selection?.length,0);
        selection=selection??rawParts(feature).map((_,part)=>({index:sourceIndex,part}));
        const decisions=matchingSubtractions.map(t=>t.decision);
        revision={...revision,review:{reason:[...new Set([revision.review?.reason,...decisions.map(d=>d.reason)].filter(Boolean))].join(' '),reasonRu:[...new Set([revision.review?.reasonRu,...decisions.map(d=>d.reasonRu)].filter(Boolean))].join(' '),sources:[...new Set([...(revision.review?.sources??[]),...decisions.flatMap(d=>d.sources)])]}};
      }
      if(selection?.length===0){
        assert.ok(revision.review?.sources.length);
        revision={...revision,geometryStatus:'rejected'};
      }else if(selection){
        assert.ok(revision.review?.sources.length);
        const coordinates=selection.map(({index,part})=>{const g=source.features[index].geometry;const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;assert.ok(polygons[part]);return polygons[part]});
        if(transfer&&!preserveCoastalParts)for(let i=coordinates.length-matchingTransfers.length;i<coordinates.length;i++){
          if(i===0)continue;
          const t=matchingTransfers[i-(coordinates.length-matchingTransfers.length)],previous=polygonClipping.union(...coordinates.slice(0,i)),overlap=polygonClipping.intersection(previous,coordinates[i]);
          if(t.decision.allowSourceOverlap){
            assert.ok(['Давао','Сун — объединение','Индия — британская оккупация','Индия — передача поселений','Тяньцзинь — фон'].includes(t.decision.group));assert.ok(polygonClipping.difference(coordinates[i],previous).length,`Transfer must retain part outside previous geometry ${sourceIndex}`);if(t.decision.group==='Давао')assert.ok(overlap.length);
          }else assert.equal(overlap.length,0,`Overlapping transfer ${sourceIndex}`);
        }
        const subtractions=matchingSubtractions.map(t=>({index:t.source,part:t.part}));
        const selected={type:'MultiPolygon',coordinates:subtractions.length?polygonClipping.difference(polygonClipping.union(...coordinates),...subtractions.map(({index,part})=>rawParts(source.features[index])[part])):rebuild||transfer&&!preserveCoastalParts?polygonClipping.union(...coordinates):coordinates};validateGeometry(selected);
        const selectedId=sha256(JSON.stringify(selected));geometries.set(selectedId,selected);
        revision={...revision,geometryId:selectedId,sourceGeometryId,geometryRepair:subtractions.length?'reviewed-difference-source-components':rebuild||transfer&&!preserveCoastalParts?'reviewed-union-source-components':'reviewed-source-components',geometryParts:selection,...(subtractions.length?{geometrySubtractions:subtractions}:{})};
      }
      const id = identity('revision', sourceIndex, sourceFrom, sourceTo, revision.geometryId, revision.from, revision.to, revision.name);
      records.push({id, ...revision});
      if (revision.nameStatus === 'reviewed') counts.reviewedNames++;
      if (revision.geometryStatus === 'rejected') counts.rejectedRevisions++;
    };
    const add=revision=>{
      const cuts=new Set([revision.from,revision.to+1]);
      if(sourceName==='French Indochina'||revision.components.includes('French Indochina'))for(const year of [1867,1868,1885,1887])if(revision.from<year&&revision.to>=year)cuts.add(year);
      for(const t of [...(batch.transfers??[]),...(batch.subtractions??[]),...(batch.groupRebuilds??[]),...(batch.groupLinks??[])])if(t.target===sourceIndex&&t.from<=revision.to&&t.to>=revision.from){cuts.add(Math.max(revision.from,t.from));cuts.add(Math.min(revision.to+1,t.to+1));}
      const sorted=[...cuts].sort((a,b)=>a-b);
      for(let i=0;i<sorted.length-1;i++)addOne({...revision,from:sorted[i],to:sorted[i+1]-1});
    };
    if (sourceName === 'Mali Federation' && from >= 1961 && sourceWikidata === 'Q216632') {
      add({...base, entityId:identity('reviewed-polity','republic-of-mali'), name:'Republic of Mali', nameRu:'Республика Мали', nameStatus:'reviewed', review:{reason:'Federation dissolved in 1960; later records refer to the Republic of Mali. Geometry remains unverified.',sources:MALI_SOURCES}});
    } else if (sourceName === 'Zimbabwe Rhodesia' && sourceWikidata === 'Q890120' && from === 1979 && to === 1982) {
      add({...base,to:1979});
      add({...base,from:1980,entityId:identity('source-polity','Republic of Zimbabwe','Q954'),name:'Republic of Zimbabwe',nameRu:'Республика Зимбабве',nameStatus:'reviewed',review:{reason:'Independence as the Republic of Zimbabwe on 18 April 1980; annual label reflects the new state, not a day-level boundary reconstruction. Geometry remains unverified.',sources:[ZIMBABWE_SOURCE]}});
    } else if(territorialResolutions.datedPostIndependenceNames.some(d=>d.source===sourceIndex)){
      const d=territorialResolutions.datedPostIndependenceNames.find(d=>d.source===sourceIndex);
      assert.equal(sourceName,d.sourceName);assert.ok(from<d.year&&d.year<=to);
      for(const r of editorialSegments(base,derivedExclusions)){
        if(r.from<d.year)add({...r,to:Math.min(r.to,d.year-1),name:d.name,nameRu:d.nameRu,nameStatus:'reviewed',review:{reason:d.reason,reasonRu:d.reasonRu,sources:d.sources}});
        if(r.to>=d.year)add({...r,from:Math.max(r.from,d.year)});
      }
    } else if(sourceIndex===territorialResolutions.vanuatuIndependence.source){
      const d=territorialResolutions.vanuatuIndependence,next=source.features[d.successor];
      assert.equal(sourceName,'New Hebrides');assert.equal(next.properties.Name,d.name);assert.equal(next.properties.FromYear,to+1);
      assert.deepEqual(rawParts(feature).map(componentHash).sort(),rawParts(next).map(componentHash).sort());
      add({...base,to:d.year-1});
      add({...base,from:d.year,entityId:identity('source-polity',next.properties.Name,next.properties.Wikidata??''),name:d.name,nameRu:d.nameRu,nameStatus:'reviewed',memberOf:[],...(base.memberOf.length?{sourceMemberOf:base.memberOf}:{}),review:{reason:d.reason,reasonRu:d.reasonRu,sources:d.sources}});
    } else if (sourceIndex===territorialResolutions.italy1861.source&&sourceName==='Kingdom of Sardinia'&&from===1861&&to===1861) {
      const d=territorialResolutions.italy1861,next=source.features[d.successor];assert.equal(next.properties.Name,'Kingdom of Italy');assert.equal(sha256(JSON.stringify(next.geometry)),sourceGeometryId);
      add({...base,entityId:identity('source-polity',next.properties.Name,next.properties.Wikidata),name:next.properties.Name,nameRu:'Королевство Италия',nameStatus:'reviewed',review:{reason:d.reason,reasonRu:d.reasonRu,sources:d.sources}});
    } else if (sourceName === 'Republic of Indonesia' && from === 1960 && to >= 1963 && capitalInsideCountry([138,-4], feature.geometry)) {
      add({...base, to:1962, geometryStatus:'rejected', review:{reason:'Source polygon includes western New Guinea before the 1963 transfer; excluded from candidate drawing until corrected geometry is sourced.',sources:[INDONESIA_SOURCE]}});
      add({...base, from:1963});
    } else for(const revision of editorialSegments(base,derivedExclusions))add(revision);
  }
  for(const r of batch.restorations){
   const raw=source.features[r.source],origin=records.find(x=>x.sourceIndex===r.source&&x.from<=r.from&&x.to>=r.from),d=r.decision;
   const label=d.transition&&r.from>=d.transition.year?d.transition:d;
   assert.ok(origin&&(!d.transition||r.to<d.transition.year||r.from>=d.transition.year));
   const geometryId=sha256(JSON.stringify(r.geometry));validateGeometry(r.geometry);geometries.set(geometryId,r.geometry);
   const sourceGeometryId=sha256(JSON.stringify(raw.geometry));
   const identitySource=d.identitySource===undefined?undefined:source.features[d.identitySource].properties;
   if(identitySource)assert.equal(identitySource.Name,d.identitySourceName??label.name);
   const restored={...origin,id:identity('restoration',r.source,r.hash,r.from,r.to,d.entity),entityId:identitySource?identity('source-polity',identitySource.Name,identitySource.Wikidata??''):identity(d.entityNamespace??'reviewed-territory',d.entity),name:label.name,nameRu:label.nameRu,role:'polity',nameStatus:'reviewed',geometryStatus:'candidate',geometryId,sourceGeometryId,geometryRepair:'reviewed-source-components',geometryParts:(r.parts??[r.part]).map(part=>({index:r.source,part})),from:r.from,to:r.to,editorialRestoration:true,components:[],memberOf:d.memberOf??[],sourceComponents:origin.sourceComponents??origin.components,sourceMemberOf:origin.sourceMemberOf??origin.memberOf,review:{reason:d.reason,reasonRu:d.reasonRu,sources:d.sources}};
   // A moved component has its own reviewed source geometry. Do not inherit
   // subtraction or date-witness metadata from the residual parent polygon.
   delete restored.territorialIssues;delete restored.territorialAttributions;delete restored.geometrySubtractions;delete restored.geometryTemporalWitnesses;
   records.push(restored);counts.reviewedNames++;
  }
  if(batch.count){
   const d=elba1797Partition,raw=source.features[d.source],origin=records.find(r=>r.sourceIndex===d.source&&r.from<=d.from&&r.to>=d.from);
   assert.ok(origin);assert.equal(componentHash(rawParts(raw)[d.part]),'c440529d0c7fde4ec1dbf13983ef01d0c128f86661e64156915318dd023a27c8');
   const outline={type:'MultiPolygon',coordinates:[d.outline]},outlineGeometryId=sha256(JSON.stringify(outline));geometries.set(outlineGeometryId,outline);
   for(const [area,geometry] of buildElbaPartition().entries()){
    validateGeometry(geometry);const geometryId=sha256(JSON.stringify(geometry));geometries.set(geometryId,geometry);
    const [entity,name,nameRu]=d.areas[area];
    const restored={...origin,id:identity('historical-map-partition',entity,d.from,d.to,geometryId),entityId:identity('reviewed-territory',entity),name,nameRu,role:'polity',nameStatus:'reviewed',geometryStatus:'candidate',geometryId,sourceGeometryId:sha256(JSON.stringify(raw.geometry)),geometryRepair:'reviewed-map-partition',geometryParts:[{index:d.source,part:d.part}],mapPartition:{area,outlineGeometryId,evidence:d.sources[0]},from:d.from,to:d.to,editorialRestoration:true,components:[],memberOf:[],sourceComponents:origin.sourceComponents??origin.components,sourceMemberOf:origin.sourceMemberOf??origin.memberOf,review:{reason:'Approximate manual digitization from the Tuscan historical atlas, section 8.19; modern generalized coastline, not a historical cadastral survey.',reasonRu:'Приблизительная оцифровка трёх владений по историческому атласу Тосканы (раздел 8.19, с. 114) с генерализованной современной береговой линией. Не является точной исторической кадастровой съёмкой. Британцы эвакуировались в 1797 году.',sources:d.sources}};
    delete restored.territorialIssues;delete restored.territorialAttributions;delete restored.geometrySubtractions;delete restored.geometryTemporalWitnesses;
    records.push(restored);counts.reviewedNames++;
   }
   for(const definition of documentedCores)for(const d of definition.periods){
    const index=d.part??definition.part,raw=source.features[d.source],origin=records.find(r=>r.sourceIndex===d.source&&r.from<=d.from&&r.to>=d.from),part=rawParts(raw)[index];
    assert.ok(origin);if(definition.hash)assert.equal(componentHash(part),definition.hash);
    const outline={type:'MultiPolygon',coordinates:[part]},outlineGeometryId=sha256(JSON.stringify(outline));geometries.set(outlineGeometryId,outline);
    const geometry=buildDocumentedCore(part,definition),geometryId=sha256(JSON.stringify(geometry));validateGeometry(geometry);geometries.set(geometryId,geometry);
    const defaultReview=definition.id==='cap-corse'?{reason:'Confirmed northern part of Cap Corse, using only a conservative interior cut of the generalized source coastline. Dal Passo fig. 2 and Carrington confirm historic geography; Macinaggio fell in March 1765, and French troops secured the cape in August 1768. The southern cut is NOT a historical frontier. The 1761–64 siege and the rest of Corsica remain unresolved.',reasonRu:'Восстановлена только северная часть Кап-Корса (по генерализованному береговому контуру). Карта административного деления 1770 года, рис. 2 Ф. Даль Пассо, и исследование Д. Каррингтон подтверждают географию района; Мацинажо оставлен генуэзским гарнизоном в марте 1765 года, весь полуостров заняли французы в августе 1768 года. Южный срез условный, не историческая граница. Осада и переход власти 1761–1764 годов, а также остальная Корсика остаются неуточнёнными.'}:{reason:'Conservative interior summit core around the surviving Church of Our Lady of the Mount, inside the captured fortress. Schouten’s 1641 report and the georeferenced reconstruction (2009, fig. 5) support the site, not a complete 1641 perimeter. The rectangle is a limited interior excerpt, NOT the fort wall or the colony’s political boundary.',reasonRu:'Восстановлен только небольшой внутренний участок на холме у сохранившейся церкви Святого Павла, внутри захваченной крепости. Отчёт Схаутена 1641 года и геопривязанная реконструкция (2009, рис. 5) подтверждают место, но не полную границу 1641 года. Прямоугольник — условный внутренний фрагмент, не стена крепости и не граница колонии.'};
    const review=definition.review??defaultReview;
    const restored={...origin,id:identity('historical-documented-core',d.entity,d.from,d.to,geometryId),entityId:identity('reviewed-territory',d.entity),name:d.name,nameRu:d.nameRu,role:'polity',nameStatus:'reviewed',geometryStatus:'candidate',geometryId,sourceGeometryId:sha256(JSON.stringify(raw.geometry)),geometryRepair:'reviewed-map-partition',geometryParts:[{index:d.source,part:index}],mapPartition:{kind:'documented-core',area:0,outlineGeometryId,evidence:definition.sources[0]},from:d.from,to:d.to,editorialRestoration:true,components:[],memberOf:[],sourceComponents:origin.sourceComponents??origin.components,sourceMemberOf:origin.sourceMemberOf??origin.memberOf,review:{...review,sources:definition.sources}};
    delete restored.territorialIssues;delete restored.territorialAttributions;delete restored.geometrySubtractions;delete restored.geometryTemporalWitnesses;
    records.push(restored);counts.reviewedNames++;
   }
  }
  if(batch.count){
   for(const [d,entity,name,nameRu,reason,reasonRu] of [[saintMartinSpanish,'saint-martin-spanish','Saint Martin (Spanish occupation)','Сен-Мартен (испанская оккупация)','The Spanish took the island in 1633 and withdrew in 1648. The outline is a union of modern generalized island coastlines, not a survey of the seventeenth-century garrison or a claim of uniform local control. The later Franco-Dutch boundary is not inferred.','Испанцы заняли остров в 1633 году и покинули его в 1648 году. Контур объединяет современные генерализованные береговые линии; это не съёмка испанских укреплений и не доказательство повсеместного фактического контроля. Позднейшая франко-нидерландская граница не реконструирована.'],[tobagoDutch,'tobago-dutch','Tobago (Dutch colony)','Тобаго (нидерландская колония)','The Dutch took control after the Courland surrender in 1659; the conservative continuous interval ends in 1664 because sources differ on the subsequent conquest. The generalized modern island coastline represents colonial administration, not the extent of indigenous settlements or a surveyed territorial boundary.','После капитуляции курляндцев в 1659 г. контроль перешёл к нидерландцам; непрерывный период ограничен 1664 г., поскольку даты последующих захватов расходятся в источниках. Генерализованная современная береговая линия обозначает колониальную администрацию, а не границы поселений коренных народов или результаты исторической съёмки.']]){
   const geometry={type:'MultiPolygon',coordinates:d.coastline},geometryId=sha256(JSON.stringify(geometry));validateGeometry(geometry);geometries.set(geometryId,geometry);
   for(const [index,part,from,to] of d.periods){
    const f=source.features[index],origin=records.find(r=>r.sourceIndex===index&&r.from<=from&&r.to>=from&&!r.editorialRestoration),raw=rawParts(f)[part];assert.ok(origin);
    const outline={type:'MultiPolygon',coordinates:[raw]},outlineGeometryId=sha256(JSON.stringify(outline));geometries.set(outlineGeometryId,outline);
    const restored={...origin,id:identity('documented-island',index,from,to),entityId:identity('reviewed-territory',entity),name,nameRu,role:'polity',nameStatus:'reviewed',geometryStatus:'candidate',geometryId,sourceGeometryId:sha256(JSON.stringify(f.geometry)),geometryRepair:'reviewed-map-partition',geometryParts:[{index,part}],mapPartition:{kind:'documented-island',area:0,outlineGeometryId,evidence:d.sources[0]},from,to,editorialRestoration:true,components:[],memberOf:[],sourceComponents:origin.sourceComponents??origin.components,sourceMemberOf:origin.sourceMemberOf??origin.memberOf,review:{reason,reasonRu,sources:d.sources}};
    delete restored.territorialIssues;delete restored.territorialAttributions;delete restored.geometrySubtractions;delete restored.geometryTemporalWitnesses;records.push(restored);counts.reviewedNames++;
   }}
  }
  // A separate, explicitly approximate cartographic supplement for absent
  // independent island states. Never substitute modern boundaries wholesale.
  // Verify every applicable dated candidate has no intersecting land polygon.
  if(batch.count){
    const polygons=g=>g.type==='Polygon'?[g.coordinates]:g.coordinates;
    const bounds=polygon=>{let x=Infinity,y=Infinity,X=-Infinity,Y=-Infinity;for(const [a,b] of polygon[0]){x=Math.min(x,a);y=Math.min(y,b);X=Math.max(X,a);Y=Math.max(Y,b);}return [x,y,X,Y];};
    const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
    const cache=new Map(),parts=g=>{if(!cache.has(g))cache.set(g,polygons(g).map(p=>({p,b:bounds(p)})));return cache.get(g);};
    assert.equal(independentIslands.states.length,independentIslandGeometry.length);
    assert.equal(new Set(independentIslandGeometry.map(g=>g.iso)).size,independentIslandGeometry.length);
    for(const d of independentIslands.states){
      const evidence=independentIslandGeometry.find(g=>g.iso===d.iso);assert.ok(evidence);
      const raw=evidence.geometry;assert.equal(sha256(JSON.stringify(raw)),evidence.hash);const g={type:'MultiPolygon',coordinates:polygons(raw)},geometryId=sha256(JSON.stringify(g));validateGeometry(g);
      for(let idx=0;idx<records.length;idx++){const r=records[idx];if(r.role!=='polity'||r.geometryStatus!=='candidate'||r.to<d.from)continue;
        const other=geometries.get(r.geometryId);
        const overlap=parts(other).some(a=>parts(g).some(b=>intersects(a.b,b.b)&&polygonClipping.intersection(a.p,b.p).length));
        if(!overlap)continue;
        assert.ok(d.neighbors?.includes(r.sourceIndex),`Unexpected external boundary overlap ${d.iso}/${r.sourceIndex}/${r.name}/${r.from}-${r.to}`);
        assert.ok(!r.boundaryAdjustment,'Unreviewed multiple boundary adjustments');
        const clipped={type:'MultiPolygon',coordinates:polygonClipping.difference(polygons(other),polygons(g))};
        validateGeometry(clipped);const clippedId=sha256(JSON.stringify(clipped));geometries.set(clippedId,clipped);
        const from=Math.max(r.from,d.from);
        const adjusted={...r,id:identity('external-boundary-cut',r.id,from,r.to,geometryId),from,geometryId:clippedId,boundaryAdjustment:{baseGeometryId:r.geometryId,cuts:[{cutGeometryId:geometryId,iso:d.iso}]},review:{reason:[r.review?.reason,'Generalized land boundary excludes the separately sourced independent microstate.'].filter(Boolean).join(' '),reasonRu:[r.review?.reasonRu,'Контур согласован с генерализованной границей отдельного микрогосударства.'].filter(Boolean).join(' '),sources:[...new Set([...(r.review?.sources??[]),...d.sources,independentIslands.source.url])]}};
        if(r.from<from){records.splice(idx,1,{...r,to:from-1,id:identity('before-external-boundary-cut',r.id,from)},adjusted);idx++;}
        else records[idx]=adjusted;
      }
      geometries.set(geometryId,g);
      const segments=d.transition?[{...d,to:d.transition.year-1},{...d,...d.transition,from:d.transition.year,to:HISTORY_LAST_YEAR}]:[{...d,to:HISTORY_LAST_YEAR}];
      for(const s of segments){
        records.push({id:identity('external-island',d.iso,s.from,s.to),entityId:identity('external-island-polity',d.iso),geometryId,role:'polity',components:[],memberOf:[],sourceSeshatId:'',sourceWikipedia:'',sourceName:`Natural Earth: ${d.iso}`,sourceWikidata:d.wikidata,sourceIndex:evidence.neId,sourceFrom:d.from,sourceTo:HISTORY_LAST_YEAR,from:s.from,to:s.to,name:s.name,nameRu:s.nameRu,nameStatus:'reviewed',geometryStatus:'candidate',externalGeography:{iso:d.iso,neId:evidence.neId,datasetHash:independentIslands.source.sha256,url:independentIslands.source.url,kind:d.neighbors?'modern-stable-land-border':'modern-island-outline'},review:{reason:'Historically documented statehood; modern generalized land outlines only, not a dated boundary survey.',reasonRu:`${d.reasonRu} ${d.neighbors?'Сухопутный контур — современная генерализация Natural Earth 1:10 млн; он не является исторической съёмкой границы. Мелкие изменения границы не реконструированы.':'Береговой контур — современная генерализация Natural Earth 1:10 млн; он не является исторической съёмкой береговой линии. Мелкие острова, намыв и изменение берегов по годам не реконструированы. Морские границы не показаны.'}`,sources:[...d.sources,independentIslands.source.url]}});counts.reviewedNames++;
      }
    }
    // The admission dates establish sovereignty, not exact historical borders.
    // Use the first dated successor outline only for the documented transition gap.
    // Preserve existing neighboring borders, then partition only named predecessors.
    const ringArea=r=>Math.abs(r.slice(1).reduce((a,p,i)=>a+r[i][0]*p[1]-p[0]*r[i][1],0))/2;
    const area=g=>g.reduce((a,p)=>a+ringArea(p[0])-p.slice(1).reduce((s,r)=>s+ringArea(r),0),0);
    const overlaps=(a,b)=>parts(a).some(x=>parts(b).some(y=>intersects(x.b,y.b)&&polygonClipping.intersection(x.p,y.p).length));
    const saveGeometry=g=>{validateGeometry(g);const id=sha256(JSON.stringify(g));geometries.set(id,g);return id;};
    const un='https://www.un.org/en/about-us/growth-in-un-membership',decolonization='https://www.un.org/dppa/decolonization/en/history/former-trust-and-nsgts';
    const restitutions=[{index:11071,from:1816,name:'French India',nameRu:'Французская Индия (возвращённые поселения)',iso:'FRA',owners:[10983,10959,10953],parts:[5,6,7,8,9],initialParts:[7,9],sources:[INDIA_RESTITUTION,INDIA_OCCUPATION],note:'Пондишери и Чандернагор возвращены 4 декабря 1816 г., Карикал 13 января 1817 г., Маэ 22 февраля, Янаон 12 апреля.',restitution:true}];
    const colonialGaps=[
     {index:11576,from:1853,name:'New Caledonia',nameRu:'Новая Каледония (французское владение)',iso:'NCL',parts:[1],owners:[],colonial:true,sources:['https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000000555817','https://mjp.univ-perp.fr/constit/nc1853.htm','https://www.unc.nc/wp-content/uploads/2021/11/Understanding-New-Caledonia-Web.pdf'],note:'24 сентября 1853 г. Франция объявила о присоединении Гранд-Тер. Показан юридический территориальный акт, не фактический охват управления над канакскими общинами. Луайоте не включены.'},
     {index:12107,from:1893,name:'Kerguelen (French possession)',nameRu:'Кергелен (французское владение)',iso:'ATF',parts:[0],owners:[],colonial:true,restoredSuccessor:true,sources:['https://taaf.fr/actualite/2-janvier-1893-une-date-historique-pour-kerguelen/','https://taaf.fr/collectivites/presentation-des-territoires/les-iles-australes/'],note:'2 января 1893 г. Франция официально подтвердила суверенитет над архипелагом. Использован только островной компонент карты 1895 г., а не весь исходный агрегат Индокитая.'}
    ];
    for(const d of [...independenceTransitions,...restitutions,...colonialGaps]){
      const f=source.features[d.index],p=f.properties,to=p.FromYear-1;
      assert.ok(to>=d.from&&to-d.from<5);
      const raw=polygons(f.geometry),sources=d.restitution||d.colonial?d.sources:[un,decolonization,...(d.sources??[])];
      for(let year=d.from;year<=to;year++){
        const selectedParts=year===d.from&&d.initialParts?d.initialParts:d.parts??raw.map((_,i)=>i);
        const outline={type:'MultiPolygon',coordinates:selectedParts.map(i=>raw[i])},outlineGeometryId=saveGeometry(outline);
        let candidate=outline;const trimGeometryIds=[];
        const checked=(op,r,fn)=>{try{return fn();}catch(e){throw new Error(`Transition ${d.iso}/${year} ${op} with ${r.sourceIndex} ${r.name}`,{cause:e});}};
        const active=records.filter(r=>r.role==='polity'&&r.geometryStatus==='candidate'&&r.from<=year&&r.to>=year);
        for(const r of active){
          if(d.owners.includes(r.sourceIndex)&&!r.datedGeography)continue;
          const other=geometries.get(r.geometryId);
          if(checked('neighbor intersection',r,()=>overlaps(candidate,other))){
            candidate={type:'MultiPolygon',coordinates:checked('neighbor trim',r,()=>polygonClipping.difference(candidate.coordinates,polygons(other)))};
            trimGeometryIds.push(r.geometryId);
          }
        }
        assert.ok(area(candidate.coordinates)>area(outline.coordinates)*0.95,`Too much neighboring land in ${d.iso}/${year}`);
        const geometryId=saveGeometry(candidate);
        for(let i=0;i<records.length;i++){
          const r=records[i];
          if(!d.restitution&&!d.cutOverlays&&r.role!=='polity'||r.geometryStatus!=='candidate'||r.from>year||r.to<year||!d.owners.includes(r.sourceIndex)||r.datedGeography)continue;
          const other=geometries.get(r.geometryId);if(!checked('predecessor intersection',r,()=>overlaps(candidate,other)))continue;
          const cutGeometryId=geometryId,baseGeometryId=r.boundaryAdjustment?.baseGeometryId??r.geometryId;
          const cuts=[...(r.boundaryAdjustment?.cuts??[]),{cutGeometryId,iso:d.iso}];
          const coordinates=checked('predecessor partition',r,()=>partitionHistoricalGeometry(polygons(geometries.get(baseGeometryId)),cuts.map(c=>polygons(geometries.get(c.cutGeometryId)))));
          const exhausted=!coordinates.length;
          const clippedId=exhausted?r.geometryId:saveGeometry({type:'MultiPolygon',coordinates});
          const adjusted={...r,id:identity('dated-boundary-cut',r.id,year,geometryId),from:year,to:year,geometryId:clippedId,geometryStatus:exhausted?'rejected':r.geometryStatus,boundaryAdjustment:{baseGeometryId,cuts,...(exhausted?{exhausted:true}:{})},review:{reason:[r.review?.reason,d.restitution?'Documented colonial restitution: former occupier outline partitioned using the first subsequent dated settlement outline.':'Documented independence: predecessor partitioned using a generalized dated successor outline.'].filter(Boolean).join(' '),reasonRu:[r.review?.reasonRu,d.restitution?'После возвращения колониальных поселений из контура оккупирующей державы исключены возвращённые территории по ближайшему датированному контуру.':'После документированной независимости из контура предшественника исключена территория нового государства по генерализованному контуру ближайшего последующего года.'].filter(Boolean).join(' '),sources:[...new Set([...(r.review?.sources??[]),...sources])]}};
          const split=[...(r.from<year?[{...r,id:identity('before-dated-cut',r.id,year),to:year-1}]:[]),adjusted,...(r.to>year?[{...r,id:identity('after-dated-cut',r.id,year),from:year+1}]:[])];
          records.splice(i,1,...split);i+=split.length-1;
        }
        const successor=records.find(r=>r.sourceIndex===d.index&&r.from<=p.FromYear&&r.to>=p.FromYear&&Boolean(r.editorialRestoration)===Boolean(d.restoredSuccessor)&&(!d.restoredSuccessor||r.name===d.name)&&!r.datedGeography);
        assert.ok(successor);
        records.push({id:identity(d.colonial?'dated-colonial-possession':d.restitution?'dated-colonial-restitution':'dated-independence',d.index,year),entityId:successor.entityId,geometryId,role:'polity',components:[],memberOf:[],...(d.colonial?{sourceMemberOf:String(p.MemberOf??'').split(';').map(s=>s.trim()).filter(Boolean)}:{}),sourceSeshatId:String(p.SeshatID??''),sourceWikipedia:String(p.Wikipedia??''),sourceName:p.Name.trim(),sourceWikidata:p.Wikidata??'',sourceIndex:d.index,sourceFrom:p.FromYear,sourceTo:p.ToYear,from:year,to:year,name:d.namesByYear?.[year]?.[0]??d.name,nameRu:d.namesByYear?.[year]?.[1]??d.nameRu,nameStatus:'reviewed',geometryStatus:'candidate',datedGeography:{referenceYear:p.FromYear,outlineGeometryId,trimGeometryIds,parts:selectedParts},review:{reason:`${d.colonial?'Documented colonial claim over the island, not exact effective territorial control':d.restitution?'Documented return of colonial settlements':'Documented independent state or provisional administrative zone in the transition year'}; generalized outline from first subsequent dated source, adjusted to avoid neighboring overlaps, not an exact contemporary boundary.`,reasonRu:`${d.colonial?'Документированное французское владение':d.restitution?'Возвращённые колониальные поселения':d.namesByYear||d.iso==='VNM'?'Административная зона':'Независимое государство'} в конце ${year} года. Контур основан на датированном источнике за ${p.FromYear} год и согласован с соседними полигонами; точная граница переходного года не подтверждена. ${d.note??''}`,sources}});
        counts.reviewedNames++;
      }
    }
    // Both successor republics now cover the former federation. Do not draw a
    // sliver of a dissolved polity created by mismatched map generalizations.
    for(const [index,year,reason,reasonRu] of [
      [13206,1960,'The Mali Federation dissolved in 1960; the small remaining sliver is not a surviving federation.','Федерация Мали распалась в 1960 году; небольшой остаток несовпадающих контуров не является сохранившейся федерацией.'],
      [13227,1962,'Ruanda-Urundi became the two independent states of Rwanda and Burundi in 1962; the small remaining sliver is not Belgian Congo.','В 1962 году Руанда-Урунди разделилась на независимые Руанду и Бурунди; небольшой остаток контура не относится к Бельгийскому Конго.']
    ]){
      const r=records.find(r=>r.sourceIndex===index&&r.from===year&&r.to===year);assert.ok(r);
      if(r.geometryStatus==='candidate'){
        assert.ok(r.boundaryAdjustment&&area(polygons(geometries.get(r.geometryId)))<area(polygons(geometries.get(r.boundaryAdjustment.baseGeometryId)))*0.01);
        r.geometryStatus='rejected';r.review={...r.review,reason:r.review.reason+' '+reason,reasonRu:r.review.reasonRu+' '+reasonRu};
      }
    }
  }
  counts.revisions = records.length;
  counts.rejectedRevisions=records.filter(r=>r.geometryStatus==='rejected').length;
  const geometryReferences=r=>[r.geometryId,...(r.mapPartition?[r.mapPartition.outlineGeometryId]:[]),...(r.boundaryAdjustment?[r.boundaryAdjustment.baseGeometryId,...r.boundaryAdjustment.cuts.map(c=>c.cutGeometryId)]:[]),...(r.datedGeography?[r.datedGeography.outlineGeometryId,...r.datedGeography.trimGeometryIds]:[]),...(r.territorialIssues??[]).map(i=>i.geometryId)];
  const used=new Set(records.flatMap(geometryReferences));for(const id of geometries.keys())if(!used.has(id))geometries.delete(id);
  counts.uniqueGeometries = geometries.size;
  return {records,geometries,counts};
}

/** Dated evidence for a state omitted from the independently accepted
 * geometries. This is NOT a polygon and must never be converted to one.
 * Separate pure logic allows testing dates without rebuilding 5,424 years.
 */
export function documentedStateCoverageGaps(year,polities,sourceIndexedReviews){
  if(!sourceIndexedReviews)return [];
  const marshall=independentIslands.states.find(s=>s.iso==='MHL');
  if(!marshall||year<marshall.recognitionFrom||year>=marshall.from||
     polities.some(r=>r.sourceWikidata===marshall.wikidata||
       /Marshall Islands/i.test(r.name)))return [];
  return [{name:'Marshall Islands',kind:'documented-state',date:'1986-10-21',
    source:'https://history.state.gov/countries/marshall-islands',
    reason:'Independent state recognized in 1986; no independently dated 1986–89 geometry has been accepted. A 1990 outline must not be backdated.',
    reasonRu:'Независимость признана в 1986 году, но для 1986–1989 годов нет самостоятельно принятой датированной карты островов. Поздний контур 1990 года не переносится на ранние годы.'}];
}

export function buildHistoricalTimeline(source, sourceHash, outDir) {
  const {records,geometries,counts} = normalizeHistoricalSource(source);
  const hasSourceIndexedReviews=source.features.length>REVIEWED_SOURCE_MIN_FEATURES;
  fs.mkdirSync(path.join(outDir,'packs'),{recursive:true});
  const blocks = [];
  function writeBlock(ordinal, end) {
    const from = historicalYearFromOrdinal(ordinal);
    const to = historicalYearFromOrdinal(end);
    const active = records.filter(r => r.from <= to && r.to >= from);
    const ids = [...new Set(active.flatMap(r=>[r.geometryId,...(r.mapPartition?[r.mapPartition.outlineGeometryId]:[]),...(r.boundaryAdjustment?[r.boundaryAdjustment.baseGeometryId,...r.boundaryAdjustment.cuts.map(c=>c.cutGeometryId)]:[]),...(r.datedGeography?[r.datedGeography.outlineGeometryId,...r.datedGeography.trimGeometryIds]:[]),...(r.territorialIssues??[]).map(i=>i.geometryId)]))].sort();
    const coverageGaps={};
    for(let year=Math.max(1960,from);year<=to;year++){
      const currentPolities=active.filter(r=>r.role==='polity'&&r.geometryStatus!=='rejected'&&r.from<=year&&r.to>=year);
      const gaps=referenceAdmissionWarnings(year,currentPolities.map(r=>r.name));
      gaps.push(...documentedStateCoverageGaps(year,currentPolities,hasSourceIndexedReviews));
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
