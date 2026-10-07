import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { loadRecords, loadSettings, saveRun, saveSettings } from "./records";

const RECORDS_KEY = "sfh:tangent:records:v1";
const SETTINGS_KEY = "sfh:tangent:settings:v1";

function browserStore(t: TestContext, reducedMotion = false) {
  const originalStore = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  const originalMedia = Object.getOwnPropertyDescriptor(
    globalThis,
    "matchMedia",
  );
  const values = new Map<string, string>();
  const policy = { denyReads: false, denyWrites: false };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key: string) {
        if (policy.denyReads) throw new Error("Storage access is blocked");
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        if (policy.denyWrites) throw new Error("Storage quota is unavailable");
        values.set(key, value);
      },
    },
  });
  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    value: (query: string) => {
      assert.equal(query, "(prefers-reduced-motion: reduce)");
      return { matches: reducedMotion };
    },
  });
  t.after(() => {
    if (originalStore)
      Object.defineProperty(globalThis, "localStorage", originalStore);
    else Reflect.deleteProperty(globalThis, "localStorage");
    if (originalMedia)
      Object.defineProperty(globalThis, "matchMedia", originalMedia);
    else Reflect.deleteProperty(globalThis, "matchMedia");
  });
  return { values, policy };
}

test("corrupt JSON and invalid record roots never prevent loading or erase session records", (t) => {
  const { values } = browserStore(t);
  const id = 7101;
  saveRun(id, 6.2, 450);
  for (const stored of ["{broken", "null", "true", "42", '"text"', "[]"]) {
    values.set(RECORDS_KEY, stored);
    assert.deepEqual(loadRecords()[id], {
      bestTime: 6.2,
      bestScore: 450,
      clears: 1,
    });
  }
});

test("stored records accept only positive finite times, nonnegative scores and positive integer clears", (t) => {
  const { values } = browserStore(t);
  const valid = { bestTime: 4.8, bestScore: 900, clears: 2 };
  const invalid = [
    null,
    true,
    "record",
    {},
    { ...valid, bestTime: "4.8" },
    { ...valid, bestTime: 0 },
    { ...valid, bestTime: -2 },
    { ...valid, bestTime: null },
    { ...valid, bestScore: -1 },
    { ...valid, bestScore: "900" },
    { ...valid, bestScore: null },
    { ...valid, clears: 0 },
    { ...valid, clears: 1.5 },
    { ...valid, clears: "2" },
  ];
  const payload: Record<string, unknown> = {
    "7200": valid,
    "not-a-stage": valid,
  };
  invalid.forEach((value, index) => {
    payload[String(7201 + index)] = value;
  });
  values.set(RECORDS_KEY, JSON.stringify(payload));
  const loaded = loadRecords();
  assert.deepEqual(loaded[7200], valid);
  invalid.forEach((_, index) => assert.equal(loaded[7201 + index], undefined));
  assert.equal(Reflect.get(loaded, "not-a-stage"), undefined);
  values.set(
    RECORDS_KEY,
    '{"7250":{"bestTime":1e999,"bestScore":900,"clears":1},"7251":{"bestTime":2,"bestScore":1e999,"clears":1}}',
  );
  assert.equal(loadRecords()[7250], undefined);
  assert.equal(loadRecords()[7251], undefined);
});

test("each stage independently keeps fastest time, highest score and every completed run", (t) => {
  const { values } = browserStore(t);
  const id = 7301;
  const first = saveRun(id, 8.4, 500);
  assert.equal(first.newBest, true);
  assert.deepEqual(first.record, { bestTime: 8.4, bestScore: 500, clears: 1 });

  const slower = saveRun(id, 9.1, 850);
  assert.equal(slower.newBest, false);
  assert.deepEqual(slower.record, { bestTime: 8.4, bestScore: 850, clears: 2 });

  const faster = saveRun(id, 7.9, 400);
  assert.equal(faster.newBest, true);
  assert.deepEqual(faster.record, { bestTime: 7.9, bestScore: 850, clears: 3 });
  const tied = saveRun(id, 7.9, 850);
  assert.equal(tied.newBest, false);
  assert.equal(tied.record.clears, 4);

  saveRun(7302, 5.5, 200);
  assert.deepEqual(loadRecords()[7302], {
    bestTime: 5.5,
    bestScore: 200,
    clears: 1,
  });
  assert.deepEqual(loadRecords()[id], tied.record);
  assert.deepEqual(JSON.parse(values.get(RECORDS_KEY)!)[id], tied.record);
});

test("private browsing read and write failures still keep records during the session", (t) => {
  const { policy } = browserStore(t);
  policy.denyReads = true;
  policy.denyWrites = true;
  assert.doesNotThrow(() => saveRun(7401, 6.7, 320));
  assert.deepEqual(loadRecords()[7401], {
    bestTime: 6.7,
    bestScore: 320,
    clears: 1,
  });
  const next = saveRun(7401, 6.2, 280);
  assert.deepEqual(next.record, { bestTime: 6.2, bestScore: 320, clears: 2 });
  assert.equal(next.newBest, true);
});

test("a denied write cannot let an older persisted record replace a newer session result", (t) => {
  const { values, policy } = browserStore(t);
  const id = 7501;
  values.set(
    RECORDS_KEY,
    JSON.stringify({ [id]: { bestTime: 10, bestScore: 100, clears: 1 } }),
  );
  assert.equal(loadRecords()[id].clears, 1);
  policy.denyWrites = true;
  assert.deepEqual(saveRun(id, 8, 200).record, {
    bestTime: 8,
    bestScore: 200,
    clears: 2,
  });
  assert.deepEqual(loadRecords()[id], {
    bestTime: 8,
    bestScore: 200,
    clears: 2,
  });
  assert.deepEqual(saveRun(id, 9, 150).record, {
    bestTime: 8,
    bestScore: 200,
    clears: 3,
  });

  policy.denyWrites = false;
  const recovered = saveRun(id, 7.5, 250);
  assert.deepEqual(recovered.record, {
    bestTime: 7.5,
    bestScore: 250,
    clears: 4,
  });
  assert.deepEqual(JSON.parse(values.get(RECORDS_KEY)!)[id], recovered.record);
});

test("missing, corrupt and invalid settings fall back to sound on and the OS motion preference", (t) => {
  const { values, policy } = browserStore(t, true);
  const fallback = { muted: false, reducedMotion: true };
  assert.deepEqual(loadSettings(), fallback);
  for (const stored of [
    "{broken",
    "null",
    "[]",
    "true",
    "{}",
    '{"muted":true}',
    '{"muted":"yes","reducedMotion":false}',
    '{"muted":false,"reducedMotion":1}',
  ]) {
    values.set(SETTINGS_KEY, stored);
    assert.deepEqual(loadSettings(), fallback);
  }
  policy.denyReads = true;
  assert.deepEqual(loadSettings(), fallback);
});

test("valid settings override the OS preference and optional writes do not throw", (t) => {
  const { values, policy } = browserStore(t, false);
  const settings = { muted: true, reducedMotion: true };
  saveSettings(settings);
  assert.deepEqual(JSON.parse(values.get(SETTINGS_KEY)!), settings);
  assert.deepEqual(loadSettings(), settings);
  policy.denyWrites = true;
  assert.doesNotThrow(() =>
    saveSettings({ muted: false, reducedMotion: false }),
  );
});
