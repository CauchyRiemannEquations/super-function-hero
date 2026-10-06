import { test } from "node:test";
import assert from "node:assert/strict";
import { FLOOR, segmentDistance, trajectory, type Skill } from "./trajectory";

test("all skills preserve their activation origin, including airborne chaining", () => {
  for (const skill of ["line", "rise", "dive", "wave"] as Skill[]) {
    const origin = { x: 1983, y: 181 };
    assert.deepEqual(trajectory(skill, origin, 0), origin);
  }
});
test("uppercut grows steeper, dive falls steeper and lands exactly on the roof", () => {
  const a = { x: 0, y: FLOOR },
    b = { x: 0, y: 130 };
  assert.ok(
    a.y - trajectory("rise", a, 0.5).y <
      trajectory("rise", a, 0.5).y - trajectory("rise", a, 1).y,
  );
  assert.ok(
    trajectory("dive", b, 0.5).y - b.y <
      trajectory("dive", b, 1).y - trajectory("dive", b, 0.5).y,
  );
  assert.equal(trajectory("dive", b, 1).y, FLOOR);
  assert.ok(trajectory("rise", { x: 0, y: 90 }, 1).y >= 64);
});
test("wave has three alternating extrema (1.5 periods) without going below the roof", () => {
  const points = Array.from({ length: 601 }, (_, i) =>
    trajectory("wave", { x: 0, y: FLOOR }, i / 600),
  );
  let turns = 0;
  for (let i = 1; i < points.length - 1; i++)
    if ((points[i].y - points[i - 1].y) * (points[i + 1].y - points[i].y) < 0)
      turns++;
  assert.equal(turns, 2); // Third extremum is the endpoint of 1.5 cycles.
  assert.ok(points.every((p) => p.y <= FLOOR && p.y >= 62));
  assert.ok(trajectory("wave", { x: 0, y: FLOOR }, 1).y < FLOOR - 170);
});
test("swept collision catches an enemy between two fast frames and rejects distant targets", () => {
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
