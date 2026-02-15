# Time Tracking & Streaks

## Overview

Undrift tracks two categories of user behavior:

1. **Passive time tracking** — How long users spend on specific websites (runs continuously, not just during focus sessions)
2. **Active session tracking** — Focus session history, interruption attempts, and streak data

---

## 1. Passive Time Tracking

### What We Track

For every website the user visits (or optionally, only tracked/blocked sites), record:

| Data Point | Source | Description |
|------------|--------|-------------|
| Domain | `chrome.tabs.onActivated` + `chrome.tabs.get()` | The hostname of the active tab |
| Duration | Calculated from tab switch timestamps | Seconds spent on this domain |
| Date | `Date.now()` | Calendar day (for daily aggregation) |
| Active vs. idle | `chrome.idle.onStateChanged` | Whether user was actively engaged |

### How It Works

The service worker maintains a state machine:

```
Tab A activated (youtube.com)     → start timer for youtube.com
Tab B activated (reddit.com)      → stop youtube timer, save elapsed, start reddit timer
Window focus lost                 → stop current timer (chrome.windows.onFocusChanged)
User goes idle (60s threshold)    → stop current timer (chrome.idle.onStateChanged → "idle")
User returns from idle            → restart timer for current active tab
Service worker suspended          → alarm heartbeat saves accumulated time to storage
Service worker restarts           → reads state from storage, resumes tracking
```

### Chrome APIs Used

| API | Event/Method | Purpose |
|-----|-------------|---------|
| `chrome.tabs` | `onActivated` | Detect tab switches |
| `chrome.tabs` | `onUpdated` (filter: `changeInfo.url`) | Detect in-tab navigation |
| `chrome.tabs` | `onRemoved` | Detect tab close |
| `chrome.tabs` | `get(tabId)` | Fetch URL for active tab (onActivated doesn't include URL) |
| `chrome.windows` | `onFocusChanged` | Detect Chrome losing/gaining focus |
| `chrome.idle` | `onStateChanged` | Detect user idle/locked/active |
| `chrome.idle` | `setDetectionInterval(60)` | Configure idle threshold |
| `chrome.alarms` | `create("heartbeat", { periodInMinutes: 0.5 })` | 30-second heartbeat to persist accumulated time |
| `chrome.storage.local` | `set/get` | Persist tracking data |

### Storage Schema

```typescript
// Stored in chrome.storage.local
interface TimeTrackingData {
  // Daily aggregated time per domain (in seconds)
  daily: {
    [date: string]: {           // "2026-02-07"
      [domain: string]: number  // "youtube.com": 1834
    }
  };

  // Current tracking state (for resuming after service worker restart)
  current: {
    domain: string;             // "youtube.com"
    startedAt: number;          // timestamp ms
  } | null;
}
```

### Heartbeat Pattern

Because the MV3 service worker can be terminated at any time, accumulated time must be persisted frequently:

1. `chrome.alarms.create("heartbeat", { periodInMinutes: 0.5 })` — fires every 30 seconds
2. On each heartbeat: calculate elapsed time since `current.startedAt`, add to `daily[today][domain]`, reset `startedAt` to now
3. On tab switch / window blur / idle: same calculation, then update `current` to new state

### Edge Cases

- **Multiple windows:** Track the active tab in the **focused** window only. `chrome.windows.onFocusChanged` tells us which window has focus.
- **`chrome-extension://` URLs:** Don't track time on extension pages (popup, blocked page, settings).
- **`chrome://` URLs:** Don't track internal Chrome pages (new tab, settings, etc.).
- **`about:blank`:** Ignore.
- **Browser restart:** `onStartup` listener re-creates the heartbeat alarm and resumes tracking if a `current` state exists in storage.

---

## 2. Session History

### What We Track Per Session

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | string | UUID for this session |
| `startedAt` | number | Timestamp when session started |
| `endedAt` | number | Timestamp when session ended (null if active) |
| `durationMinutes` | number | Configured session length |
| `blockedSites` | string[] | Domains blocked in this session |
| `interruptions` | Interruption[] | Each time user tried to visit a blocked site |
| `endReason` | string | `"timer"` \| `"manual"` \| `"browser_closed"` |
| `completed` | boolean | Whether session ran to completion without manual end |

### Interruption Record

Each time the user navigates to a blocked site, we record:

```typescript
interface Interruption {
  timestamp: number;        // When the attempt happened
  domain: string;           // Which blocked site they tried to visit
  outcome: "stayed" | "broke";  // Did they stay focused or break the session?
}
```

In v2 there is no payment to break — the blocked page uses interventions. The `outcome` tracks whether the user:
- **"stayed"**: Viewed the intervention page and navigated away (or waited for session to end)
- **"broke"**: Manually ended the session from the popup while on the blocked page

### Storage

Sessions are stored in `chrome.storage.local` and periodically synced to the server:

```typescript
interface SessionHistory {
  sessions: FocusSession[];     // Recent sessions (keep last 100 locally)
  lastSyncedAt: number;         // Timestamp of last server sync
}
```

---

## 3. Streak System

### Definition

A **streak** is consecutive calendar days where the user completed at least one focus session without manually ending it early (i.e., `endReason === "timer"` and `completed === true`).

### Data Model

```typescript
interface StreakData {
  currentStreak: number;         // Current consecutive days
  longestStreak: number;         // All-time best
  lastCompletedDate: string;     // "2026-02-07" — last day a session was fully completed
  streakStartDate: string;       // When current streak began
}
```

### Streak Rules

1. **Streak increments** when a session completes naturally (timer expires) on a new calendar day
2. **Streak breaks** when a full calendar day passes with no completed session (checked via heartbeat alarm at midnight or on next app open)
3. **Multiple sessions per day** count as one day — streak is about daily consistency, not session count
4. **Manual session end** does NOT break the streak on its own — it just doesn't count toward today's completion. If the user starts another session and completes it, the day still counts.

### Streak Notifications

- **Streak milestone:** "You've been focused for 7 days straight!" (at 3, 7, 14, 30, 60, 90 days)
- **Streak at risk:** "Complete a focus session today to keep your 12-day streak!" (fires in the evening if no completed session that day)
- **Streak broken:** "Your 12-day streak ended. Start a new one today." (next day)

---

## 4. Dashboard Sync

### What Gets Synced to Server

| Data | Frequency | Direction |
|------|-----------|-----------|
| Daily time tracking | Every 5 minutes (if changed) | Extension → Server |
| Session history | On session end | Extension → Server |
| Streak data | On streak change | Extension → Server |
| User preferences | On change | Bidirectional |

### Sync Mechanism

1. Extension collects data in `chrome.storage.local`
2. Background service worker periodically sends data to server via `POST /api/sync`
3. Server stores in database, computes analytics
4. Dashboard web app reads from server API

### Offline Support

The extension works fully offline. Data accumulates locally and syncs when connectivity is restored. The server handles deduplication via session IDs and date-keyed time data.

---

## 5. Analytics Derived from Tracking Data

The dashboard can compute and display:

| Metric | Source | Description |
|--------|--------|-------------|
| Daily screen time | Time tracking | Total time on tracked sites per day |
| Top time sinks | Time tracking | Sites ranked by time spent |
| Focus session completion rate | Session history | % of sessions that ran to completion |
| Average interruptions per session | Session history | How often users try to break focus |
| Most tempting sites | Interruption records | Which blocked sites users try to visit most |
| Streak history | Streak data | Visual timeline of streaks |
| Week-over-week trend | Time tracking | Is screen time going up or down? |
| Time saved | Time tracking + sessions | Estimated time not spent on blocked sites during sessions |
