import {getRemoteSession,isRemoteBackendEnabled} from "./backend";

const bucket="marketing-site";
const allowed:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
export const SITE_LIBRARY_SHOTS=[
 {name:"Рабочий стол",src:"/site/app-home.png"},
 {name:"Математика",src:"/site/board-math.png"},
 {name:"Химия",src:"/site/board-chemistry.png"},
 {name:"Геометрия",src:"/site/board-geometry.png"},
 {name:"Физика",src:"/site/board-physics.png"},
 {name:"География",src:"/site/board-contour.png"},
 {name:"История",src:"/site/board-history.png"},
 {name:"Русский язык",src:"/site/board-russian.png"},
 {name:"Все инструменты",src:"/site/board-showcase.png"}
];

export async function uploadMarketingImage(file:File):Promise<string>{
 if(!isRemoteBackendEnabled())throw Error("Для загрузки изображений требуется подключённый сервер.");
 if(!allowed[file.type])throw Error("Поддерживаются JPEG, PNG и WebP.");
 if(file.size===0||file.size>5*1024*1024)throw Error("Размер изображения должен быть от 1 байта до 5 МБ.");
 const backend=String(import.meta.env.VITE_SUPABASE_URL||"").replace(/\/$/,"");
 const key=String(import.meta.env.VITE_SUPABASE_ANON_KEY||"");
 if(!backend||!key)throw Error("Не настроен публичный адрес Supabase.");
 const session=await getRemoteSession();
 if(!session?.access_token)throw Error("Войди в Lektrus как администратор.");
 const path="images/"+crypto.randomUUID()+"."+allowed[file.type];
 const response=await fetch(backend+"/storage/v1/object/"+bucket+"/"+path,{
  method:"POST",
  headers:{apikey:key,Authorization:"Bearer "+session.access_token,"Content-Type":file.type,"x-upsert":"false"},
  body:file
 });
 if(!response.ok){
  let detail="";try{const data=await response.json();detail=String(data?.message||data?.error||"")}catch{/* no error payload */}
  throw Error("Не удалось загрузить изображение ("+response.status+"). "+detail);
 }
 return backend+"/storage/v1/object/public/"+bucket+"/"+path;
}
