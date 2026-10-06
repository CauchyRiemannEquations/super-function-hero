import { Smartphone, RotateCw, Maximize2 } from "lucide-react";
import { ART } from "../game/assets";

export default function RotateScreen({
  fullscreen,
}: {
  fullscreen: () => void;
}) {
  return (
    <section
      className="rotate-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rotate-title"
    >
      <img className="rotate-logo" src={ART.logo} alt="Super Function Hero" />
      <div className="rotate-symbol" aria-hidden="true">
        <Smartphone size={62} />
        <RotateCw size={29} />
      </div>
      <h1 id="rotate-title">가로 화면으로 전환하세요</h1>
      <p>
        휴대폰을 가로로 돌리거나
        <br />
        창의 가로 폭을 넓혀주세요.
      </p>
      {document.fullscreenEnabled && (
        <button className="rotate-fullscreen" onClick={fullscreen}>
          <Maximize2 size={18} />
          전체 화면으로 보기
        </button>
      )}
    </section>
  );
}
