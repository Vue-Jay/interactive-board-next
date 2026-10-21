/** Standard mineral signs from the school atlas legend supplied by the user.
 * Keep this single list shared by filtering, map, and legend.
 * A legend entry does not imply that the USGS point dataset covers this class.
 */
export const SCHOOL_ATLAS_GROUPS=[
 {title:"Горючие",names:["Каменный уголь","Бурый уголь","Горючие сланцы","Нефть","Природный газ"]},
 {title:"Металлические",names:[
  "Железные руды","Марганцевые руды","Хромовые руды","Никелевые руды",
  "Вольфрамовые руды","Молибденовые руды","Алюминиевые руды","Медные руды",
  "Полиметаллические руды","Оловянные руды","Золото","Ртутные руды"
 ]},
 {title:"Неметаллические",names:[
  "Асбест","Графит","Слюда","Апатиты","Фосфориты",
  "Калийные соли","Поваренная соль","Глауберова соль","Алмазы"
 ]}
] as const;
export const SCHOOL_ATLAS_MINERALS=SCHOOL_ATLAS_GROUPS.flatMap(g=>[...g.names]);
export type SchoolAtlasMineral=(typeof SCHOOL_ATLAS_GROUPS)[number]["names"][number];
export const SCHOOL_ATLAS_FUEL_MINERALS=[
 "Каменный уголь","Бурый уголь","Горючие сланцы","Нефть","Природный газ"
] as const;
export const SCHOOL_ATLAS_USGS_MINERALS=SCHOOL_ATLAS_MINERALS.filter(name=>
 !SCHOOL_ATLAS_FUEL_MINERALS.some(f=>f===name));
export const isSchoolAtlasMineral=(name:string):name is SchoolAtlasMineral=>
 SCHOOL_ATLAS_MINERALS.includes(name as SchoolAtlasMineral);
