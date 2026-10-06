export const LANDSCAPE_QUERY = "(orientation: landscape)";

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

export async function enterGameFullscreen(
  target: HTMLElement,
  mobile: boolean,
) {
  try {
    if (
      !document.fullscreenElement &&
      document.fullscreenEnabled &&
      target.requestFullscreen
    )
      await target.requestFullscreen();
  } catch {
    /* Immersive CSS works without Fullscreen permission. */
  }
  try {
    if (mobile && document.fullscreenElement === target) {
      const orientation = screen.orientation as LockableOrientation | undefined;
      if (orientation?.lock) await orientation.lock("landscape");
    }
  } catch {
    /* Unsupported or refused locks never interrupt gameplay. */
  }
}

export async function leaveGameFullscreen() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* Optional API. */
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* Optional API. */
  }
}
