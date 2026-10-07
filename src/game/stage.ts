import type { FunctionData, SurfaceData } from "./trajectory";
export type StageData = {
  id: number;
  name: string;
  tagline: string;
  hint: string;
  guide: "always" | "pulse" | "hint";
  surfaces: SurfaceData[];
  start: { surface: string; x: number };
  goal: { surface: string; x: number };
  coins: { id: string; x: number; y: number }[];
  /** x is the centre; y is the bottom of the visible hazard. */
  hazards: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    kind: "spikes" | "wall";
  }[];
  checkpoints: { id: string; surface: string; x: number }[];
  perfectZones: { surface: string; x: number; tolerance: number }[];
  bounds: { minY: number; maxY: number };
  parTime: number;
  theme: { sky: string; accent: string; secondary: string };
};
const polynomial = (
  coefficients: number[],
  origin: number,
  scale: number,
  yScale: number,
  offset: number,
): FunctionData => ({ coefficients, origin, scale, yScale, offset });
const flat = (
  id: string,
  start: number,
  end: number,
  y: number,
): SurfaceData => ({ id, start, end, function: polynomial([0], 0, 1, 1, y) });
const line = (
  id: string,
  start: number,
  end: number,
  y: number,
  slope: number,
): SurfaceData => ({
  id,
  start,
  end,
  function: polynomial([0, slope], start, 1, 1, y),
});
const coins = (points: [number, number][]) =>
  points.map(([x, y], i) => ({ id: `coin-${i}`, x, y }));
const spike = (id: string, x: number, y: number, width = 30) => ({
  id,
  x,
  y,
  width,
  height: 22,
  kind: "spikes" as const,
});
/** Authored geometry, rather than answer checks, makes every tangent matter. */
export const STAGES: StageData[] = [
  {
    id: 1,
    name: "FIRST TANGENT",
    tagline: "달려. 탭해. 날아가.",
    hint: "길이 위로 향할 때 탭! 빛나는 링을 지나 착지하세요.",
    guide: "always",
    surfaces: [
      {
        id: "rise",
        start: 0,
        end: 460,
        function: polynomial([0, 2, -0.5], 0, 400, 100, 40),
      },
      flat("receiver", 680, 1100, 110),
    ],
    start: { surface: "rise", x: 80 },
    goal: { surface: "receiver", x: 1010 },
    coins: coins([
      [190, 144],
      [300, 187],
      [475, 228],
      [590, 204],
      [720, 160],
      [845, 144],
      [950, 144],
    ]),
    hazards: [
      { id: "gap-wall", x: 645, y: -40, width: 30, height: 120, kind: "wall" },
    ],
    checkpoints: [{ id: "landing", surface: "receiver", x: 850 }],
    perfectZones: [{ surface: "rise", x: 380, tolerance: 30 }],
    bounds: { minY: -160, maxY: 340 },
    parTime: 5.8,
    theme: { sky: "#101629", accent: "#ff795c", secondary: "#59dfce" },
  },
  {
    id: 2,
    name: "ZERO SLOPE",
    tagline: "꼭대기에서, 옆으로.",
    hint: "곡선 꼭대기는 평평해요. 그 순간 탭하면 앞으로 날아갑니다.",
    guide: "always",
    surfaces: [
      {
        id: "arch",
        start: 0,
        end: 450,
        function: polynomial([0, 0, -1], 400, 300, 120, 220),
      },
      flat("receiver", 670, 1080, 65),
    ],
    start: { surface: "arch", x: 120 },
    goal: { surface: "receiver", x: 990 },
    coins: coins([
      [225, 213],
      [330, 247],
      [480, 245],
      [595, 209],
      [730, 119],
      [875, 99],
    ]),
    hazards: [spike("pit-spikes", 630, 55, 50)],
    checkpoints: [{ id: "landing", surface: "receiver", x: 820 }],
    perfectZones: [{ surface: "arch", x: 400, tolerance: 18 }],
    bounds: { minY: -190, maxY: 350 },
    parTime: 5.6,
    theme: { sky: "#12142d", accent: "#ad95ff", secondary: "#66d8ff" },
  },
  {
    id: 3,
    name: "GO HIGH",
    tagline: "가파른 길. 높은 도약.",
    hint: "길의 가파른 부분에서 탭해 위쪽 발판을 노리세요.",
    guide: "always",
    surfaces: [
      {
        id: "climb",
        start: 0,
        end: 390,
        function: polynomial([0, 4, -1], 0, 400, 160, 30),
      },
      flat("high", 560, 1100, 490),
    ],
    start: { surface: "climb", x: 60 },
    goal: { surface: "high", x: 1000 },
    coins: coins([
      [140, 268],
      [220, 368],
      [365, 514],
      [460, 565],
      [570, 560],
      [735, 524],
      [920, 524],
    ]),
    hazards: [spike("pit-spikes", 590, 390, 75)],
    checkpoints: [{ id: "high-landing", surface: "high", x: 790 }],
    perfectZones: [{ surface: "climb", x: 310, tolerance: 26 }],
    bounds: { minY: -70, maxY: 680 },
    parTime: 5.5,
    theme: { sky: "#151c25", accent: "#ffd56f", secondary: "#75e6ac" },
  },
  {
    id: 4,
    name: "NEGATIVE",
    tagline: "아래로 향하는 지름길.",
    hint: "내리막에서 탭! 낮은 발판에 붙으면 다시 달립니다.",
    guide: "pulse",
    surfaces: [
      {
        id: "descent",
        start: 0,
        end: 420,
        function: polynomial([0, -0.4, -1], 120, 400, 110, 410),
      },
      line("low", 620, 915, 90, -0.12),
      flat("finish", 1100, 1510, -35),
    ],
    start: { surface: "descent", x: 100 },
    goal: { surface: "finish", x: 1410 },
    coins: coins([
      [205, 430],
      [310, 398],
      [455, 318],
      [550, 223],
      [690, 115],
      [825, 99],
      [990, 34],
      [1180, 0],
      [1340, 0],
    ]),
    hazards: [
      spike("descent-pit", 590, -30, 45),
      {
        id: "gap-wall",
        x: 1050,
        y: -160,
        width: 28,
        height: 150,
        kind: "wall",
      },
    ],
    checkpoints: [{ id: "low-route", surface: "low", x: 740 }],
    perfectZones: [
      { surface: "descent", x: 363, tolerance: 24 },
      { surface: "low", x: 860, tolerance: 20 },
    ],
    bounds: { minY: -240, maxY: 540 },
    parTime: 7.5,
    theme: { sky: "#1c142a", accent: "#ff8dc0", secondary: "#76deee" },
  },
  {
    id: 5,
    name: "CURVE RUN",
    tagline: "한 곡선, 두 개의 루트.",
    hint: "일찍 뛰면 높은 지름길. 곡선을 끝까지 달리면 코인 루트.",
    guide: "pulse",
    surfaces: [
      {
        id: "cubic",
        start: 0,
        end: 450,
        function: polynomial([0, 5, -4, 1], 0, 450, 150, 30),
      },
      {
        ...line("shortcut", 590, 895, 285, -0.1),
        motion: { axis: "y", amplitude: 12, period: 3.6, phase: 0.5 },
      },
      line("collection", 620, 1030, 50, 0.22),
      flat("finish", 1180, 1580, 100),
    ],
    start: { surface: "cubic", x: 60 },
    goal: { surface: "finish", x: 1480 },
    coins: coins([
      [150, 262],
      [330, 351],
      [590, 242],
      [690, 108],
      [790, 130],
      [900, 157],
      [970, 170],
      [1080, 208],
      [1195, 156],
      [1370, 134],
    ]),
    hazards: [
      spike("collection-pit", 1130, -30, 65),
      {
        id: "route-wall",
        x: 1050,
        y: -80,
        width: 35,
        height: 110,
        kind: "wall",
      },
    ],
    checkpoints: [
      { id: "upper", surface: "shortcut", x: 665 },
      { id: "lower", surface: "collection", x: 910 },
    ],
    perfectZones: [
      { surface: "cubic", x: 225, tolerance: 28 },
      { surface: "cubic", x: 400, tolerance: 24 },
      { surface: "shortcut", x: 865, tolerance: 22 },
      { surface: "collection", x: 960, tolerance: 24 },
    ],
    bounds: { minY: -150, maxY: 490 },
    parTime: 6.5,
    theme: { sky: "#102322", accent: "#55ebba", secondary: "#ffd077" },
  },
];
/** Ordinary tap replays used by tests and browser play verification. */
export const STAGE_ROUTES: {
  stageId: number;
  label: string;
  taps: number[];
}[] = [
  { stageId: 1, label: "first landing", taps: [1.65] },
  { stageId: 2, label: "at the vertex", taps: [1.6] },
  { stageId: 3, label: "high platform", taps: [1.95] },
  { stageId: 4, label: "two downward launches", taps: [1.45, 3.2] },
  { stageId: 5, label: "upper shortcut", taps: [1.2, 3.55] },
  { stageId: 5, label: "lower coin route", taps: [5] },
];
