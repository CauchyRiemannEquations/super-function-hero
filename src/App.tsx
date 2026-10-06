import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Heart,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
  Trophy,
} from "lucide-react";
import { Game, INITIAL, type Snapshot } from "./game/engine";
import { CHAPTERS, DURATION, REQUIRED_CORES } from "./game/stage";
import { SKILLS, type Skill } from "./game/trajectory";
import Graph from "./components/SkillGraph";
import MobileSkills from "./components/MobileSkills";
import TitleScreen from "./components/TitleScreen";
import { loadArt } from "./game/assets";
import RotateScreen from "./components/RotateScreen";
import {
  LANDSCAPE_QUERY,
  enterGameFullscreen,
  leaveGameFullscreen,
} from "./game/browser-mode";

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

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<Game | null>(null),
    arena = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<Snapshot>({ ...INITIAL });
  const [artReady, setArtReady] = useState(false);
  const [muted, setMuted] = useState(false),
    [help, setHelp] = useState(false),
    [debug, setDebug] = useState(false);
  const [fullscreen, setFullscreen] = useState(false),
    [best, setBest] = useState(0);
  const landscape = useMediaQuery(LANDSCAPE_QUERY);
  const touch = useMediaQuery("(pointer: coarse)");
  const immersive = true;
  useLayoutEffect(() => {
    document.body.classList.add("game-immersive");
    engine.current?.setImmersive(true);
    engine.current?.setPlayAllowed(landscape);
    window.scrollTo(0, 0);
    return () => {
      document.body.classList.remove("game-immersive");
    };
  }, [landscape]);
  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem("curve-run-best") || 0));
    } catch {
      /* Private browsing is supported. */
    }
    const game = new Game(canvas.current!, setState);
    engine.current = game;
    game.setImmersive(true);
    game.setPlayAllowed(matchMedia(LANDSCAPE_QUERY).matches);
    let active = true;
    void loadArt().then(() => {
      game.artReady = true;
      if (active) setArtReady(true);
    });
    if (import.meta.env.DEV)
      (window as unknown as { __curveGame?: Game }).__curveGame = game;
    return () => {
      active = false;
      game.dispose();
      engine.current = null;
      if (import.meta.env.DEV)
        delete (window as unknown as { __curveGame?: Game }).__curveGame;
    };
  }, []);
  useEffect(() => {
    if (state.score > best && ["clear", "over"].includes(state.phase)) {
      setBest(state.score);
      try {
        localStorage.setItem("curve-run-best", String(state.score));
      } catch {
        /* Storage is optional. */
      }
    }
  }, [state.phase, state.score, best]);
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
  const start = () => {
    setHelp(false);
    engine.current?.start();
    if (landscape && arena.current)
      void enterGameFullscreen(arena.current, touch);
  };
  const exit = () => {
    setHelp(false);
    engine.current?.returnToTitle();
    void leaveGameFullscreen();
  };
  const sound = () => {
    const next = !muted;
    setMuted(next);
    if (engine.current) {
      engine.current.audio.enabled = !next;
      if (!next) engine.current.audio.unlock();
    }
  };
  const openHelp = () => {
    if (state.phase === "playing") engine.current?.pause();
    setHelp(true);
  };
  const full = async () => {
    if (document.fullscreenElement) await leaveGameFullscreen();
    else if (arena.current) await enterGameFullscreen(arena.current, touch);
  };
  const playable = state.phase === "playing";
  const chapter = CHAPTERS[state.chapter];
  const remaining = Math.ceil(Math.max(0, DURATION - state.time));
  return (
    <main className="game-app immersive">
      <div
        className={`arena ${fullscreen ? "fullscreen" : ""} ${state.phase === "ready" ? "is-ready" : ""}`}
        ref={arena}
      >
        <section
          className="game-stage"
          aria-label="게임 화면"
          inert={!landscape}
          aria-hidden={!landscape}
        >
          <canvas
            ref={canvas}
            aria-label="자동으로 달리는 캐릭터와 함수 궤적이 표시되는 횡스크롤 게임"
          />
          <div className="hud">
            <div className="health">
              <span className="hud-label">ENERGY</span>
              <div aria-label={`HP ${state.hp} / 3`}>
                {[0, 1, 2].map((i) => (
                  <Heart
                    key={i}
                    size={20}
                    className={i < state.hp ? "alive" : "empty"}
                    fill={i < state.hp ? "currentColor" : "none"}
                  />
                ))}
              </div>
            </div>
            <div className="score">
              <span className="hud-label">SCORE</span>
              <strong>{String(state.score).padStart(6, "0")}</strong>
            </div>
            <div className="core-counter">
              <span className="hud-label">CORE</span>
              <strong>
                {state.cores}
                <small>/{REQUIRED_CORES}</small>
              </strong>
            </div>
            <div className="stage-time">
              <span className="hud-label">
                SECTION {String(state.chapter + 1).padStart(2, "0")}/04
              </span>
              <div>
                <span className="progress">
                  <i style={{ width: `${(state.time / DURATION) * 100}%` }} />
                </span>
                <strong>
                  {Math.floor(remaining / 60)}:
                  {String(remaining % 60).padStart(2, "0")}
                </strong>
              </div>
            </div>
            <div className="game-tools">
              <button
                aria-label={muted ? "효과음 켜기" : "효과음 끄기"}
                onClick={sound}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <button aria-label="전체 화면" onClick={full}>
                <Maximize2 size={17} />
              </button>
              <button
                aria-label={state.phase === "paused" ? "계속하기" : "일시정지"}
                disabled={!["playing", "paused"].includes(state.phase)}
                onClick={() => engine.current?.togglePause()}
              >
                {state.phase === "paused" ? (
                  <Play size={18} />
                ) : (
                  <Pause size={18} />
                )}
              </button>
              {immersive && state.phase !== "ready" && (
                <button aria-label="게임 화면 나가기" onClick={exit}>
                  <X size={18} />
                </button>
              )}
            </div>
          </div>
          {playable && (
            <div className="chapter-chip" key={`chapter-${state.chapter}`}>
              <span>0{state.chapter + 1} /</span>
              {chapter.name}
            </div>
          )}
          {state.combo > 1 && playable && (
            <div className="combo" key={`combo-${state.combo}`}>
              <span>COMBO</span>
              <strong>×{state.combo}</strong>
            </div>
          )}
          {state.phase === "ready" && !help && (
            <TitleScreen
              start={start}
              help={openHelp}
              ready={artReady}
              best={best}
            />
          )}
          {state.phase === "paused" && !help && (
            <div className="overlay">
              <div className="modal pause-modal">
                <span className="eyebrow">TAKE A BREATHER</span>
                <h2>잠깐, 숨 고르기.</h2>
                <p>당신의 다음 곡선을 기다리고 있어요.</p>
                <button
                  className="primary"
                  onClick={() => engine.current?.togglePause()}
                >
                  계속 달리기 <Play size={19} />
                </button>
                <button className="secondary" onClick={start}>
                  <RotateCcw size={16} />
                  처음부터 다시
                </button>
                {immersive && (
                  <button className="secondary" onClick={exit}>
                    타이틀로 돌아가기
                  </button>
                )}
                <small>Space / Esc로 계속하기</small>
              </div>
            </div>
          )}
          {["clear", "over"].includes(state.phase) && !help && (
            <div className="overlay result-overlay">
              <div className="modal result">
                <span
                  className={`result-icon ${state.phase === "over" ? "failed" : ""}`}
                >
                  {state.phase === "clear" ? (
                    <Trophy size={27} />
                  ) : (
                    <RotateCcw size={27} />
                  )}
                </span>
                <span className="eyebrow">
                  {state.phase === "clear"
                    ? "MISSION COMPLETE"
                    : "ONE MORE CURVE?"}
                </span>
                <h2>
                  {state.phase === "clear" ? "NICE RUN!" : "다시, 한 번 더."}
                </h2>
                <p>
                  {state.phase === "clear"
                    ? "모든 CORE를 열고 스카이라인을 돌파했습니다."
                    : state.failure || "다음 곡선으로 다시 돌파해 보세요."}
                </p>
                <div className="result-score">
                  <span>FINAL SCORE</span>
                  <strong>{state.score.toLocaleString()}</strong>
                </div>
                <div className="result-stats">
                  <div>
                    <span>MAX COMBO</span>
                    <strong>×{state.maxCombo}</strong>
                  </div>
                  <div>
                    <span>PERFECT</span>
                    <strong>{state.perfects}</strong>
                  </div>
                  <div>
                    <span>HITS</span>
                    <strong>{state.kills}</strong>
                  </div>
                  <div>
                    <span>CORE</span>
                    <strong>
                      {state.cores}/{REQUIRED_CORES}
                    </strong>
                  </div>
                </div>
                <button className="primary" onClick={start}>
                  다시 달리기 <RotateCcw size={18} />
                </button>
                {immersive && (
                  <button className="secondary" onClick={exit}>
                    타이틀로 돌아가기
                  </button>
                )}
                <small>
                  최고 기록 {Math.max(best, state.score).toLocaleString()} ·
                  Enter / R로 즉시 재도전
                </small>
              </div>
            </div>
          )}
          {help && (
            <div className="overlay">
              <div className="modal guide">
                <button
                  className="close-guide"
                  aria-label="가이드 닫기"
                  onClick={() => setHelp(false)}
                >
                  <X size={20} />
                </button>
                <span className="eyebrow">HOW TO FLOW</span>
                <h2>보이는 곡선대로, 움직이세요.</h2>
                <p>
                  HAZARD는 피하고, ENEMY는 보너스. CORE를 깨면 연결된 문이
                  열립니다.
                </p>
                <div className="guide-skills">
                  {(Object.keys(SKILLS) as Skill[]).map((k) => (
                    <div key={k} style={{ color: SKILLS[k].color }}>
                      <Graph skill={k} />
                      <div>
                        <strong>
                          <kbd>{SKILLS[k].key}</kbd> {SKILLS[k].name}
                        </strong>
                        <span>{SKILLS[k].hint}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="guide-note">
                  공중에서 시작한 급강하만 충격판과 금 간 바닥을 부숩니다. 지상
                  급강하는 짧은 공격입니다. 적은 놓쳐도 계속 달립니다. 붉은
                  위험물과 닫힌 문에 충돌하면 HP가 줄어듭니다.
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    setHelp(false);
                    if (state.phase === "paused") engine.current?.togglePause();
                  }}
                >
                  준비됐어요 <ChevronRight size={19} />
                </button>
              </div>
            </div>
          )}
          {immersive && (
            <MobileSkills
              active={state.skill}
              queued={state.bufferedSkill}
              enabled={playable && landscape}
              showKeys={!touch}
              cast={(skill) => engine.current?.cast(skill)}
            />
          )}
          {import.meta.env.DEV && landscape && (
            <div className="debug">
              <button className="debug-toggle" onClick={() => setDebug(!debug)}>
                DEV {debug ? "−" : "+"}
              </button>
              {debug && (
                <div className="debug-panel">
                  <code>
                    {state.fps.toFixed(0)} FPS · x {state.x.toFixed(1)} / y{" "}
                    {state.y.toFixed(1)}
                    <br />
                    {state.skill ?? state.motion} · {state.time.toFixed(2)}s
                  </code>
                  <label>
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (engine.current)
                          engine.current.debug.hitboxes = e.target.checked;
                      }}
                    />
                    Hitboxes
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (engine.current)
                          engine.current.debug.invincible = e.target.checked;
                      }}
                    />
                    무적
                  </label>
                  <label>
                    이동 속도
                    <select
                      defaultValue="1"
                      onChange={(e) => {
                        if (engine.current)
                          engine.current.debug.speed = Number(e.target.value);
                      }}
                    >
                      <option value="0.5">0.5×</option>
                      <option value="1">1×</option>
                      <option value="1.5">1.5×</option>
                      <option value="2">2×</option>
                    </select>
                  </label>
                  <div className="debug-actions">
                    <button onClick={() => engine.current?.spawn("bot")}>
                      지상 적
                    </button>
                    <button onClick={() => engine.current?.spawn("drone")}>
                      공중 적
                    </button>
                    <button onClick={() => engine.current?.spawn("spike")}>
                      장애물
                    </button>
                  </div>
                  <div className="debug-actions">
                    {(Object.keys(SKILLS) as Skill[]).map((k) => (
                      <button key={k} onClick={() => engine.current?.cast(k)}>
                        {SKILLS[k].formula}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
        {!landscape && <RotateScreen fullscreen={() => void full()} />}
      </div>
    </main>
  );
}
