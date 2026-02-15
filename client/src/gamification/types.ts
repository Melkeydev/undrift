export type AchievementTier = "bronze" | "silver" | "gold" | "platinum";

export type AchievementCategory =
  | "session"
  | "resistance"
  | "time"
  | "time_saved"
  | "intervention"
  | "special";

export type XPSource =
  | "session_complete"
  | "session_duration_bonus"
  | "interruption_resisted"
  | "breathing_exercise"
  | "reflection"
  | "achievement";

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: AchievementTier;
  category: AchievementCategory;
  hidden: boolean;
  /** Counter key and threshold for simple achievements */
  requirement?: {
    counter: string;
    threshold: number;
  };
  /** For achievements needing custom logic (Night Owl, etc.) */
  customCheck?: string;
}

export interface EarnedAchievement {
  id: string;
  earnedAt: number;
  tier: AchievementTier;
}

export interface XPEvent {
  timestamp: number;
  amount: number;
  source: XPSource;
  description: string;
}

export interface GamificationCounters {
  totalSessionsCompleted: number;
  totalInterruptionsResisted: number;
  totalFocusMinutes: number;
  totalBreathingExercises: number;
  totalReflections: number;
  totalTimeSavedMinutes: number;
  consecutiveCompletedSessions: number;
  consecutiveCleanSessions: number;
}

export interface GamificationData {
  xp: {
    total: number;
    todayEarned: number;
    todayDate: string;
    level: number;
    history: XPEvent[];
  };
  achievements: {
    earned: EarnedAchievement[];
  };
  counters: GamificationCounters;
}

/** Per-session context to enforce per-session caps */
export interface GamificationSessionCtx {
  sessionId: string;
  interruptionsRewarded: number;
  breathingRewarded: number;
}
