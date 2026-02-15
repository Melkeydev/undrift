const LEVEL_THRESHOLDS: readonly number[] = [
  0, 100, 350, 800, 1500, 2500, 4000, 6000, 9000, 13000,
  18000, 23000, 28000, 33000, 38000, 43000, 48000, 53000, 58000, 63000,
  73000, 83000, 93000, 103000, 113000, 123000, 133000, 143000, 153000, 163000,
  173000, 183000, 193000, 203000, 213000, 223000, 233000, 243000, 253000, 263000,
  273000, 283000, 293000, 303000, 313000, 323000, 333000, 343000, 353000, 363000,
];

export function calculateLevel(totalXP: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_THRESHOLDS[i]!) {
      return i + 1;
    }
  }
  return 1;
}

export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  const idx = level - 1;
  if (idx < LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[idx]!;
  const extra = idx - LEVEL_THRESHOLDS.length + 1;
  return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]! + extra * 20000;
}

export function getXPProgress(totalXP: number): {
  level: number;
  progressPercent: number;
  xpToNext: number;
  currentLevelXP: number;
  nextLevelXP: number;
} {
  const level = calculateLevel(totalXP);
  const currentLevelXP = getXPForLevel(level);
  const nextLevelXP = getXPForLevel(level + 1);
  const needed = nextLevelXP - currentLevelXP;
  const progress = totalXP - currentLevelXP;
  const progressPercent = needed > 0 ? Math.min(100, (progress / needed) * 100) : 100;

  return {
    level,
    progressPercent,
    xpToNext: Math.max(0, nextLevelXP - totalXP),
    currentLevelXP,
    nextLevelXP,
  };
}

const LEVEL_TITLES: [number, string][] = [
  [50, "Transcendent"],
  [40, "Legend"],
  [30, "Grandmaster"],
  [20, "Master"],
  [15, "Disciplined"],
  [10, "Focused"],
  [6, "Dedicated"],
  [3, "Apprentice"],
  [1, "Beginner"],
];

export function getLevelTitle(level: number): string {
  for (const [min, title] of LEVEL_TITLES) {
    if (level >= min) return title;
  }
  return "Beginner";
}
