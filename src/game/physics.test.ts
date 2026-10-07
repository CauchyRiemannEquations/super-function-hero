import { test } from "node:test";
import assert from "node:assert/strict";
import { STAGES, STAGE_ROUTES, type StageData } from "./stage";
import {
  ParkourRun,
  FIXED_STEP,
  JUMP_SPEED,
  RESPAWN_SECONDS,
  type RunEvent,
} from "./physics";
import { sampleSurface, type SurfaceData } from "./trajectory";
function replay(
  stage: StageData,
  taps: number[],
  maxTime = 12,
  frame = FIXED_STEP,
) {
  const run = new ParkourRun(stage);
  const events: RunEvent[] = [];
  let next = 0;
  for (
    let elapsed = 0;
    elapsed < maxTime && run.phase !== "clear";
    elapsed += frame
  ) {
    if (next < taps.length && elapsed + 1e-9 >= taps[next]) {
      run.jump();
      next++;
    }
    run.update(frame);
    events.push(...run.consumeEvents());
  }
  return { run, events };
}
for (const route of STAGE_ROUTES) {
  test(`ordinary taps complete Stage ${route.stageId}, ${route.label}, without any teleport or miss`, () => {
    const { run, events } = replay(STAGES[route.stageId - 1], route.taps);
    assert.equal(run.phase, "clear");
    assert.equal(run.stats.misses, 0);
    assert.equal(run.stats.jumps, route.taps.length);
    assert.ok(run.stats.coins > 0);
    assert.ok(run.stats.perfects > 0);
    assert.ok(events.some((e) => e.type === "land"));
    assert.ok(events.some((e) => e.type === "checkpoint"));
    assert.ok(events.some((e) => e.type === "clear"));
    assert.ok(run.trace.some((p) => p.air) && run.trace.some((p) => !p.air));
    assert.equal(run.trace.filter((p) => p.break).length, 1);
    assert.equal(run.player.surface, run.stage.goal.surface);
  });
  test(`Stage ${route.stageId}, ${route.label}, accepts mobile timing variation of ±100ms`, () => {
    for (const jitter of [-0.1, -0.05, 0.05, 0.1]) {
      const { run } = replay(
        STAGES[route.stageId - 1],
        route.taps.map((t) => t + jitter),
      );
      assert.equal(run.phase, "clear", `jitter ${jitter}`);
      assert.equal(run.stats.misses, 0, `jitter ${jitter}`);
    }
  });
}
test("every stage requires a player tap; simply waiting cannot clear its gaps", () => {
  for (const stage of STAGES) {
    const { run } = replay(stage, []);
    assert.notEqual(run.phase, "clear", stage.name);
    assert.ok(run.stats.misses > 0, stage.name);
  }
});
test("Stage 5 offers a faster high route and a richer coin route; every coin is reachable", () => {
  const upper = replay(STAGES[4], STAGE_ROUTES[4].taps).run;
  const lower = replay(STAGES[4], STAGE_ROUTES[5].taps).run;
  assert.ok(upper.stats.time + 0.8 < lower.stats.time);
  assert.ok(lower.stats.coins >= upper.stats.coins + 3);
  const reachable = new Set([...upper.collected, ...lower.collected]);
  assert.equal(reachable.size, STAGES[4].coins.length);
});
test("the fixed-step simulation produces the same result at 30Hz and 120Hz", () => {
  // Identical input timestamps on both frame boundaries isolate integration
  // determinism from the unavoidable sampling delay of a slower input frame.
  const slow = replay(STAGES[0], [1.6], 10, 1 / 30).run;
  const fast = replay(STAGES[0], [1.6]).run;
  assert.deepEqual(slow.stats, fast.stats);
  assert.deepEqual(slow.player, fast.player);
  assert.deepEqual(slow.trace, fast.trace);
});
test("launches start with the exact analytic tangent and retain gravity after takeoff", () => {
  for (const id of [1, 2, 3, 4]) {
    const stage = STAGES[id - 1];
    const time = STAGE_ROUTES[id - 1].taps[0];
    const run = new ParkourRun(stage);
    run.update(time);
    const sample = sampleSurface(stage.surfaces[0], run.player.x, run.clock);
    assert.equal(run.jump(), true);
    assert.ok(Math.abs(run.player.vy / run.player.vx - sample.slope) < 1e-10);
    assert.ok(
      Math.abs(Math.hypot(run.player.vx, run.player.vy) - JUMP_SPEED) < 1e-10,
    );
    const initialVy = run.player.vy;
    run.update(FIXED_STEP);
    assert.ok(run.player.vy < initialVy);
  }
});
test("a tap just before landing is buffered until contact and does not grant an air jump", () => {
  const run = new ParkourRun(STAGES[0]);
  run.update(1.65);
  run.jump();
  run.consumeEvents();
  run.update(0.84);
  assert.equal(run.player.surface, null);
  assert.equal(run.jump(), false);
  assert.equal(run.stats.jumps, 1);
  let sawLanding = false;
  for (let i = 0; i < 16; i++) {
    run.update(FIXED_STEP);
    sawLanding ||= run.consumeEvents().some((e) => e.type === "land");
  }
  assert.ok(sawLanding);
  assert.equal(run.stats.jumps, 2);
  assert.equal(run.player.surface, null);
});
test("a late airborne tap expires and cannot trigger on a distant landing", () => {
  const run = new ParkourRun(STAGES[0]);
  run.update(1.65);
  run.jump();
  run.update(0.2);
  assert.equal(run.jump(), false);
  run.update(0.8);
  assert.equal(run.stats.jumps, 1);
  assert.equal(run.player.surface, "receiver");
});
test("a missed run respawns in half a second with checkpoint coins intact and unbanked coins rolled back", () => {
  const run = new ParkourRun(STAGES[3]);
  run.update(1.45);
  run.jump();
  while (run.checkpoint === "start") run.update(FIXED_STEP);
  const banked = new Set(run.collected);
  const bankedScore = run.stats.score;
  while (run.phase === "playing") run.update(FIXED_STEP);
  assert.equal(run.phase, "miss");
  assert.ok(run.collected.size > banked.size);
  const atMiss = run.stats.time;
  run.jump(); // A tap during MISS cannot leak into the resumed run.
  run.update(RESPAWN_SECONDS);
  assert.equal(run.phase, "playing");
  assert.equal(run.player.x, 740);
  assert.equal(run.player.surface, "low");
  assert.deepEqual(run.collected, banked);
  assert.equal(run.stats.score, bankedScore);
  assert.ok(Math.abs(run.stats.time - atMiss - RESPAWN_SECONDS) < 1e-9);
  assert.equal(run.stats.jumps, 1);
  assert.equal(run.trace.filter((p) => p.break).length, 2);
  assert.ok(run.stats.time >= run.clock + 1 - 1e-9);
});
test("a falling miss before any checkpoint rolls all collected coins and score back to zero", () => {
  const run = new ParkourRun(STAGES[0]);
  while (run.phase === "playing") run.update(FIXED_STEP);
  assert.ok(run.stats.coins > 0);
  assert.ok(run.stats.score > 0);
  run.update(RESPAWN_SECONDS);
  assert.equal(run.stats.coins, 0);
  assert.equal(run.stats.score, 0);
  assert.equal(run.player.x, run.stage.start.x);
});
test("Stage 5 lands on its moving shortcut at the current world height", () => {
  const run = new ParkourRun(STAGES[4]);
  run.update(1.2);
  run.jump();
  while (!run.player.surface) run.update(FIXED_STEP);
  assert.equal(run.player.surface, "shortcut");
  const surface = run.stage.surfaces.find((s) => s.id === "shortcut")!;
  assert.equal(run.player.y, sampleSurface(surface, run.player.x, run.clock).y);
  const before = run.player.y;
  run.update(0.1);
  assert.equal(run.player.y, sampleSurface(surface, run.player.x, run.clock).y);
  assert.notEqual(run.player.y, before);
});
test("moving horizontal platforms catch a swept landing and carry the runner", () => {
  const flat = (
    id: string,
    start: number,
    end: number,
    y: number,
  ): SurfaceData => ({
    id,
    start,
    end,
    function: { coefficients: [0], origin: 0, scale: 1, yScale: 1, offset: y },
  });
  const moving = {
    ...flat("moving", 300, 520, 60),
    motion: { axis: "x" as const, amplitude: 20, period: 2 },
  };
  const stage: StageData = {
    ...STAGES[0],
    surfaces: [flat("launch", 0, 80, 180), moving],
    start: { surface: "launch", x: 30 },
    goal: { surface: "moving", x: 485 },
    checkpoints: [],
    hazards: [],
    coins: [],
    perfectZones: [],
  };
  const { run, events } = replay(stage, [0]);
  assert.equal(run.phase, "clear");
  assert.equal(run.stats.misses, 0);
  assert.ok(events.some((e) => e.type === "land"));
  assert.equal(run.player.surface, "moving");
});
test("a coyote tap shortly after the edge preserves the last road's tangent", () => {
  const stage = { ...STAGES[1], hazards: [] };
  const run = new ParkourRun(stage);
  while (run.player.surface) run.update(FIXED_STEP);
  run.update(0.04);
  assert.equal(run.jump(), true);
  assert.ok(run.player.vy < 0);
  assert.equal(run.stats.jumps, 1);
});

test("100 checkpoint retries keep the banked route and discard failed excursions without trace growth", () => {
  const run = new ParkourRun(STAGES[3]);
  run.update(1.45);
  run.jump();
  for (let i = 0; i < 600 && run.checkpoint === "start"; i++)
    run.update(FIXED_STEP);
  assert.equal(run.checkpoint, "low-route");
  const bankedTrace = run.trace.map((point) => ({ ...point }));
  assert.ok(bankedTrace.some((point) => point.air));
  assert.ok(bankedTrace.at(-1)!.x >= 740);
  for (let retry = 0; retry < 100; retry++) {
    for (let i = 0; i < 600 && run.phase === "playing"; i++)
      run.update(FIXED_STEP);
    assert.equal(run.phase, "miss");
    assert.ok(run.trace.length > bankedTrace.length);
    run.update(RESPAWN_SECONDS);
    assert.equal(run.phase, "playing");
    assert.equal(run.trace.length, bankedTrace.length + 1);
    assert.deepEqual(run.trace.slice(0, bankedTrace.length), bankedTrace);
    assert.deepEqual(run.trace.at(-1), {
      x: 740,
      y: 75.6,
      air: false,
      break: true,
    });
    run.consumeEvents();
  }
  // The successful final attempt still extends the entire banked first leg.
  for (let i = 0; i < 100 && run.player.x < 855; i++) run.update(FIXED_STEP);
  assert.equal(run.jump(), true);
  for (let i = 0; i < 600 && run.phase !== "clear"; i++) run.update(FIXED_STEP);
  assert.equal(run.phase, "clear");
  assert.deepEqual(run.trace.slice(0, bankedTrace.length), bankedTrace);
  assert.ok(run.trace.at(-1)!.x >= run.stage.goal.x - 10);
  assert.equal(run.trace.filter((point) => point.break).length, 2);
});

test("100 retries before a checkpoint preserve the initial point and one respawn break", () => {
  const run = new ParkourRun(STAGES[0]);
  const initial = { ...run.trace[0] };
  for (let retry = 0; retry < 100; retry++) {
    for (let i = 0; i < 600 && run.phase === "playing"; i++)
      run.update(FIXED_STEP);
    assert.equal(run.phase, "miss");
    run.update(RESPAWN_SECONDS);
    assert.equal(run.trace.length, 2);
    assert.deepEqual(run.trace[0], initial);
    assert.equal(run.trace[1].break, true);
    run.consumeEvents();
  }
});
