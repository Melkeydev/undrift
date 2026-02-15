# Gamification

## Overview

Undrift's gamification system reinforces positive behavior through achievements, progression, and visual rewards. The goal is not to make focusing "fun" in a game-like way, but to leverage loss aversion, milestone psychology, and visible progress to make distraction avoidance self-reinforcing.

**Design philosophy:** Gamification should feel earned, not gimmicky. Every element ties directly to real behavioral data — no artificial point inflation or meaningless badges.

---

## 1. Achievements (Badges)

### How They Work

Achievements unlock automatically when the user hits specific behavioral milestones. Once earned, they persist permanently. Each achievement has:

- **Name** — short, evocative
- **Description** — what was accomplished
- **Icon** — distinct visual (emoji or custom SVG)
- **Tier** — bronze / silver / gold / platinum (for multi-level achievements)
- **Earned date** — when the user unlocked it
- **Rarity** — optional, for future social features ("12% of users have this")

### Achievement Categories

#### Streak Achievements

| Badge | Requirement | Tier |
|-------|-------------|------|
| First Spark | Complete 1 focus session | Bronze |
| Three-Day Hold | 3-day streak | Bronze |
| Week Warrior | 7-day streak | Silver |
| Fortnight Focus | 14-day streak | Silver |
| Monthly Master | 30-day streak | Gold |
| Sixty Strong | 60-day streak | Gold |
| Quarterly Titan | 90-day streak | Platinum |
| Half-Year Hero | 180-day streak | Platinum |
| Year of Focus | 365-day streak | Platinum |

#### Session Achievements

| Badge | Requirement | Tier |
|-------|-------------|------|
| Session One | Complete your first focus session | Bronze |
| Ten Down | Complete 10 sessions | Bronze |
| Fifty Sessions | Complete 50 sessions | Silver |
| Century Club | Complete 100 sessions | Silver |
| Five Hundred | Complete 500 sessions | Gold |
| Thousand Strong | Complete 1,000 sessions | Platinum |

#### Resistance Achievements

| Badge | Requirement | Tier |
|-------|-------------|------|
| First Stand | Resist 1 interruption (visit blocked site and go back to work) | Bronze |
| Iron Will | Resist 10 interruptions in a single day | Silver |
| Unbreakable | Complete 5 consecutive sessions with zero manual ends | Silver |
| Fortress | Resist 100 total interruptions | Gold |
| Untouchable | Complete 10 consecutive sessions without visiting a single blocked site | Gold |

#### Time Achievements

| Badge | Requirement | Tier |
|-------|-------------|------|
| First Hour | Accumulate 1 hour of focus session time | Bronze |
| Ten Hours | Accumulate 10 hours | Bronze |
| Day of Focus | Accumulate 24 hours | Silver |
| Hundred Hours | Accumulate 100 hours | Gold |
| Focus Olympian | Accumulate 500 hours | Platinum |

#### Time Saved Achievements

| Badge | Requirement | Tier |
|-------|-------------|------|
| Reclaimed | Save 1 hour from distracting sites | Bronze |
| Full Day Back | Save 24 hours total | Silver |
| Week Reclaimed | Save 168 hours total | Gold |

#### Intervention Achievements

| Badge | Requirement | Tier |
|-------|-------------|------|
| Deep Breath | Complete 1 breathing exercise on the intervention page | Bronze |
| Mindful Ten | Complete 10 breathing exercises | Silver |
| First Reflection | Submit 1 reflection prompt response | Bronze |
| Journaler | Submit 25 reflection responses | Silver |
| Introspective | Submit 100 reflection responses | Gold |

#### Special / Hidden Achievements

| Badge | Requirement | Tier |
|-------|-------------|------|
| Night Owl | Complete a session that ends after midnight | Bronze |
| Early Bird | Start a session before 6 AM | Bronze |
| Marathon | Complete a single session of 3+ hours | Silver |
| Comeback | Start a new streak after losing one that was 7+ days | Silver |
| Perfectionist | Complete every session in a calendar week (7/7 days) | Gold |
| Clean Slate | Go an entire week with zero time on blocked sites (outside sessions) | Gold |

Hidden achievements are not shown in the achievements list until earned — they appear as locked silhouettes with "???" descriptions.

---

## 2. Focus Level (XP System)

### Concept

Users earn Focus XP for positive behaviors. XP accumulates into a **Focus Level** that represents overall commitment. This is the single visible progression metric.

### XP Sources

| Action | XP Earned | Notes |
|--------|-----------|-------|
| Complete a focus session (timer expires) | 50 XP | Base reward for completion |
| Session duration bonus | +10 XP per 30 min | Longer sessions earn more |
| Resist an interruption (go back to work) | 15 XP | Each time on the intervention page |
| Complete a breathing exercise | 10 XP | Per exercise on intervention page |
| Submit a reflection | 10 XP | Per reflection on intervention page |
| Daily streak maintained | 25 XP | Awarded once per day when streak continues |
| Achievement unlocked | 50–200 XP | Varies by tier (bronze 50, silver 100, gold 150, platinum 200) |

### XP is Never Lost

XP does not decrease. Breaking a streak, ending a session early, or any negative event does NOT subtract XP. The level represents cumulative effort — it only goes up. This prevents the discouraging "losing progress" feeling that makes people quit.

### Level Thresholds

Levels follow a gradually increasing XP curve:

| Level | Total XP Required | Cumulative |
|-------|-------------------|------------|
| 1 | 0 | 0 |
| 2 | 100 | 100 |
| 3 | 250 | 350 |
| 4 | 450 | 800 |
| 5 | 700 | 1,500 |
| 6 | 1,000 | 2,500 |
| 7 | 1,500 | 4,000 |
| 8 | 2,000 | 6,000 |
| 9 | 3,000 | 9,000 |
| 10 | 4,000 | 13,000 |
| 11–20 | +5,000 each | 13,000–63,000 |
| 21–50 | +10,000 each | 63,000–363,000 |
| 50+ | +20,000 each | Open-ended |

Level titles (displayed next to level number):

| Level Range | Title |
|-------------|-------|
| 1–2 | Beginner |
| 3–5 | Apprentice |
| 6–9 | Dedicated |
| 10–14 | Focused |
| 15–19 | Disciplined |
| 20–29 | Master |
| 30–39 | Grandmaster |
| 40–49 | Legend |
| 50+ | Transcendent |

### Daily XP Cap

To prevent binge-gaming the system (e.g., starting and completing many short 1-minute sessions), there is a **daily XP cap of 500 XP**. Achievement XP is exempt from the cap.

---

## 3. Data Model

### Storage Schema

```typescript
interface GamificationData {
  // Focus Level / XP
  xp: {
    total: number;               // Lifetime XP earned
    todayEarned: number;         // XP earned today (resets at midnight)
    todayDate: string;           // "2026-02-14" — to detect day change
    level: number;               // Current level (computed but cached)
    history: XPEvent[];          // Recent XP events (keep last 50 for feed)
  };

  // Achievements
  achievements: {
    earned: EarnedAchievement[];  // All earned achievements
    progress: {                   // Progress toward unearned achievements
      [achievementId: string]: number;  // e.g., "sessions_completed": 47
    };
  };

  // Aggregate counters (for achievement tracking)
  counters: {
    totalSessionsCompleted: number;
    totalInterruptionsResisted: number;
    totalFocusMinutes: number;
    totalBreathingExercises: number;
    totalReflections: number;
    totalTimeSavedMinutes: number;
    consecutiveCompletedSessions: number;  // Resets on manual end
    consecutiveCleanSessions: number;      // Sessions with 0 interruptions
  };
}

interface XPEvent {
  timestamp: number;
  amount: number;
  source: string;       // "session_complete" | "interruption_resisted" | "achievement" | etc.
  description: string;  // "Completed 2-hour focus session"
}

interface EarnedAchievement {
  id: string;           // "streak_7" | "sessions_100" | etc.
  earnedAt: number;     // Timestamp
  tier: "bronze" | "silver" | "gold" | "platinum";
}
```

### Chrome Storage Key

All gamification data stored under `chrome.storage.local` key: `"gamification"`

### Counter Updates

Counters are incremented by the background service worker at the same points it already processes events:

| Existing Event | Counter Update |
|----------------|----------------|
| Session completes (timer expires) | `totalSessionsCompleted++`, `totalFocusMinutes += duration`, `consecutiveCompletedSessions++` |
| Session ended manually | `consecutiveCompletedSessions = 0` |
| Interruption with `outcome: "stayed"` | `totalInterruptionsResisted++` |
| Breathing exercise completed | `totalBreathingExercises++` |
| Reflection submitted | `totalReflections++` |

After each counter update, the background worker checks all achievement thresholds and awards any newly qualified achievements.

---

## 4. Achievement Checking Logic

Achievement evaluation runs after every counter update. The checker iterates through all unearned achievements and compares counter values against thresholds.

```typescript
// Pseudocode
function checkAchievements(counters: Counters, earned: EarnedAchievement[]): NewAchievement[] {
  const earnedIds = new Set(earned.map(a => a.id));
  const newlyEarned: NewAchievement[] = [];

  for (const [id, requirement] of ACHIEVEMENT_DEFINITIONS) {
    if (earnedIds.has(id)) continue;
    if (meetsRequirement(counters, requirement)) {
      newlyEarned.push({ id, tier: requirement.tier, earnedAt: Date.now() });
    }
  }

  return newlyEarned;
}
```

Achievement definitions are a static lookup table — no network calls needed.

---

## 5. Notifications for Gamification Events

Gamification events hook into the existing notification system (see [notifications.md](./notifications.md)).

### New Notification Types

| Event | Notification |
|-------|-------------|
| Achievement unlocked | Title: "Achievement Unlocked!" / Message: "{badge name} — {description}" |
| Level up | Title: "Level Up!" / Message: "You're now Level {n} — {title}" |
| Daily XP summary (optional) | Title: "Today's Progress" / Message: "You earned {n} XP today. Level {n} — {progress}% to next" |

### When to Notify

- **Achievement:** Immediately when earned (via `chrome.notifications.create`)
- **Level up:** Immediately when XP crosses a level threshold
- **Daily summary:** Optional, fires at user-configured evening time (shares the streak-check alarm)

---

## 6. UI Integration Points

### Popup

- **Level badge** in the header: circular badge showing current level number + XP progress ring
- **XP toast** when popup opens after earning XP: brief "+50 XP" animation that fades

### Intervention Page

- **XP feedback** after completing a breathing exercise or reflection: "+10 XP" appears briefly near the tool card
- **Achievement popup** if an achievement unlocks while on the intervention page: celebratory modal overlay with the badge, name, and description. Includes a "Nice!" dismiss button.

### Dashboard

New **Achievements** page in the dashboard navigation:

- **Level display** — large level number, title, XP progress bar to next level, total XP
- **Achievement grid** — all achievements displayed as cards in a grid
  - Earned: full color with icon, name, description, earned date
  - Unearned: grayed out with progress bar (e.g., "47/100 sessions")
  - Hidden: locked silhouette with "???" — no hints
- **Recent XP feed** — chronological list of recent XP events (last 50)
- **Stats summary** — total achievements earned (e.g., "18/42"), breakdown by tier

The existing dashboard **Overview** page gains:
- Level + XP bar in the stats row alongside streak and session count
- "Latest achievement" card showing the most recently earned badge

---

## 7. Visual Design

### Achievement Badges

Each tier has a distinct visual treatment:

| Tier | Border/Accent | Background |
|------|--------------|------------|
| Bronze | `#CD7F32` | `rgba(205, 127, 50, 0.1)` |
| Silver | `#C0C0C0` | `rgba(192, 192, 192, 0.1)` |
| Gold | `#FFD700` | `rgba(255, 215, 0, 0.1)` |
| Platinum | `#E5E4E2` with shimmer | `rgba(229, 228, 226, 0.1)` |

Badges use the existing dark theme (obsidian palette) as the canvas. Tier colors are accent only — borders, icon tints, and subtle background fills.

### Level Badge

- Circular badge, 32px in popup header, 64px on dashboard
- Level number centered in bold (Instrument Serif)
- Thin XP progress ring around the circle (amber `#f59e0b` fill on dark track)
- Subtle glow effect at level-up moment

### XP Animations

- **+XP toast:** Amber text floats up and fades out over 1.5s
- **Achievement unlock:** Badge slides in from bottom with a subtle scale bounce, gold shimmer on the border for gold/platinum tier
- **Level up:** Progress ring fills completely, brief pulse animation, number increments

All animations are CSS-only (keyframes) — no animation libraries.

---

## 8. Anti-Gaming Protections

Prevent users from exploiting the system for meaningless XP:

| Exploit | Protection |
|---------|------------|
| Spam short sessions (1 min each) | Daily XP cap (500 XP). Session XP scales with duration — 1-min session earns minimal XP (50 base only, no duration bonus). |
| Intentionally visit blocked sites to "resist" | Resistance XP has a per-session cap of 5 events (75 XP max). After 5 interruptions in one session, no more resistance XP. |
| Complete breathing exercises repeatedly | Breathing XP capped at 3 per session (30 XP max). |
| Submit empty reflections | Reflection must be >= 10 characters to earn XP. |
| Clock manipulation | XP events are validated against session timestamps. The `todayDate` check uses the date at XP-earn time, not a user-settable value. |

---

## 9. Implementation Priority

Gamification is a **post-MVP enhancement**. The core extension (blocking, interventions, time tracking, streaks, dashboard) must ship first.

### Phase 1 — Foundation (Implement First)
1. Data model + storage schema (add `gamification` key to chrome.storage.local)
2. Counter tracking (hook into existing session/interruption/intervention event handlers)
3. Achievement definitions (static lookup table)
4. Achievement checking logic (runs after counter updates)
5. XP calculation + level computation

### Phase 2 — Visibility
6. Dashboard achievements page (grid, progress bars, earned dates)
7. Level badge in popup header
8. Level + XP bar on dashboard overview

### Phase 3 — Feedback & Polish
9. Achievement unlock notifications (chrome.notifications)
10. Level-up notifications
11. XP toast animations (popup + intervention page)
12. Achievement unlock modal (intervention page)

### Phase 4 — Future
13. Hidden achievements reveal
14. Rarity percentages (requires server-side aggregation across users)
15. Achievement sharing (social image export)
16. Seasonal challenges / limited-time achievements

---

## 10. Relationship to Existing Systems

Gamification is a **read-only layer** on top of existing data. It does not change how sessions, streaks, interventions, or time tracking work. It only:

1. **Observes** events that already happen (session complete, interruption resisted, etc.)
2. **Computes** achievements and XP from those events
3. **Displays** progress in the UI

If gamification data is lost or corrupted, the core extension is unaffected. Achievements and XP can be recomputed from session history and counter data.

### Integration Points with Existing Specs

| Spec | Integration |
|------|-------------|
| [tracking.md](./tracking.md) | Reads `totalFocusMinutes`, streak data, time saved calculations |
| [interventions.md](./interventions.md) | Hooks into breathing exercise completion and reflection submission events |
| [notifications.md](./notifications.md) | Adds achievement and level-up notification types to the existing notification system |
| [dashboard.md](./dashboard.md) | Adds Achievements page to dashboard navigation, level badge to overview |
| [ui.md](./ui.md) | Adds level badge to popup header, XP toasts, achievement modals |
| [data-flow.md](./data-flow.md) | Gamification counter updates happen in the background worker alongside existing event processing |
