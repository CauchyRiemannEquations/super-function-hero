export type StageRecord = {
  bestTime: number;
  bestScore: number;
  clears: number;
};
export type Settings = { muted: boolean; reducedMotion: boolean };
const RECORDS_KEY = "sfh:tangent:records:v1";
const SETTINGS_KEY = "sfh:tangent:settings:v1";
const memory: Record<number, StageRecord> = {};

export function loadRecords(): Record<number, StageRecord> {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(RECORDS_KEY) || "{}",
    );
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [id, value] of Object.entries(parsed)) {
        const r = value as Partial<StageRecord> | null;
        if (
          /^\d+$/.test(id) &&
          r &&
          typeof r.bestTime === "number" &&
          Number.isFinite(r.bestTime) &&
          r.bestTime > 0 &&
          typeof r.bestScore === "number" &&
          Number.isFinite(r.bestScore) &&
          r.bestScore >= 0 &&
          typeof r.clears === "number" &&
          Number.isInteger(r.clears) &&
          r.clears > 0
        ) {
          const existing = memory[Number(id)];
          memory[Number(id)] = existing
            ? {
                bestTime: Math.min(existing.bestTime, r.bestTime),
                bestScore: Math.max(existing.bestScore, r.bestScore),
                clears: Math.max(existing.clears, r.clears),
              }
            : (r as StageRecord);
        }
      }
    }
  } catch {
    /* A blocked or corrupt store never prevents a run. */
  }
  return { ...memory };
}

export function saveRun(stageId: number, time: number, score: number) {
  const records = loadRecords();
  const previous = records[stageId];
  const newBest = !previous || time < previous.bestTime;
  const record = {
    bestTime: Math.min(previous?.bestTime ?? Infinity, time),
    bestScore: Math.max(previous?.bestScore ?? 0, score),
    clears: (previous?.clears ?? 0) + 1,
  };
  memory[stageId] = record;
  try {
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify({ ...records, [stageId]: record }),
    );
  } catch {
    /* In-memory records remain available for this session. */
  }
  return { record, newBest };
}

export function loadSettings(): Settings {
  const defaults = {
    muted: false,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (
      value &&
      typeof value.muted === "boolean" &&
      typeof value.reducedMotion === "boolean"
    )
      return value;
  } catch {
    /* Use the OS motion preference when storage is unavailable. */
  }
  return defaults;
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* Settings are optional. */
  }
}
