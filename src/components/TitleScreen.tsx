import { ArrowUpRight, CircleHelp, Settings2 } from "lucide-react";

export default function TitleScreen({
  start,
  help,
  settings,
}: {
  start: () => void;
  help: () => void;
  settings: () => void;
}) {
  return (
    <div className="title-screen">
      <div className="title-copy">
        <span className="title-kicker">
          <i /> TANGENT PARKOUR / VOL. 01
        </span>
        <h1 aria-label="Super Function Hero">
          <span>SUPER</span>
          <span>FUNCTION</span>
          <em>
            HERO<span className="logo-period">.</span>
          </em>
        </h1>
        <p>
          길을 읽고. 순간을 고르고.
          <br />
          당신만의 자취를 남겨라.
        </p>
        <div className="title-actions">
          <button className="primary play-button" onClick={start}>
            PLAY <ArrowUpRight size={23} />
          </button>
          <button
            className="icon-button"
            onClick={help}
            aria-label="조작법 보기"
            title="조작법"
          >
            <CircleHelp size={21} />
          </button>
          <button
            className="icon-button"
            onClick={settings}
            aria-label="설정 열기"
            title="설정"
          >
            <Settings2 size={21} />
          </button>
        </div>
        <small>
          <kbd>Enter</kbd> 시작 <span /> <kbd>Space</kbd> 점프
        </small>
      </div>
      <div className="title-annotation" aria-hidden="true">
        <span>
          ONE TAP.
          <br />
          <b>INFINITE FLOW.</b>
        </span>
        <svg viewBox="0 0 80 45">
          <path d="M6 5Q19 43 69 30M54 22l15 8-11 12" />
        </svg>
      </div>
      <div className="title-bottom">
        <span>
          <i /> 5 STAGES / YOUR OWN ROUTE
        </span>
        <span>
          곡선이 길이 되는 세계 <span className="tiny-spark">✳</span>
        </span>
      </div>
    </div>
  );
}
