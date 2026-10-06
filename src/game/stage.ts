import { FLOOR } from "./trajectory";
import { makeObject, type SpawnSpec, type WorldObject } from "./objects";
import { PALETTES, blendPalette, type Theme } from "./environment";
export const DURATION = 150;
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
const spike = (offset: number, leadSeconds = 1): SpawnSpec => ({
  role: "hazard",
  kind: "spike",
  offset,
  leadSeconds,
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
          spike(830, 3),
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
export const EXIT_AFTER: Record<PatternId, number> = {
  DASH_GATE: 6,
  UPPER_DIVE: 6.5,
  CRASH_ROUTE: 7.3,
  WAVE_ALLEY: 3.3,
  MIXED_GATE: 5,
};
export const SECTIONS: {
  start: number;
  name: string;
  theme: Theme;
  pace: number;
  tip: string;
}[] = [
  {
    start: 0,
    name: "ROOFTOP SIGNAL",
    theme: "rooftops",
    pace: 1,
    tip: "위험물을 피하고 CORE로 길을 열어라.",
  },
  {
    start: 36,
    name: "CITY CIRCUIT",
    theme: "city",
    pace: 1.04,
    tip: "도심의 신호를 연결하라.",
  },
  {
    start: 72,
    name: "FACTORY BREAK",
    theme: "factory",
    pace: 1.08,
    tip: "충격판과 아래 루트를 돌파하라.",
  },
  {
    start: 108,
    name: "NEON RUSH",
    theme: "night",
    pace: 1.12,
    tip: "밤의 봉쇄를 열고 끝까지 달려라.",
  },
];
export const COURSE: { time: number; pattern: PatternId }[] = [
  { time: 1, pattern: "DASH_GATE" },
  { time: 9, pattern: "UPPER_DIVE" },
  { time: 17, pattern: "CRASH_ROUTE" },
  { time: 27, pattern: "WAVE_ALLEY" },
  { time: 37, pattern: "DASH_GATE" },
  { time: 45, pattern: "WAVE_ALLEY" },
  { time: 53, pattern: "UPPER_DIVE" },
  { time: 61, pattern: "CRASH_ROUTE" },
  { time: 73, pattern: "DASH_GATE" },
  { time: 81, pattern: "UPPER_DIVE" },
  { time: 89, pattern: "CRASH_ROUTE" },
  { time: 99, pattern: "WAVE_ALLEY" },
  { time: 109, pattern: "MIXED_GATE" },
  { time: 119, pattern: "UPPER_DIVE" },
  { time: 129, pattern: "CRASH_ROUTE" },
  { time: 139, pattern: "WAVE_ALLEY" },
  { time: 145, pattern: "MIXED_GATE" },
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
export const CHAPTERS = SECTIONS.map((s) => ({
  time: s.start,
  name: s.name,
  tip: s.tip,
}));
export function chapterAt(time: number) {
  return [...CHAPTERS].reverse().find((c) => time >= c.time) ?? CHAPTERS[0];
}
export function sectionAt(time: number) {
  return [...SECTIONS].reverse().find((s) => time >= s.start) ?? SECTIONS[0];
}
export function speedAt(time: number) {
  const s = sectionAt(time),
    i = SECTIONS.indexOf(s),
    previous = SECTIONS[Math.max(0, i - 1)].pace;
  const blend = Math.max(0, Math.min(1, (time - s.start) / 4));
  return SPEED * (previous + (s.pace - previous) * blend);
}
export function sceneryAt(time: number) {
  const s = sectionAt(time),
    i = SECTIONS.indexOf(s),
    prev = SECTIONS[Math.max(0, i - 1)];
  return blendPalette(
    PALETTES[prev.theme],
    PALETTES[s.theme],
    Math.max(0, Math.min(1, (time - s.start) / 3)),
  );
}
export function pacedSpec(spec: SpawnSpec, time: number): SpawnSpec {
  const lead = spec.leadSeconds ?? 1;
  return {
    ...spec,
    offset: spec.offset + (speedAt(time + lead) - SPEED) * lead,
  };
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
