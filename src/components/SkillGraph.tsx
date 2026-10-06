import type { Skill } from "../game/trajectory";

const PATHS = {
  line: "M12 54 L64 12",
  rise: "M10 52 Q46 52 64 10",
  dive: "M10 12 Q46 12 64 54",
  wave: "M5 34 C14 5 25 5 34 34 S54 63 65 34 S77 9 83 22",
};

export default function SkillGraph({
  skill,
  className = "",
}: {
  skill: Skill;
  className?: string;
}) {
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
        d={PATHS[skill]}
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
