import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleHelp,
  Coins,
  Flag,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Smartphone,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { Game, INITIAL, type Snapshot } from "./game/engine";
import { STAGES, type StageData } from "./game/stage";
import { sampleSurface } from "./game/trajectory";
import { loadRecords, loadSettings, saveSettings } from "./game/records";
import { enterGameFullscreen, leaveGameFullscreen } from "./game/browser-mode";
import TitleScreen from "./components/TitleScreen";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

const timeLabel = (time: number) => time.toFixed(2);
const guideLabel = (guide: StageData["guide"]) =>
  guide === "always"
    ? "접선 가이드 ON"
    : guide === "pulse"
      ? "짧은 접선 가이드"
      : "힌트로 접선 보기";

function StagePreview({ stage }: { stage: StageData }) {
  const surface = stage.surfaces[0];
  const samples = Array.from(
    { length: 41 },
    (_, index) =>
      sampleSurface(
        surface,
        surface.start + ((surface.end - surface.start) * index) / 40,
      ).y,
  );
  const minimum = Math.min(...samples);
  const range = Math.max(1, Math.max(...samples) - minimum);
  const points = samples.map((y, index) => ({
    x: 5 + (index * 150) / 40,
    y: 102 - ((y - minimum) / range) * 86,
  }));
  const path = points
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");
  const last = points[points.length - 1];
  return (
    <svg className="stage-preview" viewBox="0 0 160 115" aria-hidden="true">
      <path className="preview-shadow" d={path} />
      <path d={path} />
      <circle cx={last.x} cy={last.y} r="4" />
    </svg>
  );
}

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Game | null>(null);
  const arena = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<Snapshot>({ ...INITIAL });
  const [preferences, setPreferences] = useState(loadSettings);
  const [help, setHelp] = useState(false);
  const [settings, setSettings] = useState(false);
  const [hint, setHint] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [selected, setSelected] = useState(0);
  const [records, setRecords] = useState(loadRecords);
  const immersive = useMediaQuery(
    "(orientation: landscape) and (max-height: 600px)",
  );
  const touch = useMediaQuery("(pointer: coarse)");
  const portrait = useMediaQuery(
    "(orientation: portrait) and (max-width: 900px)",
  );

  useLayoutEffect(() => {
    document.body.classList.toggle("game-immersive", immersive);
    if (immersive) window.scrollTo(0, 0);
    return () => document.body.classList.remove("game-immersive");
  }, [immersive]);

  useEffect(() => {
    const game = new Game(canvas.current!, setState);
    engine.current = game;
    const saved = loadSettings();
    game.audio.enabled = !saved.muted;
    game.setReducedMotion(saved.reducedMotion);
    if (import.meta.env.DEV)
      (window as unknown as { __curveGame?: Game }).__curveGame = game;
    return () => {
      game.dispose();
      engine.current = null;
      if (import.meta.env.DEV)
        delete (window as unknown as { __curveGame?: Game }).__curveGame;
    };
  }, []);

  useEffect(() => {
    if (portrait && state.phase === "playing") engine.current?.pause();
  }, [portrait, state.phase]);

  useEffect(() => {
    engine.current?.setControlsBlocked(help || settings || portrait);
  }, [help, settings, portrait]);

  useEffect(() => {
    if (!help && !settings && !portrait && state.phase !== "paused") return;
    const container = dialog.current;
    if (!container) return;
    const previous = document.activeElement;
    const controls = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), [tabindex='0']",
        ),
      );
    (controls()[0] ?? container).focus({ preventScroll: true });
    const onTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = controls();
      if (!items.length) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = items[0],
        last = items[items.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === container)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    container.addEventListener("keydown", onTab);
    return () => {
      container.removeEventListener("keydown", onTab);
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, [help, settings, portrait, state.phase]);

  useEffect(() => {
    if (state.phase === "select" || state.phase === "clear")
      setRecords(loadRecords());
  }, [state.phase]);

  useEffect(() => {
    const onFull = () => {
      setFullscreen(Boolean(document.fullscreenElement));
      if (!document.fullscreenElement) {
        try {
          screen.orientation?.unlock?.();
        } catch {
          /* Optional API. */
        }
      }
    };
    document.addEventListener("fullscreenchange", onFull);
    return () => document.removeEventListener("fullscreenchange", onFull);
  }, []);

  const selectStages = () => {
    setHelp(false);
    setSettings(false);
    setSelected(state.stage);
    engine.current?.select();
  };
  const start = (index: number) => {
    setHelp(false);
    setSettings(false);
    setHint(false);
    engine.current?.setHint(false);
    engine.current?.start(index);
    canvas.current?.focus({ preventScroll: true });
    if (touch && immersive && arena.current)
      void enterGameFullscreen(arena.current, true);
  };
  const title = () => {
    setHelp(false);
    setSettings(false);
    engine.current?.returnToTitle();
    void leaveGameFullscreen();
  };
  const openHelp = () => {
    if (state.phase === "playing" || state.phase === "miss")
      engine.current?.pause();
    setHelp(true);
  };
  const changeSound = () => {
    const next = { ...preferences, muted: !preferences.muted };
    setPreferences(next);
    saveSettings(next);
    if (engine.current) {
      engine.current.audio.enabled = !next.muted;
      if (!next.muted) engine.current.audio.unlock();
    }
  };
  const changeMotion = () => {
    const next = { ...preferences, reducedMotion: !preferences.reducedMotion };
    setPreferences(next);
    saveSettings(next);
    engine.current?.setReducedMotion(next.reducedMotion);
  };
  const full = async () => {
    if (document.fullscreenElement) await leaveGameFullscreen();
    else if (arena.current) await enterGameFullscreen(arena.current, touch);
  };
  const togglePause = () => {
    engine.current?.togglePause();
    canvas.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const interactive =
        event.target instanceof Element &&
        Boolean(event.target.closest("button, input, select, textarea, a"));
      if (event.key === "Escape" && (help || settings)) {
        event.preventDefault();
        setHelp(false);
        setSettings(false);
        return;
      }
      const stageCard =
        event.target instanceof Element &&
        Boolean(event.target.closest(".stage-card"));
      if (help || settings || portrait || (interactive && !stageCard)) return;
      if (state.phase === "ready" && event.key === "Enter") {
        event.preventDefault();
        selectStages();
      } else if (state.phase === "select") {
        if (event.key === "Enter") {
          event.preventDefault();
          start(selected);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          title();
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          setSelected((value) => Math.min(STAGES.length - 1, value + 1));
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          setSelected((value) => Math.max(0, value - 1));
        }
      } else if (state.phase === "clear" && event.key === "Enter") {
        event.preventDefault();
        start(state.stage < STAGES.length - 1 ? state.stage + 1 : state.stage);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    state.phase,
    state.stage,
    selected,
    help,
    settings,
    portrait,
    touch,
    immersive,
  ]);

  const stage = STAGES[state.stage] ?? STAGES[0];
  const chosen = STAGES[selected] ?? STAGES[0];
  const running = ["playing", "paused", "miss"].includes(state.phase);
  const modalOpen = help || settings;
  const totalClears = Object.values(records).filter(
    (record) => record.clears > 0,
  ).length;

  return (
    <main
      className={`shell ${immersive ? "immersive" : ""} ${preferences.reducedMotion ? "reduced-motion" : ""}`}
    >
      <header className="header">
        <button
          className="brand"
          onClick={title}
          aria-label="Super Function Hero 타이틀로"
        >
          <span className="brand-mark">
            <Zap size={23} strokeWidth={2.5} />
          </span>
          <span className="brand-word">
            SUPER FUNCTION <b>HERO</b>
          </span>
        </button>
        <div className="header-right">
          <span className="edition">
            <i /> TANGENT PARKOUR <b>01—05</b>
          </span>
          <button className="text-button" onClick={openHelp}>
            <CircleHelp size={17} /> 플레이 가이드
          </button>
        </div>
      </header>
      <section className="intro">
        <div>
          <span className="eyebrow">THE CURVE IS YOUR PLAYGROUND</span>
          <h2>
            곡선을 달려. <span>순간을 뛰어.</span>
          </h2>
        </div>
        <div className="intro-note">
          <span className="intro-spark">✳</span>
          <p>
            단 한 번의 탭.
            <br />
            <strong>당신이 만드는 하나의 궤적.</strong>
          </p>
        </div>
      </section>
      <div
        className={`arena phase-${state.phase} ${fullscreen ? "fullscreen" : ""}`}
        ref={arena}
      >
        <section className="game-stage" aria-label="Tangent Parkour 게임 화면">
          <canvas
            ref={canvas}
            tabIndex={0}
            aria-label="함수 그래프 위를 달리는 졸라맨. 화면 탭 또는 Space로 접선 방향 점프."
          />
          {running && (
            <div className="hud">
              <div className="hud-stage">
                <span className="hud-label">
                  STAGE {String(state.stage + 1).padStart(2, "0")}
                </span>
                <strong>{stage.name}</strong>
              </div>
              <div className="hud-coins">
                <Coins size={18} />
                <strong>
                  {state.coins}
                  <small> / {state.totalCoins}</small>
                </strong>
              </div>
              <div className="hud-time">
                <span className="hud-label">TIME</span>
                <strong>
                  {timeLabel(state.time)}
                  <small>s</small>
                </strong>
              </div>
              <button
                className="icon-button pause-button"
                onClick={togglePause}
                aria-label={
                  state.phase === "paused" ? "계속 달리기" : "일시정지"
                }
              >
                {state.phase === "paused" ? (
                  <Play size={20} />
                ) : (
                  <Pause size={20} />
                )}
              </button>
            </div>
          )}
          {state.phase === "playing" && (
            <>
              <div className="run-progress" aria-hidden="true">
                <i
                  style={{
                    width: `${Math.max(0, Math.min(1, state.progress)) * 100}%`,
                  }}
                />
              </div>
              {state.stage < 3 && state.time < 5 && (
                <div className="tap-guide">
                  화면을 탭하면, 길이 향하는 방향으로 점프{" "}
                  <span>
                    <kbd>Space</kbd> / TAP
                  </span>
                </div>
              )}
              {state.event && (
                <div
                  className={`run-event ${state.event.includes("PERFECT") ? "perfect-event" : ""}`}
                  key={state.event}
                >
                  <span>{state.event}</span>
                  {state.combo > 1 && <small>COMBO ×{state.combo}</small>}
                </div>
              )}
            </>
          )}
          {state.phase === "miss" && (
            <div className="miss-flash" role="status">
              <strong>MISS!</strong>
              <span>체크포인트에서 바로 다시 · +1s</span>
            </div>
          )}
          {state.phase === "ready" && !modalOpen && (
            <TitleScreen
              start={selectStages}
              help={openHelp}
              settings={() => setSettings(true)}
            />
          )}
          {state.phase === "select" && !modalOpen && (
            <div className="stage-select">
              <div className="select-heading">
                <div>
                  <span className="eyebrow">CHOOSE YOUR RUN</span>
                  <h2>다음 자취는 어디로?</h2>
                </div>
                <button
                  className="icon-button"
                  onClick={title}
                  aria-label="타이틀로 돌아가기"
                >
                  <ArrowLeft size={21} />
                </button>
              </div>
              <div
                className="stage-grid"
                role="group"
                aria-label="스테이지 선택"
              >
                {STAGES.map((item, index) => {
                  const record = records[item.id];
                  return (
                    <button
                      key={item.id}
                      className={`stage-card ${selected === index ? "selected" : ""} ${record?.clears ? "cleared" : ""}`}
                      onClick={() => setSelected(index)}
                      aria-pressed={selected === index}
                    >
                      <div className="card-top">
                        <span>0{index + 1}</span>
                        {record?.clears ? (
                          <Check size={16} />
                        ) : (
                          <ArrowUpRight size={16} />
                        )}
                      </div>
                      <StagePreview stage={item} />
                      <strong>{item.name}</strong>
                      <p>{item.tagline}</p>
                      <div className="card-record">
                        <span>BEST</span>
                        <b>
                          {record?.bestTime
                            ? `${timeLabel(record.bestTime)} s`
                            : "— —"}
                        </b>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="select-footer">
                <div className="stage-detail">
                  <span>
                    <Flag size={14} /> {guideLabel(chosen.guide)}
                  </span>
                  <p>{chosen.hint}</p>
                </div>
                <button className="primary" onClick={() => start(selected)}>
                  STAGE 0{selected + 1} 달리기 <ArrowRight size={20} />
                </button>
              </div>
              <div className="select-bottom">
                <span>{totalClears} / 5 RUNS COMPLETE</span>
                <span>
                  ← → 선택 <kbd>Enter</kbd> 시작
                </span>
              </div>
            </div>
          )}
          {state.phase === "paused" && !modalOpen && (
            <div className="overlay">
              <div
                className="modal pause-modal"
                ref={dialog}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label="일시정지"
              >
                <span className="eyebrow">TAKE A BREATHER</span>
                <h2>잠깐, 숨 고르기.</h2>
                <p>다음 점프는 당신의 타이밍에.</p>
                <button className="primary" onClick={togglePause}>
                  계속 달리기 <Play size={19} />
                </button>
                <div className="pause-actions">
                  <button
                    className="secondary"
                    onClick={() => start(state.stage)}
                  >
                    <RotateCcw size={17} /> 재시작
                  </button>
                  <button className="secondary" onClick={selectStages}>
                    스테이지 선택 <ArrowRight size={17} />
                  </button>
                </div>
                <div className="pause-options">
                  <button className="text-button" onClick={changeSound}>
                    {preferences.muted ? (
                      <VolumeX size={17} />
                    ) : (
                      <Volume2 size={17} />
                    )}{" "}
                    사운드 {preferences.muted ? "OFF" : "ON"}
                  </button>
                  <button className="text-button" onClick={full}>
                    <Maximize2 size={16} /> 전체 화면
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setSettings(true)}
                  >
                    <Settings2 size={16} /> 설정
                  </button>
                </div>
                <label className="hint-option">
                  <input
                    type="checkbox"
                    checked={hint}
                    onChange={(event) => {
                      setHint(event.target.checked);
                      engine.current?.setHint(event.target.checked);
                    }}
                  />
                  <span>접선 힌트 켜기</span>
                  <small>필요할 때만 길의 방향을 확인하세요.</small>
                </label>
                <small className="keyboard-note">
                  <kbd>Esc</kbd> 계속 <span /> <kbd>R</kbd> 재시작
                </small>
              </div>
            </div>
          )}
          {state.phase === "clear" && !modalOpen && (
            <div className="result-overlay">
              <div className="trace-caption">
                <span className="eyebrow">
                  <i /> YOUR TRACE
                </span>
                <h2>이것이 당신의 자취.</h2>
                <p>한 번의 질주, 하나의 그림.</p>
                <span className="trace-key">
                  <i /> RUN <i /> FLIGHT
                </span>
              </div>
              <div className="result-panel">
                <span className="eyebrow">
                  <Trophy size={15} /> RUN COMPLETE / 0{state.stage + 1}
                </span>
                <h2>
                  CLEAR<span>!</span>
                </h2>
                <div className="finish-time">
                  <strong>
                    {timeLabel(state.time)}
                    <small>s</small>
                  </strong>
                  {state.newBest && <span>NEW BEST</span>}
                </div>
                <div className="result-stats">
                  <div>
                    <span>COIN</span>
                    <b>
                      {state.coins}
                      <small> / {state.totalCoins}</small>
                    </b>
                  </div>
                  <div>
                    <span>JUMP</span>
                    <b>{state.jumps}</b>
                  </div>
                  <div>
                    <span>PERFECT TANGENT</span>
                    <b>×{state.perfects}</b>
                  </div>
                  <div>
                    <span>PERFECT LANDING</span>
                    <b>×{state.perfectLandings}</b>
                  </div>
                  <div>
                    <span>MAX COMBO</span>
                    <b>×{state.maxCombo}</b>
                  </div>
                  <div>
                    <span>SCORE</span>
                    <b>{state.score.toLocaleString()}</b>
                  </div>
                </div>
                <div className="result-best">
                  <span>BEST TIME</span>
                  <b>{timeLabel(state.bestTime ?? state.time)} s</b>
                  <span>MISS {state.misses}</span>
                </div>
                <div className="slope-feedback">
                  <span>LAST JUMP</span>
                  <b>
                    {Math.abs(state.lastSlope) < 0.12
                      ? "Zero slope →"
                      : state.lastSlope > 0
                        ? "Positive slope ↗"
                        : "Negative slope ↘"}
                  </b>
                  <small>
                    x = {state.lastJumpX.toFixed(1)} · slope{" "}
                    {state.lastSlope.toFixed(2)}
                  </small>
                </div>
                {state.stage < STAGES.length - 1 && (
                  <button
                    className="primary"
                    onClick={() => start(state.stage + 1)}
                  >
                    다음 스테이지 <ArrowRight size={18} />
                  </button>
                )}
                <div className="result-actions">
                  <button
                    className="secondary"
                    onClick={() => start(state.stage)}
                  >
                    <RotateCcw size={16} /> 다시 달리기
                  </button>
                  <button className="secondary" onClick={selectStages}>
                    스테이지 <ArrowUpRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
          {help && (
            <div className="overlay">
              <div
                className="modal guide-modal"
                ref={dialog}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label="플레이 가이드"
              >
                <button
                  className="close-modal icon-button"
                  aria-label="조작법 닫기"
                  onClick={() => setHelp(false)}
                >
                  <X size={20} />
                </button>
                <span className="eyebrow">ONE TAP. THAT'S IT.</span>
                <h2>곡선을 보고, 탭.</h2>
                <p>
                  자동으로 달립니다. 탭하는 순간,
                  <br />
                  발밑 길이 향하는 방향으로 날아갑니다.
                </p>
                <div className="direction-guide">
                  <div>
                    <span>↗</span>
                    <b>오르막</b>
                    <small>위로 날아가기</small>
                  </div>
                  <div>
                    <span>→</span>
                    <b>평평한 길</b>
                    <small>옆으로 날아가기</small>
                  </div>
                  <div>
                    <span>↘</span>
                    <b>내리막</b>
                    <small>아래로 날아가기</small>
                  </div>
                </div>
                <p className="guide-note">
                  코인을 모으고, 붉은 장애물을 피해서 깃발까지.
                  <br />
                  어디에서 뛰느냐에 따라 당신의 길이 달라집니다.
                </p>
                <div className="guide-controls">
                  <span>
                    <kbd>Space</kbd> / 화면 탭 : 점프
                  </span>
                  <span>
                    <kbd>P</kbd> / <kbd>Esc</kbd> : 일시정지
                  </span>
                  <span>
                    <kbd>R</kbd> : 바로 재시작
                  </span>
                </div>
                <button className="primary" onClick={() => setHelp(false)}>
                  알겠어요 <Check size={18} />
                </button>
              </div>
            </div>
          )}
          {settings && (
            <div className="overlay">
              <div
                className="modal settings-modal"
                ref={dialog}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label="플레이 설정"
              >
                <button
                  className="close-modal icon-button"
                  aria-label="설정 닫기"
                  onClick={() => setSettings(false)}
                >
                  <X size={20} />
                </button>
                <span className="eyebrow">MAKE IT YOURS</span>
                <h2>플레이 설정</h2>
                <button
                  className="setting-row"
                  onClick={changeSound}
                  role="switch"
                  aria-checked={!preferences.muted}
                  aria-label="사운드"
                >
                  <span>
                    {preferences.muted ? (
                      <VolumeX size={22} />
                    ) : (
                      <Volume2 size={22} />
                    )}
                    <span>
                      <b>사운드</b>
                      <small>점프·코인·착지 효과음</small>
                    </span>
                  </span>
                  <span
                    className={`toggle ${!preferences.muted ? "on" : ""}`}
                    aria-hidden="true"
                  >
                    <i />
                  </span>
                </button>
                <button
                  className="setting-row"
                  onClick={changeMotion}
                  role="switch"
                  aria-checked={preferences.reducedMotion}
                  aria-label="화면 움직임 줄이기"
                >
                  <span>
                    <Zap size={22} />
                    <span>
                      <b>화면 움직임 줄이기</b>
                      <small>흔들림과 번쩍임을 편안하게</small>
                    </span>
                  </span>
                  <span
                    className={`toggle ${preferences.reducedMotion ? "on" : ""}`}
                    aria-hidden="true"
                  >
                    <i />
                  </span>
                </button>
                <button className="secondary fullscreen-setting" onClick={full}>
                  <Maximize2 size={18} />{" "}
                  {fullscreen ? "전체 화면 나가기" : "전체 화면"}
                </button>
                <button className="primary" onClick={() => setSettings(false)}>
                  완료 <Check size={18} />
                </button>
                <small className="settings-note">
                  설정과 최고 기록은 이 기기에 저장됩니다.
                </small>
              </div>
            </div>
          )}
          {portrait && (
            <div
              className="rotate-screen"
              ref={dialog}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="rotate-title"
            >
              <div className="rotate-icon">
                <Smartphone size={52} />
                <RotateCcw size={24} />
              </div>
              <span className="eyebrow">A LITTLE MORE ROOM TO FLY</span>
              <h2 id="rotate-title">휴대폰을 가로로 돌려주세요.</h2>
              <p>더 넓은 길에서, 더 멋진 자취를.</p>
              <span className="rotate-brand">
                SUPER FUNCTION <b>HERO</b>
              </span>
            </div>
          )}
        </section>
      </div>
      <section className="below">
        <div>
          <span className="note-number">01</span>
          <p>
            <b>달리기는 자동.</b>
            <span>점프의 타이밍은 당신의 것.</span>
          </p>
        </div>
        <div>
          <span className="note-number">02</span>
          <p>
            <b>길의 모양이 힌트.</b>
            <span>기울기를 느끼며 다음 착지를 그려보세요.</span>
          </p>
        </div>
        <div className="local-record">
          <Trophy size={19} />
          <p>
            <span>YOUR JOURNEY</span>
            <b>
              {totalClears}
              <small> / 5 STAGES</small>
            </b>
          </p>
        </div>
      </section>
      <footer className="footer">
        <span>
          SUPER FUNCTION HERO <b>© 2026</b>
        </span>
        <span>
          LEAVE YOUR TRACE. <ArrowUpRight size={15} />
        </span>
      </footer>
    </main>
  );
}
