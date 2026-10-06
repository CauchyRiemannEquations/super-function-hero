import { segmentDistance, type Point, type Skill } from "./trajectory";

export type Role = "hazard" | "enemy" | "core";
export type Kind =
  | "bot"
  | "drone"
  | "spike"
  | "ceiling"
  | "gate"
  | "orb"
  | "impact"
  | "fracture";
export type SpawnSpec = {
  role: Role;
  kind: Kind;
  offset: number;
  above?: number;
  width?: number;
  height?: number;
  link?: string;
};
export type WorldObject = Point & {
  id: number;
  role: Role;
  kind: Kind;
  width: number;
  height: number;
  floor: number;
  link?: string;
  open: boolean;
  openedAt: number;
  dead: boolean;
  passed: boolean;
  death: number;
  vx: number;
  vy: number;
};

// Repeating a weak hop-dive cannot masquerade as a real aerial impact.
export function hasAerialImpact(
  height: number,
  previous: { skill: Skill; powerful: boolean } | null,
) {
  return height >= 95 && !(previous?.skill === "dive" && !previous.powerful);
}

export function makeObject(
  id: number,
  spec: SpawnSpec,
  origin: number,
  floor: number,
  namespace: string,
): WorldObject {
  const defaults =
    spec.kind === "gate"
      ? [44, floor + 36 - 24]
      : spec.kind === "ceiling"
        ? [190, 222]
        : spec.kind === "spike"
          ? [64, 64]
          : spec.kind === "fracture"
            ? [150, 18]
            : spec.kind === "impact"
              ? [100, 16]
              : [44, 44];
  const height = spec.height ?? defaults[1];
  const y =
    spec.kind === "gate"
      ? 24 + height / 2
      : spec.kind === "ceiling"
        ? floor - 78 - height / 2
        : spec.kind === "impact" || spec.kind === "fracture"
          ? floor + 24
          : spec.kind === "spike"
            ? floor + 28 - height / 2
            : floor - (spec.above ?? 18);
  return {
    id,
    role: spec.role,
    kind: spec.kind,
    x: origin + spec.offset,
    y,
    width: spec.width ?? defaults[0],
    height,
    floor,
    link: spec.link ? `${namespace}:${spec.link}` : undefined,
    open: false,
    openedAt: 0,
    dead: false,
    passed: false,
    death: 0,
    vx: 0,
    vy: 0,
  };
}

export function attackCanBreak(
  o: Pick<WorldObject, "role" | "kind">,
  skill: Skill,
  powerful: boolean,
  landing: boolean,
) {
  if (o.role === "hazard") return false;
  if (o.role === "enemy" || o.kind === "orb") return !landing;
  return skill === "dive" && powerful && landing;
}

// Segment versus expanded AABB: a fast skill cannot tunnel through a gate
// or a ceiling. Only hazards have solid bodies; enemies and COREs use paths.
export function touchesHazard(o: WorldObject, a: Point, b: Point, radius = 22) {
  if (o.open || (o.passed && o.kind !== "gate")) return false;
  let lo = 0,
    hi = 1;
  for (const axis of ["x", "y"] as const) {
    const half = (axis === "x" ? o.width : o.height) / 2 + radius;
    const min = o[axis] - half,
      max = o[axis] + half,
      d = b[axis] - a[axis];
    if (Math.abs(d) < 1e-8) {
      if (a[axis] < min || a[axis] > max) return false;
    } else {
      const t1 = (min - a[axis]) / d,
        t2 = (max - a[axis]) / d;
      lo = Math.max(lo, Math.min(t1, t2));
      hi = Math.min(hi, Math.max(t1, t2));
      if (lo > hi) return false;
    }
  }
  return true;
}
export function attackDistance(o: WorldObject, a: Point, b: Point) {
  return segmentDistance(o, a, b);
}
