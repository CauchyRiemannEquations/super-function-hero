import type { Skill } from "./trajectory";

export const INPUT_BUFFER_SECONDS = 0.14;
export const INPUT_GUARD_SECONDS = 0.12;

// One intent only. Simulation time freezes with hit stop, but pause/end/reset
// explicitly discard it so an old tap can never fire on resume or restart.
export class SkillInputBuffer {
  pending: { skill: Skill; expires: number; waitForEnd: boolean } | null = null;
  queue(skill: Skill, now: number, waitForEnd: boolean) {
    this.pending = { skill, expires: now + INPUT_BUFFER_SECONDS, waitForEnd };
  }
  consume(now: number, guardOpen: boolean, actionEnded: boolean): Skill | null {
    const intent = this.pending;
    if (!intent) return null;
    if (now > intent.expires) {
      this.clear();
      return null;
    }
    if (!guardOpen || (intent.waitForEnd && !actionEnded)) return null;
    this.clear();
    return intent.skill;
  }
  clear() {
    this.pending = null;
  }
}
