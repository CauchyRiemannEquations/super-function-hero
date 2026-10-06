import {
  ArrowUpRight,
  CircleHelp,
  ShieldAlert,
  Bot,
  Target,
} from "lucide-react";

export default function TitleScreen({
  start,
  help,
}: {
  start: () => void;
  help: () => void;
}) {
  return (
    <div className="title-screen">
      <div className="title-copy">
        <span className="title-kicker">V0.2 / SKYLINE BREACH</span>
        <h2>
          <span>SUPER</span>
          <span>FUNCTION</span>
          <em>HERO</em>
        </h2>
        <p>곡선으로 돌파하라.</p>
        <div className="title-actions">
          <button className="primary" onClick={start}>
            플레이 시작 <ArrowUpRight size={20} />
          </button>
          <button
            className="title-help"
            onClick={help}
            aria-label="게임 가이드"
          >
            <CircleHelp size={21} />
          </button>
        </div>
        <small>60초 · 네 개의 함수 · 하나의 연속 코스</small>
      </div>
      <div className="object-legend" aria-label="오브젝트 역할">
        <div className="legend-hazard">
          <ShieldAlert size={23} />
          <strong>HAZARD</strong>
          <span>피한다</span>
        </div>
        <div className="legend-enemy">
          <Bot size={23} />
          <strong>ENEMY</strong>
          <span>보너스</span>
        </div>
        <div className="legend-core">
          <Target size={23} />
          <strong>CORE</strong>
          <span>문을 연다</span>
        </div>
      </div>
    </div>
  );
}
