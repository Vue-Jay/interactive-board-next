/** Expandable school-level biology atlas.
 * All paths are explicit reviewed illustrations; do not imply that every cell
 * of an organism is identical or that all branches share a single cell type.
 * A species has its OWN organ systems, organs, tissue and representative cells.
 */
export type BioOrganism="human"|"cat"|"sunflower"|"oak"|"sparrow"|"perch"|"frog"|"bee"|"snail"|"pine"|"fern"|"wheat";
export type BioLevel="organism"|"system"|"organ"|"tissue"|"cell";
export type BioActivity="explore"|"label"|"assemble";
export type BioNode={id:string;parentId:string|null;level:BioLevel;name:string;description:string;
 /** Optional reviewed source that explains THIS structure, not a blanket certification. */
 source?:{title:string;url:string};};
export type BioMicroscopeDiagram={
 kind:"bio-microscope";title:string;organism:BioOrganism;activity:BioActivity;
 showDescriptions:boolean;assignmentPath:string[];
};
export const BIO_LEVELS:BioLevel[]=["organism","system","organ","tissue","cell"];
export const BIO_LEVEL_LABELS:Record<BioLevel,string>={
 organism:"Организм",system:"Система",organ:"Орган",tissue:"Ткань",cell:"Клетка"
};
export const BIO_ORGANISMS:Record<BioOrganism,{name:string;group:"animal"|"plant";scientific:string;note:string}>={
 human:{name:"Человек",group:"animal",scientific:"Homo sapiens",note:"Многоклеточный организм с органами, системами органов и специализированными клетками."},
 cat:{name:"Кошка домашняя",group:"animal",scientific:"Felis catus",note:"Млекопитающее с характерными органами чувств, мышцами и пищеварительной системой."},
 sunflower:{name:"Подсолнечник",group:"plant",scientific:"Helianthus annuus",note:"Цветковое растение с корнями, побегами, листьями и семенами."},
 oak:{name:"Дуб черешчатый",group:"plant",scientific:"Quercus robur",note:"Древесное цветковое растение с многолетним стеблем и проводящими тканями."},
 sparrow:{name:"Воробей домовый",group:"animal",scientific:"Passer domesticus",note:"Птица с воздухоносными капиллярами лёгких, перьями и острым зрением."},
 perch:{name:"Окунь речной",group:"animal",scientific:"Perca fluviatilis",note:"Пресноводная лучепёрая рыба с жабрами и боковой линией."},
 frog:{name:"Лягушка травяная",group:"animal",scientific:"Rana temporaria",note:"Земноводное с лёгочным и кожным дыханием во взрослом состоянии."},
 bee:{name:"Пчела медоносная",group:"animal",scientific:"Apis mellifera",note:"Насекомое с трахейной системой, фасеточными глазами и летательными мышцами."},
 snail:{name:"Улитка виноградная",group:"animal",scientific:"Helix pomatia",note:"Наземный брюхоногий моллюск с мускулистой ногой и лёгочной полостью мантии."},
 pine:{name:"Сосна обыкновенная",group:"plant",scientific:"Pinus sylvestris",note:"Хвойное голосеменное растение с хвоей, корнями и мужскими стробилами."},
 fern:{name:"Орляк обыкновенный",group:"plant",scientific:"Pteridium aquilinum",note:"Сосудистое споровое растение с вайями, корневищем и спорангиями."},
 wheat:{name:"Пшеница мягкая",group:"plant",scientific:"Triticum aestivum",note:"Однодольное цветковое растение с колосом, листом и мочковатыми корнями."}
};
type Chain=[string,string,string,string,string,string,string,string];
/** A chain lists three parent-child relationships plus a specialized cell,
 * with a short factual note for each non-root level. */
const chains:Record<BioOrganism,Chain[]>={
 human:[
  ["Дыхательная система","Обеспечивает газообмен.","Лёгкие","Газообмен между воздухом и кровью происходит в альвеолах.","Эпителий альвеол","Тонкий альвеолярный эпителий участвует в диффузии газов.","Пневмоцит I типа","Плоская клетка альвеолярного эпителия."],
  ["Кровеносная система","Перемещает кровь по сосудам.","Сердце","Сокращениями обеспечивает ток крови.","Сердечная мышечная ткань","Содержит сократительные клетки миокарда.","Кардиомиоцит","Мышечная клетка, обеспечивающая сокращения сердца."],
  ["Нервная система","Получает и обрабатывает информацию.","Головной мозг","Участвует в координации и обработке сигналов.","Нервная ткань","Включает нейроны и глиальные клетки.","Нейрон","Передаёт сигналы через отростки и синапсы."]
 ],
 cat:[
  ["Сенсорная система","Позволяет воспринимать сигналы окружающей среды.","Глаз","Регистрирует свет с помощью сетчатки.","Сетчатка","Содержит фоторецепторы и нейроны.","Палочка","Фоторецептор, чувствительный к слабому освещению."],
  ["Опорно-двигательная система","Обеспечивает движения тела.","Скелетная мышца","Сокращается и перемещает части тела.","Поперечнополосатая мышечная ткань","Образована многоядерными мышечными волокнами.","Мышечное волокно","Сократительная клетка скелетной мышцы."],
  ["Пищеварительная система","Перерабатывает и всасывает питательные вещества.","Тонкая кишка","Основное всасывание питательных веществ.","Кишечный эпителий","Покрывает внутреннюю поверхность кишки.","Энтероцит","Всасывающая клетка кишечного эпителия."]
 ],
 sunflower:[
  ["Побег","Листья и стебель обеспечивают фотосинтез и транспорт.","Лист","Улавливает свет и осуществляет газообмен.","Столбчатая паренхима","Клетки мезофилла содержат многочисленные хлоропласты.","Фотосинтезирующая клетка","Хлоропласты превращают энергию света в химическую."],
  ["Корневая система","Закрепляет растение и поглощает воду и ионы.","Корень","Получает воду и минеральные вещества из почвы.","Ризодерма","Покровная ткань молодого корня.","Корневой волосок","Вырост клетки ризодермы увеличивает площадь поглощения."],
  ["Генеративные органы","Обеспечивают половое размножение растения.","Цветок","Содержит репродуктивные структуры.","Эпидермис лепестка","Покровные клетки защищают поверхность.","Клетка эпидермиса","Клетка наружного покрова органа."]
 ],
 oak:[
  ["Побег","Стебель и листья обеспечивают рост, транспорт и фотосинтез.","Ствол","Поддерживает крону и содержит проводящие ткани.","Ксилема","Проводит воду и минеральные вещества.","Сосудистый элемент","Мёртвая зрелая проводящая клетка с утолщённой стенкой."],
  ["Побег","Стебель и листья обеспечивают рост, транспорт и фотосинтез.","Лист","В листовой пластинке проходит фотосинтез.","Мезофилл","Содержит клетки с хлоропластами.","Клетка мезофилла","Зелёная клетка с фотосинтезирующими органоидами."],
  ["Корневая система","Закрепляет дерево и поглощает воду и ионы.","Молодой корень","Участвует в поглощении воды.","Ризодерма","Наружный слой молодых корней.","Клетка корневого волоска","Образует вырост для поглощения воды."]
 ],
 sparrow:[
  ["Дыхательная система","Лёгкие и воздушные мешки обеспечивают эффективную вентиляцию.","Лёгкое","Парабронхи связаны с воздухоносными капиллярами.","Газообменный эпителий","Отделяет воздух от капиллярной крови.","Клетка газообменного эпителия","Тонкая клетка воздухоносного капилляра."],
  ["Покровная система","Защищает тело и образует перья.","Кожа","Состоит из эпидермиса и дермы.","Эпидермис","Наружная защитная ткань.","Кератиноцит","Образует кератиновые компоненты покрова."],
  ["Зрительная система","Передаёт зрительную информацию.","Глаз","Фокусирует свет на сетчатке.","Сетчатка","Содержит фоторецепторы и нейроны.","Колбочка","Фоторецептор дневного и цветового зрения."]
 ],
 perch:[
  ["Дыхательная система","Проводит воду через жабры.","Жабры","Жаберные нити несут газообменные ламеллы.","Эпителий ламелл","Тонкая поверхность для диффузии газов.","Эпителиальная клетка ламеллы","Отделяет воду от тканей с капиллярами."],
  ["Система боковой линии","Воспринимает движения воды.","Боковая линия","Содержит чувствительные невромасты.","Сенсорный эпителий невромаста","Содержит волосковые рецепторы и опорные клетки.","Волосковая клетка","Реагирует на механическое отклонение ресничного пучка."],
  ["Кровеносная система","Обеспечивает перенос крови к жабрам и тканям.","Сердце","Имеет одно предсердие и один желудочек, а также дополнительные отделы.","Миокард","Мышечная ткань стенки сердца.","Кардиомиоцит","Сократительная клетка миокарда."]
 ],
 frog:[
  ["Покровная система","Защищает тело и участвует в кожном газообмене.","Кожа","Влажная кожа с железами и капиллярами.","Эпидермис","Наружный клеточный слой кожи.","Кератиноцит","Участвует в формировании покрова."],
  ["Дыхательная система","У взрослых лягушек в дыхании участвуют лёгкие и кожа.","Лёгкие","Мешковидные лёгкие с внутренними складками.","Дыхательный эпителий","Газообменная выстилка лёгкого.","Эпителиальная клетка лёгкого","Клетка газообменной поверхности."],
  ["Зрительная система","Восприятие световых сигналов.","Глаз","Создаёт изображение на сетчатке.","Сетчатка","Содержит фоторецепторы.","Палочка","Чувствительный к слабому свету фоторецептор."]
 ],
 bee:[
  ["Трахейная система","Переносит воздух прямо к тканям без участия гемолимфы.","Трахея","Воздушная трубка с хитиновой выстилкой.","Эпителий трахеи","Составляет стенку трахеи под кутикулой.","Трахейная эпителиальная клетка","Живая клетка стенки трахеи."],
  ["Зрительная система","Содержит многократно повторяющиеся зрительные единицы.","Сложный глаз","Состоит из омматидиев.","Фоторецепторы омматидия","Образуют рабдом с чувствительными мембранами.","Рабдомерный фоторецептор","Светочувствительная клетка сложного глаза."],
  ["Двигательная система","Приводит крылья в движение.","Лётная мышца груди","Поперечнополосатая мышца груди.","Поперечнополосатая мышечная ткань","Содержит организованные саркомеры.","Мышечное волокно","Сократительная многоядерная клетка."]
 ],
 snail:[
  ["Двигательная система","Обеспечивает волнообразные движения ноги.","Мускулистая нога","Широкая поверхность тела для ползания.","Мышечная ткань ноги","Состоит из пучков гладких мышц.","Гладкий миоцит","Удлинённая сократительная клетка."],
  ["Зрительная система","Глаза находятся на верхних щупальцах.","Глаз верхнего щупальца","Воспринимает свет.","Фоторецепторный эпителий","Клетки, преобразующие свет в сигналы.","Фоторецепторная клетка","Светочувствительная нервная клетка."],
  ["Дыхательная система","Газообмен происходит через сосудистую крышу мантийной полости.","Мантия","Образует стенку лёгочной полости.","Эпителий мантии","Покровная ткань мантийной полости.","Покровная эпителиальная клетка","Клетка выстилки мантии."]
 ],
 pine:[
  ["Побег","Несёт хвою и обеспечивает фотосинтез.","Хвоя","Узкий лист с погружёнными устьицами.","Мезофилл хвои","Содержит фотосинтезирующие клетки.","Клетка мезофилла хвои","Содержит хлоропласты."],
  ["Корневая система","Поглощает воду и закрепляет дерево.","Молодой корень","Участвует в поглощении воды.","Ризодерма","Наружная ткань молодого корня.","Клетка с корневым волоском","Образует поглощающий вырост."],
  ["Мужские репродуктивные побеги","Несут стробилы с микроспорангиями.","Микроспорангий","Образует микроспоры при мейозе.","Спорогенная ткань","Содержит материнские клетки микроспор.","Микроспороцит","Диплоидная клетка, проходящая мейоз."]
 ],
 fern:[
  ["Листья спорофита","Фотосинтезируют и могут нести сорусы.","Вайя","Крупный расчленённый лист.","Мезофилл вайи","Содержит хлоропласты.","Клетка мезофилла вайи","Фотосинтезирующая клетка листа."],
  ["Спороносные структуры","Спорангии образуют споры, группируются в сорусы.","Спорангий","Капсула со спорогенными клетками.","Спорогенная ткань","Содержит материнские клетки спор.","Материнская клетка спор","Образует гаплоидные споры через мейоз."],
  ["Корневая система","Поглощает воду и закрепляет растение.","Придаточный корень","Развивается от корневища.","Кора корня","Паренхима между покровом и центральным цилиндром.","Клетка коровой паренхимы","Живая клетка запаса и обмена веществ."]
 ],
 wheat:[
  ["Побег","Включает листья и стебель.","Лист","Узкий лист с параллельными жилками.","Мезофилл листа","Фотосинтезирующая ткань.","Клетка мезофилла","Живая клетка с хлоропластами."],
  ["Корневая система","Мочковатые корни поглощают воду.","Молодой корень","Имеет зону корневых волосков.","Ризодерма","Наружная ткань молодого корня.","Клетка с корневым волоском","Корневой волосок является её выростом."],
  ["Генеративные органы","В цветках колосков формируются семена.","Пыльник","Образует пыльцу в микроспорангиях.","Тапетум","Питательный слой микроспорангия.","Клетка тапетума","Поддерживает образование пыльцы."]
 ]
};
const slug=(v:string)=>v.toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]+/gu,"-");
export function bioNodes(organism:BioOrganism):BioNode[]{
 const meta=BIO_ORGANISMS[organism];
 const root:BioNode={id:organism,parentId:null,level:"organism",name:meta.name,description:meta.note};
 const entries=new Map<string,BioNode>([[root.id,root]]);
 for(const [system,systemInfo,organ,organInfo,tissue,tissueInfo,cell,cellInfo] of chains[organism]){
  const nodes:[BioLevel,string,string][]=[
   ["system",system,systemInfo],["organ",organ,organInfo],["tissue",tissue,tissueInfo],["cell",cell,cellInfo]
  ];
  let parent=root.id;
  for(const [level,name,description] of nodes){
   const id=parent+"/"+slug(name);
   if(!entries.has(id)){
    const facts=bioReviewedNode(organism,id,name,description);
    entries.set(id,{id,parentId:parent,level,...facts});
   }
   parent=id;
  }
 }
 return [...entries.values()];
}
export const bioChildren=(nodes:BioNode[],id:string)=>nodes.filter(n=>n.parentId===id);
export function bioAncestors(nodes:BioNode[],id:string):BioNode[]{
 const byId=new Map(nodes.map(n=>[n.id,n]));
 const path:BioNode[]=[];
 let next=byId.get(id);
 while(next){path.unshift(next);next=next.parentId?byId.get(next.parentId):undefined;}
 return path;
}
export function newBioMicroscope():BioMicroscopeDiagram{
 const organism:"human"="human";
 const nodes=bioNodes(organism);
 const leaf=nodes.find(node=>node.level==="cell")!;
 return {kind:"bio-microscope",title:"Интерактивный микроскоп",organism,
  activity:"explore",showDescriptions:true,assignmentPath:bioAncestors(nodes,leaf.id).map(n=>n.id)};
}
export function withBioOrganism(d:BioMicroscopeDiagram,organism:BioOrganism):BioMicroscopeDiagram{
 const nodes=bioNodes(organism),leaf=nodes.find(n=>n.level==="cell")!;
 return {...d,organism,assignmentPath:bioAncestors(nodes,leaf.id).map(n=>n.id)};
}
export function validBioMicroscope(value:unknown):value is BioMicroscopeDiagram{
 if(!value||typeof value!=="object")return false;
 const d=value as BioMicroscopeDiagram;
 if(d.kind!=="bio-microscope"||!Object.hasOwn(BIO_ORGANISMS,d.organism)||
  !["explore","label","assemble"].includes(d.activity)||
  typeof d.title!=="string"||d.title.length>120||!d.title.trim()||
  typeof d.showDescriptions!=="boolean"||!Array.isArray(d.assignmentPath))return false;
 const nodes=bioNodes(d.organism);
 if(d.assignmentPath.length!==5)return false;
 const path=d.assignmentPath.map(id=>nodes.find(node=>node.id===id));
 return path.every((node,i)=>!!node&&node.level===BIO_LEVELS[i]&&
  (i===0?node.parentId===null:node.parentId===path[i-1]?.id));
}


/** The visual family follows the *entire* ancestor chain, not a generic
 * organism-wide cell. A neuron, a photoreceptor and a leaf cell must not
 * be presented as the same microscopic specimen. */
export type BioVisualKey="lungs"|"heart"|"brain"|"eye"|"muscle"|"gut"|"flower"|"root"|"leaf"|"wood"|"gills"|"lateral-line"|"trachea"|"compound-eye"|"foot"|"mantle"|"needle"|"microsporangium"|"frond"|"sporangium"|"anther"|"skin"|"other";
export function bioVisualKey(node:BioNode):BioVisualKey{
 const p=node.id.toLocaleLowerCase("ru-RU");
 if(p==="sunflower/побег")return "leaf";
 const special:Record<string,BioVisualKey>={
  "perch/дыхательная-система":"gills","perch/система-боковой-линии":"lateral-line",
  "bee/трахейная-система":"trachea","bee/зрительная-система":"compound-eye",
  "snail/двигательная-система":"foot","snail/дыхательная-система":"mantle",
  "pine/побег":"needle","pine/мужские-репродуктивные-побеги":"microsporangium",
  "fern/листья-спорофита":"frond","fern/спороносные-структуры":"sporangium",
  "wheat/генеративные-органы":"anther",
  "sparrow/покровная-система":"skin","frog/покровная-система":"skin"
 };
 for(const [start,key] of Object.entries(special))if(p===start||p.startsWith(start+"/"))return key;
 if(p==="oak/побег")return "wood";
 if(p.includes("дыхатель")||p.includes("лёгк")||p.includes("пневмоцит"))return "lungs";
 if(p.includes("кровенос")||p.includes("сердц")||p.includes("кардиомиоцит"))return "heart";
 if(p.includes("нервн")||p.includes("головн")||p.includes("нейрон"))return "brain";
 if(p.includes("сенсорн")||p.includes("глаз")||p.includes("сетчатк")||p.includes("палочк"))return "eye";
 if(p.includes("опорно")||p.includes("скелетн")||p.includes("мышечн")||p.includes("волокн"))return "muscle";
 if(p.includes("пищевар")||p.includes("киш")||p.includes("энтероцит"))return "gut";
 if(p.includes("генератив")||p.includes("цветк")||p.includes("лепестк"))return "flower";
 if(p.includes("корнев")||p.includes("корень")||p.includes("ризодерм"))return "root";
 if(p.includes("лист")||p.includes("мезофилл")||p.includes("фотосинтез")||p.includes("паренхим"))return "leaf";
 if(p.includes("ствол")||p.includes("древес")||p.includes("ксилем")||p.includes("сосудист"))return "wood";
 return "other";
}
export type BioImageSpot={x:number;y:number};
/** Responsive SVG viewBox is 480×330. Coordinates are anatomical
 * illustration landmarks. They describe the diagrams, not measurements. */
export function bioChildSpot(
 organism:BioOrganism,parent:BioNode,child:BioNode,index:number,total:number
):BioImageSpot{
 if(parent.level==="organism"){
  const key=bioVisualKey(child);
  const locations:Partial<Record<BioOrganism,Record<string,BioImageSpot>>>={
   sparrow:{lungs:{x:255,y:168},skin:{x:305,y:128},eye:{x:153,y:112}},
   perch:{gills:{x:169,y:173},"lateral-line":{x:275,y:167},heart:{x:224,y:220}},
   frog:{skin:{x:308,y:164},lungs:{x:241,y:185},eye:{x:186,y:103}},
   bee:{trachea:{x:293,y:193},"compound-eye":{x:153,y:150},muscle:{x:235,y:139}},
   snail:{foot:{x:249,y:250},eye:{x:165,y:96},mantle:{x:287,y:177}},
   pine:{needle:{x:307,y:117},root:{x:240,y:286},microsporangium:{x:192,y:154}},
   fern:{frond:{x:306,y:120},sporangium:{x:191,y:188},root:{x:236,y:289}},
   wheat:{leaf:{x:313,y:180},root:{x:237,y:293},anther:{x:236,y:61}}
  };
  if(locations[organism])return locations[organism]![key]??{x:160+index*145,y:182};
  const animal:Record<string,BioImageSpot>=organism==="human"?{
   lungs:{x:250,y:144},heart:{x:228,y:183},brain:{x:238,y:60}
  }:{eye:{x:195,y:160},muscle:{x:298,y:213},gut:{x:238,y:225}};
  const plant:Record<string,BioImageSpot>=organism==="sunflower"?{
   leaf:{x:176,y:199},root:{x:238,y:291},flower:{x:240,y:88}
  }:{leaf:{x:305,y:128},root:{x:240,y:290},wood:{x:240,y:234}};
  return (BIO_ORGANISMS[organism].group==="animal"?animal:plant)[key]
   ??{x:240+index*35-(total-1)*17.5,y:170};
 }
 // A shared shoot has both stem and leaves: their hotspots should
 // occupy different places, rather than one unclickable centre.
 if(parent.level==="system"&&total>1){
  const key=bioVisualKey(child);
  if(key==="leaf")return {x:333,y:124};
  if(key==="wood")return {x:206,y:218};
  return {x:190+index*95,y:164};
 }
 return {x:240,y:163};
}


/** References remain optional. A specific source is attributed only to
 * the biology it actually supports. Existing document paths are stable,
 * including older boards that saved a leaf id before wording was corrected. */
export const BIO_REFERENCES={
 roots:{title:"OpenStax Biology 2e · Roots",url:"https://openstax.org/books/biology-2e/pages/30-3-roots"},
 stem:{title:"OpenStax Biology · Stems (xylem)",url:"https://openstax.org/books/biology/pages/30-2-stems"},
 alveoli:{title:"NCBI Bookshelf · Histology, Alveolar Cells",url:"https://www.ncbi.nlm.nih.gov/books/NBK557542/"},
 sunflower:{title:"University of Helsinki · Sunflower inflorescences",url:"https://www.helsinki.fi/en/news/life-sciences/researchers-determine-why-spirals-gerbera-inflorescences-follow-fibonacci-sequence"},
 insect:{title:"OpenStax Biology 2e · Systems of Gas Exchange",url:"https://openstax.org/books/biology-2e/pages/39-1-systems-of-gas-exchange"},
 fish:{title:"OpenStax Biology 2e · Systems of Gas Exchange",url:"https://openstax.org/books/biology-2e/pages/39-1-systems-of-gas-exchange"},
 bird:{title:"OpenStax Biology 2e · Breathing",url:"https://openstax.org/books/biology-2e/pages/39-3-breathing"},
 amphibian:{title:"OpenStax Biology 2e · Breathing",url:"https://openstax.org/books/biology-2e/pages/39-3-breathing"},
 mollusc:{title:"British Geological Survey · Gastropods",url:"https://www.bgs.ac.uk/discovering-geology/fossils-and-geological-time/gastropods/"},
 conifer:{title:"OpenStax Biology 2e · Gymnosperms",url:"https://openstax.org/books/biology-2e/pages/26-2-gymnosperms"},
 needle:{title:"OpenStax Biology 2e · Leaves",url:"https://openstax.org/books/biology-2e/pages/30-4-leaves"},
 fern:{title:"OpenStax Biology 2e · Seedless Vascular Plants",url:"https://openstax.org/books/biology-2e/pages/25-4-seedless-vascular-plants"}
} as const;
function bioReviewedNode(
 organism:BioOrganism,id:string,name:string,description:string
):Pick<BioNode,"name"|"description"|"source">{
 const parts=id.split("/");
 const tail=parts.at(-1)??"";
 const scientificSource=organism==="sparrow"&&id.includes("/дыхательная-")?BIO_REFERENCES.bird
  :organism==="perch"&&id.includes("/дыхательная-")?BIO_REFERENCES.fish
  :organism==="frog"&&id.includes("/дыхательная-")?BIO_REFERENCES.amphibian
  :organism==="bee"&&id.includes("/трахейная-")?BIO_REFERENCES.insect
  :organism==="snail"&&id.includes("/дыхательная-")?BIO_REFERENCES.mollusc
  :organism==="pine"&&id.includes("/побег")?BIO_REFERENCES.needle
  :organism==="pine"&&id.includes("/мужские-")?BIO_REFERENCES.conifer
  :organism==="fern"&&id.includes("/спороносные-")?BIO_REFERENCES.fern:undefined;
 if(scientificSource)return {name,description,source:scientificSource};
 const rootHair=tail==="корневой-волосок"||tail==="клетка-корневого-волоска";
 if(rootHair)return {
  name:"Клетка ризодермы с корневым волоском",
  description:"Корневой волосок — вырост одной клетки ризодермы в зоне всасывания; он увеличивает площадь поглощения воды и растворённых минеральных веществ.",
  source:BIO_REFERENCES.roots
 };
 if(organism==="sunflower"&&tail==="цветок")return {
  name:"Соцветие-корзинка",
  description:"Это не один цветок: корзинка подсолнечника состоит из множества мелких трубчатых цветков в центре и язычковых цветков по краю.",
  source:BIO_REFERENCES.sunflower
 };
 if(organism==="sunflower"&&tail==="эпидермис-лепестка")return {
  name:"Эпидермис венчика язычкового цветка",
  description:"Покровные клетки образуют наружный слой язычкового цветка на краю соцветия-корзинки.",
  source:BIO_REFERENCES.sunflower
 };
 if(organism==="sunflower"&&tail==="клетка-эпидермиса")return {
  name:"Клетка эпидермиса венчика",
  description:"Покровная клетка поверхности язычкового цветка. Окраска венчика обусловлена пигментами, а не обязательным наличием хлоропластов.",
  source:BIO_REFERENCES.sunflower
 };
 if(organism==="cat"&&tail==="сенсорная-система")return {
  name:"Зрительная сенсорная система",
  description:"Глаз воспринимает свет; зрительный нерв передаёт сигналы к нервным центрам, участвующим в обработке зрительной информации."
 };
 if(tail==="пневмоцит-i-типа"||tail==="эпителий-альвеол")return {
  name,description,source:BIO_REFERENCES.alveoli
 };
 if(tail==="сосудистый-элемент"||tail==="ксилема")return {
  name,
  description:tail==="сосудистый-элемент"
   ?"Зрелый проводящий элемент ксилемы мёртв и не имеет ядра и живого содержимого. Перфорации обеспечивают транспорт воды вдоль сосудов."
   :description,
  source:BIO_REFERENCES.stem
 };
 return {name,description};
}
/** A sunflower flower-head is a compound inflorescence, not a single organ.
 * Retain the five-step school atlas navigation, but label its level honestly. */
export function bioLevelName(node:BioNode):string{
 if(node.level==="system"&&BIO_ORGANISMS[node.id.split("/")[0] as BioOrganism]?.group==="plant")
  return "Орган / комплекс органов";
 if(node.level==="organ"&&node.id==="sunflower/генеративные-органы/цветок")
  return "Соцветие";
 return BIO_LEVEL_LABELS[node.level];
}
/** Stable multiple-choice alternatives. Never omit the correct answer even
 * if it is the last cell in the last path. No network or random source needed. */
export function bioTaskChoices(nodes:BioNode[],target:BioNode,count=4):BioNode[]{
 const candidates=nodes.filter(node=>node.level===target.level&&node.id!==target.id);
 const scored=candidates.map(node=>{
  // Prefer genuine alternatives in a different parent branch to an
  // identical sibling, so a one-child image is not an automatic "win".
  const idScore=[...node.id].reduce((v,c)=>(v*31+c.charCodeAt(0))%997,7);
  return {node,score:node.parentId===target.parentId?0:1,idScore};
 }).sort((a,b)=>a.score-b.score||a.idScore-b.idScore);
 const result=[target,...scored.slice(0,Math.max(0,count-1)).map(item=>item.node)];
 return result.sort((a,b)=>a.name.localeCompare(b.name,"ru-RU"));
}


/** Microscope callouts are specimen-specific. No universal "typical" cell
 * is presented for a vessel element, a photoreceptor and a leaf mesophyll. */
export type BioCellFeature={name:string;description:string};
const feature=(name:string,description:string):BioCellFeature=>({name,description});
export function bioCellFeatures(node:BioNode):BioCellFeature[]{
 if(node.level!=="cell")return [];
 const id=node.id;
 if(id.endsWith("/пневмоцит-i-типа"))return [
  feature("Тонкая цитоплазма","Уплощённая часть клетки образует очень короткий путь диффузии газов."),
  feature("Плотные соединения","Контакты с соседними клетками поддерживают барьер альвеол."),
  feature("Ядро","Живой пневмоцит I типа сохраняет ядро, хотя на тонких участках его нет.")];
 if(id.endsWith("/кардиомиоцит"))return [
  feature("Миофибриллы","Повторяющиеся саркомеры обеспечивают сокращение."),
  feature("Вставочные диски","Соединяют соседние кардиомиоциты механически и электрически."),
  feature("Митохондрии","Поддерживают высокую потребность сердечной мышцы в энергии.")];
 if(id.endsWith("/нейрон"))return [
  feature("Дендриты","Принимают сигналы от других клеток."),
  feature("Аксон","Проводит электрические сигналы на расстояние."),
  feature("Синаптические окончания","Передают сигнал следующей клетке через контакт.")];
 if(id.endsWith("/палочка"))return [
  feature("Наружный сегмент","Содержит мембранные диски со светочувствительным пигментом родопсином."),
  feature("Внутренний сегмент","Содержит органоиды, включая митохондрии."),
  feature("Синаптическое окончание","Связано с нейронами сетчатки.")];
 if(id.endsWith("/мышечное-волокно"))return [
  feature("Сарколемма","Наружная мембрана мышечного волокна."),
  feature("Миофибриллы","Саркомеры создают поперечную исчерченность."),
  feature("Периферические ядра","У зрелого скелетного мышечного волокна обычно много ядер.")];
 if(id.endsWith("/энтероцит"))return [
  feature("Микроворсинки","Образуют щёточную каёмку и увеличивают площадь всасывания."),
  feature("Плотные контакты","Связывают клетки кишечного эпителия."),
  feature("Митохондрии","Обеспечивают энергию для процессов переноса веществ.")];
 if(id.endsWith("/сосудистый-элемент"))return [
  feature("Одревесневшая стенка","Лигнин укрепляет вторичную клеточную стенку."),
  feature("Перфорации","Соединяют полости соседних элементов сосуда."),
  feature("Нет живого содержимого","У зрелого элемента отсутствуют ядро и протопласт.")];
 if(id.endsWith("/фотосинтезирующая-клетка")||id.endsWith("/клетка-мезофилла"))return [
  feature("Хлоропласты","Осуществляют фотосинтез."),
  feature("Центральная вакуоль","Помогает поддерживать тургор клетки."),
  feature("Клеточная стенка","Целлюлозный каркас поддерживает форму клетки.")];
 if(id.endsWith("/корневой-волосок")||id.endsWith("/клетка-корневого-волоска"))return [
  feature("Корневой волосок","Это вырост одной живой клетки, а не отдельная клетка."),
  feature("Клеточная мембрана","Регулирует перенос растворённых веществ."),
  feature("Вакуоль","Участвует в поддержании водного баланса.")];
 if(id.endsWith("/клетка-эпидермиса"))return [
  feature("Клеточная стенка","Образует механическую оболочку поверхностной клетки."),
  feature("Вакуоль","Может содержать растворённые пигменты и другие вещества."),
  feature("Кутикула","Восковидный наружный слой защищает надземную поверхность.")];
 return ADDITIONAL_CELL_FEATURES[node.name]??[];
}

/** Curated descriptions for additional specimen-specific cellular structures. */
const ADDITIONAL_CELL_FEATURES:Record<string,BioCellFeature[]>={
 "Клетка газообменного эпителия": [
  {
   "name": "Тонкая цитоплазма",
   "description": "Сокращает путь диффузии между воздухом и кровью."
  },
  {
   "name": "Базальная мембрана",
   "description": "Участвует в воздушно-кровяном барьере."
  },
  {
   "name": "Ядро",
   "description": "Сохраняется в живой клетке."
  }
 ],
 "Кератиноцит": [
  {
   "name": "Кератиновые нити",
   "description": "Обеспечивают прочность покрова."
  },
  {
   "name": "Контакты клеток",
   "description": "Связывают соседние клетки эпидермиса."
  },
  {
   "name": "Дифференцировка",
   "description": "При ороговении наружные клетки теряют ядро."
  }
 ],
 "Колбочка": [
  {
   "name": "Наружный сегмент",
   "description": "Содержит светочувствительные пигменты."
  },
  {
   "name": "Внутренний сегмент",
   "description": "Поддерживает обмен веществ клетки."
  },
  {
   "name": "Синапс",
   "description": "Передаёт сигнал нейронам сетчатки."
  }
 ],
 "Эпителиальная клетка ламеллы": [
  {
   "name": "Тонкая поверхность",
   "description": "Уменьшает путь диффузии газа."
  },
  {
   "name": "Контакт с водой",
   "description": "Апикальная мембрана обращена к воде."
  },
  {
   "name": "Базальная поверхность",
   "description": "Обращена к тканям с капиллярами."
  }
 ],
 "Волосковая клетка": [
  {
   "name": "Стереоцилии",
   "description": "Отклоняются при движении воды."
  },
  {
   "name": "Киноцилия",
   "description": "Определяет направление чувствительности."
  },
  {
   "name": "Синапс",
   "description": "Передаёт сигнал сенсорному нейрону."
  }
 ],
 "Эпителиальная клетка лёгкого": [
  {
   "name": "Тонкая поверхность",
   "description": "Участвует в обмене газов."
  },
  {
   "name": "Клеточные контакты",
   "description": "Поддерживают непрерывность эпителия."
  },
  {
   "name": "Ядро",
   "description": "Сохраняется в живой эпителиальной клетке."
  }
 ],
 "Трахейная эпителиальная клетка": [
  {
   "name": "Кутикулярная интима",
   "description": "Хитиновая выстилка обращена к просвету трахеи."
  },
  {
   "name": "Ядро",
   "description": "Живая клетка эпителия содержит ядро."
  },
  {
   "name": "Клеточная мембрана",
   "description": "Отделяет клетки от окружающих тканей."
  }
 ],
 "Рабдомерный фоторецептор": [
  {
   "name": "Рабдомер",
   "description": "Содержит светочувствительную мембрану."
  },
  {
   "name": "Зрительный пигмент",
   "description": "Поглощает свет."
  },
  {
   "name": "Аксон",
   "description": "Передаёт сигнал зрительной системе."
  }
 ],
 "Гладкий миоцит": [
  {
   "name": "Актин и миозин",
   "description": "Обеспечивают сокращение без поперечной исчерченности."
  },
  {
   "name": "Удлинённая форма",
   "description": "Позволяет укорачиваться при сокращении."
  },
  {
   "name": "Ядро",
   "description": "Обычно одно ядро."
  }
 ],
 "Фоторецепторная клетка": [
  {
   "name": "Светочувствительный участок",
   "description": "Регистрирует свет."
  },
  {
   "name": "Преобразование сигнала",
   "description": "Свет влияет на состояние мембраны."
  },
  {
   "name": "Нервная связь",
   "description": "Передаёт информацию нервной системе."
  }
 ],
 "Покровная эпителиальная клетка": [
  {
   "name": "Апикальная поверхность",
   "description": "Обращена в мантийную полость."
  },
  {
   "name": "Клеточные контакты",
   "description": "Связывают покровные клетки."
  },
  {
   "name": "Ядро",
   "description": "Живая клетка сохраняет ядро."
  }
 ],
 "Клетка мезофилла хвои": [
  {
   "name": "Хлоропласты",
   "description": "Осуществляют фотосинтез."
  },
  {
   "name": "Стенка",
   "description": "Содержит целлюлозу."
  },
  {
   "name": "Вакуоль",
   "description": "Поддерживает тургор."
  }
 ],
 "Клетка с корневым волоском": [
  {
   "name": "Корневой волосок",
   "description": "Вырост одной живой клетки."
  },
  {
   "name": "Мембрана",
   "description": "Регулирует поглощение."
  },
  {
   "name": "Вакуоль",
   "description": "Поддерживает водный баланс."
  }
 ],
 "Микроспороцит": [
  {
   "name": "Диплоидное ядро",
   "description": "Начинает мейоз с двойным набором хромосом."
  },
  {
   "name": "Мейоз",
   "description": "Даёт начало гаплоидным микроспорам."
  },
  {
   "name": "Клеточная стенка",
   "description": "Изменяется при формировании спор."
  }
 ],
 "Клетка мезофилла вайи": [
  {
   "name": "Хлоропласты",
   "description": "Участвуют в фотосинтезе."
  },
  {
   "name": "Стенка",
   "description": "Поддерживает форму клетки."
  },
  {
   "name": "Вакуоль",
   "description": "Поддерживает тургор."
  }
 ],
 "Материнская клетка спор": [
  {
   "name": "Диплоидное ядро",
   "description": "Содержит набор хромосом спорофита."
  },
  {
   "name": "Мейоз",
   "description": "Даёт начало гаплоидным спорам."
  },
  {
   "name": "Образование спор",
   "description": "Споры дают начало гаметофиту."
  }
 ],
 "Клетка коровой паренхимы": [
  {
   "name": "Цитоплазма",
   "description": "Участвует в обмене веществ."
  },
  {
   "name": "Стенка",
   "description": "Ограничивает клетку."
  },
  {
   "name": "Вакуоль",
   "description": "Может запасать растворённые вещества."
  }
 ],
 "Клетка тапетума": [
  {
   "name": "Питательная функция",
   "description": "Поддерживает развитие микроспор."
  },
  {
   "name": "Секреция",
   "description": "Участвует в формировании оболочки пыльцы."
  },
  {
   "name": "Исчезновение слоя",
   "description": "Обычно разрушается к зрелости пыльцы."
  }
 ]
};
