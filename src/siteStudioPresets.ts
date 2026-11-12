import {newSiteBlock,type SiteBlock,type SiteBlockStyle,type SiteTheme} from "./marketingSiteConfig";

const make=(kind:SiteBlock["kind"],override:Partial<SiteBlock>,style:Partial<SiteBlockStyle>={}):SiteBlock=>{
 const base=newSiteBlock(kind);
 return {...base,...override,style:{...base.style,...style}};
};
export type SiteSectionPreset={id:string;title:string;description:string;symbol:string;create:()=>SiteBlock[]};
export const SITE_SECTION_PRESETS:SiteSectionPreset[]=[
 {id:"intro",title:"Знакомство",description:"Крупный текст и живая иллюстрация",symbol:"✦",create:()=>[
  make("text",{title:"Покажите главное",text:"Здесь ваш главный посыл: коротко объясните пользу проекта."},{spacing:"airy"}),
  make("image",{title:"Смотрите, как это работает",text:"Реальный снимок пространства Lektrus.",image:"/site/app-home.png",buttonLabel:"Открыть приложение"},{tone:"soft",imageSide:"right"})
 ]},
 {id:"product",title:"Возможности",description:"Три преимущества с акцентом",symbol:"▦",create:()=>[
  make("cards",{title:"Почему выбирают нас",text:"Три причины, которые важны посетителю.",items:["Первая важная возможность","Второе преимущество","Третья особенность"]},{tone:"soft",columns:3,spacing:"airy"})
 ]},
 {id:"gallery",title:"Скриншоты",description:"Галерея настоящих экранов Lektrus",symbol:"▧",create:()=>[
  make("gallery",{title:"Взгляните на продукт",text:"Реальные инструменты и учебные сценарии.",items:["/site/board-math.png","/site/board-chemistry.png","/site/board-physics.png","/site/board-geometry.png"]},{columns:2,spacing:"airy"})
 ]},
 {id:"metrics",title:"Цифры",description:"Красивые показатели и факты",symbol:"№",create:()=>[
  make("stats",{title:"Результаты в цифрах",text:"Замените примеры своими проверенными показателями.",items:["01 | Ваш первый показатель","02 | Второй показатель","03 | Третий показатель"]},{tone:"accent",align:"center",columns:3,spacing:"airy"})
 ]},
 {id:"faq",title:"Вопросы",description:"Раскрывающиеся ответы для посетителей",symbol:"?",create:()=>[
  make("faq",{title:"Частые вопросы",text:"Собрали самое важное в одном месте.",items:["Как начать? | Зарегистрируйтесь в Lektrus и откройте приложение.","Что доступно без регистрации? | Попробуйте гостевую демонстрацию доски.","Как связаться с командой? | Оставьте сообщение через форму на сайте."]},{tone:"soft",spacing:"airy"})
 ]},
 {id:"story",title:"Цитата",description:"Большой выразительный отзыв",symbol:"❞",create:()=>[
  make("quote",{title:"Имя и роль автора",text:"Добавьте сюда настоящую цитату пользователя. Не публикуйте выдуманные отзывы."},{tone:"dark",align:"center",spacing:"airy"})
 ]},
 {id:"finish",title:"Финальный экран",description:"Заметный призыв к действию",symbol:"↗",create:()=>[
  make("cta",{title:"Попробуйте Lektrus",text:"Ваше пространство для живого обучения уже готово.",href:"/app",buttonLabel:"Начать работу"},{tone:"accent",align:"center",spacing:"airy"})
 ]}
];
export type SiteThemePreset={id:string;title:string;note:string;theme:SiteTheme};
export const SITE_THEME_PRESETS:SiteThemePreset[]=[
 {id:"lektrus",title:"L E K T R U S",note:"Фирменный синий",theme:{accent:"#2563eb",background:"#f8fafc",surface:"#ffffff",ink:"#122238",radius:18,maxWidth:1200}},
 {id:"aqua",title:"A Q U A",note:"Холодная свежесть",theme:{accent:"#0f9b91",background:"#f1faf9",surface:"#ffffff",ink:"#123c3d",radius:22,maxWidth:1200}},
 {id:"peach",title:"W A R M",note:"Тёплый акцент",theme:{accent:"#dc673c",background:"#fff9f4",surface:"#ffffff",ink:"#38271e",radius:16,maxWidth:1200}},
 {id:"iris",title:"I R I S",note:"Мягкий фиолетовый",theme:{accent:"#7356cc",background:"#faf8ff",surface:"#ffffff",ink:"#28233e",radius:24,maxWidth:1200}},
 {id:"mono",title:"M O N O",note:"Минимализм",theme:{accent:"#384b66",background:"#f5f7f9",surface:"#ffffff",ink:"#202d3f",radius:8,maxWidth:1180}}
];
