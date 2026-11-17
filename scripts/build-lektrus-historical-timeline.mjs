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
 ['Union of Myanmar','Q836',2011,'Republic of the Union of Myanmar','Республика Союз Мьянма',DUTCH_TRANSITIONS],
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
export const historicalTitleCorrections=[
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
 if(base.sourceIndex===9410)cut(1707);
 if(base.sourceIndex===7187){cut(1454);cut(1462)}
 if(base.role==='polity'&&base.sourceName==='Sultanate of Malacca')cut(1529);
 if(base.sourceIndex===13313)cut(1973);
 const british=base.sourceName==='Kingdom of Great Britain'&&base.sourceWikidata==='Q23666';
 const britishComponent=base.components.includes('Kingdom of Great Britain');
 if(british||britishComponent){cut(1801);cut(1927)}
 if(british){cut(2000);cut(2024)}
 for(const [name,qid,year] of reviewedNames)if(base.sourceName===name&&base.sourceWikidata===qid)cut(year);
 if(base.sourceName==='First Hellenic Republic'&&base.sourceWikidata==='Q528546'){cut(1832);cut(1924);cut(1935)}
 if(base.sourceName==='Denmark-Norway'&&base.sourceWikidata==='Q62651')cut(1814);
 if(base.sourceName==='United Arab Republic'&&base.sourceWikidata==='Q170468')cut(1971);
 if(base.sourceName==='New France'&&base.sourceWikidata==='Q170604')cut(1763);
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
  for(const [,,start,end,name,ru,url,reason,reasonRu] of titleRules)if(from>=start&&to<=end)rename(name,ru,url,reason,reasonRu);
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
   note('The 1707 Acts of Union created Great Britain; these are surviving source records for British possessions, not a separate English colonial empire. Exact remaining extents and archival group associations are unverified.',['https://www.parliament.uk/about/living-heritage/evolutionofparliament/legislativescrutiny/act-of-union-1707/'],'После образования Великобритании в 1707 году эти записи относятся к британским владениям, а не к отдельной английской колониальной империи. Оставшиеся границы и архивные связи требуют проверки.');
  }
  if(base.sourceIndex===10461){
   const sierraOnly=from>=1803&&to<=1805;
   r={...r,name:sierraOnly?'Sierra Leone Company settlement':'British Cape and Sierra Leone possessions (source aggregate)',nameRu:sierraOnly?'Поселение Компании Сьерра-Леоне':'Британские владения в Капской колонии и Сьерра-Леоне (сводный контур)',nameStatus:'reviewed',entityId:identity('reviewed-polity',sierraOnly?'sierra-leone-company-10461':'british-cape-sierra-leone-10461')};
   note('The source combines geographically distinct Cape and Sierra Leone components. Freetown was administered by the Sierra Leone Company before the Crown took possession in 1808. The source footprint remains unverified.',['https://unipsil.unmissions.org/en/about-sierra-leone-history','https://sahistory.org.za/article/batavian-republic-1803-1806'],'Исходная запись объединяет отдельные территории Капской колонии и Сьерра-Леоне. Фритаун находился под управлением Компании Сьерра-Леоне до передачи короне в 1808 году. Точный контур остаётся непроверенным.');
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

export function normalizeHistoricalSource(source) {
  assert.equal(source.type,'FeatureCollection');
  const geometries = new Map(), records = [];
  const derivedExclusions=deriveConfirmedOverlapExclusions(source.features);
  // Small synthetic fixtures do not contain the pinned source indices.
  const batch=source.features.length>Math.max(...territorialBatch.rows.map(r=>Math.max(r.source,r.other)))?deriveTerritorialBatch(source.features):{exclusions:[],pending:[],resolved:[],restorations:[],relabels:new Map(),attributions:[],count:0};
  derivedExclusions.push(...batch.exclusions);
  const pendingBySource=new Map();
  const attributionsBySource=new Map();
  for(const {source,...note} of batch.attributions){if(!attributionsBySource.has(source))attributionsBySource.set(source,[]);attributionsBySource.get(source).push(note);}
  for(const issue of batch.pending){
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
      const attribution=(attributionsBySource.get(sourceIndex)??[]).filter(issue=>issue.from<=revision.to&&issue.to>=revision.from);
      if(attribution.length)revision={...revision,territorialAttributions:attribution};
      const relabel=batch.relabels.get(sourceIndex);
      if(relabel)revision={...revision,name:relabel.name,nameRu:relabel.nameRu,entityId:identity('reviewed-territory','saint-croix'),nameStatus:'reviewed',review:{reason:relabel.reason,reasonRu:relabel.reasonRu,sources:relabel.sources}};
      const territorialIssues=(pendingBySource.get(sourceIndex)??[]).filter(issue=>issue.from<=revision.to&&issue.to>=revision.from);
      if(territorialIssues.length)revision={...revision,territorialIssues};
      let selection=reviewedGeometryParts(revision,derivedExclusions);
      const matchingTransfers=(batch.transfers??[]).filter(t=>t.target===sourceIndex&&t.from<=revision.from&&t.to>=revision.to);
      const matchingSubtractions=(batch.subtractions??[]).filter(t=>t.target===sourceIndex&&t.from<=revision.from&&t.to>=revision.to);
      const transfer=matchingTransfers[0];
      if(transfer){
        assert.notEqual(selection?.length,0);
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
        if(transfer)for(let i=coordinates.length-matchingTransfers.length;i<coordinates.length;i++){
          const t=matchingTransfers[i-(coordinates.length-matchingTransfers.length)],previous=polygonClipping.union(...coordinates.slice(0,i)),overlap=polygonClipping.intersection(previous,coordinates[i]);
          if(t.decision.allowSourceOverlap){
            assert.equal(t.decision.group,'Давао');assert.ok(overlap.length&&polygonClipping.difference(coordinates[i],previous).length,`Davao transfer must partially overlap ${sourceIndex}`);
          }else assert.equal(overlap.length,0,`Overlapping transfer ${sourceIndex}`);
        }
        const subtractions=matchingSubtractions.map(t=>({index:t.source,part:t.part}));
        const selected={type:'MultiPolygon',coordinates:subtractions.length?polygonClipping.difference(polygonClipping.union(...coordinates),...subtractions.map(({index,part})=>rawParts(source.features[index])[part])):transfer?polygonClipping.union(...coordinates):coordinates};validateGeometry(selected);
        const selectedId=sha256(JSON.stringify(selected));geometries.set(selectedId,selected);
        revision={...revision,geometryId:selectedId,sourceGeometryId,geometryRepair:subtractions.length?'reviewed-difference-source-components':transfer?'reviewed-union-source-components':'reviewed-source-components',geometryParts:selection,...(subtractions.length?{geometrySubtractions:subtractions}:{})};
      }
      const id = identity('revision', sourceIndex, sourceFrom, sourceTo, revision.geometryId, revision.from, revision.to, revision.name);
      records.push({id, ...revision});
      if (revision.nameStatus === 'reviewed') counts.reviewedNames++;
      if (revision.geometryStatus === 'rejected') counts.rejectedRevisions++;
    };
    const add=revision=>{
      const cuts=new Set([revision.from,revision.to+1]);
      for(const t of [...(batch.transfers??[]),...(batch.subtractions??[])])if(t.target===sourceIndex&&t.from<=revision.to&&t.to>=revision.from){cuts.add(Math.max(revision.from,t.from));cuts.add(Math.min(revision.to+1,t.to+1));}
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
   const restored={...origin,id:identity('restoration',r.source,r.hash,r.from,r.to,d.entity),entityId:identitySource?identity('source-polity',identitySource.Name,identitySource.Wikidata??''):identity(d.entityNamespace??'reviewed-territory',d.entity),name:label.name,nameRu:label.nameRu,role:'polity',nameStatus:'reviewed',geometryStatus:'candidate',geometryId,sourceGeometryId,geometryRepair:'reviewed-source-components',geometryParts:(r.parts??[r.part]).map(part=>({index:r.source,part})),from:r.from,to:r.to,editorialRestoration:true,components:[],memberOf:[],sourceComponents:origin.sourceComponents??origin.components,sourceMemberOf:origin.sourceMemberOf??origin.memberOf,review:{reason:d.reason,reasonRu:d.reasonRu,sources:d.sources}};
   delete restored.territorialIssues;delete restored.territorialAttributions;
   records.push(restored);counts.reviewedNames++;
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
    for(const d of independenceTransitions){
      const f=source.features[d.index],p=f.properties,to=p.FromYear-1;
      assert.ok(to>=d.from&&to-d.from<5);
      const raw=polygons(f.geometry),outline={type:'MultiPolygon',coordinates:d.parts?d.parts.map(i=>raw[i]):raw};
      const outlineGeometryId=saveGeometry(outline),sources=[un,decolonization,...(d.sources??[])];
      for(let year=d.from;year<=to;year++){
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
          if(r.role!=='polity'||r.geometryStatus!=='candidate'||r.from>year||r.to<year||!d.owners.includes(r.sourceIndex)||r.datedGeography)continue;
          const other=geometries.get(r.geometryId);if(!checked('predecessor intersection',r,()=>overlaps(candidate,other)))continue;
          const cutGeometryId=geometryId,baseGeometryId=r.boundaryAdjustment?.baseGeometryId??r.geometryId;
          const cuts=[...(r.boundaryAdjustment?.cuts??[]),{cutGeometryId,iso:d.iso}];
          const coordinates=checked('predecessor partition',r,()=>partitionHistoricalGeometry(polygons(geometries.get(baseGeometryId)),cuts.map(c=>polygons(geometries.get(c.cutGeometryId)))));
          const exhausted=!coordinates.length;
          const clippedId=exhausted?r.geometryId:saveGeometry({type:'MultiPolygon',coordinates});
          const adjusted={...r,id:identity('dated-boundary-cut',r.id,year,geometryId),from:year,to:year,geometryId:clippedId,geometryStatus:exhausted?'rejected':r.geometryStatus,boundaryAdjustment:{baseGeometryId,cuts,...(exhausted?{exhausted:true}:{})},review:{reason:[r.review?.reason,'Documented independence: predecessor partitioned using a generalized dated successor outline.'].filter(Boolean).join(' '),reasonRu:[r.review?.reasonRu,'После документированной независимости из контура предшественника исключена территория нового государства по генерализованному контуру ближайшего последующего года.'].filter(Boolean).join(' '),sources:[...new Set([...(r.review?.sources??[]),...sources])]}};
          const split=[...(r.from<year?[{...r,id:identity('before-dated-cut',r.id,year),to:year-1}]:[]),adjusted,...(r.to>year?[{...r,id:identity('after-dated-cut',r.id,year),from:year+1}]:[])];
          records.splice(i,1,...split);i+=split.length-1;
        }
        const successor=records.find(r=>r.sourceIndex===d.index&&r.from<=p.FromYear&&r.to>=p.FromYear&&!r.editorialRestoration&&!r.datedGeography);
        assert.ok(successor);
        records.push({id:identity('dated-independence',d.index,year),entityId:successor.entityId,geometryId,role:'polity',components:[],memberOf:[],sourceSeshatId:String(p.SeshatID??''),sourceWikipedia:String(p.Wikipedia??''),sourceName:p.Name.trim(),sourceWikidata:p.Wikidata??'',sourceIndex:d.index,sourceFrom:p.FromYear,sourceTo:p.ToYear,from:year,to:year,name:d.name,nameRu:d.nameRu,nameStatus:'reviewed',geometryStatus:'candidate',datedGeography:{referenceYear:p.FromYear,outlineGeometryId,trimGeometryIds,parts:d.parts??raw.map((_,i)=>i)},review:{reason:'Documented independent state in the transition year; generalized outline from first subsequent dated source, adjusted to avoid neighboring overlaps, not an exact contemporary boundary.',reasonRu:`Независимое государство в конце ${year} года. Контур основан на датированном источнике за ${p.FromYear} год и согласован с соседними полигонами; точная граница переходного года не подтверждена. ${d.note??''}`,sources}});
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
  const geometryReferences=r=>[r.geometryId,...(r.boundaryAdjustment?[r.boundaryAdjustment.baseGeometryId,...r.boundaryAdjustment.cuts.map(c=>c.cutGeometryId)]:[]),...(r.datedGeography?[r.datedGeography.outlineGeometryId,...r.datedGeography.trimGeometryIds]:[]),...(r.territorialIssues??[]).map(i=>i.geometryId)];
  const used=new Set(records.flatMap(geometryReferences));for(const id of geometries.keys())if(!used.has(id))geometries.delete(id);
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
    const ids = [...new Set(active.flatMap(r=>[r.geometryId,...(r.boundaryAdjustment?[r.boundaryAdjustment.baseGeometryId,...r.boundaryAdjustment.cuts.map(c=>c.cutGeometryId)]:[]),...(r.datedGeography?[r.datedGeography.outlineGeometryId,...r.datedGeography.trimGeometryIds]:[]),...(r.territorialIssues??[]).map(i=>i.geometryId)]))].sort();
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
