import type { Item } from "./boardModel";

export type SubjectToolId =
  | "math-function" | "math-linear" | "math-sine"
  | "math-coordinate" | "math-trigonometry" | "math-geometry" | "math-quadrilateral";

export type SubjectToolDefinition = { id: SubjectToolId; label: string; description: string; subjects: string[] };

export const subjectToolRegistry: SubjectToolDefinition[] = [
  { id: "math-function", label: "Парабола", description: "Квадратичная функция: вершина, нули и изменение коэффициентов", subjects: ["математика", "алгебра"] },
  { id: "math-linear", label: "Прямая", description: "Линейная функция: наклон, пересечения с осями", subjects: ["математика", "алгебра"] },
  { id: "math-sine", label: "Синусоида", description: "Периодическая функция и её график", subjects: ["математика", "алгебра"] },
  { id: "math-coordinate", label: "Координатная плоскость", description: "Две оси, сетка и подписанные точки", subjects: ["математика", "алгебра", "геометрия"] },
  { id: "math-trigonometry", label: "Единичная окружность", description: "Настоящая окружность с радиусами и углом π/4", subjects: ["математика", "алгебра", "геометрия"] },
  { id: "math-geometry", label: "Треугольник", description: "Подвижные вершины, стороны и вычисляемый периметр", subjects: ["математика", "геометрия"] },
  { id: "math-quadrilateral", label: "Четырёхугольник", description: "Четыре вершины, стороны и вычисляемый периметр", subjects: ["математика", "геометрия"] },
];

export function subjectToolsFor(subject: string): SubjectToolDefinition[] {
  const key = subject.trim().toLocaleLowerCase("ru-RU");
  return subjectToolRegistry.filter(entry => entry.subjects.includes(key));
}

export function makeSubjectToolItem(id: SubjectToolId, x: number, y: number, createId: () => string): Item {
  const def = subjectToolRegistry.find(entry => entry.id === id);
  const common: Item = {
    id: createId(), kind: "graph", x: x - 260, y: y - 170, width: 520, height: 340,
    text: def?.label ?? "Учебный объект",
    graphPurpose: "function", graphAxisMode: "both",
    graphType: "quadratic", graphExpression: "", graphConnectPoints: false,
    graphA: 1, graphB: 0, graphC: 0,
    graphXMin: -10, graphXMax: 10, graphYMin: -6, graphYMax: 6,
    graphGrid: true, graphPoints: [], graphShowLabels: true, graphSnap: true,
    graphAxisLabels: true, graphGridStep: 1, graphShowCurve: false,
    graphProjections: false, graphSegments: [], graphAngles: [],
    graphCircles: [], graphPolygons: [], graphMidpoints: [], color: "#365fc8"
  };
  if (id === "math-function") return { ...common, graphShowCurve: true, graphExpression: "x^2 - 4*x + 3" };
  if (id === "math-linear") return { ...common, graphType: "linear", graphShowCurve: true, graphExpression: "2*x + 1", graphA: 2, graphB: 1 };
  if (id === "math-sine") return { ...common, graphType: "sin", graphShowCurve: true, graphExpression: "sin(x)", graphXMin: -7, graphXMax: 7, graphYMin: -2, graphYMax: 2 };
  if (id === "math-coordinate") return {
    ...common, graphPurpose: "coordinates",
    graphPoints: [{ x: 2, y: 3, label: "A" }, { x: -3, y: 1, label: "B" }]
  };
  if (id === "math-trigonometry") return {
    ...common, graphPurpose: "unit-circle", graphGridStep: .5,
    graphXMin: -2.7, graphXMax: 2.7, graphYMin: -1.6, graphYMax: 1.6,
    graphPoints: [
      { x: 0, y: 0, label: "O" },
      { x: 1, y: 0, label: "0" },
      { x: 0, y: 1, label: "π/2" },
      { x: -1, y: 0, label: "π" },
      { x: 0, y: -1, label: "3π/2" },
      { x: Math.SQRT1_2, y: Math.SQRT1_2, label: "π/4" }
    ],
    graphCircles: [{ center: 0, edge: 1, label: "r = 1", measure: true }],
    graphSegments: [
      { a: 0, b: 1, kind: "segment", label: "", measure: false },
      { a: 0, b: 5, kind: "segment", label: "", measure: false }
    ],
    graphAngles: [{ a: 1, vertex: 0, b: 5, label: "45°" }]
  };
  if (id === "math-geometry") return {
    ...common, graphPurpose: "geometry", graphXMin: -8, graphXMax: 8, graphYMin: -6, graphYMax: 6,
    graphPoints: [{ x: -4, y: -3, label: "A" }, { x: 4, y: -3, label: "B" }, { x: 0, y: 3, label: "C" }],
    graphPolygons: [{ points: [0, 1, 2], label: "ABC", measure: true }]
  };
  return {
    ...common, graphPurpose: "geometry", graphXMin: -8, graphXMax: 8, graphYMin: -6, graphYMax: 6,
    graphPoints: [
      { x: -4, y: -3, label: "A" }, { x: 4, y: -3, label: "B" },
      { x: 3, y: 3, label: "C" }, { x: -3, y: 3, label: "D" }
    ],
    graphPolygons: [{ points: [0, 1, 2, 3], label: "ABCD", measure: true }]
  };
}
