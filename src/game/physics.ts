import { JumpInputBuffer, INPUT_GUARD_SECONDS } from "./input";
import type { StageData } from "./stage";
import {
  sampleSurface,
  segmentDistance,
  surfaceMotion,
  surfaceRange,
  tangentVelocity,
  type Point,
  type SurfaceData,
} from "./trajectory";
export const RUN_SPEED = 195;
export const JUMP_SPEED = 420;
export const GRAVITY = 390;
export const FIXED_STEP = 1 / 120;
export const COYOTE_SECONDS = 0.1;
export const RESPAWN_SECONDS = 0.5;
const LANDING_MARGIN = 16;
const FOOT_TOLERANCE = 8;
export type RunPhase = "playing" | "miss" | "clear";
export type ParkourPlayer = Point & {
  vx: number;
  vy: number;
  angle: number;
  surface: string | null;
};
export type RunStats = {
  time: number;
  coins: number;
  jumps: number;
  perfects: number;
  perfectLandings: number;
  combo: number;
  maxCombo: number;
  misses: number;
  score: number;
  lastSlope: number;
  lastJumpX: number;
};
export type TracePoint = Point & { air: boolean; break?: boolean };
export type RunEvent = Point & {
  type:
    | "jump"
    | "perfect"
    | "land"
    | "coin"
    | "checkpoint"
    | "miss"
    | "respawn"
    | "clear";
  slope?: number;
};
type CheckpointSnapshot = {
  surface: string;
  x: number;
  collected: Set<string>;
  score: number;
  traceLength: number;
};

/** Browser-independent simulation: rendering, sound and menus consume its events. */
export class ParkourRun {
  phase: RunPhase = "playing";
  player: ParkourPlayer = { x: 0, y: 0, vx: 0, vy: 0, angle: 0, surface: null };
  stats: RunStats = this.emptyStats();
  trace: TracePoint[] = [];
  collected = new Set<string>();
  checkpoint = "start";
  /** Unpenalized simulation seconds, also used by moving surfaces. */
  clock = 0;
  input = new JumpInputBuffer();
  private events: RunEvent[] = [];
  private accumulator = 0;
  private missRemaining = 0;
  private airAge = 0;
  private coyote = 0;
  private lastSlope = 0;
  private lastJump = -10;
  private launchSurface: string | null = null;
  private save: CheckpointSnapshot;

  constructor(public stage: StageData) {
    this.save = {
      ...stage.start,
      collected: new Set(),
      score: 0,
      traceLength: 0,
    };
    this.reset();
  }
  private emptyStats(): RunStats {
    return {
      time: 0,
      coins: 0,
      jumps: 0,
      perfects: 0,
      perfectLandings: 0,
      combo: 0,
      maxCombo: 0,
      misses: 0,
      score: 0,
      lastSlope: 0,
      lastJumpX: 0,
    };
  }
  reset() {
    this.phase = "playing";
    this.stats = this.emptyStats();
    this.clock = 0;
    this.accumulator = 0;
    this.collected = new Set();
    this.checkpoint = "start";
    this.save = {
      ...this.stage.start,
      collected: new Set(),
      score: 0,
      traceLength: 0,
    };
    this.events = [];
    this.trace = [];
    this.input.clear();
    this.lastJump = -10;
    this.missRemaining = 0;
    this.spawn(this.stage.start.surface, this.stage.start.x);
    this.addTrace(true);
    this.save.traceLength = this.trace.length;
  }
  private surface(id: string | null): SurfaceData | undefined {
    return this.stage.surfaces.find((s) => s.id === id);
  }
  private spawn(surfaceId: string, x: number) {
    const road = this.surface(surfaceId);
    if (!road)
      throw new Error(`Unknown surface ${surfaceId} in stage ${this.stage.id}`);
    const sample = sampleSurface(road, x, this.clock);
    const velocity = tangentVelocity(sample.slope, RUN_SPEED);
    this.player = {
      x,
      y: sample.y,
      vx: velocity.x,
      vy: velocity.y,
      angle: Math.atan(sample.slope),
      surface: road.id,
    };
    this.lastSlope = sample.slope;
    this.launchSurface = null;
    this.airAge = 0;
    this.coyote = 0;
  }
  clearInput() {
    this.input.clear();
  }
  consumeEvents(): RunEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
  private emit(type: RunEvent["type"], slope?: number) {
    this.events.push({
      type,
      x: this.player.x,
      y: this.player.y,
      ...(slope === undefined ? {} : { slope }),
    });
  }
  /** Returns true only if this tap launches now; airborne taps are buffered. */
  jump(): boolean {
    if (this.phase !== "playing") return false;
    if (
      (this.player.surface !== null || this.coyote > 0) &&
      this.clock - this.lastJump >= INPUT_GUARD_SECONDS
    ) {
      this.launch();
      return true;
    }
    this.input.queue(this.clock);
    return false;
  }
  private launch() {
    const p = this.player;
    const road = this.surface(p.surface);
    const slope = road
      ? sampleSurface(road, p.x, this.clock).slope
      : this.lastSlope;
    const velocity = tangentVelocity(slope, JUMP_SPEED);
    const perfect =
      !!road &&
      this.stage.perfectZones.some(
        (z) => z.surface === road.id && Math.abs(z.x - p.x) <= z.tolerance,
      );
    this.input.clear();
    this.launchSurface = p.surface;
    p.surface = null;
    p.vx = velocity.x;
    p.vy = velocity.y;
    p.angle = Math.atan(slope);
    this.lastSlope = slope;
    this.lastJump = this.clock;
    this.airAge = 0;
    this.coyote = 0;
    this.stats.jumps++;
    this.stats.lastSlope = slope;
    this.stats.lastJumpX = p.x;
    this.emit("jump", slope);
    if (perfect) {
      this.stats.perfects++;
      this.combo(250);
      this.emit("perfect", slope);
    }
    this.addTrace();
  }
  private combo(points: number) {
    this.stats.combo++;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
    this.stats.score += points + Math.min(5, this.stats.combo - 1) * 40;
  }
  update(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0 || this.phase === "clear") return;
    this.accumulator += dt;
    while (this.accumulator + 1e-10 >= FIXED_STEP) {
      this.accumulator -= FIXED_STEP;
      this.step(FIXED_STEP);
      if ((this.phase as RunPhase) === "clear") break;
    }
  }
  private step(dt: number) {
    this.clock += dt;
    this.stats.time += dt;
    if (this.phase === "miss") {
      this.missRemaining -= dt;
      if (this.missRemaining <= 1e-9) this.respawn();
      return;
    }
    if (
      this.input.consume(
        this.clock,
        (this.player.surface !== null || this.coyote > 0) &&
          this.clock - this.lastJump >= INPUT_GUARD_SECONDS,
      )
    )
      this.launch();
    const p = this.player;
    const previous = { x: p.x, y: p.y };
    const road = this.surface(p.surface);
    if (road) {
      const oldMotion = surfaceMotion(road, this.clock - dt);
      const newMotion = surfaceMotion(road, this.clock);
      const sample = sampleSurface(road, p.x, this.clock - dt);
      const velocity = tangentVelocity(sample.slope, RUN_SPEED);
      p.x += velocity.x * dt + newMotion.x - oldMotion.x;
      const next = sampleSurface(road, p.x, this.clock);
      p.y = next.y;
      p.vx = velocity.x;
      p.vy = velocity.y + (newMotion.y - oldMotion.y) / dt;
      p.angle = Math.atan(next.slope);
      this.lastSlope = next.slope;
      if (p.x > surfaceRange(road, this.clock).end + 1) {
        p.surface = null;
        this.coyote = COYOTE_SECONDS;
        this.airAge = 0;
        this.launchSurface = road.id;
      }
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
      this.airAge += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt - 0.5 * GRAVITY * dt * dt;
      p.vy -= GRAVITY * dt;
      p.angle += (Math.atan2(p.vy, p.vx) - p.angle) * (1 - Math.exp(-12 * dt));
      this.land(previous, dt);
    }
    if (this.collides(previous)) {
      this.miss();
      return;
    }
    this.collect(previous);
    this.checkCheckpoints(previous.x);
    this.addTrace();
    if (
      p.surface === this.stage.goal.surface &&
      p.x >= this.stage.goal.x - 10
    ) {
      this.addTrace(false, true);
      this.phase = "clear";
      this.input.clear();
      this.stats.score +=
        1000 +
        Math.max(0, Math.round((this.stage.parTime - this.stats.time) * 100));
      this.emit("clear");
    } else if (
      p.y < this.stage.bounds.minY ||
      p.x > Math.max(...this.stage.surfaces.map((s) => s.end)) + 120
    )
      this.miss();
    // A buffered tap fires on the landing step, instead of waiting another frame.
    if (
      this.phase === "playing" &&
      this.input.consume(
        this.clock,
        p.surface !== null && this.clock - this.lastJump >= INPUT_GUARD_SECONDS,
      )
    )
      this.launch();
  }
  private land(previous: Point, dt: number) {
    const p = this.player;
    let landing:
      | {
          road: SurfaceData;
          x: number;
          y: number;
          slope: number;
          fraction: number;
        }
      | undefined;
    for (const road of this.stage.surfaces) {
      // A launch detaches from its one-way road until its far edge is passed.
      // This prevents a tangent with gravity from immediately sticking back
      // to a flatter section of the same curve.
      if (
        road.id === this.launchSurface &&
        previous.x <= surfaceRange(road, this.clock).end + LANDING_MARGIN
      )
        continue;
      const range = surfaceRange(road, this.clock);
      if (
        p.x < range.start - LANDING_MARGIN ||
        previous.x > range.end + LANDING_MARGIN
      )
        continue;
      const oldRange = surfaceRange(road, this.clock - dt);
      const clamp = (x: number, r: { start: number; end: number }) =>
        Math.max(r.start, Math.min(r.end, x));
      const old = sampleSurface(
        road,
        clamp(previous.x, oldRange),
        this.clock - dt,
      );
      const next = sampleSurface(road, clamp(p.x, range), this.clock);
      const oldHeight = previous.y - old.y;
      const newHeight = p.y - next.y;
      const motionVy =
        (surfaceMotion(road, this.clock).y -
          surfaceMotion(road, this.clock - dt).y) /
        dt;
      if (
        p.vy - next.slope * p.vx - motionVy >= 0 ||
        oldHeight < -FOOT_TOLERANCE ||
        newHeight > FOOT_TOLERANCE
      )
        continue;
      const fraction = Math.max(
        0,
        Math.min(1, oldHeight / (oldHeight - newHeight || 1)),
      );
      const x = previous.x + (p.x - previous.x) * fraction;
      if (x < range.start - LANDING_MARGIN || x > range.end + LANDING_MARGIN)
        continue;
      const actualX = clamp(p.x, range);
      const sample = sampleSurface(road, actualX, this.clock);
      if (!landing || fraction < landing.fraction)
        landing = {
          road,
          x: actualX,
          y: sample.y,
          slope: sample.slope,
          fraction,
        };
    }
    if (!landing) return;
    const impactAngle = Math.atan2(p.vy, p.vx);
    const perfect =
      this.airAge > 0.35 &&
      Math.abs(impactAngle - Math.atan(landing.slope)) < 0.75 &&
      p.x > surfaceRange(landing.road, this.clock).start + 22;
    p.x = landing.x;
    p.y = landing.y;
    p.surface = landing.road.id;
    const velocity = tangentVelocity(landing.slope, RUN_SPEED);
    p.vx = velocity.x;
    p.vy = velocity.y;
    p.angle = Math.atan(landing.slope);
    this.lastSlope = landing.slope;
    this.coyote = 0;
    this.emit("land", landing.slope);
    if (perfect) {
      this.stats.perfectLandings++;
      this.combo(150);
    }
  }
  private collides(previous: Point) {
    const center = (p: Point): Point => ({ x: p.x, y: p.y + 23 });
    const a = center(previous),
      b = center(this.player);
    return this.stage.hazards.some((h) => {
      const minX = h.x - h.width / 2 - 9,
        maxX = h.x + h.width / 2 + 9;
      const minY = h.y - 9,
        maxY = h.y + h.height + 9;
      let near = 0,
        far = 1;
      for (const [start, distance, min, max] of [
        [a.x, b.x - a.x, minX, maxX],
        [a.y, b.y - a.y, minY, maxY],
      ]) {
        if (Math.abs(distance) < 1e-9) {
          if (start < min || start > max) return false;
        } else {
          const t1 = (min - start) / distance,
            t2 = (max - start) / distance;
          near = Math.max(near, Math.min(t1, t2));
          far = Math.min(far, Math.max(t1, t2));
          if (near > far) return false;
        }
      }
      return true;
    });
  }
  private collect(previous: Point) {
    const a = { x: previous.x, y: previous.y + 25 },
      b = { x: this.player.x, y: this.player.y + 25 };
    for (const coin of this.stage.coins) {
      if (!this.collected.has(coin.id) && segmentDistance(coin, a, b) < 28) {
        this.collected.add(coin.id);
        this.stats.coins = this.collected.size;
        this.stats.score += 100;
        this.events.push({ type: "coin", x: coin.x, y: coin.y });
      }
    }
  }
  private checkCheckpoints(previousX: number) {
    for (const cp of this.stage.checkpoints) {
      if (
        this.player.surface === cp.surface &&
        previousX <= cp.x &&
        this.player.x >= cp.x &&
        cp.x > this.save.x
      ) {
        this.checkpoint = cp.id;
        // Bank the crossing point too, even if it is closer than the usual
        // trace spacing, so a retry keeps the complete accepted route.
        this.addTrace(false, true);
        this.save = {
          surface: cp.surface,
          x: cp.x,
          collected: new Set(this.collected),
          score: this.stats.score,
          traceLength: this.trace.length,
        };
        this.emit("checkpoint");
      }
    }
  }
  private miss() {
    this.phase = "miss";
    this.missRemaining = RESPAWN_SECONDS;
    this.stats.misses++;
    this.stats.time += 1;
    this.stats.combo = 0;
    this.input.clear();
    this.addTrace();
    this.emit("miss");
  }
  private respawn() {
    this.phase = "playing";
    this.collected = new Set(this.save.collected);
    this.stats.coins = this.collected.size;
    this.stats.score = this.save.score;
    this.input.clear();
    // Failed excursions are visible during MISS, then discarded on retry.
    // Only the accepted start-to-checkpoint path and current attempt remain.
    this.trace.splice(this.save.traceLength);
    this.spawn(this.save.surface, this.save.x);
    this.addTrace(true);
    this.emit("respawn");
  }
  private addTrace(breakPath = false, force = false) {
    const last = this.trace.at(-1);
    if (
      !breakPath &&
      !force &&
      last &&
      Math.hypot(last.x - this.player.x, last.y - this.player.y) < 3
    )
      return;
    this.trace.push({
      x: this.player.x,
      y: this.player.y,
      air: this.player.surface === null,
      ...(breakPath ? { break: true } : {}),
    });
  }
}
