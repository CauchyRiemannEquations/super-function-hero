export const INPUT_BUFFER_SECONDS = 0.14;
export const INPUT_GUARD_SECONDS = 0.12;
/** A tap shortly before landing becomes one jump on contact, never a double jump. */
export class JumpInputBuffer {
  pending: { expires: number } | null = null;
  queue(now: number) {
    this.pending = { expires: now + INPUT_BUFFER_SECONDS };
  }
  consume(now: number, canJump: boolean): boolean {
    if (!this.pending) return false;
    if (now > this.pending.expires + 1e-9) {
      this.clear();
      return false;
    }
    if (!canJump) return false;
    this.clear();
    return true;
  }
  clear() {
    this.pending = null;
  }
}
