import { useEffect, useState } from "react";
import {
  clearAiDrafts,
  generateLocalAiDraft,
  getAiUsage,
  listAiDrafts,
  queueAiDraftForBoard,
  recordLocalAiGeneration,
  type AiDifficulty,
  type AiDraft,
  type AiTool,
} from "./aiLocalStore";
import { aiTopicPlaceholder, parseCurriculumRequest } from "./aiCurriculumGenerator";
import { loadCurriculumSubjectModel } from "./aiSubjectIntentClassifier";
import { LEKTRUS_SCHOOL_SUBJECTS } from "./lektrusSchoolSubjects";
import "./AiStudioScreen.css";

export default function AiStudioScreen({ onBack }: { onBack: () => void }) {
  const [tool, setTool] = useState<AiTool>("assignment");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState<AiDifficulty>("medium");
  const [count, setCount] = useState(5);
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [history, setHistory] = useState<AiDraft[]>(() => listAiDrafts());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState(() => getAiUsage());
  const [transferNotice, setTransferNotice] = useState("");
  const [, setSubjectModelReady] = useState(false);
  const parsedRequest = parseCurriculumRequest(topic, subject, count, difficulty, tool);

  useEffect(() => {
    let active = true;
    void loadCurriculumSubjectModel().then(() => {
      if (active) setSubjectModelReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const sync = () => setHistory(listAiDrafts());
    const usageSync = () => setUsage(getAiUsage());
    window.addEventListener("onlinerepetitor:ai-history", sync);
    window.addEventListener("onlinerepetitor:ai-usage", usageSync);
    return () => {
      window.removeEventListener("onlinerepetitor:ai-history", sync);
      window.removeEventListener("onlinerepetitor:ai-usage", usageSync);
    };
  }, []);

  const generate = async () => {
    setError("");
    setTransferNotice("");
    setBusy(true);
    try {
      await loadCurriculumSubjectModel();
      const request = parseCurriculumRequest(topic, subject, count, difficulty, tool);
      setTool(request.tool);
      setDifficulty(request.level);
      setCount(request.count);
      if (request.subject) setSubject(request.subject);
      setTopic(request.topic);
      const next = await generateLocalAiDraft(request.tool, topic, request.level, request.count, request.subject);
      recordLocalAiGeneration();
      setUsage(getAiUsage());
      setDraft(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать черновик");
    } finally {
      setBusy(false);
    }
  };

  const sendToBoard = () => {
    if (!draft) return;
    queueAiDraftForBoard(draft);
    setTransferNotice("Материал подготовлен. Откройте нужную доску, и он появится в её центре.");
    window.setTimeout(() => {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, 450);
  };

  return <main className="ai-studio">
    <header className="ai-head">
      <button onClick={onBack}>← Назад</button>
      <div>
        <h1>Помощник по заданиям</h1>
        <p>Готовит задания прямо в Lectrus. Генерация работает локально, без платных API-запросов.</p>
      </div>
      <span>На устройстве · без оплаты за запросы</span>
    </header>

    <section className="ai-layout">
      <div className="ai-compose">
        <div className="ai-tool-tabs">
          <button className={tool === "assignment" ? "active" : ""} onClick={() => setTool("assignment")}>Задание</button>
          <button className={tool === "quiz" ? "active" : ""} onClick={() => setTool("quiz")}>Тест</button>
          <button className={tool === "flashcards" ? "active" : ""} onClick={() => setTool("flashcards")}>Карточки</button>
        </div>
        <label><span>Предмет</span>
          <select value={subject} onChange={e => setSubject(e.target.value)}>
            <option value="">Определить по теме</option>
            {LEKTRUS_SCHOOL_SUBJECTS.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label><span>Тема или запрос</span><input value={topic} onChange={e => setTopic(e.target.value)} placeholder={aiTopicPlaceholder(subject)} />
          {topic.trim() && <small className="ai-request-reading">Распознано: {parsedRequest.subject || "выберите предмет"}{parsedRequest.topic ? ` · ${parsedRequest.topic}` : ""} · {parsedRequest.count} · {parsedRequest.tool === "quiz" ? "тест" : parsedRequest.tool === "flashcards" ? "карточки" : "задание"} · {parsedRequest.level === "easy" ? "базовый" : parsedRequest.level === "hard" ? "углублённый" : "средний"}{parsedRequest.grade ? ` · ${parsedRequest.grade} класс` : ""}</small>}
        </label>
        <div className="ai-options">
          <label><span>Уровень</span><select value={difficulty} onChange={e => setDifficulty(e.target.value as AiDifficulty)}>
            <option value="easy">Базовый</option><option value="medium">Средний</option><option value="hard">Углублённый</option>
          </select></label>
          <label><span>Количество</span><select value={count} onChange={e => setCount(Number(e.target.value))}>
            {[3, 5, 7, 10].map(value => <option key={value} value={value}>{value}</option>)}
          </select></label>
        </div>
        {error && <div className="ai-error">{error}</div>}
        <button className="ai-generate" disabled={busy || topic.trim().length < 2} onClick={() => void generate()}>
          {busy ? "Создаём…" : "Создать черновик"}
        </button>
        <small className="ai-local-note">Создано в этом месяце: {usage.used}. Это счётчик, он не ограничивает генерацию.</small>
      </div>

      <div className="ai-result">
        {draft ? <>
          <div className="ai-result-head">
            <div><small>Черновик · {draft.subject}</small><h2>{draft.title}</h2></div>
            <div className="ai-result-actions">
              <button onClick={() => void navigator.clipboard.writeText(`${draft.title}\n\n${draft.body}`)}>Копировать</button>
              <button className="ai-board-queue" onClick={sendToBoard}>На доску</button>
            </div>
          </div>
          <textarea value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} />
          {Boolean(draft.answers?.length) && <details className="ai-answer-key">
            <summary>Ключ для преподавателя</summary>
            <ol>{draft.answers?.map((answer, i) => <li key={`${i}-${answer}`}>{answer}</li>)}</ol>
          </details>}
          <div className="ai-approval">Проверьте материал и при необходимости отредактируйте его перед выдачей.</div>
          {transferNotice && <div className="ai-transfer-notice">{transferNotice}</div>}
        </> : <div className="ai-empty">Здесь появится созданный материал.</div>}
      </div>
    </section>

    <section className="ai-history">
      <div><h2>Недавние черновики</h2>
        {history.length > 0 && <button onClick={() => { clearAiDrafts(); setDraft(null); }}>Очистить историю</button>}
      </div>
      {history.length === 0 ? <p>История пока пуста.</p> : history.slice(0, 6).map(item =>
        <button key={item.id} onClick={() => setDraft(item)}><b>{item.title}</b><span>{new Date(item.createdAt).toLocaleString("ru-RU")}</span></button>
      )}
    </section>
  </main>;
}
