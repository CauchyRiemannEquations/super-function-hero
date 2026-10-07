import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sampleSurface,
  segmentDistance,
  surfaceRange,
  tangentVelocity,
  type SurfaceData,
} from "./trajectory";
const road: SurfaceData = {
  id: "parabola",
  start: 0,
  end: 800,
  function: {
    coefficients: [1, -2, 3],
    origin: 120,
    scale: 200,
    yScale: 90,
    offset: 40,
  },
};
test("the visible polynomial and analytic tangent agree at every sampled position", () => {
  for (let x = 0; x <= 800; x += 17) {
    const { y, slope } = sampleSurface(road, x);
    const u = (x - 120) / 200;
    assert.ok(Math.abs(y - (40 + 90 * (1 - 2 * u + 3 * u * u))) < 1e-9);
    const epsilon = 0.001;
    const numeric =
      (sampleSurface(road, x + epsilon).y -
        sampleSurface(road, x - epsilon).y) /
      (2 * epsilon);
    assert.ok(Math.abs(slope - numeric) < 1e-8);
  }
});
test("normalized tangent velocities preserve positive, zero and negative slope without a hidden boost", () => {
  for (const slope of [-4, -0.25, 0, 0.25, 4]) {
    const v = tangentVelocity(slope, 420);
    assert.equal(Math.sign(v.y), Math.sign(slope));
    assert.ok(Math.abs(v.y / v.x - slope) < 1e-10);
    assert.ok(Math.abs(Math.hypot(v.x, v.y) - 420) < 1e-10);
  }
});
test("moving roads translate the function and its bounds together", () => {
  const moving = {
    ...road,
    motion: { axis: "x" as const, amplitude: 30, period: 4 },
  };
  assert.deepEqual(surfaceRange(moving, 1), { start: 30, end: 830 });
  assert.deepEqual(sampleSurface(moving, 350, 1), sampleSurface(road, 320));
  const vertical = {
    ...road,
    motion: { axis: "y" as const, amplitude: 25, period: 4 },
  };
  assert.equal(
    sampleSurface(vertical, 320, 1).y,
    sampleSurface(road, 320).y + 25,
  );
  assert.equal(
    sampleSurface(vertical, 320, 1).slope,
    sampleSurface(road, 320).slope,
  );
});
test("swept pickups cover fast travel and stationary points", () => {
  assert.equal(
    segmentDistance({ x: 100, y: 15 }, { x: 0, y: 0 }, { x: 260, y: 0 }),
    15,
  );
  assert.equal(
    segmentDistance({ x: 400, y: 0 }, { x: 0, y: 0 }, { x: 260, y: 0 }),
    140,
  );
  assert.equal(
    segmentDistance({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 }),
    5,
  );
});
