// Country/capital crosswalk independently transcribed from UN Statistics
// Division, World Statistics Pocketbook 2025 (data through 31 July 2025).
// https://unstats.un.org/UNSDWebsite/publications/pocketbook/world-stats-pocketbook-2025.pdf
// This is a factual reference, not a copy of the cartographic database. The
// exceptions below document later or more specific official facts.
const reference=`AFG=Kabul|ALB=Tirana|DZA=Algiers|AND=Andorra la Vella|AGO=Luanda|ATG=Saint John's|ARG=Buenos Aires|ARM=Yerevan|AUS=Canberra|AUT=Vienna|AZE=Baku|BHS=Nassau|BHR=Manama|BGD=Dhaka|BRB=Bridgetown|BLR=Minsk|BEL=Brussels|BLZ=Belmopan|BEN=Porto-Novo|BTN=Thimphu|BOL=Sucre|BIH=Sarajevo|BWA=Gaborone|BRA=Brasilia|BRN=Bandar Seri Begawan|BGR=Sofia|BFA=Ouagadougou|BDI=Gitega|CPV=Praia|KHM=Phnom Penh|CMR=Yaoundé|CAN=Ottawa|CAF=Bangui|TCD=N'Djamena|CHL=Santiago|CHN=Beijing|COL=Bogota|COM=Moroni|COG=Brazzaville|COD=Kinshasa|CRI=San José|CIV=Yamoussoukro|HRV=Zagreb|CUB=Havana|CYP=Nicosia|CZE=Prague|DNK=Copenhagen|DJI=Djibouti|DMA=Roseau|DOM=Santo Domingo|ECU=Quito|EGY=Cairo|SLV=San Salvador|GNQ=Malabo|ERI=Asmara|EST=Tallinn|SWZ=Mbabane|ETH=Addis Ababa|FJI=Suva|FIN=Helsinki|FRA=Paris|GAB=Libreville|GMB=Banjul|GEO=Tbilisi|DEU=Berlin|GHA=Accra|GRC=Athens|GRD=Saint George's|GTM=Guatemala City|GIN=Conakry|GNB=Bissau|GUY=Georgetown|HTI=Port-au-Prince|HND=Tegucigalpa|HUN=Budapest|ISL=Reykjavik|IND=New Delhi|IDN=Jakarta|IRN=Tehran|IRQ=Baghdad|IRL=Dublin|ISR=Jerusalem|ITA=Rome|JAM=Kingston|JPN=Tokyo|JOR=Amman|KAZ=Astana|KEN=Nairobi|KIR=Bairiki|PRK=Pyongyang|KOR=Seoul|KWT=Kuwait City|KGZ=Bishkek|LAO=Vientiane|LVA=Riga|LBN=Beirut|LSO=Maseru|LBR=Monrovia|LBY=Tripoli|LIE=Vaduz|LTU=Vilnius|LUX=Luxembourg|MDG=Antananarivo|MWI=Lilongwe|MYS=Kuala Lumpur|MDV=Male|MLI=Bamako|MLT=Valletta|MHL=Majuro|MRT=Nouakchott|MUS=Port Louis|MEX=Mexico City|FSM=Palikir|MDA=Chisinau|MCO=Monaco|MNG=Ulaanbaatar|MNE=Podgorica|MAR=Rabat|MOZ=Maputo|MMR=Nay Pyi Taw|NAM=Windhoek|NRU=Yaren|NPL=Kathmandu|NLD=Amsterdam|NZL=Wellington|NIC=Managua|NER=Niamey|NGA=Abuja|MKD=Skopje|NOR=Oslo|OMN=Muscat|PAK=Islamabad|PLW=Melekeok|PAN=Panama City|PNG=Port Moresby|PRY=Asunción|PER=Lima|PHL=Manila|POL=Warsaw|PRT=Lisbon|QAT=Doha|ROU=Bucharest|RUS=Moscow|RWA=Kigali|KNA=Basseterre|LCA=Castries|VCT=Kingstown|WSM=Apia|SMR=San Marino|STP=Sao Tome|SAU=Riyadh|SEN=Dakar|SRB=Belgrade|SYC=Victoria|SLE=Freetown|SGP=Singapore|SVK=Bratislava|SVN=Ljubljana|SLB=Honiara|SOM=Mogadishu|ZAF=Pretoria|SSD=Juba|ESP=Madrid|LKA=Colombo|SDN=Khartoum|SUR=Paramaribo|SWE=Stockholm|CHE=Bern|SYR=Damascus|TJK=Dushanbe|TZA=Dodoma|THA=Bangkok|TLS=Dili|TGO=Lomé|TON=Nuku'alofa|TTO=Port of Spain|TUN=Tunis|TUR=Ankara|TKM=Ashgabat|TUV=Funafuti|UGA=Kampala|UKR=Kyiv|ARE=Abu Dhabi|GBR=London|USA=Washington, D.C.|URY=Montevideo|UZB=Tashkent|VUT=Port Vila|VEN=Caracas|VNM=Hanoi|YEM=Sana'a|ZMB=Lusaka|ZWE=Harare|PSE=East Jerusalem|VAT=Vatican City`;
export const un2025CapitalReference=Object.fromEntries(reference.split("|").map(row=>row.split("=")));
// Exact spelling aliases from the actual sources, plus deliberate, documented
// deviations from the 2025 reference. No fuzzy/substring match.
export const modernCapitalOverrides={
 AND:["Andorra"],DNK:["København"],KIR:["Tarawa","Bairiki"],
 GNQ:["Ciudad de la Paz"], // Decree 1/2026, replaces Malabo.
 LKA:["Sri Jayawardenepura Kotte"], // Administrative capital, MFA Sri Lanka.
 MMR:["Naypyidaw"],BOL:["Sucre","La Paz"],SWZ:["Mbabane","Lobamba"],
 ZAF:["Pretoria","Cape Town","Bloemfontein"],
 // No official capital (NRU); disputed designation (PSE). Verify the
 // sourced explanatory country card instead of inventing a capital marker.
 NRU:[],PSE:[]
};
export const normalizeCapital=name=>String(name??"").normalize("NFKD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/[^a-z0-9]/g,"");
// The pinned 1:10m country geometry includes holes/enclaves. Check all rings,
// not just bounding boxes or nearest-centre distances.
const inRing=([x,y],ring)=>{
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [a,b]=ring[i],[c,d]=ring[j];
  if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;
 }
 return inside;
};
export function capitalInsideCountry(point,geometry){
 const polygons=geometry.type==="Polygon"?[geometry.coordinates]:geometry.coordinates;
 return polygons.some(rings=>inRing(point,rings[0])&&!rings.slice(1).some(ring=>inRing(point,ring)));
}
