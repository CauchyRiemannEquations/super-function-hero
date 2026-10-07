import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { connect as connectTcp } from "node:net";
import { connect as connectTls } from "node:tls";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Uses an installed runtime; it never installs packages or browser binaries.
const bundledPlaywright =
  process.env.SFH_PLAYWRIGHT_PATH ||
  resolve(
    homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
  );
let playwright;
try {
  playwright = await import(pathToFileURL(bundledPlaywright).href);
} catch (bundledError) {
  try {
    playwright = await import("playwright");
  } catch (localError) {
    throw new AggregateError(
      [bundledError, localError],
      "No installed Playwright runtime is available",
    );
  }
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const imageDir = resolve(root, "docs/images");
const reportPath = resolve(root, "docs/verification-tangent.json");
const url = process.env.SFH_URL || "http://localhost:5173";
const routes = [
  { stage: 1, name: "first landing", taps: [1.65], sign: "positive" },
  { stage: 2, name: "at the vertex", taps: [1.6], sign: "zero" },
  { stage: 3, name: "high platform", taps: [1.95], sign: "positive" },
  {
    stage: 4,
    name: "two downward launches",
    taps: [1.45, 3.2],
    sign: "negative",
  },
  { stage: 5, name: "upper shortcut", taps: [1.2, 3.55] },
  { stage: 5, name: "lower coin route", taps: [5] },
];
let report = {
  generatedAt: new Date().toISOString(),
  url,
  status: "running",
  mode: "Real-time Chromium touch emulation; actual menu taps and canvas taps; read-only dev state inspection; no state mutation or fake clock",
  viewport: {
    width: 844,
    height: 390,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  browserVersion: "",
  runs: [],
  checks: [],
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  limitations: [
    "Emulated touch is not a physical iOS/Android device",
    "Fullscreen/orientation availability varies by browser",
    "A completed scripted route does not establish fun or learning effectiveness",
  ],
};
await mkdir(imageDir, { recursive: true });
const fallbackOnly = process.argv.includes("--fallback-only");
if (fallbackOnly) {
  const previous = JSON.parse(await readFile(reportPath, "utf8"));
  assert.equal(
    previous.runs.filter(
      (run) => run.route !== "fullscreen unavailable fallback",
    ).length,
    6,
    "a fallback-only continuation requires an actual completed six-route report",
  );
  assert.equal(previous.pageErrors.length, 0);
  assert.ok(
    previous.checks.some((item) =>
      item.name.includes("740×360 real touch play"),
    ),
  );
  assert.ok(
    previous.consoleErrors.every(
      (message) =>
        message.includes("ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS") ||
        message.startsWith("[vite] failed to connect to websocket"),
    ),
    "only the known test-interception HMR failure may be retried separately",
  );
  report = {
    ...previous,
    status: "running",
    consoleErrors: [],
    runs: previous.runs.filter(
      (run) => run.route !== "fullscreen unavailable fallback",
    ),
    checks: previous.checks.filter(
      (item) =>
        !item.name.includes("fullscreen unavailable fallback") &&
        !item.name.includes("Browser-enforced unavailable fullscreen"),
    ),
    continuation: {
      startedAt: new Date().toISOString(),
      reason:
        "Retried only fullscreen policy fallback using a real HTTP proxy; the earlier intercepted document blocked Vite HMR through Chromium local-network classification",
      previousInfrastructureErrors: previous.consoleErrors.length,
    },
  };
  // Normalize old report metadata without changing any observed game result.
  for (const run of report.runs) {
    run.stageId = run.stageId ?? run.stageIndex + 1;
    delete run.stage;
  }
  delete report.failure;
  delete report.pendingTap;
}

let browser;
let page;
let fallbackServer;
let fallbackSockets;
async function permissionsProxy() {
  const upstream = new URL(url);
  const transport = upstream.protocol === "https:" ? httpsRequest : httpRequest;
  fallbackSockets = new Set();
  const server = createServer((incoming, outgoing) => {
    const target = new URL(incoming.url, upstream);
    const request = transport(
      target,
      {
        method: incoming.method,
        headers: { ...incoming.headers, host: upstream.host },
      },
      (response) => {
        outgoing.writeHead(response.statusCode || 502, {
          ...response.headers,
          "permissions-policy": "fullscreen=()",
        });
        response.pipe(outgoing);
      },
    );
    request.on("error", (error) => {
      outgoing.writeHead(502);
      outgoing.end(error.message);
    });
    incoming.pipe(request);
  });
  server.on("connection", (socket) => {
    fallbackSockets.add(socket);
    socket.on("close", () => fallbackSockets.delete(socket));
  });
  // Keep Vite's real HMR connection working through the same local origin.
  server.on("upgrade", (incoming, socket, head) => {
    const connect = upstream.protocol === "https:" ? connectTls : connectTcp;
    const upstreamSocket = connect(
      {
        host: upstream.hostname,
        port: Number(
          upstream.port || (upstream.protocol === "https:" ? 443 : 80),
        ),
      },
      () => {
        const headers = Object.entries({
          ...incoming.headers,
          host: upstream.host,
        })
          .map(([name, value]) => `${name}: ${value}`)
          .join("\r\n");
        upstreamSocket.write(
          `${incoming.method} ${incoming.url} HTTP/${incoming.httpVersion}\r\n${headers}\r\n\r\n`,
        );
        if (head.length) upstreamSocket.write(head);
        socket.pipe(upstreamSocket);
        upstreamSocket.pipe(socket);
      },
    );
    fallbackSockets.add(upstreamSocket);
    upstreamSocket.on("close", () => fallbackSockets.delete(upstreamSocket));
    upstreamSocket.on("error", () => socket.destroy());
    socket.on("error", () => upstreamSocket.destroy());
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  fallbackServer = server;
  return `http://127.0.0.1:${server.address().port}${upstream.pathname}`;
}
function check(name, detail = {}) {
  report.checks.push({ name, passed: true, ...detail });
  console.log(`PASS ${name}`);
}
async function screenshot(name) {
  await page.screenshot({ path: resolve(imageDir, name), fullPage: false });
  report.screenshots.push(`docs/images/${name}`);
}
async function resultFits() {
  const layout = await page.locator(".result-panel").evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      panel: {
        x: rect.x,
        y: rect.y,
        right: rect.right,
        bottom: rect.bottom,
        clientHeight: panel.clientHeight,
        scrollHeight: panel.scrollHeight,
      },
      buttons: Array.from(panel.querySelectorAll("button")).map((button) => {
        const box = button.getBoundingClientRect();
        return {
          text: button.textContent.trim(),
          x: box.x,
          y: box.y,
          right: box.right,
          bottom: box.bottom,
          height: box.height,
        };
      }),
    };
  });
  assert.ok(
    layout.panel.x >= -1 &&
      layout.panel.y >= -1 &&
      layout.panel.right <= layout.viewport.width + 1 &&
      layout.panel.bottom <= layout.viewport.height + 1,
    `result panel fits ${layout.viewport.width}×${layout.viewport.height}`,
  );
  assert.ok(
    layout.panel.scrollHeight <= layout.panel.clientHeight + 1,
    "the result panel has no internal vertical scrolling",
  );
  for (const button of layout.buttons) {
    assert.ok(
      button.x >= -1 &&
        button.y >= -1 &&
        button.right <= layout.viewport.width + 1 &&
        button.bottom <= layout.viewport.height + 1,
      `${button.text} stays inside the viewport`,
    );
    assert.ok(
      button.height >= 43.5,
      `${button.text} keeps a 44px touch target`,
    );
  }
  return layout;
}
async function state() {
  return page.evaluate(() => {
    const game = window.__curveGame;
    return {
      phase: game.state.phase,
      stage: game.state.stage,
      stats: { ...game.run.stats },
      clock: game.run.clock,
      player: { ...game.run.player },
      snapshot: { ...game.state },
      checkpoint: game.run.checkpoint,
      tracePoints: game.run.trace.length,
    };
  });
}
async function waitPlaying() {
  await page.waitForFunction(
    () => window.__curveGame?.state.phase === "playing",
    undefined,
    { timeout: 5000 },
  );
}
async function chooseStage(stage) {
  if (await page.locator(".play-button").isVisible())
    await page.locator(".play-button").tap();
  if (await page.locator(".result-actions").isVisible())
    await page.locator(".result-actions .secondary").last().tap();
  await page.locator(".stage-select").waitFor({ state: "visible" });
  await page
    .locator(".stage-card")
    .nth(stage - 1)
    .tap();
  await page.locator(".select-footer .primary").tap();
  await waitPlaying();
}
async function tapAt(target, expectedSign) {
  const box = await page.locator("canvas").boundingBox();
  assert.ok(box, "the gameplay canvas has a visible bounding box");
  const before = await state();
  report.pendingTap = { target, before };
  await page.waitForFunction(
    (time) => {
      const game = window.__curveGame;
      return game?.state.phase === "playing" && game.run.clock >= time;
    },
    target,
    { polling: "raf", timeout: 15000 },
  );
  // Below the HUD, outside buttons, and inside the actual canvas hit area.
  // touchscreen.tap avoids locator actionability/stability waits consuming a timing window.
  await page.touchscreen.tap(
    box.x + box.width * 0.35,
    box.y + box.height * 0.78,
  );
  report.pendingTap.afterTouch = await state();
  await page.waitForFunction(
    (jumps) => window.__curveGame.run.stats.jumps === jumps + 1,
    before.stats.jumps,
    { polling: "raf", timeout: 1200 },
  );
  const launch = await page.evaluate(() => {
    const run = window.__curveGame.run;
    // Private TS fields are observed only; no dev hooks, position, clock or input are changed.
    const elapsed = run.clock - run.lastJump;
    const perfectZones = run.stage.perfectZones.filter(
      (zone) => zone.surface === run.launchSurface,
    );
    return {
      clock: run.clock,
      launchClock: run.lastJump,
      x: run.stats.lastJumpX,
      slope: run.stats.lastSlope,
      vx: run.player.vx,
      measuredVy: run.player.vy,
      initialVy: run.player.vy + 390 * elapsed,
      grounded: Boolean(run.player.surface),
      jumps: run.stats.jumps,
      perfectZones,
      withinPerfectZone: perfectZones.some(
        (zone) => Math.abs(zone.x - run.stats.lastJumpX) <= zone.tolerance,
      ),
      pointer: window.__sfhPointerReads.at(-1),
    };
  });
  assert.equal(launch.grounded, false, "a canvas touch launches into flight");
  assert.equal(launch.pointer.pointerType, "touch");
  assert.equal(launch.pointer.button, 0);
  assert.equal(launch.pointer.isPrimary, true);
  assert.equal(launch.pointer.target, "CANVAS");
  assert.equal(launch.pointer.controlsBlocked, false);
  assert.ok(
    launch.launchClock >= target - 0.02 && launch.launchClock <= target + 0.1,
    `real touch timing ${launch.launchClock.toFixed(3)} must be within 100ms of ${target}`,
  );
  assert.ok(
    Math.abs(launch.initialVy - launch.slope * launch.vx) < 1e-7,
    "gravity-corrected first flight velocity has the tangent slope",
  );
  assert.ok(
    Math.abs(Math.hypot(launch.vx, launch.initialVy) - 420) < 1e-7,
    "the actual initial speed is normalized to JUMP_SPEED",
  );
  if (expectedSign === "positive")
    assert.ok(launch.slope > 0.12 && launch.initialVy > 0);
  if (expectedSign === "negative")
    assert.ok(launch.slope < -0.12 && launch.initialVy < 0);
  if (expectedSign === "zero")
    assert.ok(
      Math.abs(launch.slope) < 0.12 &&
        Math.abs(launch.initialVy / launch.vx) < 0.12,
    );
  delete report.pendingTap;
  return {
    requestedClock: target,
    beforeClock: before.clock,
    ...launch,
    expectedSign: expectedSign || "route-dependent",
  };
}
async function finishRoute(route, captureStage = false) {
  await chooseStage(route.stage);
  const launches = [];
  for (let i = 0; i < route.taps.length; i++) {
    launches.push(await tapAt(route.taps[i], i === 0 ? route.sign : undefined));
    if (captureStage && i === 0) await screenshot("tangent-stage.png");
  }
  await page.waitForFunction(
    () => window.__curveGame?.state.phase === "clear",
    undefined,
    { timeout: 15000 },
  );
  await page.locator(".result-panel").waitFor({ state: "visible" });
  const result = await state();
  assert.equal(
    result.stats.misses,
    0,
    `${route.name} must clear without a checkpoint reset`,
  );
  assert.equal(result.stats.jumps, route.taps.length);
  assert.ok(result.stats.coins > 0);
  assert.ok(result.snapshot.bestTime > 0);
  const record = await page.evaluate(
    (stageId) =>
      JSON.parse(localStorage.getItem("sfh:tangent:records:v1"))[stageId],
    route.stage,
  );
  assert.ok(record.bestTime <= result.stats.time);
  assert.ok(record.bestScore >= result.stats.score);
  assert.equal(record.bestTime, result.snapshot.bestTime);
  const resultLayout = await resultFits();
  const { stage: stageIndex, ...runResult } = result;
  report.runs.push({
    ...runResult,
    stageId: route.stage,
    stageIndex,
    route: route.name,
    launches,
    record,
    resultLayout,
  });
  check(
    `Stage ${route.stage}: ${route.name} clears through actual touchscreen taps`,
    {
      time: result.stats.time,
      coins: result.stats.coins,
      jumps: result.stats.jumps,
    },
  );
  return result;
}
function sameRun(a, b, label) {
  assert.equal(b.clock, a.clock, `${label}: simulation clock is frozen`);
  assert.equal(b.stats.time, a.stats.time, `${label}: scored time is frozen`);
  assert.deepEqual(
    b.player,
    a.player,
    `${label}: player position and velocity are preserved`,
  );
}

try {
  browser = await playwright.chromium.launch({ headless: true });
  report.browserVersion = browser.version();
  if (!fallbackOnly) {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    await context.addInitScript(() => {
      // Capture-only test telemetry. Gameplay objects, timers and inputs are never mutated.
      window.__sfhPointerReads = [];
      document.addEventListener(
        "pointerdown",
        (event) => {
          const game = window.__curveGame;
          window.__sfhPointerReads.push({
            button: event.button,
            isPrimary: event.isPrimary,
            pointerType: event.pointerType,
            target: event.target.tagName,
            phase: game?.state.phase,
            clock: game?.run.clock,
            controlsBlocked: game?.controlsBlocked,
          });
          if (window.__sfhPointerReads.length > 40)
            window.__sfhPointerReads.shift();
        },
        true,
      );
    });
    page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") report.consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("requestfailed", (request) =>
      report.requestFailures.push({
        url: request.url(),
        failure: request.failure()?.errorText,
      }),
    );
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.__curveGame), undefined, {
      timeout: 10000,
    });
    assert.equal(
      await page.locator(".thumb-skill, .skill-grid").count(),
      0,
      "old function selection controls are absent",
    );
    await page.locator(".play-button").tap();
    await page.locator(".stage-select").waitFor({ state: "visible" });
    assert.equal(await page.locator(".stage-card").count(), 5);
    await screenshot("tangent-select.png");
    check("Play opens five-stage selection with no old function buttons");

    for (const route of routes) {
      await finishRoute(route, route.stage === 1);
      if (route.stage === 5 && route.name === "upper shortcut") {
        await page.waitForTimeout(1100); // Allow the real result camera animation to settle.
        await screenshot("tangent-result.png");
      }
    }
    const upper = report.runs.find((run) => run.route === "upper shortcut");
    const lower = report.runs.find((run) => run.route === "lower coin route");
    assert.ok(upper.stats.time < lower.stats.time);
    assert.ok(lower.stats.coins > upper.stats.coins);
    assert.ok(
      report.runs.some((run) => run.stats.perfects > 0),
      "real touches trigger Perfect Tangent rewards",
    );
    assert.ok(
      report.runs.some((run) => run.stats.perfectLandings > 0),
      "real routes trigger Perfect Landing rewards",
    );
    check("Stage 5 exposes a faster shortcut and a richer collection route", {
      upperTime: upper.stats.time,
      lowerTime: lower.stats.time,
      upperCoins: upper.stats.coins,
      lowerCoins: lower.stats.coins,
    });
    const persisted = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("sfh:tangent:records:v1")),
    );
    assert.deepEqual(Object.keys(persisted).sort(), ["1", "2", "3", "4", "5"]);
    for (let stage = 1; stage <= 4; stage++)
      assert.equal(
        persisted[stage].clears,
        1,
        `Stage ${stage} is recorded exactly once`,
      );
    assert.equal(persisted[5].clears, 2);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".play-button").waitFor({ state: "visible" });
    assert.deepEqual(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("sfh:tangent:records:v1")),
      ),
      persisted,
    );
    await page.locator(".play-button").tap();
    assert.equal(await page.locator(".stage-card.cleared").count(), 5);
    check("All per-stage best records survive a real page reload");

    await page.setViewportSize({ width: 740, height: 360 });
    await chooseStage(1);
    await page.waitForFunction(
      () => window.__curveGame.run.clock >= 0.35,
      undefined,
      { polling: "raf" },
    );
    await page.locator(".pause-button").tap();
    await page.locator(".pause-modal").waitFor({ state: "visible" });
    const paused = await state();
    await page.waitForTimeout(200);
    sameRun(paused, await state(), "pause at 740×360");
    await screenshot("tangent-mobile-pause.png");
    check("740×360 touch pause freezes physics and scored time");
    // Chromium's real native fullscreen window cannot be resized until restored.
    // Exit via the app's actual control before emulating a physical rotation.
    if (await page.evaluate(() => Boolean(document.fullscreenElement))) {
      await page.locator(".pause-options .text-button").nth(1).tap();
      await page.waitForFunction(() => !document.fullscreenElement, undefined, {
        timeout: 5000,
      });
      sameRun(paused, await state(), "fullscreen exit while paused");
      check("Actual fullscreen control exits without changing the paused run");
    }
    await page.locator(".pause-modal .primary").tap();
    await waitPlaying();
    await page.waitForFunction(
      (clock) => window.__curveGame.run.clock >= clock + 0.1,
      paused.clock,
      { polling: "raf" },
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(".rotate-screen").waitFor({ state: "visible" });
    await page.waitForFunction(
      () => window.__curveGame.state.phase === "paused",
      undefined,
      { timeout: 5000 },
    );
    const rotated = await state();
    await page.waitForTimeout(200);
    sameRun(rotated, await state(), "portrait rotation");
    await screenshot("tangent-portrait.png");
    check(
      "390×844 rotation shows the Korean landscape prompt and preserves the paused run",
    );
    await page.setViewportSize({ width: 740, height: 360 });
    await page.locator(".rotate-screen").waitFor({ state: "hidden" });
    await page.locator(".pause-actions .secondary").first().tap();
    await waitPlaying();
    const mobileLaunch = await tapAt(1.65, "positive");
    await page.waitForFunction(
      () => window.__curveGame.state.phase === "clear",
      undefined,
      { timeout: 15000 },
    );
    const mobileResult = await state();
    assert.equal(mobileResult.stats.misses, 0);
    assert.equal(mobileResult.stats.jumps, 1);
    const mobileLayout = await resultFits();
    await page.waitForTimeout(1100);
    await screenshot("tangent-mobile.png");
    check(
      "740×360 real touch play reaches the result after rotation and UI restart",
      {
        launch: mobileLaunch,
        time: mobileResult.stats.time,
        resultLayout: mobileLayout,
      },
    );

    const fullscreen = await page.evaluate(() => ({
      supported: document.fullscreenEnabled,
      active: Boolean(document.fullscreenElement),
      orientationLockAvailable: typeof screen.orientation?.lock === "function",
    }));
    check(
      "Optional fullscreen/orientation APIs do not interrupt play",
      fullscreen,
    );
    await page.locator(".result-actions .secondary").last().tap();
    await page.locator(".select-heading .icon-button").tap();
    await page.waitForFunction(() => !document.fullscreenElement, undefined, {
      timeout: 5000,
    });
  }

  // The browser enforces a genuine Permissions-Policy restriction. Only an HTTP
  // response header changes; application code, game state and timing stay intact.
  const fallbackUrl = await permissionsProxy();
  const fallbackContext = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  page = await fallbackContext.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__sfhPointerReads = [];
    document.addEventListener(
      "pointerdown",
      (event) => {
        const game = window.__curveGame;
        window.__sfhPointerReads.push({
          button: event.button,
          isPrimary: event.isPrimary,
          pointerType: event.pointerType,
          target: event.target.tagName,
          phase: game?.state.phase,
          clock: game?.run.clock,
          controlsBlocked: game?.controlsBlocked,
        });
      },
      true,
    );
  });
  await page.goto(fallbackUrl, { waitUntil: "domcontentloaded" });
  await page.locator(".play-button").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => document.fullscreenEnabled), false);
  await finishRoute({
    stage: 1,
    name: "fullscreen unavailable fallback",
    taps: [1.65],
    sign: "positive",
  });
  assert.equal(
    await page.evaluate(() => Boolean(document.fullscreenElement)),
    false,
  );
  check(
    "Browser-enforced unavailable fullscreen falls back to a playable CSS landscape frame",
  );
  assert.deepEqual(report.pageErrors, [], "no uncaught browser runtime errors");
  assert.deepEqual(report.consoleErrors, [], "no browser console errors");
  check("Browser console and runtime error checks are clean");
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = { message: error.message, stack: error.stack };
  if (page && !page.isClosed()) {
    try {
      report.failure.liveState = await state();
      report.failure.surface = await page.evaluate(() => ({
        viewport: { width: innerWidth, height: innerHeight },
        fullscreen: Boolean(document.fullscreenElement),
        controlsBlocked: window.__curveGame.controlsBlocked,
        middleElement: document
          .elementFromPoint(innerWidth * 0.35, innerHeight * 0.78)
          ?.outerHTML.slice(0, 300),
      }));
      report.failure.pointerReads = await page.evaluate(
        () => window.__sfhPointerReads,
      );
      const failureDir = resolve(root, "work/browser-smoke");
      await mkdir(failureDir, { recursive: true });
      await page.screenshot({
        path: resolve(failureDir, "failure.png"),
        fullPage: false,
      });
      report.failure.screenshot = "work/browser-smoke/failure.png";
    } catch {
      /* Keep the original error if the page or dev hook is gone. */
    }
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (fallbackServer) {
    for (const socket of fallbackSockets) socket.destroy();
    await new Promise((resolveClose) => fallbackServer.close(resolveClose));
  }
  report.completedAt = new Date().toISOString();
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Verification saved: ${reportPath}`);
}
