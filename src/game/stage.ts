import { FLOOR } from "./trajectory";
import { makeObject, type SpawnSpec, type WorldObject } from "./objects";
export const DURATION = 60;
export const SPEED = 142;
export const LOWER_FLOOR = FLOOR + 100;
export type Enemy = WorldObject;
const enemy = (
  offset: number,
  above = 18,
  kind: "bot" | "drone" = "bot",
): SpawnSpec => ({ role: "enemy", kind, offset, above });
const core = (
  offset: number,
  above: number,
  link: string,
  kind: "orb" | "impact" | "fracture" = "orb",
): SpawnSpec => ({ role: "core", kind, offset, above, link });
const gate = (offset: number, link: string): SpawnSpec => ({
  role: "hazard",
  kind: "gate",
  offset,
  link,
});
const spike = (offset: number): SpawnSpec => ({
  role: "hazard",
  kind: "spike",
  offset,
});
const ceiling = (offset: number): SpawnSpec => ({
  role: "hazard",
  kind: "ceiling",
  offset,
});
const wave = [
  enemy(185, 18),
  enemy(290, 168, "drone"),
  enemy(430, 32),
  enemy(540, 155, "drone"),
];

// Authored, named chunks. No random generation or function-answer checks.
// Every invocation gets its own link namespace and local ground reference.
export const PATTERNS = {
  DASH_GATE: {
    name: "첫 번째 잠금",
    events: [
      {
        at: 0,
        objects: [
          enemy(300),
          core(360, 28, "dash"),
          gate(550, "dash"),
          spike(830),
        ],
      },
    ],
  },
  UPPER_DIVE: {
    name: "공중에서 바닥까지",
    events: [
      {
        at: 0,
        objects: [
          enemy(330, 155, "drone"),
          core(350, 172, "air"),
          ceiling(625),
          core(502, 0, "plate", "impact"),
          gate(690, "air"),
          gate(865, "plate"),
        ],
      },
    ],
  },
  CRASH_ROUTE: {
    name: "아래로 길을 내라",
    events: [
      {
        at: 0,
        objects: [
          core(350, 172, "air"),
          ceiling(625),
          core(502, 0, "crash", "fracture"),
          gate(690, "air"),
          gate(800, "crash"),
        ],
      },
      { at: 2.6, objects: wave },
    ],
  },
  WAVE_ALLEY: {
    name: "물결로 잇기",
    events: [{ at: 0, objects: [...wave, spike(610)] }],
  },
  MIXED_GATE: {
    name: "마지막 봉쇄",
    events: [
      {
        at: 0,
        objects: [
          enemy(200),
          core(350, 160, "final-air"),
          core(670, 0, "final-impact", "impact"),
          gate(840, "final-air"),
          gate(980, "final-impact"),
        ],
      },
    ],
  },
} satisfies Record<
  string,
  { name: string; events: { at: number; objects: SpawnSpec[] }[] }
>;
export type PatternId = keyof typeof PATTERNS;
export const COURSE: { time: number; pattern: PatternId }[] = [
  { time: 1, pattern: "DASH_GATE" },
  { time: 8, pattern: "UPPER_DIVE" },
  { time: 16, pattern: "CRASH_ROUTE" },
  { time: 24, pattern: "WAVE_ALLEY" },
  { time: 32, pattern: "UPPER_DIVE" },
  { time: 40, pattern: "CRASH_ROUTE" },
  { time: 48, pattern: "MIXED_GATE" },
  { time: 54, pattern: "WAVE_ALLEY" },
];
export const ENCOUNTERS = COURSE.flatMap((chunk, index) =>
  PATTERNS[chunk.pattern].events.map((event) => ({
    time: chunk.time + event.at,
    pattern: chunk.pattern,
    namespace: `${index}-${chunk.pattern}`,
    layout: event.objects,
  })),
).sort((a, b) => a.time - b.time);
export const REQUIRED_CORES = ENCOUNTERS.reduce(
  (n, e) => n + e.layout.filter((o) => o.role === "core").length,
  0,
);
export const CHAPTERS = [
  {
    time: 0,
    name: "SKYLINE BREACH",
    tip: "위험물은 피하고, CORE로 문을 열어라.",
  },
  { time: 8, name: "AIR → IMPACT", tip: "공중 CORE를 깨고, 빠르게 아래로." },
  {
    time: 16,
    name: "BREAK THE FLOOR",
    tip: "공중 급강하로 금 간 바닥을 부숴라.",
  },
  { time: 24, name: "WAVE ALLEY", tip: "보너스 적을 하나의 물결로 연결." },
  { time: 32, name: "SECOND LOCK", tip: "천장을 피하고 충격판을 내려찍어라." },
  { time: 40, name: "LOWER ROUTE", tip: "아래 루트의 보너스를 노려라." },
  { time: 48, name: "FINAL BREACH", tip: "마지막 CORE까지 연결하라." },
  { time: 54, name: "HOME STRETCH", tip: "끝까지 흐름을 이어라." },
];
export function chapterAt(time: number) {
  return [...CHAPTERS].reverse().find((c) => time >= c.time) ?? CHAPTERS[0];
}
export function makeEnemy(
  id: number,
  x: number,
  y: number,
  kind: "bot" | "drone" | "spike" = "bot",
): WorldObject {
  const o = makeObject(
    id,
    { role: kind === "spike" ? "hazard" : "enemy", kind, offset: 0 },
    x,
    FLOOR,
    "debug",
  );
  o.y = y;
  return o;
}
