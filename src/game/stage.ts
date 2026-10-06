import { FLOOR } from "./trajectory";
export const DURATION = 38;
export const SPEED = 142;
export type Enemy = {
  id: number;
  x: number;
  y: number;
  kind: "bot" | "drone" | "spike";
  dead: boolean;
  passed: boolean;
  death: number;
  vx: number;
  vy: number;
};
export const CHAPTERS = [
  {
    time: 0,
    name: "옥상에 오신 걸 환영합니다",
    tip: "앞을 보세요. 곡선이 당신의 움직임이 됩니다.",
  },
  {
    time: 3,
    name: "직선으로 돌파",
    tip: "가까워지는 적을 빠르게 관통해 보세요.",
  },
  {
    time: 8,
    name: "하늘까지, 어퍼컷",
    tip: "높이 떠 있는 적을 향해 치솟으세요.",
  },
  {
    time: 12,
    name: "강하게 내려찍기",
    tip: "도약 후 내려찍기 · 공중에서는 즉시 낙하",
  },
  {
    time: 16,
    name: "리듬을 타는 웨이브",
    tip: "높이가 다른 적들을 하나의 물결로 연결하세요.",
  },
  {
    time: 22,
    name: "올라갔다, 내려꽂기",
    tip: "어퍼컷 → 내려찍기. 공중에서 기술을 연결하세요.",
  },
  {
    time: 29,
    name: "마지막 러시",
    tip: "네 가지 곡선으로 나만의 콤보를 만드세요.",
  },
];
export function chapterAt(time: number) {
  return [...CHAPTERS].reverse().find((c) => time >= c.time) ?? CHAPTERS[0];
}
export function makeEnemy(
  id: number,
  x: number,
  y: number,
  kind: Enemy["kind"] = "bot",
): Enemy {
  return { id, x, y, kind, dead: false, passed: false, death: 0, vx: 0, vy: 0 };
}
// Each group is placed relative to the runner at its cue time. Dashes do
// not accidentally consume the entire stage, and every group gets a telegraph.
export const ENCOUNTERS = [
  { time: 2, layout: [[370, FLOOR - 16, "bot"]] },
  {
    time: 6.8,
    layout: [
      [360, 176, "drone"],
      [420, 125, "drone"],
    ],
  },
  {
    time: 11,
    layout: [
      [340, FLOOR - 22, "bot"],
      [400, FLOOR - 22, "bot"],
    ],
  },
  {
    time: 15.2,
    layout: [
      [295, 216, "drone"],
      [450, 302, "bot"],
      [560, 184, "drone"],
    ],
  },
  {
    time: 20.6,
    layout: [
      [350, 170, "drone"],
      [425, 125, "drone"],
      [610, FLOOR - 20, "bot"],
      [675, FLOOR - 20, "bot"],
    ],
  },
  {
    time: 26.8,
    layout: [
      [330, FLOOR - 18, "bot"],
      [560, FLOOR + 8, "spike"],
      [650, 190, "drone"],
    ],
  },
  {
    // An opening low target supports dash → wave or dash → uppercut.
    // The mixed cluster can also be crossed by one wave, without a skill gate.
    time: 30,
    layout: [
      [285, FLOOR - 18, "bot"],
      [430, 220, "drone"],
      [575, 302, "bot"],
      [680, 184, "drone"],
    ],
  },
  {
    // A second short beat at 34s keeps action near the finish. High + low
    // pairs allow uppercut → dive, or a timed wave followed by a dash.
    time: 34,
    layout: [
      [315, 176, "drone"],
      [600, FLOOR - 22, "bot"],
      [665, FLOOR - 22, "bot"],
    ],
  },
] as const;
