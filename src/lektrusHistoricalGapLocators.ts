// Geographic orientation only: Natural Earth 2022 label anchors (public
// domain), not historical capitals, state boundaries or claims of control.
export const HISTORICAL_GAP_LOCATOR_SOURCE='https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_admin_0_countries.geojson';
export const historicalGapLocators:Record<string,{iso:string;nameRu:string;lon:number;lat:number;historicalNote?:string;historicalSource?:string}>={
 'United Arab Emirates':{iso:'ARE',nameRu:'Объединённые Арабские Эмираты',lon:54.547256,lat:23.466285,historicalNote:'2 декабря 1971 года федерацию образовали шесть эмиратов. Рас-эль-Хайма присоединилась 10 февраля 1972 года. Контур семи эмиратов нельзя переносить на 1971 год.',historicalSource:'https://uaecabinet.ae/en/the-constitution'},
 Maldives:{iso:'MDV',nameRu:'Мальдивы',lon:73.507554,lat:4.174441},
 Comoros:{iso:'COM',nameRu:'Коморы',lon:43.318094,lat:-11.727683},
 Samoa:{iso:'WSM',nameRu:'Самоа',lon:-172.438241,lat:-13.639139},
 Liechtenstein:{iso:'LIE',nameRu:'Лихтенштейн',lon:9.559439,lat:47.111405},
 'Marshall Islands':{iso:'MHL',nameRu:'Маршалловы Острова',lon:171.193609,lat:7.082568},
 'San Marino':{iso:'SMR',nameRu:'Сан-Марино',lon:12.441206,lat:43.933916},
 Kiribati:{iso:'KIR',nameRu:'Кирибати',lon:-157.384577,lat:1.820437},
 Nauru:{iso:'NRU',nameRu:'Науру',lon:166.932644,lat:-0.520261},
 Tonga:{iso:'TON',nameRu:'Тонга',lon:-175.163014,lat:-21.210026},
 Tuvalu:{iso:'TUV',nameRu:'Тувалу',lon:179.209587,lat:-8.513717},
};
