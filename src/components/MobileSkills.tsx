import type { CSSProperties } from "react";
import { SKILLS, type Skill } from "../game/trajectory";
import SkillGraph from "./SkillGraph";

const GROUPS = [
  {
    side: "left",
    label: "왼쪽 엄지: 전진 기술",
    skills: ["line", "wave"] as Skill[],
  },
  {
    side: "right",
    label: "오른쪽 엄지: 상하 기술",
    skills: ["rise", "dive"] as Skill[],
  },
];
const SHORT = { line: "x", wave: "sin x", rise: "x²", dive: "−x²" };

export default function MobileSkills({
  active,
  queued,
  enabled,
  cast,
  showKeys = false,
}: {
  active: Skill | null;
  queued: Skill | null;
  enabled: boolean;
  cast: (skill: Skill) => void;
  showKeys?: boolean;
}) {
  return (
    <div className="mobile-skill-hud" aria-label="인게임 함수 기술">
      {GROUPS.map((group) => (
        <div
          className={`thumb-controls thumb-${group.side}`}
          role="group"
          aria-label={group.label}
          key={group.side}
        >
          {group.skills.map((skill) => (
            <button
              type="button"
              key={skill}
              className={`thumb-skill ${active === skill ? "active" : ""} ${queued === skill ? "queued" : ""}`}
              style={{ "--skill": SKILLS[skill].color } as CSSProperties}
              aria-label={`${SKILLS[skill].key} ${SKILLS[skill].formula} ${SKILLS[skill].name}`}
              disabled={!enabled}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                cast(skill);
              }}
              onClick={(event) => {
                if (event.detail === 0) cast(skill);
              }}
            >
              <span className="thumb-face">
                {showKeys && (
                  <kbd className="thumb-key">{SKILLS[skill].key}</kbd>
                )}
                <SkillGraph skill={skill} />
                <strong>{SHORT[skill]}</strong>
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
