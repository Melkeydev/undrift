import { useState, useEffect } from "react";
import { LevelBadge } from "../../components/LevelBadge";
import {
  getXPProgress,
  getLevelTitle,
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_XP,
} from "../../gamification";
import type {
  GamificationData,
  AchievementCategory,
} from "../../gamification";
import { getGamificationData } from "../storage";

const CATEGORIES: { key: AchievementCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "session", label: "Session" },
  { key: "resistance", label: "Resistance" },
  { key: "time", label: "Time" },
  { key: "intervention", label: "Intervention" },
  { key: "special", label: "Special" },
];

const TIER_COLORS: Record<string, string> = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#FFD700",
  platinum: "#E5E4E2",
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatXPTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Achievements() {
  const [data, setData] = useState<GamificationData | null>(null);
  const [category, setCategory] = useState<AchievementCategory | "all">("all");

  useEffect(() => {
    getGamificationData().then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center py-16 text-text-muted text-sm gap-3">
        <div className="w-1.5 h-1.5 rounded-full bg-accent-ember animate-pulse-dot" />
        <div className="w-1.5 h-1.5 rounded-full bg-accent-ember animate-pulse-dot animate-pulse-dot-2" />
        <div className="w-1.5 h-1.5 rounded-full bg-accent-ember animate-pulse-dot animate-pulse-dot-3" />
      </div>
    );
  }

  const progress = getXPProgress(data.xp.total);
  const title = getLevelTitle(progress.level);
  const earnedMap = new Map(data.achievements.earned.map((a) => [a.id, a]));

  const filtered =
    category === "all"
      ? ACHIEVEMENT_DEFINITIONS
      : ACHIEVEMENT_DEFINITIONS.filter((d) => d.category === category);

  const earnedCount = data.achievements.earned.length;
  const totalCount = ACHIEVEMENT_DEFINITIONS.length;

  const tierBreakdown = data.achievements.earned.reduce(
    (acc, a) => {
      acc[a.tier] = (acc[a.tier] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="animate-page-enter">
      <div className="bg-bg-card border border-border-card rounded-md p-6 backdrop-blur-[8px] shadow-card mb-7">
        <div className="flex items-center gap-6 py-4 px-2">
          <LevelBadge level={progress.level} progressPercent={progress.progressPercent} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-display text-2xl font-semibold text-text-heading">
                Level {progress.level}
              </span>
              <span className="text-sm text-accent-ember font-medium">{title}</span>
            </div>
            <div className="w-full h-2 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full bg-accent-ember rounded-full transition-all duration-500"
                style={{ width: `${progress.progressPercent}%` }}
              />
            </div>
            <div className="text-xs text-text-muted">
              {data.xp.total.toLocaleString()} XP total &middot; {progress.xpToNext.toLocaleString()} XP to next level
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-7 max-md:grid-cols-2">
        <div className="bg-bg-card border border-border-card rounded-md p-4 text-center">
          <div className="font-display text-2xl text-text-heading">{earnedCount}/{totalCount}</div>
          <div className="text-[10px] text-text-muted uppercase tracking-wide mt-1">Earned</div>
        </div>
        {(["bronze", "silver", "gold", "platinum"] as const).map((tier) => (
          <div key={tier} className="bg-bg-card border border-border-card rounded-md p-4 text-center">
            <div className="font-display text-2xl" style={{ color: TIER_COLORS[tier] }}>
              {tierBreakdown[tier] || 0}
            </div>
            <div className="text-[10px] text-text-muted uppercase tracking-wide mt-1 capitalize">{tier}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`px-3.5 py-1.5 rounded-sm text-xs font-medium tracking-wide transition-colors duration-150 whitespace-nowrap border ${
              category === c.key
                ? "bg-accent-ember-glow text-accent-ember border-accent-ember/30"
                : "bg-transparent text-text-secondary border-border-subtle hover:bg-[rgba(255,255,255,0.04)]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-text-secondary mb-4">
        Achievements
      </h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 mb-10">
        {filtered.map((def) => {
          const earned = earnedMap.get(def.id);
          const isHidden = def.hidden && !earned;
          const counterKey = def.requirement?.counter;
          const threshold = def.requirement?.threshold ?? 0;
          const currentValue = counterKey
            ? (data.counters[counterKey as keyof typeof data.counters] as number)
            : 0;
          const progressPct = threshold > 0 ? Math.min(100, (currentValue / threshold) * 100) : 0;

          return (
            <div
              key={def.id}
              className={`bg-bg-card border rounded-md p-4 transition-all duration-200 ${
                earned
                  ? "border-opacity-50"
                  : "border-border-card opacity-50"
              }`}
              style={
                earned
                  ? { borderColor: `${TIER_COLORS[earned.tier]}40` }
                  : undefined
              }
            >
              <div className="flex items-start gap-3">
                <span className={`text-2xl ${!earned && !isHidden ? "grayscale" : ""}`}>
                  {isHidden ? "\uD83D\uDD12" : def.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-heading truncate">
                      {isHidden ? "???" : def.name}
                    </span>
                    {earned && (
                      <span
                        className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                        style={{
                          color: TIER_COLORS[earned.tier],
                          background: `${TIER_COLORS[earned.tier]}15`,
                        }}
                      >
                        {earned.tier}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-muted mt-0.5 leading-snug">
                    {isHidden ? "Hidden achievement" : def.description}
                  </div>
                  {earned ? (
                    <div className="text-[10px] text-text-muted mt-2">
                      Earned {formatDate(earned.earnedAt)} &middot; +{ACHIEVEMENT_XP[earned.tier]} XP
                    </div>
                  ) : !isHidden && def.requirement ? (
                    <div className="mt-2">
                      <div className="w-full h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-text-muted/40 rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-text-muted mt-1">
                        {currentValue}/{threshold}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {data.xp.history.length > 0 && (
        <>
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-text-secondary mb-4">
            Recent XP
          </h3>
          <div className="bg-bg-card border border-border-card rounded-md overflow-hidden mb-10">
            {data.xp.history.slice(0, 20).map((event, i) => (
              <div
                key={`${event.timestamp}-${i}`}
                className={`flex items-center justify-between px-5 py-3 ${
                  i > 0 ? "border-t border-border-subtle" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">{event.description}</div>
                  <div className="text-[10px] text-text-muted mt-0.5">{formatXPTime(event.timestamp)}</div>
                </div>
                <span className="text-sm font-semibold text-accent-ember ml-4 whitespace-nowrap">
                  +{event.amount} XP
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
