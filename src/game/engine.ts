import { AudioFx } from "./audio";
import { fitViewport, WORLD_HEIGHT } from "./viewport";
import { STAGES } from "./stage";
import { ParkourRun, type RunEvent } from "./physics";
import {
  sampleSurface,
  surfaceRange,
  type Point,
  type SurfaceData,
} from "./trajectory";
import { loadRecords, saveRun } from "./records";

export type Phase =
  "ready" | "select" | "playing" | "paused" | "miss" | "clear";
export type Snapshot = {
  phase: Phase;
  stage: number;
  time: number;
  coins: number;
  totalCoins: number;
  jumps: number;
  perfects: number;
  perfectLandings: number;
  combo: number;
  maxCombo: number;
  misses: number;
  score: number;
  bestTime: number | null;
  newBest: boolean;
  lastSlope: number;
  lastJumpX: number;
  progress: number;
  event: string;
};
export const INITIAL: Snapshot = {
  phase: "ready",
  stage: 0,
  time: 0,
  coins: 0,
  totalCoins: STAGES[0].coins.length,
  jumps: 0,
  perfects: 0,
  perfectLandings: 0,
  combo: 0,
  maxCombo: 0,
  misses: 0,
  score: 0,
  bestTime: null,
  newBest: false,
  lastSlope: 0,
  lastJumpX: 0,
  progress: 0,
  event: "",
};
type Particle = Point & {
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
};
type Label = Point & { text: string; life: number; color: string };
type TangentFlash = Point & { slope: number; life: number };

// Browser lifecycle, camera, audio and Canvas presentation. Gameplay is owned
// by the deterministic DOM-free ParkourRun; all stages share the same rules.
export class Game {
  state: Snapshot = { ...INITIAL };
  run = new ParkourRun(STAGES[0]);
  audio = new AudioFx();
  width = 1160;
  height = WORLD_HEIGHT;
  camera = { x: 0, y: 0, zoom: 1 };
  particles: Particle[] = [];
  labels: Label[] = [];
  tangent: TangentFlash | null = null;
  hint = false;
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private ctx: CanvasRenderingContext2D;
  private observer: ResizeObserver;
  private frame = 0;
  private previous = 0;
  private accumulator = 0;
  private publish = 0;
  private tick = 0;
  private shake = 0;
  private slow = 0;
  private eventAge = 0;
  private disposed = false;
  private controlsBlocked = false;
  private clearBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null = null;
  private onPointer = (e: PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary) return;
    if (this.state.phase === "playing") {
      e.preventDefault();
      this.jump();
    }
  };
  private onKey = (e: KeyboardEvent) => {
    if (this.controlsBlocked) return;
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    const phase = this.state.phase;
    if (
      (e.code === "Space" || e.code === "ArrowUp") &&
      phase === "playing" &&
      !(e.target instanceof HTMLButtonElement)
    ) {
      e.preventDefault();
      if (!e.repeat) this.jump();
    }
    if (
      (e.code === "Escape" || e.code === "KeyP") &&
      ["playing", "paused", "miss"].includes(phase)
    ) {
      e.preventDefault();
      if (!e.repeat) this.togglePause();
    }
    if (
      e.code === "KeyR" &&
      ["playing", "paused", "miss", "clear"].includes(phase)
    ) {
      e.preventDefault();
      if (!e.repeat) this.start(this.state.stage);
    }
  };
  private onVisibility = () => {
    if (document.hidden) this.pause();
  };

  constructor(
    private canvas: HTMLCanvasElement,
    private notify: (s: Snapshot) => void,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas);
    this.resize();
    window.addEventListener("keydown", this.onKey);
    document.addEventListener("visibilitychange", this.onVisibility);
    canvas.addEventListener("pointerdown", this.onPointer);
    this.frame = requestAnimationFrame(this.loop);
  }
  private resize = () => {
    const box = this.canvas.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return;
    const viewport = fitViewport(box.width, box.height);
    this.width = viewport.width;
    this.height = viewport.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(box.width * dpr);
    this.canvas.height = Math.round(box.height * dpr);
  };
  setReducedMotion(value: boolean) {
    this.reduced = value;
    this.shake = 0;
    this.slow = 0;
  }
  setHint(value: boolean) {
    this.hint = value;
  }
  setControlsBlocked(value: boolean) {
    this.controlsBlocked = value;
    if (value) this.run.input.clear();
  }
  select() {
    this.state.phase = "select";
    this.clearTransient();
    this.emit();
  }
  returnToTitle() {
    this.state.phase = "ready";
    this.clearTransient();
    this.emit();
  }
  start(index = 0) {
    this.audio.unlock();
    const stage = STAGES[Math.max(0, Math.min(STAGES.length - 1, index))];
    this.run = new ParkourRun(stage);
    this.clearBounds = null;
    this.state = {
      ...INITIAL,
      phase: "playing",
      stage: STAGES.indexOf(stage),
      totalCoins: stage.coins.length,
      bestTime: loadRecords()[stage.id]?.bestTime ?? null,
    };
    this.clearTransient();
    this.hint = false;
    this.camera = {
      x: this.run.player.x - this.width * 0.36,
      y: this.run.player.y,
      zoom: 1,
    };
    this.emit();
  }
  private clearTransient() {
    this.particles = [];
    this.labels = [];
    this.tangent = null;
    this.accumulator = 0;
    this.shake = 0;
    this.slow = 0;
    this.eventAge = 0;
    this.run.input.clear();
  }
  jump() {
    if (this.state.phase !== "playing" || this.controlsBlocked) return;
    this.audio.unlock();
    this.run.jump();
    this.processEvents();
    this.emit();
  }
  pause() {
    if (this.state.phase === "playing" || this.state.phase === "miss") {
      this.state.phase = "paused";
      this.run.input.clear();
      this.accumulator = 0;
      this.shake = 0;
      this.slow = 0;
      this.emit();
    }
  }
  togglePause() {
    if (this.state.phase === "paused") {
      this.state.phase = this.run.phase;
      this.accumulator = 0;
      this.emit();
    } else this.pause();
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    window.removeEventListener("keydown", this.onKey);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.canvas.removeEventListener("pointerdown", this.onPointer);
    this.audio.dispose();
  }
  emit() {
    if (!["ready", "select"].includes(this.state.phase)) {
      Object.assign(this.state, this.run.stats);
      this.state.progress = Math.max(
        0,
        Math.min(
          1,
          (this.run.player.x - this.run.stage.start.x) /
            (this.run.stage.goal.x - this.run.stage.start.x),
        ),
      );
    }
    this.notify({ ...this.state });
  }
  private loop = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - (this.previous || now)) / 1000);
    this.previous = now;
    if (this.state.phase !== "paused") this.tick += dt;
    if (["playing", "miss"].includes(this.state.phase)) {
      this.accumulator += dt * (this.slow > 0 && !this.reduced ? 0.45 : 1);
      while (this.accumulator >= 1 / 120) {
        this.run.update(1 / 120);
        this.accumulator -= 1 / 120;
        this.processEvents();
        this.state.phase = this.run.phase;
        if (this.run.phase === "clear") {
          this.accumulator = 0;
          break;
        }
      }
    }
    this.slow = Math.max(0, this.slow - dt);
    this.shake = Math.max(0, this.shake - dt * 28);
    if (this.state.phase !== "paused") this.eventAge -= dt;
    if (this.eventAge <= 0) this.state.event = "";
    if (this.state.phase !== "paused") {
      this.particles.forEach((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy -= 210 * dt;
        p.life -= dt;
      });
      this.labels.forEach((l) => {
        l.life -= dt;
        l.y += dt * 24;
      });
      this.particles = this.particles.filter((p) => p.life > 0);
      this.labels = this.labels.filter((l) => l.life > 0);
      if (this.tangent) {
        this.tangent.life -= dt;
        if (this.tangent.life <= 0) this.tangent = null;
      }
    }
    this.updateCamera(dt);
    this.render();
    this.publish += dt;
    if (this.publish > 0.06) {
      this.publish = 0;
      this.emit();
    }
    this.frame = requestAnimationFrame(this.loop);
  };
  private processEvents() {
    for (const e of this.run.consumeEvents()) this.effect(e);
  }
  private effect(e: RunEvent) {
    const accent = this.run.stage.theme.accent;
    if (e.type === "jump") {
      this.tangent = { x: e.x, y: e.y, slope: e.slope ?? 0, life: 0.34 };
      this.shake = this.reduced ? 0 : 3;
      this.slow = 0.065;
      this.audio.play("skill", Math.min(3, Math.abs(e.slope ?? 0)));
      this.burst(e, 12, accent);
    }
    if (e.type === "perfect") {
      this.slow = 0.14;
      this.shake = this.reduced ? 0 : 5;
      this.audio.play("hit", 5);
      this.burst(e, 22, "#faff9d");
      this.message("PERFECT TANGENT!");
    }
    if (e.type === "land") {
      this.burst(e, 10, accent);
      this.audio.play("hit", 0);
    }
    if (e.type === "coin") {
      this.burst(e, 7, "#ffce75");
      this.audio.play("hit", 2);
    }
    if (e.type === "checkpoint") {
      this.label(e, "CHECKPOINT", accent);
      this.message("CHECKPOINT SAVED");
      this.audio.play("hit", 3);
    }
    if (e.type === "miss") {
      this.message("MISS!");
      this.burst(e, 22, "#ff725a");
      this.audio.play("hurt");
      this.shake = this.reduced ? 0 : 7;
    }
    if (e.type === "respawn") {
      this.message("GO AGAIN →");
      this.tangent = null;
      // A quick retry must begin on screen, even after falling far ahead.
      this.camera = { x: e.x - this.width * 0.36, y: e.y, zoom: 1 };
    }
    if (e.type === "clear") {
      const { record, newBest } = saveRun(
        this.run.stage.id,
        this.run.stats.time,
        this.run.stats.score,
      );
      this.state.bestTime = record.bestTime;
      this.state.newBest = newBest;
      this.audio.play("clear");
      this.burst(e, 42, "#ffce75");
      this.emit();
    }
  }
  private message(value: string) {
    this.state.event = value;
    this.eventAge = 0.9;
  }
  private label(p: Point, text: string, color: string) {
    this.labels.push({ ...p, y: p.y + 65, text, color, life: 1 });
  }
  private burst(p: Point, count: number, color: string) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2,
        speed = 40 + Math.random() * 150,
        life = 0.25 + Math.random() * 0.45;
      this.particles.push({
        ...p,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        max: life,
        color,
        size: 1.5 + Math.random() * 2,
      });
    }
  }
  private updateCamera(dt: number) {
    if (["ready", "select", "paused"].includes(this.state.phase)) return;
    let x = this.run.player.x - (this.width * 0.36) / this.camera.zoom,
      y = this.run.player.y;
    let zoom = this.run.player.surface ? 1 : 0.91;
    if (this.state.phase === "clear") {
      if (!this.clearBounds) {
        let minX = this.run.stage.start.x - 65,
          maxX = this.run.stage.goal.x + 65,
          minY = Infinity,
          maxY = -Infinity;
        for (const p of this.run.trace) {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y - 60);
          maxY = Math.max(maxY, p.y + 80);
        }
        this.clearBounds = { minX, maxX, minY, maxY };
      }
      const { minX, maxX, minY, maxY } = this.clearBounds;
      zoom = Math.min(
        (this.width * 0.6) / (maxX - minX),
        (this.height * 0.6) / (maxY - minY),
        0.9,
      );
      x = minX - (this.width * 0.035) / zoom;
      y = (maxY + minY) / 2 + (this.height * 0.5 - this.height * 0.66) / zoom;
    }
    const follow = this.reduced
      ? 1
      : 1 - Math.exp(-(this.state.phase === "clear" ? 3 : 7) * dt);
    this.camera.x += (x - this.camera.x) * follow;
    this.camera.y += (y - this.camera.y) * follow;
    this.camera.zoom += (zoom - this.camera.zoom) * follow;
  }
  private world(p: Point): Point {
    return {
      x: (p.x - this.camera.x) * this.camera.zoom,
      y: this.height * 0.66 - (p.y - this.camera.y) * this.camera.zoom,
    };
  }
  private render() {
    const c = this.ctx;
    c.setTransform(
      this.canvas.width / this.width,
      0,
      0,
      this.canvas.height / this.height,
      0,
      0,
    );
    c.clearRect(0, 0, this.width, this.height);
    c.lineCap = "round";
    c.lineJoin = "round";
    this.background();
    c.save();
    if (!this.reduced && this.shake > 0)
      c.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
      );
    if (["ready", "select"].includes(this.state.phase)) this.preview();
    else this.scene();
    c.restore();
  }
  private background() {
    const c = this.ctx,
      w = this.width,
      h = this.height,
      theme = this.run.stage.theme;
    const gradient = c.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, theme.sky);
    gradient.addColorStop(1, "#101620");
    c.fillStyle = gradient;
    c.fillRect(0, 0, w, h);
    const sunX = w * 0.79 - ((this.camera.x * 0.015) % 70);
    c.strokeStyle = theme.secondary + "26";
    c.lineWidth = 1;
    c.beginPath();
    c.arc(sunX, 100, 65, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = theme.secondary + "0c";
    c.beginPath();
    c.arc(sunX, 100, 52, 0, Math.PI * 2);
    c.fill();
    // Original procedural Seoul skyline, with its two parallax layers retained.
    for (let layer = 0; layer < 2; layer++) {
      const step = layer === 0 ? 107 : 166,
        factor = layer === 0 ? 0.12 : 0.27,
        offset = (this.camera.x * factor) % step;
      for (let i = -2; i < w / step + 2; i++) {
        const idx = i + Math.floor((this.camera.x * factor) / step),
          bh = 50 + ((((idx * 71 + 377) % 120) + 120) % 120);
        const x = i * step - offset,
          y = h - bh;
        c.fillStyle = layer === 0 ? "#1b243354" : "#0a101ba0";
        c.fillRect(x, y, step - 17, bh);
        c.fillRect(x - 3, y, step - 11, 3);
        if (layer === 1) {
          c.fillStyle = theme.accent + "12";
          for (let wx = x + 13; wx < x + step - 25; wx += 25)
            for (let wy = y + 18; wy < h; wy += 25) c.fillRect(wx, wy, 5, 8);
        }
      }
    }
    for (let i = 0; i < 32; i++) {
      const x = (((i * 137 + 61 - this.camera.x * 0.025) % w) + w) % w,
        y = 30 + ((i * 53) % 300);
      c.fillStyle = i % 3 ? "#ffffff18" : theme.accent + "45";
      c.fillRect(x, y, 1.5, 1.5);
    }
  }
  private preview() {
    const c = this.ctx,
      w = this.width,
      h = this.height,
      start = w * 0.5;
    c.strokeStyle = "#79ead64c";
    c.lineWidth = 5;
    c.shadowColor = "#79ead6";
    c.shadowBlur = 18;
    c.beginPath();
    for (let x = start; x <= w + 20; x += 3) {
      const t = (x - start) / (w * 0.55),
        y = h * 0.74 - (t * t * 160 - t * 70);
      if (x === start) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
    c.shadowBlur = 0;
    c.strokeStyle = "#ff795cb0";
    c.lineWidth = 2.5;
    c.setLineDash([3, 7]);
    c.beginPath();
    c.moveTo(w * 0.67, h * 0.74);
    c.quadraticCurveTo(w * 0.83, h * 0.33, w * 0.99, h * 0.59);
    c.stroke();
    c.setLineDash([]);
    this.runner({ x: w * 0.76, y: h * 0.7 }, -0.27, true, 1.7);
    c.fillStyle = "#79ead6";
    c.font = "700 10px monospace";
    c.fillText("YOUR TIMING. YOUR TRAJECTORY.", w * 0.59, h * 0.88);
  }
  private scene() {
    const c = this.ctx,
      stage = this.run.stage;
    for (const s of stage.surfaces) this.surface(s);
    this.trace();
    for (const checkpoint of stage.checkpoints) {
      const s = stage.surfaces.find((s) => s.id === checkpoint.surface)!,
        y = sampleSurface(s, checkpoint.x, this.run.clock).y;
      const p = this.world({ x: checkpoint.x, y });
      c.strokeStyle = "#79ead6";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(p.x, p.y - 34);
      c.stroke();
      c.fillStyle =
        this.run.checkpoint === checkpoint.id ? "#79ead6" : "#79ead65c";
      c.beginPath();
      c.moveTo(p.x, p.y - 34);
      c.lineTo(p.x + 19, p.y - 27);
      c.lineTo(p.x, p.y - 20);
      c.fill();
    }
    for (const coin of stage.coins) {
      if (this.run.collected.has(coin.id)) continue;
      const p = this.world(coin),
        r = Math.max(4, 9 * this.camera.zoom);
      c.save();
      c.translate(p.x, p.y);
      c.rotate(Math.PI / 4);
      c.fillStyle = "#ffcb75";
      c.shadowColor = "#ffcb75";
      c.shadowBlur = 14;
      c.strokeStyle = "#fff5d8";
      c.lineWidth = 1.5;
      c.fillRect(-r / 2, -r / 2, r, r);
      c.strokeRect(-r / 2, -r / 2, r, r);
      c.restore();
    }
    for (const hazard of stage.hazards) {
      const p = this.world({ x: hazard.x - hazard.width / 2, y: hazard.y }),
        z = this.camera.zoom;
      c.fillStyle = "#ff625933";
      c.strokeStyle = "#ff725a";
      c.lineWidth = 2;
      if (hazard.kind === "spikes") {
        const count = Math.max(1, Math.round(hazard.width / 16));
        c.beginPath();
        for (let i = 0; i < count; i++) {
          const x = p.x + ((hazard.width * i) / count) * z;
          c.moveTo(x, p.y);
          c.lineTo(
            x + ((hazard.width / count) * z) / 2,
            p.y - hazard.height * z,
          );
          c.lineTo(x + (hazard.width / count) * z, p.y);
        }
        c.fill();
        c.stroke();
      } else {
        c.fillRect(
          p.x,
          p.y - hazard.height * z,
          hazard.width * z,
          hazard.height * z,
        );
        c.strokeRect(
          p.x,
          p.y - hazard.height * z,
          hazard.width * z,
          hazard.height * z,
        );
        c.save();
        c.beginPath();
        c.rect(
          p.x,
          p.y - hazard.height * z,
          hazard.width * z,
          hazard.height * z,
        );
        c.clip();
        for (let k = -hazard.height; k < hazard.width; k += 16) {
          c.beginPath();
          c.moveTo(p.x + k * z, p.y);
          c.lineTo(p.x + (k + hazard.height) * z, p.y - hazard.height * z);
          c.stroke();
        }
        c.restore();
      }
    }
    const goalSurface = stage.surfaces.find(
      (s) => s.id === stage.goal.surface,
    )!;
    const g = this.world({
      x: stage.goal.x,
      y: sampleSurface(goalSurface, stage.goal.x, this.run.clock).y + 28,
    });
    c.strokeStyle = "#faff9d";
    c.lineWidth = Math.max(2, 3 * this.camera.zoom);
    c.shadowColor = "#faff9d";
    c.shadowBlur = 20;
    c.beginPath();
    c.ellipse(
      g.x,
      g.y,
      14 * this.camera.zoom,
      30 * this.camera.zoom,
      0,
      0,
      Math.PI * 2,
    );
    c.stroke();
    c.shadowBlur = 0;
    if (this.camera.zoom > 0.6) {
      c.fillStyle = "#faff9d";
      c.font = "700 9px monospace";
      c.fillText("FINISH", g.x - 19, g.y - 43);
    }
    const player = this.run.player;
    const guide =
      player.surface &&
      (stage.guide === "always" ||
        this.hint ||
        (stage.guide === "pulse" && this.run.clock % 2.5 < 0.8));
    if (guide) {
      const s = stage.surfaces.find((s) => s.id === player.surface)!;
      this.drawTangent(
        player,
        sampleSurface(s, player.x, this.run.clock).slope,
        0.34,
        110,
      );
    }
    if (this.tangent)
      this.drawTangent(
        this.tangent,
        this.tangent.slope,
        Math.min(1, this.tangent.life * 4),
        155,
      );
    if (this.state.phase !== "miss")
      this.runner(
        this.world(player),
        -player.angle,
        Boolean(player.surface),
        this.camera.zoom,
      );
    for (const p of this.particles) {
      const pos = this.world(p);
      c.globalAlpha = p.life / p.max;
      c.fillStyle = p.color;
      c.fillRect(pos.x, pos.y, p.size, p.size);
    }
    c.globalAlpha = 1;
    for (const l of this.labels) {
      const pos = this.world(l);
      c.globalAlpha = Math.min(1, l.life * 3);
      c.font = "900 17px sans-serif";
      c.textAlign = "center";
      c.fillStyle = l.color;
      c.fillText(
        l.text,
        Math.max(100, Math.min(this.width - 100, pos.x)),
        Math.max(90, pos.y),
      );
    }
    c.globalAlpha = 1;
    c.textAlign = "left";
  }
  private surface(surface: SurfaceData) {
    const c = this.ctx,
      range = surfaceRange(surface, this.run.clock);
    const start = Math.max(range.start, this.camera.x - 80),
      end = Math.min(
        range.end,
        this.camera.x + this.width / this.camera.zoom + 80,
      );
    if (end <= start) return;
    const points: Point[] = [];
    for (let x = start; x < end; x += 5 / this.camera.zoom)
      points.push(
        this.world({ x, y: sampleSurface(surface, x, this.run.clock).y }),
      );
    points.push(
      this.world({ x: end, y: sampleSurface(surface, end, this.run.clock).y }),
    );
    const color = surface.color || this.run.stage.theme.accent;
    c.beginPath();
    c.moveTo(points[0].x, points[0].y);
    points.forEach((p) => c.lineTo(p.x, p.y));
    c.lineTo(points.at(-1)!.x, this.height + 20);
    c.lineTo(points[0].x, this.height + 20);
    c.closePath();
    const gradient = c.createLinearGradient(0, points[0].y, 0, this.height);
    gradient.addColorStop(0, color + "16");
    gradient.addColorStop(1, color + "00");
    c.fillStyle = gradient;
    c.fill();
    const path = () => {
      c.beginPath();
      points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    };
    path();
    c.strokeStyle = "#070d16";
    c.lineWidth = Math.max(5, 16 * this.camera.zoom);
    c.stroke();
    path();
    c.strokeStyle = color + "30";
    c.lineWidth = Math.max(4, 12 * this.camera.zoom);
    c.stroke();
    path();
    c.strokeStyle = color;
    c.lineWidth = Math.max(2, 5 * this.camera.zoom);
    c.shadowColor = color;
    c.shadowBlur = 12;
    c.stroke();
    c.shadowBlur = 0;
    path();
    c.strokeStyle = "#eafff0a0";
    c.lineWidth = Math.max(0.7, 1.1 * this.camera.zoom);
    c.stroke();
    c.fillStyle = color;
    [points[0], points.at(-1)!].forEach((p) => {
      c.beginPath();
      c.arc(p.x, p.y, 4 * this.camera.zoom, 0, Math.PI * 2);
      c.fill();
    });
    if (this.camera.zoom > 0.6)
      for (const zone of this.run.stage.perfectZones.filter(
        (z) => z.surface === surface.id,
      )) {
        const p = this.world({
          x: zone.x,
          y: sampleSurface(surface, zone.x, this.run.clock).y,
        });
        c.strokeStyle = "#faff9d50";
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(
          p.x,
          p.y,
          zone.tolerance * this.camera.zoom,
          Math.PI,
          Math.PI * 2,
        );
        c.stroke();
        const slope = sampleSurface(surface, zone.x, this.run.clock).slope;
        c.fillStyle = "#faff9d90";
        c.font = "700 8px monospace";
        c.textAlign = "center";
        c.fillText(
          Math.abs(slope) < 0.12 ? "→" : slope > 0 ? "↗" : "↘",
          p.x,
          p.y - zone.tolerance * this.camera.zoom - 10,
        );
        c.textAlign = "left";
      }
  }
  private trace() {
    const c = this.ctx,
      points = this.run.trace;
    // Full route persists; live tail retains the original multi-stroke glow.
    for (const air of [false, true])
      for (const tail of [false, true]) {
        c.beginPath();
        let previous = false;
        const start = tail ? Math.max(0, points.length - 45) : 0;
        for (let i = start; i < points.length; i++) {
          const p = points[i];
          if (
            p.x < this.camera.x - 60 ||
            p.x > this.camera.x + this.width / this.camera.zoom + 60
          ) {
            previous = false;
            continue;
          }
          const pos = this.world(p);
          if (p.break || p.air !== air) {
            previous = false;
            continue;
          }
          if (!previous) c.moveTo(pos.x, pos.y);
          else c.lineTo(pos.x, pos.y);
          previous = true;
        }
        const color = air ? "#ffcc7b" : "#79ead6";
        c.strokeStyle = color;
        c.globalAlpha = tail || this.state.phase === "clear" ? 0.95 : 0.42;
        c.lineWidth = tail ? 5 : 2.5;
        c.shadowColor = color;
        c.shadowBlur = tail ? 14 : 5;
        c.stroke();
        if (tail) {
          c.strokeStyle = "#fff9df";
          c.lineWidth = 1.3;
          c.shadowBlur = 0;
          c.stroke();
        }
      }
    c.globalAlpha = 1;
    c.shadowBlur = 0;
  }
  private drawTangent(p: Point, slope: number, alpha: number, length: number) {
    const c = this.ctx,
      n = Math.hypot(1, slope);
    const a = this.world({
      x: p.x - (length * 0.22) / n,
      y: p.y - (length * 0.22 * slope) / n,
    });
    const b = this.world({
      x: p.x + length / n,
      y: p.y + (length * slope) / n,
    });
    const center = this.world(p),
      angle = -Math.atan(slope);
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = "#faff9d";
    c.fillStyle = "#faff9d";
    c.lineWidth = 2;
    c.setLineDash([5, 5]);
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
    c.setLineDash([]);
    c.beginPath();
    c.arc(center.x, center.y, 4, 0, Math.PI * 2);
    c.fill();
    c.translate(b.x, b.y);
    c.rotate(angle);
    c.beginPath();
    c.moveTo(-9, -5);
    c.lineTo(0, 0);
    c.lineTo(-9, 5);
    c.stroke();
    c.restore();
  }
  private runner(p: Point, angle: number, run: boolean, scale: number) {
    const c = this.ctx;
    c.save();
    c.translate(p.x, p.y);
    c.scale(scale, scale);
    // Original helmet, visor, coral scarf and expressive comic stick limbs.
    c.rotate(Math.max(-1.25, Math.min(1.25, angle)) * 0.65);
    c.translate(0, -28);
    const swing = run ? Math.sin(this.tick * 20) * 12 : 0;
    if (this.tangent && this.tangent.life > 0.26 && !this.reduced)
      c.scale(0.86, 1.14);
    c.strokeStyle = "#f1f4e8";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(0, -14);
    c.lineTo(-3, 6);
    c.lineTo(-14 - swing * 0.5, 24);
    c.lineTo(-24 - swing * 0.5, 23);
    c.moveTo(-3, 6);
    c.lineTo(11 + swing * 0.5, 15);
    c.lineTo(16 + swing * 0.5, 28);
    c.moveTo(-1, -8);
    c.lineTo(12, -5 - swing * 0.5);
    c.lineTo(25, -16 - swing * 0.25);
    c.moveTo(-1, -8);
    c.lineTo(-17, swing * 0.3);
    c.lineTo(-23, -8 + swing * 0.5);
    c.stroke();
    c.strokeStyle = "#ff795c";
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(0, -17);
    c.bezierCurveTo(-15, -20, -23, -8, -42, -18 + Math.sin(this.tick * 14) * 4);
    c.stroke();
    c.fillStyle = "#fffdf1";
    c.strokeStyle = "#172432";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(3, -29, 13, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "#172432";
    c.beginPath();
    c.roundRect(2, -33, 15, 7, 4);
    c.fill();
    c.fillStyle = "#a8d5bd";
    c.fillRect(10, -31, 4, 2);
    c.strokeStyle = "#ff795c";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(-7, -21);
    c.lineTo(9, -19);
    c.stroke();
    c.restore();
  }
}
