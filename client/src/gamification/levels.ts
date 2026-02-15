const LEVEL_THRESHOLDS: number[] = [
  0, 100, 350, 800, 1500, 2500, 4000, 6000, 9000, 13000
];

// Levels 11-20: +5,000 each
for (let i = 11; i <= 20; i++) {
  LEVEL_THRESHOLDS.push(LEVEL_THRESHOLDS[i - 1]! + 5000);
}

// Levels 21-50: +10,000 each
for (let i = 21; i <= 50; i++) {
  LEVEL_THRESHOLDS.push(LEVEL_THRESHOLDS[i - 1]! + 10000);
}

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
