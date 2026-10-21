/** Russian school-level mineral-resource reference.
 * A commodity class is not a claim about the composition or reserves
 * at any particular USGS point. */
export type MineralGuide={title:string;className:string;composition:string;uses:string};
const ore="Рудное минеральное сырьё",nonmetal="Нерудное минеральное сырьё";
export const mineralGuides:ReadonlyArray<MineralGuide>=[
 {title:"Золото",className:ore,composition:"Самородное золото (Au), золотосодержащие руды",uses:"Ювелирное дело, электронные контакты, финансовые резервы"},
 {title:"Медь",className:ore,composition:"Медные руды, в том числе халькопирит CuFeS₂",uses:"Электропроводка, электроника, трубопроводы, сплавы"},
 {title:"Железная руда",className:ore,composition:"Гематит Fe₂O₃, магнетит Fe₃O₄ и другие руды",uses:"Получение железа и стали"},
 {title:"Алмазы",className:nonmetal,composition:"Кристаллический углерод (C)",uses:"Абразивные материалы, режущие инструменты, ювелирное дело"},
 {title:"Никель",className:ore,composition:"Сульфидные и латеритные никелевые руды",uses:"Нержавеющие стали, жаропрочные сплавы, аккумуляторы"},
 {title:"Бокситы и алюминий",className:ore,composition:"Бокситы: смесь гидроксидов алюминия и сопутствующих минералов",uses:"Получение алюминия, транспорт, строительство"},
 {title:"Олово",className:ore,composition:"Касситерит SnO₂ и другие оловянные руды",uses:"Припои, лужение, производство сплавов"},
 {title:"Полиметаллические руды",className:ore,composition:"Свинцово-цинковые руды, содержащие галенит (PbS), сфалерит (ZnS) и сопутствующие минералы",uses:"Производство цветных металлов, защитных покрытий и аккумуляторов"},
 {title:"Калийные соли",className:nonmetal,composition:"Сильвин KCl, карналлит и другие соли",uses:"Производство калийных удобрений"},
 {title:"Апатиты и фосфориты",className:nonmetal,composition:"Фосфатное сырьё, преимущественно апатитовая группа",uses:"Фосфорные удобрения, фосфорная кислота"},
 {title:"Вольфрам",className:ore,composition:"Вольфрамит и шеелит CaWO₄",uses:"Твёрдые сплавы, износостойкий инструмент"},
 {title:"Марганец",className:ore,composition:"Оксидные и карбонатные марганцевые руды",uses:"Ферросплавы, легирование стали, химические процессы"},
 {title:"Молибден",className:ore,composition:"Молибденит MoS₂ и другие молибденовые руды",uses:"Легированные стали, жаростойкие материалы"},
 {title:"Хромиты",className:ore,composition:"Хромшпинелиды, в том числе хромит FeCr₂O₄",uses:"Феррохром, нержавеющая сталь, огнеупоры"},
 {title:"Каменная соль",className:nonmetal,composition:"Галит NaCl",uses:"Пищевая соль, химическое производство"},
];
export const mineralGuide=(title:string)=>mineralGuides.find(item=>item.title===title);
