export type Skill = "line" | "rise" | "dive" | "wave";
export type Point = { x: number; y: number };
export const FLOOR = 348;
export const SKILLS = {
  line: {
    key: "1",
    formula: "y = x",
    name: "직선 대시",
    english: "LINE DASH",
    color: "#ff704e",
    distance: 260,
    duration: 0.4,
    hint: "앞을 가르고, 빠르게 관통",
  },
  rise: {
    key: "2",
    formula: "y = x²",
    name: "포물선 어퍼컷",
    english: "SKY UPPERCUT",
    color: "#9782ee",
    distance: 240,
    duration: 0.6,
    hint: "곡선을 타고, 하늘로 치솟기",
  },
  dive: {
    key: "3",
    formula: "y = −x²",
    name: "포물선 내려찍기",
    english: "POWER DIVE",
    color: "#efb636",
    distance: 120,
    duration: 0.34,
    hint: "공중에서 급제동 · 충격판과 바닥 파괴",
  },
  wave: {
    key: "4",
    formula: "y = sin x",
    name: "사인 웨이브",
    english: "WAVE FLOW",
    color: "#39ad94",
    distance: 450,
    duration: 1.05,
    hint: "물결을 타고, 연속으로 타격",
  },
} as const;
// Screen y grows downward. Vertical translations and a phase shift keep
// the mathematical shape readable and the runner above the roof.
export function trajectory(
  skill: Skill,
  start: Point,
  progress: number,
  floor = FLOOR,
): Point {
  const t = Math.max(0, Math.min(1, progress));
  const x = start.x + SKILLS[skill].distance * t;
  if (skill === "line") return { x, y: start.y - 44 * t };
  if (skill === "rise")
    return { x, y: start.y - Math.min(212, start.y - 64) * t * t };
  if (skill === "dive") return { x, y: start.y + (floor - start.y) * t * t };
  return {
    x,
    y:
      start.y -
      Math.min(88, (start.y - 62) / 2) * (1 - Math.cos(t * 3 * Math.PI)),
  };
}
// Swept collision avoids tunnelling even on a slow mobile frame.
export function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
