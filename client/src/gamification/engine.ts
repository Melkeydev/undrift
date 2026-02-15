import type {
  GamificationData,
  GamificationSessionCtx,
  GamificationCounters,
  XPSource,
  XPEvent,
  EarnedAchievement,
} from "./types";
import { ACHIEVEMENT_DEFINITIONS, ACHIEVEMENT_XP } from "./achievements";
import { calculateLevel } from "./levels";

const DAILY_XP_CAP = 500;
const MAX_HISTORY = 50;
const MAX_RESISTANCE_PER_SESSION = 5;
const MAX_BREATHING_PER_SESSION = 3;

export function createDefaultGamificationData(): GamificationData {
  return {
    xp: {
      total: 0,
      todayEarned: 0,
      todayDate: getTodayString(),
      level: 1,
      history: [],
    },
    achievements: {
      earned: [],
    },
    counters: {
      totalSessionsCompleted: 0,
      totalInterruptionsResisted: 0,
      totalFocusMinutes: 0,
      totalBreathingExercises: 0,
      totalReflections: 0,
      totalTimeSavedMinutes: 0,
      consecutiveCompletedSessions: 0,
      consecutiveCleanSessions: 0,
    },
  };
}

export function createDefaultSessionCtx(sessionId: string): GamificationSessionCtx {
  return {
    sessionId,
    interruptionsRewarded: 0,
    breathingRewarded: 0,
  };
}

interface AwardXPResult {
  data: GamificationData;
  awarded: number;
  leveledUp: boolean;
  newLevel: number;
}

export function awardXP(
  data: GamificationData,
  source: XPSource,
  amount: number,
  description: string,
  sessionCtx?: GamificationSessionCtx,
): AwardXPResult {
  const today = getTodayString();

  if (data.xp.todayDate !== today) {
    data.xp.todayEarned = 0;
    data.xp.todayDate = today;
  }

  let awarded = amount;
  if (source !== "achievement") {
    const remaining = Math.max(0, DAILY_XP_CAP - data.xp.todayEarned);
    awarded = Math.min(amount, remaining);
  }

  if (sessionCtx) {
    if (source === "interruption_resisted") {
      if (sessionCtx.interruptionsRewarded >= MAX_RESISTANCE_PER_SESSION) {
        awarded = 0;
      } else {
        sessionCtx.interruptionsRewarded++;
      }
    }
    if (source === "breathing_exercise") {
      if (sessionCtx.breathingRewarded >= MAX_BREATHING_PER_SESSION) {
        awarded = 0;
      } else {
        sessionCtx.breathingRewarded++;
      }
    }
  }

  if (awarded <= 0) {
    return { data, awarded: 0, leveledUp: false, newLevel: data.xp.level };
  }

  const oldLevel = data.xp.level;
  data.xp.total += awarded;
  if (source !== "achievement") {
    data.xp.todayEarned += awarded;
  }
  data.xp.level = calculateLevel(data.xp.total);

  const event: XPEvent = {
    timestamp: Date.now(),
    amount: awarded,
    source,
    description,
  };
  data.xp.history.unshift(event);
  if (data.xp.history.length > MAX_HISTORY) {
    data.xp.history = data.xp.history.slice(0, MAX_HISTORY);
  }

  return {
    data,
    awarded,
    leveledUp: data.xp.level > oldLevel,
    newLevel: data.xp.level,
  };
}

export type CounterEvent =
  | { type: "session_complete"; durationMinutes: number; interruptionCount: number; startedAt: number }
  | { type: "session_manual_end" }
  | { type: "interruption_resisted" }
  | { type: "breathing_complete" }
  | { type: "reflection_submitted" };

export function updateCounters(
  data: GamificationData,
  event: CounterEvent,
): GamificationData {
  const c = data.counters;

  switch (event.type) {
    case "session_complete":
      c.totalSessionsCompleted++;
      c.totalFocusMinutes += event.durationMinutes;
      c.totalTimeSavedMinutes += event.durationMinutes;
      c.consecutiveCompletedSessions++;
      if (event.interruptionCount === 0) {
        c.consecutiveCleanSessions++;
      } else {
        c.consecutiveCleanSessions = 0;
      }
      break;
    case "session_manual_end":
      c.consecutiveCompletedSessions = 0;
      c.consecutiveCleanSessions = 0;
      break;
    case "interruption_resisted":
      c.totalInterruptionsResisted++;
      break;
    case "breathing_complete":
      c.totalBreathingExercises++;
      break;
    case "reflection_submitted":
      c.totalReflections++;
      break;
  }

  return data;
}

interface CheckContext {
  sessionStartedAt?: number;
  sessionEndedAt?: number;
  sessionDurationMinutes?: number;
}

interface CheckAchievementsResult {
  data: GamificationData;
  newAchievements: EarnedAchievement[];
}

export function checkAchievements(
  data: GamificationData,
  checkCtx?: CheckContext,
): CheckAchievementsResult {
  const earnedIds = new Set(data.achievements.earned.map((a) => a.id));
  const newAchievements: EarnedAchievement[] = [];
  const counters = data.counters;

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (earnedIds.has(def.id)) continue;

    let earned = false;

    if (def.requirement) {
      const value = counters[def.requirement.counter as keyof GamificationCounters] as number;
      if (value >= def.requirement.threshold) {
        earned = true;
      }
    }

    if (def.customCheck) {
      earned = evaluateCustomCheck(def.customCheck, counters, checkCtx);
    }

    if (earned) {
      const achievement: EarnedAchievement = {
        id: def.id,
        earnedAt: Date.now(),
        tier: def.tier,
      };
      newAchievements.push(achievement);
      data.achievements.earned.push(achievement);
    }
  }

  return { data, newAchievements };
}

function evaluateCustomCheck(
  check: string,
  counters: GamificationCounters,
  ctx?: CheckContext,
): boolean {
  switch (check) {
    case "night_owl": {
      if (!ctx?.sessionEndedAt) return false;
      const hour = new Date(ctx.sessionEndedAt).getHours();
      return hour >= 0 && hour < 5;
    }
    case "early_bird": {
      if (!ctx?.sessionStartedAt) return false;
      const hour = new Date(ctx.sessionStartedAt).getHours();
      return hour < 6;
    }
    case "marathon": {
      return (ctx?.sessionDurationMinutes ?? 0) >= 180;
    }
    case "iron_will":
      return counters.totalInterruptionsResisted >= 10;
    case "perfectionist":
      return false;
    case "clean_slate":
      return false;
    default:
      return false;
  }
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}
