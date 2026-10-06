export class AudioFx {
  enabled = true;
  context?: AudioContext;
  unlock() {
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
  }
  play(kind: "skill" | "hit" | "hurt" | "clear", pitch = 0) {
    if (!this.enabled || !this.context || this.context.state !== "running")
      return;
    const ctx = this.context,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    const base =
      kind === "hit"
        ? 320 + pitch * 35
        : kind === "hurt"
          ? 105
          : kind === "clear"
            ? 620
            : 200 + pitch * 80;
    o.type = kind === "hurt" ? "sawtooth" : "triangle";
    o.frequency.setValueAtTime(base, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      kind === "hurt" ? 42 : base * 2,
      ctx.currentTime + 0.09,
    );
    g.gain.setValueAtTime(0.065, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.14);
  }
  dispose() {
    if (this.context) void this.context.close();
  }
}
