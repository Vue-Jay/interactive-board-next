/** Illustrated historical symbols ONLY in the atlas reference UI.
 * Source: individual Wikimedia Commons File pages (see sourceUrl) and the
 * date-qualified Wikimedia Commons Data:FlagsData.tab (Wikidata P41).
 * If history is contested or a flag is reconstructed, the description says so.
 * No modern country symbol is retroactively assigned to a medieval state. */
export type HistoricalInsignia={
 id?:string;code?:string;from:number;to:number;file:string;
 kind:"flag"|"banner"|"emblem";title:string;reconstruction?:boolean;
};
export const historicalInsigniaSource="https://commons.wikimedia.org/wiki/Data:FlagsData.tab";
const flag=(id:string,from:number,to:number,file:string,title="Исторический флаг"):HistoricalInsignia=>({
 id,from,to,file,kind:"flag",title
});
const country=(code:string,from:number,to:number,file:string,title="Флаг соответствующего периода"):HistoricalInsignia=>({
 code,from,to,file,kind:"flag",title
});
const other=(id:string,from:number,to:number,file:string,title:string,kind:"banner"|"emblem"="banner",reconstruction=true):HistoricalInsignia=>({
 id,from,to,file,kind,title,reconstruction
});
/** State-specific emblems, with deliberately narrow year ranges. */
export const historicalStateInsignia:readonly HistoricalInsignia[]=[
 flag("ussr",1955,1991,"Flag of the Soviet Union.svg","Государственный флаг СССР"),
 flag("russian-empire",1858,1895,"Flag of Russia (1858–1896).svg","Государственные гербовые цвета Российской империи"),
 flag("russian-empire",1896,1917,"Flag of Russia (1896–1918).svg","Бело-сине-красный флаг Российской империи"),
 flag("ottoman",1844,1922,"Flag of the Ottoman Empire.svg","Флаг Османской империи"),
 flag("german-empire",1871,1918,"Flag of Germany (1867–1918).svg","Флаг Германской империи"),
 flag("prussia",1892,1918,"Flag of Prussia (1892-1918).svg","Государственный флаг Пруссии"),
 flag("qing",1889,1912,"Flag of China (1889–1912).svg","Флаг империи Цин"),
 flag("gdr",1959,1990,"Flag of the German Democratic Republic.svg","Государственный флаг ГДР"),
 flag("frg-west",1949,1990,"Flag of Germany.svg","Флаг Федеративной Республики Германии"),
 flag("kingdom-italy",1861,1946,"Flag of Italy (1861–1946).svg","Флаг Итальянского королевства"),
 flag("papal-states",1825,1870,"Flag of the Papal States (1825-1870).svg","Торговый и государственный флаг Папской области"),
 other("papal-states",1000,1750,"Flag of the Papal States (pre 1808).svg","Исторические папские цвета","banner",true),
 other("venice",1500,1797,"Flag of the Republic of Venice.svg","Знамя Венецианской республики, современная векторная реконструкция","banner",true),
 other("poland-lithuania",1587,1668,"Banner of Poland-Lithuania.svg","Королевское знамя времён династии Ваза (не общий государственный флаг)","banner",true),
 other("france-kingdom",1638,1789,"Royal Standard of the King of France.svg","Королевский штандарт Франции, не современный национальный флаг","banner",true),
 flag("france-kingdom",1815,1830,"Flag of France (1814–1830).svg","Белый флаг Франции в эпоху Реставрации"),
 other("kingdom-scotland",1300,1707,"Flag of the Kingdom of Scotland.png","Средневековое королевское знамя Шотландии, современная реконструкция","banner",true),
 other("mughal",1648,1843,"Flag of the Mughal Empire (triangular).svg",
  "Знамя алам, реконструкция по изображениям могольских церемоний XVII–XIX вв.","banner",true),
 other("timurid",1393,1405,"Timurid.svg",
  "Три кольца Тимуридов: реконструкция эмблемы по монетам эпохи Тимура","emblem",true),
 other("sasanian",500,651,"Derafsh kaviyani.svg",
  "Дерафш Кавиани: современная реконструкция сасанидского штандарта","banner",true),
 flag("safavid",1576,1666,"Safavid Flag.svg","Знамя династии Сефевидов периода 1576–1666 гг."),
 other("horde",1350,1400,"Catalan Atlas, Flag of the Golden Horde.svg",
  "Знамя по Каталонскому атласу 1375 года (не доказан единый флаг Орды)","banner",true),
 other("mamluk",1350,1400,"Flag of the Mamluk Sultanate (Alexandria).svg",
  "Изображение над Александрией на картах XIV века, не доказан официальный флаг","banner",true),
 other("almohads",1150,1250,"Almohad flag.svg",
  "Знамя Альмохадов по историческим исследованиям, современное воспроизведение","banner",true),
 flag("genoa",1250,1797,"Flag of Genoa.svg","Красный георгиевский крест Генуэзской республики"),
 other("grand-duchy-lithuania",1400,1569,"Royal banner of the Grand Duchy of Lithuania.svg",
  "Княжеское военное знамя с Погоней, поздняя реконструкция","banner",true),
 other("castile",1230,1479,"Royal Banner of the Kingdom of Castile.svg",
  "Королевское знамя Кастилии, реконструкция исторической геральдики","banner",true),
 flag("bukhara-emirate",1890,1920,"Flag of the Emirate of Bukhara.svg","Знамя Бухарского эмирата, поздний период"),
 flag("khiva",1917,1920,"Flag of the Khanate of Khiva.svg","Знамя Хивинского ханства времён гражданской войны"),
];
/** Country flags by historical year for dated basemap objects whose English
 * source NAME corresponds to the same modern or pre-modern state identity.
 * These entries are historical graphic variants and are not automatic flags
 * of kingdoms, colonies or administrative provinces with the same ISO code. */
export const historicalDatedNationalFlags:readonly HistoricalInsignia[]=[
 country("US",1777,1794,"Flag of the United States (1777–1795).svg"),
 country("US",1795,1817,"Flag of the United States (1795-1818).svg"),
 country("US",1818,1818,"Flag of the United States (1818–1819).svg"),
 country("US",1819,1819,"Flag of the United States (1819–1820).svg"),
 country("US",1820,1821,"Flag of the United States (1820–1822).svg"),
 country("US",1822,1835,"Flag of the United States (1822–1836).svg"),
 country("US",1837,1844,"Flag of the United States (1837–1845).svg"),
 country("US",1845,1845,"Flag of the United States (1845–1846).svg"),
 country("US",1848,1850,"Flag of the United States (1848–1851).svg"),
 country("US",1851,1857,"Flag of the United States (1851–1858).svg"),
 country("US",1859,1860,"Flag of the United States (1859–1861).svg"),
 country("US",1861,1862,"Flag of the United States (1861–1863).svg"),
 country("US",1865,1866,"Flag of the United States (1865–1867).svg"),
 country("US",1867,1876,"Flag of the United States (1867-1877).svg"),
 country("US",1877,1889,"Flag of the United States (1877–1890).svg"),
 country("US",1890,1890,"Flag of the United States (1890–1891).svg"),
 country("US",1891,1895,"Flag of the United States (1891–1896).svg"),
 country("US",1896,1907,"Flag of the United States (1896–1908).svg"),
 country("US",1912,1958,"Flag of the United States (1912-1959).svg"),
 country("US",1959,1959,"Flag of the United States (1959–1960).svg"),
 country("US",1960,2026,"Flag of the United States (DDD-F-416E specifications).svg"),
 country("FR",1101,1300,"Flag of France (XII-XIII).svg","Геральдическое знамя королевства, поздняя реконструкция"),
 country("FR",1301,1600,"Bannière de France style 1500.svg","Французское королевское знамя (изобразительная реконструкция)"),
 country("FR",1638,1789,"Royal Standard of the King of France.svg","Королевский штандарт"),
 country("FR",1790,1793,"Flag of France (1790–1794).svg"),
 country("FR",1815,1829,"Flag of France (1814–1830).svg"),
 country("FR",1830,1957,"Flag of France.svg"),
 country("FR",1958,1974,"Flag of France (1958–1976).svg"),
 country("FR",1975,2019,"Flag of France (1976–2020).svg"),
 country("FR",2020,2026,"Flag of France.svg"),
 country("RU",1858,1895,"Flag of Russia (1858–1896).svg"),
 country("RU",1896,1917,"Flag of Russia (1896–1918).svg"),
 country("RU",1991,1992,"Flag of Russia (1991–1993).svg"),
 country("RU",1993,2026,"Flag of Russia.svg"),
 country("DE",1867,1918,"Flag of Germany (1867–1918).svg"),
 country("DE",1919,1932,"Flag of Germany (3-2).svg"),
 country("DE",1949,2026,"Flag of Germany.svg"),
 country("CA",1868,1920,"Flag of Canada (1868–1921).svg"),
 country("CA",1921,1956,"Flag of Canada (1921–1957).svg"),
 country("CA",1957,1964,"Flag of Canada (1957–1965).svg"),
 country("CA",1965,2026,"Flag of Canada (Pantone).svg"),
 country("JP",1870,1998,"Flag of Japan (1870–1999).svg"),
 country("JP",1999,2026,"Flag of Japan.svg"),
 country("BR",1889,1959,"Flag of Brazil (1889–1960).svg"),
 country("BR",1960,1967,"Flag of Brazil (1960–1968).svg"),
 country("BR",1968,1991,"Flag of Brazil (1968–1992).svg"),
 country("BR",1992,2026,"Flag of Brazil.svg"),
 country("BY",1951,1990,"Flag of the Byelorussian Soviet Socialist Republic (1951–1991).svg"),
 country("BY",1991,1994,"Flag of Belarus (1918, 1991–1995).svg"),
 country("BY",1995,2011,"Flag of Belarus (1995–2012).svg"),
 country("BY",2012,2026,"Flag of Belarus.svg"),
 country("IS",1918,1943,"Flag of Iceland (1918–1944).svg"),
 country("IS",1944,2026,"Flag of Iceland.svg"),
 country("UA",1991,1991,"Flag of Ukraine (1991–1992).svg"),
 country("UA",1992,2026,"Flag of Ukraine.svg"),
 country("SK",1939,1944,"Flag of Slovakia (1939–1945).svg"),
 country("SK",1992,2026,"Flag of Slovakia.svg"),
 country("RO",1965,1988,"Flag of Romania (1965–1989).svg"),
 country("RO",1989,2026,"Flag of Romania.svg"),
 country("BG",1879,1946,"Flag of Bulgaria.svg"),
 country("BG",1948,1967,"Flag of Bulgaria (1948–1967).svg"),
 country("BG",1968,1970,"Flag of Bulgaria (1967–1971).svg"),
 country("BG",1971,1989,"Flag of Bulgaria (1971–1990).svg"),
 country("BG",1990,2026,"Flag of Bulgaria.svg"),
 country("MK",1992,1994,"Flag of Macedonia (1992–1995).svg"),
 country("MK",1995,2026,"Flag of North Macedonia.svg"),
 country("AL",1946,1991,"Flag of Albania (1946–1992).svg"),
 country("AL",1992,2026,"Flag of Albania.svg"),
 country("BA",1992,1997,"Flag of Bosnia and Herzegovina (1992–1998).svg"),
 country("BA",1998,2026,"Flag of Bosnia and Herzegovina.svg"),
 country("GE",1990,2003,"Flag of Georgia (1990–2004).svg"),
 country("GE",2004,2026,"Flag of Georgia.svg"),
 country("CY",1960,2005,"Flag of Cyprus (1960–2006).svg"),
 country("CY",2006,2026,"Flag of Cyprus.svg"),
 country("IT",1861,1945,"Flag of Italy (1861–1946).svg"),
 country("IT",1946,2002,"Flag of Italy (1946–2003).svg"),
 country("IT",2003,2026,"Flag of Italy.svg"),
 country("PL",1919,1927,"Flag of Poland (1919–1928).svg"),
 country("PL",1928,1979,"Flag of Poland (1928–1980).svg"),
 country("PL",1980,2026,"Flag of Poland.svg"),
 country("ES",1701,1759,"Flag of Spain (1701–1760).svg"),
 country("ES",1760,1842,"Flag of Spain (1760–1785).svg"),
 country("ES",1843,1872,"Flag of Spain (1785–1873, 1875–1931).svg"),
 country("ES",1875,1930,"Flag of Spain (1785–1873, 1875–1931).svg"),
 country("ES",1931,1938,"Flag of the Second Spanish Republic.svg"),
 country("ES",1939,1944,"Flag of Spain (1938–1945).svg"),
 country("ES",1945,1976,"Flag of Spain (1945–1977).svg"),
 country("ES",1977,1980,"Flag of Spain (1977–1981).svg"),
 country("ES",1982,2026,"Flag of Spain.svg"),
 country("LT",1918,1939,"Flag of Lithuania (1918–1940).svg"),
 country("LT",1990,2003,"Flag of Lithuania (1988–2004).svg"),
 country("LT",2004,2026,"Flag of Lithuania.svg"),
 country("GB",1801,2026,"Flag of the United Kingdom.svg"),
 country("IN",1947,2026,"Flag of India.svg"),
 country("CN",1949,2026,"Flag of the People's Republic of China.svg"),
 country("KR",1948,2026,"Flag of South Korea.svg"),
 country("KP",1948,2026,"Flag of North Korea.svg")
];
export function historicalInsigniaUrl(file:string,width=220):string{
 return "https://commons.wikimedia.org/wiki/Special:Redirect/file/"+encodeURIComponent(file)+"?width="+width;
}
export function historicalInsigniaSourceUrl(file:string):string{
 return "https://commons.wikimedia.org/wiki/File:"+encodeURIComponent(file.replace(/ /g,"_"));
}
export function findHistoricalStateInsignia(id:string,year:number):HistoricalInsignia|undefined{
 return historicalStateInsignia.find(row=>row.id===id&&year>=row.from&&year<=row.to);
}
export function findHistoricalCountryFlag(code:string,year:number):HistoricalInsignia|undefined{
 return historicalDatedNationalFlags.find(row=>row.code===code&&year>=row.from&&year<=row.to);
}
