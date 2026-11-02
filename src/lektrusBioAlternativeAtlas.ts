/** Variable-depth, species-specific atlas for organisms without vertebrate
 * organ systems. The map is an educational graph, not a forced 5-level ladder.
 * Each link has a real parent; genetic/ploidy stages are explicitly labelled.
 */
export type BioAlternativeOrganism="sponge"|"hydra"|"moss"|"chlamydomonas"|"spirogyra";
export type BioAltKind="organism"|"generation"|"structure"|"tissue"|"cell"|"organelle"|"reproduction";
export type BioAltSpot={x:number;y:number};
export type BioAltSource={title:string;url:string};
export type BioAltNode={
 id:string;parentId:string|null;kind:BioAltKind;name:string;description:string;
 spot?:BioAltSpot;ploidy?:"n"|"2n";source?:BioAltSource;
};
export type BioAltCycleStep={id:string;title:string;description:string;nodeId:string;ploidy?:"n"|"2n"};
export type BioAlternativeSpecies={
 id:BioAlternativeOrganism;name:string;scientific:string;group:"animal"|"plant";
 badge:string;intro:string;warning:string;source:BioAltSource;
 nodes:BioAltNode[];cycle?:BioAltCycleStep[];
};
export const BIO_ALT_SOURCES={
 sponge:{title:"OpenStax Biology 2e · Phylum Porifera",url:"https://openstax.org/books/biology-2e/pages/28-1-phylum-porifera"},
 hydra:{title:"OpenStax Biology 2e · Phylum Cnidaria",url:"https://openstax.org/books/biology-2e/pages/28-2-phylum-cnidaria"},
 moss:{title:"OpenStax Biology 2e · Bryophytes",url:"https://openstax.org/books/biology-2e/pages/25-3-bryophytes"},
 chlamydomonas:{title:"NCBI · Chlamydomonas eyespot assembly",url:"https://pmc.ncbi.nlm.nih.gov/articles/PMC3811559/"},
 spirogyra:{title:"NIOS Biology · Spirogyra structure and conjugation",url:"https://allenwebsite-general.s3.ap-south-1.amazonaws.com/nios/download/sr-secondary/Biology_314_Book2.pdf"}
} satisfies Record<BioAlternativeOrganism,BioAltSource>;
const n=(id:string,parentId:string|null,kind:BioAltKind,name:string,description:string,x?:number,y?:number,ploidy?:"n"|"2n"):BioAltNode=>({
 id,parentId,kind,name,description,...(x!==undefined&&y!==undefined?{spot:{x,y}}:{}),...(ploidy?{ploidy}: {})
});
const sponge:BioAltNode[]=[
 n("sponge",null,"organism","Бадяга озёрная","Пресноводная губка Spongilla lacustris. Вода течёт по системе каналов и жгутиковых камер; настоящих органов и тканей, как у позвоночных, нет."),
 n("sponge/water","sponge","structure","Водоносная система","Вода входит через поры, проходит через жгутиковые камеры и покидает тело через выводящие отверстия.",225,130),
 n("sponge/water/chamber","sponge/water","structure","Жгутиковая камера","Полость, выстланная воротничковыми клетками. Их жгутики создают ток воды.",230,138),
 n("sponge/water/chamber/choanocyte","sponge/water/chamber","cell","Хоаноцит","Клетка с жгутиком и воротничком из микроворсинок, участвует в фильтрации пищи.",250,167),
 n("sponge/water/chamber/choanocyte/flagellum","sponge/water/chamber/choanocyte","organelle","Жгутик","Движение жгутика создаёт ток воды через воротничок.",275,91),
 n("sponge/water/chamber/choanocyte/collar","sponge/water/chamber/choanocyte","structure","Воротничок микроворсинок","Задерживает частицы, переносимые потоком воды.",196,164),
 n("sponge/mesohyl","sponge","structure","Мезохил","Межклеточный матрикс, содержащий подвижные клетки и скелетные элементы.",300,240),
 n("sponge/mesohyl/amoebocyte","sponge/mesohyl","cell","Амёбоцит","Подвижная клетка в мезохиле, участвующая в транспорте веществ и других процессах.",240,167),
 n("sponge/pores","sponge","structure","Поры (остии)","Многочисленные входные отверстия для воды; это не рот и не лёгкие.",140,216),
 n("sponge/gemmule","sponge","reproduction","Геммула","У пресноводных губок устойчивые внутренние почки помогают пережить неблагоприятные условия.",350,260)
];
const hydra:BioAltNode[]=[
 n("hydra",null,"organism","Гидра обыкновенная","Пресноводный одиночный полип Hydra vulgaris. Два клеточных слоя, пищеварительная полость, щупальца со стрекательными клетками; сложных органов нет."),
 n("hydra/tentacle","hydra","structure","Щупальца","Захватывают добычу и содержат множество стрекательных клеток.",197,71),
 n("hydra/tentacle/epidermis","hydra/tentacle","tissue","Эпидермис щупальца","Наружный клеточный слой, содержит стрекательные, эпителиально-мускульные и другие клетки.",255,137),
 n("hydra/tentacle/epidermis/cnidocyte","hydra/tentacle/epidermis","cell","Книдоцит","Стрекательная клетка с нематоцистой для захвата добычи и защиты.",241,163),
 n("hydra/tentacle/epidermis/cnidocyte/nematocyst","hydra/tentacle/epidermis/cnidocyte","organelle","Нематоциста","Стрекательная капсула со свёрнутой нитью, способной быстро выворачиваться.",240,170),
 n("hydra/cavity","hydra","structure","Кишечная полость","Единая гастроваскулярная полость, связанная с ротовым отверстием.",247,201),
 n("hydra/cavity/gastrodermis","hydra/cavity","tissue","Гастродерма","Внутренний клеточный слой, участвует в пищеварении.",258,180),
 n("hydra/cavity/gastrodermis/digestive","hydra/cavity/gastrodermis","cell","Пищеварительно-мускульная клетка","Участвует в захвате частиц пищи, внутриклеточном пищеварении и сокращении.",242,174),
 n("hydra/basal","hydra","structure","Подошвенный диск","Прикрепляет полип к поверхности.",242,283),
 n("hydra/bud","hydra","reproduction","Почка","Новая гидра может развиваться на теле взрослой при бесполом размножении.",322,231)
];
const moss:BioAltNode[]=[
 n("moss",null,"organism","Кукушкин лён обыкновенный","Polytrichum commune: доминирует гаплоидный гаметофит (n), а диплоидный спорофит (2n) растёт на нём и получает питание."),
 n("moss/gametophyte","moss","generation","Гаметофит (n)","Зелёное листостебельное поколение, образующее половые органы.",170,160,"n"),
 n("moss/gametophyte/leaf","moss/gametophyte","structure","Листовидная структура","Фотосинтезирует; не является настоящим листом сосудистого растения.",224,105,"n"),
 n("moss/gametophyte/leaf/lamella","moss/gametophyte/leaf","tissue","Фотосинтезирующие ламеллы","У Polytrichum продольные пластинки на верхней стороне листовидной структуры увеличивают площадь фотосинтеза.",245,163,"n"),
 n("moss/gametophyte/leaf/lamella/cell","moss/gametophyte/leaf/lamella","cell","Фотосинтезирующая клетка","Содержит хлоропласты; является клеткой гаметофита с гаплоидным ядром.",246,168,"n"),
 n("moss/gametophyte/rhizoid","moss/gametophyte","structure","Ризоиды","Многоклеточные нити для закрепления; не настоящие корни и не корневые волоски.",223,267,"n"),
 n("moss/gametophyte/gametangium","moss/gametophyte","reproduction","Гаметангии","Антеридии образуют сперматозоиды, архегонии содержат яйцеклетки; для оплодотворения нужна вода.",231,61,"n"),
 n("moss/gametophyte/gametangium/zygote","moss/gametophyte/gametangium","reproduction","Зигота (2n)","Образуется после слияния гамет в архегонии и начинает развитие спорофита.",238,169,"2n"),
 n("moss/sporophyte","moss","generation","Спорофит (2n)","Развивается из зиготы на женском гаметофите; состоит из стопы, ножки и коробочки.",320,134,"2n"),
 n("moss/sporophyte/seta","moss/sporophyte","structure","Ножка спорофита (сета)","Поддерживает коробочку и проводит вещества от основания спорофита.",229,209,"2n"),
 n("moss/sporophyte/capsule","moss/sporophyte","structure","Коробочка (спорангий)","Содержит материнские клетки спор; в ходе мейоза образуются гаплоидные споры.",245,95,"2n"),
 n("moss/sporophyte/capsule/sporocyte","moss/sporophyte/capsule","cell","Материнская клетка спор (2n)","Диплоидная клетка внутри спорангия; мейоз даёт начало гаплоидным спорам.",230,168,"2n"),
 n("moss/spore","moss","reproduction","Спора (n)","Гаплоидная спора прорастает в протонему, из которой развивается гаметофит.",405,66,"n"),
 n("moss/protonema","moss","structure","Протонема (n)","Ранняя нитевидная стадия гаметофита, развивающаяся из споры.",95,245,"n")
];
const chlamydomonas:BioAltNode[]=[
 n("chlamydomonas",null,"organism","Хламидомонада Рейнхардта","Chlamydomonas reinhardtii — одноклеточная зелёная водоросль. У неё нет тканей, органов и систем органов."),
 n("chlamydomonas/flagella","chlamydomonas","organelle","Два жгутика","Два передних жгутика обеспечивают движение клетки и фототаксис.",196,80),
 n("chlamydomonas/flagella/basal","chlamydomonas/flagella","organelle","Базальные тельца","Микротрубочковые структуры, от которых отходят жгутики.",241,191),
 n("chlamydomonas/chloroplast","chlamydomonas","organelle","Чашевидный хлоропласт","Занимает значительную часть клетки, осуществляет фотосинтез.",243,219),
 n("chlamydomonas/chloroplast/pyrenoid","chlamydomonas/chloroplast","organelle","Пиреноид","Участок хлоропласта, участвующий в концентрации CO₂ и фиксации углерода.",254,187),
 n("chlamydomonas/eyespot","chlamydomonas","organelle","Светочувствительный глазок","Пигментные гранулы хлоропласта вместе с мембранными фоторецепторами помогают воспринимать направление света.",299,158),
 n("chlamydomonas/nucleus","chlamydomonas","organelle","Ядро","Содержит генетическую информацию клетки.",239,158),
 n("chlamydomonas/vacuoles","chlamydomonas","organelle","Сократительные вакуоли","Регулируют водный баланс клетки в пресной воде.",275,115)
];
const spirogyra:BioAltNode[]=[
 n("spirogyra",null,"organism","Спирогира","Spirogyra communis — нитчатая зелёная водоросль. Нить состоит из клеток; нет дифференцированных тканей и настоящих органов."),
 n("spirogyra/filament","spirogyra","structure","Клеточная нить","Последовательность клеток, соединённых поперечными перегородками.",240,158),
 n("spirogyra/filament/cell","spirogyra/filament","cell","Клетка спирогиры","Цилиндрическая клетка с крупной вакуолью, ядром на цитоплазматических тяжах и спиральными хлоропластами.",239,164),
 n("spirogyra/filament/cell/chloroplast","spirogyra/filament/cell","organelle","Спиральный хлоропласт","Один или несколько лентообразных хлоропластов в зависимости от вида.",270,178),
 n("spirogyra/filament/cell/chloroplast/pyrenoid","spirogyra/filament/cell/chloroplast","organelle","Пиреноид","Специализированная часть хлоропласта, обычно окружённая крахмалом.",260,146),
 n("spirogyra/filament/cell/nucleus","spirogyra/filament/cell","organelle","Ядро","Обычно подвешено в центральной части клетки на цитоплазматических тяжах.",230,160),
 n("spirogyra/conjugation","spirogyra","reproduction","Конъюгация","Половой процесс: содержимое соединённых клеток сливается и формируется зигота.",368,224),
 n("spirogyra/conjugation/tube","spirogyra/conjugation","structure","Конъюгационная трубка","Соединяет клетки соседних нитей во время лестничной конъюгации.",240,163),
 n("spirogyra/zygospore","spirogyra","reproduction","Зигоспора (2n)","После слияния гамет диплоидная зигота покрывается устойчивой оболочкой.",370,102,"2n")
];
export const BIO_ALTERNATIVE_SPECIES:Record<BioAlternativeOrganism,BioAlternativeSpecies>={
 sponge:{id:"sponge",name:"Бадяга озёрная",scientific:"Spongilla lacustris",group:"animal",badge:"Без настоящих тканей",intro:"Фильтрующее многоклеточное животное с особыми клеточными типами и водоносной системой.",warning:"Не показываем у губки сердце, желудок, лёгкие или полноценные ткани.",source:BIO_ALT_SOURCES.sponge,nodes:sponge},
 hydra:{id:"hydra",name:"Гидра обыкновенная",scientific:"Hydra vulgaris",group:"animal",badge:"Два клеточных слоя",intro:"Пресноводный полип с пищеварительной полостью, стрекательными клетками и почкованием.",warning:"Клеточные слои реальны, но сложные системы органов позвоночных гидре не присущи.",source:BIO_ALT_SOURCES.hydra,nodes:hydra},
 moss:{id:"moss",name:"Кукушкин лён",scientific:"Polytrichum commune",group:"plant",badge:"Чередование поколений",intro:"Рассматривайте отдельно гаплоидный гаметофит и диплоидный спорофит.",warning:"Ризоиды не называют корнями, листовидные структуры не приравнивают к листьям сосудистых растений.",source:BIO_ALT_SOURCES.moss,nodes:moss,cycle:[
  {id:"spore",title:"Спора (n)",description:"После мейоза формируется гаплоидная спора.",nodeId:"moss/spore",ploidy:"n"},
  {id:"protonema",title:"Протонема (n)",description:"Спора прорастает в нитевидную протонему.",nodeId:"moss/protonema",ploidy:"n"},
  {id:"gametophyte",title:"Гаметофит (n)",description:"Развиваются листостебельные гаметофоры и гаметы.",nodeId:"moss/gametophyte",ploidy:"n"},
  {id:"zygote",title:"Оплодотворение → зигота (2n)",description:"Сперматозоид в воде достигает яйцеклетки; начинается диплоидная стадия.",nodeId:"moss/gametophyte/gametangium/zygote",ploidy:"2n"},
  {id:"sporophyte",title:"Спорофит (2n)",description:"На гаметофите развивается ножка с коробочкой.",nodeId:"moss/sporophyte",ploidy:"2n"},
  {id:"meiosis",title:"Мейоз → споры (n)",description:"В коробочке образуются гаплоидные споры.",nodeId:"moss/sporophyte/capsule",ploidy:"n"}
 ]},
 chlamydomonas:{id:"chlamydomonas",name:"Хламидомонада",scientific:"Chlamydomonas reinhardtii",group:"plant",badge:"Одна клетка",intro:"Изучение начинается сразу с клетки и её органоидов.",warning:"Отсутствующие органы, ткани и поколения не создаются только ради пяти уровней.",source:BIO_ALT_SOURCES.chlamydomonas,nodes:chlamydomonas},
 spirogyra:{id:"spirogyra",name:"Спирогира",scientific:"Spirogyra communis",group:"plant",badge:"Нитчатая водоросль",intro:"От клеточной нити можно приблизиться к ядру, спиральному хлоропласту и пиреноиду.",warning:"Конъюгация является половым процессом, а не органом; зигоспора относится к репродуктивной стадии.",source:BIO_ALT_SOURCES.spirogyra,nodes:spirogyra,cycle:[
  {id:"filament",title:"Нить (n)",description:"Вегетативные гаплоидные клетки объединены в нити.",nodeId:"spirogyra/filament",ploidy:"n"},
  {id:"conjugation",title:"Конъюгация",description:"Клетки соединяются трубкой и содержимое сливается.",nodeId:"spirogyra/conjugation"},
  {id:"zygospore",title:"Зигоспора (2n)",description:"Диплоидная устойчивая зигоспора переживает неблагоприятный период.",nodeId:"spirogyra/zygospore",ploidy:"2n"},
  {id:"meiosis",title:"Мейоз и прорастание",description:"При прорастании восстанавливается гаплоидная стадия.",nodeId:"spirogyra/filament",ploidy:"n"}
 ]}
};
export const BIO_ALT_KIND_LABELS:Record<BioAltKind,string>={
 organism:"Организм",generation:"Поколение",structure:"Структура",tissue:"Клеточный слой / ткань",
 cell:"Клетка",organelle:"Часть клетки / органоид",reproduction:"Размножение"
};
export function bioAltChildren(species:BioAlternativeSpecies,parentId:string):BioAltNode[]{
 return species.nodes.filter(node=>node.parentId===parentId);
}
export function bioAltPath(species:BioAlternativeSpecies,nodeId:string):BioAltNode[]{
 const index=new Map(species.nodes.map(node=>[node.id,node]));
 const result:BioAltNode[]=[];
 let current=index.get(nodeId);
 const seen=new Set<string>();
 while(current&&!seen.has(current.id)){
  seen.add(current.id);result.unshift(current);
  current=current.parentId?index.get(current.parentId):undefined;
 }
 return result;
}
export function bioAltValid(species:BioAlternativeSpecies):boolean{
 const nodes=species.nodes;
 if(!nodes.length||nodes[0].id!==species.id||nodes[0].parentId!==null||
  new Set(nodes.map(n=>n.id)).size!==nodes.length)return false;
 const byId=new Map(nodes.map(n=>[n.id,n]));
 return nodes.every(node=>!!node.name.trim()&&!!node.description.trim()&&
  (node.parentId===null?node.id===species.id:byId.has(node.parentId))&&
  bioAltPath(species,node.id)[0]?.id===species.id)&&
  (species.cycle??[]).every(step=>byId.has(step.nodeId));
}
