import { AudioFx } from "./audio";
import { LANDSCAPE_QUERY } from "./browser-mode";
import {
  SkillInputBuffer,
  INPUT_BUFFER_SECONDS,
  INPUT_GUARD_SECONDS,
} from "./input";
import { fitViewport, WORLD_HEIGHT } from "./viewport";
import {
  attackCanBreak,
  attackDistance,
  touchesHazard,
  makeObject,
  hasAerialImpact,
  type WorldObject,
} from "./objects";
import { drawObject } from "./render-objects";
import { drawSprite } from "./assets";
import {
  CHAPTERS,
  DURATION,
  ENCOUNTERS,
  speedAt,
  pacedSpec,
  sceneryAt,
  sectionAt,
  chapterAt,
  makeEnemy,
  LOWER_FLOOR,
  REQUIRED_CORES,
} from "./stage";
import {
  FLOOR,
  SKILLS,
  segmentDistance,
  trajectory,
  type Point,
  type Skill,
} from "./trajectory";

export type Phase = "ready" | "playing" | "paused" | "clear" | "over";
type Motion = "run" | "skill" | "hop" | "fall";
type Action = {
  skill: Skill;
  start: Point;
  elapsed: number;
  hits: number;
  id: number;
  floor: number;
  powerful: boolean;
};
type Trail = { points: Point[]; color: string; age: number; active: boolean };
type Particle = Point & {
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
};
type Label = Point & {
  text: string;
  color: string;
  life: number;
  big: boolean;
};
export type Snapshot = {
  phase: Phase;
  hp: number;
  score: number;
  combo: number;
  maxCombo: number;
  kills: number;
  perfects: number;
  time: number;
  skill: Skill | null;
  bufferedSkill: Skill | null;
  chapter: number;
  fps: number;
  x: number;
  y: number;
  motion: Motion;
  casts: number;
  hits: number;
  waveChains: number;
  parabolaCombos: number;
  lastEvent: string;
  cores: number;
  gates: number;
  crashes: number;
  route: "roof" | "lower";
  floor: number;
  failure: string;
};
export const INITIAL: Snapshot = {
  phase: "ready",
  hp: 3,
  score: 0,
  combo: 0,
  maxCombo: 0,
  kills: 0,
  perfects: 0,
  time: 0,
  skill: null,
  bufferedSkill: null,
  chapter: 0,
  fps: 60,
  x: 180,
  y: FLOOR,
  motion: "run",
  casts: 0,
  hits: 0,
  waveChains: 0,
  parabolaCombos: 0,
  lastEvent: "",
  cores: 0,
  gates: 0,
  crashes: 0,
  route: "roof",
  floor: FLOOR,
  failure: "",
};

export class Game {
  state: Snapshot = { ...INITIAL };
  player = { x: 180, y: FLOOR, vy: 0, invulnerable: 0 };
  objects: WorldObject[] = [];
  trails: Trail[] = [];
  particles: Particle[] = [];
  labels: Label[] = [];
  action: Action | null = null;
  audio = new AudioFx();
  artReady = false;
  private orientationMedia = window.matchMedia(LANDSCAPE_QUERY);
  playAllowed = this.orientationMedia.matches;
  get canPlay() {
    return this.playAllowed && this.orientationMedia.matches;
  }
  private onOrientation = () =>
    this.setPlayAllowed(this.orientationMedia.matches);
  debug = { hitboxes: false, invincible: false, speed: 1 };
  width = 1160;
  height = WORLD_HEIGHT;
  viewHeight = WORLD_HEIGHT;
  immersive = false;
  protectedBottom = 0;
  input = new SkillInputBuffer();
  camera = 0;
  shake = 0;
  hitstop = 0;
  lastCombo = 0;
  lastRiseHit = -10;
  lastCast = -10;
  spawned = 0;
  id = 0;
  tick = 0;
  routeStarted = -10;
  cameraY = 0;
  crashX = 0;
  get floor() {
    if (this.state.route !== "lower") return FLOOR;
    const age = this.state.time - this.routeStarted;
    if (age < 4.5) return LOWER_FLOOR;
    return LOWER_FLOOR - (LOWER_FLOOR - FLOOR) * Math.min(1, (age - 4.5) / 0.8);
  }
  private frame = 0;
  private previous = 0;
  private accumulator = 0;
  private publishTime = 0;
  private resizeObserver: ResizeObserver;
  private ctx: CanvasRenderingContext2D;
  private reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  private onKey = (e: KeyboardEvent) => {
    if (!this.canPlay) return;
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    const key = Object.keys(SKILLS).find(
      (k) => SKILLS[k as Skill].key === e.key,
    ) as Skill | undefined;
    if (key) {
      e.preventDefault();
      if (!e.repeat) this.cast(key);
    }
    if (e.code === "Space" || e.code === "Escape") {
      e.preventDefault();
      this.togglePause();
    }
    if (
      e.code === "Enter" &&
      ["ready", "over", "clear"].includes(this.state.phase)
    )
      this.start();
    if (e.code === "KeyR") this.start();
  };
  private onVisibility = () => {
    if (document.hidden && this.state.phase === "playing") this.pause();
  };
  constructor(
    private canvas: HTMLCanvasElement,
    private notify: (s: Snapshot) => void,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    this.resize();
    window.addEventListener("keydown", this.onKey);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.orientationMedia.addEventListener("change", this.onOrientation);
    this.frame = requestAnimationFrame(this.loop);
  }
  private resize = () => {
    const box = this.canvas.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return;
    const oldAnchor = this.anchor;
    const controls =
      this.canvas.parentElement?.querySelector(".thumb-controls");
    const controlBox = controls?.getBoundingClientRect();
    this.protectedBottom = this.immersive
      ? controlBox && controlBox.height > 0
        ? Math.max(104, box.bottom - controlBox.top + 24)
        : 116
      : 0;
    const viewport = fitViewport(box.width, box.height, this.protectedBottom);
    this.width = viewport.width;
    this.viewHeight = viewport.height;
    this.camera += oldAnchor - this.anchor;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(box.width * dpr);
    this.canvas.height = Math.round(box.height * dpr);
  };
  setImmersive(value: boolean) {
    this.immersive = value;
    this.resize();
  }
  setPlayAllowed(value: boolean) {
    this.playAllowed = value;
    if (!value) {
      this.input.clear();
      this.state.bufferedSkill = null;
      if (this.state.phase === "playing") this.pause();
    }
  }
  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    window.removeEventListener("keydown", this.onKey);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.orientationMedia.removeEventListener("change", this.onOrientation);
    this.audio.dispose();
  }
  emit() {
    this.state.x = this.player.x;
    this.state.y = this.player.y;
    this.state.skill = this.action?.skill ?? null;
    this.state.chapter = CHAPTERS.indexOf(chapterAt(this.state.time));
    this.state.floor = this.floor;
    this.notify({ ...this.state });
  }
  start() {
    if (!this.artReady || !this.canPlay) return;
    this.audio.unlock();
    this.reset("playing");
  }
  returnToTitle() {
    this.reset("ready");
  }
  private reset(phase: Phase) {
    this.state = { ...INITIAL, phase };
    this.input.clear();
    this.player = { x: 180, y: FLOOR, vy: 0, invulnerable: 0 };
    this.objects = [];
    this.trails = [];
    this.particles = [];
    this.labels = [];
    this.action = null;
    this.camera = 180 - this.anchor;
    this.spawned = 0;
    this.hitstop = 0;
    this.shake = 0;
    this.lastCast = -10;
    this.lastRiseHit = -10;
    this.lastCombo = 0;
    this.accumulator = 0;
    this.routeStarted = -10;
    this.cameraY = 0;
    this.crashX = 0;
    this.emit();
  }
  get anchor() {
    return this.width < 800 ? this.width * 0.25 : 206;
  }
  pause() {
    this.input.clear();
    this.state.bufferedSkill = null;
    this.state.phase = "paused";
    this.accumulator = 0;
    this.emit();
  }
  togglePause() {
    if (!this.canPlay) return;
    if (this.state.phase === "playing") this.pause();
    else if (this.state.phase === "paused") {
      this.audio.unlock();
      this.state.phase = "playing";
      this.emit();
    }
  }
  cast(skill: Skill) {
    if (this.state.phase !== "playing" || !this.canPlay) return;
    const remaining = this.action
      ? SKILLS[this.action.skill].duration -
        this.action.elapsed +
        (this.state.motion === "hop" ? 0.17 : 0)
      : 0;
    const finishSoon =
      !!this.action &&
      skill !== this.action.skill &&
      remaining > 0 &&
      remaining <= INPUT_BUFFER_SECONDS;
    if (this.state.time - this.lastCast < INPUT_GUARD_SECONDS || finishSoon) {
      this.input.queue(skill, this.state.time, finishSoon);
      this.state.bufferedSkill = skill;
      this.emit();
      return;
    }
    this.activate(skill);
  }
  private activate(skill: Skill) {
    this.input.clear();
    this.state.bufferedSkill = null;
    this.audio.unlock();
    this.audio.play("skill", Object.keys(SKILLS).indexOf(skill));
    this.lastCast = this.state.time;
    this.state.casts++;
    this.endTrail();
    this.action = {
      skill,
      start: { x: this.player.x, y: this.player.y },
      elapsed: 0,
      hits: 0,
      id: ++this.id,
      floor: this.floor,
      powerful:
        skill === "dive" &&
        hasAerialImpact(this.floor - this.player.y, this.action),
    };
    this.player.vy = 0;
    this.state.motion =
      skill === "dive" && this.player.y > this.floor - 90 ? "hop" : "skill";
    this.trails.push({
      points: [{ x: this.player.x, y: this.player.y }],
      color: SKILLS[skill].color,
      age: 0,
      active: true,
    });
    this.burst(this.player.x, this.player.y + 12, SKILLS[skill].color, 8);
    this.state.lastEvent = SKILLS[skill].english;
    this.emit();
  }
  private endTrail() {
    this.trails.forEach((t) => (t.active = false));
  }
  spawn(kind: "bot" | "drone" | "spike" = "bot") {
    this.objects.push(
      makeEnemy(
        ++this.id,
        this.player.x + 270,
        kind === "drone" ? this.floor - 168 : this.floor - 15,
        kind,
      ),
    );
  }
  private loop = (now: number) => {
    const dt = Math.min((now - (this.previous || now)) / 1000, 0.08);
    this.previous = now;
    this.tick += dt;
    this.state.fps += (1 / Math.max(dt, 0.001) - this.state.fps) * 0.04;
    if (this.state.phase === "playing" && this.canPlay) {
      this.effects(dt);
      if (this.hitstop > 0) this.hitstop -= dt;
      else {
        this.accumulator += dt;
        while (
          this.accumulator >= 1 / 120 &&
          this.state.phase === "playing" &&
          this.hitstop <= 0
        ) {
          this.update(1 / 120);
          this.accumulator -= 1 / 120;
        }
        // Hit stop freezes simulation rather than building a catch-up burst.
        if (this.hitstop > 0) this.accumulator = 0;
      }
    }
    if (this.canPlay) this.render();
    this.publishTime += dt;
    if (this.publishTime > 0.06) {
      this.publishTime = 0;
      this.emit();
    }
    this.frame = requestAnimationFrame(this.loop);
  };
  private effects(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 35);
    this.trails.forEach((t) => {
      if (!t.active) t.age += dt;
    });
    this.trails = this.trails.filter((t) => t.age < 0.85);
    this.particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 360 * dt;
      p.life -= dt;
    });
    this.particles = this.particles.filter((p) => p.life > 0);
    this.labels.forEach((l) => {
      l.life -= dt;
      l.y -= dt * 28;
    });
    this.labels = this.labels.filter((l) => l.life > 0);
    this.objects.forEach((e) => {
      if (e.dead) {
        e.death += dt;
        if (e.role === "enemy") {
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.vy += 400 * dt;
        }
      }
    });
  }
  private update(dt: number) {
    if (!this.canPlay) return;
    this.state.time += dt;
    if (
      this.state.route === "lower" &&
      this.state.time - this.routeStarted >= 5.3
    )
      this.state.route = "roof";
    const buffered = this.input.consume(
      this.state.time,
      this.state.time - this.lastCast >= INPUT_GUARD_SECONDS,
      !this.action,
    );
    this.state.bufferedSkill = this.input.pending?.skill ?? null;
    if (buffered) this.activate(buffered);
    this.player.invulnerable = Math.max(0, this.player.invulnerable - dt);
    while (
      this.spawned < ENCOUNTERS.length &&
      this.state.time >= ENCOUNTERS[this.spawned].time
    ) {
      const group = ENCOUNTERS[this.spawned++];
      group.layout.forEach((spec) =>
        this.objects.push(
          makeObject(
            ++this.id,
            pacedSpec(spec, group.time),
            this.player.x,
            this.floor,
            group.namespace,
          ),
        ),
      );
    }
    const previous = { x: this.player.x, y: this.player.y };
    const a = this.action;
    if (a) {
      a.elapsed += dt;
      if (this.state.motion === "hop") {
        const t = Math.min(1, a.elapsed / 0.17);
        this.player.x = a.start.x + 35 * t;
        this.player.y = a.start.y - 155 * Math.sin((t * Math.PI) / 2);
        if (t >= 1) {
          this.state.motion = "skill";
          a.start = { x: this.player.x, y: this.player.y };
          a.elapsed = 0;
        }
      } else {
        const t = Math.min(1, a.elapsed / SKILLS[a.skill].duration);
        Object.assign(this.player, trajectory(a.skill, a.start, t, a.floor));
        for (const gate of this.objects)
          if (
            gate.kind === "gate" &&
            touchesHazard(gate, previous, this.player)
          ) {
            this.player.x = Math.min(
              this.player.x,
              gate.x - gate.width / 2 - 24,
            );
            this.hurt(gate);
          }
        if (this.state.phase === "over") return;
        if (t >= 1) {
          if (a.skill === "wave" && a.hits > 1) {
            this.state.waveChains++;
            this.label(
              "WAVE HIT ×" + a.hits,
              this.player.x,
              this.player.y - 60,
              SKILLS.wave.color,
              true,
            );
          }
          this.action = null;
          this.endTrail();
          this.state.motion = this.player.y < this.floor ? "fall" : "run";
          this.player.vy = a.skill === "rise" ? -65 : 0;
          if (a.skill === "dive") {
            this.shake = this.reduced ? 0 : 6;
            this.burst(
              this.player.x,
              a.floor + 26,
              SKILLS.dive.color,
              a.powerful ? 26 : 10,
            );
            this.objects.forEach((e) => {
              if (e.dead || Math.abs(e.floor - a.floor) > 10) return;
              if (
                e.role === "enemy" &&
                Math.abs(e.x - this.player.x) < (a.powerful ? 85 : 40) &&
                e.y > a.floor - 70
              )
                this.hit(e, 0, a);
              if (
                e.role === "core" &&
                e.kind !== "orb" &&
                Math.abs(e.x - this.player.x) < e.width / 2 + 36 &&
                attackCanBreak(e, a.skill, a.powerful, true)
              )
                this.breakCore(e, a);
            });
          }
        }
      }
    } else {
      this.player.x += speedAt(this.state.time) * this.debug.speed * dt;
      if (this.player.y < this.floor) {
        this.state.motion = "fall";
        this.player.vy += 480 * dt;
        this.player.y = Math.min(
          this.floor,
          this.player.y + this.player.vy * dt,
        );
      } else {
        this.player.y = this.floor;
        this.player.vy = 0;
        this.state.motion = "run";
      }
    }
    this.camera +=
      (this.player.x - this.anchor - this.camera) * (1 - Math.exp(-8 * dt));
    for (const e of this.objects) {
      if (e.dead || e.passed) continue;
      const d = attackDistance(e, previous, this.player);
      const attacking = a && this.state.motion !== "hop";
      if (
        attacking &&
        d < 52 &&
        attackCanBreak(e, a.skill, a.powerful, false)
      ) {
        if (e.role === "enemy") this.hit(e, d, a);
        else if (e.role === "core") this.breakCore(e, a);
      }
      if (e.role === "hazard" && touchesHazard(e, previous, this.player)) {
        if (e.kind === "gate")
          this.player.x = Math.min(this.player.x, e.x - e.width / 2 - 24);
        this.hurt(e);
      }
      if (!e.dead && e.x < this.player.x - 70) {
        if (e.role !== "core" && e.kind !== "gate") e.passed = true;
        if (e.role === "enemy") this.state.combo = 0;
      }
    }
    if (
      a &&
      Math.hypot(this.player.x - previous.x, this.player.y - previous.y) > 1
    )
      this.trails.at(-1)?.points.push({ x: this.player.x, y: this.player.y });
    this.objects = this.objects.filter(
      (e) =>
        e.x > this.camera - 220 &&
        (!e.dead || e.death < (e.role === "core" ? 2 : 0.55)),
    );
    this.cameraY +=
      (Math.max(0, this.player.y - FLOOR) - this.cameraY) *
      (1 - Math.exp(-8 * dt));
    if (this.state.combo > 0 && this.state.time - this.lastCombo > 12)
      this.state.combo = 0;
    // End-window inputs start on this very simulation step, after the old
    // action's final collision/splash has been resolved.
    if (!this.action && this.state.phase === "playing") {
      const next = this.input.consume(
        this.state.time,
        this.state.time - this.lastCast >= INPUT_GUARD_SECONDS,
        true,
      );
      this.state.bufferedSkill = this.input.pending?.skill ?? null;
      if (next) this.activate(next);
    }
    if (this.state.time >= DURATION && this.state.phase === "playing") {
      this.state.phase = this.state.cores === REQUIRED_CORES ? "clear" : "over";
      if (this.state.phase === "over")
        this.state.failure =
          "닫힌 CORE가 남았습니다. 문을 열어 코스를 완주하세요.";
      this.input.clear();
      this.state.bufferedSkill = null;
      this.endTrail();
      this.audio.play(this.state.phase === "clear" ? "clear" : "hurt");
      this.emit();
    }
  }
  private hit(e: WorldObject, distance: number, action: Action) {
    if (e.dead) return;
    e.dead = true;
    e.vx = 220;
    e.vy = -170;
    action.hits++;
    this.state.kills++;
    this.state.hits++;
    this.state.combo++;
    this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
    this.lastCombo = this.state.time;
    // Hits happen on contact with the attack radius. Grade precision against
    // the chosen curve, since the first contact is necessarily at its edge.
    let precision = distance,
      previous = action.start;
    for (let i = 1; i <= 72; i++) {
      const next = trajectory(action.skill, action.start, i / 72, action.floor);
      precision = Math.min(precision, segmentDistance(e, previous, next));
      previous = next;
    }
    const perfect = precision < 28;
    this.state.score += Math.round(
      (100 + (perfect ? 50 : 0)) *
        (1 + Math.min(this.state.combo - 1, 12) * 0.15),
    );
    if (perfect) {
      this.state.perfects++;
      this.label("PERFECT", e.x, e.y - 46, "#ff694b", false);
    }
    if (action.skill === "rise") this.lastRiseHit = this.state.time;
    if (action.skill === "dive" && this.state.time - this.lastRiseHit < 2.4) {
      this.state.parabolaCombos++;
      this.label(
        "PARABOLA COMBO",
        this.player.x + 35,
        this.player.y - 86,
        "#9782ee",
        true,
      );
      this.lastRiseHit = -10;
    }
    this.state.lastEvent = perfect ? "PERFECT" : "HIT";
    this.shake = this.reduced ? 0 : perfect ? 5 : 3;
    this.hitstop = 0.035;
    this.burst(e.x, e.y, SKILLS[action.skill].color, 18);
    this.audio.play("hit", this.state.combo % 7);
  }
  private hurt(e: WorldObject) {
    if (this.player.invulnerable > 0 || this.debug.invincible) return;
    this.state.hp--;
    this.state.combo = 0;
    this.player.invulnerable = 1.1;
    if (e.kind !== "gate") e.passed = true;
    this.shake = this.reduced ? 0 : 9;
    this.hitstop = 0.07;
    this.burst(this.player.x, this.player.y, "#ff694b", 14);
    this.audio.play("hurt");
    this.label("OUCH!", this.player.x, this.player.y - 65, "#ec604f", true);
    this.state.lastEvent = "DAMAGE";
    if (this.state.hp <= 0) {
      this.state.phase = "over";
      this.state.failure =
        e.kind === "gate"
          ? "CORE를 깨지 못해 문에 막혔습니다."
          : "위험물에 충돌했습니다.";
      this.input.clear();
      this.state.bufferedSkill = null;
      this.endTrail();
      this.emit();
    }
  }
  private breakCore(e: WorldObject, action: Action) {
    if (e.dead) return;
    e.dead = true;
    this.state.cores++;
    this.state.combo++;
    this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
    this.lastCombo = this.state.time;
    this.state.score += 300;
    action.hits++;
    if (action.skill === "rise") this.lastRiseHit = this.state.time;
    if (action.skill === "dive" && this.state.time - this.lastRiseHit < 2.4) {
      this.state.parabolaCombos++;
      this.label("PARABOLA COMBO", e.x, e.floor - 105, SKILLS.rise.color, true);
      this.lastRiseHit = -10;
    }
    for (const gate of this.objects)
      if (gate.kind === "gate" && gate.link === e.link && !gate.open) {
        gate.open = true;
        gate.openedAt = this.state.time;
        this.state.gates++;
      }
    if (e.kind !== "fracture")
      this.label(
        e.kind === "orb" ? "CORE BREAK" : "AIR IMPACT",
        e.x,
        e.kind === "orb" ? Math.max(e.y - 42, this.cameraY + 136) : e.y - 70,
        "#dca72c",
        true,
      );
    this.burst(e.x, e.y, "#e4b936", 30);
    this.hitstop = 0.06;
    this.shake = this.reduced ? 0 : 7;
    this.audio.play("hit", 6);
    if (e.kind === "fracture") {
      this.state.crashes++;
      this.state.route = "lower";
      this.routeStarted = this.state.time;
      this.crashX = e.x;
      this.player.vy = 240;
      this.state.motion = "fall";
      this.label("CRASH! ↓", e.x, e.floor - 30, "#e4a42d", true);
    }
    this.state.lastEvent = e.kind === "fracture" ? "CRASH" : "CORE BREAK";
  }
  private burst(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2,
        speed = 60 + Math.random() * 180,
        life = 0.25 + Math.random() * 0.4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        color,
        life,
        max: life,
        size: 2 + Math.random() * 4,
      });
    }
  }
  private label(
    text: string,
    x: number,
    y: number,
    color: string,
    big: boolean,
  ) {
    this.labels.push({ text, x, y, color, big, life: 1 });
  }
  private path(points: Point[], color: string, width: number, alpha = 1) {
    if (points.length < 2) return;
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    points.forEach((p, i) =>
      i === 0
        ? c.moveTo(p.x - this.camera, p.y)
        : c.lineTo(p.x - this.camera, p.y),
    );
    c.stroke();
    c.globalAlpha = 1;
  }
  private render() {
    const c = this.ctx,
      w = this.width,
      h = this.viewHeight;
    c.setTransform(this.canvas.width / w, 0, 0, this.canvas.height / h, 0, 0);
    c.clearRect(0, 0, w, h);
    c.lineCap = "round";
    c.lineJoin = "round";
    c.save();
    if (this.shake > 0)
      c.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
      );
    c.translate(0, -this.cameraY);
    this.background();
    const ready = this.state.phase === "ready";
    if (ready) {
      const samples = Array.from({ length: 75 }, (_, i) => ({
        x: 240 + i * 7,
        y: 285 - 78 * Math.sin((i / 74) * Math.PI * 3),
      }));
      c.setLineDash([4, 9]);
      this.path(samples, "#a5b7a7", 2, 0.55);
      c.setLineDash([]);
      this.drawEnemy(makeEnemy(0, this.width * 0.57, 195, "drone"), true);
      this.drawEnemy(makeEnemy(1, this.width * 0.87, FLOOR - 16), true);
    }
    for (const t of this.trails) {
      const opacity = Math.max(0, 1 - t.age / 0.85);
      this.path(t.points, t.color, 17, 0.08 * opacity);
      this.path(t.points, t.color, 6, 0.75 * opacity);
      this.path(t.points, "#fff9ec", 1.5, 0.9 * opacity);
      if (t.points.length > 8) {
        c.fillStyle = t.color;
        c.globalAlpha = 0.55 * opacity;
        t.points.forEach((p, i) => {
          if (i % 16 === 0) {
            c.beginPath();
            c.arc(p.x - this.camera, p.y, 3, 0, Math.PI * 2);
            c.fill();
          }
        });
        c.globalAlpha = 1;
      }
    }
    for (const core of this.objects)
      if (core.role === "core" && !core.dead && core.link) {
        for (const gate of this.objects)
          if (gate.kind === "gate" && gate.link === core.link && !gate.open) {
            c.strokeStyle = "#d7b85c80";
            c.lineWidth = 1.5;
            c.setLineDash([4, 6]);
            c.beginPath();
            c.moveTo(core.x - this.camera, core.y);
            c.lineTo(gate.x - this.camera, core.y);
            c.lineTo(gate.x - this.camera, gate.y);
            c.stroke();
            c.setLineDash([]);
          }
      }
    this.objects.forEach((e) => {
      if (e.x - this.camera < -160 || e.x - this.camera > this.width + 200)
        return;
      if (e.role === "enemy") this.drawEnemy(e);
      else drawObject(c, e, this.camera, this.tick, this.state.time);
    });
    this.particles.forEach((p) => {
      c.globalAlpha = p.life / p.max;
      c.fillStyle = p.color;
      c.save();
      c.translate(p.x - this.camera, p.y);
      c.rotate(p.life * 5);
      c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      c.restore();
    });
    c.globalAlpha = 1;
    this.drawPlayer();
    this.labels.forEach((l) => {
      c.save();
      c.globalAlpha = Math.min(1, l.life * 3);
      c.translate(Math.max(85, Math.min(w - 100, l.x - this.camera)), l.y);
      const s = 1 + Math.max(0, l.life - 0.8) * 1.5;
      c.scale(s, s);
      c.font = `900 ${l.big ? 23 : 17}px Arial, sans-serif`;
      c.textAlign = "center";
      c.strokeStyle = "#fffaf0";
      c.lineWidth = 5;
      c.strokeText(l.text, 0, 0);
      c.fillStyle = l.color;
      c.fillText(l.text, 0, 0);
      c.restore();
    });
    if (this.state.phase === "playing") {
      // Screen-edge warnings are positions, not quiz-like skill suggestions.
      for (const e of this.objects)
        if (!e.dead && !e.passed && e.x - this.camera > w - 35) {
          c.fillStyle =
            e.role === "hazard"
              ? "#de584c"
              : e.role === "core"
                ? "#d8a129"
                : "#39ad94";
          c.beginPath();
          c.moveTo(w - 26, e.y - 7);
          c.lineTo(w - 14, e.y);
          c.lineTo(w - 26, e.y + 7);
          c.fill();
        }
    }
    if (this.debug.hitboxes) {
      c.strokeStyle = "#ff00ba";
      c.lineWidth = 1;
      c.beginPath();
      c.arc(this.player.x - this.camera, this.player.y, 30, 0, Math.PI * 2);
      c.stroke();
      this.objects
        .filter((e) => !e.dead)
        .forEach((e) => {
          c.beginPath();
          c.arc(e.x - this.camera, e.y, 22, 0, Math.PI * 2);
          c.stroke();
        });
    }
    c.restore();
  }
  private background() {
    const c = this.ctx,
      w = this.width;
    const palette = sceneryAt(this.state.time),
      section = sectionAt(this.state.time);
    const gradient = c.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, palette.sky);
    gradient.addColorStop(1, palette.haze);
    c.fillStyle = gradient;
    c.fillRect(0, this.cameraY, w, this.viewHeight);
    c.strokeStyle = "#ffffff0b";
    c.lineWidth = 1;
    for (let x = 0; x < w; x += 58) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 373);
      c.stroke();
    }
    for (let y = 30; y < 370; y += 58) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    const sunX = w * 0.78 - ((this.camera * 0.015) % 100);
    c.fillStyle = palette.glass;
    c.beginPath();
    c.arc(sunX, 105, 48, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = palette.glass + "60";
    c.lineWidth = 1;
    c.beginPath();
    c.arc(sunX, 105, 60, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 6; i++) {
      const x =
        ((((i * 253 - this.camera * 0.06) % (w + 280)) + (w + 280)) %
          (w + 280)) -
        120;
      const y = 68 + (i % 3) * 33;
      c.fillStyle = palette.haze + "80";
      c.beginPath();
      c.roundRect(x, y, 70 + (i % 2) * 35, 13, 12);
      c.fill();
    }
    for (let layer = 0; layer < 2; layer++) {
      const step = layer === 0 ? 107 : 166,
        factor = layer === 0 ? 0.12 : 0.27;
      const offset = (this.camera * factor) % step;
      for (let i = -1; i < w / step + 2; i++) {
        const idx = i + Math.floor((this.camera * factor) / step);
        const bh = 75 + ((((idx * 71 + 377) % 120) + 120) % 120),
          x = i * step - offset,
          y = 375 - bh;
        c.fillStyle = layer === 0 ? palette.far : palette.near;
        c.fillRect(x, y, step - 17, bh);
        c.fillStyle = palette.detail;
        c.fillRect(x - 3, y, step - 11, 5);
        if (layer === 1) {
          c.fillStyle = palette.glass;
          for (let wx = x + 13; wx < x + step - 25; wx += 25)
            for (let wy = y + 18; wy < 352; wy += 25) c.fillRect(wx, wy, 9, 12);
          c.strokeStyle = palette.detail;
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(x + 20, y);
          c.lineTo(x + 20, y - 15);
          c.lineTo(x + 65, y - 15);
          c.lineTo(x + 65, y);
          c.stroke();
          if (section.theme === "factory") {
            c.fillStyle = palette.detail;
            c.fillRect(x + 24, y - 42, 12, 42);
            c.fillRect(x + 50, y - 28, 9, 28);
            c.fillStyle = palette.haze + "45";
            c.beginPath();
            c.arc(x + 28, y - 50, 12, 0, Math.PI * 2);
            c.fill();
          }
          if (section.theme === "city" || section.theme === "night") {
            c.fillStyle = palette.accent;
            c.fillRect(x + 8, y + 8, step - 40, 2);
          }
        }
      }
    }
    c.fillStyle = palette.ground;
    const deck = this.floor + 28;
    c.fillRect(0, deck, w, this.viewHeight + this.cameraY - deck);
    c.fillStyle = palette.edge;
    c.fillRect(0, deck, w, 7);
    c.fillStyle = palette.accent + "65";
    c.fillRect(0, deck + 8, w, 12);
    if (this.state.route === "lower") {
      const hole = this.crashX - this.camera;
      c.fillStyle = "#596659";
      c.fillRect(0, FLOOR + 28, Math.max(0, hole - 75), 12);
      c.fillRect(hole + 75, FLOOR + 28, w - hole - 75, 12);
      c.fillStyle = "#e1ae37";
      c.font = "700 11px Arial";
      c.fillText(
        "LOWER ROUTE → BONUS",
        Math.max(35, hole - 60),
        this.floor - 48,
      );
    }
    c.strokeStyle = palette.detail + "70";
    c.lineWidth = 1;
    for (let y = deck + 36; y < this.viewHeight + this.cameraY; y += 27) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    for (let i = -1; i < w / 160 + 1; i++) {
      const x = i * 160 - (this.camera % 160);
      c.strokeStyle = palette.detail;
      c.beginPath();
      c.moveTo(x, deck + 20);
      c.lineTo(x - 38, this.viewHeight + this.cameraY);
      c.stroke();
      c.fillStyle = palette.accent;
      c.fillRect(x + 47, deck + 10, 24, 3);
    }
    c.save();
    c.translate(w - 115, deck + 40);
    c.fillStyle = palette.glass;
    c.font = "600 10px monospace";
    c.fillText(section.theme.toUpperCase(), 0, 0);
    c.restore();
  }
  private drawEnemy(e: WorldObject, preview = false) {
    const c = this.ctx,
      x = e.x - this.camera,
      y = e.y;
    if (x < -100 || x > this.width + 100) return;
    c.save();
    c.translate(x, y);
    c.globalAlpha = e.dead ? Math.max(0, 1 - e.death / 0.55) : 1;
    if (e.dead) c.rotate(e.death * 6);
    if (e.role === "enemy") {
      const width = e.kind === "drone" ? 82 : 58,
        height = e.kind === "drone" ? (82 * 478) / 1122 : (58 * 747) / 580;
      const top = e.kind === "drone" ? -height / 2 : e.floor + 28 - y - height;
      if (
        drawSprite(
          c,
          e.kind === "drone" ? "drone" : "bot",
          -width / 2,
          top,
          width,
        )
      ) {
        if (!e.dead && !preview) {
          c.strokeStyle = "#34dfca70";
          c.lineWidth = 1.5;
          c.setLineDash([3, 6]);
          c.beginPath();
          c.arc(0, 0, 35, 0, Math.PI * 2);
          c.stroke();
          c.setLineDash([]);
        }
        c.restore();
        return;
      }
    }
    if (e.kind === "spike") {
      c.fillStyle = "#596365";
      c.fillRect(-28, 14, 56, 6);
      c.fillStyle = "#ff8065";
      c.strokeStyle = "#354951";
      c.lineWidth = 3;
      for (let i = -1; i < 2; i++) {
        c.beginPath();
        c.moveTo(i * 19 - 10, 13);
        c.lineTo(i * 19, -21);
        c.lineTo(i * 19 + 10, 13);
        c.closePath();
        c.fill();
        c.stroke();
      }
    } else {
      if (!e.dead) {
        c.fillStyle = "#324b4a15";
        c.beginPath();
        c.ellipse(0, e.floor + 25 - y, 22, 5, 0, 0, Math.PI * 2);
        c.fill();
      }
      if (e.kind === "drone") {
        c.save();
        c.translate(0, preview ? Math.sin(this.tick * 2) * 6 : 0);
        c.strokeStyle = "#596166";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(-30, -12);
        c.lineTo(-15, -6);
        c.moveTo(15, -6);
        c.lineTo(30, -12);
        c.stroke();
        c.strokeStyle = "#a993c5";
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(-38, -14);
        c.lineTo(-22, -14);
        c.moveTo(22, -14);
        c.lineTo(38, -14);
        c.stroke();
        c.fillStyle = "#c0a9e9";
        c.strokeStyle = "#49545c";
        c.lineWidth = 2.5;
        c.beginPath();
        c.roundRect(-22, -13, 44, 29, 12);
        c.fill();
        c.stroke();
        c.fillStyle = "#fff4d9";
        c.beginPath();
        c.roundRect(-13, -6, 26, 9, 4);
        c.fill();
        c.fillStyle = "#465454";
        c.fillRect(-8, -3, 4, 4);
        c.fillRect(5, -3, 4, 4);
        c.restore();
      } else {
        c.strokeStyle = "#4c5c59";
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(-11, 14);
        c.lineTo(-15, 28);
        c.lineTo(-23, 28);
        c.moveTo(11, 14);
        c.lineTo(15, 28);
        c.lineTo(23, 28);
        c.stroke();
        c.fillStyle = "#b8c792";
        c.strokeStyle = "#4c5c59";
        c.lineWidth = 2.5;
        c.beginPath();
        c.roundRect(-21, -19, 42, 37, 9);
        c.fill();
        c.stroke();
        c.fillStyle = "#f9f4dc";
        c.beginPath();
        c.roundRect(-14, -10, 28, 12, 4);
        c.fill();
        c.fillStyle = "#455955";
        c.fillRect(-9, -7, 5, 5);
        c.fillRect(4, -7, 5, 5);
        c.strokeStyle = "#4c5c59";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, -19);
        c.lineTo(0, -27);
        c.stroke();
        c.fillStyle = "#ff704e";
        c.beginPath();
        c.arc(0, -28, 3, 0, Math.PI * 2);
        c.fill();
      }
      if (!e.dead && !preview) {
        c.strokeStyle = "#39ad9460";
        c.lineWidth = 1;
        c.setLineDash([3, 4]);
        c.beginPath();
        c.arc(0, -2, 36, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
      }
    }
    c.restore();
  }
  private drawPlayer() {
    const c = this.ctx,
      p = this.player,
      x = this.state.phase === "ready" ? this.width * 0.74 : p.x - this.camera;
    const active = this.action?.skill,
      color = active ? SKILLS[active].color : "#ff794b";
    c.fillStyle = "#314b4922";
    c.beginPath();
    c.ellipse(x, this.floor + 26, 24, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.translate(x, p.y);
    if (this.state.phase === "ready") c.scale(1.7, 1.7);
    if (p.invulnerable > 0 && Math.floor(this.tick * 16) % 2)
      c.globalAlpha = 0.4;
    const run = this.state.motion === "run",
      swing = run ? Math.sin(this.tick * 17) * 12 : 0;
    const angle =
      active === "line"
        ? 0.32
        : active === "rise"
          ? -0.2
          : active === "dive"
            ? 0.45
            : active === "wave"
              ? Math.sin((this.action?.elapsed ?? 0) * 10) * 0.3
              : -0.08;
    c.rotate(angle);
    // A simple ink runner: white helmet, coral scarf, expressive stick limbs.
    c.strokeStyle = "#261441";
    c.lineWidth = 6;
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
    c.lineTo(-17, 0 + swing * 0.3);
    c.lineTo(-23, -8 + swing * 0.5);
    c.stroke();
    c.strokeStyle = color;
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(0, -17);
    c.bezierCurveTo(-15, -20, -23, -8, -42, -18 + Math.sin(this.tick * 14) * 4);
    c.stroke();
    c.fillStyle = "#35224f";
    c.strokeStyle = "#17112e";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(3, -29, 13, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "#263e45";
    c.beginPath();
    c.roundRect(2, -33, 15, 7, 4);
    c.fill();
    c.fillStyle = "#32dce1";
    c.fillRect(10, -31, 4, 2);
    c.strokeStyle = color;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(-7, -21);
    c.lineTo(9, -19);
    c.stroke();
    if (active) {
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, -2, 39, this.tick * 5, this.tick * 5 + 2);
      c.stroke();
    }
    c.restore();
  }
}
