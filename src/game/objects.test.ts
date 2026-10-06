import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeObject,
  attackCanBreak,
  touchesHazard,
  hasAerialImpact,
} from "./objects";
import { ENCOUNTERS, REQUIRED_CORES, DURATION } from "./stage";
import { FLOOR, trajectory, type Skill } from "./trajectory";

test("HAZARD is never breakable and ENEMY remains an optional path target", () => {
  for (const skill of ["line", "rise", "dive", "wave"] as Skill[]) {
    assert.equal(
      attackCanBreak({ role: "hazard", kind: "spike" }, skill, true, true),
      false,
    );
    assert.equal(
      attackCanBreak({ role: "enemy", kind: "bot" }, skill, false, false),
      true,
    );
  }
});
test("a repeated weak dive cannot create strong impact", () => {
  assert.equal(hasAerialImpact(140, { skill: "dive", powerful: false }), false);
  assert.equal(hasAerialImpact(140, { skill: "rise", powerful: false }), true);
  assert.equal(hasAerialImpact(140, { skill: "wave", powerful: false }), true);
  assert.equal(hasAerialImpact(140, { skill: "dive", powerful: true }), true);
  assert.equal(hasAerialImpact(40, null), false);
});
test("impact CORE requires a genuine aerial dive landing; a ground hop cannot activate it", () => {
  for (const kind of ["impact", "fracture"] as const) {
    const core = { role: "core" as const, kind };
    assert.equal(attackCanBreak(core, "dive", false, true), false);
    assert.equal(attackCanBreak(core, "rise", true, true), false);
    assert.equal(attackCanBreak(core, "dive", true, false), false);
    assert.equal(attackCanBreak(core, "dive", true, true), true);
  }
});
test("every gate has a CORE link in the same authored chunk", () => {
  const cores = ENCOUNTERS.flatMap((e) =>
    e.layout
      .filter((o) => o.role === "core")
      .map((o) => e.namespace + ":" + o.link),
  );
  for (const event of ENCOUNTERS)
    for (const gate of event.layout.filter((o) => o.kind === "gate"))
      assert.ok(cores.includes(event.namespace + ":" + gate.link));
  assert.equal(new Set(cores).size, REQUIRED_CORES);
  assert.equal(DURATION, 150);
});
test("closed gates and ceiling use swept solid collision; open gates are passable", () => {
  const gate = makeObject(
    1,
    { role: "hazard", kind: "gate", offset: 200 },
    0,
    FLOOR,
    "test",
  );
  assert.equal(touchesHazard(gate, { x: 0, y: 300 }, { x: 400, y: 300 }), true);
  gate.open = true;
  assert.equal(
    touchesHazard(gate, { x: 0, y: 300 }, { x: 400, y: 300 }),
    false,
  );
  const ceiling = makeObject(
    2,
    { role: "hazard", kind: "ceiling", offset: 625 },
    0,
    FLOOR,
    "test",
  );
  assert.equal(
    touchesHazard(ceiling, { x: 520, y: 136 }, { x: 560, y: 136 }),
    true,
  );
  assert.equal(
    touchesHazard(ceiling, { x: 520, y: FLOOR }, { x: 700, y: FLOOR }),
    false,
  );
});
test("lower-route dive lands on its own floor rather than teleporting back to the roof", () => {
  const point = trajectory("dive", { x: 100, y: 210 }, 1, FLOOR + 100);
  assert.equal(point.y, FLOOR + 100);
  assert.equal(point.x, 220);
});
