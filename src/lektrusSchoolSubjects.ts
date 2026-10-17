/** Canonical school subjects shared by board creation, board header and hub. */
export const LEKTRUS_SCHOOL_SUBJECTS=[
  "Математика","Физика","Химия","Биология","География",
  "Русский язык","Литература","История","Обществознание",
  "Информатика","Английский язык","Иностранный язык",
  "Окружающий мир","Физическая культура"
] as const;

/** Old boards must keep their tools, but Algebra/Geometry are no longer subjects. */
export function normalizeLektrusSubject(value:string):string{
  const name=value.trim();
  const lower=name.toLocaleLowerCase("ru-RU");
  if(lower==="алгебра"||lower==="геометрия")return "Математика";
  return name;
}
