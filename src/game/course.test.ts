import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COURSE,
  EXIT_AFTER,
  SECTIONS,
  DURATION,
  speedAt,
  sceneryAt,
  pacedSpec,
  SPEED,
} from "./stage";
test("all authored chunks have time to exit before the next entry", () => {
  for (let i = 0; i < COURSE.length - 1; i++)
    assert.ok(
      COURSE[i + 1].time - COURSE[i].time >= EXIT_AFTER[COURSE[i].pattern],
      COURSE[i].pattern,
    );
  const final = COURSE.at(-1)!;
  assert.ok(final.time + EXIT_AFTER[final.pattern] <= DURATION);
  assert.equal(SECTIONS.length, 4);
  assert.equal(DURATION, 150);
});
test("pace rises gradually and is continuous at each section boundary", () => {
  assert.equal(speedAt(0), SPEED);
  assert.ok(Math.abs(speedAt(150) - SPEED * 1.12) < 1e-8);
  let last = 0;
  for (let t = 0; t <= 150; t += 0.1) {
    assert.ok(speedAt(t) >= last - 1e-7);
    last = speedAt(t);
  }
  for (const s of SECTIONS.slice(1))
    assert.ok(Math.abs(speedAt(s.start) - speedAt(s.start - 0.0001)) < 0.001);
});
test("scenery blends without a frame jump and reaction lead tracks the pace", () => {
  for (const s of SECTIONS.slice(1))
    assert.deepEqual(sceneryAt(s.start), sceneryAt(s.start - 0.0001));
  const base = {
    role: "hazard" as const,
    kind: "spike" as const,
    offset: 830,
    leadSeconds: 3,
  };
  assert.equal(pacedSpec(base, 0).offset, 830);
  assert.ok(pacedSpec(base, 145).offset > 830);
  assert.equal(base.offset, 830);
});
