import { test } from "node:test";
import assert from "node:assert/strict";
import { SkillInputBuffer } from "./input";
import { fitViewport } from "./viewport";
import { FLOOR } from "./trajectory";

test("a fast follow-up waits for the input guard and fires exactly once", () => {
  const buffer = new SkillInputBuffer();
  buffer.queue("dive", 0.04, false);
  assert.equal(buffer.consume(0.1, false, false), null);
  assert.equal(buffer.consume(0.12, true, false), "dive");
  assert.equal(buffer.consume(0.13, true, false), null);
});
test("only the latest intent survives; end-window input preserves the old action", () => {
  const buffer = new SkillInputBuffer();
  buffer.queue("wave", 1, true);
  buffer.queue("dive", 1.02, true);
  assert.equal(buffer.consume(1.1, true, false), null);
  assert.equal(buffer.consume(1.12, true, true), "dive");
});
test("expired and cleared inputs cannot fire later", () => {
  const buffer = new SkillInputBuffer();
  buffer.queue("dive", 1, true);
  assert.equal(buffer.consume(1.15, true, true), null);
  buffer.queue("wave", 2, false);
  buffer.clear();
  assert.equal(buffer.consume(2.1, true, true), null);
});
test("landscape world stays isotropic and living enemies clear the thumb zone", () => {
  for (const [w, h, reserve] of [
    [844, 390, 124],
    [740, 360, 124],
    [844, 390, 158],
    [390, 325, 0],
    [1180, 460, 0],
  ]) {
    const view = fitViewport(w, h, reserve);
    assert.ok(Math.abs(w / view.width - h / view.height) < 1e-9);
    if (reserve) assert.ok((FLOOR + 40) * view.scale < h - reserve);
  }
});
