import type { CurriculumAiLevel } from "./aiCurriculumGenerator";

export type SubjectExercise = { prompt: string; answer: string };

const fallbackTaskForms = [
  "Составь понятную схему по теме «{topic}»: покажи основные части/понятия и подпиши связь между ними.",
  "Придумай учебную ситуацию по теме «{topic}» и пошагово объясни, как применить изученное правило или понятие.",
  "Подготовь таблицу по теме «{topic}» с тремя важными признаками, примерами и коротким выводом.",
  "Составь мини-викторину по теме «{topic}» из трёх разных вопросов и приложи краткий ключ проверки.",
  "Найди типичную ошибку по теме «{topic}», объясни, почему она возникает, и покажи способ её исправить.",
  "Объясни тему «{topic}» ученику младшего класса: используй точные термины и один проверяемый пример.",
  "Сравни два понятия или процесса по теме «{topic}» по трём критериям; в конце укажи главное различие.",
  "Составь пошаговый алгоритм или план ответа по теме «{topic}» и проверь его на одном примере.",
  "Подготовь карточку для повторения по теме «{topic}»: вопрос, краткий ответ и пример применения.",
  "Разбери утверждение по теме «{topic}»: укажи, какие сведения подтверждают его, а какие требуют проверки.",
  "Сделай краткий конспект по теме «{topic}» из пяти тезисов и выдели один вывод, связывающий их.",
  "Подготовь практическое задание по теме «{topic}» с условием, ожидаемым результатом и способом самопроверки.",
  "Сформулируй два вопроса разного уровня по теме «{topic}» и объясни, какие знания нужны для ответа.",
  "Покажи тему «{topic}» на примере из жизни или учебного материала и объясни, где именно проявляется изучаемое правило.",
  "Подготовь краткое устное объяснение по теме «{topic}» и заверши его вопросом для самопроверки.",
];

const fallbackAnswerKeys: Record<string, string> = {
  "Физика": "Проверь, что закон применим к условию, величины записаны в согласованных единицах, а вывод подтверждён расчётом или наблюдением.",
  "Химия": "Сверь формулы и свойства с учебной таблицей или источником; соблюдай правила безопасности и не делай выводов по непроверенному наблюдению.",
  "Биология": "Проверь названия понятий, направление связей и соответствие примеров теме по учебному материалу.",
  "География": "Проверь объект по карте или данным, подпиши источник и отдели измеряемый факт от объяснения причины.",
  "Русский язык": "Проверь каждый пример по правилу, выдели диагностический признак и объясни исключения, если они есть.",
  "Литература": "Подтверди вывод эпизодами текста; не приписывай автору неподтверждённую мысль и не придумывай цитаты.",
  "История": "Проверь даты, последовательность и причинные связи по учебному источнику; не выдавай предположение за факт.",
  "Обществознание": "Проверь, что понятие употреблено по смыслу, аргументы относятся к ситуации, а вывод следует из приведённых оснований.",
  "Информатика": "Проверь однозначность шагов, корректность результата и работу на граничном случае.",
  "Иностранный язык": "Проверь грамматику, лексику и соответствие ответа теме; выдели целевую конструкцию и её функцию.",
};

/** Adds a distinct, source-safe task when a narrow topic generator would repeat an item. */
export function generateSubjectExerciseVariant(subject: string, topic: string, variant: number): SubjectExercise {
  const prompt = fallbackTaskForms[variant % fallbackTaskForms.length].replace("{topic}", topic);
  const subjectCheck = fallbackAnswerKeys[subject] ?? "Критерий проверки: понятия и примеры соответствуют теме, вывод подтверждён изученным материалом.";
  return { prompt, answer: `Ключ проверки: ${subjectCheck}` };
}

const choose = <T,>(items: T[], index: number) => items[index % items.length];

/**
 * Small, auditable exercise generators for common school topics.
 * These deliberately use only facts/formulas encoded here; unsupported topics
 * fall back to source-based tasks with a review checklist instead of invented facts.
 */
export function generateSubjectExercise(subject: string, topic: string, level: CurriculumAiLevel, index: number): SubjectExercise {
  const t = topic.toLocaleLowerCase("ru-RU");
  const advanced = level === "hard";
  const basic = level === "easy";

  if (subject === "Физика") {
    if (/последовательн.*соединен.*конденсатор/.test(t)) {
      const scale = index + 1, first = 6 * scale, second = 3 * scale, equivalent = 2 * scale;
      return { prompt: `Конденсаторы ёмкостью ${first} мкФ и ${second} мкФ соединены последовательно. Найди общую ёмкость батареи.`, answer: `Для последовательного соединения 1/Cобщ = 1/C₁ + 1/C₂; Cобщ = C₁C₂/(C₁ + C₂) = ${first} · ${second}/(${first} + ${second}) = ${equivalent} мкФ.` };
    }
    if (/потенциальн.*энерг.*пружин/.test(t)) {
      const stiffness = 50 + 10 * index, stretchCm = 10 + index, stretchM = stretchCm / 100, energy = stiffness * stretchM * stretchM / 2;
      return { prompt: `Пружину жёсткостью ${stiffness} Н/м растянули на ${stretchCm} см. Найди энергию упругой деформации.`, answer: `Eупр = kx²/2 = ${stiffness} · ${stretchCm / 100}² / 2 = ${energy.toLocaleString("ru-RU", { maximumFractionDigits: 3 })} Дж.` };
    }
    if (/сохранени.*механическ.*энерг/.test(t)) {
      const multiple = index + 1, height = 5 * multiple * multiple, speed = 10 * multiple;
      return { prompt: `Тело падает без начальной скорости с высоты ${height} м. Сопротивлением воздуха пренебречь, g = 10 м/с². Найди скорость у земли по закону сохранения механической энергии.`, answer: `mgh = mv²/2; v = √(2gh) = √(2 · 10 · ${height}) = ${speed} м/с.` };
    }
    if (/равномерн.*неравномерн/.test(t)) {
      const firstSpeed = 2 + index, secondSpeed = index % 2 === 0 ? firstSpeed : firstSpeed + 2, firstTime = 2, secondTime = 3, firstDistance = firstSpeed * firstTime, secondDistance = secondSpeed * secondTime;
      return { prompt: `На первом участке тело прошло ${firstDistance} м за ${firstTime} с, на втором — ${secondDistance} м за ${secondTime} с. Сравни скорости на участках и определи, было ли движение равномерным.`, answer: `v₁ = ${firstDistance}/${firstTime} = ${firstSpeed} м/с; v₂ = ${secondDistance}/${secondTime} = ${secondSpeed} м/с. ${firstSpeed === secondSpeed ? "Скорости равны, движение на этих участках равномерное." : "Скорости различны, движение неравномерное."}` };
    }
    if (/график.*(?:пути|зависимост.*координат)|(?:путь|координат).*график/.test(t)) {
      const speed = 2 + index, time = 2 + (index % 5), coordinate = speed * time;
      return { prompt: `На графике зависимости координаты x от времени прямая проходит через точки (0 с; 0 м) и (${time} с; ${coordinate} м). Найди скорость тела по графику.`, answer: `Скорость равна угловому коэффициенту графика: v = Δx/Δt = ${coordinate}/${time} = ${speed} м/с.` };
    }
    if (/удельн.*теплот.*плавлен|удельн.*теплот.*парообраз/.test(t)) {
      const vaporization = /парообраз/.test(t), mass = 1 + index, latent = vaporization ? 2_260_000 : 334_000, process = vaporization ? "парообразования" : "плавления", heat = mass * latent;
      return { prompt: `Чтобы ${vaporization ? "превратить воду при температуре кипения в пар" : "расплавить лёд при 0 °C"}, требуется ${latent.toLocaleString("ru-RU")} Дж на каждый килограмм. Сколько теплоты нужно для ${mass} кг?`, answer: `Q = λm = ${latent.toLocaleString("ru-RU")} · ${mass} = ${heat.toLocaleString("ru-RU")} Дж (удельная теплота ${process}).` };
    }
    if (/закон джоуля|джоуля.?ленца/.test(t)) {
      const current = 2 + (index % 5), resistance = 3 + (index % 7), time = 2 + (index % 6), heat = current * current * resistance * time;
      return { prompt: `По проводнику сопротивлением ${resistance} Ом в течение ${time} с проходит ток ${current} А. Найди количество теплоты по закону Джоуля — Ленца.`, answer: `Q = I²Rt = ${current}² · ${resistance} · ${time} = ${heat} Дж.` };
    }
    if (/средн.*скорост.*(?:вс[её]м пути|пути)|вс[её]м пути.*средн.*скорост/.test(t)) {
      const firstDistance = 2 + (index % 7), firstTime = 1 + (index % 4), secondDistance = 3 + (index % 8), secondTime = 2 + ((index * 2) % 5), distance = firstDistance + secondDistance, time = firstTime + secondTime;
      return { prompt: `Тело прошло ${firstDistance} км за ${firstTime} ч, затем ещё ${secondDistance} км за ${secondTime} ч. Найди среднюю скорость на всём пути.`, answer: `vср = sобщ / tобщ = (${firstDistance} + ${secondDistance}) / (${firstTime} + ${secondTime}) = ${distance} / ${time} = ${(distance / time).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} км/ч.` };
    }
    if (/ускорени/.test(t) && !/равномерн.*неравномерн/.test(t)) {
      const initial = index % 3 === 0 ? 0 : 2 + (index % 6), acceleration = 2 + (index % 5), time = 2 + (index % 4), final = initial + acceleration * time;
      return { prompt: `Скорость тела изменилась с ${initial} м/с до ${final} м/с за ${time} с. Найди ускорение.`, answer: `a = (v − v₀) / t = (${final} − ${initial}) / ${time} = ${acceleration} м/с².` };
    }
    if (/сила трени/.test(t)) {
      const mass = 2 + (index % 8), coefficient = 0.1 * (1 + (index % 6)), force = mass * 10 * coefficient;
      return { prompt: `Брусок массой ${mass} кг скользит по горизонтальной поверхности. Коэффициент трения скольжения μ = ${coefficient.toLocaleString("ru-RU")}. Прими g = 10 Н/кг. Найди силу трения.`, answer: `На горизонтали N = mg = ${mass} · 10 = ${mass * 10} Н; Fтр = μN = ${coefficient.toLocaleString("ru-RU")} · ${mass * 10} = ${force.toLocaleString("ru-RU")} Н.` };
    }
    if (/давлен.*жидк|гидростатическ.*давлен/.test(t)) {
      const depth = 2 + index, pressure = 1000 * 10 * depth;
      return { prompt: `Найди гидростатическое давление воды на глубине ${depth} м. Прими плотность воды 1000 кг/м³ и g = 10 Н/кг.`, answer: `p = ρgh = 1000 · 10 · ${depth} = ${pressure.toLocaleString("ru-RU")} Па.` };
    }
    if (/электрическ.*сопротивлен|сопротивлен.*проводник/.test(t)) {
      const current = 2 + (index % 7), resistance = 3 + (index % 8), voltage = current * resistance;
      return { prompt: `На участке проводника напряжение ${voltage} В, сила тока ${current} А. Найди сопротивление.`, answer: `По закону Ома R = U / I = ${voltage} / ${current} = ${resistance} Ом.` };
    }
    if (/плавани.*тел|услови.*плаван/.test(t)) {
      const bodyDensity = 450 + index * 25, liquidDensity = 1000, state = "всплывёт и будет плавать";
      return { prompt: `Плотность тела ${bodyDensity} кг/м³, плотность жидкости ${liquidDensity} кг/м³. Определи, что произойдёт с телом после погружения.`, answer: bodyDensity < liquidDensity ? `ρтела < ρжидкости (${bodyDensity} < ${liquidDensity}), поэтому тело ${state}.` : bodyDensity > liquidDensity ? `ρтела > ρжидкости (${bodyDensity} > ${liquidDensity}), поэтому тело ${state}.` : `ρтела = ρжидкости (${bodyDensity} = ${liquidDensity}), поэтому тело ${state}.` };
    }
    if (/последовательн.*соединен/.test(t)) {
      const first = 2 + (index % 7), second = 3 + ((index * 2) % 8), equivalent = first + second;
      return { prompt: `Два резистора сопротивлением ${first} Ом и ${second} Ом соединены последовательно. Найди общее сопротивление участка.`, answer: `При последовательном соединении Rобщ = R₁ + R₂ = ${first} + ${second} = ${equivalent} Ом.` };
    }
    if (/параллельн.*соединен/.test(t)) {
      const first = (index + 1) * 3, second = (index + 1) * 6, equivalent = first * second / (first + second);
      return { prompt: `Два резистора ${first} Ом и ${second} Ом соединены параллельно. Найди их эквивалентное сопротивление.`, answer: `1/Rобщ = 1/R₁ + 1/R₂; Rобщ = R₁R₂/(R₁ + R₂) = ${first} · ${second}/(${first} + ${second}) = ${equivalent} Ом.` };
    }
    if (/ускорени|средн.*скорост|равномерн.*неравномерн/.test(t)) {
      const initial = index % 3 === 0 ? 0 : 2 + (index % 6), acceleration = 2 + (index % 5), time = 2 + (index % 4);
      const final = initial + acceleration * time, distance = initial * time + acceleration * time * time / 2;
      return { prompt: `Тело двигалось с начальной скоростью ${initial} м/с и постоянным ускорением ${acceleration} м/с² в течение ${time} с. Найди конечную скорость и путь.`, answer: `v = v₀ + at = ${initial} + ${acceleration}·${time} = ${final} м/с; s = v₀t + at²/2 = ${initial}·${time} + ${acceleration}·${time}²/2 = ${distance} м.` };
    }
    if (/архимед|плавани.*тел/.test(t)) {
      const volume = 2 + (index % 8), density = 1000, g = 10, buoyant = density * g * volume / 1000;
      return { prompt: `Тело полностью погружено в воду (ρ = 1000 кг/м³), его объём ${volume / 1000} м³. Прими g = 10 Н/кг. Найди выталкивающую силу.`, answer: `Fₐ = ρgV = 1000·10·${volume / 1000} = ${buoyant} Н.` };
    }
    if (/кинетическ.*энерг/.test(t)) {
      const mass = 2 + (index % 7), speed = 2 + (index % 6), energy = mass * speed * speed / 2;
      return { prompt: `Тело массой ${mass} кг движется со скоростью ${speed} м/с. Найди его кинетическую энергию.`, answer: `Eₖ = mv²/2 = ${mass}·${speed}²/2 = ${energy} Дж.` };
    }
    if (/потенциальн.*энерг|сохранени.*механическ.*энерг/.test(t)) {
      const mass = 2 + (index % 7), height = 2 + (index % 6), energy = mass * 10 * height;
      return { prompt: `Тело массой ${mass} кг подняли на высоту ${height} м. Прими g = 10 Н/кг. Найди его потенциальную энергию относительно выбранного нулевого уровня.`, answer: `Eₚ = mgh = ${mass}·10·${height} = ${energy} Дж.` };
    }
    if (/теплот|удельн.*тепло|парообразован|плавлени|кристаллизац/.test(t)) {
      const mass = 2 + (index % 8), capacity = 4200, delta = 5 + (index % 16), heat = mass * capacity * delta;
      return { prompt: `Нагревают ${mass} кг воды (c = 4200 Дж/(кг·°C)) на ${delta}°C. Найди количество теплоты.`, answer: `Q = cmΔt = 4200·${mass}·${delta} = ${heat.toLocaleString("ru-RU")} Дж.` };
    }
    if (/электрическ.*мощност|мощност.*электрическ|работа электрическ.*ток|джоуля/.test(t)) {
      const voltage = 6 + (index % 5) * 3, current = 2 + (index % 4), time = 5 + (index % 8), power = voltage * current;
      return { prompt: `При напряжении ${voltage} В через прибор идёт ток ${current} А в течение ${time} с. Найди мощность прибора и работу тока.`, answer: `P = UI = ${voltage}·${current} = ${power} Вт; A = Pt = ${power}·${time} = ${power * time} Дж.` };
    }
    if (/ньютон|равнодейств|второй закон/.test(t)) {
      const mass = 2 + (index % 8), acceleration = 2 + ((index * 2) % 7);
      return { prompt: `На тело массой ${mass} кг действует постоянная сила, сообщающая ускорение ${acceleration} м/с². Найди равнодействующую силу.`, answer: `По второму закону Ньютона F = m · a = ${mass} · ${acceleration} = ${mass * acceleration} Н.` };
    }
    if (/закон ом|сопротивлен|напряжен|электрическ.*ток|сила тока/.test(t)) {
      const r = 2 + (index % 7), i = 2 + ((index * 3) % 6), u = r * i;
      return { prompt: `По закону Ома для участка цепи сопротивление равно ${r} Ом, сила тока — ${i} А. Найди напряжение и запиши формулу.`, answer: `U = I · R = ${i} · ${r} = ${u} В.` };
    }
    if (/давлен/.test(t)) {
      const area = 2 + (index % 7), pressure = 100 + (index % 8) * 50, force = area * pressure;
      return { prompt: `Сила ${force} Н равномерно распределена по площади ${area} м². Найди давление на поверхность.`, answer: `p = F / S = ${force} / ${area} = ${pressure} Па.` };
    }
    if (/мощност|механическ.*работ|работа силы/.test(t)) {
      const force = 10 + (index % 8) * 5, distance = 2 + (index % 6), time = 2 + (index % 5);
      return { prompt: `Сила ${force} Н переместила тело на ${distance} м за ${time} с по направлению движения. Найди работу и среднюю мощность.`, answer: `A = F · s = ${force * distance} Дж; N = A / t = ${force * distance} / ${time} = ${(force * distance / time).toLocaleString("ru-RU")} Вт.` };
    }
    if (/скорост|путь|движен|временн/.test(t)) {
      const v = 3 + (index % 9), time = 2 + (index % 5);
      return { prompt: `Тело движется равномерно со скоростью ${v} м/с в течение ${time} с. Найди путь и укажи используемую формулу.`, answer: `s = v · t = ${v} · ${time} = ${v * time} м.` };
    }
    if (/плотност/.test(t)) {
      const volume = 2 + (index % 8), density = 2 + ((index * 2) % 7);
      return { prompt: `Тело имеет массу ${volume * density} г и объём ${volume} см³. Найди плотность вещества.`, answer: `ρ = m / V = ${volume * density} / ${volume} = ${density} г/см³.` };
    }
  }

  if (subject === "Химия") {
    if (/массов.*дол.*раствор|раствор.*массов.*дол/.test(t)) {
      const solute = 10 + (index % 5) * 5, solvent = 90 + (index % 4) * 10, total = solute + solvent;
      return { prompt: `В ${solvent} г воды растворили ${solute} г соли. Найди массовую долю соли в растворе в процентах.`, answer: `m(раствора) = ${total} г; ω = ${solute}/${total}·100% ≈ ${(solute / total * 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })}%.` };
    }
    if (/количеств.*веществ|моль|авогадро/.test(t)) {
      const amount = 1 + (index % 5);
      return { prompt: `Сколько структурных частиц содержится в ${amount} моль вещества? Используй Nₐ = 6,02·10²³ моль⁻¹.`, answer: `N = nNₐ = ${amount}·6,02·10²³ = ${amount === 1 ? "6,02" : (6.02 * amount).toFixed(2).replace(".", ",")}·10²³ частиц.` };
    }
    if (/выход.*продукт|расчёт.*уравнен|расчет.*уравнен/.test(t)) {
      const theoretical = 20 + (index % 8) * 5, percent = 60 + (index % 5) * 5, actual = theoretical * percent / 100;
      return { prompt: `По уравнению реакции теоретически можно получить ${theoretical} г продукта. Практический выход составляет ${percent}%. Найди массу реально полученного продукта.`, answer: `m(практ.) = m(теор.)·η/100% = ${theoretical}·${percent}/100 = ${actual} г.` };
    }
    if (/атом|протон|электрон|заряд/.test(t)) {
      const z = 6 + (index % 12);
      return { prompt: `У нейтрального атома порядковый номер ${z}. Сколько в ядре протонов и сколько электронов в атоме?`, answer: `Протонов ${z}; в нейтральном атоме электронов тоже ${z}. Число нейтронов без массового числа определить нельзя.` };
    }
    if (/кислот|основан|индикатор/.test(t)) {
      const tasks = [
        { prompt: "Лакмус в растворе стал красным. Какую среду это указывает и какие меры безопасности нужны при работе с растворами?", answer: "Красный лакмус указывает на кислую среду. Нельзя пробовать вещества; нужно соблюдать инструкцию и использовать защитные очки." },
        { prompt: "Сравни кислую и щелочную среду по изменению цвета универсального индикатора. Не смешивай неизвестные вещества.", answer: "Кислая среда даёт оттенки от красного до жёлтого, нейтральная — зелёный, щелочная — от синего до фиолетового." },
      ];
      return choose(tasks, index);
    }
    if (/реакци|уравнен|сохранени.*масс/.test(t)) {
      const tasks = [
        { prompt: "Расставь коэффициенты: H₂ + O₂ → H₂O. Проверь число атомов каждого элемента слева и справа.", answer: "2H₂ + O₂ → 2H₂O. Слева и справа по 4 атома H и 2 атома O." },
        { prompt: "Расставь коэффициенты: N₂ + H₂ → NH₃. Проверь число атомов до и после реакции.", answer: "N₂ + 3H₂ → 2NH₃. Слева и справа по 2 атома N и 6 атомов H." },
      ];
      return choose(tasks, index);
    }
    if (/периодическ|химическ.*элемент|порядков.*номер/.test(t)) {
      const elements = [["углерода", 6, "C"], ["кислорода", 8, "O"], ["натрия", 11, "Na"], ["магния", 12, "Mg"], ["хлора", 17, "Cl"], ["кальция", 20, "Ca"]] as const;
      const [name, z, symbol] = choose([...elements], index);
      return { prompt: `Используя периодическую таблицу, определи порядковый номер элемента ${name}. Сколько протонов в ядре его атома?`, answer: `${symbol}: порядковый номер ${z}; в ядре ${z} протонов.` };
    }
    if (/формул.*веществ|молекул|индекс.*формул/.test(t)) {
      const compounds = [["H₂O", "два атома водорода и один атом кислорода"], ["CO₂", "один атом углерода и два атома кислорода"], ["NH₃", "один атом азота и три атома водорода"], ["CH₄", "один атом углерода и четыре атома водорода"]] as const;
      const [formula, composition] = choose([...compounds], index);
      return { prompt: `Прочитай формулу ${formula}: назови элементы и число атомов каждого элемента в одной молекуле.`, answer: `${formula}: ${composition}.` };
    }
  }

  if (subject === "Биология") {
    if (/моногибрид|законы мендел|генотип|фенотип|дигибрид|сцеплен.*пол/.test(t)) {
      const parent = index % 2 === 0 ? "Aa × Aa" : "AA × aa";
      const answer = parent === "Aa × Aa"
        ? "Гаметы каждого родителя: A и a. Генотипы потомства: 1 AA : 2 Aa : 1 aa; при полном доминировании фенотипы: 3 с доминантным признаком : 1 с рецессивным."
        : "Гаметы: первый родитель передаёт A, второй — a. Всё потомство имеет генотип Aa и проявляет доминантный признак при полном доминировании.";
      return { prompt: `У гороха аллель A полностью доминирует над a. Скрести родителей ${parent}. Запиши возможные генотипы потомства и соотношение фенотипов.`, answer };
    }
    if (/клетк|органоид/.test(t)) {
      const pairs = [
        ["ядро", "хранит наследственную информацию и управляет работой клетки"],
        ["мембрана", "отделяет клетку и регулирует обмен веществ с окружающей средой"],
        ["митохондрия", "участвует в клеточном дыхании и получении энергии"],
        ["хлоропласт", "в клетках растений участвует в фотосинтезе"],
      ];
      const [name, role] = choose(pairs, index);
      return { prompt: `Назови органоид клетки, который ${role}. Затем укажи, в каких клетках он встречается.`, answer: `${name[0].toLocaleUpperCase("ru-RU")}${name.slice(1)} — ${role}.` };
    }
    if (/фотосинтез/.test(t)) return { prompt: "Запиши словами, какие вещества нужны для фотосинтеза и какие продукты образуются. Укажи роль света.", answer: "Углекислый газ и вода при участии световой энергии образуют органические вещества (например, глюкозу) и кислород." };
    if (/экосистем|цеп.*питан|пищев/.test(t)) {
      const chains = [
        ["трава → кузнечик → лягушка → уж", "трава — производитель; остальные звенья — потребители разных порядков"],
        ["водоросли → дафния → мелкая рыба → щука", "водоросли — производитель; далее идут потребители"],
        ["семена → мышь → сова", "семена — источник органического вещества для мыши; сова получает его через добычу"],
      ];
      const [chain, key] = choose(chains, index);
      return { prompt: `Разбери цепь питания «${chain}»: определи производителя и объясни направление передачи вещества и энергии.`, answer: key };
    }
    if (/кров|кровообращ|сердц/.test(t)) {
      const tasks = [
        { prompt: "Сравни артерии и вены по направлению движения крови относительно сердца. Укажи одно исключение, связанное с малым кругом кровообращения.", answer: "Артерии несут кровь от сердца, вены — к сердцу. В малом круге артерии несут венозную кровь, а вены — артериальную." },
        { prompt: "Объясни путь крови от правого желудочка сердца к левому предсердию. Назови сосуды и место газообмена.", answer: "Правый желудочек → лёгочный ствол и лёгочные артерии → капилляры лёгких (газообмен) → лёгочные вены → левое предсердие." },
      ];
      return choose(tasks, index);
    }
    if (/пищевар/.test(t)) {
      const stages = [["рот", "измельчение пищи и начало расщепления крахмала слюнной амилазой"], ["желудок", "перемешивание пищи и начало переваривания белков в кислой среде"], ["тонкая кишка", "основное завершение переваривания и всасывание питательных веществ"]] as const;
      const [organ, role] = choose([...stages], index);
      return { prompt: `Назови отдел пищеварительной системы по описанию: ${role}.`, answer: `${organ[0].toLocaleUpperCase("ru-RU")}${organ.slice(1)}: ${role}.` };
    }
  }

  if (subject === "География") {
    if (/масштаб/.test(t)) {
      const cm = 2 + (index % 7), scale = choose([100_000, 200_000, 500_000], index);
      const km = cm * scale / 100_000;
      return { prompt: `На карте масштаба 1:${scale.toLocaleString("ru-RU")} расстояние между объектами ${cm} см. Найди расстояние на местности в километрах.`, answer: `${cm} · ${scale.toLocaleString("ru-RU")} см = ${km.toLocaleString("ru-RU")} см = ${km} км.` };
    }
    if (/ориентирован.*местност|сторон.*горизонт|азимут/.test(t)) {
      const azimuth = [0, 45, 90, 135, 180, 225, 270, 315][index % 8];
      const direction = ["север", "северо-восток", "восток", "юго-восток", "юг", "юго-запад", "запад", "северо-запад"][index % 8];
      return { prompt: `Компас показывает азимут ${azimuth}°. В каком направлении от наблюдателя расположен объект?`, answer: `Азимут отсчитывается по часовой стрелке от севера: ${azimuth}° — ${direction}.` };
    }
    if (/часов.*пояс|часов.*разниц|времен.*пояс/.test(t)) {
      return { prompt: "В пункте А 12:00, а пункт Б расположен на 3 часовых пояса восточнее. Определи местное время в пункте Б и объясни ход решения.", answer: "В пункте Б 15:00: при перемещении к востоку местное время увеличивается." };
    }
    if (/материк|океан/.test(t)) {
      const pairs = [["Африка", "экватор пересекает материк почти посередине"], ["Южная Америка", "в западной части материка протянулись Анды"], ["Евразия", "это самый большой материк Земли"]];
      const [name, clue] = choose(pairs, index);
      return { prompt: `Определи материк по признаку: ${clue}. Назови ещё один объект, который можно показать на его карте.`, answer: `${name}. Второй объект выбери по карте и подпиши его местоположение.` };
    }
    if (/климат|природн зон|теплов.*пояс/.test(t)) {
      const zones = [["экваториальный", "высокие температуры и обильные осадки в течение всего года"], ["тропический", "высокие температуры; во многих районах осадков мало"], ["умеренный", "выраженная сезонная смена температур и времён года"], ["полярный", "низкие температуры большую часть года"]] as const;
      const [zone, feature] = choose([...zones], index);
      return { prompt: `Назови климатический пояс по признаку: ${feature}. Объясни, как географическая широта влияет на поступление солнечной энергии.`, answer: `${zone[0].toLocaleUpperCase("ru-RU")}${zone.slice(1)} пояс. Чем выше широта, тем ниже угол падения солнечных лучей и в среднем меньше поступающая энергия.` };
    }
    if (/координат|географическ.*широт|географическ.*долгот/.test(t)) {
      const latitude = 10 + (index % 7) * 10, longitude = 20 + (index % 8) * 10;
      return { prompt: `Точка имеет координаты ${latitude}° с. ш. и ${longitude}° в. д. По глобусу или карте определи, в каком полушарии она находится относительно экватора и нулевого меридиана.`, answer: `Точка находится в Северном и Восточном полушариях.` };
    }
  }

  if (subject === "Русский язык") {
    if (/тся|ться|глагол/.test(t)) {
      const forms = [["учится", "что делает? — учится"], ["учиться", "что делать? — учиться"], ["вернётся", "что сделает? — вернётся"], ["стараться", "что делать? — стараться"]];
      const [word, check] = choose(forms, index);
      return { prompt: `Вставь -тся или -ться: «Он хочет учи… хорошо». Затем проверь окончание вопросом к глаголу.`, answer: `«Он хочет учиться хорошо». Вопрос: хочет (что делать?) учиться, поэтому пишется -ться. Пример формы ${word}: ${check}.` };
    }
    if (/причастн|оборот/.test(t)) {
      const variants = [
        { prompt: "Расставь знаки препинания: «Дом построенный у реки был виден издалека». Найди причастный оборот.", answer: "Дом, построенный у реки, был виден издалека. Оборот стоит после определяемого слова «дом» и выделяется запятыми." },
        { prompt: "Расставь знаки препинания: «Уставшие после дороги туристы быстро уснули». Объясни, почему запятая нужна или не нужна.", answer: "Запятая не нужна: одиночное определение с зависимыми словами стоит перед определяемым существительным." },
      ];
      return choose(variants, index);
    }
    if (/приставк|безударн.*глас|орфограф/.test(t)) {
      const words = [["безвкусный", "без вкуса — приставка без- пишется с з перед звонким в"], ["расписать", "перед глухим п пишется приставка рас-"], ["бескрайний", "перед глухим к пишется приставка бес-"]];
      const [word, reason] = choose(words, index);
      return { prompt: `Объясни написание слова «${word}»: выдели приставку и назови правило.`, answer: reason };
    }
    if (/падеж/.test(t)) {
      const examples = [["подошёл к школе", "дательный", "к чему? — к школе"], ["любуюсь морем", "творительный", "любуюсь чем? — морем"], ["нет тетради", "родительный", "нет чего? — тетради"], ["вижу площадь", "винительный", "вижу что? — площадь"]] as const;
      const [phrase, caseName, question] = choose([...examples], index);
      return { prompt: `Определи падеж существительного в сочетании «${phrase}». Подбери вопрос от главного слова.`, answer: `${caseName} падеж: ${question}.` };
    }
    if (/однородн|запят|обращен/.test(t)) {
      const variants = [
        { prompt: "Расставь знаки препинания: «На столе лежали тетради книги и карандаши». Объясни постановку запятых.", answer: "На столе лежали тетради, книги и карандаши. Запятая ставится между однородными членами без одиночного союза и." },
        { prompt: "Расставь знаки препинания: «Ребята откройте учебники». Назови обращение.", answer: "Ребята, откройте учебники. «Ребята» — обращение, оно отделяется запятой." },
      ];
      return choose(variants, index);
    }
  }

  if (subject === "Информатика" && /алгоритм|услови|ветвлен|если/.test(t)) {
    const x = 2 + (index % 9), limit = 5 + (index % 8), result = x < limit ? x * 2 : x + 3;
    return { prompt: `Выполни алгоритм при x = ${x}: если x < ${limit}, то x := 2·x, иначе x := x+3. Какое значение получится?`, answer: `${x} ${x < limit ? "меньше" : "не меньше"} ${limit}, поэтому выполняется ветвь «${x < limit ? `2·${x}` : `${x}+3`}». Результат: ${result}.` };
  }
  if (subject === "Информатика" && /двоичн|перевод.*систем счислен|систем.*счислен/.test(t)) {
    const value = 5 + (index % 27), binary = value.toString(2);
    return { prompt: `Переведи число ${value} из десятичной системы счисления в двоичную. Покажи разложение по степеням двойки.`, answer: `${value}₁₀ = ${binary}₂. Проверка: ${binary.split("").reverse().map((bit, power) => bit === "1" ? `2^${power}` : "").filter(Boolean).join(" + ")} = ${value}.` };
  }
  if (subject === "Информатика" && /цикл|повторен/.test(t)) {
    const end = 3 + (index % 7), sum = end * (end + 1) / 2;
    return { prompt: `Цикл прибавляет к переменной s числа от 1 до ${end} включительно, начиная с s = 0. Какое значение будет в s после завершения?`, answer: `s = 1 + 2 + … + ${end} = ${sum}.` };
  }

  if (subject === "Иностранный язык" && /past simple|прошедш|past/.test(t)) {
    const examples = [
      ["go", "went", "to school", "ходил(а) в школу"],
      ["see", "saw", "a film", "посмотрел(а) фильм"],
      ["play", "played", "football", "играл(а) в футбол"],
      ["study", "studied", "English", "занимался(ась) английским"],
      ["have", "had", "breakfast", "позавтракал(а)"],
    ];
    const [verb, past, phrase, translation] = choose(examples, index);
    return { prompt: `Поставь глагол в Past Simple: “Yesterday I ___ (${verb}) ${phrase}.” Затем переведи предложение.`, answer: `“Yesterday I ${past} ${phrase}.” — «Вчера я ${translation}».` };
  }
  if (subject === "Иностранный язык" && /present simple|настоящее простое|do и does/.test(t)) {
    const examples = [["she", "read", "reads"], ["he", "watch", "watches"], ["they", "play", "play"], ["Anna", "study", "studies"], ["we", "go", "go"]] as const;
    const [person, verb, form] = choose([...examples], index);
    return { prompt: `Поставь глагол в Present Simple: “${person} ___ (${verb}) English every day.” Объясни выбор формы.`, answer: `“${person} ${form} English every day.” Для he/she/it к глаголу обычно добавляется -s/-es; в остальных случаях используется базовая форма.` };
  }

  if (subject === "Обществознание" && /инфляц|покупательск/.test(t)) {
    const amount = 1_000 + (index % 5) * 500, inflation = 10 + (index % 4) * 5;
    const equivalent = amount / (1 + inflation / 100);
    return {
      prompt: `Доход не изменился и составляет ${amount.toLocaleString("ru-RU")} ₽. Если цены выросли на ${inflation}%, какую сумму нужно иметь теперь, чтобы купить тот же набор товаров? Округли до копеек.`,
      answer: `Новая сумма = ${amount.toLocaleString("ru-RU")} · (1 + ${inflation}/100) = ${(amount * (1 + inflation / 100)).toLocaleString("ru-RU")} ₽. Прежний доход теперь покрывает около ${equivalent.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽ прежней покупательной способности.`,
    };
  }
  if (subject === "Обществознание" && /вклад|сложн.*процент/.test(t)) {
    const principal = 10_000 + (index % 5) * 2_000, rate = 5 + (index % 3) * 5, years = 2;
    const total = principal * (1 + rate / 100) ** years;
    return {
      prompt: `В учебной модели вклад ${principal.toLocaleString("ru-RU")} ₽ приносит ${rate}% годовых с ежегодной капитализацией. Пополнений и снятий нет. Сколько будет на счёте через ${years} года?`,
      answer: `S = ${principal.toLocaleString("ru-RU")} · (1 + ${rate}/100)^${years} = ${total.toLocaleString("ru-RU")} ₽. Каждый год проценты начисляются на сумму вклада вместе с уже начисленными процентами.`,
    };
  }
  if (subject === "Обществознание" && /полная стоимость/.test(t)) {
    const principal = 10_000 + (index % 5) * 5_000, rate = 5 + (index % 4) * 5;
    const fee = 300 + (index % 3) * 100, insurance = 500 + (index % 4) * 100;
    const interest = principal * rate / 100, additionalCosts = interest + fee + insurance;
    return {
      prompt: `В учебном примере заём ${principal.toLocaleString("ru-RU")} ₽ выдан на один год под простой процент ${rate}% годовых. Отдельно указаны комиссия ${fee} ₽ и страхование ${insurance} ₽. Найди все дополнительные расходы и сумму платежей вместе с основным долгом. Это учебный расчёт, не установленный законом показатель ПСК.`,
      answer: `Проценты = ${principal.toLocaleString("ru-RU")} · ${rate}/100 = ${interest.toLocaleString("ru-RU")} ₽. Дополнительные расходы = ${interest.toLocaleString("ru-RU")} + ${fee} + ${insurance} = ${additionalCosts.toLocaleString("ru-RU")} ₽. Все платежи с возвратом долга: ${principal.toLocaleString("ru-RU")} + ${additionalCosts.toLocaleString("ru-RU")} = ${(principal + additionalCosts).toLocaleString("ru-RU")} ₽.`,
    };
  }
  if (subject === "Обществознание" && /за[её]м|кредит/.test(t)) {
    const principal = 10_000 + (index % 5) * 5_000, rate = 5 + (index % 4) * 5, years = 2;
    const interest = principal * rate / 100 * years;
    return {
      prompt: `В учебной задаче ${principal.toLocaleString("ru-RU")} ₽ выданы на ${years} года под простой процент ${rate}% годовых без комиссий. Рассчитай проценты и итоговую сумму возврата.`,
      answer: `Проценты = ${principal.toLocaleString("ru-RU")} · ${rate}/100 · ${years} = ${interest.toLocaleString("ru-RU")} ₽. Всего к возврату: ${principal.toLocaleString("ru-RU")} + ${interest.toLocaleString("ru-RU")} = ${(principal + interest).toLocaleString("ru-RU")} ₽. Это упрощённая модель простых процентов, а не расчёт условий реального кредита.`,
    };
  }
  if (subject === "Обществознание" && /эластичност.*спрос|спрос.*эластичност/.test(t)) {
    const priceChange = 10 + (index % 5) * 5, quantityChange = priceChange * (2 + Math.floor(index / 5));
    const coefficient = quantityChange / priceChange;
    return {
      prompt: `В учебной модели цена товара выросла на ${priceChange}%, а величина спроса снизилась на ${quantityChange}% относительно исходного периода. Найди модуль ценовой эластичности спроса и определи, эластичен ли спрос.`,
      answer: `|E| = |−${quantityChange}% / ${priceChange}%| = ${coefficient}. Так как |E| > 1, спрос эластичный. Расчёт использует указанные в условии процентные изменения относительно исходных значений.`,
    };
  }
  if (subject === "Обществознание" && /валовой внутренний продукт|\bввп\b/.test(t)) {
    const consumption = 100 + (index % 5) * 20, investment = 20 + (index % 4) * 10;
    const government = 30 + (index % 3) * 10, exports = 40 + (index % 4) * 10, imports = 30 + (index % 5) * 10;
    const gdp = consumption + investment + government + exports - imports;
    return {
      prompt: `В условной экономике за год потребление составило ${consumption}, инвестиции — ${investment}, государственные расходы — ${government}, экспорт — ${exports}, импорт — ${imports} млрд ₽. Найди ВВП по расходному подходу.`,
      answer: `ВВП = C + I + G + (X − M) = ${consumption} + ${investment} + ${government} + (${exports} − ${imports}) = ${gdp} млрд ₽.`,
    };
  }
  if (subject === "Обществознание" && /бюджет|скидк|личный финансовый план|финансов.*грамотност/.test(t)) {
    const income = 10_000 + (index % 5) * 2_000, percent = 10 + (index % 4) * 5;
    return { prompt: `Семья откладывает ${percent}% месячного дохода ${income.toLocaleString("ru-RU")} ₽. Сколько рублей будет отложено? Объясни расчёт.`, answer: `${income.toLocaleString("ru-RU")} · ${percent}/100 = ${(income * percent / 100).toLocaleString("ru-RU")} ₽.` };
  }
  if (subject === "Обществознание" && /спрос|предложен|рынок/.test(t)) {
    const cases = [
      { prompt: "Покупатели стали чаще выбирать один товар, а предложение не изменилось. Как при прочих равных может измениться равновесная цена? Объясни цепочку.", answer: "Спрос растёт при прежнем предложении; равновесная цена обычно повышается, пока рынок приспосабливается." },
      { prompt: "Производители сократили предложение товара, а спрос не изменился. Как при прочих равных может измениться равновесная цена?", answer: "Предложение уменьшается при прежнем спросе; равновесная цена обычно повышается." },
      { prompt: "Назови пример неценового фактора, который может увеличить спрос, и объясни, как он действует.", answer: "Например, рост доходов может увеличить спрос на нормальный товар; конкретный эффект зависит от вида товара и ситуации." },
    ];
    return choose(cases, index);
  }

  // Source-based exercises vary by item and avoid making up event/book facts.
  if (subject === "История") {
    const tasks = [
      { prompt: `По теме «${topic}» составь таблицу «причина — событие — последствие». Подкрепи каждую строку датой или сведением из учебника.`, answer: "Ключ проверки: причина предшествует событию; последствие связано с ним; даты и факты подтверждаются учебным источником." },
      { prompt: `Составь краткую хронологию по теме «${topic}»: выбери три события, расставь их по времени и объясни одну связь между соседними пунктами.`, answer: "Ключ проверки: даты расположены в правильном порядке; связь между событиями объяснена, а не только перечислена." },
      { prompt: `Найди по теме «${topic}» два свидетельства из учебного текста или документа. Что каждый источник позволяет узнать и чего по нему нельзя утверждать?`, answer: "Ключ проверки: цитаты или данные действительно присутствуют в источниках; выводы не выходят за пределы того, что источник подтверждает." },
      { prompt: `Подготовь карточку по теме «${topic}»: историческое понятие, объяснение своими словами и пример из конкретного периода.`, answer: "Ключ проверки: определение соответствует учебному смыслу; пример относится к нужному времени и подтверждается источником." },
      { prompt: `Выбери карту или схему, связанную с темой «${topic}». Отметь на ней ключевой объект и объясни, какую историческую информацию даёт его расположение.`, answer: "Ключ проверки: объект отмечен верно; объяснение опирается на карту и не подменяет пространственный факт догадкой." },
    ];
    return choose(tasks, index);
  }
  if (subject === "Литература") {
    const tasks = [
      { prompt: `По теме «${topic}» сформулируй тезис о произведении или герое и подбери два эпизода, которые его подтверждают. Не придумывай цитаты: укажи главы или сцены для проверки по тексту.`, answer: "Ключ проверки: тезис отвечает на вопрос темы; оба эпизода действительно есть в произведении; после каждого объяснена связь с тезисом." },
      { prompt: `Опиши героя по теме «${topic}» через его поступок, слова и отношение к другим персонажам. Подкрепи вывод двумя эпизодами из текста.`, answer: "Ключ проверки: черты характера выводятся из поступков и речи; эпизоды реально присутствуют в произведении и поясняют вывод." },
      { prompt: `Сравни двух героев или эпизода по теме «${topic}»: назови одно сходство, одно различие и объясни, как сравнение помогает понять авторскую мысль.`, answer: "Ключ проверки: сравниваются сопоставимые герои или эпизоды; вывод подтверждается текстом, а не общими оценками." },
      { prompt: `Определи, кто рассказывает историю в произведении по теме «${topic}». Найди эпизод, где точка зрения рассказчика влияет на то, что читатель узнаёт.`, answer: "Ключ проверки: рассказчик не смешан с автором без оснований; вывод опирается на выбранный эпизод и особенности повествования." },
      { prompt: `Проанализируй название произведения или образ по теме «${topic}». Предложи два возможных смысла и проверь каждый по эпизоду из текста.`, answer: "Ключ проверки: оба толкования связаны с текстом; выбранные эпизоды действительно их подтверждают; цитаты не придуманы." },
    ];
    return choose(tasks, index);
  }

  const general: Record<string, SubjectExercise[]> = {
    "Физика": [
      { prompt: `Для темы «${topic}» выбери подходящий закон или физическую модель. Запиши известные величины, единицы измерения и покажи, как проверить ответ.`, answer: "Ключ проверки: величины записаны в согласованных единицах; выбранный закон применим к условию; итоговая единица соответствует искомой величине." },
      { prompt: `Придумай наблюдаемую ситуацию по теме «${topic}». Сформулируй гипотезу, укажи, что измерять, и назови один источник погрешности.`, answer: "Ключ проверки: гипотеза проверяема; указаны измеряемая величина и способ наблюдения; источник погрешности относится к выбранному измерению." },
    ],
    "Химия": [
      { prompt: `Для темы «${topic}» составь схему: исходные вещества или частицы → процесс → наблюдаемый результат. Подпиши, какие сведения можно подтвердить формулой или уравнением.`, answer: "Ключ проверки: формулы и уравнения сверены по учебному материалу; наблюдение отделено от объяснения; уравнение сохраняет число атомов каждого элемента." },
      { prompt: `Сравни два вещества или процесса из темы «${topic}» по составу, свойствам и безопасному способу распознавания.`, answer: "Ключ проверки: сравнение основано на изученных свойствах; тест выбран безопасный; наблюдаемый признак не подменён предположением." },
    ],
    "Биология": [
      { prompt: `Построй схему по теме «${topic}»: объект → его части или условия → функция/результат. Подпиши связи и добавь один проверяемый пример.`, answer: "Ключ проверки: части и функции не перепутаны; стрелки подписаны причинной или функциональной связью; пример соответствует теме." },
      { prompt: `Сравни два объекта или процесса по теме «${topic}». Выбери три признака и объясни, почему один из них важен для организма или экосистемы.`, answer: "Ключ проверки: признаки можно проверить по учебному материалу; сходство и различия указаны отдельно; вывод опирается на сравнение." },
    ],
    "География": [
      { prompt: `Найди на карте объект, связанный с темой «${topic}». Укажи его положение относительно сторон света и объясни одну связь с природными условиями или деятельностью людей.`, answer: "Ключ проверки: объект правильно найден и подписан; направление указано относительно карты; объяснение подтверждается картой или данными." },
      { prompt: `Сравни две территории по теме «${topic}» по карте и данным. Запиши один общий признак, одно различие и возможную причину различия.`, answer: "Ключ проверки: использованы сопоставимые признаки; различие подтверждается данными; причина отделена от установленного факта." },
    ],
    "Русский язык": [
      { prompt: `Составь три примера по теме «${topic}». В каждом подчеркни изучаемое явление и кратко объясни, как распознал его.`, answer: "Ключ проверки: каждый пример действительно содержит изучаемое явление; объяснение называет правило или диагностический признак." },
      { prompt: `Составь пошаговый алгоритм для темы «${topic}» и проверь его на двух собственных примерах, включая один пограничный случай.`, answer: "Ключ проверки: шаги идут в правильном порядке; алгоритм работает на обоих примерах; пограничный случай разобран отдельно." },
    ],
    "Обществознание": [
      { prompt: `Разбери жизненную ситуацию по теме «${topic}»: назови участников, их интересы, подходящее понятие курса и обоснованное решение.`, answer: "Ключ проверки: понятие употреблено по смыслу; интересы сторон названы; решение следует из условия и объяснено." },
      { prompt: `Оцени утверждение по теме «${topic}»: приведи аргумент за и против, затем сформулируй вывод с примером.`, answer: "Ключ проверки: аргументы относятся к утверждению; пример конкретен; вывод учитывает обе стороны." },
    ],
    "Информатика": [
      { prompt: `Опиши алгоритм решения задачи по теме «${topic}»: входные данные, шаги, результат и один крайний случай.`, answer: "Ключ проверки: вход и выход определены; шаги однозначны и конечны; крайний случай обработан." },
      { prompt: `Придумай тест для алгоритма по теме «${topic}». Запиши входные данные, ожидаемый результат и объясни, какую ошибку этот тест обнаружит.`, answer: "Ключ проверки: ожидаемый результат следует из условия; тест проверяет отдельный важный случай; возможная ошибка названа конкретно." },
    ],
    "Иностранный язык": [
      { prompt: `Составь короткий диалог на иностранном языке по теме «${topic}» из 6 реплик. Используй изученные слова и выдели два выражения для повторения.`, answer: "Ключ проверки: диалог содержит 6 реплик; реплики связаны по смыслу; выбранные слова и грамматика соответствуют теме урока." },
      { prompt: `Напиши 4–5 предложений на иностранном языке по теме «${topic}». Используй изученную конструкцию и после текста объясни её применение.`, answer: "Ключ проверки: текст отвечает теме; целевая конструкция употреблена корректно; объяснение показывает её функцию." },
    ],
  };
  const set = general[subject] ?? [
    { prompt: `Составь объяснение по теме «${topic}»: сформулируй ключевую мысль, приведи два проверяемых примера и сделай вывод.`, answer: "Ключ проверки: мысль сформулирована ясно; примеры подтверждают её; вывод следует из примеров." },
    { prompt: `Подготовь мини-исследование по теме «${topic}»: вопрос, гипотеза, план проверки и ожидаемые наблюдения.`, answer: "Ключ проверки: вопрос можно исследовать; гипотеза проверяема; план позволяет сопоставить результат с гипотезой." },
  ];
  const exercise = choose(set, index);
  return basic ? { ...exercise, prompt: exercise.prompt.replace("Сравни", "Рассмотри").replace("мини-исследование", "небольшое исследование") }
    : advanced ? { ...exercise, prompt: `${exercise.prompt} Обоснуй вывод и укажи ограничение выбранного способа.` }
      : exercise;
}
