import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  AudioLines,
  ChevronRight,
  CircleHelp,
  Heart,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
  Zap,
  Flag,
  Trophy,
} from "lucide-react";
import { Game, INITIAL, type Snapshot } from "./game/engine";
import { CHAPTERS, DURATION } from "./game/stage";
import { SKILLS, type Skill } from "./game/trajectory";

function Graph({
  skill,
  className = "",
}: {
  skill: Skill;
  className?: string;
}) {
  const paths = {
    line: "M12 54 L64 12",
    rise: "M10 52 Q46 52 64 10",
    dive: "M10 12 Q46 12 64 54",
    wave: "M5 34 C14 5 25 5 34 34 S54 63 65 34 S77 9 83 22",
  };
  return (
    <svg
      className={className}
      viewBox="0 0 88 68"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 8 V58 H80"
        stroke="currentColor"
        opacity=".17"
        strokeWidth="1.5"
      />
      <path
        d={paths[skill]}
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<Game | null>(null),
    arena = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<Snapshot>({ ...INITIAL });
  const [muted, setMuted] = useState(false),
    [help, setHelp] = useState(false),
    [debug, setDebug] = useState(false);
  const [fullscreen, setFullscreen] = useState(false),
    [best, setBest] = useState(0);
  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem("curve-run-best") || 0));
    } catch {
      /* Private browsing is supported. */
    }
    const game = new Game(canvas.current!, setState);
    engine.current = game;
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
    const onFull = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFull);
    return () => document.removeEventListener("fullscreenchange", onFull);
  }, []);
  const start = () => {
    setHelp(false);
    engine.current?.start();
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
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (arena.current?.requestFullscreen)
        await arena.current.requestFullscreen();
    } catch {
      /* The game remains playable if the browser disallows fullscreen. */
    }
  };
  const playable = state.phase === "playing";
  const chapter = CHAPTERS[state.chapter];
  return (
    <main className="shell">
      <header className="header">
        <a className="brand" href="./" aria-label="CURVE RUN 홈">
          <span className="brand-mark">
            <Zap size={23} strokeWidth={2.5} />
          </span>
          <span>
            CURVE<span className="brand-light">RUN</span>
            <i />
          </span>
        </a>
        <div className="header-right">
          <span className="prototype">
            <span /> PLAYABLE PROTOTYPE <b>01</b>
          </span>
          <span className="header-divider" />
          <button className="text-button" onClick={openHelp}>
            <CircleHelp size={17} />
            플레이 가이드
          </button>
        </div>
      </header>
      <section className="intro">
        <div>
          <div className="eyebrow">
            <span /> A LITTLE MATH. A LOT OF ACTION.
          </div>
          <h1>
            함수를 타고,
            <br className="mobile-break" /> <span>한계를 넘어.</span>
            <span className="title-star">✳</span>
          </h1>
          <p>
            곡선은 당신의 기술. 리듬은 당신의 무기.
            <span className="desktop-copy">
              {" "}
              네 가지 함수로 옥상을 질주하세요.
            </span>
          </p>
        </div>
        <div className="mission-label">
          <span className="mission-icon">
            <Flag size={23} />
          </span>
          <div>
            <span>MISSION 01</span>
            <strong>루프탑 러시</strong>
            <small>38초 · 곡선을 잇는 첫 번째 모험</small>
          </div>
          <ArrowUpRight size={20} />
        </div>
      </section>

      <div className={`arena ${fullscreen ? "fullscreen" : ""}`} ref={arena}>
        <section className="game-stage" aria-label="게임 화면">
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
            <div className="stage-time">
              <span className="hud-label">STAGE 01</span>
              <div>
                <span className="progress">
                  <i style={{ width: `${(state.time / DURATION) * 100}%` }} />
                </span>
                <strong>
                  {String(
                    Math.max(0, DURATION - Math.floor(state.time)),
                  ).padStart(2, "0")}
                  <small>s</small>
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
            <div className="ready-content">
              <span className="pill">
                <span /> READY TO MAKE A MOVE?
              </span>
              <h2>
                공식 말고,
                <br />
                <em>액션으로.</em>
              </h2>
              <p>
                누르는 순간, 그래프가 움직임이 됩니다.
                <br />네 가지 기술로 나만의 콤보를 만드세요.
              </p>
              <button className="primary" onClick={start}>
                플레이 시작 <ArrowUpRight size={21} />
              </button>
              <small>
                <kbd>Enter</kbd> 로 시작 · 38초의 짧은 러시
              </small>
            </div>
          )}
          {state.phase === "ready" && !help && (
            <div className="ready-annotation">
              <span className="annotation-arrow">↗</span>
              <span>
                YOUR CURVE.
                <br />
                YOUR MOVE.
              </span>
            </div>
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
                    ? "옥상 끝까지 도착! 이번엔 더 긴 콤보에 도전해 보세요."
                    : "곡선 하나가 흐름을 바꿔요. 바로 다시 달려볼까요?"}
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
                </div>
                <button className="primary" onClick={start}>
                  다시 달리기 <RotateCcw size={18} />
                </button>
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
                  캐릭터는 자동으로 달립니다. 적이 가까워지면 기술을 누르세요.
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
                  공중에서 2 → 3을 연결해 보세요. 내려찍기는 지상에서도 도약 후
                  발동합니다. 적을 놓쳐도 계속 달릴 수 있지만, 충돌 3회면 러시가
                  끝납니다.
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
          <div className="stage-bottom">
            <span>
              <span className="live-dot" />
              {state.phase === "ready"
                ? "ROOFTOP DISTRICT"
                : state.phase === "playing"
                  ? chapter.tip
                  : state.phase === "clear"
                    ? "곡선으로 만든 당신의 첫 번째 러시"
                    : "다음 움직임을 준비하세요."}
            </span>
            <span>01 — SEOUL SKYLINE</span>
          </div>
        </section>
        <section className="controls" aria-label="함수 기술">
          <div className="control-heading">
            <span>
              <span className="tiny-slash" /> CHOOSE YOUR MOVE
            </span>
            <small>
              <span className="pc-hint">
                키보드 <kbd>1</kbd>–<kbd>4</kbd> 또는{" "}
              </span>
              버튼을 탭하세요
              <ChevronRight size={13} />
            </small>
          </div>
          <div className="skill-grid">
            {(Object.keys(SKILLS) as Skill[]).map((k) => (
              <button
                key={k}
                className={`skill skill-${k} ${state.skill === k ? "active" : ""}`}
                style={{ "--skill": SKILLS[k].color } as React.CSSProperties}
                disabled={!playable}
                aria-label={`${SKILLS[k].key} ${SKILLS[k].formula} ${SKILLS[k].name}`}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  engine.current?.cast(k);
                }}
                onClick={(e) => {
                  if (e.detail === 0) engine.current?.cast(k);
                }}
              >
                <span className="skill-number">0{SKILLS[k].key}</span>
                <Graph skill={k} className="skill-graph" />
                <span className="skill-text">
                  <strong>{SKILLS[k].formula}</strong>
                  <span>{SKILLS[k].name}</span>
                </span>
                <kbd>{SKILLS[k].key}</kbd>
                <span className="skill-indicator" />
              </button>
            ))}
          </div>
          <div className="control-footer">
            <span>
              <Zap size={13} /> 타이밍을 맞추면 PERFECT, 흐름을 이으면 COMBO.
            </span>
            <span>
              <AudioLines size={14} /> SOUND ON FOR THE FEEL
            </span>
          </div>
        </section>
      </div>
      <section className="below">
        <div className="design-note">
          <span>THE RULE IS SIMPLE</span>
          <p>
            수학을 푸는 대신,
            <br />
            <strong>수학으로 움직이세요.</strong>
          </p>
        </div>
        <div className="feature-note">
          <span className="note-number">01</span>
          <div>
            <strong>보고, 누르고, 날아오르기.</strong>
            <p>
              함수 이름을 몰라도 괜찮아요.
              <br />
              그래프 모양이 다음 움직임의 힌트입니다.
            </p>
          </div>
        </div>
        <div className="feature-note">
          <span className="note-number">02</span>
          <div>
            <strong>좋은 곡선은 좋은 콤보로.</strong>
            <p>
              어퍼컷에서 내려찍기로, 대시에서 웨이브로.
              <br />
              끊기지 않는 흐름을 찾아보세요.
            </p>
          </div>
        </div>
        <div className="best-record">
          <Trophy size={18} />
          <span>LOCAL BEST</span>
          <strong>{best.toLocaleString().padStart(4, "0")}</strong>
        </div>
      </section>
      <footer className="footer">
        <span>
          CURVE RUN <b>© 2026</b>
        </span>
        <span>
          FOUR FUNCTIONS. INFINITE FLOW.<i>↗</i>
        </span>
      </footer>
      {import.meta.env.DEV && (
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
    </main>
  );
}
