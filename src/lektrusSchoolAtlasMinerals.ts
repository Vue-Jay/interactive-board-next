/** School geography atlas legend. Restrict the resource map to the
 * types actually taught and used in Russian 7–9 grade geography atlases.
 * Sources: the Russian eighth-grade atlas resources classification and
 * standard teaching map conventions for mineral resources.
 * The current USGS deposit service does not contain the four fuel layers;
 * these are displayed only as reference symbols, never invented deposits.
 */
export const SCHOOL_ATLAS_MINERALS=[
 "Нефть","Природный газ","Каменный уголь","Бурый уголь",
 "Железная руда","Марганец","Хромиты","Никель","Вольфрам",
 "Молибден","Бокситы и алюминий","Медь","Полиметаллические руды",
 "Олово","Золото","Алмазы","Апатиты и фосфориты",
 "Калийные соли","Каменная соль"
] as const;
export type SchoolAtlasMineral=typeof SCHOOL_ATLAS_MINERALS[number];
export const SCHOOL_ATLAS_FUEL_MINERALS=[
 "Нефть","Природный газ","Каменный уголь","Бурый уголь"
] as const satisfies ReadonlyArray<SchoolAtlasMineral>;
export const SCHOOL_ATLAS_USGS_MINERALS=SCHOOL_ATLAS_MINERALS
 .filter((name):name is Exclude<SchoolAtlasMineral,typeof SCHOOL_ATLAS_FUEL_MINERALS[number]> =>
  !SCHOOL_ATLAS_FUEL_MINERALS.some(fuel=>fuel===name));
export const isSchoolAtlasMineral=(name:string):name is SchoolAtlasMineral=>
 (SCHOOL_ATLAS_MINERALS as readonly string[]).includes(name);
