import type { Item, Point } from "./boardModel";
import type { AiDraft } from "./aiLocalStore";

type MultipleChoiceQuestion = { question: string; options: string[]; correct: number };

export function measureAiChecklist(title: string, tasks: string[], fontSize = 15): { width: number; height: number } {
  const longest = Math.max(title.length, ...tasks.map(task => task.replace(/\s+/g, " ").length), 0);
  const width = Math.max(440, Math.min(620, 390 + Math.round(longest * fontSize * 0.16)));
  const charsPerLine = Math.max(24, Math.floor((width - 76) / (fontSize * 0.54)));
  const rowsHeight = tasks.reduce((height, task) => {
    const lines = Math.max(1, Math.ceil(task.replace(/\s+/g, " ").length / charsPerLine));
    return height + Math.max(fontSize * 1.75, lines * fontSize * 1.35 + 6);
  }, 0);
  return { width, height: Math.max(190, Math.ceil(rowsHeight + fontSize * 5.8)) };
}

function measureCards(cards: { front: string; back: string }[], fontSize = 17): { width: number; height: number } {
  const longest = Math.max(...cards.flatMap(card => [card.front.length, card.back.length]), 0);
  const width = Math.max(260, Math.min(390, 240 + Math.round(longest * fontSize * 0.12)));
  const charsPerLine = Math.max(22, Math.floor((width - 44) / (fontSize * 0.56)));
  const lines = cards.reduce((max, card) => Math.max(max,
    Math.max(1, Math.ceil(card.front.length / charsPerLine)) + Math.max(1, Math.ceil(card.back.length / charsPerLine))), 0);
  return { width, height: Math.max(200, Math.min(760, 88 + lines * fontSize * 1.45)) };
}

function numberedItems(body: string): string[] {
  const separatedBlocks = body.split(/\r?\n\s*\r?\n/).map(block => block.trim()).filter(Boolean);
  if (separatedBlocks.length > 1) {
    return separatedBlocks.map(block => block.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean).slice(0, 15);
  }
  const lines = body.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const hasNumberedLines = lines.some(value => /^\d+[.)]\s*/.test(value));
  const items: string[] = [];
  for (const line of lines) {
    if (/^\d+[.)]\s*/.test(line)) {
      items.push(line.replace(/^\d+[.)]\s*/, "").trim());
    } else if (/^Для \d+ класса:/i.test(line) && items.length) {
      items[items.length - 1] += `\n${line}`;
    } else if (!hasNumberedLines && items.length) {
      items.push(line);
    } else if (items.length) {
      items[items.length - 1] += `\n${line}`;
    } else {
      items.push(line);
    }
  }
  return items.filter(Boolean).slice(0, 15);
}

function parseMultipleChoice(body: string): MultipleChoiceQuestion[] | null {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of body.split(/\r?\n/).map(value => value.trim())) {
    if (!line) continue;
    if (/^\d+[.)]\s*/.test(line) && current.length) {
      blocks.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length) blocks.push(current);
  if (!blocks.length) return null;

  const questions: MultipleChoiceQuestion[] = [];
  for (const block of blocks) {
    const question = block[0].replace(/^\d+[.)]\s*/, "").trim();
    const options = block.flatMap(line => {
      const match = line.match(/^([A-DА-Г])[).]\s*(.+)$/i);
      return match ? [{ label: match[1].toUpperCase(), text: match[2].trim() }] : [];
    });
    const answerLine = block.find(line => /^(?:ответ|правильный ответ)\s*:/i.test(line));
    const answer = answerLine?.split(":").slice(1).join(":").trim().toUpperCase();
    const labels = options.map(option => option.label);
    const correct = answer ? labels.indexOf(answer) : -1;
    if (!question || options.length < 2 || correct < 0) return null;
    questions.push({ question, options: options.map(option => option.text), correct });
  }
  return questions;
}

export function createAiBoardItems(
  draft: AiDraft,
  center: Point,
  createId: () => string,
): Item[] {
  if (draft.tool === "flashcards") {
    const cards = draft.body.split(/\n\s*\n/).map(block => block.trim()).filter(Boolean).slice(0, 15).map(block => {
      const question = block.match(/Вопрос:\s*([\s\S]*?)(?=\nОтвет:|$)/i)?.[1]?.trim();
      const answer = block.match(/Ответ:\s*([\s\S]*)$/i)?.[1]?.trim();
      return { front: question || block, back: answer || "Ответ не указан" };
    });
    const size = measureCards(cards);
    const gap = 24;
    const columns = Math.min(3, cards.length);
    const rows = Math.ceil(cards.length / columns);
    const gridWidth = columns * size.width + Math.max(0, columns - 1) * gap;
    return cards.map((card, index) => ({
      id: createId(), kind: "flashcard", x: center.x - gridWidth / 2 + (index % columns) * (size.width + gap),
      y: center.y - (rows * size.height + (rows - 1) * gap) / 2 + Math.floor(index / columns) * (size.height + gap),
      width: size.width, height: size.height, text: card.front, flashcardBack: card.back,
      flashcardFlipped: false, fontSize: 17, color: "#5355c9",
    }));
  }

  if (draft.tool === "quiz") {
    const questions = parseMultipleChoice(draft.body);
    if (questions) {
      const selected = questions.slice(0, 15);
      const longest = Math.max(...selected.flatMap(question => [question.question.length, ...question.options.map(option => option.length)]), 0);
      const width = Math.max(420, Math.min(620, 380 + Math.round(longest * 0.12)));
      const charsPerLine = Math.max(26, Math.floor((width - 74) / 8));
      const tallestCard = Math.max(...selected.map(question => 170
        + Math.ceil(question.question.length / charsPerLine) * 24
        + question.options.reduce((optionsHeight, option) => optionsHeight + Math.max(38, Math.ceil(option.length / charsPerLine) * 22), 0)));
      const height = Math.max(310, Math.min(900, Math.ceil(tallestCard)));
      const columns = Math.min(2, selected.length);
      const rows = Math.ceil(selected.length / columns);
      const gap = 24;
      const gridWidth = columns * width + (columns - 1) * gap;
      return selected.map((question, index) => ({
      id: createId(), kind: "quiz", x: center.x - gridWidth / 2 + (index % columns) * (width + gap),
      y: center.y - (rows * height + (rows - 1) * gap) / 2 + Math.floor(index / columns) * (height + gap), width, height,
      text: question.question, quizOptions: question.options, quizCorrect: question.correct,
      quizRevealed: false, fontSize: 15, color: "#5355c9",
      }));
    }
  }

  const tasks = numberedItems(draft.body);
  if (!tasks.length) return [];
  const size = measureAiChecklist(draft.title, tasks);
  return [{
    id: createId(), kind: "checklist", x: center.x - size.width / 2, y: center.y - size.height / 2,
    ...size, text: draft.title, checklistItems: tasks,
    checklistDone: Array(tasks.length).fill(false), fontSize: 15, color: "#5355c9",
  }];
}
