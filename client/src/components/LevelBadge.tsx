interface LevelBadgeProps {
  level: number;
  progressPercent: number;
  size?: "sm" | "lg";
}

export function LevelBadge({ level, progressPercent, size = "sm" }: LevelBadgeProps) {
  const px = size === "sm" ? 32 : 64;
  const strokeWidth = size === "sm" ? 3 : 4;
  const radius = (px - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progressPercent / 100) * circumference;
  const fontSize = size === "sm" ? 12 : 24;

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      style={{ display: "block", flexShrink: 0 }}
      aria-label={`Level ${level}, ${Math.round(progressPercent)}% to next`}
    >
      <circle
        cx={px / 2}
        cy={px / 2}
        r={radius}
        fill="rgba(18, 18, 28, 0.9)"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={px / 2}
        cy={px / 2}
        r={radius}
        fill="none"
        stroke="#f59e0b"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${px / 2} ${px / 2})`}
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
      <text
        x={px / 2}
        y={px / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#f4f2ff"
        fontSize={fontSize}
        fontWeight={700}
        fontFamily="'DM Sans', -apple-system, sans-serif"
      >
        {level}
      </text>
    </svg>
  );
}
