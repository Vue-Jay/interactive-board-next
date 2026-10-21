/** Russian school-level mineral-resource reference.
 * A commodity class is not a claim about the composition or reserves
 * at any particular USGS point. */
export type MineralGuide={title:string;className:string;composition:string;uses:string};
const ore="Рудное минеральное сырьё",nonmetal="Нерудное минеральное сырьё";
const fuel="Горючие полезные ископаемые";
export const mineralGuides:ReadonlyArray<MineralGuide>=[
 {title:"Каменный уголь",className:fuel,composition:"Ископаемый уголь с высоким содержанием углерода",uses:"Энергетика, коксохимическое производство"},
 {title:"Бурый уголь",className:fuel,composition:"Уголь с меньшей степенью углефикации",uses:"Топливо для электростанций"},
 {title:"Горючие сланцы",className:fuel,composition:"Осадочные породы, содержащие органическое вещество",uses:"Топливное и химическое сырьё"},
 {title:"Нефть",className:fuel,composition:"Природная смесь жидких углеводородов",uses:"Топливо, нефтехимическая промышленность"},
 {title:"Природный газ",className:fuel,composition:"Газообразная смесь преимущественно метана",uses:"Энергетика, отопление, химическая промышленность"},
 {title:"Золото",className:ore,composition:"Самородное золото (Au), золотосодержащие руды",uses:"Ювелирное дело, электронные контакты, финансовые резервы"},
 {title:"Медные руды",className:ore,composition:"Медные руды, в том числе халькопирит CuFeS₂",uses:"Электропроводка, электроника, трубопроводы, сплавы"},
 {title:"Железные руды",className:ore,composition:"Гематит Fe₂O₃, магнетит Fe₃O₄ и другие руды",uses:"Получение железа и стали"},
 {title:"Алмазы",className:nonmetal,composition:"Кристаллический углерод (C)",uses:"Абразивные материалы, режущие инструменты, ювелирное дело"},
 {title:"Никелевые руды",className:ore,composition:"Сульфидные и латеритные никелевые руды",uses:"Нержавеющие стали, жаропрочные сплавы, аккумуляторы"},
 {title:"Алюминиевые руды",className:ore,composition:"Бокситы: смесь гидроксидов алюминия и сопутствующих минералов",uses:"Получение алюминия, транспорт, строительство"},
 {title:"Оловянные руды",className:ore,composition:"Касситерит SnO₂ и другие оловянные руды",uses:"Припои, лужение, производство сплавов"},
 {title:"Полиметаллические руды",className:ore,composition:"Свинцово-цинковые руды, содержащие галенит (PbS), сфалерит (ZnS) и сопутствующие минералы",uses:"Производство цветных металлов, защитных покрытий и аккумуляторов"},
 {title:"Калийные соли",className:nonmetal,composition:"Сильвин KCl, карналлит и другие соли",uses:"Производство калийных удобрений"},
 {title:"Апатиты",className:nonmetal,composition:"Апатитовые фосфатные минералы",uses:"Производство фосфорных удобрений и фосфорной кислоты"},
 {title:"Фосфориты",className:nonmetal,composition:"Фосфатное сырьё, преимущественно апатитовая группа",uses:"Фосфорные удобрения, фосфорная кислота"},
 {title:"Вольфрамовые руды",className:ore,composition:"Вольфрамит и шеелит CaWO₄",uses:"Твёрдые сплавы, износостойкий инструмент"},
 {title:"Марганцевые руды",className:ore,composition:"Оксидные и карбонатные марганцевые руды",uses:"Ферросплавы, легирование стали, химические процессы"},
 {title:"Молибденовые руды",className:ore,composition:"Молибденит MoS₂ и другие молибденовые руды",uses:"Легированные стали, жаростойкие материалы"},
 {title:"Хромовые руды",className:ore,composition:"Хромшпинелиды, в том числе хромит FeCr₂O₄",uses:"Феррохром, нержавеющая сталь, огнеупоры"},
 {title:"Поваренная соль",className:nonmetal,composition:"Галит NaCl",uses:"Пищевая соль, химическое производство"},
 {title:"Ртутные руды",className:ore,composition:"Киноварь HgS и другие ртутьсодержащие минералы",uses:"Историческое сырьё для получения ртути"},
 {title:"Асбест",className:nonmetal,composition:"Волокнистые силикатные минералы",uses:"Исторически теплоизоляция; многие виды асбеста опасны для здоровья"},
 {title:"Графит",className:nonmetal,composition:"Кристаллическая форма углерода",uses:"Огнеупоры, карандаши, аккумуляторы"},
 {title:"Слюда",className:nonmetal,composition:"Группа слоистых силикатов",uses:"Электроизоляционные и строительные материалы"},
 {title:"Глауберова соль",className:nonmetal,composition:"Декагидрат сульфата натрия Na₂SO₄·10H₂O",uses:"Химическая промышленность"}
];
export const mineralGuide=(title:string)=>mineralGuides.find(item=>item.title===title);
