import type { AchievementDefinition, AchievementTier } from "./types";

export const ACHIEVEMENT_XP: Record<AchievementTier, number> = {
  bronze: 50,
  silver: 100,
  gold: 150,
  platinum: 200,
};

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  { id: "session_one", name: "Session One", description: "Complete your first focus session", icon: "\u25C9", tier: "bronze", category: "session", hidden: false, requirement: { counter: "totalSessionsCompleted", threshold: 1 } },
  { id: "ten_down", name: "Ten Down", description: "Complete 10 sessions", icon: "\u25CE", tier: "bronze", category: "session", hidden: false, requirement: { counter: "totalSessionsCompleted", threshold: 10 } },
  { id: "fifty_sessions", name: "Fifty Sessions", description: "Complete 50 sessions", icon: "\u25C8", tier: "silver", category: "session", hidden: false, requirement: { counter: "totalSessionsCompleted", threshold: 50 } },
  { id: "century_club", name: "Century Club", description: "Complete 100 sessions", icon: "\u2B21", tier: "silver", category: "session", hidden: false, requirement: { counter: "totalSessionsCompleted", threshold: 100 } },
  { id: "five_hundred", name: "Five Hundred", description: "Complete 500 sessions", icon: "\u2B22", tier: "gold", category: "session", hidden: false, requirement: { counter: "totalSessionsCompleted", threshold: 500 } },
  { id: "thousand_strong", name: "Thousand Strong", description: "Complete 1,000 sessions", icon: "\u2B23", tier: "platinum", category: "session", hidden: false, requirement: { counter: "totalSessionsCompleted", threshold: 1000 } },

  { id: "first_stand", name: "First Stand", description: "Resist 1 interruption", icon: "\u25B2", tier: "bronze", category: "resistance", hidden: false, requirement: { counter: "totalInterruptionsResisted", threshold: 1 } },
  { id: "iron_will", name: "Iron Will", description: "Resist 10 interruptions in a single day", icon: "\u2694", tier: "silver", category: "resistance", hidden: false, customCheck: "iron_will" },
  { id: "unbreakable", name: "Unbreakable", description: "Complete 5 consecutive sessions with zero manual ends", icon: "\u25A0", tier: "silver", category: "resistance", hidden: false, requirement: { counter: "consecutiveCompletedSessions", threshold: 5 } },
  { id: "fortress", name: "Fortress", description: "Resist 100 total interruptions", icon: "\u2656", tier: "gold", category: "resistance", hidden: false, requirement: { counter: "totalInterruptionsResisted", threshold: 100 } },
  { id: "untouchable", name: "Untouchable", description: "Complete 10 consecutive sessions without any interruptions", icon: "\u25C7", tier: "gold", category: "resistance", hidden: false, requirement: { counter: "consecutiveCleanSessions", threshold: 10 } },

  { id: "first_hour", name: "First Hour", description: "Accumulate 1 hour of focus time", icon: "\u29D7", tier: "bronze", category: "time", hidden: false, requirement: { counter: "totalFocusMinutes", threshold: 60 } },
  { id: "ten_hours", name: "Ten Hours", description: "Accumulate 10 hours of focus time", icon: "\u29D6", tier: "bronze", category: "time", hidden: false, requirement: { counter: "totalFocusMinutes", threshold: 600 } },
  { id: "day_of_focus", name: "Day of Focus", description: "Accumulate 24 hours of focus time", icon: "\u2609", tier: "silver", category: "time", hidden: false, requirement: { counter: "totalFocusMinutes", threshold: 1440 } },
  { id: "hundred_hours", name: "Hundred Hours", description: "Accumulate 100 hours of focus time", icon: "\u29D7", tier: "gold", category: "time", hidden: false, requirement: { counter: "totalFocusMinutes", threshold: 6000 } },
  { id: "focus_olympian", name: "Focus Olympian", description: "Accumulate 500 hours of focus time", icon: "\u2B21", tier: "platinum", category: "time", hidden: false, requirement: { counter: "totalFocusMinutes", threshold: 30000 } },

  { id: "reclaimed", name: "Reclaimed", description: "Save 1 hour from distracting sites", icon: "\u21BA", tier: "bronze", category: "time_saved", hidden: false, requirement: { counter: "totalTimeSavedMinutes", threshold: 60 } },
  { id: "full_day_back", name: "Full Day Back", description: "Save 24 hours total", icon: "\u21BB", tier: "silver", category: "time_saved", hidden: false, requirement: { counter: "totalTimeSavedMinutes", threshold: 1440 } },
  { id: "week_reclaimed", name: "Week Reclaimed", description: "Save 168 hours total", icon: "\u2912", tier: "gold", category: "time_saved", hidden: false, requirement: { counter: "totalTimeSavedMinutes", threshold: 10080 } },

  { id: "deep_breath", name: "Deep Breath", description: "Complete 1 breathing exercise", icon: "\u2058", tier: "bronze", category: "intervention", hidden: false, requirement: { counter: "totalBreathingExercises", threshold: 1 } },
  { id: "mindful_ten", name: "Mindful Ten", description: "Complete 10 breathing exercises", icon: "\u2059", tier: "silver", category: "intervention", hidden: false, requirement: { counter: "totalBreathingExercises", threshold: 10 } },
  { id: "first_reflection", name: "First Reflection", description: "Submit 1 reflection", icon: "\u270E", tier: "bronze", category: "intervention", hidden: false, requirement: { counter: "totalReflections", threshold: 1 } },
  { id: "journaler", name: "Journaler", description: "Submit 25 reflections", icon: "\u2710", tier: "silver", category: "intervention", hidden: false, requirement: { counter: "totalReflections", threshold: 25 } },
  { id: "introspective", name: "Introspective", description: "Submit 100 reflections", icon: "\u2738", tier: "gold", category: "intervention", hidden: false, requirement: { counter: "totalReflections", threshold: 100 } },

  { id: "night_owl", name: "Night Owl", description: "Complete a session that ends after midnight", icon: "\u263D", tier: "bronze", category: "special", hidden: true, customCheck: "night_owl" },
  { id: "early_bird", name: "Early Bird", description: "Start a session before 6 AM", icon: "\u2600", tier: "bronze", category: "special", hidden: true, customCheck: "early_bird" },
  { id: "marathon", name: "Marathon", description: "Complete a single session of 3+ hours", icon: "\u2192", tier: "silver", category: "special", hidden: true, customCheck: "marathon" },
  { id: "perfectionist", name: "Perfectionist", description: "Complete every session in a calendar week (7/7 days)", icon: "\u2737", tier: "gold", category: "special", hidden: true, customCheck: "perfectionist" },
  { id: "clean_slate", name: "Clean Slate", description: "Go a full week with zero time on blocked sites outside sessions", icon: "\u2730", tier: "gold", category: "special", hidden: true, customCheck: "clean_slate" },
];
