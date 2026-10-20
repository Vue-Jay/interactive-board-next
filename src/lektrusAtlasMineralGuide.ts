/** Russian school-level mineral-resource reference.
 * A commodity class is not a claim about the composition or reserves
 * at any particular USGS point. */
export type MineralGuide={title:string;className:string;composition:string;uses:string};
const ore="Рудное минеральное сырьё",nonmetal="Нерудное минеральное сырьё";
export const mineralGuides:ReadonlyArray<MineralGuide>=[
 {title:"Золото",className:ore,composition:"Самородное золото (Au), золотосодержащие руды",uses:"Ювелирное дело, электронные контакты, финансовые резервы"},
 {title:"Серебро",className:ore,composition:"Самородное серебро (Ag), сульфидные руды",uses:"Электроника, ювелирное дело, фотоэлектрические устройства"},
 {title:"Медь",className:ore,composition:"Медные руды, в том числе халькопирит CuFeS₂",uses:"Электропроводка, электроника, трубопроводы, сплавы"},
 {title:"Железная руда",className:ore,composition:"Гематит Fe₂O₃, магнетит Fe₃O₄ и другие руды",uses:"Получение железа и стали"},
 {title:"Уран",className:ore,composition:"Урансодержащие минералы (например, уранинит)",uses:"Ядерное топливо после переработки и обогащения"},
 {title:"Алмазы",className:nonmetal,composition:"Кристаллический углерод (C)",uses:"Абразивные материалы, режущие инструменты, ювелирное дело"},
 {title:"Литий",className:ore,composition:"Литиевые минералы и минерализованные рассолы",uses:"Аккумуляторы, стекло, керамика"},
 {title:"Никель",className:ore,composition:"Сульфидные и латеритные никелевые руды",uses:"Нержавеющие стали, жаропрочные сплавы, аккумуляторы"},
 {title:"Бокситы и алюминий",className:ore,composition:"Бокситы: смесь гидроксидов алюминия и сопутствующих минералов",uses:"Получение алюминия, транспорт, строительство"},
 {title:"Олово",className:ore,composition:"Касситерит SnO₂ и другие оловянные руды",uses:"Припои, лужение, производство сплавов"},
 {title:"Свинец",className:ore,composition:"Галенит PbS и другие свинцовые руды",uses:"Аккумуляторы, радиационная защита, сплавы"},
 {title:"Цинк",className:ore,composition:"Сфалерит ZnS и другие цинковые руды",uses:"Цинкование стали, сплавы, химическая промышленность"},
 {title:"Калийные соли",className:nonmetal,composition:"Сильвин KCl, карналлит и другие соли",uses:"Производство калийных удобрений"},
 {title:"Фосфориты",className:nonmetal,composition:"Фосфатное сырьё, преимущественно апатитовая группа",uses:"Фосфорные удобрения, фосфорная кислота"},
 {title:"Вольфрам",className:ore,composition:"Вольфрамит и шеелит CaWO₄",uses:"Твёрдые сплавы, износостойкий инструмент"},
 {title:"Марганец",className:ore,composition:"Оксидные и карбонатные марганцевые руды",uses:"Ферросплавы, легирование стали, химические процессы"},
 {title:"Редкоземельные элементы",className:ore,composition:"Минералы, содержащие лантаноиды, скандий и иттрий",uses:"Постоянные магниты, оптика, электроника, катализаторы"},
 {title:"Молибден",className:ore,composition:"Молибденит MoS₂ и другие молибденовые руды",uses:"Легированные стали, жаростойкие материалы"},
 {title:"Кобальт",className:ore,composition:"Кобальтсодержащие руды, часто совместно с никелем и медью",uses:"Аккумуляторы, жаропрочные сплавы, катализаторы"},
 {title:"Бериллий",className:ore,composition:"Берилл Be₃Al₂Si₆O₁₈, бертрандит",uses:"Лёгкие конструкционные сплавы, специальные приборы"},
 {title:"Титан",className:ore,composition:"Ильменит FeTiO₃, рутил TiO₂",uses:"Титановые сплавы, диоксид титана для пигментов"},
 {title:"Хромиты",className:ore,composition:"Хромшпинелиды, в том числе хромит FeCr₂O₄",uses:"Феррохром, нержавеющая сталь, огнеупоры"},
 {title:"Платина",className:ore,composition:"Платина и другие металлы платиновой группы",uses:"Катализаторы, электроника, ювелирное дело"},
 {title:"Барит",className:nonmetal,composition:"Сульфат бария BaSO₄",uses:"Утяжелители буровых растворов, химическая промышленность"},
 {title:"Гипс",className:nonmetal,composition:"Двуводный сульфат кальция CaSO₄·2H₂O",uses:"Строительные смеси, гипсовые изделия"},
 {title:"Каменная соль",className:nonmetal,composition:"Галит NaCl",uses:"Пищевая соль, химическое производство"},
 {title:"Борные минералы",className:nonmetal,composition:"Бораты, содержащие соединения бора",uses:"Стекловолокно, боросиликатное стекло, химическая промышленность"},
 {title:"Каолин",className:nonmetal,composition:"Глинистое сырьё, богатое каолинитом Al₂Si₂O₅(OH)₄",uses:"Фарфор, керамика, бумажная промышленность"},
 {title:"Флюорит",className:nonmetal,composition:"Фторид кальция CaF₂",uses:"Производство фтороводорода, металлургические флюсы"}
];
export const mineralGuide=(title:string)=>mineralGuides.find(item=>item.title===title);
