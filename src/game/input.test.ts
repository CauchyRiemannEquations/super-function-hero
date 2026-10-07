import { test } from "node:test";
import assert from "node:assert/strict";
import { JumpInputBuffer } from "./input";
import { fitViewport } from "./viewport";
test("a tap within 140ms of contact fires exactly once on landing", () => {
  const buffer = new JumpInputBuffer();
  buffer.queue(1);
  assert.equal(buffer.consume(1.08, false), false);
  assert.equal(buffer.consume(1.12, true), true);
  assert.equal(buffer.consume(1.13, true), false);
});
test("the latest tap replaces the old intent and expired inputs never launch later", () => {
  const buffer = new JumpInputBuffer();
  buffer.queue(1);
  buffer.queue(1.08);
  assert.equal(buffer.consume(1.2, true), true);
  buffer.queue(2);
  assert.equal(buffer.consume(2.15, true), false);
  buffer.queue(3);
  buffer.clear();
  assert.equal(buffer.consume(3.02, true), false);
});
test("landscape viewport keeps world geometry isotropic across mobile and desktop sizes", () => {
  for (const [w, h] of [
    [844, 390],
    [740, 360],
    [932, 430],
    [390, 325],
    [1180, 460],
  ]) {
    const view = fitViewport(w, h);
    assert.ok(Math.abs(w / view.width - h / view.height) < 1e-9);
    assert.ok(view.width > 0 && view.height > 0);
  }
});
