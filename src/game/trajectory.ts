/** Every gameplay coordinate is mathematical: positive y points upward. */
export type Point = { x: number; y: number };
/** Ascending coefficients: [a, b, c] describes a + bu + cu². */
export type FunctionData = {
  coefficients: number[];
  origin: number;
  scale: number;
  yScale: number;
  offset: number;
};
export type SurfaceData = {
  id: string;
  start: number;
  end: number;
  function: FunctionData;
  color?: string;
  motion?: {
    axis: "x" | "y";
    amplitude: number;
    period: number;
    phase?: number;
  };
};
export function surfaceMotion(surface: SurfaceData, time = 0): Point {
  const m = surface.motion;
  if (!m || m.period <= 0) return { x: 0, y: 0 };
  const distance =
    m.amplitude * Math.sin((time / m.period) * Math.PI * 2 + (m.phase ?? 0));
  return { x: m.axis === "x" ? distance : 0, y: m.axis === "y" ? distance : 0 };
}
export function surfaceRange(surface: SurfaceData, time = 0) {
  const dx = surfaceMotion(surface, time).x;
  return { start: surface.start + dx, end: surface.end + dx };
}
/** Horner evaluation and its analytic derivative always describe the same road. */
export function sampleSurface(
  surface: SurfaceData,
  x: number,
  time = 0,
): { y: number; slope: number } {
  const f = surface.function;
  if (f.scale === 0)
    throw new Error(`Surface ${surface.id} needs a nonzero function scale`);
  const motion = surfaceMotion(surface, time);
  const u = (x - motion.x - f.origin) / f.scale;
  let value = 0,
    derivative = 0;
  for (let i = f.coefficients.length - 1; i >= 0; i--) {
    derivative = derivative * u + value;
    value = value * u + f.coefficients[i];
  }
  return {
    y: f.offset + f.yScale * value + motion.y,
    slope: (f.yScale / f.scale) * derivative,
  };
}
export function tangentVelocity(slope: number, speed: number): Point {
  const vx = speed / Math.hypot(1, slope);
  return { x: vx, y: vx * slope };
}
/** Swept pickups keep fast launches from tunnelling through a small coin. */
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
