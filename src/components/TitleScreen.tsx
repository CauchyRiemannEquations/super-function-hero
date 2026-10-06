import {
  ArrowUpRight,
  CircleHelp,
  ShieldAlert,
  Bot,
  Target,
  Trophy,
} from "lucide-react";
import { ART } from "../game/assets";
export default function TitleScreen({
  start,
  help,
  ready,
  best,
}: {
  start: () => void;
  help: () => void;
  ready: boolean;
  best: number;
}) {
  return (
    <div
      className="title-screen title-art"
      style={{ backgroundImage: `url(${ART.titleBackground})` }}
    >
      <h2 className="sr-only">Super Function Hero</h2>
      <img
        className="title-logo"
        src={ART.logo}
        alt="Super Function Hero"
        draggable={false}
      />
      <div className="title-launch">
        <span className="title-kicker">V0.3 / CONTINUOUS RUN</span>
        <p>RUN THE GRAPHS.</p>
        <div className="title-actions">
          <button className="primary" disabled={!ready} onClick={start}>
            {ready ? "PLAY" : "준비 중…"} <ArrowUpRight size={22} />
          </button>
          <button
            className="title-help"
            onClick={help}
            aria-label="게임 가이드"
          >
            <CircleHelp size={22} />
          </button>
        </div>
        <div className="title-record">
          <Trophy size={14} />
          <span>LOCAL BEST</span>
          <strong>{best.toLocaleString()}</strong>
        </div>
        <small>2분 30초 · 옥상 → 도심 → 공장 → 네온 러시</small>
      </div>
      <div className="object-legend" aria-label="오브젝트 역할">
        <div className="legend-hazard">
          <ShieldAlert size={21} />
          <strong>HAZARD</strong>
          <span>피한다</span>
        </div>
        <div className="legend-enemy">
          <Bot size={21} />
          <strong>ENEMY</strong>
          <span>보너스</span>
        </div>
        <div className="legend-core">
          <Target size={21} />
          <strong>CORE</strong>
          <span>문을 연다</span>
        </div>
      </div>
    </div>
  );
}
