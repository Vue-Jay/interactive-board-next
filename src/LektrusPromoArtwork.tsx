import type { CSSProperties } from "react";
import "./lektrusPromoArtwork.css";

export type PromoSceneName = "home" | "math" | "chemistry" | "geometry" | "physics" | "contour" | "history" | "russian";

const sceneInfo: Record<PromoSceneName, { title: string; eyebrow: string; accent: string }> = {
  home: { title: "Общий урок", eyebrow: "ПРОСТРАНСТВО УРОКА", accent: "#7489ed" },
  math: { title: "Математика", eyebrow: "ГРАФИК ФУНКЦИИ", accent: "#697de8" },
  chemistry: { title: "Химия", eyebrow: "ЛАБОРАТОРНАЯ ПРАКТИКА", accent: "#32a98e" },
  geometry: { title: "Геометрия", eyebrow: "ПОСТРОЕНИЕ", accent: "#bd80d3" },
  physics: { title: "Физика", eyebrow: "ЭЛЕКТРИЧЕСКАЯ ЦЕПЬ", accent: "#e5a34a" },
  contour: { title: "География", eyebrow: "КАРТА МИРА", accent: "#38a99d" },
  history: { title: "История", eyebrow: "ИСТОРИЧЕСКИЙ АТЛАС", accent: "#ca855e" },
  russian: { title: "Русский язык", eyebrow: "ЗВУК И БУКВА", accent: "#7883df" },
};

export default function LektrusPromoArtwork({ scene, compact = false }: { scene: PromoSceneName; compact?: boolean }) {
  const info = sceneInfo[scene];
  return (
    <div className={"promo-art promo-art-" + scene + (compact ? " promo-art-compact" : "")} style={{ "--promo-accent": info.accent } as CSSProperties}>
      <svg viewBox="0 0 760 500" role="img" aria-label={info.title + " — иллюстрация возможностей Lektrus"} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={"promo-paper-" + scene} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" />
            <stop offset="1" stopColor="#f5f8fb" />
          </linearGradient>
          <linearGradient id={"promo-liquid-" + scene} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a8e7d1" />
            <stop offset="1" stopColor="#38ab91" />
          </linearGradient>
          <filter id={"promo-shadow-" + scene} x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="17" stdDeviation="18" floodColor="#243c53" floodOpacity=".16" />
          </filter>
        </defs>
        <ellipse cx="385" cy="437" rx="247" ry="22" fill="#20394d" opacity=".08" />
        <g filter={"url(#promo-shadow-" + scene + ")"}>
          <rect x="58" y="34" width="644" height="408" rx="23" fill="#14283d" />
          <path d="M81 34h598a23 23 0 0 1 23 23v22H58V57a23 23 0 0 1 23-23Z" fill="#1d344b" />
          <circle cx="82" cy="59" r="5" fill="#ef8990" />
          <circle cx="100" cy="59" r="5" fill="#e9bd67" />
          <circle cx="118" cy="59" r="5" fill="#75c9a8" />
          <text x="380" y="63" textAnchor="middle" fill="#dce6ef" fontSize="11" fontWeight="700" letterSpacing="2.2">LEKTRUS</text>
          <rect x="79" y="91" width="602" height="326" rx="12" fill={"url(#promo-paper-" + scene + ")"} />
          <rect x="79" y="91" width="602" height="38" rx="12" fill="#fff" />
          <path d="M79 117v-14a12 12 0 0 1 12-12h578a12 12 0 0 1 12 12v14Z" fill="#fff" />
          <rect x="97" y="105" width="8" height="8" rx="3" fill={info.accent} />
          <text x="114" y="113" fill="#294055" fontSize="9" fontWeight="750">{info.title}</text>
          <text x="650" y="113" textAnchor="end" fill="#8796a2" fontSize="8" fontWeight="700" letterSpacing="1.2">{info.eyebrow}</text>
          <path d="M79 129h602" stroke="#e4ebef" />
          {scene === "math" && <g>
            <rect x="106" y="151" width="510" height="218" rx="9" fill="#fbfcff" stroke="#e6eaf4" />
            {[0,1,2,3,4,5,6,7,8,9].map((n) => <path key={"v"+n} d={"M" + (142+n*48) + " 168v182"} stroke="#e9edf5" />)}
            {[0,1,2,3,4].map((n) => <path key={"h"+n} d={"M132 " + (189+n*38) + "h455"} stroke="#e9edf5" />)}
            <path d="M140 278h450M365 171v180" stroke="#8294a6" strokeWidth="1.5" />
            <path d="M152 327 C213 321 239 299 277 268 S344 211 374 230 S423 302 468 282 S530 218 576 185" fill="none" stroke="#6074df" strokeWidth="5" strokeLinecap="round" />
            <circle cx="374" cy="230" r="7" fill="#fff" stroke="#6074df" strokeWidth="4" />
            <rect x="124" y="164" width="106" height="30" rx="8" fill="#f0f2ff" />
            <text x="177" y="183" textAnchor="middle" fill="#5265cb" fontSize="13" fontWeight="750">y = f(x)</text>
            <text x="571" y="343" textAnchor="end" fill="#8796a4" fontSize="9">Проведите исследование</text>
          </g>}
          {scene === "chemistry" && <g>
            <path d="M142 342h468" stroke="#ced9dc" strokeWidth="3" strokeLinecap="round" />
            <path d="M261 182h56v63l57 99a18 18 0 0 1-16 27h-138a18 18 0 0 1-16-27l57-99Z" fill="#fff" stroke="#8a9fa8" strokeWidth="3" />
            <path d="M223 306h132l21 38a18 18 0 0 1-18 27H211a18 18 0 0 1-18-27Z" fill={"url(#promo-liquid-" + scene + ")"} opacity=".95" />
            <path d="M256 188h67M249 246h80" stroke="#b6c6ca" strokeWidth="3" strokeLinecap="round" />
            <circle cx="270" cy="301" r="5" fill="#fff" opacity=".75" /><circle cx="292" cy="321" r="4" fill="#fff" opacity=".8" /><circle cx="322" cy="291" r="3" fill="#fff" opacity=".8" />
            <path d="M452 221h42v42l50 82a16 16 0 0 1-14 24h-114a16 16 0 0 1-14-24l50-82Z" fill="#fff" stroke="#9aadb3" strokeWidth="3" />
            <path d="M422 316h101l22 35a16 16 0 0 1-15 18h-114a16 16 0 0 1-15-18Z" fill="#a8cff2" />
            <path d="M447 228h51M440 269h66" stroke="#bfccd1" strokeWidth="3" strokeLinecap="round" />
            <rect x="148" y="153" width="122" height="26" rx="7" fill="#e8f6f1" />
            <text x="209" y="170" textAnchor="middle" fill="#308a76" fontSize="9" fontWeight="750">РАСТВОРЕНИЕ</text>
            <rect x="446" y="165" width="126" height="26" rx="7" fill="#eef4fc" />
            <text x="509" y="182" textAnchor="middle" fill="#5682aa" fontSize="9" fontWeight="750">ТЕМПЕРАТУРА 24°</text>
            <path d="M212 386h330" stroke="#dce6e6" />
            <text x="377" y="403" textAnchor="middle" fill="#8797a1" fontSize="9">Опыт начинается с наблюдения</text>
          </g>}
          {scene === "geometry" && <g>
            <rect x="110" y="150" width="510" height="220" rx="10" fill="#fcfbff" stroke="#eee8f3" />
            <path d="M180 332 352 172l191 160Z" fill="#f1edf9" stroke="#8a6db3" strokeWidth="4" strokeLinejoin="round" />
            <circle cx="352" cy="274" r="83" fill="none" stroke="#cb7fb7" strokeWidth="3" strokeDasharray="7 7" />
            <path d="M352 172v102M352 274h83" stroke="#a092b2" strokeWidth="2" />
            <circle cx="352" cy="274" r="6" fill="#fff" stroke="#7561ac" strokeWidth="3" />
            <path d="M344 262a17 17 0 0 1 17 17" fill="none" stroke="#6079db" strokeWidth="3" />
            <rect x="132" y="165" width="105" height="30" rx="8" fill="#f7eef8" />
            <text x="184" y="184" textAnchor="middle" fill="#9a5da0" fontSize="12" fontWeight="750">∠ A = 45°</text>
            <rect x="476" y="335" width="118" height="24" rx="7" fill="#eef3fb" />
            <text x="535" y="351" textAnchor="middle" fill="#5d76b8" fontSize="9" fontWeight="700">РАДИУС 3,5 см</text>
          </g>}
          {scene === "physics" && <g>
            <rect x="116" y="152" width="520" height="217" rx="10" fill="#fffdfa" stroke="#f0e9dc" />
            <path d="M182 206h156M422 206h150v106H182V206" fill="none" stroke="#536f89" strokeWidth="4" strokeLinejoin="round" />
            <path d="M338 184v44M355 193v26" stroke="#e3a44b" strokeWidth="5" strokeLinecap="round" />
            <path d="M422 182c-16 13-16 29 0 42 16-13 16-29 0-42Z" fill="#f6d990" stroke="#e5a34a" strokeWidth="3" />
            <path d="M410 226c4 9 20 9 24 0" fill="none" stroke="#e5a34a" strokeWidth="2" />
            <circle cx="182" cy="206" r="8" fill="#fff" stroke="#536f89" strokeWidth="3" />
            <circle cx="572" cy="312" r="8" fill="#fff" stroke="#536f89" strokeWidth="3" />
            <rect x="138" y="166" width="95" height="26" rx="7" fill="#fff3df" />
            <text x="185" y="183" textAnchor="middle" fill="#a77932" fontSize="9" fontWeight="750">СОБЕРИТЕ ЦЕПЬ</text>
            <path d="M270 340h213" stroke="#e9dfd0" />
            <text x="376" y="356" textAnchor="middle" fill="#8b897e" fontSize="9">Наблюдайте, как меняется схема</text>
          </g>}
          {(scene === "contour" || scene === "history") && <g>
            <rect x="110" y="149" width="520" height="224" rx="10" fill={scene === "history" ? "#faf6f1" : "#f3faf9"} stroke={scene === "history" ? "#eee0d3" : "#dcece9"} />
            <path d="M159 228 204 195l35 12 29-26 36 19 14 40-31 22-6 34-39 21-35-15-19-38-29-13Zm174-24 33-23 39 9 16 31 31-1 35 32-19 31-46-2-28 25-41-16-12-39-27-12Zm136 127 35-22 46 14 17 32-21 25-40-5-31-18Z" fill={scene === "history" ? "#dfb58e" : "#83c6b8"} stroke={scene === "history" ? "#b9825d" : "#3f9d92"} strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M167 265c50-22 77 17 117 4s70-42 109-27 79 1 116 27 53 27 89 14" fill="none" stroke={scene === "history" ? "#d59670" : "#5bb2b1"} strokeWidth="3" strokeDasharray="7 6" />
            <circle cx="331" cy="240" r="8" fill="#fff" stroke={scene === "history" ? "#bb7551" : "#378d89"} strokeWidth="4" />
            <rect x="127" y="162" width="113" height="27" rx="8" fill={scene === "history" ? "#f8ece1" : "#e5f4f1"} />
            <text x="183" y="180" textAnchor="middle" fill={scene === "history" ? "#a97553" : "#357f7a"} fontSize="9" fontWeight="750">{scene === "history" ? "КАРТА ЭПОХИ" : "ИССЛЕДУЙТЕ МИР"}</text>
            <rect x="495" y="329" width="112" height="26" rx="8" fill="#fff" />
            <text x="551" y="346" textAnchor="middle" fill="#738a92" fontSize="9">Подпишите маршрут</text>
          </g>}
          {scene === "russian" && <g>
            <rect x="110" y="150" width="520" height="217" rx="10" fill="#fbfbff" stroke="#e6e8f4" />
            <text x="370" y="209" textAnchor="middle" fill="#263e55" fontSize="37" fontWeight="750">МАЯК</text>
            <path d="M233 225h274" stroke="#dce2ed" strokeWidth="2" />
            {["М","А","Я","К"].map((letter, index) => <g key={letter}>
              <rect x={214 + index * 77} y="252" width="58" height="63" rx="12" fill={index === 1 ? "#eaf7f2" : "#f0f2fc"} stroke={index === 1 ? "#bee5d5" : "#d9def1"} />
              <text x={243 + index * 77} y="290" textAnchor="middle" fill={index === 1 ? "#32866f" : "#6170bd"} fontSize="24" fontWeight="750">{letter}</text>
              <text x={243 + index * 77} y="335" textAnchor="middle" fill="#82909d" fontSize="9">{["согл.","гласн.","согл.","согл."][index]}</text>
            </g>)}
            <rect x="294" y="350" width="152" height="26" rx="8" fill="#eef1fc" />
            <text x="370" y="367" textAnchor="middle" fill="#6877c1" fontSize="9" fontWeight="750">4 ЗВУКА · 4 БУКВЫ</text>
          </g>}
          {scene === "home" && <g>
            <rect x="105" y="148" width="534" height="225" rx="12" fill="#fbfcff" stroke="#e7ebf4" />
            <text x="137" y="181" fill="#2b4057" fontSize="15" fontWeight="750">Сегодня на уроке</text>
            <text x="137" y="199" fill="#82909c" fontSize="9">Идеи, материалы и совместная работа</text>
            <rect x="137" y="218" width="220" height="121" rx="11" fill="#edf2ff" />
            <path d="M164 308c25-1 28-31 53-35s30 25 53 10 28-36 55-45" fill="none" stroke="#6c7fe3" strokeWidth="4" strokeLinecap="round" />
            <circle cx="272" cy="283" r="6" fill="#fff" stroke="#6c7fe3" strokeWidth="3" />
            <text x="158" y="242" fill="#5365c8" fontSize="9" fontWeight="750">МАТЕМАТИКА</text>
            <rect x="374" y="218" width="232" height="55" rx="10" fill="#edf7f3" />
            <circle cx="401" cy="245" r="13" fill="#d5eee5" /><path d="M401 237v16m-8-8h16" stroke="#42a58b" strokeWidth="2" strokeLinecap="round" />
            <text x="424" y="242" fill="#328775" fontSize="9" fontWeight="750">ПРЕДМЕТНЫЕ ИНСТРУМЕНТЫ</text>
            <text x="424" y="257" fill="#788d8b" fontSize="8">Исследуйте и пробуйте</text>
            <rect x="374" y="284" width="232" height="55" rx="10" fill="#fff4e9" />
            <circle cx="401" cy="311" r="13" fill="#f6e2cc" /><path d="m396 311 4 4 7-8" fill="none" stroke="#bb8751" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <text x="424" y="308" fill="#9a7447" fontSize="9" fontWeight="750">ОБЩИЕ ЗАДАНИЯ</text>
            <text x="424" y="323" fill="#918477" fontSize="8">Создавайте и обсуждайте</text>
          </g>}
        </g>
      </svg>
    </div>
  );
}
